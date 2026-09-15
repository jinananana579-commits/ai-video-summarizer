'use client';

import { useState } from 'react';
import { useVideoEditor, BRoll } from '@/lib/VideoEditorContext';
import { Sparkles, Trash2, Loader2, Video } from 'lucide-react';

export default function BRollPanel() {
  const { subtitles, bRolls, setBRolls, geminiApiKey, pexelsApiKey, durations, activeVideoId } = useVideoEditor();
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerateBRoll = async () => {
    if (!geminiApiKey || !pexelsApiKey) {
      setErrorMsg('Please add Gemini and Pexels API keys in Settings.');
      return;
    }
    if (subtitles.length === 0) {
      setErrorMsg('Please transcribe the video first.');
      return;
    }
    
    // Check if we have duration
    const videoDuration = activeVideoId ? durations[activeVideoId] : 0;
    
    setIsGenerating(true);
    setErrorMsg('');
    
    try {
      const res = await fetch('/api/ai/broll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles,
          geminiApiKey,
          pexelsApiKey,
          videoDuration
        })
      });
      
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }
      
      setBRolls(data.bRolls);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate B-Rolls');
    } finally {
      setIsGenerating(false);
    }
  };

  const removeBRoll = (id: string) => {
    setBRolls(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Video className="w-5 h-5 text-[#00d2ff]" />
          AI Auto B-Roll
        </h3>
        <button
          onClick={handleGenerateBRoll}
          disabled={isGenerating || subtitles.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#00d2ff]/10 hover:bg-[#00d2ff]/20 text-[#00d2ff] text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Auto-Generate
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 m-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg shrink-0">
          {errorMsg}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {bRolls.length === 0 ? (
          <div className="text-zinc-500 text-sm text-center py-10">
            No B-Rolls generated. Click Auto-Generate to use AI.
          </div>
        ) : (
          bRolls.map(broll => (
            <div key={broll.id} className="bg-black/40 border border-white/10 rounded-lg p-3 flex gap-3 group relative overflow-hidden">
              <div className="w-24 h-16 bg-black rounded shrink-0 relative overflow-hidden">
                <video src={broll.mediaUrl} className="w-full h-full object-cover" muted loop playsInline onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
              </div>
              <div className="flex-1 flex flex-col justify-center min-w-0">
                <div className="text-white text-sm font-medium truncate" title={broll.keyword}>
                  "{broll.keyword}"
                </div>
                <div className="text-zinc-400 text-xs mt-1">
                  {broll.start.toFixed(1)}s - {broll.end.toFixed(1)}s
                </div>
              </div>
              <button 
                onClick={() => removeBRoll(broll.id)}
                className="absolute top-2 right-2 p-1.5 bg-red-500/10 text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                title="Remove B-Roll"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
