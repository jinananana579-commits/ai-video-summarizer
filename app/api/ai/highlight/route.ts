import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { subtitles, geminiApiKey } = await req.json();

    if (!geminiApiKey) {
      return NextResponse.json({ success: false, error: 'Gemini API Key is required. Please set it in Settings.' }, { status: 400 });
    }

    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
      return NextResponse.json({ success: false, error: 'No subtitles provided' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const systemInstruction = `You are an expert short-form video editor specializing in TikToks, Reels, and Shorts.
Your goal is to find the single most viral, engaging, and interesting continuous segment from the transcript.
CRITICAL RULES:
1. The segment MUST be continuous.
2. The segment should ideally be between 30 and 60 seconds long.
3. It must start with a strong "hook" and end on a complete thought.
4. Your output MUST be ONLY a valid JSON object in this format:
{
  "start": <number in seconds>,
  "end": <number in seconds>,
  "reason": "<brief explanation of why this is the best hook>"
}`;

    // Format transcript for Gemini
    const transcript = subtitles.map((sub: any) => `[${sub.start.toFixed(1)}s - ${sub.end.toFixed(1)}s] ${sub.text}`).join('\n');
    
    const prompt = `Find the best viral clip from this transcript:\n\n${transcript}`;

    let result;
    let retries = 3; 
    let delay = 1000;
    
    let currentModelName = "gemini-3.5-flash"; // Match the model used in translate

    for (let i = 0; i < retries; i++) {
      try {
        const model = genAI.getGenerativeModel({ 
          model: currentModelName,
          systemInstruction,
          generationConfig: {
            responseMimeType: "application/json",
          }
        });
        result = await model.generateContent(prompt);
        break;
      } catch (e: any) {
        const isNetworkError = e.message && e.message.includes('fetch failed');
        if ((e.status === 503 || e.status === 429 || e.status === 404 || isNetworkError) && i < retries - 1) {
          console.warn(`Gemini API Error on ${currentModelName} (Attempt ${i + 1}/${retries}): ${e.message}`);
          
          if (e.status === 429 || e.status === 503 || e.status === 404) {
             currentModelName = "gemini-3.5-flash-lite"; // Switch to lite model on quota limit, high demand, or not found
             delay = 2000; // Wait a bit longer
          }
          
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          if (e.status === 404) {
            let errorMsg = '';
            try {
              const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
              const listData = await listRes.json();
              const availableModels = listData.models ? listData.models.map((m: any) => m.name.replace('models/', '')).join(', ') : 'None found';
              errorMsg = `Model not found. Your API Key supports these models: ${availableModels}`;
            } catch (fetchErr) {
              errorMsg = `Model not found and failed to fetch model list. Please ensure your API key is from Google AI Studio (aistudio.google.com).`;
            }
            throw new Error(errorMsg);
          }
          throw e;
        }
      }
    }

    if (!result) {
        throw new Error("Failed to generate content after retries");
    }

    const response = await result.response;
    let text = response.text().trim();
    
    // Remove markdown code blocks if Gemini returns them
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    
    let highlightData;
    try {
      highlightData = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse JSON from Gemini. Raw output:", text);
      throw new Error("Gemini returned invalid JSON format.");
    }

    return NextResponse.json({ success: true, highlight: highlightData });

  } catch (error: any) {
    console.error('Highlight API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
