import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { cleanupOldFiles } from '@/lib/cleanup';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

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
    const trimsStr = formData.getAll('trims') as string[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No videos provided' }, { status: 400 });
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    const tempDir = join(process.cwd(), 'tmp');
    await ensureDir(uploadDir);
    await ensureDir(tempDir);

    // Trigger cleanup in background
    cleanupOldFiles(uploadDir, 2).catch(console.error);
    cleanupOldFiles(tempDir, 2).catch(console.error);

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

    const stream = new ReadableStream({
      start(controller) {
        const listPath = join(tempDir, `${sessionId}-list.txt`);
        const listContent = tempFiles.map((f, i) => {
          let entry = `file '${f.replace(/\\/g, '/')}'`;
          if (trimsStr[i]) {
            try {
              const trim = JSON.parse(trimsStr[i]);
              if (trim.start !== undefined && trim.start > 0) entry += `\ninpoint ${trim.start}`;
              if (trim.end !== undefined && trim.end > 0) entry += `\noutpoint ${trim.end}`;
            } catch (e) {}
          }
          return entry;
        }).join('\n');
        fs.writeFileSync(listPath, listContent);

        const command = ffmpeg();
        
        command
          .input(listPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions([
            '-c:v libx264',
            '-c:a aac',
            '-ar 44100',
            '-preset veryfast'
          ])
          .on('progress', (progress) => {
            if (progress && typeof progress.percent === 'number') {
              const percent = Math.min(99, Math.round(progress.percent));
              controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'progress', percent }) + '\n'));
            }
          })
          .on('error', (err: any) => {
            console.error('FFmpeg Merge Error:', err);
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'error', message: err.message }) + '\n'));
            controller.close();
          })
          .on('end', () => {
            // Cleanup temp files
            for (const file of tempFiles) {
              try {
                if (fs.existsSync(file)) {
                  fs.unlinkSync(file);
                }
              } catch(e) {
                console.error('Error cleaning up temp file', e);
              }
            }
            try {
              if (fs.existsSync(listPath)) {
                fs.unlinkSync(listPath);
              }
            } catch(e) {
              console.error('Error cleaning up list file', e);
            }
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ type: 'done', url: outputUrl }) + '\n'));
            controller.close();
          })
          .save(outputPath);
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
    console.error('Merge API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
