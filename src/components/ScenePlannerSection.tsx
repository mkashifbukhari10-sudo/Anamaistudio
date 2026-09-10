import React, { useState } from 'react';
import { ScenePlannerItem, CharacterBibleEntry, VeggieStory } from '../types';
import {
  Clapperboard,
  Clock,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Camera,
  SunMedium,
  Music,
  Volume2,
  Layers,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  Eye,
  Activity,
  Box,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScenePlannerSectionProps {
  story: VeggieStory;
  scenes: ScenePlannerItem[];
  characters: CharacterBibleEntry[];
  onRegenerateAllScenes: () => Promise<void>;
  isRegeneratingAllScenes: boolean;
  onRegenerateSingleScene: (sceneNumber: number) => Promise<void>;
  regeneratingSceneNumber: number | null;
  onPlayPop?: () => void;
}

export const ScenePlannerSection: React.FC<ScenePlannerSectionProps> = ({
  story,
  scenes,
  characters,
  onRegenerateAllScenes,
  isRegeneratingAllScenes,
  onRegenerateSingleScene,
  regeneratingSceneNumber,
  onPlayPop,
}) => {
  const [expandedScenes, setExpandedScenes] = useState<Record<number, boolean>>({ 1: true });
  const [copiedPromptSceneId, setCopiedPromptSceneId] = useState<number | null>(null);
  const [copiedDialogueSceneId, setCopiedDialogueSceneId] = useState<number | null>(null);
  const [copiedFullSceneId, setCopiedFullSceneId] = useState<number | null>(null);
  const [copiedAllPrompts, setCopiedAllPrompts] = useState(false);
  const [activeTimelineScene, setActiveTimelineScene] = useState<number | null>(null);

  const toggleSceneExpand = (sceneNum: number) => {
    if (onPlayPop) onPlayPop();
    setExpandedScenes((prev) => ({
      ...prev,
      [sceneNum]: !prev[sceneNum],
    }));
  };

  const expandAll = () => {
    if (onPlayPop) onPlayPop();
    const allExpanded: Record<number, boolean> = {};
    scenes.forEach((s) => {
      allExpanded[s.sceneNumber] = true;
    });
    setExpandedScenes(allExpanded);
  };

  const collapseAll = () => {
    if (onPlayPop) onPlayPop();
    setExpandedScenes({});
  };

  const handleCopyScenePrompt = async (scene: ScenePlannerItem) => {
    if (onPlayPop) onPlayPop();
    try {
      await navigator.clipboard.writeText(scene.finalVideoPrompt);
      setCopiedPromptSceneId(scene.sceneNumber);
      setTimeout(() => setCopiedPromptSceneId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyDialogue = async (scene: ScenePlannerItem) => {
    if (onPlayPop) onPlayPop();
    try {
      await navigator.clipboard.writeText(scene.dialogue);
      setCopiedDialogueSceneId(scene.sceneNumber);
      setTimeout(() => setCopiedDialogueSceneId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyFullScene = async (scene: ScenePlannerItem) => {
    if (onPlayPop) onPlayPop();
    const text = `=== SCENE ${String(scene.sceneNumber).padStart(2, '0')} (${scene.timeRange} | ${scene.duration}) ===
Purpose: ${scene.purpose}
Summary: ${scene.visualDescription}
Characters Present: ${scene.charactersPresent.join(', ')}

1. PRIMARY VISUAL ACTION:
${scene.characterActions}

2. FACIAL EXPRESSIONS & EMOTIONS:
${scene.facialExpressions}

3. EXACT DIALOGUE (${story.language}):
${scene.dialogue}

4. CAMERA & LIGHTING:
- Shot: ${scene.cameraShot}
- Movement: ${scene.cameraMovement}
- Lighting: ${scene.lighting}

5. ENVIRONMENT & PROPS:
- Location: ${scene.environment}
- Props: ${scene.props}

6. AUDIO & SOUND FX:
- SFX: ${scene.soundEffects}
- Music Mood: ${scene.backgroundMusicMood}

7. CONTINUITY:
- From Previous: ${scene.continuityFromPrevious}
- Into Next: ${scene.continuityIntoNext}
- Character Bible Consistency: ${scene.characterConsistencyNotes}

8. FINAL VIDEO GENERATION PROMPT (English for Google Flow / Veo):
${scene.finalVideoPrompt}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedFullSceneId(scene.sceneNumber);
      setTimeout(() => setCopiedFullSceneId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyAllPrompts = async () => {
    if (onPlayPop) onPlayPop();
    const allPromptsText = scenes
      .map(
        (scene) =>
          `// --- SCENE ${String(scene.sceneNumber).padStart(2, '0')} (${scene.timeRange}) ---\n${scene.finalVideoPrompt}`
      )
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(allPromptsText);
      setCopiedAllPrompts(true);
      setTimeout(() => setCopiedAllPrompts(false), 2200);
    } catch {
      // Fallback
    }
  };

  const scrollToScene = (sceneNum: number) => {
    if (onPlayPop) onPlayPop();
    setActiveTimelineScene(sceneNum);
    setExpandedScenes((prev) => ({ ...prev, [sceneNum]: true }));
    const element = document.getElementById(`scene-card-${sceneNum}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getCharEmoji = (charName: string) => {
    const found = characters.find(
      (c) =>
        c.name.toLowerCase().includes(charName.toLowerCase()) ||
        charName.toLowerCase().includes(c.name.toLowerCase()) ||
        c.veggieType.toLowerCase().includes(charName.toLowerCase())
    );
    return found?.emoji || '🥕';
  };

  if (!scenes || scenes.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-7 border border-slate-200 space-y-4 sm:space-y-6 shadow-xs"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl">🎬</span>
            <h3 className="font-bold text-base sm:text-xl text-slate-900 flex flex-wrap items-center gap-2">
              <span>10-Second Scene Breakdown</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                {scenes.length} Production Shots
              </span>
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 font-medium">
            Each scene covers ~10 seconds with 1 primary visual action, strict Character Bible continuity, and ready Google Flow / Veo prompts.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Copy All Video Prompts */}
          <button
            type="button"
            id="copy-all-video-prompts-btn"
            onClick={handleCopyAllPrompts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            title="Copy all Google Flow/Veo video prompts"
          >
            {copiedAllPrompts ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>All Prompts Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All Prompts</span>
              </>
            )}
          </button>

          {/* Regenerate All Scenes */}
          <button
            type="button"
            id="regenerate-all-scenes-btn"
            disabled={isRegeneratingAllScenes}
            onClick={() => {
              if (onPlayPop) onPlayPop();
              onRegenerateAllScenes();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-300 shadow-2xs whitespace-nowrap"
            title="Regenerate all 10-second scene plans using locked character bible"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-700 ${
                isRegeneratingAllScenes ? 'animate-spin text-emerald-600' : ''
              }`}
            />
            <span>{isRegeneratingAllScenes ? 'Planning...' : 'Regenerate Scenes'}</span>
          </button>
        </div>
      </div>

      {/* Scene Timeline Visualizer */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
              Timeline: {scenes.length} Scenes • ~10s Each ({Math.floor((scenes.length * 10) / 60)}:{String((scenes.length * 10) % 60).padStart(2, '0')} Total)
            </h4>
            {scenes.length >= 20 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                Cinematic Long-Form Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={expandAll}
              className="text-[11px] font-mono font-bold text-slate-800 hover:text-slate-950 cursor-pointer"
            >
              Expand All
            </button>
            <span className="text-slate-600 font-bold">•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-[11px] font-mono font-bold text-slate-800 hover:text-slate-950 cursor-pointer"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Timeline Horizontal Track */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {scenes.map((scene, idx) => {
            const isSelected = activeTimelineScene === scene.sceneNumber;
            const isExpanded = !!expandedScenes[scene.sceneNumber];

            return (
              <button
                key={scene.sceneNumber || idx}
                type="button"
                onClick={() => scrollToScene(scene.sceneNumber)}
                className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-colors cursor-pointer border ${
                  isSelected || isExpanded
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-2xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200 shadow-2xs'
                }`}
                title={`Jump to Scene ${scene.sceneNumber}: ${scene.timeRange}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isSelected || isExpanded ? 'bg-emerald-800/40 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {scene.sceneNumber}
                </span>
                <span className="text-[11px]">{scene.timeRange}</span>
                <div className="flex items-center -space-x-1">
                  {scene.charactersPresent?.slice(0, 2).map((charName, i) => (
                    <span key={i} className="text-xs">
                      {getCharEmoji(charName)}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable Scene Cards List */}
      <div className="space-y-4">
        {scenes.map((scene, idx) => {
          const isExpanded = !!expandedScenes[scene.sceneNumber];
          const isRegenerating = regeneratingSceneNumber === scene.sceneNumber;
          const prevScene = idx > 0 ? scenes[idx - 1] : null;
          const isNewChapter =
            (scene.chapterNumber && scene.chapterNumber !== prevScene?.chapterNumber) ||
            (scene.chapterTitle && scene.chapterTitle !== prevScene?.chapterTitle);

          return (
            <React.Fragment key={scene.sceneNumber || idx}>
              {/* Chapter Header Banner if applicable */}
              {isNewChapter && (scene.chapterTitle || scene.chapterNumber) && (
                <div className="pt-3 pb-1">
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200">
                    <span className="text-lg">🎬</span>
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {scene.chapterNumber ? `Chapter ${scene.chapterNumber}` : 'Story Arc'}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                        {scene.chapterTitle || `Act ${scene.chapterNumber}`}
                      </h4>
                    </div>
                  </div>
                </div>
              )}

              <motion.div
                id={`scene-card-${scene.sceneNumber}`}
                layout
                className={`rounded-xl border transition-colors overflow-hidden ${
                  isExpanded
                    ? 'bg-white border-slate-300 ring-1 ring-emerald-500/20 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Card Summary Header (Always Visible) */}
                <div
                  onClick={() => toggleSceneExpand(scene.sceneNumber)}
                  className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Scene Badge & Time Range */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono font-bold text-xs border border-emerald-200 whitespace-nowrap">
                        <Clapperboard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Scene {String(scene.sceneNumber).padStart(2, '0')}</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs border border-slate-200 whitespace-nowrap">
                        <Clock className="w-3 h-3 text-slate-700 shrink-0" />
                        <span>{scene.timeRange}</span>
                      </span>

                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                        {scene.cameraShot || '10s Action Shot'}
                      </span>
                    </div>

                    {/* Short Summary */}
                    <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-snug break-words">
                      {scene.visualDescription}
                    </h4>

                    {/* Characters & Quick Dialogue Preview */}
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs text-slate-700 font-medium">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-800 whitespace-nowrap">Cast:</span>
                        <div className="flex flex-wrap items-center gap-1">
                          {scene.charactersPresent?.map((charName, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] border border-slate-200 whitespace-nowrap"
                            >
                              <span>{getCharEmoji(charName)}</span>
                              <span>{charName}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {scene.dialogue && scene.dialogue !== 'None / Visual Action' && (
                        <div className="flex items-center gap-1 text-emerald-700 italic max-w-md truncate">
                          <MessageSquare className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">"{scene.dialogue}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side controls */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <span className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 whitespace-nowrap">
                      {isExpanded ? 'Hide Specs' : 'View Full 20-Point Specs'}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </div>

                {/* Expanded Production Details (20 Structured Fields) */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border-t border-slate-200 bg-white p-3.5 sm:p-6 space-y-4 sm:space-y-6"
                    >
                      {/* 1. Final Video Generation Prompt (Hero Box) */}
                      <div className="p-3.5 sm:p-5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                            <h5 className="font-mono font-bold text-xs uppercase tracking-wider text-amber-800">
                              FINAL VIDEO GENERATION PROMPT (Google Flow / Veo Ready)
                            </h5>
                          </div>

                          <button
                            type="button"
                            id={`copy-scene-prompt-btn-${scene.sceneNumber}`}
                            onClick={() => handleCopyScenePrompt(scene)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                          >
                            {copiedPromptSceneId === scene.sceneNumber ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Scene Prompt</span>
                              </>
                            )}
                          </button>
                        </div>

                        <p className="text-xs sm:text-sm text-amber-950 leading-relaxed bg-white p-3 sm:p-3.5 rounded-lg border border-amber-200 font-mono select-all break-words">
                          {scene.finalVideoPrompt}
                        </p>

                        <div className="flex items-center gap-2 text-[11px] text-slate-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="break-words">
                            Production English prompt adhering to locked Character Bible, camera motion, and exact {story.language} dialogue.
                          </span>
                        </div>
                      </div>

                      {/* 2. Structured 2-Column Production Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Box A: Action, Movement & Expressions */}
                        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 border-b border-slate-200 pb-2">
                            <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>1. Action, Motion & Dialogue</span>
                          </div>

                          <div className="space-y-2.5 text-xs">
                            <div>
                              <span className="font-semibold text-slate-900 block">Primary Visual Action (10s):</span>
                              <p className="text-slate-800 mt-0.5 leading-relaxed break-words font-medium">{scene.characterActions}</p>
                            </div>

                            <div>
                              <span className="font-semibold text-slate-900 block">Facial Expressions & Emotions:</span>
                              <p className="text-slate-800 mt-0.5 leading-relaxed break-words font-medium">{scene.facialExpressions}</p>
                            </div>

                            {/* Dialogue Section: Multi-Character Conversation */}
                            <div className="p-2.5 rounded-lg bg-white border border-emerald-200 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-800 font-bold flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3 text-emerald-600" />
                                  <span>Conversation & Dialogue ({story.language}):</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyDialogue(scene)}
                                  className="text-[10px] font-mono font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded cursor-pointer transition-colors whitespace-nowrap border border-emerald-200"
                                >
                                  {copiedDialogueSceneId === scene.sceneNumber ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {scene.dialogueTurns && scene.dialogueTurns.length > 0 ? (
                                <div className="space-y-1.5 pt-1">
                                  {scene.dialogueTurns.map((turn, tIdx) => (
                                    <div key={tIdx} className="p-2 rounded-md bg-emerald-50/50 border border-emerald-100 space-y-1">
                                      <div className="flex items-center justify-between gap-1 text-[11px]">
                                        <span className="font-bold text-emerald-950 flex items-center gap-1">
                                          <span>{getCharEmoji(turn.speaker)}</span>
                                          <span>{turn.speaker}</span>
                                        </span>
                                        {turn.facialExpression && (
                                          <span className="text-[10px] font-medium text-emerald-700 italic">
                                            Face: {turn.facialExpression}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs font-semibold text-slate-900 italic">
                                        "{turn.line}"
                                      </p>
                                      {turn.accompanyingAction && (
                                        <span className="text-[10px] text-slate-600 font-medium block">
                                          Action: {turn.accompanyingAction}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs font-semibold text-emerald-900 italic break-words">
                                  "{scene.dialogue}"
                                </p>
                              )}
                            </div>

                            <div>
                              <span className="font-semibold text-slate-900 block">Animation Direction:</span>
                              <p className="text-slate-800 mt-0.5 break-words font-medium">{scene.animationDirection}</p>
                            </div>
                          </div>
                        </div>

                        {/* Box B: Camera, Environment & Sound */}
                        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-indigo-700 border-b border-slate-200 pb-2">
                            <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>2. Camera, Staging & Audio</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <div>
                              <span className="font-semibold text-slate-900 block">Camera Shot:</span>
                              <p className="text-slate-800 break-words font-medium">{scene.cameraShot}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">Camera Movement:</span>
                              <p className="text-slate-800 break-words font-medium">{scene.cameraMovement}</p>
                            </div>
                            <div className="sm:col-span-2">
                              <span className="font-semibold text-slate-900 block">Lighting Atmosphere:</span>
                              <p className="text-slate-800 break-words font-medium">{scene.lighting}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">Environment:</span>
                              <p className="text-slate-800 break-words font-medium">{scene.environment}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">Props:</span>
                              <p className="text-slate-800 break-words font-medium">{scene.props}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">Sound Effects:</span>
                              <p className="text-emerald-700 font-semibold break-words">{scene.soundEffects}</p>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">Music Mood:</span>
                              <p className="text-slate-800 break-words font-medium">{scene.backgroundMusicMood}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. Continuity & Character Consistency Box */}
                      <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider text-teal-700">
                            <Layers className="w-4 h-4 text-teal-600 shrink-0" />
                            <span>3. Continuous Shot-to-Shot Chain & Character Bible</span>
                          </div>

                          {scene.continuityIssues && scene.continuityIssues.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>{scene.continuityIssues.length} Continuity Note{scene.continuityIssues.length > 1 ? 's' : ''}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Shot-to-Shot Chained</span>
                            </span>
                          )}
                        </div>

                        {/* Shot-to-Shot Bridge: Start State -> Primary Action -> End State / Next Handoff */}
                        {(scene.startState || scene.endState || scene.nextSceneHandoff) && (
                          <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-200/80 space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-teal-900">
                              <span>🔗</span>
                              <span>Shot Transition Contract (No-Reset Animation Bridge):</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                              {scene.startState && (
                                <div className="p-2.5 rounded-lg bg-white border border-teal-100 space-y-0.5">
                                  <span className="font-bold text-teal-950 block text-[10px] uppercase tracking-wider">
                                    0.0s Start State (Inherits Scene {scene.sceneNumber > 1 ? scene.sceneNumber - 1 : 1}):
                                  </span>
                                  <p className="text-slate-800 leading-relaxed font-medium">{scene.startState}</p>
                                </div>
                              )}

                              {scene.endState && (
                                <div className="p-2.5 rounded-lg bg-white border border-teal-100 space-y-0.5">
                                  <span className="font-bold text-teal-950 block text-[10px] uppercase tracking-wider">
                                    10.0s End State (Carries to Scene {scene.sceneNumber + 1}):
                                  </span>
                                  <p className="text-slate-800 leading-relaxed font-medium">{scene.endState}</p>
                                </div>
                              )}
                            </div>

                            {scene.nextSceneHandoff && (
                              <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[11px] flex items-start gap-2">
                                <ArrowRight className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-emerald-950">Next Shot Handoff Directive: </span>
                                  <span className="text-emerald-900 font-medium">{scene.nextSceneHandoff}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Continuity Validation Issues & Auto-Correction Notes */}
                        {scene.continuityIssues && scene.continuityIssues.length > 0 && (
                          <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Continuity Validator Feedback:</span>
                            </div>
                            <div className="space-y-1">
                              {scene.continuityIssues.map((issue, iIdx) => (
                                <div key={iIdx} className="p-2 rounded bg-white border border-amber-200 text-[11px] text-slate-800 space-y-0.5">
                                  <div className="flex items-center gap-1 font-semibold text-amber-950">
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-mono">
                                      {issue.type}
                                    </span>
                                    <span>{issue.issue}</span>
                                  </div>
                                  {issue.suggestedFix && (
                                    <p className="text-emerald-800 text-[10px] font-medium">
                                      Fix applied: {issue.suggestedFix}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
                          <div className="p-3 rounded-lg bg-white border border-slate-200">
                            <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wide">
                              Continuity From Previous Scene:
                            </span>
                            <p className="text-slate-800 text-xs mt-1 break-words font-medium">{scene.continuityFromPrevious}</p>
                          </div>

                          <div className="p-3 rounded-lg bg-white border border-slate-200">
                            <span className="font-semibold text-slate-900 block text-[11px] uppercase tracking-wide">
                              Continuity Into Next Scene:
                            </span>
                            <p className="text-slate-800 text-xs mt-1 break-words font-medium">{scene.continuityIntoNext}</p>
                          </div>

                          <div className="p-3 rounded-lg bg-white border border-slate-200">
                            <span className="font-semibold text-emerald-800 block text-[11px] uppercase tracking-wide">
                              Character Bible Consistency:
                            </span>
                            <p className="text-emerald-900 text-xs mt-1 break-words">{scene.characterConsistencyNotes}</p>
                          </div>
                        </div>
                      </div>

                      {/* Card Bottom Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Copy Full Scene */}
                          <button
                            type="button"
                            onClick={() => handleCopyFullScene(scene)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                          >
                            {copiedFullSceneId === scene.sceneNumber ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Full Specs Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Full Scene Specs</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Regenerate Single Scene */}
                        <button
                          type="button"
                          id={`regenerate-scene-btn-${scene.sceneNumber}`}
                          disabled={isRegenerating}
                          onClick={() => {
                            if (onPlayPop) onPlayPop();
                            onRegenerateSingleScene(scene.sceneNumber);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-300 shadow-2xs"
                          title="Regenerate this specific 10s shot while preserving continuity"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              isRegenerating ? 'animate-spin text-emerald-600' : 'text-slate-700'
                            }`}
                          />
                          <span>{isRegenerating ? 'Regenerating...' : 'Regenerate Scene'}</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>
    </motion.div>
  );
};
