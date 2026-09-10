import React from 'react';
import {
  Film,
  PlusCircle,
  Lightbulb,
  Users,
  Image as ImageIcon,
  Clapperboard,
  Video,
  Package,
  CheckSquare,
  Sparkles,
  X,
  BookOpen,
} from 'lucide-react';
import { StudioTab, VeggieStory } from '../types';

interface SidebarProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  onNewStory: () => void;
  onOpenIdeas: () => void;
  onOpenExportPackage: () => void;
  hasActiveStory: boolean;
  story: VeggieStory | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLoadSampleStory?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onNewStory,
  onOpenIdeas,
  onOpenExportPackage,
  hasActiveStory,
  story,
  isOpenMobile,
  onCloseMobile,
  onLoadSampleStory,
}) => {
  const charactersCount = story?.characters?.length || 0;
  const scenesCount = story?.scenes?.length || 0;

  const handleNavClick = (tab: StudioTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 lg:top-16 bottom-0 lg:bottom-auto left-0 z-50 lg:z-20 w-64 lg:h-[calc(100vh-4rem)] lg:self-start lg:shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between transform transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
          {/* Studio Brand Header + Mobile Close */}
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 shadow-xs text-white">
                <Film className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tight text-slate-900 flex items-center gap-1">
                  <span>ANAM</span>
                  <span className="text-emerald-600">STUDIO</span>
                </h1>
                <p className="text-[10px] text-slate-700 font-mono uppercase tracking-wider font-semibold">
                  AI Pre-Production
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section: CREATE */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
              Create & Ideas
            </span>
            <button
              type="button"
              id="sidebar-new-story-btn"
              onClick={() => {
                onNewStory();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 hover:text-slate-950 transition-colors cursor-pointer text-left"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>New Story Setup</span>
            </button>

            <button
              type="button"
              id="sidebar-ideas-btn"
              onClick={() => {
                onOpenIdeas();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 hover:text-slate-950 transition-colors cursor-pointer text-left"
            >
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Story Ideas & Prompts</span>
            </button>

            {onLoadSampleStory && (
              <button
                type="button"
                id="sidebar-sample-story-btn"
                onClick={() => {
                  onLoadSampleStory();
                  onCloseMobile();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer text-left"
                title="Load 10-Minute 'Gajar aur Tamatar ki Dosti' Master Story (5 characters, 60 scenes)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Load 10m Master Demo</span>
              </button>
            )}
          </div>

          {/* Section: PRODUCTION WORKSPACE */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                Production Workspace
              </span>
              {hasActiveStory ? (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  Active
                </span>
              ) : (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                  Ready
                </span>
              )}
            </div>

            <button
              type="button"
              id="sidebar-tab-story"
              onClick={() => handleNavClick('story')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'story'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Story Screenplay</span>
              </div>
            </button>

            <button
              type="button"
              id="sidebar-tab-characters"
              onClick={() => handleNavClick('characters')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'characters'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Character Bible</span>
              </div>
              {charactersCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-amber-800 border border-slate-200 font-bold">
                  {charactersCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="sidebar-tab-references"
              onClick={() => handleNavClick('references')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'references'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Reference Studio</span>
              </div>
            </button>

            <button
              type="button"
              id="sidebar-tab-scenes"
              onClick={() => handleNavClick('scenes')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'scenes'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Clapperboard className="w-4 h-4 text-orange-600 shrink-0" />
                <span>10s Scene Planner</span>
              </div>
              {scenesCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-orange-800 border border-slate-200 font-bold">
                  {scenesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              id="sidebar-tab-flow"
              onClick={() => handleNavClick('flow-production')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'flow-production'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold shadow-xs'
                  : 'text-emerald-800 hover:bg-slate-50 hover:text-emerald-950 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Video className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Flow Production</span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                Veo
              </span>
            </button>

            <button
              type="button"
              id="sidebar-tab-checklist"
              onClick={() => handleNavClick('checklist')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-left ${
                activeTab === 'checklist'
                  ? 'bg-slate-100 text-slate-900 font-bold border border-slate-200 shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Checklist & Report</span>
              </div>
            </button>
          </div>

          {/* Section: EXPORT */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
              Export Production
            </span>
            <button
              type="button"
              id="sidebar-export-package-btn"
              onClick={() => {
                onOpenExportPackage();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 hover:text-slate-950 transition-colors cursor-pointer text-left"
            >
              <Package className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Production Package</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer Stats */}
        {hasActiveStory && story ? (
          <div className="p-4 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-800 space-y-1.5 font-medium">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-slate-700 font-bold">PROJECT</span>
              <span className="text-emerald-800 font-bold truncate max-w-[130px]" title={story.title}>
                {story.title}
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-slate-700 font-bold">DURATION</span>
              <span className="text-slate-900 font-bold">{story.duration}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="text-slate-700 font-bold">SCENES</span>
              <span className="text-slate-900 font-bold">{story.scenes?.length || 0} (~10s)</span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-700 font-bold text-center">
            <p className="font-mono text-[10px]">ANAMSTUDIO v2.0</p>
          </div>
        )}
      </aside>
    </>
  );
};
