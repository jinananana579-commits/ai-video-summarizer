'use client';

import { useState } from 'react';
import { Sparkles, Video, FileText } from 'lucide-react';

export default function Home() {
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');

  const handleSummarize = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSummary('');

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });

      const data = await response.json();
      setSummary(data.summary);
    } catch (error) {
      setSummary('សូមអភ័យទោស មានបញ្ហាក្នុងការដំណើរការ។ សូមព្យាយាមម្តងទៀត!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-3xl space-y-8 text-center">

        {/* Header Section */}
        <div className="space-y-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* Welcome Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.15)] transition-all hover:bg-white/10 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] cursor-default">
            <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-pulse"></span>
            <span className="text-sm font-medium tracking-wide text-purple-100 uppercase">Welcome To MesaIT</span>
          </div>

          {/* Main Icon */}
          <div className="relative group">
            <div className="absolute inset-0 bg-purple-500 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-500"></div>
            <div className="relative inline-flex items-center justify-center p-5 bg-gradient-to-b from-white/10 to-white/5 rounded-full border border-white/20 shadow-xl backdrop-blur-md">
              <Sparkles className="w-10 h-10 text-[#00d2ff] drop-shadow-[0_0_15px_rgba(0,210,255,0.5)]" />
            </div>
          </div>
          
          {/* Main Title */}
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight pb-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00d2ff] via-purple-400 to-pink-400 drop-shadow-sm">
              AI សម្រាយរឿង MesaCine
            </span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl leading-relaxed font-light">
            បម្លែងវីដេអូវែងៗ ទៅជាអត្ថបទសម្រាយរឿងខ្លី ងាយយល់ ក្នុងរយៈពេលប៉ុន្មានវិនាទី ជាមួយនឹងបច្ចេកវិទ្យា AI ចុងក្រោយបង្អស់។
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSummarize} className="relative mt-10">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl p-2 backdrop-blur-md shadow-2xl transition-all focus-within:ring-2 focus-within:ring-purple-500">
            <Video className="w-6 h-6 text-gray-400 ml-4" />
            <input
              type="url"
              required
              placeholder="ដាក់បញ្ចូលតំណភ្ជាប់វីដេអូ (YouTube URL) នៅទីនេះ..."
              className="flex-1 bg-transparent border-none text-white px-4 py-4 focus:outline-none placeholder:text-gray-500"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">កំពុងគិត...</span>
              ) : (
                <>សម្រាយរឿង <Sparkles className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </form>

        {/* Result Area */}
        {summary && (
          <div className="mt-12 text-left bg-white/10 border border-white/20 rounded-3xl p-8 backdrop-blur-lg shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
              <FileText className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">លទ្ធផលសម្រាយរឿង</h2>
            </div>
            <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed text-lg">
              {summary}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}