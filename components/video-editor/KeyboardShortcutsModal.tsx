'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Keyboard, X } from 'lucide-react';

type KeyboardShortcutsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const shortcuts = [
    { key: 'Space', description: 'Play / Pause Preview' },
    { key: 'M', description: 'Mute / Unmute Video' },
    { key: 'C', description: 'Toggle Subtitles (CC)' },
    { key: 'F', description: 'Toggle Fullscreen' },
    { key: 'Ctrl + S', description: 'Save Preferences' },
    { key: 'Del / Backspace', description: 'Delete Selected Item in Timeline' },
    { key: '+', description: 'Add New Subtitle' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-[#00d2ff]" /> Keyboard Shortcuts
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-2 overflow-y-auto max-h-[70vh]">
          {shortcuts.map((sc, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-sm text-zinc-300">{sc.description}</span>
              <span className="bg-black/50 border border-white/10 text-white/90 text-xs px-2 py-1 rounded-md font-mono shadow-sm">
                {sc.key}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
