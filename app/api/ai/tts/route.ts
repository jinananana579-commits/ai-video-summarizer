import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get('file');
  if (!file) return new NextResponse('No file', { status: 400 });
  const filePath = join(process.cwd(), 'public', 'uploads', file);
  if (!fs.existsSync(filePath)) return new NextResponse('Not found', { status: 404 });
  
  const stream = fs.createReadStream(filePath);
  return new NextResponse(stream as any, { headers: { 'Content-Type': 'audio/mpeg' }});
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

async function ensureDir(dir: string) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (e) {
    // Ignore error if directory exists
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text, voice: reqVoice, speed, elevenLabsApiKey } = await req.json();
    const voice = reqVoice || 'Khmer - Piseth';

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set in environment variables.' }, { status: 500 });
    }

    // Map custom voices to OpenAI voices (alloy, echo, fable, onyx, nova, shimmer)
    // We use Nova for female (Sreymom) and Onyx for male (Piseth) as a proxy
    const openaiVoice = voice.includes('Sreymom') ? 'nova' : 'onyx';

    const { generateHash } = await import('@/lib/cache');
    const inputHash = generateHash(text + voice + speed + '_tts_v3');

    let buffer: Buffer;
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await ensureDir(uploadDir);
    const fileName = `${inputHash}-tts.mp3`;
    const filePath = join(uploadDir, fileName);
    
    // Check if TTS file already exists
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      if (fs.statSync(filePath).size > 0) {
        return NextResponse.json({ success: true, url: `/uploads/${fileName}`, cached: true });
      } else {
        fs.unlinkSync(filePath);
      }
    }

    // If it's a custom cloned voice, route to ElevenLabs
    if (voice.startsWith('elevenlabs_')) {
      if (!elevenLabsApiKey) {
        throw new Error('ElevenLabs API Key is missing. Please add it in Audio FX Settings.');
      }
      
      const voiceId = voice.replace('elevenlabs_', '');
      
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API Error:', errorText);
        throw new Error('Failed to generate cloned voice audio.');
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      await writeFile(filePath, buffer);
      
    } else {
      // Default to node-edge-tts (Microsoft Azure) which has native Khmer voices
      try {
        const { EdgeTTS } = require('node-edge-tts');
        const edgeVoice = voice.includes('Sreymom') ? 'km-KH-SreymomNeural' : 'km-KH-PisethNeural';
        
        // The native Khmer EdgeTTS voices speak too fast by default. 
        // If the requested speed is 1.0 (default), we automatically slow it down to 0.85 (-15%) for a more natural pacing.
        const adjustedSpeed = (speed === 1.0 || !speed) ? 0.85 : speed; 
        const ratePercent = Math.round((adjustedSpeed - 1) * 100);
        const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

        const tts = new EdgeTTS({
          voice: edgeVoice,
          lang: 'km-KH',
          outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
          rate: rateStr,
          pitch: '+0Hz',
        });
        
        // We do NOT add a full stop here because subtitles are often sentence fragments.
        // Adding a full stop to every fragment forces unnatural pauses and makes it sound disjointed.
        // However, we MUST keep ? and ! because they dictate intonation (making it sound human instead of robotic).
        let safeText = text.trim()
          .replace(/[~…\-]/g, ' ') // Replace tildes, ellipses, dashes with space
          .replace(/\.{2,}/g, '.') // Replace multiple dots with a single dot
          .replace(/["'“”‘’]/g, '') // Remove quotes
          .replace(/[\n\r]+/g, ' ') // Prevent truncation on newlines
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces which break Khmer TTS
          + ' '; // Append trailing space to prevent Edge TTS from clipping final syllable

        if (!safeText) {
          throw new Error('Text is empty, cannot generate TTS.');
        }
        await tts.ttsPromise(safeText, filePath);
        
        if (fs.existsSync(filePath) && fs.statSync(filePath).size === 0) {
          fs.unlinkSync(filePath);
          throw new Error('TTS generation resulted in an empty file.');
        }
      } catch (apiError: any) {
        console.error('Edge TTS failed:', apiError);
        throw new Error('TTS Generation failed.');
      }
    }

    // --- Post-Processing: Apply Studio Audio Filters ---
    // Apply EQ, compression, and reverb to make the raw TTS sound like a studio microphone recording.
    // This allows the preview in the browser to sound exactly like the final professional export.
    if (fs.existsSync(filePath)) {
      const tempId = crypto.randomUUID();
      const tempPath = filePath.replace('.mp3', `_studio_${tempId}.mp3`);
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .audioFilters([
            'highpass=f=80',                  // Remove low muddy rumble
            'bass=g=6:f=110:w=0.6',           // Add warmth and depth
            'treble=g=3:f=6000:w=0.5',        // Add clarity
            'acompressor=threshold=-18dB:ratio=4:attack=5:release=50:makeup=4', // Smooth volume
            'aecho=0.8:0.9:40:0.05',          // Tiny room reflection
            'loudnorm=I=-16:TP=-1.5:LRA=11',   // Broadcast standard normalization
            'apad=pad_dur=0.3'                // Add silence padding
          ])
          .save(tempPath)
          .on('end', () => resolve(true))
          .on('error', (err) => reject(err));
      });
      
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        fs.renameSync(tempPath, filePath);
      } catch (err: any) {
        console.warn('Could not rename/unlink TTS file (might be locked by player):', err.message);
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
    }

    return NextResponse.json({ success: true, url: `/uploads/${fileName}` });

  } catch (error: any) {
    console.error('TTS API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
