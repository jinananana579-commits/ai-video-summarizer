import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'គ្មានអត្ថបទសម្រាប់បកប្រែទេ' }, { status: 400 });
    }

    // ហៅ Gemini API មកប្រើ
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' }); // ប្រើម៉ូដែលលឿន

    // បញ្ជា AI ឱ្យបកប្រែ
    const prompt = `អ្នកគឺជាអ្នកជំនាញបកប្រែភាសា។ សូមបកប្រែអត្ថបទខាងក្រោមនេះទៅជាភាសាខ្មែរឱ្យបានត្រឹមត្រូវ តាមបរិបទ និងងាយយល់បំផុត។ កុំឆ្លើយអ្វីផ្សេងក្រៅពីលទ្ធផលបកប្រែ៖\n\n${text}`;
    
    const result = await model.generateContent(prompt);
    const translatedText = result.response.text();

    return NextResponse.json({ translation: translatedText }, { status: 200 });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ error: 'បរាជ័យក្នុងការបកប្រែ។ សូមពិនិត្យ API Key របស់អ្នក។' }, { status: 500 });
  }
}