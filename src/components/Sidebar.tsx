import { SHOT_LENGTH_LABEL } from '../shared/duration';
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
  /**
   * True when the main area is showing the setup workbench rather than a
   * workspace section.
   *
   * Without this the sidebar could only describe HALF the app's state: it
   * highlighted a Production Workspace item while the setup form was actually
   * on screen, so the selected item pointed at something the user was not
   * looking at.
   */
  isSetupView?: boolean;
}

/**
 * One Production Workspace navigation item.
 *
 * Extracted because six near-identical copies had to grow the same disabled
 * and active rules, and six copies of a rule is six chances to get it wrong.
 * The markup and classes are unchanged from the inline versions.
 */
const NavItem: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  isDisabled: boolean;
  disabledReason: string;
  onClick: () => void;
  badge?: React.ReactNode;
  tone?: 'default' | 'flow';
}> = ({ id, label, icon, isActive, isDisabled, disabledReason, onClick, badge, tone = 'default' }) => {
  const base =
    'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-left';

  const state = isDisabled
    ? 'text-slate-400 cursor-not-allowed font-medium'
    : isActive
    ? tone === 'flow'
      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold shadow-xs cursor-pointer'
      : 'bg-slate-100 text-slate-900 font-bold border border-slate-200 shadow-xs cursor-pointer'
    : tone === 'flow'
    ? 'text-emerald-800 hover:bg-slate-50 hover:text-emerald-950 font-medium cursor-pointer'
    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium cursor-pointer';

  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      disabled={isDisabled}
      aria-current={isActive ? 'page' : undefined}
      title={isDisabled ? disabledReason : label}
      className={`${base} ${state}`}
    >
      <div className={`flex items-center gap-2.5 ${isDisabled ? 'opacity-60' : ''}`}>
        {icon}
        <span>{label}</span>
      </div>
      {badge}
    </button>
  );
};

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
  isSetupView = false,
}) => {
  const charactersCount = story?.characters?.length || 0;
  const scenesCount = story?.scenes?.length || 0;

  const handleNavClick = (tab: StudioTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  // Every workspace section reads from a generated story. With none, there is
  // nothing to navigate to, so the items say so instead of accepting a click
  // that cannot change anything.
  const workspaceLocked = !hasActiveStory;
  const lockedReason = 'Generate a story first - this section opens once a story exists.';

  /** Highlighted only when this section is genuinely what is on screen. */
  const isTabActive = (tab: StudioTab) => hasActiveStory && !isSetupView && activeTab === tab;

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
              aria-current={isSetupView ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left ${
                isSetupView
                  ? 'bg-slate-100 text-slate-900 border border-slate-200 shadow-xs'
                  : 'text-slate-800 hover:bg-slate-100 hover:text-slate-950'
              }`}
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

            <NavItem
              id="sidebar-tab-story"
              label="Story Screenplay"
              icon={<BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />}
              isActive={isTabActive('story')}
              isDisabled={workspaceLocked}
              disabledReason={lockedReason}
              onClick={() => handleNavClick('story')}
            />

            <NavItem
              id="sidebar-tab-characters"
              label="Character Bible"
              icon={<Users className="w-4 h-4 text-amber-600 shrink-0" />}
              isActive={isTabActive('characters')}
              isDisabled={workspaceLocked}
              disabledReason={lockedReason}
              onClick={() => handleNavClick('characters')}
              badge={
                charactersCount > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-amber-800 border border-slate-200 font-bold">
                    {charactersCount}
                  </span>
                ) : undefined
              }
            />

            <NavItem
              id="sidebar-tab-references"
              label="Reference Studio"
              icon={<ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />}
              isActive={isTabActive('references')}
              isDisabled={workspaceLocked}
              disabledReason={lockedReason}
              onClick={() => handleNavClick('references')}
            />

            <NavItem
              id="sidebar-tab-scenes"
              label={`${SHOT_LENGTH_LABEL} Scene Planner`}
              icon={<Clapperboard className="w-4 h-4 text-orange-600 shrink-0" />}
              isActive={isTabActive('scenes')}
              isDisabled={workspaceLocked}
              disabledReason={lockedReason}
              onClick={() => handleNavClick('scenes')}
              badge={
                scenesCount > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-orange-800 border border-slate-200 font-bold">
                    {scenesCount}
                  </span>
                ) : undefined
              }
            />

            <NavItem
              id="sidebar-tab-flow"
              label="Flow Production"
              tone="flow"
              icon={<Video className="w-4 h-4 text-emerald-600 shrink-0" />}
              isActive={isTabActive('flow-production')}
              isDisabled={workspaceLocked}
              disabledReason={lockedReason}
              onClick={() => handleNavClick('flow-production')}
              badge={
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Veo
                </span>
              }
            />

            <NavItem
              id="sidebar-tab-checklist"
              label="Checklist & Report"
              icon={<CheckSquare className="w-4 h-4 text-amber-600 shrink-0" />}
              isActive={isTabActive('checklist')}
              isDisabled={workspaceLocked}
              disabledReason={lockedReason}
              onClick={() => handleNavClick('checklist')}
            />
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
              disabled={workspaceLocked}
              title={workspaceLocked ? lockedReason : 'Open the production package'}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors text-left ${
                workspaceLocked
                  ? 'text-slate-400 cursor-not-allowed opacity-60'
                  : 'text-slate-800 hover:bg-slate-100 hover:text-slate-950 cursor-pointer'
              }`}
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
              <span className="text-slate-900 font-bold">{story.scenes?.length || 0} (~{SHOT_LENGTH_LABEL})</span>
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
