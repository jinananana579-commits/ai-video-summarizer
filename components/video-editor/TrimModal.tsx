import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Scissors } from 'lucide-react';
import { VideoFile, useVideoEditor } from '@/lib/VideoEditorContext';

type TrimModalProps = {
  video: VideoFile;
  onClose: () => void;
};

export default function TrimModal({ video, onClose }: TrimModalProps) {
  const { updateVideo } = useVideoEditor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(1);
  
  const [trimStart, setTrimStart] = useState<number>(video.trimStart || 0);
  const [trimEnd, setTrimEnd] = useState<number>(video.trimEnd || 0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
    }
  }, []);

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (!trimEnd || trimEnd > dur) {
        setTrimEnd(dur);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      
      // Auto-pause if we hit trimEnd during playback
      if (isPlaying && trimEnd > 0 && time >= trimEnd) {
        videoRef.current.pause();
        setIsPlaying(false);
        videoRef.current.currentTime = trimStart; // reset to start
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        if (currentTime >= trimEnd) {
          videoRef.current.currentTime = trimStart;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setStartToPlayhead = () => {
    if (currentTime >= trimEnd) {
      alert("Start time cannot be after end time.");
      return;
    }
    setTrimStart(currentTime);
  };

  const setEndToPlayhead = () => {
    if (currentTime <= trimStart) {
      alert("End time cannot be before start time.");
      return;
    }
    setTrimEnd(currentTime);
  };

  const handleSave = () => {
    updateVideo(video.id, { trimStart, trimEnd });
    onClose();
  };

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60).toString().padStart(2, '0');
    const s = (time % 60).toFixed(2).padStart(5, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#18181b] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Scissors className="w-5 h-5 text-[#00d2ff]" /> Trim Video
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-6">
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-white/10">
            <video
              ref={videoRef}
              src={video.url}
              className="w-full h-full object-contain"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onClick={togglePlay}
            />
            {/* Trim overlay visualizer */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
               <div 
                 className="absolute top-0 bottom-0 bg-[#00d2ff]/50" 
                 style={{ left: `${(trimStart / duration) * 100}%`, right: `${100 - (trimEnd / duration) * 100}%` }}
               />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={togglePlay}
              className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors shrink-0"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
            </button>
            
            <div className="flex-1 flex flex-col gap-1">
              <input 
                type="range" 
                min="0" 
                max={duration} 
                step="0.01" 
                value={currentTime} 
                onChange={handleSeek}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#00d2ff]"
              />
              <div className="flex justify-between text-xs text-zinc-500 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
              <span className="text-sm text-zinc-400 font-medium">Start Time</span>
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                <div className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm text-center">
                  {formatTime(trimStart)}
                </div>
                <button 
                  onClick={setStartToPlayhead}
                  className="bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Set to Playhead
                </button>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3">
              <span className="text-sm text-zinc-400 font-medium">End Time</span>
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2">
                <div className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm text-center">
                  {formatTime(trimEnd)}
                </div>
                <button 
                  onClick={setEndToPlayhead}
                  className="bg-[#00d2ff]/20 hover:bg-[#00d2ff]/30 text-[#00d2ff] border border-[#00d2ff]/30 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Set to Playhead
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 bg-white/5 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-sm font-medium text-black bg-[#00d2ff] hover:bg-[#00b8e6] transition-colors shadow-[0_0_15px_rgba(0,210,255,0.4)]"
          >
            Save Trim
          </button>
        </div>
      </div>
    </div>
  );
}
