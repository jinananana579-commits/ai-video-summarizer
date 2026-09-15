import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { subtitles, geminiApiKey, pexelsApiKey, videoDuration } = await req.json();

    if (!subtitles || !geminiApiKey || !pexelsApiKey) {
      return NextResponse.json({ success: false, error: 'Missing parameters or API keys.' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Build the transcript text with timestamps
    const transcriptText = subtitles.map((sub: any) => `[${sub.start.toFixed(1)}s - ${sub.end.toFixed(1)}s] ${sub.text}`).join('\n');

    const prompt = `
You are an expert video editor and director. Your task is to analyze the following video transcript and suggest B-Rolls (stock footage) to overlay on the video to make it more engaging.
The total video duration is ${videoDuration}s.

Transcript:
${transcriptText}

Rules:
1. Don't add B-Rolls for every single sentence. Only add them for key visual concepts, strong emotions, or concrete nouns.
2. The duration of each B-Roll should be between 2 to 5 seconds.
3. Provide a simple, highly searchable 1-3 word English keyword for the stock footage (e.g., "business meeting", "happy dog", "city night").
4. Return exactly 3 to 6 B-Roll suggestions distributed throughout the video.

Return the response in valid JSON matching this schema:
[
  { "start": number, "end": number, "keyword": string }
]
`;

    const responseSchema: Schema = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          start: { type: SchemaType.NUMBER },
          end: { type: SchemaType.NUMBER },
          keyword: { type: SchemaType.STRING },
        },
        required: ["start", "end", "keyword"]
      }
    };

    let result;
    let retries = 3;
    let delay = 1000;
    let currentModelName = "gemini-3.5-flash";

    for (let i = 0; i < retries; i++) {
      try {
        const model = genAI.getGenerativeModel({ model: currentModelName });
        result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: responseSchema,
            temperature: 0.7,
          }
        });
        break;
      } catch (e: any) {
        const isNetworkError = e.message && e.message.includes('fetch failed');
        if ((e.status === 503 || e.status === 429 || e.status === 404 || isNetworkError) && i < retries - 1) {
          console.warn(`Gemini API Error on ${currentModelName} (Attempt ${i + 1}/${retries}): ${e.message}`);
          
          if (e.status === 429 || e.status === 503 || e.status === 404) {
             currentModelName = "gemini-3.5-flash-lite"; // Switch to lite model on quota limit, high demand, or not found
             delay = 2000; // Wait a bit longer
          }
          await new Promise(res => setTimeout(res, delay));
        } else {
          throw e;
        }
      }
    }

    if (!result) {
      throw new Error("Gemini API failed to return a result.");
    }
    const text = result.response.text();
    let brollPlan = [];
    try {
      brollPlan = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Gemini output", text);
      return NextResponse.json({ success: false, error: 'AI returned invalid plan.' }, { status: 500 });
    }

    // Now fetch stock footage for each keyword from Pexels
    const finalBRolls = [];
    
    for (const plan of brollPlan) {
      try {
        const pexelsRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(plan.keyword)}&per_page=1&orientation=landscape`, {
          headers: {
            'Authorization': pexelsApiKey
          }
        });
        
        const pexelsData = await pexelsRes.json();
        
        if (pexelsData.videos && pexelsData.videos.length > 0) {
          const video = pexelsData.videos[0];
          // Get the best HD quality video file
          const hdFile = video.video_files.find((f: any) => f.quality === 'hd') || video.video_files[0];
          
          if (hdFile && hdFile.link) {
            finalBRolls.push({
              id: crypto.randomUUID(),
              start: plan.start,
              end: plan.end,
              keyword: plan.keyword,
              mediaUrl: hdFile.link
            });
          }
        }
      } catch (err) {
        console.warn(`Failed to fetch Pexels video for keyword ${plan.keyword}`);
      }
    }

    return NextResponse.json({ success: true, bRolls: finalBRolls });

  } catch (error: any) {
    console.error("B-Roll API Error:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
