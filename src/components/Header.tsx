import React from 'react';
import {
  Film,
  Volume2,
  VolumeX,
  Package,
  PlusCircle,
  Menu,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenMobileSidebar?: () => void;
  hasActiveStory?: boolean;
  onOpenExportPackage?: () => void;
  onNewStory?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  soundEnabled,
  onToggleSound,
  onOpenMobileSidebar,
  hasActiveStory = false,
  onOpenExportPackage,
  onNewStory,
}) => {
  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
      <div className="max-w-7xl mx-auto px-[10px] sm:px-6 py-2.5 sm:py-3 min-h-[64px] flex items-center justify-between">
        {/* Mobile menu trigger + Brand */}
        <div className="flex items-center gap-3">
          {onOpenMobileSidebar && (
            <button
              type="button"
              onClick={onOpenMobileSidebar}
              className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 lg:hidden cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 text-white shadow-xs">
              <Film className="w-4 h-4 text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-slate-900">
                  ANAM<span className="text-emerald-600">STUDIO</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  AI Pre-Production
                </span>
              </div>
              <p className="text-[11px] text-slate-700 hidden sm:block font-medium">
                AI Story Director & Animation Pre-Production Studio
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {hasActiveStory && onNewStory && (
            <button
              type="button"
              onClick={onNewStory}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>New Story</span>
            </button>
          )}

          {hasActiveStory && onOpenExportPackage && (
            <button
              type="button"
              id="header-export-package-btn"
              onClick={onOpenExportPackage}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              title="Export complete animation production package"
            >
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Package</span>
              <span className="sm:hidden">Export</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute audio' : 'Enable audio'}
            className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:text-slate-900'
            }`}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <span className="hidden md:inline font-mono text-[11px]">Audio On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-600" />
                <span className="hidden md:inline font-mono text-[11px]">Muted</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
