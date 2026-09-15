import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: Request) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'សូមបញ្ជាក់ YouTube URL' }, { status: 400 });
        }

        // ទាញយក Transcript ពី YouTube
        const transcriptResponse = await YoutubeTranscript.fetchTranscript(url);

        // ផ្គុំប្រយោគទាំងអស់បញ្ចូលគ្នាជាអត្ថបទតែមួយ
        const fullText = transcriptResponse.map((t) => t.text).join(' ');

        return NextResponse.json({ text: fullText }, { status: 200 });
    } catch (error) {
        console.error('Error fetching transcript:', error);
        return NextResponse.json({
            error: 'មិនអាចទាញយកអត្ថបទបានទេ។ សូមប្រាកដថាវីដេអូនេះមានកំណត់ត្រាអក្សរ (Captions/CC)។'
        }, { status: 500 });
    }
}