'use client';

import { useState } from 'react';
import MediaLibrary from '@/components/video-editor/MediaLibrary';
import VideoPlayer from '@/components/video-editor/VideoPlayer';
import SubtitleEditor from '@/components/video-editor/SubtitleEditor';
import AudioFXPanel from '@/components/video-editor/AudioFXPanel';
import TimelineEditor from '@/components/video-editor/TimelineEditor';
import BRollPanel from '@/components/video-editor/BRollPanel';
import { VideoEditorProvider, useVideoEditor } from '@/lib/VideoEditorContext';

function SettingsDropdown({ 
  openDropdown, 
  toggleDropdown, 
  resetLayout,
  openPreferences,
  openShortcuts
}: { 
  openDropdown: string | null; 
  toggleDropdown: (m: string) => void;
  resetLayout: () => void;
  openPreferences: () => void;
  openShortcuts: () => void;
}) {
  const { exportMode, setExportMode, exportDirHandle, setExportDirHandle } = useVideoEditor();

  return (
    <div className="relative">
      <button 
        onClick={(e) => { e.stopPropagation(); toggleDropdown('settings'); }}
        className={`text-sm font-medium hover:text-[#00d2ff] transition-colors ${openDropdown === 'settings' ? 'text-[#00d2ff]' : 'text-zinc-400'}`}
      >
        Settings
      </button>
      {openDropdown === 'settings' && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-xl shadow-2xl py-1 overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={() => setExportMode(exportMode === 'merge' ? 'separate' : 'merge')}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800/50 transition-colors flex justify-between items-center"
          >
            <span>Batch Export</span>
            <span className="text-[#00d2ff] text-xs bg-[#00d2ff]/10 px-2 py-0.5 rounded-full border border-[#00d2ff]/20">
              {exportMode === 'merge' ? 'Merge All' : 'Separate'}
            </span>
          </button>
          
          <button 
            onClick={async () => {
              try {
                if ('showDirectoryPicker' in window) {
                  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
                  setExportDirHandle(dirHandle);
                  alert(`ប្តូរទីតាំង Export ទៅកាន់: ${dirHandle.name}`);
                } else {
                  alert('កម្មវិធីរុករករបស់អ្នកមិនគាំទ្រការជ្រើសរើស Folder ទេ។');
                }
              } catch (e) {
                console.log('User cancelled directory picker');
              }
              toggleDropdown('settings');
            }}
            className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800/50 transition-colors flex justify-between items-center"
          >
            <span>Export Location</span>
            <span className="text-zinc-400 text-xs">
              {exportDirHandle ? exportDirHandle.name : 'Change Folder'}
            </span>
          </button>

          <div className="border-t border-zinc-800 my-1"></div>
          <button onClick={() => { openPreferences(); toggleDropdown('settings'); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800/50 transition-colors">Preferences</button>
          <button onClick={() => { openShortcuts(); toggleDropdown('settings'); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800/50 transition-colors">Keyboard Shortcuts</button>
          <div className="border-t border-zinc-800 my-1"></div>
          <button onClick={resetLayout} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-500/10 transition-colors text-[#ff6b6b]">Reset Layout</button>
        </div>
      )}
    </div>
  );
}

import PreferencesModal from '@/components/video-editor/PreferencesModal';
import KeyboardShortcutsModal from '@/components/video-editor/KeyboardShortcutsModal';
import { useEffect } from 'react';

export default function StudioPage() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [showMediaLibrary, setShowMediaLibrary] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const toggleDropdown = (menu: string) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
    setOpenDropdown(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFullscreen();
      } else if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsPreferencesOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const resetLayout = () => {
    setShowMediaLibrary(true);
    setShowTimeline(true);
    setOpenDropdown(null);
  };

  // Dynamic grid template depending on what is shown
  let gridCols = "grid-cols-1 ";
  if (showMediaLibrary) {
    gridCols += "lg:grid-cols-[300px_1fr_1fr]";
  } else {
    gridCols += "lg:grid-cols-[1fr_1fr]";
  }

  return (
    <VideoEditorProvider>
      <PreferencesModal isOpen={isPreferencesOpen} onClose={() => setIsPreferencesOpen(false)} />
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <main className="h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900 via-[#0a0a0a] to-black p-4 font-sans text-white" onClick={() => setOpenDropdown(null)}>
        {/* Top Navbar */}
        <nav className="flex items-center justify-between mb-6 px-2 relative z-50">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-[#00d2ff] via-[#8a2be2] to-[#ff00cc] drop-shadow-[0_0_15px_rgba(0,210,255,0.5)] hover:scale-105 transition-transform cursor-pointer">
              MesaIT
            </h1>
            
            {/* View Menu */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); toggleDropdown('view'); }}
                className={`text-sm font-medium hover:text-[#00d2ff] transition-colors ${openDropdown === 'view' ? 'text-[#00d2ff]' : 'text-zinc-400'}`}
              >
                View
              </button>
              {openDropdown === 'view' && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-xl shadow-2xl py-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setShowMediaLibrary(!showMediaLibrary)} 
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800/50 transition-colors flex justify-between items-center"
                  >
                    <span>Media Library</span> <span className="text-[#00d2ff]">{showMediaLibrary ? '✓' : ''}</span>
                  </button>
                  <button 
                    onClick={() => setShowTimeline(!showTimeline)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800/50 transition-colors flex justify-between items-center"
                  >
                    <span>Timeline</span> <span className="text-[#00d2ff]">{showTimeline ? '✓' : ''}</span>
                  </button>
                  <div className="border-t border-zinc-800 my-1"></div>
                  <button onClick={handleFullscreen} className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800/50 transition-colors">Enter Fullscreen</button>
                </div>
              )}
            </div>

            {/* Settings Menu */}
            <SettingsDropdown 
              openDropdown={openDropdown} 
              toggleDropdown={toggleDropdown} 
              resetLayout={resetLayout} 
              openPreferences={() => setIsPreferencesOpen(true)}
              openShortcuts={() => setIsShortcutsOpen(true)}
            />
          </div>
        </nav>

        <div className="max-w-[1600px] mx-auto flex flex-col gap-6 h-[calc(100vh-100px)]">
          {/* Main Grid Layout */}
          <div className={`grid gap-6 transition-all duration-300 ${gridCols} flex-1 min-h-0`}>
            
            {/* Column 1: Media Library */}
            {showMediaLibrary && (
              <div className="flex flex-col h-full min-h-0">
                <MediaLibrary />
              </div>
            )}

            {/* Column 2: Video Player, Audio FX & B-Roll */}
            <div className="flex flex-col gap-4 h-full min-h-0">
              <div className="shrink-0 w-full flex flex-col h-[50%] min-h-[350px]">
                <VideoPlayer />
              </div>
              <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-2">
                <div className="shrink-0">
                  <AudioFXPanel />
                </div>
                <div className="shrink-0 flex flex-col min-h-[250px]">
                  <BRollPanel />
                </div>
              </div>
            </div>

            {/* Column 3: Subtitle Editor */}
            <div className="flex flex-col h-full min-h-0">
              <SubtitleEditor />
            </div>

          </div>

          {/* Bottom Row: Timeline Editor */}
          {showTimeline && (
            <div className="w-full shrink-0">
              <TimelineEditor />
            </div>
          )}
        </div>
      </main>
    </VideoEditorProvider>
  );
}