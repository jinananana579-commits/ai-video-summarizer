import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'សូមបញ្ជាក់ URL វីដេអូ' }, { status: 400 });
        }

        // ចំណាំ៖ នេះជាទិន្នន័យសិប្បនិម្មិត (Mock Data) សម្រាប់តេស្ត UI សិន។
        // ពេលក្រោយយើងនឹងសរសេរកូដទាញ Transcript និងភ្ជាប់ជាមួយ AI ពិតប្រាកដនៅទីនេះ។
        const mockSummary = `
      នេះជាការសម្រាយសាច់រឿងពីវីដេអូដែលអ្នកបានបញ្ចូល។ សាច់រឿងចាប់ផ្តើមឡើងជាមួយតួឯកដែលបានរកឃើញថាមពលពិសេសលាក់កំបាំងរបស់ខ្លួន។ 
      កាត់មកឈុតបន្ទាប់ គាត់ត្រូវប្រឈមមុខនឹងឧបសគ្គធំៗ ដើម្បីសង្គ្រោះពិភពលោក។
      
      ចំណុចសំខាន់ៗដែលទទួលបានពីវីដេអូ៖
      ១. ការចាប់ផ្តើមដ៏គួរឱ្យរំភើប និងទាក់ទាញ
      ២. កំពូលនៃសាច់រឿងមានភាពតានតឹង
      ៣. ការបញ្ចប់ដែលពោរពេញដោយអត្ថន័យ។
    `;

        // ក្លែងធ្វើការពន្យារពេល 2 វិនាទី (Simulate AI processing time)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        return NextResponse.json({ summary: mockSummary }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'មានកំហុសផ្នែក Server' }, { status: 500 });
    }
}