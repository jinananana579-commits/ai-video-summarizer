import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';
import crypto from 'crypto';

import ffmpeg from 'fluent-ffmpeg';
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
    const files = formData.getAll('videos') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No videos provided' }, { status: 400 });
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await ensureDir(uploadDir);

    const sessionId = crypto.randomUUID();
    const tempFiles: string[] = [];

    // Save files locally
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop() || 'mp4';
      const filePath = join(uploadDir, `${sessionId}-part${i}.${ext}`);
      await writeFile(filePath, buffer);
      tempFiles.push(filePath);
    }

    // If only 1 video, just return it without merging
    if (tempFiles.length === 1) {
      return NextResponse.json({ success: true, url: `/uploads/${sessionId}-part0.${files[0].name.split('.').pop() || 'mp4'}` });
    }

    const outputPath = join(uploadDir, `${sessionId}-merged.mp4`);
    const outputUrl = `/uploads/${sessionId}-merged.mp4`;

    // Process with ffmpeg
    await new Promise((resolve, reject) => {
      const command = ffmpeg();
      
      tempFiles.forEach(file => {
        command.input(file);
      });

      command
        .outputOptions([
          '-c:v libx264',
          '-c:a aac',
          '-ar 44100',
          '-af aresample=async=1'
        ])
        .on('error', (err: any) => {
          console.error('FFmpeg Merge Error:', err);
          reject(err);
        })
        .on('end', () => {
          resolve(true);
        })
        .mergeToFile(outputPath, uploadDir); // Requires absolute path to a temp dir for merge Add
    });

    // Cleanup temp files
    for (const file of tempFiles) {
      try {
        fs.unlinkSync(file);
      } catch(e) {
        console.error('Error cleaning up temp file', e);
      }
    }

    return NextResponse.json({ success: true, url: outputUrl });

  } catch (error) {
    console.error('Merge API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
