'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, Key, Upload, Mic, Loader2, CheckCircle2 } from 'lucide-react';
import { useVideoEditor } from '@/lib/VideoEditorContext';

type PreferencesModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function PreferencesModal({ isOpen, onClose }: PreferencesModalProps) {
  const { 
    elevenLabsApiKey, setElevenLabsApiKey, 
    geminiApiKey, setGeminiApiKey,
    gladiaApiKey, setGladiaApiKey,
    pexelsApiKey, setPexelsApiKey,
    addClonedVoice, clonedVoices,
    customWatermark, setCustomWatermark
  } = useVideoEditor();
  
  const [elevenLabsInput, setElevenLabsInput] = useState(elevenLabsApiKey);
  const [geminiInput, setGeminiInput] = useState(geminiApiKey);
  const [gladiaInput, setGladiaInput] = useState(gladiaApiKey);
  const [pexelsInput, setPexelsInput] = useState(pexelsApiKey);
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  
  const [isCloning, setIsCloning] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleSaveConfig = () => {
    setElevenLabsApiKey(elevenLabsInput);
    setGeminiApiKey(geminiInput);
    setGladiaApiKey(gladiaInput);
    setPexelsApiKey(pexelsInput);
    setStatusMsg({ type: 'success', text: 'Settings saved successfully!' });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
  };

  const handleCloneVoice = async () => {
    if (!elevenLabsInput) {
      setStatusMsg({ type: 'error', text: 'Please enter your ElevenLabs API Key first.' });
      return;
    }
    if (!voiceName) {
      setStatusMsg({ type: 'error', text: 'Please enter a name for the cloned voice.' });
      return;
    }
    if (!audioFile) {
      setStatusMsg({ type: 'error', text: 'Please upload an audio sample.' });
      return;
    }

    setIsCloning(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('name', voiceName);
      formData.append('description', voiceDescription || 'Cloned Voice');
      formData.append('files', audioFile);

      // Call ElevenLabs API directly from client
      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsInput,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail?.message || 'Failed to clone voice');
      }

      addClonedVoice({ id: data.voice_id, name: voiceName });
      
      setStatusMsg({ type: 'success', text: 'Voice cloned successfully! You can now select it in the Audio FX Settings.' });
      setVoiceName('');
      setVoiceDescription('');
      setAudioFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      console.error(error);
      setStatusMsg({ type: 'error', text: error.message });
    } finally {
      setIsCloning(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#00d2ff]" /> Settings & Voice Cloning
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          
          {/* API Keys Section */}
          <div className="flex flex-col gap-4">
            <h3 className="text-white/90 text-sm font-medium flex items-center gap-2">
              <Key className="w-4 h-4 text-zinc-400" /> API Integrations
            </h3>
            
            {/* Gemini */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Gemini API Key (For Translation)</label>
              <input 
                type="password"
                placeholder="AIzaSy..."
                value={geminiInput}
                onChange={(e) => setGeminiInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white/90 focus:outline-none focus:border-[#00d2ff]"
              />
            </div>

            {/* Gladia */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Gladia API Key (For Transcription)</label>
              <input 
                type="password"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={gladiaInput}
                onChange={(e) => setGladiaInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white/90 focus:outline-none focus:border-[#00d2ff]"
              />
            </div>

            {/* Pexels */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">Pexels API Key (For Auto B-Roll)</label>
              <input 
                type="password"
                placeholder="563492ad6f91700001000001..."
                value={pexelsInput}
                onChange={(e) => setPexelsInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white/90 focus:outline-none focus:border-[#00d2ff]"
              />
            </div>

            {/* ElevenLabs */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400">ElevenLabs API Key (For Voice Cloning)</label>
              <input 
                type="password"
                placeholder="sk_xxxxxxxxxxxxxxxxxxxx"
                value={elevenLabsInput}
                onChange={(e) => setElevenLabsInput(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white/90 focus:outline-none focus:border-[#00d2ff]"
              />
            </div>

            <button 
              onClick={handleSaveConfig}
              className="mt-2 bg-[#00d2ff] hover:bg-[#3a7bd5] text-black hover:text-white text-sm font-bold py-2.5 rounded-lg transition-colors w-full"
            >
              Save All API Keys
            </button>
            <p className="text-xs text-zinc-500 text-center">Your API keys are stored locally in your browser and never sent to our servers.</p>
          </div>

          <div className="w-full h-px bg-white/5"></div>

          {/* Watermark Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-white/90 text-sm font-medium flex items-center gap-2">
              <Upload className="w-4 h-4 text-zinc-400" /> Custom Logo Watermark
            </h3>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Upload Your Logo (PNG/JPG)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={(e) => setCustomWatermark(e.target.files?.[0] || null)}
                    ref={watermarkInputRef}
                    className="hidden"
                    id="watermark-upload"
                  />
                  <label 
                    htmlFor="watermark-upload"
                    className="flex-1 border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Upload className="w-5 h-5 text-zinc-400" />
                    <span className="text-xs text-zinc-400 font-medium text-center">
                      {customWatermark ? customWatermark.name : 'Click to select logo image'}
                    </span>
                  </label>
                  {customWatermark && (
                    <button 
                      onClick={() => {
                        setCustomWatermark(null);
                        if (watermarkInputRef.current) watermarkInputRef.current.value = '';
                      }}
                      className="p-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors border border-red-500/20"
                      title="Remove custom logo"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  To display this logo on your exported videos, ensure the <b>"Logo Watermark"</b> checkbox is checked in the Media Library.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-white/5"></div>

          {/* Voice Cloning Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-white/90 text-sm font-medium flex items-center gap-2">
              <Mic className="w-4 h-4 text-zinc-400" /> Clone New Voice
            </h3>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Voice Name</label>
                <input 
                  type="text"
                  placeholder="e.g. My Custom Voice"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm text-white/90 focus:outline-none focus:border-[#00d2ff]"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Audio Sample (MP3/WAV)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                    ref={fileInputRef}
                    className="hidden"
                    id="audio-upload"
                  />
                  <label 
                    htmlFor="audio-upload"
                    className="flex-1 border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Upload className="w-5 h-5 text-zinc-400" />
                    <span className="text-xs text-zinc-400 font-medium">
                      {audioFile ? audioFile.name : 'Click to select audio file (> 1 min recommended)'}
                    </span>
                  </label>
                </div>
              </div>

              <button 
                onClick={handleCloneVoice}
                disabled={isCloning || !elevenLabsInput || !voiceName || !audioFile}
                className="w-full bg-gradient-to-r from-[#00d2ff] to-[#3a7bd5] hover:opacity-90 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all mt-2"
              >
                {isCloning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Cloning Voice...</>
                ) : (
                  <><Mic className="w-4 h-4" /> Start Cloning</>
                )}
              </button>

              {statusMsg.text && (
                <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${statusMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                  {statusMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                  <p>{statusMsg.text}</p>
                </div>
              )}
            </div>
          </div>
          
          {clonedVoices.length > 0 && (
            <>
              <div className="w-full h-px bg-white/5"></div>
              <div className="flex flex-col gap-3">
                <h3 className="text-white/90 text-sm font-medium">Your Cloned Voices</h3>
                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-2">
                  {clonedVoices.map(voice => (
                    <div key={voice.id} className="flex items-center justify-between bg-black/40 border border-white/5 rounded-lg p-3">
                      <span className="text-sm text-white/80">{voice.name}</span>
                      <span className="text-xs text-zinc-500 font-mono bg-black/40 px-2 py-1 rounded">{voice.id}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}
