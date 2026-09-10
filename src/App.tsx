import React, { useState } from 'react';
import {
  StoryLanguage,
  StoryDuration,
  StoryMode,
  AnimationStyle,
  VeggieStory,
  CharacterBibleEntry,
  StudioTab,
  SceneGenerationReport,
} from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LanguageSelector } from './components/LanguageSelector';
import { StoryModeSelector } from './components/StoryModeSelector';
import { TopicInput } from './components/TopicInput';
import { DurationSelector } from './components/DurationSelector';
import { StyleSelector } from './components/StyleSelector';
import { StoryDisplay } from './components/StoryDisplay';
import { LoadingState } from './components/LoadingState';
import { ProductionPackageModal } from './components/ProductionPackageModal';
import { playPopSound, playSuccessChime } from './utils/audio';
import {
  Sparkles,
  AlertCircle,
  Clapperboard,
  ArrowRight,
  Film,
  CheckCircle2,
  Lightbulb,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/** Compress [13,14,15,20] into "13-15, 20" for a readable notice. */
function formatSceneRanges(sceneNumbers: number[]): string {
  if (!sceneNumbers || sceneNumbers.length === 0) return '';
  const sorted = [...sceneNumbers].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current !== prev + 1) {
      parts.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = current;
    }
    prev = current;
  }
  return parts.join(', ');
}

/**
 * Partial scene generation is surfaced through the existing notice banner.
 * Missing scenes are never filled with placeholder content, so the user has
 * to be told which parts of the timeline are genuinely absent.
 */
function describeIncompleteGeneration(report: SceneGenerationReport): string {
  const missing = formatSceneRanges(report.missingSceneNumbers);
  const reasons = (report.failedBatches || [])
    .map((batch) => batch.reason)
    .filter(Boolean);
  const because = reasons.length > 0 ? ` Reason: ${reasons[0]}` : '';
  return (
    `Partial timeline: ${report.generatedSceneCount} of ${report.targetSceneCount} scenes were generated. ` +
    `Scenes ${missing} are missing and were NOT replaced with placeholder content.${because} ` +
    `Use "Regenerate Scenes" to attempt the full timeline again.`
  );
}

export default function App() {
  const [language, setLanguage] = useState<StoryLanguage>('Roman Urdu');
  const [storyMode, setStoryMode] = useState<StoryMode>('Cinematic Emotional');
  const [topic, setTopic] = useState<string>('Gajar aur Tamatar ki dosti');
  const [duration, setDuration] = useState<StoryDuration>('10 minutes');
  const [customMinutes, setCustomMinutes] = useState<number>(10);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>('Cute 3D');

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRegeneratingCharacters, setIsRegeneratingCharacters] = useState<boolean>(false);
  const [isRegeneratingAllScenes, setIsRegeneratingAllScenes] = useState<boolean>(false);
  const [regeneratingSceneNumber, setRegeneratingSceneNumber] = useState<number | null>(null);
  const [isRegeneratingAllReferences, setIsRegeneratingAllReferences] = useState<boolean>(false);
  const [regeneratingReferenceCharId, setRegeneratingReferenceCharId] = useState<string | null>(null);
  const [generatingImageCharacterId, setGeneratingImageCharacterId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts empty on purpose. Seeding this with the bundled sample made a
  // failed generation look like a finished 10-minute / 60-scene story.
  const [generatedStory, setGeneratedStory] = useState<VeggieStory | null>(null);

  // Layout & Studio Navigation State
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('story');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState<boolean>(false);
  const [showSetupWorkbench, setShowSetupWorkbench] = useState<boolean>(false);

  const safeFetchJson = async (url: string, options?: RequestInit): Promise<any> => {
    let res: Response;
    try {
      res = await fetch(url, options);
    } catch (netErr: any) {
      console.error('Network fetch failed:', netErr);
      throw new Error('Unable to reach the studio backend server. Please check your connection and try again.');
    }

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      if (
        res.status === 504 ||
        res.status === 502 ||
        text.toLowerCase().includes('upstream') ||
        text.toLowerCase().includes('timeout')
      ) {
        throw new Error(
          "Story generation took longer than expected due to AI model traffic. Please click 'Launch Story Pre-Production' to try again."
        );
      }
      throw new Error(`Server returned unexpected response (${res.status}): ${text.slice(0, 100)}`);
    }

    if (!res.ok || json.success === false) {
      const errMsg = json?.error || json?.message || `Request failed with status ${res.status}`;
      throw new Error(errMsg);
    }

    return json;
  };

  const handlePopSound = () => {
    if (soundEnabled) {
      playPopSound();
    }
  };

  const handleSuccessSound = () => {
    if (soundEnabled) {
      playSuccessChime();
    }
  };

  const handleToggleSound = () => {
    setSoundEnabled((prev) => !prev);
  };

  const handleGenerateStory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!topic.trim()) {
      setError('Please enter a story topic (e.g. "Gajar aur Tamatar ki dosti").');
      return;
    }

    handlePopSound();
    setError(null);
    setIsLoading(true);

    try {
      // If characters were already defined and locked in a previous run, pass them along
      const lockedCharacters = generatedStory?.characters?.filter((c) => c.isLocked);

      const json = await safeFetchJson('/api/generate-story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          topic: topic.trim(),
          duration,
          storyMode,
          customMinutes,
          animationStyle,
          lockedCharacters:
            lockedCharacters && lockedCharacters.length > 0 ? lockedCharacters : undefined,
        }),
      });

      setGeneratedStory(json.data);
      const storyReport: SceneGenerationReport | undefined = json.data?.sceneGeneration;
      if (storyReport && !storyReport.isComplete) {
        setError(describeIncompleteGeneration(storyReport));
      }
      setShowSetupWorkbench(false);
      setActiveStudioTab('story');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      console.error(err);
      let message =
        err.message || 'Something went wrong while creating your story. Please try again.';
      if (
        typeof message === 'string' &&
        (message.includes('503') ||
          message.includes('high demand') ||
          message.includes('UNAVAILABLE'))
      ) {
        message =
          'The AI model experienced temporary high demand. We automatically retried with our fast fallback model. Please click "Launch Story Pre-Production" to try again.';
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateCharacters = async () => {
    if (!generatedStory) return;
    handlePopSound();
    setError(null);
    setIsRegeneratingCharacters(true);

    try {
      const lockedCharacters = generatedStory.characters.filter((c) => c.isLocked);
      const charactersToKeep = generatedStory.characters.map((c) => ({
        id: c.id,
        name: c.name,
        veggieType: c.veggieType,
        isLocked: c.isLocked,
        lockedVisualDescription: c.lockedVisualDescription,
      }));

      const json = await safeFetchJson('/api/regenerate-characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim() || generatedStory.title,
          storyTitle: generatedStory.title,
          language: generatedStory.language,
          storyMode: generatedStory.storyMode,
          animationStyle: generatedStory.animationStyle,
          fullStoryText: generatedStory.fullStoryText,
          lockedCharacters,
          charactersToKeep,
          existingCharacters: generatedStory.characters,
        }),
      });

      setGeneratedStory((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          characters: json.data.characters,
        };
      });
      handleSuccessSound();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to regenerate characters.');
    } finally {
      setIsRegeneratingCharacters(false);
    }
  };

  const handleRegenerateAllScenes = async () => {
    if (!generatedStory) return;
    handlePopSound();
    setError(null);
    setIsRegeneratingAllScenes(true);

    try {
      const json = await safeFetchJson('/api/regenerate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim() || generatedStory.title,
          storyTitle: generatedStory.title,
          fullStoryText: generatedStory.fullStoryText,
          language: generatedStory.language,
          duration: generatedStory.duration,
          animationStyle: generatedStory.animationStyle,
          storyMode: generatedStory.storyMode,
          characters: generatedStory.characters,
          estimatedScenesCount: generatedStory.estimatedScenesCount || generatedStory.scenes.length,
          chapters: generatedStory.chapters,
          narrativeBlueprint: generatedStory.narrativeBlueprint,
          story: {
            title: generatedStory.title,
            chapters: generatedStory.chapters,
            characters: generatedStory.characters,
            language: generatedStory.language,
            duration: generatedStory.duration,
            storyMode: generatedStory.storyMode,
            animationStyle: generatedStory.animationStyle,
            fullStoryText: generatedStory.fullStoryText,
          },
        }),
      });

      const scenesReport: SceneGenerationReport | undefined = json.data?.sceneGeneration;
      setGeneratedStory((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: json.data.scenes,
          sceneGeneration: scenesReport,
        };
      });
      if (scenesReport && !scenesReport.isComplete) {
        setError(describeIncompleteGeneration(scenesReport));
      }
      handleSuccessSound();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to regenerate scenes.');
    } finally {
      setIsRegeneratingAllScenes(false);
    }
  };

  const handleRegenerateSingleScene = async (sceneNumber: number) => {
    if (!generatedStory) return;
    handlePopSound();
    setError(null);
    setRegeneratingSceneNumber(sceneNumber);

    try {
      const existingScene = generatedStory.scenes.find((s) => s.sceneNumber === sceneNumber);
      if (!existingScene) throw new Error('Scene not found.');

      const prevScene = generatedStory.scenes.find((s) => s.sceneNumber === sceneNumber - 1);
      const nextScene = generatedStory.scenes.find((s) => s.sceneNumber === sceneNumber + 1);

      const json = await safeFetchJson('/api/regenerate-single-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim() || generatedStory.title,
          storyTitle: generatedStory.title,
          language: generatedStory.language,
          sceneNumber,
          storyMode: generatedStory.storyMode,
          duration: generatedStory.duration,
          existingScene,
          prevScene,
          nextScene,
          characters: generatedStory.characters,
          fullStoryText: generatedStory.fullStoryText,
          animationStyle: generatedStory.animationStyle,
          narrativeBlueprint: generatedStory.narrativeBlueprint,
        }),
      });

      setGeneratedStory((prev) => {
        if (!prev) return null;
        const updatedScenes = prev.scenes.map((s) =>
          s.sceneNumber === sceneNumber ? json.data.scene : s
        );
        return {
          ...prev,
          scenes: updatedScenes,
        };
      });
      handleSuccessSound();
    } catch (err: any) {
      console.error(err);
      setError(err.message || `Failed to regenerate Scene #${sceneNumber}.`);
    } finally {
      setRegeneratingSceneNumber(null);
    }
  };

  const handleRegenerateAllReferences = async () => {
    if (!generatedStory) return;
    handlePopSound();
    setError(null);
    setIsRegeneratingAllReferences(true);

    try {
      const json = await safeFetchJson('/api/regenerate-character-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characters: generatedStory.characters,
          animationStyle: generatedStory.animationStyle,
        }),
      });

      setGeneratedStory((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          characterReferences: json.data.characterReferences,
        };
      });
      handleSuccessSound();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to regenerate character reference studio prompts.');
    } finally {
      setIsRegeneratingAllReferences(false);
    }
  };

  const handleRegenerateSingleReference = async (characterId: string) => {
    if (!generatedStory) return;
    const char = generatedStory.characters.find((c) => c.id === characterId);
    if (!char) return;

    handlePopSound();
    setError(null);
    setRegeneratingReferenceCharId(characterId);

    try {
      const json = await safeFetchJson('/api/regenerate-single-character-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character: char,
          animationStyle: generatedStory.animationStyle,
        }),
      });

      setGeneratedStory((prev) => {
        if (!prev) return null;
        const existingRefs = prev.characterReferences || [];
        const filtered = existingRefs.filter((r) => r.characterId !== characterId);
        return {
          ...prev,
          characterReferences: [...filtered, json.data.reference],
        };
      });
      handleSuccessSound();
    } catch (err: any) {
      console.error(err);
      setError(err.message || `Failed to regenerate reference for ${char.name}.`);
    } finally {
      setRegeneratingReferenceCharId(null);
    }
  };

  const handleGenerateCharacterImage = async (characterId: string, prompt: string) => {
    if (!generatedStory) return;
    handlePopSound();
    setError(null);
    setGeneratingImageCharacterId(characterId);

    try {
      const json = await safeFetchJson('/api/generate-character-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          characterId,
          characterName: generatedStory.characters.find((c) => c.id === characterId)?.name,
        }),
      });

      setGeneratedStory((prev) => {
        if (!prev) return null;
        const updatedRefs = (prev.characterReferences || []).map((ref) => {
          if (ref.characterId === characterId) {
            return {
              ...ref,
              generatedImageUrl: json.data.imageUrl,
            };
          }
          return ref;
        });
        return {
          ...prev,
          characterReferences: updatedRefs,
        };
      });
      handleSuccessSound();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate visual reference image.');
    } finally {
      setGeneratingImageCharacterId(null);
    }
  };

  const handleUpdateCharacters = (updatedCharacters: CharacterBibleEntry[]) => {
    setGeneratedStory((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        characters: updatedCharacters,
      };
    });
  };

  const handleNewStorySetup = () => {
    setShowSetupWorkbench(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectStudioTab = (tab: StudioTab) => {
    // With no story yet, the workspace stays on the setup workbench rather
    // than falling back to demo content.
    setShowSetupWorkbench(false);
    setActiveStudioTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Shared error banner. Rendered in the setup workbench and, when the studio
  // workspace is open, above it - so regeneration errors are never swallowed.
  const errorAlert = error ? (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-3 text-xs"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-rose-900">Story generation notice</p>
          <p className="text-rose-700 text-xs mt-0.5">{error}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setError(null)}
        className="text-xs font-semibold text-rose-800 hover:text-rose-950 bg-rose-100 hover:bg-rose-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
      >
        Dismiss
      </button>
    </motion.div>
  ) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Studio Header */}
      <Header
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        hasActiveStory={!!generatedStory}
        onOpenExportPackage={() => setIsPackageModalOpen(true)}
        onNewStory={handleNewStorySetup}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Studio Sidebar */}
        <Sidebar
          activeTab={activeStudioTab}
          onSelectTab={handleSelectStudioTab}
          onNewStory={handleNewStorySetup}
          onOpenIdeas={() => {
            setShowSetupWorkbench(true);
            const el = document.getElementById('story-topic-input');
            if (el) el.focus();
          }}
          onOpenExportPackage={() => setIsPackageModalOpen(true)}
          hasActiveStory={!!generatedStory}
          story={generatedStory}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Studio Main Workspace */}
        <main className="flex-1 min-w-0 px-[10px] sm:px-6 lg:px-8 py-2 sm:py-6 space-y-4 sm:space-y-6">
          {/* Regeneration errors stay visible while the studio workspace is open */}
          {!isLoading && generatedStory && !showSetupWorkbench && errorAlert}

          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="sm:px-0">
                <LoadingState key="loading" duration={duration} topic={topic} />
              </div>
            ) : generatedStory && !showSetupWorkbench ? (
              <StoryDisplay
                key="story-display"
                story={generatedStory}
                onReset={handleNewStorySetup}
                onPlaySuccess={handleSuccessSound}
                onPlayPop={handlePopSound}
                soundEnabled={soundEnabled}
                activeStudioTab={activeStudioTab}
                onSelectStudioTab={setActiveStudioTab}
                onUpdateCharacters={handleUpdateCharacters}
                onRegenerateCharacters={handleRegenerateCharacters}
                isRegeneratingCharacters={isRegeneratingCharacters}
                onRegenerateAllScenes={handleRegenerateAllScenes}
                isRegeneratingAllScenes={isRegeneratingAllScenes}
                onRegenerateSingleScene={handleRegenerateSingleScene}
                regeneratingSceneNumber={regeneratingSceneNumber}
                onRegenerateAllReferences={handleRegenerateAllReferences}
                isRegeneratingAllReferences={isRegeneratingAllReferences}
                onRegenerateSingleReference={handleRegenerateSingleReference}
                regeneratingReferenceCharId={regeneratingReferenceCharId}
                onGenerateCharacterImage={handleGenerateCharacterImage}
                generatingImageCharacterId={generatingImageCharacterId}
              />
            ) : (
              <motion.div
                key="studio-setup-workbench"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-4 sm:space-y-6"
              >
                {/* Director Header Card */}
                <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-7 space-y-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                        <Clapperboard className="w-3.5 h-3.5 text-emerald-600" />
                        Animation Pre-Production Setup
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        AI Story Director & Scene Architect
                      </h2>
                    </div>

                    {generatedStory && (
                      <button
                        type="button"
                        onClick={() => setShowSetupWorkbench(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
                      >
                        <span className="truncate max-w-[200px] sm:max-w-xs">Return to ({generatedStory.title})</span>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-3xl leading-relaxed">
                    Create meaningful, cinematic animated stories with dynamically sized vegetable characters, 18-point locked visual bibles, 10-second scene breakdowns, and ready-to-use Google Flow / Veo video generation prompts.
                  </p>
                </div>

                {/* Error Alert if any */}
                {errorAlert}

                {/* Story Configuration Form */}
                <form
                  id="anam-studio-form"
                  onSubmit={handleGenerateStory}
                  className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-8 space-y-5 sm:space-y-7 shadow-xs"
                >
                  {/* 1. Language Selector */}
                  <LanguageSelector
                    value={language}
                    onChange={setLanguage}
                    onPlayPop={handlePopSound}
                  />

                  {/* 2. Story Mode Selector */}
                  <StoryModeSelector
                    value={storyMode}
                    onChange={setStoryMode}
                    onPlayPop={handlePopSound}
                  />

                  {/* 3. Topic Input */}
                  <TopicInput
                    value={topic}
                    onChange={setTopic}
                    selectedLanguage={language}
                    onPlayPop={handlePopSound}
                    onSelectStoryMode={setStoryMode}
                  />

                  {/* 4. Duration Selector (up to 10 minutes, 60 scenes) */}
                  <DurationSelector
                    value={duration}
                    onChange={setDuration}
                    customMinutes={customMinutes}
                    onCustomMinutesChange={setCustomMinutes}
                    onPlayPop={handlePopSound}
                  />

                  {/* 5. Animation Style Selector */}
                  <StyleSelector
                    value={animationStyle}
                    onChange={setAnimationStyle}
                    onPlayPop={handlePopSound}
                  />

                  {/* 6. Primary Generate Button */}
                  <div className="pt-4 border-t border-slate-200">
                    <button
                      id="generate-story-button"
                      type="submit"
                      className="w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base sm:text-lg transition-colors flex items-center justify-center gap-2.5 cursor-pointer shadow-sm group"
                    >
                      <Clapperboard className="w-5 h-5 text-white group-hover:scale-105 transition-transform" />
                      <span>Launch Story Pre-Production</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-slate-700 mt-3 font-mono font-semibold">
                      <span className="whitespace-nowrap">✓ Dynamic Cast Sizing</span>
                      <span className="whitespace-nowrap">✓ 18-Point Visual Bible</span>
                      <span className="whitespace-nowrap">✓ 10-Second Scene Breakdown</span>
                      <span className="whitespace-nowrap">✓ Google Flow / Veo Prompts</span>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Studio Footer */}
          <footer className="w-full border-t border-slate-200 bg-white py-3.5 px-4 text-center text-xs text-slate-700 font-mono font-semibold rounded-xl">
            <p>
              ANAMSTUDIO • AI Cinematic Story & Animation Pre-Production Studio • Google Flow Production Assistant
            </p>
          </footer>
        </main>
      </div>

      {/* Production Package Modal */}
      {generatedStory && (
        <ProductionPackageModal
          isOpen={isPackageModalOpen}
          onClose={() => setIsPackageModalOpen(false)}
          story={generatedStory}
        />
      )}
    </div>
  );
}
