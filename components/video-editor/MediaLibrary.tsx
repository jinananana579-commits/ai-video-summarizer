'use client';

import { useRef, useState } from 'react';
import { Rocket, Film, Play, Upload, Trash2, Scissors, Copy } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useVideoEditor, VideoFile } from '@/lib/VideoEditorContext';
import TrimModal from './TrimModal';

export default function MediaLibrary() {
  const { 
    videos, 
    activeVideoId, 
    setActiveVideoId, 
    selectedVideoIds, 
    toggleVideoSelection, 
    clearVideoSelection,
    addVideo,
    removeVideos,
    duplicateVideo,
    subtitles,
    subtitleStyle,
    exportMode,
    setExportMode,
    syncVoice,
    exportDirHandle,
    setExportDirHandle,
    durations,
    burnSubtitles,
    setBurnSubtitles,
    burnLogoWatermark,
    setBurnLogoWatermark,
    coverWatermark,
    speechRate,
    aspectRatio,
    setAspectRatio,
    bgMusic,
    bgMusicVolume,
    animatedSubtitles,
    bRolls,
    customWatermark
  } = useVideoEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [trimVideoId, setTrimVideoId] = useState<string | null>(null);

  const handleAddVideosClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        addVideo({
          id: Math.random().toString(36).substring(7),
          name: file.name,
          url: url,
          file: file,
        });
      });
    }
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    if (e.detail === 2) {
      setActiveVideoId(id);
      return;
    }
    toggleVideoSelection(id);
  };

  const handleRemoveSelected = () => {
    removeVideos(selectedVideoIds);
    clearVideoSelection();
  };

  const handleExport = async () => {
    const playlistIds = selectedVideoIds.length > 0 ? selectedVideoIds : (activeVideoId ? [activeVideoId] : []);
    const playlist = playlistIds.map(id => videos.find(v => v.id === id)).filter(Boolean) as typeof videos;
    
    if (playlist.length === 0) {
      alert("Please select a video to export.");
      return;
    }

    let activeDirHandle = exportDirHandle;
    try {
      if ('showDirectoryPicker' in window) {
        if (!activeDirHandle) {
          activeDirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
          setExportDirHandle(activeDirHandle);
        } else {
          const permission = await activeDirHandle.queryPermission({ mode: 'readwrite' });
          if (permission !== 'granted') {
            const request = await activeDirHandle.requestPermission({ mode: 'readwrite' });
            if (request !== 'granted') {
              activeDirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
              setExportDirHandle(activeDirHandle);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return; // User cancelled
      console.warn("Directory picker failed, will fallback to auto-download", err);
      setExportDirHandle(null);
      activeDirHandle = null;
    }

    setIsExporting(true);
    setExportProgress(0);

    const getTimestamp = () => {
      const d = new Date();
      return `${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}_${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}${d.getSeconds().toString().padStart(2,'0')}`;
    };

    const saveFile = async (fileUrl: string, name: string) => {
      const timestamp = getTimestamp();
      const cleanName = name.replace(/\.mp4$/i, '');
      const finalFileName = `exported_${cleanName}_${timestamp}.mp4`;
      
      try {
        if (activeDirHandle) {
          const res = await fetch(fileUrl);
          const blob = await res.blob();
          const fileHandle = await activeDirHandle.getFileHandle(finalFileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          return true;
        }
      } catch (e) {
        console.error("Failed to write to directory", e);
      }
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    };
    
    try {
      if (exportMode === 'separate' && playlist.length > 1) {
        // Batch export one by one
        let accumulatedDuration = 0;
        for (let i = 0; i < playlist.length; i++) {
          const video = playlist[i];
          if (!video.file) continue;
          
          const vDur = durations[video.id] || 0;
          const videoStartTime = accumulatedDuration;
          const videoEndTime = vDur > 0 ? videoStartTime + vDur : Number.MAX_SAFE_INTEGER;
          
          // Slice and shift subtitles for this specific video
          const localSubtitles = subtitles
            .filter(sub => sub.start >= videoStartTime && sub.start < videoEndTime)
            .map(sub => ({
              ...sub,
              start: Math.max(0, sub.start - videoStartTime),
              end: Math.max(0, sub.end - videoStartTime)
            }));
            
          accumulatedDuration += vDur;

          const formData = new FormData();
          formData.append('video', video.file);
          formData.append('subtitles', JSON.stringify(localSubtitles));
          formData.append('subtitleStyle', JSON.stringify(subtitleStyle));
          formData.append('burnSubtitles', burnSubtitles.toString());
          formData.append('burnLogoWatermark', burnLogoWatermark.toString());
          formData.append('syncVoice', syncVoice.toString());
          formData.append('speechRate', speechRate.toString());
          if (coverWatermark?.enabled) {
            formData.append('coverWatermark', JSON.stringify(coverWatermark));
          }
          if (customWatermark) {
            formData.append('customWatermarkFile', customWatermark);
          }
          
          const response = await fetch('/api/export', { method: 'POST', body: formData });
          if (!response.ok) throw new Error(`Export failed for ${video.name}`);
          if (!response.body) throw new Error("No response body");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let done = false;
          let finalUrl = '';

          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n').filter(Boolean);
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.type === 'progress') setExportProgress(data.percent);
                  else if (data.type === 'done') finalUrl = data.url;
                  else if (data.type === 'error') {
                    throw new Error(data.message);
                  }
                } catch (e: any) {
                  // Only rethrow if it's the explicit FFmpeg error we just created
                  if (e.message && e.message !== "Unexpected end of JSON input" && !e.message.includes("JSON")) {
                    throw e;
                  }
                }
              }
            }
          }

          if (!finalUrl) throw new Error("Export failed to return a URL");
          await saveFile(finalUrl, video.name);
        }
        alert("Batch export completed!");
      } else {
        // Single file or Merge mode
        let targetVideoBlob: Blob;
        let exportName = playlist[0].name;

        if (playlist.length > 1) {
          // Merge first
          exportName = "merged_video.mp4";
          const mergeFormData = new FormData();
          for (const video of playlist) {
            if (video.file) {
              mergeFormData.append('videos', video.file, video.name);
              mergeFormData.append('trims', JSON.stringify({ start: video.trimStart, end: video.trimEnd }));
            }
          }
          const mergeRes = await fetch('/api/video/merge-videos', { method: 'POST', body: mergeFormData });
          
          if (!mergeRes.body) throw new Error("No response body from merge");
          const mergeReader = mergeRes.body.getReader();
          const mergeDecoder = new TextDecoder();
          let mergeDone = false;
          let finalMergeUrl = '';

          while (!mergeDone) {
            const { value, done: readerDone } = await mergeReader.read();
            mergeDone = readerDone;
            if (value) {
              const chunk = mergeDecoder.decode(value, { stream: true });
              const lines = chunk.split('\n').filter(Boolean);
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.type === 'progress') {
                    // Map 0-100% of merge to 0-50% overall
                    setExportProgress(data.percent / 2);
                  }
                  else if (data.type === 'done') finalMergeUrl = data.url;
                  else if (data.type === 'error') throw new Error(data.message);
                } catch (e: any) {
                  if (e.message && e.message !== "Unexpected end of JSON input" && !e.message.includes("JSON")) {
                    throw e;
                  }
                }
              }
            }
          }
          
          if (!finalMergeUrl) throw new Error("Merge failed to return a URL");

          const mergedVideoRes = await fetch(finalMergeUrl);
          targetVideoBlob = await mergedVideoRes.blob();
        } else {
          targetVideoBlob = playlist[0].file!;
        }

        const formData = new FormData();
        formData.append('video', targetVideoBlob, exportName);
        if (playlist.length === 1) {
          const video = playlist[0];
          formData.append('trimStart', (video.trimStart || 0).toString());
          formData.append('trimEnd', (video.trimEnd || 0).toString());
        }
        formData.append('subtitles', JSON.stringify(subtitles));
        formData.append('subtitleStyle', JSON.stringify(subtitleStyle));
        formData.append('burnSubtitles', burnSubtitles.toString());
        formData.append('burnLogoWatermark', burnLogoWatermark.toString());
        formData.append('syncVoice', syncVoice.toString());
        formData.append('speechRate', speechRate.toString());
        formData.append('aspectRatio', aspectRatio);
        formData.append('animatedSubtitles', animatedSubtitles.toString());
        if (bRolls.length > 0) {
          formData.append('bRolls', JSON.stringify(bRolls));
        }
        if (bgMusic) {
          formData.append('bgMusic', bgMusic);
          formData.append('bgMusicVolume', bgMusicVolume.toString());
        }
        if (coverWatermark?.enabled) {
          formData.append('coverWatermark', JSON.stringify(coverWatermark));
        }
        if (customWatermark) {
          formData.append('customWatermarkFile', customWatermark);
        }
        
        const response = await fetch('/api/export', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Export failed');
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let finalUrl = '';

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.type === 'progress') {
                  if (playlist.length > 1) {
                    setExportProgress(50 + data.percent / 2);
                  } else {
                    setExportProgress(data.percent);
                  }
                }
                else if (data.type === 'done') finalUrl = data.url;
                else if (data.type === 'error') throw new Error(data.message);
              } catch (e: any) {
                // Only rethrow if it's the explicit FFmpeg error we just created
                if (e.message && e.message !== "Unexpected end of JSON input" && !e.message.includes("JSON")) {
                  throw e;
                }
              }
            }
          }
        }

        if (!finalUrl) throw new Error("Export failed to return a URL");
        await saveFile(finalUrl, exportName);
        alert("Video saved successfully!");
      }
    } catch (error: any) {
      console.error("Export Error:", error);
      alert(`Export Error: ${error.message}`);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 h-full min-w-0 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white/90 font-medium text-lg flex items-center gap-2">
          <Film className="w-5 h-5 text-[#00d2ff]" /> Media Library
        </h2>
      </div>
      
      {/* List Area */}
      <div className="flex-1 bg-black/40 rounded-xl border border-white/5 overflow-y-auto p-2">
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-3">
            <Film className="w-8 h-8 opacity-20" />
            <p className="text-sm">No videos added.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {videos.map(video => {
              const isSelected = selectedVideoIds.includes(video.id);
              
              return (
                <button 
                  key={video.id}
                  onClick={(e) => toggleSelection(video.id, e)}
                  className={`w-full aspect-video rounded-lg overflow-hidden border-2 relative transition-all duration-300 group
                    ${isSelected ? 'border-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.3)]' : 'border-transparent hover:border-zinc-700'}`}
                >
                  <video src={video.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Overlay icon */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                      <Play className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  {/* Actions Top Right */}
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div 
                      onClick={(e) => { e.stopPropagation(); setTrimVideoId(video.id); }}
                      className="w-7 h-7 bg-black/60 hover:bg-[#00d2ff]/80 rounded-md flex items-center justify-center text-white transition-colors cursor-pointer backdrop-blur-sm"
                      title="Trim Video"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </div>
                    <div 
                      onClick={(e) => { e.stopPropagation(); duplicateVideo(video.id); }}
                      className="w-7 h-7 bg-black/60 hover:bg-[#00d2ff]/80 rounded-md flex items-center justify-center text-white transition-colors cursor-pointer backdrop-blur-sm"
                      title="Duplicate Video"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  
                  {/* Title Bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6 pointer-events-none">
                    <p className="text-white/90 text-xs font-medium truncate w-full text-left" title={video.name}>
                      {video.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <label className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 py-2.5 px-4 rounded-xl text-sm font-medium transition-all cursor-pointer">
          <Upload className="w-4 h-4" /> Add Videos
          <input type="file" multiple accept="video/mp4,video/webm" className="hidden" onChange={handleFileChange} />
        </label>
        
        <button 
          onClick={handleRemoveSelected}
          disabled={selectedVideoIds.length === 0}
          className="flex items-center justify-center gap-2 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 hover:text-red-400 text-white/90 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:hover:text-white/90 py-2.5 px-4 rounded-xl text-sm font-medium transition-all"
        >
          <Trash2 className="w-4 h-4" /> Remove
        </button>
      </div>

      <div className="flex items-center justify-between px-1 mt-3 mb-1">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={burnSubtitles} 
            onChange={(e) => setBurnSubtitles(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-black/40 text-[#00d2ff] focus:ring-[#00d2ff]/50 focus:ring-offset-0 cursor-pointer transition-colors"
          />
          <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Burn Subtitles</span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer group">
          <input 
            type="checkbox" 
            checked={burnLogoWatermark} 
            onChange={(e) => setBurnLogoWatermark(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-black/40 text-[#00d2ff] focus:ring-[#00d2ff]/50 focus:ring-offset-0 cursor-pointer transition-colors"
          />
          <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Logo Watermark</span>
        </label>
      </div>

      <div className="flex items-center justify-between px-1 mb-2 bg-white/5 border border-white/10 rounded-xl p-2">
        <span className="text-sm text-zinc-300 font-medium">Aspect Ratio</span>
        <select
          value={aspectRatio}
          onChange={(e) => setAspectRatio(e.target.value as any)}
          className="bg-black/50 border border-white/10 text-white/90 text-sm rounded-lg px-2 py-1 outline-none focus:border-[#00d2ff]/50 transition-colors"
        >
          <option value="original">Original</option>
          <option value="9:16">9:16 (Vertical)</option>
          <option value="16:9">16:9 (Landscape)</option>
          <option value="1:1">1:1 (Square)</option>
        </select>
      </div>

      {/* Start Export Button & Progress Bar */}
      <div className="relative w-full mt-2 shrink-0">
        <button 
          onClick={handleExport}
          disabled={isExporting || !activeVideoId}
          className="w-full relative z-10 bg-gradient-to-r from-[#00d2ff] to-[#3a7bd5] hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,210,255,0.3)] overflow-hidden"
        >
          {isExporting ? (
            <>
              <div 
                className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-300"
                style={{ width: `${exportProgress}%` }}
              />
              <span className="relative z-10 font-medium">Exporting... {exportProgress}%</span>
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              Start Export
            </>
          )}
        </button>
      </div>

      {/* Modals */}
      {trimVideoId && typeof document !== 'undefined' && createPortal(
        <TrimModal 
          video={videos.find(v => v.id === trimVideoId)!} 
          onClose={() => setTrimVideoId(null)} 
        />,
        document.body
      )}
    </div>
  );
}
