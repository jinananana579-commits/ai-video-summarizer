'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Scissors, Search, Film, Type } from 'lucide-react';
import { useVideoEditor } from '@/lib/VideoEditorContext';

export default function TimelineEditor() {
  const { videos, selectedVideoIds, activeVideoId, durations, subtitles, addSubtitle, removeSubtitle } = useVideoEditor();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const playlistIds = selectedVideoIds.length > 0 ? selectedVideoIds : (activeVideoId ? [activeVideoId] : []);
  const playlist = playlistIds.map(id => videos.find(v => v.id === id)).filter(Boolean) as typeof videos;

  const handleAddSubtitle = () => {
    const lastEnd = subtitles.length > 0 ? subtitles[subtitles.length - 1].end : 0;
    addSubtitle({
      id: Math.random().toString(36).substring(7),
      start: lastEnd,
      end: lastEnd + 5,
      text: 'New Subtitle',
      voice: 'Khmer - Piseth'
    });
  };

  const handleDeleteItem = () => {
    if (selectedSubId) {
      removeSubtitle(selectedSubId);
      setSelectedSubId(null);
    } else if (subtitles.length > 0) {
      // fallback delete last if none selected
      removeSubtitle(subtitles[subtitles.length - 1].id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteItem();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleAddSubtitle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSubId, subtitles]);

  // Calculate dynamic timeline duration based on subtitles and videos
  const maxSubEnd = subtitles.length > 0 ? Math.max(...subtitles.map(s => s.end)) : 0;
  
  let totalVideoDur = 0;
  const videoSegments: { id: string, name: string, start: number, duration: number }[] = [];
  
  playlist.forEach(video => {
    const rawDur = durations[video.id] || 0;
    const dur = (video.trimEnd !== undefined && video.trimStart !== undefined) ? (video.trimEnd - video.trimStart) : rawDur;
    videoSegments.push({
      id: video.id + Math.random().toString(), // in case same video duplicated
      name: video.name,
      start: totalVideoDur,
      duration: dur
    });
    totalVideoDur += dur;
  });

  const timelineDuration = Math.max(120, maxSubEnd + 10, totalVideoDur + 10); // Minimum 2 minutes view

  const getStyle = (start: number, end: number) => {
    const left = (start / timelineDuration) * 100;
    const width = ((end - start) / timelineDuration) * 100;
    return { left: `${left}%`, width: `${width}%` };
  };

  // Generate dynamic time markers
  const timeMarkers = Array.from({ length: Math.ceil(timelineDuration / 15) + 1 }, (_, i) => i * 15);

  const formatRulerTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleZoomClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setZoomLevel(1 + pos * 4); // Map 0..1 to 1..5 zoom level
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 w-full h-[250px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white/90 font-medium text-lg flex items-center gap-2">
          <Scissors className="w-5 h-5 text-[#00d2ff]" /> Timeline Editor
        </h2>
      </div>
      
      {/* Toolbar */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={handleAddSubtitle} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 py-1.5 px-3 rounded-xl text-sm transition-all shadow-sm">
            <Plus className="w-4 h-4 text-[#00d2ff]" /> Add Subtitle
          </button>
          <button onClick={handleDeleteItem} className="flex items-center gap-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-white/90 hover:text-red-400 py-1.5 px-3 rounded-xl text-sm transition-all shadow-sm">
            <Trash2 className="w-4 h-4" /> Delete Item
          </button>
          <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 py-1.5 px-3 rounded-xl text-sm transition-all shadow-sm">
            <Scissors className="w-4 h-4 text-[#00d2ff]" /> Split Item
          </button>
        </div>

        <div className="flex items-center gap-3 bg-black/30 px-4 py-2 rounded-xl border border-white/5">
          <Search className="w-4 h-4 text-zinc-400" />
          <span className="text-zinc-400 text-sm font-medium">Zoom:</span>
          <div className="w-24 h-1.5 bg-white/10 rounded-full relative cursor-pointer ml-1" onClick={handleZoomClick}>
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#00d2ff] to-[#3a7bd5] rounded-full" style={{ width: `${((zoomLevel - 1) / 4) * 100}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-[0_0_10px_rgba(0,210,255,0.8)] border-2 border-[#00d2ff]" style={{ left: `calc(${((zoomLevel - 1) / 4) * 100}% - 7px)` }} />
          </div>
        </div>
      </div>

      {/* Timeline Area */}
      <div className="flex-1 bg-black/40 rounded-xl border border-white/5 relative overflow-x-auto overflow-y-hidden flex flex-col shadow-inner">
        <div className="flex flex-col h-full" style={{ minWidth: `${zoomLevel * 100}%` }}>
          {/* Time Ruler */}
          <div className="h-7 border-b border-white/10 flex text-[10px] text-zinc-500 font-mono items-center relative bg-black/60 w-full overflow-hidden shrink-0">
            {timeMarkers.map(time => (
              <div 
                key={time} 
                className="absolute top-0 bottom-0 flex flex-col justify-end pb-1 border-l border-zinc-700/50 pl-1"
                style={{ left: `${(time / timelineDuration) * 100}%` }}
              >
                {formatRulerTime(time)}
              </div>
            ))}
          </div>
          
          {/* Tracks */}
          <div className="flex-1 p-3 overflow-y-auto overflow-x-hidden flex flex-col gap-3 relative">
            {/* Main Video Track Area */}
            <div className="relative h-12 w-full bg-black/40 rounded-lg border border-white/5 shadow-inner">
              {videoSegments.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
                  No videos in playlist
                </div>
              )}
              {videoSegments.map(seg => (
                <div
                  key={seg.id}
                  className="absolute top-1 bottom-1 rounded-md p-1.5 flex items-center gap-1.5 text-xs font-medium overflow-hidden border border-[#8a63c7]/50 bg-gradient-to-r from-[#6b4c9a]/80 to-[#5a3e85]/80 text-white/90 shadow-sm backdrop-blur-sm"
                  style={getStyle(seg.start, seg.start + seg.duration)}
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{seg.name}</span>
                </div>
              ))}
            </div>

            {/* Subtitles Track Area */}
            <div className="relative h-12 w-full bg-black/40 rounded-lg border border-white/5 shadow-inner">
              {subtitles.map(sub => (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`absolute top-1 bottom-1 rounded-md p-1.5 flex items-center gap-1.5 text-xs font-medium cursor-pointer overflow-hidden border transition-all shadow-sm ${selectedSubId === sub.id ? 'bg-[#ff6b6b]/20 border-[#ff6b6b] text-[#ff6b6b] shadow-[0_0_10px_rgba(255,107,107,0.3)]' : 'bg-[#00d2ff]/10 border-[#00d2ff]/50 text-[#00d2ff] hover:bg-[#00d2ff]/20 hover:border-[#00d2ff]'}`}
                  style={getStyle(sub.start, sub.end)}
                >
                  <Type className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{sub.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
