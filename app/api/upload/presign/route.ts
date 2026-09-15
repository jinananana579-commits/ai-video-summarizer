import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(req: NextRequest) {
  try {
    const { filename, contentType } = await req.json();

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const region = process.env.S3_REGION || 'auto';
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET_NAME;

    if (!accessKeyId || !secretAccessKey || !bucket) {
      console.error('Missing S3 credentials in environment variables.');
      return NextResponse.json({ error: 'Storage is not configured on the server.' }, { status: 500 });
    }

    const s3Client = new S3Client({
      region,
      endpoint, // Used for Supabase/Cloudflare R2/DigitalOcean Spaces
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: !!endpoint, // often required for non-AWS S3
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: `uploads/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.\-_]/g, '')}`,
      ContentType: contentType,
      // For public bucket. If it's private, we need a GET presigned URL for Gladia
      // ACL: 'public-read', 
    });

    // Create a presigned URL that is valid for 1 hour
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const publicUrl = endpoint 
      ? `${endpoint}/${bucket}/${command.input.Key}` 
      : `https://${bucket}.s3.${region}.amazonaws.com/${command.input.Key}`;

    return NextResponse.json({ success: true, url: presignedUrl, publicUrl, key: command.input.Key });
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
