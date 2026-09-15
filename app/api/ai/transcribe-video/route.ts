import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';

async function ensureDir(dir: string) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (e) {
    // Ignore error if directory exists
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File;
    const voice = (formData.get('voice') as string) || 'Khmer - Piseth';

    const gladiaApiKey = formData.get('gladiaApiKey') as string;
    
    if (!gladiaApiKey) {
      return NextResponse.json({ success: false, error: 'Gladia API Key is required. Please set it in Settings.' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'No video provided' }, { status: 400 });
    }

    // Save video locally first because Gladia SDK usually prefers a local path or URL
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await ensureDir(uploadDir);

    const sessionId = crypto.randomUUID();
    const ext = file.name.split('.').pop() || 'mp4';
    const videoPath = join(uploadDir, `${sessionId}-video.${ext}`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(videoPath, buffer);

    // Caching layer
    const { generateHash, getCachedData, setCachedData } = await import('@/lib/cache');
    const fileHash = generateHash(buffer);
    const cachedSubtitles = await getCachedData(fileHash);

    if (cachedSubtitles) {
      // Cleanup temp file since we don't need it
      try { fs.unlinkSync(videoPath); } catch (e) {}
      // Update the voice field just in case they selected a different voice this time
      const updatedSubtitles = (cachedSubtitles as any[]).map(s => ({...s, voice}));
      return NextResponse.json({ success: true, subtitles: updatedSubtitles, cached: true });
    }

    // 1. Upload the file to Gladia
    const uploadFormData = new FormData();
    uploadFormData.append('audio', new Blob([buffer]), file.name);

    const uploadRes = await fetch('https://api.gladia.io/v2/upload', {
      method: 'POST',
      headers: {
        'x-gladia-key': gladiaApiKey
      },
      body: uploadFormData
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error('Failed to upload file to Gladia: ' + err);
    }
    const uploadData = await uploadRes.json();
    const audioUrl = uploadData.audio_url;

    // 2. Request transcription
    const transcribeRes = await fetch('https://api.gladia.io/v2/transcription', {
      method: 'POST',
      headers: {
        'x-gladia-key': gladiaApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        diarization: false
      })
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.text();
      throw new Error('Failed to start Gladia transcription: ' + err);
    }
    const transcribeData = await transcribeRes.json();
    let resultUrl = transcribeData.result_url;

    // 3. Poll for result
    let transcriptionResult = null;
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const pollRes = await fetch(resultUrl, {
        headers: { 'x-gladia-key': gladiaApiKey }
      });
      const pollData = await pollRes.json();
      if (pollData.status === 'done') {
        transcriptionResult = pollData.result;
        break;
      } else if (pollData.status === 'error') {
        throw new Error('Gladia transcription failed');
      }
    }

    // Cleanup temp file
    try {
      fs.unlinkSync(videoPath);
    } catch (e) {
      console.error('Error cleaning up file', e);
    }

    const segments = transcriptionResult.transcription?.utterances || transcriptionResult.transcription?.segments || [];

    // Format response to match our SubtitleEditor state
    const subtitles = segments.map((segment: any) => ({
      id: crypto.randomUUID().substring(0, 8),
      start: segment.start,
      end: segment.end,
      text: segment.text,
      voice: voice
    }));

    await setCachedData(fileHash, subtitles);

    return NextResponse.json({ success: true, subtitles });

  } catch (error: any) {
    console.error('Gladia Transcribe API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
