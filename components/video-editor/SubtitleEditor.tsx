import { useState } from 'react';
import { Upload, Download, Copy, ClipboardPaste, Headphones, Languages, Mic, Play, Trash2, Loader2, Palette, Type, Sparkles } from 'lucide-react';
import { useVideoEditor } from '@/lib/VideoEditorContext';

export default function SubtitleEditor() {
  const { 
    subtitles, updateSubtitle, addSubtitle, removeSubtitle, 
    videos, selectedVideoIds, activeVideoId, updateVideo,
    subtitleStyle, setSubtitleStyle, durations, globalVoice, 
    coverWatermark, setCoverWatermark, 
    animatedSubtitles, setAnimatedSubtitles,
    elevenLabsApiKey, geminiApiKey, gladiaApiKey, clonedVoices
  } = useVideoEditor();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');

  const handleHighlight = async () => {
    if (subtitles.length === 0) return alert("Please transcribe the video first.");
    if (!activeVideoId) return alert("Please select a video.");

    setIsProcessing(true);
    setStatusText('Analyzing transcript for viral hook...');

    try {
      const res = await fetch('/api/ai/highlight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles, geminiApiKey }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const { start, end, reason } = data.highlight;
      
      // Ensure start and end are valid numbers
      if (typeof start === 'number' && typeof end === 'number') {
        updateVideo(activeVideoId, { trimStart: start, trimEnd: end });
        alert(`Found a viral clip!\nVideo trimmed from ${start}s to ${end}s.\n\nReason: ${reason}`);
      } else {
        throw new Error("Invalid timestamps returned from AI.");
      }

    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message}\n\nMake sure GEMINI_API_KEY is set in Settings.`);
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  const handleTextChange = (id: string, text: string) => {
    updateSubtitle(id, { text });
  };

  const handleVoiceChange = (id: string, voice: string) => {
    updateSubtitle(id, { voice, audioUrl: undefined, audioDuration: undefined });
  };

  const getPlaylist = () => {
    const playlistIds = selectedVideoIds.length > 0 ? selectedVideoIds : (activeVideoId ? [activeVideoId] : []);
    return playlistIds.map(id => videos.find(v => v.id === id)).filter(Boolean) as typeof videos;
  };

  const handleTranscribe = async () => {
    const playlist = getPlaylist();
    if (playlist.length === 0) return alert("Please select a video first");

    setIsProcessing(true);

    try {
      const allSubtitles = [];
      let accumulatedTime = 0;

      for (let i = 0; i < playlist.length; i++) {
        const video = playlist[i];
        setStatusText(`Transcribing ${video.name} (${i + 1}/${playlist.length})...`);
        
        let targetVideoBlob: Blob;
        if (video.file) {
          targetVideoBlob = video.file;
        } else {
          const res = await fetch(video.url);
          targetVideoBlob = await res.blob();
        }

        // Try getting a presigned URL for direct upload to bypass Vercel 4.5MB limit
        let uploadedVideoUrl = null;
        try {
          const presignRes = await fetch('/api/upload/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: video.name || 'video.mp4',
              contentType: targetVideoBlob.type || 'video/mp4'
            })
          });
          
          if (presignRes.ok) {
            const presignData = await presignRes.json();
            setStatusText(`Uploading ${video.name} to Cloud Storage...`);
            const uploadRes = await fetch(presignData.url, {
              method: 'PUT',
              body: targetVideoBlob,
              headers: { 'Content-Type': targetVideoBlob.type || 'video/mp4' }
            });
            
            if (uploadRes.ok) {
              uploadedVideoUrl = presignData.publicUrl;
            } else {
              console.warn("Direct upload failed, falling back to local upload.");
            }
          }
        } catch (e) {
          console.warn("Could not get presigned URL, falling back to direct API upload.", e);
        }

        setStatusText(`Transcribing ${video.name} (${i + 1}/${playlist.length})...`);
        const transcribeFormData = new FormData();
        if (uploadedVideoUrl) {
          transcribeFormData.append('videoUrl', uploadedVideoUrl);
        } else {
          transcribeFormData.append('video', targetVideoBlob, video.name || 'video.mp4');
        }
        transcribeFormData.append('voice', globalVoice);
        transcribeFormData.append('gladiaApiKey', gladiaApiKey);

        const transcribeRes = await fetch('/api/ai/transcribe-video', {
          method: 'POST',
          body: transcribeFormData,
        });

        const transcribeText = await transcribeRes.text();
        let transcribeData;
        try {
          transcribeData = JSON.parse(transcribeText);
        } catch (e) {
          throw new Error(`Transcribe API Error (Not JSON): ${transcribeText.substring(0, 100)}...`);
        }
        
        if (!transcribeData.success) {
          throw new Error(transcribeData.error);
        }

        const shiftedSubs = transcribeData.subtitles.map((sub: any) => ({
          ...sub,
          start: sub.start + accumulatedTime,
          end: sub.end + accumulatedTime
        }));

        allSubtitles.push(...shiftedSubs);
        
        // Use durations from context if available. Fallback to 0 (which might cause overlap if metadata wasn't loaded)
        // Usually, the video metadata should be loaded by the time they click transcribe.
        const vDur = durations[video.id] || 0;
        accumulatedTime += vDur;
      }

      // Clear existing and add new
      subtitles.forEach(s => removeSubtitle(s.id));
      allSubtitles.forEach(sub => addSubtitle(sub));

    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  const handleTranslate = async () => {
    if (subtitles.length === 0) return;
    
    setIsProcessing(true);
    setStatusText('Translating via Gemini...');

    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtitles, geminiApiKey }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Update UI with translated text
      data.subtitles.forEach((translatedSub: any) => {
        updateSubtitle(translatedSub.id, { text: translatedSub.text });
      });

    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message}\n\nMake sure GEMINI_API_KEY is set in .env.local`);
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  const handleTTS = async () => {
    if (subtitles.length === 0) return;

    setIsProcessing(true);

    try {
      let subsToProcess = subtitles;
      const hasKhmer = subtitles.some(sub => /[\u1780-\u17FF]/.test(sub.text));
      
      if (!hasKhmer && subtitles.length > 0) {
        setStatusText('Auto-translating to Khmer...');
        const transRes = await fetch('/api/ai/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subtitles, geminiApiKey })
        });
        const transData = await transRes.json();
        if (transData.success && transData.subtitles) {
          subsToProcess = transData.subtitles.map((translatedSub: any, index: number) => ({
             ...translatedSub,
             voice: subtitles[index]?.voice || globalVoice
          }));
          // Update the UI immediately
          subsToProcess.forEach((sub: any) => updateSubtitle(sub.id, { text: sub.text, voice: sub.voice }));
        } else {
          throw new Error("Auto-translate failed: " + transData.error);
        }
      }

      for (let i = 0; i < subsToProcess.length; i++) {
        const sub = subsToProcess[i];
        if (!sub.text) continue;
        
        setStatusText(`Generating TTS (${i + 1}/${subsToProcess.length})...`);
        
        try {
          // Send speed=1.0 to get the highest quality, natural voice from the API.
          const speed = 1.0;
          
          const res = await fetch('/api/ai/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              text: sub.text, 
              voice: sub.voice,
              speed: speed,
              elevenLabsApiKey: elevenLabsApiKey
            }),
          });

          const data = await res.json();
          if (!data.success) throw new Error(data.error);

          // Fetch duration of the generated audio to allow lip-syncing
          await new Promise((resolve) => {
            const audio = new Audio(data.url);
            audio.onloadedmetadata = () => {
              updateSubtitle(sub.id, { audioUrl: data.url, audioDuration: audio.duration });
              resolve(true);
            };
            audio.onerror = () => {
              updateSubtitle(sub.id, { audioUrl: data.url });
              resolve(false);
            };
          });
        } catch (err: any) {
          console.warn(`Skipping TTS for subtitle "${sub.text}": ${err.message}`);
        }
      }
    } catch (error: any) {
      console.error(error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  const playSubtitleAudio = (audioUrl?: string) => {
    if (!audioUrl) {
      alert('សូមចុច Generate TTS ជាមុនសិនទើបមានសំឡេង (Please generate TTS first)');
      return;
    }
    const audio = new Audio(audioUrl);
    audio.play().catch(e => console.error('Error playing subtitle audio:', e));
  };

  const formatTimeSRT = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  const handleCopy = async () => {
    try {
      const srtText = subtitles.map((sub, i) => {
        return `${i + 1}\n${formatTimeSRT(sub.start)} --> ${formatTimeSRT(sub.end)}\n${sub.text}`;
      }).join('\n\n');
      
      await navigator.clipboard.writeText(srtText);
      alert('បានចម្លងអត្ថបទជាមួយម៉ោង (SRT Format) រួចរាល់! (Copied as SRT)');
    } catch (e) {
      alert('Failed to copy');
    }
  };

  const parseSRT = (srtText: string) => {
    const normalizedText = srtText.replace(/\r\n/g, '\n');
    const blocks = normalizedText.trim().split(/\n\s*\n/);
    return blocks.map(block => {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const timeLine = lines[1];
        const timeMatch = timeLine.match(/(\d+):(\d+):(\d+),(\d+)\s*-->\s*(\d+):(\d+):(\d+),(\d+)/);
        if (timeMatch) {
          const start = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 1000;
          const end = parseInt(timeMatch[5]) * 3600 + parseInt(timeMatch[6]) * 60 + parseInt(timeMatch[7]) + parseInt(timeMatch[8]) / 1000;
          const text = lines.slice(2).join('\n').trim();
          return {
            id: Math.random().toString(36).substring(7),
            start,
            end,
            text,
            voice: globalVoice
          };
        }
      }
      return null;
    }).filter(Boolean);
  };

  const handlePaste = async () => {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch (e) {
      // Fallback for browsers that block clipboard API
      const fallbackText = window.prompt('Browser blocked clipboard access. Please paste (Ctrl+V) your subtitles here:');
      if (fallbackText) {
        text = fallbackText;
      } else {
        return; // User cancelled
      }
    }

    try {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = parseSRT(text);
      }
      
      if (Array.isArray(data) && data.length > 0 && data[0].start !== undefined) {
        subtitles.forEach(s => removeSubtitle(s.id));
        data.forEach(sub => addSubtitle(sub));
      } else {
        alert('Invalid subtitle format. Please paste valid SRT or JSON.');
      }
    } catch (e: any) {
      alert(`Failed to parse: ${e.message}`);
    }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(subtitles, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "subtitles.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (Array.isArray(data)) {
            subtitles.forEach(s => removeSubtitle(s.id));
            data.forEach(sub => addSubtitle(sub));
          } else {
            alert('Invalid JSON structure');
          }
        } catch (err) {
          alert('Failed to parse JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 h-full min-w-0 relative shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      {isProcessing && (
        <div className="absolute inset-0 bg-black/60 z-10 flex flex-col items-center justify-center rounded-2xl backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-[#00d2ff] animate-spin mb-4" />
          <p className="text-zinc-200 font-medium">{statusText}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-2 shrink-0">
        <h2 className="text-white/90 font-medium text-lg flex items-center gap-2">
          <Languages className="w-5 h-5 text-[#00d2ff]" /> Subtitle Editor
        </h2>
      </div>

      {/* Style Toolbar */}
      <div className="flex items-center justify-center gap-4 bg-black/40 p-2.5 rounded-xl border border-white/5 mb-2 shrink-0 shadow-inner">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-zinc-400" />
          <span className="text-xs text-zinc-400 font-medium">Color:</span>
          <input 
            type="color" 
            value={subtitleStyle.textColor}
            onChange={(e) => setSubtitleStyle(prev => ({...prev, textColor: e.target.value}))}
            className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
            title="Text Color"
          />
        </div>
        <div className="w-px h-4 bg-white/10"></div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium">BG:</span>
          <select 
            value={subtitleStyle.backgroundColor}
            onChange={(e) => setSubtitleStyle(prev => ({...prev, backgroundColor: e.target.value}))}
            className="bg-black/60 text-white/90 text-xs px-2 py-1 rounded-md border border-white/10 outline-none focus:border-[#00d2ff] transition-colors"
            title="Background Color"
          >
            <option value="#000000b3">Dark (70%)</option>
            <option value="#000000e6">Dark (90%)</option>
            <option value="transparent">None</option>
            <option value="#ff0000b3">Red</option>
            <option value="#0000ffb3">Blue</option>
            <option value="#ffffff40">Light</option>
          </select>
        </div>
        <div className="w-px h-4 bg-white/10"></div>
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-zinc-400" />
          <span className="text-xs text-zinc-400 font-medium">Size:</span>
          <input 
            type="number"
            min="12"
            max="72"
            value={subtitleStyle.fontSize}
            onChange={(e) => setSubtitleStyle(prev => ({...prev, fontSize: Number(e.target.value)}))}
            className="w-12 bg-black/60 text-white/90 text-xs px-2 py-1 rounded-md border border-white/10 outline-none text-center focus:border-[#00d2ff] transition-colors"
            title="Font Size"
          />
        </div>
        <div className="w-px h-4 bg-white/10"></div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input 
              type="checkbox" 
              checked={coverWatermark?.enabled || false}
              onChange={(e) => setCoverWatermark(prev => ({ enabled: e.target.checked, height: prev?.height || 15 }))}
              className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-[#00d2ff] focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">Blur Cover</span>
          </label>
          {coverWatermark?.enabled && (
            <input 
              type="range"
              min="5"
              max="50"
              value={coverWatermark.height}
              onChange={(e) => setCoverWatermark(prev => ({ enabled: true, height: Number(e.target.value) }))}
              className="w-16 accent-[#00d2ff]"
              title="Blur Height Percentage"
            />
          )}
        </div>
        <div className="w-px h-4 bg-white/10"></div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer">
            <input 
              type="checkbox" 
              checked={animatedSubtitles}
              onChange={(e) => setAnimatedSubtitles(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-[#00d2ff] focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-zinc-400 font-medium whitespace-nowrap text-[#00d2ff]">Animated (Karaoke)</span>
          </label>
        </div>
      </div>
      
      {/* Table Header */}
      <div className="grid grid-cols-[60px_60px_1fr_120px_40px_30px] gap-3 pl-2 pr-4 text-zinc-400 text-sm font-medium pb-2 border-b border-white/10 text-center items-center shrink-0">
        <div>Start(s)</div>
        <div>End(s)</div>
        <div>Subtitle Text</div>
        <div>Voice</div>
        <div>Play</div>
        <div></div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-2 min-h-0">
        {subtitles.length === 0 ? (
          <div className="text-zinc-600 text-sm flex items-center justify-center h-full bg-black/20 rounded-xl border border-white/5">No subtitles added. Click Transcribe to test.</div>
        ) : (
          subtitles.map(sub => (
            <div key={sub.id} className="grid grid-cols-[60px_60px_1fr_120px_40px_30px] gap-3 items-center bg-white/5 p-2 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all shadow-sm group">
              <input 
                type="number" 
                value={sub.start} 
                onChange={(e) => updateSubtitle(sub.id, { start: Number(e.target.value) })}
                className="bg-black/40 text-white/90 text-xs text-center border border-white/10 focus:border-[#00d2ff] focus:ring-1 focus:ring-[#00d2ff] rounded-lg p-1.5 outline-none w-full transition-all" 
              />
              <input 
                type="number" 
                value={sub.end} 
                onChange={(e) => updateSubtitle(sub.id, { end: Number(e.target.value) })}
                className="bg-black/40 text-white/90 text-xs text-center border border-white/10 focus:border-[#00d2ff] focus:ring-1 focus:ring-[#00d2ff] rounded-lg p-1.5 outline-none w-full transition-all" 
              />
              <textarea 
                value={sub.text} 
                onChange={(e) => handleTextChange(sub.id, e.target.value)}
                rows={1}
                className="bg-black/40 text-white/90 text-sm px-3 py-1.5 rounded-lg border border-white/10 focus:border-[#00d2ff] focus:ring-1 focus:ring-[#00d2ff] outline-none w-full transition-all resize-y min-h-[36px]" 
              />
              <select 
                value={sub.voice}
                onChange={(e) => handleVoiceChange(sub.id, e.target.value)}
                className="bg-black/40 text-white/90 text-xs px-2 py-1.5 rounded-lg border border-white/10 focus:border-[#00d2ff] focus:ring-1 focus:ring-[#00d2ff] outline-none w-full truncate transition-all"
              >
                <option value="Khmer - Piseth">Khmer - Piseth</option>
                <option value="Khmer - Sreymom">Khmer - Sreymom</option>
                {clonedVoices?.map(v => (
                  <option key={v.id} value={`elevenlabs_${v.id}`}>Clone: {v.name}</option>
                ))}
              </select>
              <button 
                onClick={() => playSubtitleAudio(sub.audioUrl)}
                className="flex justify-center items-center text-zinc-500 hover:text-[#00d2ff] opacity-50 group-hover:opacity-100 transition-all bg-black/20 hover:bg-white/10 w-8 h-8 rounded-full"
              >
                <Play className="w-4 h-4 ml-0.5" />
              </button>
              <button 
                onClick={() => removeSubtitle(sub.id)}
                className="flex justify-center items-center text-zinc-500 hover:text-red-400 opacity-50 group-hover:opacity-100 transition-all bg-black/20 hover:bg-red-500/10 w-8 h-8 rounded-full"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3 mt-auto shrink-0 border-t border-white/5 pt-4">
        {/* Action Buttons Row 1 */}
        <div className="grid grid-cols-4 gap-3">
          <button onClick={handleImport} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white py-2 px-3 rounded-xl text-xs font-medium transition-all focus:outline-none active:scale-95">
            <Upload className="w-4 h-4 shrink-0" /> <span className="truncate hidden sm:inline">Import</span>
          </button>
          <button onClick={handleExport} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white py-2 px-3 rounded-xl text-xs font-medium transition-all focus:outline-none active:scale-95">
            <Download className="w-4 h-4 shrink-0" /> <span className="truncate hidden sm:inline">Export</span>
          </button>
          <button onClick={handleCopy} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white py-2 px-3 rounded-xl text-xs font-medium transition-all focus:outline-none active:scale-95">
            <Copy className="w-4 h-4 shrink-0" /> <span className="truncate hidden sm:inline">Copy</span>
          </button>
          <button onClick={handlePaste} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white py-2 px-3 rounded-xl text-xs font-medium transition-all focus:outline-none active:scale-95">
            <ClipboardPaste className="w-4 h-4 shrink-0" /> <span className="truncate hidden sm:inline">Paste</span>
          </button>
        </div>

        {/* Action Buttons Row 2 */}
        <div className="grid grid-cols-4 gap-3">
          <button onClick={handleTranscribe} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00d2ff]/50 text-white py-2.5 px-3 rounded-xl text-sm font-medium transition-all group focus:outline-none active:scale-95">
            <Headphones className="w-4 h-4 shrink-0 group-hover:text-[#00d2ff] transition-colors" /> <span className="truncate">Transcribe</span>
          </button>
          <button onClick={handleTranslate} className="flex items-center justify-center gap-2 border border-[#ffa500]/30 text-white py-2.5 px-3 rounded-xl text-sm font-medium transition-all bg-gradient-to-r from-[#ffa500]/10 to-[#ffb833]/10 hover:from-[#ffa500]/20 hover:to-[#ffb833]/20 shadow-[0_0_15px_rgba(255,165,0,0.15)] group focus:outline-none active:scale-95">
            <Languages className="w-4 h-4 text-[#ffa500] shrink-0 group-hover:scale-110 transition-transform" /> <span className="truncate">Translate</span>
          </button>
          <button onClick={handleTTS} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#00d2ff]/50 text-white py-2.5 px-3 rounded-xl text-sm font-medium transition-all group focus:outline-none active:scale-95">
            <Mic className="w-4 h-4 shrink-0 group-hover:text-[#00d2ff] transition-colors" /> <span className="truncate">Generate TTS</span>
          </button>
          <button onClick={handleHighlight} className="flex items-center justify-center gap-2 border border-[#ff00ff]/30 text-white py-2.5 px-3 rounded-xl text-sm font-medium transition-all bg-gradient-to-r from-[#ff00ff]/10 to-[#8a2be2]/10 hover:from-[#ff00ff]/20 hover:to-[#8a2be2]/20 shadow-[0_0_15px_rgba(255,0,255,0.15)] group focus:outline-none active:scale-95">
            <Sparkles className="w-4 h-4 text-[#ff00ff] shrink-0 group-hover:scale-110 transition-transform" /> <span className="truncate">AI Highlight</span>
          </button>
        </div>
      </div>
    </div>
  );
}
