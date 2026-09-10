import React, { useState } from 'react';
import { CharacterBibleEntry } from '../types';
import {
  Lock,
  Unlock,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  Palette,
  Eye,
  Shirt,
  Smile,
  Info,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CharacterBibleSectionProps {
  characters: CharacterBibleEntry[];
  allLocked: boolean;
  onToggleAllLock: () => void;
  onToggleCharacterLock: (id: string) => void;
  onRegenerateCharacters: () => Promise<void>;
  isRegeneratingCharacters: boolean;
  onPlayPop?: () => void;
}

export const CharacterBibleSection: React.FC<CharacterBibleSectionProps> = ({
  characters,
  allLocked,
  onToggleAllLock,
  onToggleCharacterLock,
  onRegenerateCharacters,
  isRegeneratingCharacters,
  onPlayPop,
}) => {
  const [expandedCharId, setExpandedCharId] = useState<string | null>(null);
  const [copiedCharId, setCopiedCharId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'detailed'>('cards');

  const handleCopyLockedPrompt = async (char: CharacterBibleEntry) => {
    if (onPlayPop) onPlayPop();
    const text = `[LOCKED CHARACTER: ${char.name} (${char.veggieType})]\n${char.lockedVisualDescription}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCharId(char.id);
      setTimeout(() => setCopiedCharId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyAllBible = async () => {
    if (onPlayPop) onPlayPop();
    const formatted = characters
      .map(
        (c, i) => `=== CHARACTER ${i + 1}: ${c.name.toUpperCase()} (${c.veggieType.toUpperCase()}) ===
Importance: ${c.importance || 'MAIN'}
Role: ${c.role}
Personality: ${c.personality}
Age/Feel: ${c.agePersonalityFeel}
Locked Visual Identity: ${c.lockedVisualDescription}
Body Shape: ${c.bodyShape}
Face: ${c.faceDesign}
Eyes: ${c.eyeStyleAndColor}
Mouth: ${c.mouthStyle}
Veggie Features: ${c.veggieFeatures}
Clothing: ${c.clothing}
Shoes: ${c.shoes}
Accessories: ${c.accessories}
Colors: ${c.mainColors}
Voice: ${c.voicePersonality}
Speaking Style: ${c.speakingStyle}
Movement: ${c.movementStyle}
Expressions: ${c.typicalExpressions}
Catchphrase: ${c.catchphrase || 'N/A'}`
      )
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Fallback
    }
  };

  const toggleExpand = (id: string) => {
    if (onPlayPop) onPlayPop();
    setExpandedCharId((prev) => (prev === id ? null : id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-7 border border-slate-200 space-y-4 sm:space-y-6 shadow-xs"
    >
      {/* Header with Title and Global Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3.5 sm:pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl">🥕</span>
            <h3 className="font-bold text-base sm:text-xl text-slate-900 flex flex-wrap items-center gap-2">
              <span>Master Character Bible</span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                18-Point Consistency Anchor
              </span>
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 font-medium">
            Core visual traits & wardrobe remain locked for complete character consistency across all scenes.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Lock All / Unlock All Control */}
          <button
            type="button"
            id="lock-all-characters-btn"
            onClick={() => {
              if (onPlayPop) onPlayPop();
              onToggleAllLock();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shadow-2xs ${
              allLocked
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
            }`}
            title={allLocked ? 'All character visual traits are locked' : 'Characters are unlocked for modifications'}
          >
            {allLocked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Characters Locked</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Lock Characters</span>
              </>
            )}
          </button>

          {/* Regenerate Characters Button */}
          <button
            type="button"
            id="regenerate-characters-btn"
            disabled={isRegeneratingCharacters}
            onClick={() => {
              if (onPlayPop) onPlayPop();
              onRegenerateCharacters();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-300 shadow-2xs whitespace-nowrap"
            title="Generate fresh vegetable designs for this story topic"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-700 ${
                isRegeneratingCharacters ? 'animate-spin text-emerald-600' : ''
              }`}
            />
            <span>{isRegeneratingCharacters ? 'Designing...' : 'Regenerate Cast'}</span>
          </button>

          {/* Copy Full Bible */}
          <button
            type="button"
            onClick={handleCopyAllBible}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
            title="Copy entire Character Bible specifications"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? 'Copied' : 'Copy Bible'}</span>
          </button>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-800 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{characters.length} Vegetable Characters in Cast</span>
        </div>

        <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
          <button
            type="button"
            onClick={() => {
              if (onPlayPop) onPlayPop();
              setViewMode('cards');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs whitespace-nowrap ${
              viewMode === 'cards' ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            Profile Cards
          </button>
          <button
            type="button"
            onClick={() => {
              if (onPlayPop) onPlayPop();
              setViewMode('detailed');
            }}
            className={`px-2.5 sm:px-3 py-1 rounded-lg transition-colors cursor-pointer text-xs whitespace-nowrap ${
              viewMode === 'detailed' ? 'bg-white text-slate-900 font-bold shadow-2xs border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            18-Point Specs
          </button>
        </div>
      </div>

      {/* Characters Cards Grid */}
      <div
        className={`grid gap-4 ${
          viewMode === 'cards'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1'
        }`}
      >
        {characters.map((char, index) => {
          const isExpanded = expandedCharId === char.id || viewMode === 'detailed';
          const isCharLocked = char.isLocked ?? allLocked;

          return (
            <motion.div
              key={char.id || index}
              layout
              className={`rounded-xl border transition-colors flex flex-col justify-between ${
                isCharLocked
                  ? 'bg-white border-slate-200 ring-1 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              {/* Card Top / Header */}
              <div className="p-3.5 sm:p-5 space-y-3 sm:space-y-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl sm:text-2xl shrink-0">
                      {char.emoji || '🥕'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-slate-900 text-sm sm:text-lg leading-tight truncate">
                        {char.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {char.importance && (
                          <span
                            className={`text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md border whitespace-nowrap ${
                              char.importance === 'MAIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : char.importance === 'SUPPORTING'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-800 border-slate-300 font-semibold'
                            }`}
                          >
                            ★ {char.importance}
                          </span>
                        )}
                        <span className="text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                          {char.veggieType}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                          {char.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Individual Lock Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onPlayPop) onPlayPop();
                      onToggleCharacterLock(char.id);
                    }}
                    className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                      isCharLocked
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                    }`}
                    title={isCharLocked ? 'Visual Identity Locked (Click to unlock)' : 'Unlocked (Click to lock)'}
                  >
                    {isCharLocked ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Locked Visual Identity Summary Prompt Box */}
                <div className="rounded-xl p-2.5 sm:p-3 bg-amber-50/70 border border-amber-200 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 gap-1">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Locked Visual Identity
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyLockedPrompt(char)}
                      className="text-[10px] font-mono font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded border border-amber-300 transition-colors cursor-pointer whitespace-nowrap"
                      title="Copy prompt for image/video generation"
                    >
                      {copiedCharId === char.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-amber-900 font-mono leading-relaxed italic break-words">
                    "{char.lockedVisualDescription}"
                  </p>
                </div>

                {/* Quick Key Highlights */}
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <Smile className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                    <p className="break-words">
                      <strong className="text-slate-900 font-semibold">Personality:</strong>{' '}
                      {char.personality} ({char.agePersonalityFeel})
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shirt className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="break-words">
                      <strong className="text-slate-900 font-semibold">Wardrobe:</strong>{' '}
                      {char.clothing} • Shoes: {char.shoes}
                    </p>
                  </div>
                  {char.catchphrase && (
                    <div className="text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 italic break-words">
                      "{char.catchphrase}"
                    </div>
                  )}
                </div>

                {/* Detailed 18-Point Spec Accordion / Breakdown */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-3 border-t border-slate-200 space-y-4"
                    >
                      {/* Section 1: Anatomy & Physical Design */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>1. Anatomy & Face Specs</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <div>
                            <span className="font-semibold text-slate-900">Body & Shape:</span>
                            <p className="text-slate-800 break-words font-medium">{char.bodyShape}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Face Design:</span>
                            <p className="text-slate-800 break-words font-medium">{char.faceDesign}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Eyes:</span>
                            <p className="text-slate-800 break-words font-medium">{char.eyeStyleAndColor}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Mouth:</span>
                            <p className="text-slate-800 break-words font-medium">{char.mouthStyle}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="font-semibold text-slate-900">Veggie Features:</span>
                            <p className="text-slate-800 break-words font-medium">{char.veggieFeatures}</p>
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Wardrobe & Colors */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                          <Palette className="w-3.5 h-3.5 text-purple-600" />
                          <span>2. Wardrobe & Palette Specs</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <div>
                            <span className="font-semibold text-slate-900">Clothing:</span>
                            <p className="text-slate-800 break-words font-medium">{char.clothing}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Shoes:</span>
                            <p className="text-slate-800 break-words font-medium">{char.shoes}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Accessories:</span>
                            <p className="text-slate-800 break-words font-medium">{char.accessories}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Color Palette:</span>
                            <p className="text-slate-800 break-words font-medium">{char.mainColors}</p>
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Voice, Movement & Expressions */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-700">
                          <Activity className="w-3.5 h-3.5 text-emerald-600" />
                          <span>3. Voice, Motion & Expression Specs</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <div>
                            <span className="font-semibold text-slate-900">Voice Tone:</span>
                            <p className="text-slate-800 break-words font-medium">{char.voicePersonality}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Speaking Style:</span>
                            <p className="text-slate-800 break-words font-medium">{char.speakingStyle}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Movement Style:</span>
                            <p className="text-slate-800 break-words font-medium">{char.movementStyle}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">Typical Expressions:</span>
                            <p className="text-slate-800 break-words font-medium">{char.typicalExpressions}</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Card Footer Accordion Toggle */}
              {viewMode === 'cards' && (
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 rounded-b-xl flex items-center justify-between text-xs">
                  <span className="text-[11px] font-mono font-medium flex items-center gap-1">
                    {isCharLocked ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Locked Identity
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <Unlock className="w-3 h-3" /> Unlocked
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleExpand(char.id)}
                    className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Specs' : 'View All 18 Specs'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Info notice about scene consistency */}
      <div className="flex items-start gap-2.5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-800">Consistency Anchor:</strong> Each character's locked visual identity is maintained in the Character Bible and injected directly into every scene's Google Flow and Veo prompt. Poses, emotions, and dialogues shift dynamically per scene, while clothing, geometry, and color palettes stay 100% consistent.
        </p>
      </div>
    </motion.div>
  );
};
