import React, { useState } from 'react';
import { VeggieStory, ScenePlannerItem, CharacterReferencePackage } from '../types';
import {
  Film,
  Copy,
  Check,
  Clapperboard,
  Sparkles,
  Volume2,
  Music,
  User,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FlowProductionModeProps {
  story: VeggieStory;
  onPlayPop?: () => void;
}

export const FlowProductionMode: React.FC<FlowProductionModeProps> = ({
  story,
  onPlayPop,
}) => {
  const [copiedPromptId, setCopiedPromptId] = useState<number | null>(null);
  const [copiedDialogueId, setCopiedDialogueId] = useState<number | null>(null);
  const [copiedFullSceneId, setCopiedFullSceneId] = useState<number | null>(null);
  const [copiedAllFlowPrompts, setCopiedAllFlowPrompts] = useState(false);
  const [selectedCharFilter, setSelectedCharFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRefModal, setSelectedRefModal] = useState<CharacterReferencePackage | null>(null);

  const scenes = story.scenes || [];
  const characters = story.characters || [];
  const references = story.characterReferences || [];

  // PART 19: Dynamically map character references for a scene
  const getRequiredReferencesForScene = (scene: ScenePlannerItem): CharacterReferencePackage[] => {
    if (!scene.charactersPresent || scene.charactersPresent.length === 0) {
      return [];
    }

    const matched: CharacterReferencePackage[] = [];
    scene.charactersPresent.forEach((charName) => {
      const charNameLower = charName.toLowerCase().trim();
      const ref = references.find((r) => {
        const refName = r.characterName.toLowerCase();
        const refVeggie = r.veggieType.toLowerCase();
        return (
          refName.includes(charNameLower) ||
          charNameLower.includes(refName) ||
          refVeggie.includes(charNameLower) ||
          charNameLower.includes(refVeggie)
        );
      });
      if (ref && !matched.some((m) => m.characterId === ref.characterId)) {
        matched.push(ref);
      }
    });

    return matched;
  };

  const handleCopyFlowPrompt = async (scene: ScenePlannerItem) => {
    if (onPlayPop) onPlayPop();
    try {
      await navigator.clipboard.writeText(scene.finalVideoPrompt);
      setCopiedPromptId(scene.sceneNumber);
      setTimeout(() => setCopiedPromptId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyDialogue = async (scene: ScenePlannerItem) => {
    if (onPlayPop) onPlayPop();
    try {
      await navigator.clipboard.writeText(scene.dialogue);
      setCopiedDialogueId(scene.sceneNumber);
      setTimeout(() => setCopiedDialogueId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyFullScene = async (scene: ScenePlannerItem) => {
    if (onPlayPop) onPlayPop();
    const reqRefs = getRequiredReferencesForScene(scene);
    const refNames = reqRefs.length > 0 ? reqRefs.map((r) => `${r.characterName} (${r.veggieType})`).join(', ') : 'None';

    const text = `=== ANAMSTUDIO FLOW PRODUCTION: SCENE ${String(scene.sceneNumber).padStart(2, '0')} ===
TIME: ${scene.timeRange} (${scene.duration})
CHARACTERS: ${scene.charactersPresent.join(', ')}
REQUIRED REFERENCES: ${refNames}

PRIMARY ACTION:
${scene.characterActions}

DIALOGUE (${story.language}):
${scene.dialogue}

CONTINUITY:
- From Previous: ${scene.continuityFromPrevious}
- Into Next: ${scene.continuityIntoNext}
- Visual Consistency: ${scene.characterConsistencyNotes}

AUDIO DIRECTION:
- Sound Effects: ${scene.soundEffects}
- Music Mood: ${scene.backgroundMusicMood}

FLOW / VEO PROMPT:
${scene.finalVideoPrompt}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedFullSceneId(scene.sceneNumber);
      setTimeout(() => setCopiedFullSceneId(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyAllFlowPrompts = async () => {
    if (onPlayPop) onPlayPop();
    const all = scenes
      .map(
        (s) =>
          `// === SCENE ${String(s.sceneNumber).padStart(2, '0')} (${s.timeRange}) | Flow / Veo Prompt ===\n${s.finalVideoPrompt}`
      )
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(all);
      setCopiedAllFlowPrompts(true);
      setTimeout(() => setCopiedAllFlowPrompts(false), 2200);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredScenes = scenes.filter((scene) => {
    if (selectedCharFilter !== 'ALL') {
      const match = scene.charactersPresent.some(
        (c) => c.toLowerCase().includes(selectedCharFilter.toLowerCase())
      );
      if (!match) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inAction = scene.characterActions.toLowerCase().includes(q);
      const inDialogue = scene.dialogue.toLowerCase().includes(q);
      const inPrompt = scene.finalVideoPrompt.toLowerCase().includes(q);
      const inSceneNum = String(scene.sceneNumber).includes(q);
      if (!inAction && !inDialogue && !inPrompt && !inSceneNum) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Studio Banner & Tool Header */}
      <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 text-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Film className="w-4 h-4" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
              <span>Google Flow Production Mode</span>
              <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider whitespace-nowrap">
                Production Assistant
              </span>
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-2xl">
            Pre-production workbench designed for seamless Google Flow and Veo generation. Each shot pairs exact visual prompt framing with locked character references, continuity state, and audio direction.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            id="copy-all-flow-btn"
            onClick={handleCopyAllFlowPrompts}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
          >
            {copiedAllFlowPrompts ? (
              <>
                <Check className="w-4 h-4" />
                <span>All {scenes.length} Prompts Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy All Flow Prompts ({scenes.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter & Quick Navigation Bar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-slate-800 font-semibold flex items-center gap-1 whitespace-nowrap">
            <Filter className="w-3.5 h-3.5 text-slate-700 shrink-0" /> Filter Cast:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCharFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg transition-colors font-semibold cursor-pointer whitespace-nowrap ${
              selectedCharFilter === 'ALL'
                ? 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
            }`}
          >
            All Scenes ({scenes.length})
          </button>
          {characters.map((char) => (
            <button
              key={char.id}
              type="button"
              onClick={() => setSelectedCharFilter(char.name)}
              className={`px-2.5 py-1 rounded-lg transition-colors font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                selectedCharFilter === char.name
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100'
              }`}
            >
              <span>{char.emoji || '🥕'}</span>
              <span>{char.name}</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-700 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dialogue, actions, prompts..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-slate-900 text-xs placeholder:text-slate-600 font-medium focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Production Scene Cards */}
      <div className="space-y-4">
        {filteredScenes.map((scene) => {
          const requiredRefs = getRequiredReferencesForScene(scene);

          return (
            <div
              key={scene.sceneNumber}
              id={`flow-scene-${scene.sceneNumber}`}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 transition-colors space-y-4 shadow-2xs"
            >
              {/* Scene Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-[11px] sm:text-xs font-bold text-slate-800 whitespace-nowrap">
                    SCENE {String(scene.sceneNumber).padStart(2, '0')}
                  </span>
                  <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-amber-50 border border-amber-200 font-mono text-[11px] sm:text-xs text-amber-800 font-semibold whitespace-nowrap">
                    ⏱ {scene.timeRange} ({scene.duration})
                  </span>
                  {scene.chapterTitle && (
                    <span className="text-xs text-slate-700 font-semibold hidden sm:inline">
                      Chapter: <span className="text-slate-900 font-bold">{scene.chapterTitle}</span>
                    </span>
                  )}
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyFlowPrompt(scene)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    title="Copy Google Flow / Veo Video Prompt"
                  >
                    {copiedPromptId === scene.sceneNumber ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied for Flow</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy for Flow</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyDialogue(scene)}
                    className="inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer border border-slate-200 shadow-2xs whitespace-nowrap"
                    title="Copy Dialogue"
                  >
                    {copiedDialogueId === scene.sceneNumber ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied Dialogue</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Dialogue</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyFullScene(scene)}
                    className="inline-flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-[11px] sm:text-xs font-bold transition-colors cursor-pointer border border-slate-200 shadow-2xs whitespace-nowrap"
                    title="Copy Full Scene Specification"
                  >
                    {copiedFullSceneId === scene.sceneNumber ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied Scene</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Full Scene</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Characters & Required Reference Mapping (PART 18 & 19) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 text-xs">
                {/* Characters Present */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                    <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Characters Present in Shot:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {scene.charactersPresent.map((name, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-200 font-medium whitespace-nowrap"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Required Character References */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Required Character Reference Assets:</span>
                  </div>
                  {requiredRefs.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {requiredRefs.map((ref) => (
                        <button
                          key={ref.characterId}
                          type="button"
                          onClick={() => setSelectedRefModal(ref)}
                          className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 font-medium flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>{ref.characterName} Reference</span>
                          <ExternalLink className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-700 italic">No specific character references needed for this shot.</p>
                  )}
                </div>
              </div>

              {/* Primary Action & Spoken Dialogue */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    Primary Action (10s Focus):
                  </span>
                  <p className="text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200 break-words font-medium">
                    {scene.characterActions}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    Spoken Dialogue ({story.language}):
                  </span>
                  <p className="text-slate-800 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium break-words">
                    {scene.dialogue ? `"${scene.dialogue}"` : <span className="text-slate-700 italic font-medium">Visual action only (No dialogue)</span>}
                  </p>
                </div>
              </div>

              {/* Continuity & Audio Direction */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 text-xs text-slate-800 font-medium">
                <div className="space-y-1">
                  <span className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    Continuity State:
                  </span>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1 text-[11px]">
                    <p className="break-words"><span className="text-slate-700 font-semibold">From Previous:</span> {scene.continuityFromPrevious}</p>
                    <p className="break-words"><span className="text-slate-700 font-semibold">Into Next:</span> {scene.continuityIntoNext}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    Audio Direction:
                  </span>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1 text-[11px]">
                    <p className="break-words"><span className="text-slate-700 font-semibold">SFX:</span> {scene.soundEffects || 'Subtle ambient foliage rustle'}</p>
                    <p className="break-words"><span className="text-slate-700 font-semibold">Music:</span> {scene.backgroundMusicMood || 'Gentle emotional melody'}</p>
                  </div>
                </div>
              </div>

              {/* Flow / Veo Final Prompt Container */}
              <div className="space-y-1.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                  <span className="text-emerald-700 font-semibold uppercase tracking-wider text-[10px] sm:text-[11px] flex items-center gap-1.5 whitespace-nowrap">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Google Flow / Veo Video Generation Prompt</span>
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-700 font-bold font-mono whitespace-nowrap">
                    Professional English • Locked Style
                  </span>
                </div>
                <div className="relative group">
                  <pre className="w-full bg-amber-50/50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-3.5 text-amber-950 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto select-all break-words font-medium">
                    {scene.finalVideoPrompt}
                  </pre>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Character Reference Preview Modal */}
      <AnimatePresence>
        {selectedRefModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-[10px] sm:p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl text-slate-900 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  <h4 className="font-bold text-base text-slate-900">
                    {selectedRefModal.characterName} ({selectedRefModal.veggieType}) Reference
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRefModal(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-800 font-bold block mb-1">Full-Body Reference Prompt:</span>
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 whitespace-pre-wrap font-mono text-[11px] font-medium">
                    {selectedRefModal.fullBodyPrompt}
                  </pre>
                </div>

                <div>
                  <span className="text-slate-800 font-bold block mb-1">Flow / Veo Consistency Instructions:</span>
                  <p className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 font-medium leading-relaxed">
                    {selectedRefModal.flowVeoInstructions}
                  </p>
                </div>

                <div>
                  <span className="text-slate-800 font-bold block mb-1">Negative / Avoid Instructions:</span>
                  <pre className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 whitespace-pre-wrap font-mono text-[11px] font-medium">
                    {selectedRefModal.negativePrompt}
                  </pre>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
