'use client';

import { Settings2, Settings, Music, X, Upload } from 'lucide-react';
import { useVideoEditor } from '@/lib/VideoEditorContext';
import { useState, useRef } from 'react';
import PreferencesModal from './PreferencesModal';

export default function AudioFXPanel() {
  const { 
    globalVoice, setGlobalVoice, clonedVoices, syncVoice, setSyncVoice,
    bgMusic, setBgMusic, bgMusicUrl, setBgMusicUrl, bgMusicVolume, setBgMusicVolume 
  } = useVideoEditor();
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBgMusicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBgMusic(file);
      setBgMusicUrl(URL.createObjectURL(file));
    }
  };

  const removeBgMusic = () => {
    setBgMusic(null);
    setBgMusicUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  return (
    <div className="flex flex-col gap-4 bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/5 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white/90 font-medium text-lg flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-[#00d2ff]" /> Audio FX Configuration
        </h2>
        <button 
          onClick={() => setIsPreferencesOpen(true)}
          className="text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium border border-white/5"
        >
          <Settings className="w-4 h-4" /> Settings
        </button>
      </div>
      
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-4 items-center">
        {/* Row 1 */}
        <label className="text-zinc-400 text-sm whitespace-nowrap font-medium">Khmer Voice:</label>
        <select 
          value={globalVoice}
          onChange={(e) => setGlobalVoice(e.target.value)}
          className="bg-black/40 border border-white/10 text-white/90 rounded-lg p-2 text-sm focus:outline-none focus:border-[#00d2ff] focus:ring-1 focus:ring-[#00d2ff] transition-all"
        >
          <option value="Khmer - Piseth">Khmer - Piseth</option>
          <option value="Khmer - Sreymom">Khmer - Sreymom</option>
          {clonedVoices.length > 0 && <optgroup label="Cloned Voices">
            {clonedVoices.map(voice => (
              <option key={voice.id} value={`elevenlabs_${voice.id}`}>
                {voice.name}
              </option>
            ))}
          </optgroup>}
        </select>

        {/* Row 2 */}
        <label className="text-zinc-400 text-sm whitespace-nowrap font-medium">Transcribe Eng:</label>
        <select className="bg-black/40 border border-white/10 text-white/90 rounded-lg p-2 text-sm focus:outline-none focus:border-[#00d2ff] focus:ring-1 focus:ring-[#00d2ff] transition-all">
          <option>Claude AI</option>
          <option>Gemini</option>
          <option>OpenAI</option>
        </select>

        {/* Row 3 */}
        <label className="text-zinc-400 text-sm whitespace-nowrap font-medium">Source Langua:</label>
        <select className="bg-black/40 border border-white/10 text-white/90 rounded-lg p-2 text-sm focus:outline-none focus:border-[#00d2ff] focus:ring-1 focus:ring-[#00d2ff] transition-all">
          <option>Auto Detect</option>
          <option>Chinese (Simp</option>
          <option>English</option>
        </select>

        {/* Row 4 */}
        <div className="flex items-center gap-3 col-span-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              id="sync-voice" 
              className="sr-only peer" 
              checked={syncVoice}
              onChange={(e) => setSyncVoice(e.target.checked)}
            />
            <div className="w-11 h-6 bg-black/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00d2ff] border border-white/10"></div>
          </label>
          <label htmlFor="sync-voice" className="text-white/90 text-sm font-medium cursor-pointer">Sync Voice</label>
        </div>
      </div>

      <div className="border-t border-white/5 my-1"></div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full max-w-[240px]">
          <Music className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="text-zinc-400 text-sm font-medium whitespace-nowrap">BG Music:</span>
          {bgMusic ? (
            <div className="flex items-center justify-between bg-black/40 border border-[#00d2ff]/30 rounded-lg px-2 py-1 flex-1 overflow-hidden">
              <span className="text-xs text-[#00d2ff] truncate mr-2" title={bgMusic.name}>{bgMusic.name}</span>
              <button onClick={removeBgMusic} className="text-zinc-500 hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 bg-black/40 hover:bg-black/60 border border-white/10 hover:border-white/20 text-zinc-300 rounded-lg px-2 py-1 flex-1 transition-colors text-xs"
            >
              <Upload className="w-3 h-3" /> Select Audio
            </button>
          )}
          <input 
            type="file" 
            accept="audio/*" 
            ref={fileInputRef} 
            onChange={handleBgMusicChange} 
            className="hidden" 
          />
        </div>

        {bgMusic && (
          <div className="flex items-center gap-3 flex-1 ml-4">
            <span className="text-zinc-400 text-sm font-medium whitespace-nowrap">Volume:</span>
            <input 
              type="range" 
              min="0" max="100" 
              value={bgMusicVolume} 
              onChange={(e) => setBgMusicVolume(Number(e.target.value))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#00d2ff]"
            />
            <span className="text-xs text-white/80 font-mono w-8 text-right">{bgMusicVolume}%</span>
          </div>
        )}
      </div>
      
      <PreferencesModal 
        isOpen={isPreferencesOpen} 
        onClose={() => setIsPreferencesOpen(false)} 
      />
    </div>
  );
}
