import { useRef, useState, useEffect } from 'react';
import { useVideoEditor } from '@/lib/VideoEditorContext';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function VideoPlayer() {
  const { 
    videos, 
    activeVideoId, 
    selectedVideoIds, 
    setActiveVideoId, 
    subtitles, 
    subtitleStyle, 
    durations, 
    setDurations,
    coverWatermark,
    speechRate,
    syncVoice,
    aspectRatio,
    bgMusicUrl,
    bgMusicVolume,
    animatedSubtitles,
    bRolls
  } = useVideoEditor();
  
  const playlistIds = selectedVideoIds.length > 0 ? selectedVideoIds : (activeVideoId ? [activeVideoId] : []);
  const playlist = playlistIds.map(id => videos.find(v => v.id === id)).filter(Boolean) as typeof videos;
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localTime, setLocalTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [videoDimensions, setVideoDimensions] = useState<{w: number, h: number} | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const bgAudioRef = useRef<HTMLAudioElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  
  // Map of subtitle ID → pre-loaded HTMLAudioElement
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  // Track which subtitle ID is currently active so we don't re-trigger on every timeupdate
  const activeAudioIdRef = useRef<string | null>(null);
  // Track the actual playing audio element for the active subtitle
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);
  // Track which subtitles have already been played during this sequence to avoid skipping or repeating
  const playedAudioIdsRef = useRef<Set<string>>(new Set());
  // Track the previous global time to detect missed short subtitles
  const lastGlobalTimeRef = useRef<number>(0);

  // Pre-load all audio elements when subtitles change
  useEffect(() => {
    const newRefs: { [key: string]: HTMLAudioElement } = {};

    subtitles.forEach((sub, i) => {
      if (!sub.audioUrl) return;

      // Reuse existing element if URL hasn't changed
      const existing = audioRefs.current[sub.id];
      if (existing && existing.src.endsWith(sub.audioUrl.startsWith('/') ? sub.audioUrl : `/${sub.audioUrl}`)) {
        newRefs[sub.id] = existing;
        return;
      }

      // Pause & discard old element if URL changed
      if (existing) existing.pause();

      const audio = new Audio(sub.audioUrl);
      audio.preload = 'auto';
      audio.preservesPitch = true;
      audio.playbackRate = 1.0; // Always 1.0 in preview — no DSP stretching
      newRefs[sub.id] = audio;
    });

    // Pause any old audio that's no longer in the subtitle list
    Object.keys(audioRefs.current).forEach(id => {
      if (!newRefs[id]) {
        audioRefs.current[id].pause();
      }
    });

    audioRefs.current = newRefs;
  }, [subtitles]);

  // Sync background music volume
  useEffect(() => {
    if (bgAudioRef.current) {
      bgAudioRef.current.volume = bgMusicVolume / 100;
    }
  }, [bgMusicVolume, bgMusicUrl]);

  const stopAllAudio = () => {
    if (playingAudioRef.current) {
      playingAudioRef.current.pause();
      playingAudioRef.current.currentTime = 0;
      playingAudioRef.current = null;
    }
    activeAudioIdRef.current = null;
  };

  useEffect(() => {
    if (selectedVideoIds.length > 0) {
      const idx = selectedVideoIds.indexOf(activeVideoId || '');
      if (idx !== -1) {
        // eslint-disable-next-line
        setCurrentIndex(idx);
      }
    } else {
      // eslint-disable-next-line
      setCurrentIndex(0);
    }
  }, [selectedVideoIds, activeVideoId]);

  const handleMetadata = (id: string, e: React.SyntheticEvent<HTMLVideoElement>) => {
    const duration = e.currentTarget.duration;
    setDurations(prev => ({ ...prev, [id]: duration }));
  };

  const handleMainVideoLoaded = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    e.currentTarget.volume = volume;
    const currentVideo = playlist[currentIndex];
    const ts = currentVideo?.trimStart || 0;
    
    if (pendingSeekRef.current !== null) {
      e.currentTarget.currentTime = pendingSeekRef.current;
      if (bgVideoRef.current) bgVideoRef.current.currentTime = pendingSeekRef.current;
      if (bgAudioRef.current) bgAudioRef.current.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    } else if (ts > 0 && e.currentTarget.currentTime < ts) {
      e.currentTarget.currentTime = ts;
      if (bgVideoRef.current) bgVideoRef.current.currentTime = ts;
      if (bgAudioRef.current) bgAudioRef.current.currentTime = ts;
    }
    setVideoDimensions({
      w: e.currentTarget.videoWidth,
      h: e.currentTarget.videoHeight
    });
  };

  const handleSeeking = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    // Stop all audio immediately when user scrubs
    stopAllAudio();
    playedAudioIdsRef.current.clear();

    const time = e.currentTarget.currentTime;
    let globalTime = 0;
    for (let i = 0; i < currentIndex; i++) {
      const v = playlist[i];
      const dur = durations[v.id] || 0;
      globalTime += (v.trimEnd !== undefined && v.trimStart !== undefined) ? (v.trimEnd - v.trimStart) : dur;
    }
    const currentVideo = playlist[currentIndex];
    globalTime += Math.max(0, time - (currentVideo?.trimStart || 0));

    // Mark any subtitles that ended before this seek time as already played
    // so they don't get queued up and rapid-fired
    subtitles.forEach(s => {
      if (s.end < globalTime) {
        playedAudioIdsRef.current.add(s.id);
      }
    });
    
    lastGlobalTimeRef.current = globalTime;
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;

    const time = videoRef.current.currentTime;
    setLocalTime(time);

    const currentVideo = playlist[currentIndex];
    if (currentVideo && currentVideo.trimEnd && time >= currentVideo.trimEnd) {
      handleEnded();
      return;
    }

    let globalTime = 0;
    for (let i = 0; i < currentIndex; i++) {
      const v = playlist[i];
      const dur = durations[v.id] || 0;
      globalTime += (v.trimEnd !== undefined && v.trimStart !== undefined) ? (v.trimEnd - v.trimStart) : dur;
    }
    globalTime += Math.max(0, time - (currentVideo?.trimStart || 0));

    // Sync BG video
    if (bgVideoRef.current) {
      if (Math.abs(bgVideoRef.current.currentTime - time) > 0.3) {
        bgVideoRef.current.currentTime = time;
      }
    }

    const prevTime = lastGlobalTimeRef.current;
    lastGlobalTimeRef.current = globalTime;
    
    // Protect against large jumps not caught by handleSeeking
    const safePrevTime = (globalTime < prevTime || globalTime - prevTime > 1.0) ? globalTime : prevTime;

    // Find the subtitle that should be speaking right now
    let activeSub = subtitles.find(
      s => globalTime >= s.start && globalTime <= s.end && s.audioUrl
    );

    // If timeupdate missed a very short subtitle, catch it!
    if (!activeSub) {
      const missedSubs = subtitles.filter(
        s => s.start > safePrevTime && s.start <= globalTime && s.audioUrl
      );
      if (missedSubs.length > 0) {
        activeSub = missedSubs[missedSubs.length - 1];
      }
    }

    if (activeSub) {
      if (activeAudioIdRef.current !== activeSub.id) {
        // We no longer fade out or pause the previous audio. 
        // Letting it finish naturally prevents the "choppy" cut-off sound.

        const audio = audioRefs.current[activeSub.id];
        if (audio && isPlaying) {
          audio.volume = volume;
          audio.currentTime = 0;
          
          let rate = speechRate;
          // Dynamically speed up to fit visual slot, but clamp to 1.35x 
          if (syncVoice && activeSub.audioDuration) {
            const visualDur = activeSub.end - activeSub.start;
            if (activeSub.audioDuration > visualDur) {
               const requiredRate = activeSub.audioDuration / visualDur;
               rate = Math.min(Math.max(requiredRate, speechRate), 2.0);
            }
          }
          audio.playbackRate = rate;

          // Set these FIRST so concurrent timeupdates don't spam play()
          activeAudioIdRef.current = activeSub.id;
          playingAudioRef.current = audio;

          audio.play().catch(e => {
            if (e.name === 'NotAllowedError') {
               // Autoplay blocked by browser. Reset ref so it tries again when user clicks play.
               activeAudioIdRef.current = null;
               playingAudioRef.current = null;
               // Pause the main video so the user realizes they need to click Play to start with sound
               if (videoRef.current) {
                 videoRef.current.pause();
               }
            } else if (e.name !== 'AbortError' && e.name !== 'NotSupportedError') {
               console.error(e);
            }
          });
        }
      }
    } else {
      // No active subtitle — let current audio keep playing until it finishes naturally
      if (
        playingAudioRef.current &&
        (playingAudioRef.current.ended || playingAudioRef.current.paused)
      ) {
        playingAudioRef.current = null;
        activeAudioIdRef.current = null;
      }
    }
  };

  const handleEnded = () => {
    stopAllAudio();
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      if (bgVideoRef.current) bgVideoRef.current.pause();
      if (bgAudioRef.current) bgAudioRef.current.pause();
      if (playingAudioRef.current && !playingAudioRef.current.paused) {
        playingAudioRef.current.pause();
      }
    } else {
      videoRef.current.play();
      if (bgVideoRef.current) bgVideoRef.current.play().catch(()=>{});
      if (bgAudioRef.current) bgAudioRef.current.play().catch(()=>{});
      // Resume current audio if there is one and it's paused mid-clip
      if (
        playingAudioRef.current &&
        playingAudioRef.current.paused &&
        !playingAudioRef.current.ended
      ) {
        playingAudioRef.current.play().catch(e => {
          if (e.name !== 'AbortError' && e.name !== 'NotSupportedError') console.error(e);
        });
      }
    }
    setIsPlaying(!isPlaying);
  };

  const totalDuration = playlist.reduce((sum, v) => sum + (durations[v.id] || 0), 0);
  
  let globalCurrentTime = 0;
  // Ensure we don't go out of bounds if currentIndex is stale
  const safeCurrentIndex = Math.min(currentIndex, playlist.length);
  for (let i = 0; i < safeCurrentIndex; i++) {
    if (playlist[i]) {
      globalCurrentTime += (durations[playlist[i].id] || 0);
    }
  }
  globalCurrentTime += localTime;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!totalDuration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetGlobalTime = pos * totalDuration;
    
    let acc = 0;
    let targetIndex = 0;
    let targetLocalTime = 0;
    
    for (let i = 0; i < playlist.length; i++) {
      const vDur = durations[playlist[i].id] || 0;
      if (acc + vDur >= targetGlobalTime || i === playlist.length - 1) {
        targetIndex = i;
        targetLocalTime = targetGlobalTime - acc;
        break;
      }
      acc += vDur;
    }
    
    if (targetIndex === currentIndex && videoRef.current) {
      videoRef.current.currentTime = targetLocalTime;
    } else {
      pendingSeekRef.current = targetLocalTime;
      setCurrentIndex(targetIndex);
    }
  };

  const handleVolumeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(pos);
    if (videoRef.current) videoRef.current.volume = pos;
    if (playingAudioRef.current) playingAudioRef.current.volume = pos;
  };

  const toggleMute = () => {
    const newVol = volume === 0 ? 1 : 0;
    setVolume(newVol);
    if (videoRef.current) videoRef.current.volume = newVol;
    if (playingAudioRef.current) playingAudioRef.current.volume = newVol;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setShowSubtitles(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume]);

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return "00:00";
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const currentVideo = playlist[currentIndex];
  const hasTTS = subtitles.some(s => s.audioUrl);

  return (
    <div className="flex flex-col gap-2 bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-3 h-full min-w-0 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between shrink-0 mb-1">
        <h2 className="text-white/90 font-medium text-lg flex items-center gap-2">
          <Play className="w-5 h-5 text-[#00d2ff]" /> Video Preview
        </h2>
      </div>
      
      <div className="hidden">
        {playlist.map(v => (
          <video key={`hidden-${v.id}`} src={v.url} onLoadedMetadata={(e) => handleMetadata(v.id, e)} />
        ))}
      </div>

      <div className="bg-[#0a0a0a] rounded-xl border border-white/10 flex-1 relative min-h-0 overflow-hidden flex flex-col shadow-inner">
        <div className="flex-1 relative bg-[#0a0a0a] p-2 overflow-hidden flex items-center justify-center min-h-0 w-full h-full">
          {currentVideo ? (
            <div 
              className="relative bg-black overflow-hidden shadow-2xl ring-1 ring-white/10 flex items-center justify-center transition-all duration-300"
              style={
                aspectRatio === 'original'
                  ? (videoDimensions 
                      ? { aspectRatio: `${videoDimensions.w} / ${videoDimensions.h}`, width: '100%', maxHeight: '100%', height: 'auto' }
                      : { width: '100%', height: '100%' })
                  : { aspectRatio: aspectRatio.replace(':', '/'), width: '100%', maxHeight: '100%', height: 'auto' }
              }
            >
              {aspectRatio !== 'original' && (
                <video 
                  ref={bgVideoRef}
                  key={`bg-${currentVideo.id}`}
                  src={currentVideo.url} 
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none z-0"
                  style={{ filter: 'blur(25px)', transform: 'scale(1.1)' }}
                />
              )}
              
              <video 
                ref={videoRef}
                key={currentVideo.id} 
                src={currentVideo.url} 
                autoPlay
                muted={hasTTS}
                onEnded={handleEnded}
                onTimeUpdate={handleTimeUpdate}
                onSeeking={handleSeeking}
                onLoadedMetadata={handleMainVideoLoaded}
                onPlay={() => { setIsPlaying(true); bgVideoRef.current?.play().catch(()=>{}); }}
                onPause={() => { setIsPlaying(false); bgVideoRef.current?.pause(); }}
                className="relative z-10 w-full h-full object-contain"
              />
              
              {/* Overlays Container */}
              <div className="absolute inset-0 z-20 pointer-events-none">
                
                {/* Active B-Roll Overlay */}
                {bRolls.map(broll => {
                  if (globalCurrentTime >= broll.start && globalCurrentTime <= broll.end) {
                    return (
                      <video
                        key={broll.id}
                        src={broll.mediaUrl}
                        className="absolute inset-0 w-full h-full object-cover z-20 pointer-events-none animate-in fade-in duration-300"
                        autoPlay
                        loop
                        muted
                      />
                    );
                  }
                  return null;
                })}

                {/* Cover Watermark Overlay */}
                {coverWatermark?.enabled && (
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-black/90"
                    style={{ height: `${coverWatermark.height}%` }}
                  />
                )}
                
                {/* Live Subtitle Overlay */}
                {showSubtitles && (
                  <div className="absolute inset-x-0 bottom-6 flex flex-col items-center justify-end px-4 sm:px-8 transition-opacity duration-300">
                    {subtitles.map(sub => {
                    if (globalCurrentTime >= sub.start && globalCurrentTime <= sub.end) {
                      const words = sub.text.split(' ');
                      const duration = sub.end - sub.start;
                      const timePerWord = duration / Math.max(words.length, 1);
                      const timeElapsed = globalCurrentTime - sub.start;
                      const currentWordIndex = Math.floor(timeElapsed / timePerWord);

                      return (
                        <div 
                          key={sub.id} 
                          className="font-medium text-center backdrop-blur-md max-w-[90%] whitespace-pre-wrap break-words border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-2 duration-300 mb-2 font-sans tracking-wide"
                          style={{
                            backgroundColor: subtitleStyle?.backgroundColor || 'rgba(0,0,0,0.7)',
                            fontSize: `${subtitleStyle?.fontSize || 24}px`,
                            padding: '0.4em 0.8em',
                            borderRadius: '0.5em',
                            lineHeight: '1.4',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                        >
                          {animatedSubtitles ? (
                            words.map((word, i) => (
                              <span 
                                key={i} 
                                style={{ 
                                  color: i <= currentWordIndex ? (subtitleStyle?.textColor || '#ffffff') : 'rgba(255,255,255,0.4)',
                                  transition: 'color 0.1s ease-in-out'
                                }}
                              >
                                {word}{' '}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: subtitleStyle?.textColor || '#ffffff' }}>{sub.text}</span>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
              </div>
              {/* Background Music Audio Element */}
              {bgMusicUrl && (
                <audio 
                  ref={bgAudioRef}
                  src={bgMusicUrl}
                  loop
                />
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-3">
              <Play className="w-10 h-10 opacity-20" />
              <span className="text-sm">Select videos to preview</span>
            </div>
          )}
        </div>

        <div className="bg-black/80 backdrop-blur-md border-t border-white/5 p-4 flex items-center gap-4 relative z-30">
          <button 
            onClick={togglePlay}
            disabled={!currentVideo}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-all flex-shrink-0"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </button>
          
          <div className="flex-1 flex items-center gap-2">
            <div 
              className="flex-1 h-2 py-2 flex items-center group cursor-pointer relative"
              onClick={handleProgressClick}
            >
              <div className="w-full h-1.5 bg-white/10 rounded-full relative overflow-hidden group-hover:bg-white/20 transition-colors">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#00d2ff] to-[#3a7bd5]" 
                  style={{ width: totalDuration > 0 ? `${(globalCurrentTime / totalDuration) * 100}%` : '0%' }}
                ></div>
              </div>
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(0,210,255,0.8)] border-2 border-[#00d2ff]"
                style={{ left: totalDuration > 0 ? `calc(${(globalCurrentTime / totalDuration) * 100}% - 7px)` : '0%' }}
              ></div>
            </div>
            <div className="text-zinc-300 text-xs font-mono ml-2 whitespace-nowrap flex-shrink-0 w-[90px] text-right">
              {formatTime(globalCurrentTime)} / {formatTime(totalDuration)}
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* CC Toggle Button */}
            <button 
              onClick={() => setShowSubtitles(!showSubtitles)} 
              disabled={!currentVideo}
              className={`px-2 py-1 rounded text-xs font-bold transition-all border ${showSubtitles ? 'bg-white/20 text-white border-white/30' : 'bg-transparent text-zinc-500 border-zinc-600 hover:text-zinc-300'} disabled:opacity-30`}
              title="Toggle Subtitles"
            >
              CC
            </button>
            <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
              {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <div 
              className="w-24 h-2 py-2 flex items-center group cursor-pointer relative"
              onClick={handleVolumeClick}
            >
              <div className="w-full h-1.5 bg-white/10 rounded-full relative overflow-hidden group-hover:bg-white/20 transition-colors">
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-zinc-500 to-white" style={{ width: `${volume * 100}%` }}></div>
              </div>
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                style={{ left: `calc(${volume * 100}% - 6px)` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
