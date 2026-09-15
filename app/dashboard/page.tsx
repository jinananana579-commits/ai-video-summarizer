'use client';
import { useState } from 'react';
import { Play, Download, Languages, FileText, Square } from 'lucide-react';

export default function Dashboard() {
  const [url, setUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // State សម្រាប់ត្រួតពិនិត្យការអានសំឡេង

  // 1. ទាញយក Transcript
  const handleFetchTranscript = async () => {
    if (!url) return alert("សូមបញ្ចូល Link វីដេអូសិន!");
    setLoadingTranscript(true);
    setTranscript('');
    setTranslatedText('');
    window.speechSynthesis.cancel(); // បញ្ឈប់សំឡេងចាស់បើកំពុងអាន
    setIsPlaying(false);
    
    try {
      const res = await fetch('/api/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok) setTranscript(data.text);
      else alert(data.error);
    } catch (error) {
      alert("មានបញ្ហាក្នុងការតភ្ជាប់!");
    } finally {
      setLoadingTranscript(false);
    }
  };

  // 2. បកប្រែជាភាសាខ្មែរ
  const handleTranslate = async () => {
    if (!transcript) return alert("សូមទាញយកអត្ថបទដើមជាមុនសិន!");
    setLoadingTranslate(true);
    setTranslatedText('');
    window.speechSynthesis.cancel();
    setIsPlaying(false);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript }),
      });
      const data = await res.json();
      if (res.ok) setTranslatedText(data.translation);
      else alert(data.error);
    } catch (error) {
      alert("បរាជ័យក្នុងការបកប្រែ!");
    } finally {
      setLoadingTranslate(false);
    }
  };

  // 3. អានអត្ថបទជាសំឡេង (Khmer TTS)
  const handleTTS = () => {
    if (!translatedText) return alert("គ្មានអត្ថបទសម្រាប់អានទេ!");
    
    // បើកំពុងអាន ហើយអ្នកប្រើប្រាស់ចុចម្តងទៀត គឺដើម្បីបញ្ឈប់ (Stop)
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    // បង្កើតមុខងារអាន
    const utterance = new SpeechSynthesisUtterance(translatedText);
    utterance.lang = 'km-KH'; // កំណត់កូដភាសាជា ខ្មែរ
    utterance.rate = 0.9;     // ល្បឿនអាន (0.9 គឺល្មមស្តាប់បានច្បាស់)
    utterance.pitch = 1;      // កម្រិតសម្លេងធម្មតា

    // ពេលអានចប់
    utterance.onend = () => setIsPlaying(false);
    
    // ពេលមាន Error (ឧ. ឧបករណ៍អត់ស្គាល់ភាសាខ្មែរ)
    utterance.onerror = () => {
      setIsPlaying(false);
      console.error("TTS Error");
    };

    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 font-sans">
      <h1 className="text-3xl font-bold mb-8 text-purple-400">ផ្ទាំងគ្រប់គ្រង (Dashboard)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* បញ្ចូលវីដេអូ */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg h-fit">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Play className="text-blue-400" /> បញ្ចូលវីដេអូ</h2>
          <input 
            type="url" placeholder="ដាក់ YouTube URL នៅទីនេះ..." 
            className="w-full p-4 rounded-xl bg-slate-900 border border-slate-600 mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
            onChange={(e) => setUrl(e.target.value)} value={url}
          />
        </div>

        {/* មុខងារដំណើរការ */}
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg space-y-4">
           <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><FileText className="text-green-400"/> មុខងារដំណើរការ</h2>
           
           <button 
             onClick={handleFetchTranscript} disabled={loadingTranscript}
             className="w-full bg-slate-700 hover:bg-slate-600 p-4 rounded-xl flex justify-between items-center transition-all disabled:opacity-50"
           >
             ១. {loadingTranscript ? "កំពុងទាញយក..." : "ទាញយកអត្ថបទដើម"} <Download className="w-5 h-5 text-gray-300"/>
           </button>
           
           <button 
             onClick={handleTranslate} disabled={!transcript || loadingTranslate}
             className={`w-full p-4 rounded-xl flex justify-between items-center transition-all ${transcript ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-800 opacity-50 cursor-not-allowed border border-slate-600'}`}
           >
             ២. {loadingTranslate ? "កំពុងបកប្រែ..." : "បកប្រែជាភាសាខ្មែរ"} <Languages className="w-5 h-5 text-gray-300"/>
           </button>
           
           {/* ប៊ូតុង TTS */}
           <button 
             onClick={handleTTS} disabled={!translatedText}
             className={`w-full p-4 rounded-xl flex justify-between items-center transition-all ${
               translatedText 
                 ? (isPlaying ? 'bg-red-600 hover:bg-red-500 font-bold' : 'bg-purple-600 hover:bg-purple-500 font-bold shadow-lg shadow-purple-500/30') 
                 : 'bg-slate-800 opacity-50 cursor-not-allowed border border-slate-600'
             }`}
           >
             ៣. {isPlaying ? "កំពុងអាន... (ចុចដើម្បីបញ្ឈប់)" : "អានជាសំឡេង (Khmer TTS)"} 
             {isPlaying ? <Square className="w-5 h-5 text-white"/> : <Play className="w-5 h-5 text-white"/>}
           </button>
        </div>
      </div>

      {/* ផ្នែកបង្ហាញលទ្ធផល */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {transcript && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg animate-in fade-in">
            <h3 className="text-xl font-bold mb-4 text-gray-300">អត្ថបទដើម (Original):</h3>
            <div className="p-4 bg-slate-900 rounded-xl h-64 overflow-y-auto text-gray-400 text-sm leading-relaxed">
              {transcript}
            </div>
          </div>
        )}

        {translatedText && (
          <div className="bg-slate-800 p-6 rounded-2xl border border-purple-500 shadow-lg animate-in fade-in ring-1 ring-purple-500/50">
            <h3 className="text-xl font-bold mb-4 text-purple-400">លទ្ធផលបកប្រែ (Khmer):</h3>
            <div className="p-4 bg-slate-900 rounded-xl h-64 overflow-y-auto text-gray-200 leading-relaxed text-lg">
              {translatedText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}