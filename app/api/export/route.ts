import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import crypto from 'crypto';
import { cleanupOldFiles } from '@/lib/cleanup';

// Set FFmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

function formatSrtTime(seconds: number): string {
  const date = new Date(seconds * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

function generateSrt(subtitles: any[]): string {
  const sortedSubs = [...subtitles].sort((a, b) => a.start - b.start);

  return sortedSubs
    .map((sub, index) => {
      let startSec = sub.start;
      let endSec = sub.end;

      // Ensure end is strictly after start
      if (endSec <= startSec) {
        endSec = startSec + 0.1; // minimum duration
      }

      const start = formatSrtTime(startSec);
      const end = formatSrtTime(endSec);
      
      return `${index + 1}\n${start} --> ${end}\n${sub.text}\n`;
    })
    .join('\n');
}
function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function generateAss(subtitles: any[], style: any, targetW: number, targetH: number): string {
  const pColor = parseColorToASS(style?.textColor || '#ffffff');
  const isTransparent = style?.backgroundColor === 'transparent';
  const bColor = isTransparent ? '&H00000000' : parseColorToASS(style?.backgroundColor || '#000000b3'); 
  const size = style?.fontSize || 24;
  
  // SecondaryColour: Translucent white &H99FFFFFF for upcoming words
  const secColor = '&H99FFFFFF'; 
  
  const borderStyle = isTransparent ? '1' : '3';
  const outline = isTransparent ? '2' : '0';
  const shadow = isTransparent ? '1' : '0';

  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${targetW}
PlayResY: ${targetH}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Battambang,${size},${pColor},${secColor},${bColor},${bColor},0,0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const sortedSubs = [...subtitles].sort((a, b) => a.start - b.start);

  for (const sub of sortedSubs) {
    let startSec = sub.start;
    let endSec = sub.end;
    if (endSec <= startSec) endSec = startSec + 0.1;

    const start = formatAssTime(startSec);
    const end = formatAssTime(endSec);
    
    const words = sub.text.split(' ');
    const durationCs = Math.floor((endSec - startSec) * 100);
    const timePerWordCs = Math.floor(durationCs / Math.max(words.length, 1));
    
    const karaokeText = words.map((w: string) => `{\\K${timePerWordCs}}${w}`).join(' ');

    ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${karaokeText}\n`;
  }

  return ass;
}
function parseColorToASS(colorStr: string): string {
  if (colorStr === 'transparent') return '&HFF000000'; // Fully transparent
  if (!colorStr || !colorStr.startsWith('#')) return '&H00FFFFFF';
  
  const r = colorStr.slice(1, 3);
  const g = colorStr.slice(3, 5);
  const b = colorStr.slice(5, 7);
  let aHex = '00'; // ASS opaque
  
  if (colorStr.length === 9) {
    // HTML alpha: 00 is transparent, FF is opaque.
    // ASS alpha: 00 is opaque, FF is transparent.
    const htmlAlpha = parseInt(colorStr.slice(7, 9), 16);
    const assAlpha = 255 - htmlAlpha;
    aHex = assAlpha.toString(16).padStart(2, '0').toUpperCase();
  }
  
  return `&H${aHex}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
}

// ── PCM mixing helpers ───────────────────────────────────────────────────────

const SR  = 48000; // sample rate Hz
const CH  = 2;     // stereo
const BPS = 2;     // bytes per s16le sample

/**
 * Decode an audio file to raw s16le PCM by writing to a temp file.
 * Using a temp file (rather than piping stdout) avoids Windows
 * stdout-buffering issues that cause incomplete / truncated audio data.
 */
async function decodeToPCM(audioPath: string, tempOutPath: string, atempo: number = 1.0): Promise<Buffer> {
  if (!ffmpegStatic) throw new Error('ffmpeg-static not found');

  if (!fs.existsSync(audioPath)) {
    console.warn(`Audio file not found, returning empty buffer for: ${audioPath}`);
    return Buffer.alloc(0);
  }
  if (fs.statSync(audioPath).size === 0) {
    console.warn(`Audio file is 0 bytes, returning empty buffer for: ${audioPath}`);
    return Buffer.alloc(0);
  }

  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y', '-i', audioPath,
      '-vn',                    // no video
    ];
    
    // Apply speed adjustment if needed (cap between 0.85x and 2.0x to keep in sync with the script)
    let afFilter = '';
    if (atempo !== 1.0) {
      const safeTempo = Math.max(0.85, Math.min(2.0, atempo));
      afFilter = `atempo=${safeTempo.toFixed(3)}`;
    }
    
    // Always append a tiny bit of silence to prevent final samples from being dropped
    afFilter = afFilter ? `${afFilter},apad=pad_dur=0.1` : 'apad=pad_dur=0.1';
    args.push('-af', afFilter);

    args.push(
      '-acodec', 'pcm_s16le',
      '-ar', String(SR),
      '-ac', String(CH),
      '-f', 's16le',
      tempOutPath
    );

    const proc = spawn(ffmpegStatic!, args);
    let stderrOutput = '';
    proc.stderr.on('data', (d) => { stderrOutput += d.toString(); }); // capture FFmpeg logs
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg decode exited ${code}: ${audioPath}\nDetails: ${stderrOutput}`));
    });
    proc.on('error', reject);
  });

  return fs.promises.readFile(tempOutPath);
}

/** Build a minimal 44-byte WAV header for s16le stereo 48 kHz PCM. */
function buildWavHeader(numFrames: number): Buffer {
  const dataSize = numFrames * CH * BPS;
  const h = Buffer.alloc(44, 0);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + dataSize, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1,  20);             // PCM
  h.writeUInt16LE(CH, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * CH * BPS, 28);
  h.writeUInt16LE(CH * BPS, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(dataSize, 40);
  return h;
}

/**
 * Mix positioned PCM clips into one WAV buffer.
 *
 * Each clip's Int16 samples are accumulated (as Float32 to prevent overflow)
 * into a shared output array starting at the clip's sample offset, then
 * clamped back to [-32768, 32767] and wrapped in a WAV header.
 *
 * Clips are NOT trimmed — they play to their natural end.  If two clips
 * overlap, their samples are simply summed (louder, but never choppy).
 */
function mixClipsToWav(clips: Array<{ pcm: Buffer; startSec: number }>): Buffer {
  if (clips.length === 0) {
    // Return 1 second of silence so the encoder doesn't complain
    const frames = SR;
    return Buffer.concat([buildWavHeader(frames), Buffer.alloc(frames * CH * BPS, 0)]);
  }

  // Find the total output length (in Int16 units = frames × channels)
  let totalInt16 = 0;
  for (const clip of clips) {
    const startInt16 = Math.floor(clip.startSec * SR) * CH;
    const clipInt16  = Math.floor(clip.pcm.length / BPS);
    totalInt16 = Math.max(totalInt16, startInt16 + clipInt16);
  }

  // Accumulate in Float32 to avoid intermediate clipping
  const acc = new Float32Array(totalInt16);

  for (const clip of clips) {
    const startInt16 = Math.floor(clip.startSec * SR) * CH;
    
    // Fast conversion from Node Buffer to Int16Array
    const tmpBuffer = new ArrayBuffer(clip.pcm.length);
    const tmpView = new Uint8Array(tmpBuffer);
    tmpView.set(clip.pcm); // native memory copy
    const tmp = new Int16Array(tmpBuffer);
    
    for (let i = 0; i < tmp.length; i++) {
      const idx = startInt16 + i;
      if (idx < acc.length) acc[idx] += tmp[i];
    }
  }

  // Clamp to Int16 range
  const out16 = new Int16Array(totalInt16);
  for (let i = 0; i < acc.length; i++) {
    let val = acc[i];
    if (val > 32767) val = 32767;
    else if (val < -32768) val = -32768;
    out16[i] = val;
  }

  const numFrames = Math.floor(totalInt16 / CH);
  const header    = buildWavHeader(numFrames);
  
  // Fast creation of Buffer from TypedArray's underlying ArrayBuffer
  const pcmBuf = Buffer.from(out16.buffer, out16.byteOffset, out16.byteLength);
  
  return Buffer.concat([header, pcmBuf]);
}


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const videoFile = formData.get('video') as File;
    const subtitlesJson = formData.get('subtitles') as string;
    const subtitleStyleJson = formData.get('subtitleStyle') as string;
    const burnSubtitlesStr = formData.get('burnSubtitles') as string;
    const burnSubtitles = burnSubtitlesStr === 'false' ? false : true;

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    const trimStartStr = formData.get('trimStart') as string;
    const trimEndStr = formData.get('trimEnd') as string;
    const trimStart = trimStartStr ? parseFloat(trimStartStr) : 0;
    const trimEnd = trimEndStr ? parseFloat(trimEndStr) : 0;
    const aspectRatio = formData.get('aspectRatio') as string || 'original';
    const animatedSubtitles = formData.get('animatedSubtitles') === 'true';

    const bgMusicFile = formData.get('bgMusic') as File;
    const bgMusicVolumeStr = formData.get('bgMusicVolume') as string;
    const bgMusicVolume = bgMusicVolumeStr ? parseFloat(bgMusicVolumeStr) / 100 : 0.2;

    const bRollsJson = formData.get('bRolls') as string;
    let bRolls = bRollsJson ? JSON.parse(bRollsJson) : [];

    let subtitles = subtitlesJson ? JSON.parse(subtitlesJson) : [];
    
    // Adjust subtitles and B-Rolls to match the trimmed video duration
    if (trimStart > 0) {
      subtitles = subtitles.map((sub: any) => ({
         ...sub,
         start: Math.max(0, sub.start - trimStart),
         end: Math.max(0, sub.end - trimStart)
      })).filter((sub: any) => sub.end > 0);

      bRolls = bRolls.map((broll: any) => ({
         ...broll,
         start: Math.max(0, broll.start - trimStart),
         end: Math.max(0, broll.end - trimStart)
      })).filter((broll: any) => broll.end > 0);
    }

    const subtitleStyle = subtitleStyleJson ? JSON.parse(subtitleStyleJson) : null;
    
    const coverWatermarkJson = formData.get('coverWatermark') as string;
    const coverWatermark = coverWatermarkJson ? JSON.parse(coverWatermarkJson) : null;

    const tempDir = join(process.cwd(), 'tmp');
    const outputDir = join(process.cwd(), 'public', 'exports');
    
    // Ensure directories exist
    await mkdir(tempDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    // Trigger cleanup in background (do not await)
    cleanupOldFiles(tempDir, 2).catch(console.error);
    cleanupOldFiles(outputDir, 2).catch(console.error);
    
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    cleanupOldFiles(uploadDir, 2).catch(console.error);

    const uuid = crypto.randomUUID();
    const inputVideoPath = join(tempDir, `${uuid}_input.mp4`);
    const srtPath = join(tempDir, `${uuid}_subs.srt`);
    const outputFileName = `${uuid}_exported.mp4`;
    const outputPath = join(outputDir, outputFileName);

    // Save video file
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await writeFile(inputVideoPath, videoBuffer);

    // Save Subtitles (SRT or ASS depending on animated mode)
    let subtitleFilePath = srtPath;
    if (animatedSubtitles) {
      const targetW = aspectRatio === '9:16' ? 1080 : aspectRatio === '1:1' ? 1080 : 1920;
      const targetH = aspectRatio === '9:16' ? 1920 : aspectRatio === '1:1' ? 1080 : 1080;
      const assContent = generateAss(subtitles, subtitleStyle, targetW, targetH);
      subtitleFilePath = join(tempDir, `${uuid}_subs.ass`);
      await writeFile(subtitleFilePath, assContent);
    } else {
      const srtContent = generateSrt(subtitles);
      await writeFile(srtPath, srtContent);
    }

    let bgMusicPath = '';
    if (bgMusicFile) {
      bgMusicPath = join(tempDir, `${uuid}_bgmusic.mp3`);
      const bgBuffer = Buffer.from(await bgMusicFile.arrayBuffer());
      await writeFile(bgMusicPath, bgBuffer);
    }

    // Use a relative path to avoid the Windows drive letter colon (C:) which completely breaks FFmpeg's filter parser
    const relativeSubPath = require('path').relative(process.cwd(), subtitleFilePath);
    const escapedSubPath = relativeSubPath.replace(/\\/g, '/');

    // Download B-Rolls
    const downloadedBRolls = [];
    for (const broll of bRolls) {
      if (broll.mediaUrl) {
        try {
          const res = await fetch(broll.mediaUrl);
          const buf = Buffer.from(await res.arrayBuffer());
          const path = join(tempDir, `${uuid}_broll_${broll.id}.mp4`);
          await writeFile(path, buf);
          downloadedBRolls.push({ ...broll, localPath: path });
        } catch (err) {
          console.warn(`Failed to download B-Roll: ${broll.mediaUrl}`);
        }
      }
    }

    let forceStyleStr = '';
    if (subtitleStyle && !animatedSubtitles) {
      const pColor = parseColorToASS(subtitleStyle.textColor || '#ffffff');
      const isTransparent = subtitleStyle.backgroundColor === 'transparent';
      const bColor = isTransparent ? '&H00000000' : parseColorToASS(subtitleStyle.backgroundColor || '#000000b3'); 
      const size = subtitleStyle.fontSize || 24;
      
      if (isTransparent) {
        forceStyleStr = `:force_style='Fontname=Battambang,Fontsize=${size},PrimaryColour=${pColor},OutlineColour=${bColor},BorderStyle=1,Outline=2,Shadow=1'`;
      } else {
        // BorderStyle=3 is Opaque Box in ASS (4 is invalid)
        forceStyleStr = `:force_style='Fontname=Battambang,Fontsize=${size},PrimaryColour=${pColor},BackColour=${bColor},BorderStyle=3,Outline=0,Shadow=0'`;
      }
    }

    const ttsSubtitles = subtitles.filter((s: any) => s.audioUrl);
    const hasTTS = ttsSubtitles.length > 0;
    const hasSFX = bRolls.length > 0;
    let sfxAudioIndex = -1;
    
    let command = ffmpeg(inputVideoPath);
    if (trimStart > 0) {
      command = command.seekInput(trimStart);
    }
    if (trimEnd > 0 && trimEnd > trimStart) {
      command = command.setDuration(trimEnd - trimStart);
    }

    let outputOptions = [
      '-c:v libx264',
      '-preset fast', // Use fast for a good balance of quality and speed
      '-crf 23'
    ];
    
    let complexFilters: string[] = [];
    let currentV = '[0:v]';
    let filterIndex = 0;
    let inputIndex = 1; // 0 is video

    let targetW = 1920;
    let targetH = 1080;
    if (aspectRatio && aspectRatio !== 'original') {
      targetW = aspectRatio === '9:16' ? 1080 : aspectRatio === '1:1' ? 1080 : 1920;
      targetH = aspectRatio === '9:16' ? 1920 : aspectRatio === '1:1' ? 1080 : 1080;
      
      const nextV = `[v${++filterIndex}]`;
      complexFilters.push(`${currentV}split[orig_${filterIndex}][bg_${filterIndex}]`);
      complexFilters.push(`[bg_${filterIndex}]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},boxblur=40:10[bg_blurred_${filterIndex}]`);
      complexFilters.push(`[orig_${filterIndex}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease[fg_${filterIndex}]`);
      complexFilters.push(`[bg_blurred_${filterIndex}][fg_${filterIndex}]overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2${nextV}`);
      currentV = nextV;
    }

    // Apply B-Rolls
    for (const broll of downloadedBRolls) {
      command = command.input(broll.localPath);
      const bRollInputIndex = inputIndex++;
      const nextV = `[v${++filterIndex}]`;
      // Scale and crop the B-Roll
      complexFilters.push(`[${bRollInputIndex}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}[br_${filterIndex}]`);
      complexFilters.push(`${currentV}[br_${filterIndex}]overlay=enable='between(t,${broll.start},${broll.end})'${nextV}`);
      currentV = nextV;
    }

    const burnLogoWatermarkStr = formData.get('burnLogoWatermark') as string;
    const burnLogoWatermark = burnLogoWatermarkStr === 'false' ? false : true;
    
    let activeWatermarkPath = '';
    if (burnLogoWatermark) {
      const customWatermarkFile = formData.get('customWatermarkFile') as File | null;
      if (customWatermarkFile) {
        activeWatermarkPath = join(tempDir, `${uuid}_custom_watermark.png`);
        const wmBuffer = Buffer.from(await customWatermarkFile.arrayBuffer());
        await writeFile(activeWatermarkPath, wmBuffer);
      } else {
        const defaultWmPath = join(process.cwd(), 'public', 'watermark.png');
        if (fs.existsSync(defaultWmPath)) {
          activeWatermarkPath = defaultWmPath;
        }
      }
    }
    
    if (burnLogoWatermark && activeWatermarkPath) {
      command = command.input(activeWatermarkPath);
      const wmInputIndex = inputIndex++;
      const nextV = `[v${++filterIndex}]`;
      complexFilters.push(`[${wmInputIndex}:v]scale=180:-1[wm_scaled]`);
      complexFilters.push(`${currentV}[wm_scaled]overlay=main_w-overlay_w-30:30${nextV}`);
      currentV = nextV;
    }

    if (coverWatermark?.enabled) {
      const hRatio = coverWatermark.height / 100;
      const nextV = `[v${++filterIndex}]`;
      complexFilters.push(`${currentV}drawbox=x=0:y=ih-ih*${hRatio}:w=iw:h=ih*${hRatio}:color=black@0.9:t=fill${nextV}`);
      currentV = nextV;
    }

    if (subtitles.length > 0 && burnSubtitles) {
      const nextV = `[v${++filterIndex}]`;
      // Use a relative path for fontsdir to avoid the Windows drive letter colon (C:) breaking the filter
      const relativeFontsDir = require('path').relative(process.cwd(), join(process.cwd(), 'public', 'fonts'));
      const escapedFontsDir = relativeFontsDir.replace(/\\/g, '/');
      complexFilters.push(`${currentV}subtitles='${escapedSubPath}':fontsdir='${escapedFontsDir}'${forceStyleStr}${nextV}`);
      currentV = nextV;
    }

    if (currentV !== '[0:v]') {
      outputOptions.push('-map', currentV);
    } else {
      outputOptions.push('-map', '0:v');
    }
    

    const syncVoiceStr = formData.get('syncVoice') as string;
    const syncVoice = syncVoiceStr === 'true';

    if (hasTTS || hasSFX) {
      const mixedAudioPath = join(tempDir, `${uuid}_mixed_audio.wav`);
      const clips: Array<{ pcm: Buffer; startSec: number }> = [];

      if (hasTTS) {
        const sortedTts = [...ttsSubtitles].sort((a, b) => a.start - b.start);

        for (let clipIdx = 0; clipIdx < sortedTts.length; clipIdx++) {
          const sub = sortedTts[clipIdx];

          let audioFileName = '';
          if (sub.audioUrl.includes('?file=')) {
            audioFileName = sub.audioUrl.split('?file=')[1];
          } else {
            audioFileName = sub.audioUrl.split('/').pop() || '';
          }
          try { audioFileName = decodeURIComponent(audioFileName); } catch (e) {}
          const audioPath = join(process.cwd(), 'public', 'uploads', audioFileName);

          const speechRateStr = formData.get('speechRate') as string;
          const speechRate = speechRateStr ? parseFloat(speechRateStr) : 1.2;

          let atempo = speechRate;
          if (syncVoice && sub.audioDuration) {
             const visualDur = sub.end - sub.start;
             if (sub.audioDuration > visualDur) {
                 const requiredRate = sub.audioDuration / visualDur;
                 atempo = Math.min(Math.max(requiredRate, speechRate), 2.0);
             }
          }

          const tempPcmPath = join(tempDir, `${uuid}_pcm_${clipIdx}.wav`);
          let pcm = await decodeToPCM(audioPath, tempPcmPath, atempo);
          
          clips.push({ pcm, startSec: sub.start });
        }
      }

      if (hasSFX) {
        const whooshPath = join(process.cwd(), 'public', 'whoosh.wav');
        if (fs.existsSync(whooshPath)) {
          const whooshPcmPath = join(tempDir, `${uuid}_whoosh_pcm.wav`);
          const whooshPcm = await decodeToPCM(whooshPath, whooshPcmPath, 1.0);
          for (const broll of bRolls) {
            clips.push({ pcm: whooshPcm, startSec: broll.start });
          }
        }
      }

      const wavBuffer = await mixClipsToWav(clips);
      await writeFile(mixedAudioPath, wavBuffer);

      const mixedInputIndex = inputIndex++;
      command = command.input(mixedAudioPath);
      
      sfxAudioIndex = mixedInputIndex;
    }

    let currentA = `[0:a]`;

    if (sfxAudioIndex !== -1) {
       const nextA = `[a${++filterIndex}]`;
       if (hasTTS) {
         // As requested: Do NOT include original video sound, only the generated TTS/SFX
         currentA = `[${sfxAudioIndex}:a]`;
       } else {
         // Mix original audio with SFX without lowering volume
         complexFilters.push(`${currentA}[${sfxAudioIndex}:a]amix=inputs=2:duration=first:dropout_transition=2:normalize=0${nextA}`);
         currentA = nextA;
       }
    }

    if (bgMusicPath) {
      const bgMusicInputIndex = inputIndex++;
      command = command.input(bgMusicPath).inputOptions(['-stream_loop', '-1']);
      
      const nextA = `[a${++filterIndex}]`;
      complexFilters.push(`[${bgMusicInputIndex}:a]volume=${bgMusicVolume}[bg_vol]`);
      complexFilters.push(`${currentA}[bg_vol]amix=inputs=2:duration=first:dropout_transition=2${nextA}`);
      currentA = nextA;
    }

    if (currentA !== '[0:a]') {
      // If currentA is a raw stream like '[2:a]', we need to strip the brackets for the -map argument
      if (currentA.startsWith('[') && currentA.endsWith(']') && currentA.includes(':')) {
        outputOptions.push('-map', currentA.slice(1, -1));
      } else {
        outputOptions.push('-map', currentA);
      }
      outputOptions.push('-c:a', 'aac');
      outputOptions.push('-b:a', '192k');
      outputOptions.push('-ar', '48000');
    } else {
      outputOptions.push('-map', '0:a?');
      outputOptions.push('-c:a', 'copy');
    }

    if (complexFilters.length > 0) {
      command = command.complexFilter(complexFilters);
    }
    
    const stream = new ReadableStream({
      start(controller) {
        command
          .outputOptions(outputOptions)
          .save(outputPath)
          .on('progress', (progress) => {
            if (progress && typeof progress.percent === 'number') {
              const percent = Math.min(99, Math.round(progress.percent));
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'progress', percent }) + '\n'));
            }
          })
          .on('end', () => {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'done', url: `/exports/${outputFileName}` }) + '\n'));
            controller.close();
          })
          .on('error', (err: any, stdout: any, stderr: any) => {
            console.error("FFmpeg error:", err);
            console.error("FFmpeg stderr:", stderr);
            const detailedError = `${err.message}\nDetails: ${stderr || 'None'}`;
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'error', message: detailedError }) + '\n'));
            controller.close();
          });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Export API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
