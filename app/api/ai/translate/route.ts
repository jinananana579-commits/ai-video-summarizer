import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkCreditsAndSubscription, deductCredits } from '@/lib/auth-guard';

export async function POST(req: NextRequest) {
  try {
    const auth = await checkCreditsAndSubscription(1);
    if (!auth.success) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { subtitles, geminiApiKey } = await req.json();

    if (!geminiApiKey) {
      return NextResponse.json({ success: false, error: 'Gemini API Key is required. Please set it in Settings.' }, { status: 400 });
    }

    if (!subtitles || !Array.isArray(subtitles)) {
      return NextResponse.json({ success: false, error: 'Invalid subtitles format' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const systemInstruction = `You are an expert translator translating subtitles to Khmer.
CRITICAL ABSOLUTE RULES:
1. Your output MUST be a valid JSON array. The JSON keys ("id", "text", etc.) MUST remain in English.
2. However, the VALUES of the 'text' fields MUST ONLY contain Khmer characters, punctuation, and numbers.
3. ZERO foreign characters are allowed in the translated text. NO Thai (ก-ฮ), NO Chinese (汉字), and NO English letters (A-Z, a-z).
4. If a word is a name (e.g., Chen Feng, Susan, Fan Jianguo) or untranslatable, you MUST TRANSLITERATE it using the Khmer alphabet (e.g., 'Susan' -> 'ស៊ូសាន', 'Chen Feng' -> 'ឆិនហ្វឹង', 'Fan Jianguo' -> 'ហ្វានចៀនគួ').`;
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash",
      systemInstruction,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const { generateHash, getCachedData, setCachedData } = await import('@/lib/cache');
    const inputHash = generateHash(JSON.stringify(subtitles) + '_translate_v10'); // updated to v10 for JSON fix
    const cachedSubtitles = await getCachedData(inputHash);

    if (cachedSubtitles) {
      return NextResponse.json({ success: true, subtitles: cachedSubtitles, cached: true });
    }

    const prompt = `Translate the following subtitles into Khmer (Cambodian) language.

STRICT REQUIREMENTS:
1. Target Language: Khmer ONLY. All subtitle text values MUST be in the Khmer script (អក្សរខ្មែរ).
2. NO FOREIGN CHARACTERS IN TEXT: Do not leave any Thai, Chinese, or English letters in the subtitle translation. Translate everything! For example, "我们知道错了" MUST be translated to "ពួកយើងដឹងខុសហើយ".
3. TRANSLITERATE NAMES: All character names (e.g., Chen Feng, Susan, Fan Jianguo, Gu Yufei) MUST be sounded out in Khmer script (e.g. ឆិនហ្វឹង, ស៊ូសាន, ហ្វានចៀនគួ, គូយូហ្វី). DO NOT leave them in English.
4. QUALITY: Translate naturally and fluently into conversational Khmer. Avoid literal word-for-word translations that sound robotic. Use appropriate Khmer idioms or slang where it fits the context.
5. STRUCTURE: Keep the exact JSON array structure, only modifying the 'text' field.

Subtitles to translate:
${JSON.stringify(subtitles)}
    `;

    let result;
    let retries = 3; 
    let delay = 1000;
    
    // Attempt with 3.5-flash first, then fallback to 3.5-flash-lite
    let currentModelName = "gemini-3.5-flash";

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
        // Fallback to lite if flash hits limits (429) or is unavailable (503)
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
    
    // Strip any stray Thai characters from the raw response to forcefully enforce the rule
    text = text.replace(/[\u0E00-\u0E7F]/g, '');
    
    // Remove markdown code blocks if Gemini returns them
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\n/, '').replace(/\n```$/, '');
    }
    
    let translatedSubtitles;
    try {
      translatedSubtitles = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse JSON from Gemini. Raw output:", text);
      throw new Error("Gemini returned invalid JSON format.");
    }

    await setCachedData(inputHash, translatedSubtitles);

    if (auth.userId) {
      await deductCredits(auth.userId, 1);
    }

    return NextResponse.json({ success: true, subtitles: translatedSubtitles });

  } catch (error: any) {
    console.error('Translate API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
