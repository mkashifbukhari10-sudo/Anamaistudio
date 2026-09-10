import React, { useState, useEffect } from 'react';
import { VeggieStory, CharacterBibleEntry, StudioTab } from '../types';
import { createSpeechNarration } from '../utils/audio';
import { CharacterBibleSection } from './CharacterBibleSection';
import { CharacterReferenceStudio } from './CharacterReferenceStudio';
import { ScenePlannerSection } from './ScenePlannerSection';
import { FlowProductionMode } from './FlowProductionMode';
import { ProductionChecklistSection } from './ProductionChecklistSection';
import { ProductionPackageModal } from './ProductionPackageModal';
import {
  Sparkles,
  Volume2,
  Square,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Award,
  HelpCircle,
  Clock,
  Layers,
  Printer,
  Clapperboard,
  Package,
  Users,
  Image as ImageIcon,
  Video,
  CheckSquare,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StoryDisplayProps {
  story: VeggieStory;
  onReset: () => void;
  onPlaySuccess?: () => void;
  onPlayPop?: () => void;
  soundEnabled: boolean;
  activeStudioTab?: StudioTab;
  onSelectStudioTab?: (tab: StudioTab) => void;
  onUpdateCharacters?: (characters: CharacterBibleEntry[]) => void;
  onRegenerateCharacters: () => Promise<void>;
  isRegeneratingCharacters: boolean;
  onRegenerateAllScenes: () => Promise<void>;
  isRegeneratingAllScenes: boolean;
  onRegenerateSingleScene: (sceneNumber: number) => Promise<void>;
  regeneratingSceneNumber: number | null;
  onRegenerateAllReferences?: () => Promise<void>;
  isRegeneratingAllReferences?: boolean;
  onRegenerateSingleReference?: (characterId: string) => Promise<void>;
  regeneratingReferenceCharId?: string | null;
  onGenerateCharacterImage?: (characterId: string, prompt: string) => Promise<void>;
  generatingImageCharacterId?: string | null;
}

export const StoryDisplay: React.FC<StoryDisplayProps> = ({
  story,
  onReset,
  onPlaySuccess,
  onPlayPop,
  soundEnabled,
  activeStudioTab = 'story',
  onSelectStudioTab,
  onUpdateCharacters,
  onRegenerateCharacters,
  isRegeneratingCharacters,
  onRegenerateAllScenes,
  isRegeneratingAllScenes,
  onRegenerateSingleScene,
  regeneratingSceneNumber,
  onRegenerateAllReferences,
  isRegeneratingAllReferences = false,
  onRegenerateSingleReference,
  regeneratingReferenceCharId = null,
  onGenerateCharacterImage,
  generatingImageCharacterId = null,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [localActiveTab, setLocalActiveTab] = useState<StudioTab>(activeStudioTab);
  const [speechEngine] = useState(() => createSpeechNarration());
  const [allLocked, setAllLocked] = useState<boolean>(story.charactersLocked ?? true);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [storyReadingView, setStoryReadingView] = useState<'screenplay' | 'chapters'>('screenplay');

  useEffect(() => {
    setLocalActiveTab(activeStudioTab);
  }, [activeStudioTab]);

  const handleTabChange = (tab: StudioTab) => {
    setLocalActiveTab(tab);
    if (onSelectStudioTab) {
      onSelectStudioTab(tab);
    }
    if (onPlayPop) onPlayPop();
  };

  useEffect(() => {
    if (onPlaySuccess && soundEnabled) {
      onPlaySuccess();
    }
    return () => {
      speechEngine.stop();
    };
  }, []);

  const handleToggleAllLock = () => {
    const nextState = !allLocked;
    setAllLocked(nextState);
    if (onUpdateCharacters) {
      const updated = story.characters.map((c) => ({
        ...c,
        isLocked: nextState,
      }));
      onUpdateCharacters(updated);
    }
  };

  const handleToggleCharacterLock = (id: string) => {
    if (onUpdateCharacters) {
      const updated = story.characters.map((c) => {
        if (c.id === id) {
          const currentLock = c.isLocked ?? allLocked;
          return { ...c, isLocked: !currentLock };
        }
        return c;
      });
      onUpdateCharacters(updated);
      const anyUnlocked = updated.some((c) => c.isLocked === false);
      setAllLocked(!anyUnlocked);
    }
  };

  const handleCopy = async () => {
    const bibleSummary = story.characters
      .map(
        (c) =>
          `• ${c.emoji || '🥕'} ${c.name} (${c.veggieType} - ${c.role} [${c.importance || 'MAIN'}]):\n  - Locked Visual Identity: "${c.lockedVisualDescription}"\n  - Wardrobe: ${c.clothing}, Shoes: ${c.shoes}\n  - Personality: ${c.personality}`
      )
      .join('\n\n');

    const scenesSummary = (story.scenes || [])
      .map(
        (s) =>
          `[Scene ${String(s.sceneNumber).padStart(2, '0')} | ${s.timeRange}]: ${s.characterActions}\nDialogue: "${s.dialogue}"\nPrompt: ${s.finalVideoPrompt}`
      )
      .join('\n\n');

    const formattedText = `🌟 ${story.title} 🌟
${story.tagline ? `(${story.tagline})\n` : ''}
Language: ${story.language} | Duration: ${story.duration} | Style: ${story.animationStyle || 'Cute 3D'}

🥕 DYNAMIC CAST & CHARACTER BIBLE:
${bibleSummary}

🎬 10-SECOND PRODUCTION SCENES (${story.scenes?.length || 0} Scenes):
${scenesSummary}

📖 FULL STORY SCREENPLAY:
${story.fullStoryText}

🌈 MORAL / LESSON:
${story.moral}

${story.funQuestion ? `💡 DISCUSSION QUESTION:\n${story.funQuestion}\n` : ''}
--- Generated with AnamStudio ---`;

    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleToggleNarration = () => {
    if (isPlayingAudio) {
      speechEngine.stop();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      const textToRead = `${story.title}. ${story.fullStoryText}. Sabak: ${story.moral}`;
      speechEngine.speak(textToRead, story.language, () => {
        setIsPlayingAudio(false);
      });
    }
  };

  const isRtl = story.language === 'Urdu';
  const charCount = story.characters?.length || 0;
  const scenesCount = story.scenes?.length || 0;

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Studio Project Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-white border border-slate-200 text-slate-800 p-3.5 sm:p-6 lg:p-7 shadow-xs"
      >
        <div className="relative z-10 space-y-3.5 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>{story.language}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold font-mono whitespace-nowrap">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{story.duration}</span>
              </span>

              {story.storyMode && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold whitespace-nowrap">
                  <Clapperboard className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{story.storyMode}</span>
                </span>
              )}

              {story.animationStyle && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium whitespace-nowrap">
                  <Layers className="w-3.5 h-3.5 text-purple-600" />
                  <span>{story.animationStyle}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-mono whitespace-nowrap">
                <span>{scenesCount} Scenes (~10s)</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold font-mono whitespace-nowrap">
                <span>{charCount} Characters</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                id="banner-export-package-btn"
                onClick={() => setIsPackageModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                title="Export complete animation production package"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Export Package</span>
              </button>

              <button
                type="button"
                onClick={handleToggleNarration}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border whitespace-nowrap ${
                  isPlayingAudio
                    ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                }`}
              >
                {isPlayingAudio ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Voice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Narrate</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                title="Copy Story Script, Bible & Scenes"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div dir={isRtl ? 'rtl' : 'ltr'}>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-slate-900 leading-snug break-words">
              {story.title}
            </h2>
            {story.tagline && (
              <p className="mt-1 text-slate-700 text-xs sm:text-sm font-semibold">
                {story.tagline}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Studio Workspace Tab Navigation Bar */}
      <div className="flex items-center overflow-x-auto no-scrollbar gap-1 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-white border border-slate-200 text-xs shadow-2xs">
        <button
          type="button"
          onClick={() => handleTabChange('story')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 text-xs ${
            localActiveTab === 'story'
              ? 'bg-slate-100 text-slate-900 shadow-2xs border border-slate-300 font-bold'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-50 font-semibold'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-600" />
          <span>Screenplay & Story</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('characters')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 text-xs ${
            localActiveTab === 'characters'
              ? 'bg-slate-100 text-slate-900 shadow-2xs border border-slate-300 font-bold'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-50 font-semibold'
          }`}
        >
          <Users className="w-4 h-4 text-amber-600" />
          <span>Cast & Bible ({charCount})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('references')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 text-xs ${
            localActiveTab === 'references'
              ? 'bg-slate-100 text-slate-900 shadow-2xs border border-slate-300 font-bold'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-50 font-semibold'
          }`}
        >
          <ImageIcon className="w-4 h-4 text-emerald-600" />
          <span>Reference Studio</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('scenes')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 text-xs ${
            localActiveTab === 'scenes'
              ? 'bg-slate-100 text-slate-900 shadow-2xs border border-slate-300 font-bold'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-50 font-semibold'
          }`}
        >
          <Clapperboard className="w-4 h-4 text-orange-600" />
          <span>10s Scene Planner ({scenesCount})</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('flow-production')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 text-xs ${
            localActiveTab === 'flow-production'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs'
              : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50/50'
          }`}
        >
          <Video className="w-4 h-4 text-emerald-600" />
          <span>Flow Production Mode</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[10px] font-mono font-semibold text-emerald-800 border border-emerald-200">
            Veo
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('checklist')}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 text-xs ${
            localActiveTab === 'checklist'
              ? 'bg-slate-100 text-slate-900 shadow-2xs border border-slate-300 font-bold'
              : 'text-slate-700 hover:text-slate-950 hover:bg-slate-50 font-semibold'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-amber-600" />
          <span>Checklist & Report</span>
        </button>
      </div>

      {/* Main Studio Viewport Content */}
      <div className="space-y-4 sm:space-y-6">
        {/* Tab 1: Screenplay & Full Story */}
        {localActiveTab === 'story' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Cinematic Chapters Preview (If Long-form / chapters present) */}
            {story.chapters && story.chapters.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
                      Cinematic Chapter Structure ({story.chapters.length} Acts)
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-700 font-semibold whitespace-nowrap">
                    Narrative Arc Outline
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  {story.chapters.map((chap, i) => (
                    <div
                      key={i}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 font-semibold">
                        <span className="font-bold text-emerald-700">
                          {chap.actNumber || `ACT ${String(i + 1).padStart(2, '0')}`}
                        </span>
                        <span className="text-amber-700 font-semibold">{chap.targetScenes || 'Scenes'}</span>
                      </div>
                      <h5 className="font-bold text-xs text-slate-900 leading-snug">
                        {chap.title}
                      </h5>
                      <p className="text-[11.5px] text-slate-700 leading-relaxed font-medium">
                        {chap.narrativeFocus}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Screenplay Text Card */}
            <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-7 lg:p-8 space-y-4 sm:space-y-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 sm:pb-4 gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    Screenplay & Narration Script
                  </h3>
                </div>

                <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                  <button
                    type="button"
                    onClick={() => setStoryReadingView('screenplay')}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
                      storyReadingView === 'screenplay'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Full Script
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoryReadingView('chapters')}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
                      storyReadingView === 'chapters'
                        ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Section Beats
                  </button>
                </div>
              </div>

              {/* Narrative Content */}
              <div dir={isRtl ? 'rtl' : 'ltr'} className={isRtl ? 'font-serif text-right' : 'text-left'}>
                {storyReadingView === 'screenplay' ? (
                  <div className="space-y-3 sm:space-y-4 text-sm sm:text-base leading-relaxed text-slate-800">
                    {story.fullStoryText.split('\n\n').map((para, i) => {
                      if (!para.trim()) return null;
                      return (
                        <p
                          key={i}
                          className="p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 leading-relaxed break-words"
                        >
                          {para}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {story.storySections.map((sec, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                      >
                        <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          <span>{sec.title}</span>
                        </div>
                        <p className="text-sm sm:text-base leading-relaxed text-slate-800 break-words">
                          {sec.content}
                        </p>

                        {sec.scenePromptHint && (
                          <div className="mt-3 p-2.5 sm:p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                            <Clapperboard className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-amber-800 uppercase tracking-wide text-[10px] block">
                                Visual Hint:
                              </span>
                              <p className="font-mono text-[11px] text-amber-900 break-words">{sec.scenePromptHint}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Moral Card */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 flex items-start gap-3 sm:gap-4 shadow-2xs">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="space-y-1 min-w-0 flex-1" dir={isRtl ? 'rtl' : 'ltr'}>
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-800">
                  Moral & Positive Life Lesson
                </h4>
                <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed break-words">
                  {story.moral}
                </p>
              </div>
            </div>

            {/* Interactive Discussion Question */}
            {story.funQuestion && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 flex items-start gap-3 sm:gap-4 shadow-2xs">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="space-y-1 min-w-0 flex-1" dir={isRtl ? 'rtl' : 'ltr'}>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-800">
                    Discussion Question for Kids
                  </h4>
                  <p className="text-sm sm:text-base font-semibold text-slate-900 leading-relaxed break-words">
                    {story.funQuestion}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Cast & Bible */}
        {localActiveTab === 'characters' && (
          <CharacterBibleSection
            characters={story.characters}
            allLocked={allLocked}
            onToggleAllLock={handleToggleAllLock}
            onToggleCharacterLock={handleToggleCharacterLock}
            onRegenerateCharacters={onRegenerateCharacters}
            isRegeneratingCharacters={isRegeneratingCharacters}
            onPlayPop={onPlayPop}
          />
        )}

        {/* Tab 3: Character Reference Studio */}
        {localActiveTab === 'references' && (
          <CharacterReferenceStudio
            characters={story.characters}
            characterReferences={story.characterReferences}
            animationStyle={story.animationStyle}
            onRegenerateAllReferences={onRegenerateAllReferences}
            onRegenerateSingleReference={onRegenerateSingleReference}
            onGenerateCharacterImage={onGenerateCharacterImage}
            onOpenProductionPackage={() => setIsPackageModalOpen(true)}
            isRegeneratingAll={isRegeneratingAllReferences}
            regeneratingCharacterId={regeneratingReferenceCharId}
            generatingImageCharacterId={generatingImageCharacterId}
          />
        )}

        {/* Tab 4: 10-Second Scene Planner */}
        {localActiveTab === 'scenes' && (
          <ScenePlannerSection
            story={story}
            scenes={story.scenes}
            characters={story.characters}
            onRegenerateAllScenes={onRegenerateAllScenes}
            isRegeneratingAllScenes={isRegeneratingAllScenes}
            onRegenerateSingleScene={onRegenerateSingleScene}
            regeneratingSceneNumber={regeneratingSceneNumber}
            onPlayPop={onPlayPop}
          />
        )}

        {/* Tab 5: Flow Production Mode */}
        {localActiveTab === 'flow-production' && (
          <FlowProductionMode story={story} onPlayPop={onPlayPop} />
        )}

        {/* Tab 6: Production Checklist & Timeline Report */}
        {localActiveTab === 'checklist' && (
          <ProductionChecklistSection
            story={story}
            onGoToFlow={() => handleTabChange('flow-production')}
          />
        )}
      </div>

      {/* Bottom Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer border border-slate-300 shadow-2xs"
        >
          <RotateCcw className="w-4 h-4 text-emerald-600" />
          <span>Create New Story</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleTabChange('flow-production')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-300 transition-colors cursor-pointer shadow-2xs"
          >
            <Video className="w-4 h-4" />
            <span>Open Flow Studio</span>
          </button>

          <button
            type="button"
            id="bottom-export-package-btn"
            onClick={() => setIsPackageModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>Export Production Package</span>
          </button>
        </div>
      </div>

      {/* Production Package Modal */}
      <ProductionPackageModal
        isOpen={isPackageModalOpen}
        onClose={() => setIsPackageModalOpen(false)}
        story={story}
      />
    </div>
  );
};
