'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type VideoFile = {
  id: string;
  name: string;
  url: string;
  file?: File;
  trimStart?: number;
  trimEnd?: number;
};

export type BRoll = {
  id: string;
  start: number;
  end: number;
  keyword: string;
  mediaUrl: string;
};

export type Subtitle = {
  id: string;
  start: number;
  end: number;
  text: string;
  voice: string;
  audioUrl?: string;
  audioDuration?: number;
};

export type SubtitleStyle = {
  textColor: string;
  backgroundColor: string;
  fontSize: number;
};

export type AspectRatio = 'original' | '16:9' | '9:16' | '1:1';

export type CoverWatermark = {
  enabled: boolean;
  height: number;
};

export type ClonedVoice = {
  id: string;
  name: string;
  description?: string;
  preview_url?: string;
};

type VideoEditorContextType = {
  videos: VideoFile[];
  activeVideoId: string | null;
  setActiveVideoId: (id: string | null) => void;
  selectedVideoIds: string[];
  toggleVideoSelection: (id: string) => void;
  clearVideoSelection: () => void;
  addVideo: (video: VideoFile) => void;
  updateVideo: (id: string, updates: Partial<VideoFile>) => void;
  duplicateVideo: (id: string) => void;
  removeVideos: (ids: string[]) => void;
  subtitles: Subtitle[];
  addSubtitle: (subtitle: Subtitle) => void;
  updateSubtitle: (id: string, updates: Partial<Subtitle>) => void;
  removeSubtitle: (id: string) => void;
  subtitleStyle: SubtitleStyle;
  setSubtitleStyle: React.Dispatch<React.SetStateAction<SubtitleStyle>>;
  speechRate: number;
  setSpeechRate: (value: number) => void;
  animatedSubtitles: boolean;
  setAnimatedSubtitles: (animated: boolean) => void;

  exportMode: 'merge' | 'separate';
  setExportMode: (mode: 'merge' | 'separate') => void;
  exportDirHandle: any | null;
  setExportDirHandle: (handle: any | null) => void;
  durations: Record<string, number>;
  setDurations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  globalVoice: string;
  setGlobalVoice: (voice: string) => void;
  burnSubtitles: boolean;
  setBurnSubtitles: React.Dispatch<React.SetStateAction<boolean>>;
  burnLogoWatermark: boolean;
  coverWatermark: CoverWatermark | null;
  setCoverWatermark: React.Dispatch<React.SetStateAction<CoverWatermark | null>>;
  setBurnLogoWatermark: React.Dispatch<React.SetStateAction<boolean>>;
  elevenLabsApiKey: string;
  setElevenLabsApiKey: (val: string) => void;
  syncVoice: boolean;
  setSyncVoice: React.Dispatch<React.SetStateAction<boolean>>;
  geminiApiKey: string;
  setGeminiApiKey: (val: string) => void;
  gladiaApiKey: string;
  setGladiaApiKey: (val: string) => void;
  pexelsApiKey: string;
  setPexelsApiKey: (val: string) => void;
  clonedVoices: ClonedVoice[];
  addClonedVoice: (voice: ClonedVoice) => void;
  bRolls: BRoll[];
  setBRolls: React.Dispatch<React.SetStateAction<BRoll[]>>;
  aspectRatio: AspectRatio;
  setAspectRatio: React.Dispatch<React.SetStateAction<AspectRatio>>;
  bgMusic: File | null;
  setBgMusic: React.Dispatch<React.SetStateAction<File | null>>;
  bgMusicUrl: string | null;
  setBgMusicUrl: React.Dispatch<React.SetStateAction<string | null>>;
  bgMusicVolume: number;
  setBgMusicVolume: React.Dispatch<React.SetStateAction<number>>;
  customWatermark: File | null;
  setCustomWatermark: React.Dispatch<React.SetStateAction<File | null>>;
};

const VideoEditorContext = createContext<VideoEditorContextType | undefined>(undefined);

export function VideoEditorProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>({
    textColor: '#ffffff',
    backgroundColor: '#000000b3',
    fontSize: 24,
  });
  const [coverWatermark, setCoverWatermark] = useState<CoverWatermark | null>(null);
  const [animatedSubtitles, setAnimatedSubtitles] = useState<boolean>(false);
  const [exportMode, setExportMode] = useState<'merge' | 'separate'>('separate');
  const [exportDirHandle, setExportDirHandle] = useState<any | null>(null);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [globalVoice, setGlobalVoiceState] = useState('Khmer - Piseth');
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(true);
  const [burnLogoWatermark, setBurnLogoWatermark] = useState<boolean>(true);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('original');
  const [bgMusic, setBgMusic] = useState<File | null>(null);
  const [bgMusicUrl, setBgMusicUrl] = useState<string | null>(null);
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(20);
  const [bRolls, setBRolls] = useState<BRoll[]>([]);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [syncVoice, setSyncVoice] = useState<boolean>(false);
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [gladiaApiKey, setGladiaApiKey] = useState('');
  const [pexelsApiKey, setPexelsApiKey] = useState('');
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [customWatermark, setCustomWatermark] = useState<File | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedElevenLabs = localStorage.getItem('elevenLabsApiKey');
      const savedGemini = localStorage.getItem('geminiApiKey');
      const savedGladia = localStorage.getItem('gladiaApiKey');
      const savedPexels = localStorage.getItem('pexelsApiKey');
      const savedVoices = localStorage.getItem('clonedVoices');
      if (savedElevenLabs) setElevenLabsApiKey(savedElevenLabs);
      if (savedGemini) setGeminiApiKey(savedGemini);
      if (savedGladia) setGladiaApiKey(savedGladia);
      if (savedPexels) setPexelsApiKey(savedPexels);
      if (savedVoices) setClonedVoices(JSON.parse(savedVoices));
    }
  }, []);

  const setSpeechRatePersist = (value: number) => {
    setSpeechRate(value);
    if (typeof window !== 'undefined') localStorage.setItem('speechRate', value.toString());
  };

  const setGlobalVoice = (voice: string) => {
    setGlobalVoiceState(voice);
    if (syncVoice) {
      setSubtitles(prev => prev.map(s => ({ ...s, voice, audioUrl: undefined, audioDuration: undefined })));
    }
  };

  const addVideo = (video: VideoFile) => {
    setVideos(prev => {
      const newVideos = [...prev, video];
      if (newVideos.length === 1) setActiveVideoId(video.id);
      return newVideos;
    });
  };

  const updateVideo = (id: string, updates: Partial<VideoFile>) => {
    setVideos(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
  };

  const duplicateVideo = (id: string) => {
    setVideos(prev => {
      const idx = prev.findIndex(v => v.id === id);
      if (idx === -1) return prev;
      const target = prev[idx];
      const copy: VideoFile = {
        ...target,
        id: Math.random().toString(36).substring(7),
        name: `${target.name} (Copy)`
      };
      const newVideos = [...prev];
      newVideos.splice(idx + 1, 0, copy);
      return newVideos;
    });
  };
  
  const removeVideos = (ids: string[]) => {
    setVideos(prev => {
      const newVideos = prev.filter(v => !ids.includes(v.id));
      if (activeVideoId && ids.includes(activeVideoId)) {
        setActiveVideoId(newVideos.length > 0 ? newVideos[0].id : null);
      }
      if (newVideos.length === 0) setSubtitles([]);
      return newVideos;
    });
    setSelectedVideoIds(prev => prev.filter(id => !ids.includes(id)));
  };

  const toggleVideoSelection = (id: string) => {
    setSelectedVideoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const clearVideoSelection = () => setSelectedVideoIds([]);

  const addSubtitle = (subtitle: Subtitle) => setSubtitles(prev => [...prev, subtitle]);

  const updateSubtitle = (id: string, updates: Partial<Subtitle>) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSubtitle = (id: string) => setSubtitles(prev => prev.filter(s => s.id !== id));

  return (
    <VideoEditorContext.Provider
      value={{
        videos,
        activeVideoId,
        setActiveVideoId,
        selectedVideoIds,
        toggleVideoSelection,
        clearVideoSelection,
        addVideo,
        updateVideo,
        duplicateVideo,
        removeVideos,
        subtitles,
        addSubtitle,
        updateSubtitle,
        removeSubtitle,
        subtitleStyle,
        setSubtitleStyle,
        speechRate,
        setSpeechRate: setSpeechRatePersist,
        animatedSubtitles,
        setAnimatedSubtitles,
        coverWatermark,
        setCoverWatermark,
        exportMode,
        setExportMode,
        exportDirHandle,
        setExportDirHandle,
        durations,
        setDurations,
        globalVoice,
        setGlobalVoice,
        burnSubtitles,
        setBurnSubtitles,
        burnLogoWatermark,
        setBurnLogoWatermark,
        syncVoice,
        setSyncVoice,
        elevenLabsApiKey,
        setElevenLabsApiKey: (val: string) => {
          setElevenLabsApiKey(val);
          if (typeof window !== 'undefined') localStorage.setItem('elevenLabsApiKey', val);
        },
        geminiApiKey,
        setGeminiApiKey: (val: string) => {
          setGeminiApiKey(val);
          if (typeof window !== 'undefined') localStorage.setItem('geminiApiKey', val);
        },
        gladiaApiKey,
        setGladiaApiKey: (val: string) => {
          setGladiaApiKey(val);
          if (typeof window !== 'undefined') localStorage.setItem('gladiaApiKey', val);
        },
        pexelsApiKey,
        setPexelsApiKey: (val: string) => {
          setPexelsApiKey(val);
          if (typeof window !== 'undefined') localStorage.setItem('pexelsApiKey', val);
        },
        clonedVoices,
        addClonedVoice: (voice) => setClonedVoices(prev => {
          const newVoices = [...prev, voice];
          if (typeof window !== 'undefined') localStorage.setItem('clonedVoices', JSON.stringify(newVoices));
          return newVoices;
        }),
        bRolls,
        setBRolls,
        aspectRatio,
        setAspectRatio,
        bgMusic,
        setBgMusic,
        bgMusicUrl,
        setBgMusicUrl,
        bgMusicVolume,
        setBgMusicVolume,
        customWatermark,
        setCustomWatermark
      }}
    >
      {children}
    </VideoEditorContext.Provider>
  );
}

export function useVideoEditor() {
  const context = useContext(VideoEditorContext);
  if (context === undefined) {
    throw new Error('useVideoEditor must be used within a VideoEditorProvider');
  }
  return context;
}
