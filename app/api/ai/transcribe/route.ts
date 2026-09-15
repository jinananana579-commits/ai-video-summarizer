import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File;

    if (!file) {
      return NextResponse.json({ error: 'No video provided' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set in environment variables.' }, { status: 500 });
    }

    // Caching layer
    const buffer = Buffer.from(await file.arrayBuffer());
    const { generateHash, getCachedData, setCachedData } = await import('@/lib/cache');
    const fileHash = generateHash(buffer) + '_whisper';
    const cachedSubtitles = await getCachedData(fileHash);

    if (cachedSubtitles) {
      return NextResponse.json({ success: true, subtitles: cachedSubtitles, cached: true });
    }

    // Send directly to OpenAI Whisper (Whisper supports .mp4 directly up to 25MB)
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    });

    // Format response to match our SubtitleEditor state
    const subtitles = transcription.segments?.map(segment => ({
      id: crypto.randomUUID().substring(0, 8),
      start: segment.start,
      end: segment.end,
      text: segment.text,
      voice: 'Khmer - Piseth' // Default mock voice
    })) || [];

    await setCachedData(fileHash, subtitles);

    return NextResponse.json({ success: true, subtitles });

  } catch (error: any) {
    console.error('Transcribe API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
