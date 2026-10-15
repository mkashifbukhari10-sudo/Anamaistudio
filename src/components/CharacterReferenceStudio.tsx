import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Layers,
  Smile,
  ShieldCheck,
  AlertCircle,
  Eye,
  Sliders,
  Maximize2,
  Download,
  Package,
} from 'lucide-react';
import { CharacterBibleEntry, CharacterReferencePackage } from '../types';
import { findPack } from '../shared/packs';

interface CharacterReferenceStudioProps {
  characters: CharacterBibleEntry[];
  characterReferences?: CharacterReferencePackage[];
  animationStyle?: string;
  onRegenerateAllReferences?: () => void;
  onRegenerateSingleReference?: (characterId: string) => void;
  onGenerateCharacterImage?: (characterId: string, prompt: string) => void;
  onOpenProductionPackage?: () => void;
  isRegeneratingAll?: boolean;
  regeneratingCharacterId?: string | null;
  generatingImageCharacterId?: string | null;
  /** The story's film world, for the fallback prompt builder below. */
  pack?: string;
}

export const CharacterReferenceStudio: React.FC<CharacterReferenceStudioProps> = ({
  characters,
  characterReferences = [],
  animationStyle = 'Cute 3D',
  onRegenerateAllReferences,
  onRegenerateSingleReference,
  onGenerateCharacterImage,
  onOpenProductionPackage,
  isRegeneratingAll = false,
  regeneratingCharacterId = null,
  generatingImageCharacterId = null,
  pack,
}) => {
  const packInfo = findPack(pack);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    characters.forEach((char, idx) => {
      initial[char.id || `char_${idx}`] = true;
    });
    return initial;
  });
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const toggleExpand = (charId: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [charId]: !prev[charId],
    }));
  };

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const getReferenceForCharacter = (char: CharacterBibleEntry): CharacterReferencePackage => {
    const existing = characterReferences.find(
      (r) => r.characterId === char.id || r.characterName.toLowerCase() === char.name.toLowerCase()
    );
    if (existing) return existing;

    // NO LOCAL REBUILD. This used to hold a verbatim copy of the server's six
    // reference prompts, which is how it ended up as the only copy that never
    // learned about story packs: it emitted "Botanical anatomy" and "realistic
    // produce photographs" for every character, including a hen. Two copies of
    // the same prompt templates drift, and the drifted one shipped to the image
    // model.
    //
    // The server builds these in Phase 5 and on the regenerate endpoints, so
    // this path is only the brief window before they arrive. Saying so is more
    // useful than handing the operator a prompt for the wrong kind of animal.
    const pending = `Reference prompts for ${char.name} have not been generated yet. Use "Regenerate" above to build this character's ${packInfo.label} reference package.`;

    return {
      characterId: char.id,
      characterName: char.name,
      characterType: char.characterType ?? char.veggieType,
      veggieType: char.veggieType,
      fullBodyPrompt: pending,
      frontFacingPrompt: pending,
      characterSheetPrompt: pending,
      expressionSheetPrompt: pending,
      flowVeoInstructions: pending,
      negativePrompt: pending,
    };
  };

  const handleCopyAllCharacterPrompts = (char: CharacterBibleEntry, refPkg: CharacterReferencePackage) => {
    const combined = `=== 🖼️ ${char.name.toUpperCase()} (${char.veggieType.toUpperCase()}) - CHARACTER REFERENCE PACKAGE ===

1. FULL-BODY REFERENCE PROMPT:
${refPkg.fullBodyPrompt}

2. FRONT-FACING PORTRAIT REFERENCE PROMPT:
${refPkg.frontFacingPrompt}

3. CHARACTER MODEL TURNAROUND SHEET PROMPT:
${refPkg.characterSheetPrompt}

4. EXPRESSION REFERENCE SHEET PROMPT:
${refPkg.expressionSheetPrompt}

5. FLOW / VEO VISUAL CONSISTENCY INSTRUCTIONS:
${refPkg.flowVeoInstructions}

6. NEGATIVE / AVOID INSTRUCTIONS:
${refPkg.negativePrompt}
`;
    handleCopy(`all_${char.id}`, combined);
  };

  const handleCopyAllStudioPrompts = () => {
    let output = `==========================================================\n`;
    output += `🥕 VEGGIE STORY STUDIO - MASTER CHARACTER REFERENCE STUDIO\n`;
    output += `Visual Identity Assets & Video Consistency Prompts\n`;
    output += `==========================================================\n\n`;

    characters.forEach((char, idx) => {
      const ref = getReferenceForCharacter(char);
      output += `### CHARACTER #${idx + 1}: ${char.name} (${char.veggieType})\n`;
      output += `🔒 Locked Visual Identity: ${char.lockedVisualDescription}\n\n`;
      output += `--- (1) FULL-BODY PROMPT ---\n${ref.fullBodyPrompt}\n\n`;
      output += `--- (2) FRONT-FACING PROMPT ---\n${ref.frontFacingPrompt}\n\n`;
      output += `--- (3) MODEL SHEET TURNAROUND ---\n${ref.characterSheetPrompt}\n\n`;
      output += `--- (4) EXPRESSION SHEET ---\n${ref.expressionSheetPrompt}\n\n`;
      output += `--- (5) FLOW / VEO CONSISTENCY ---\n${ref.flowVeoInstructions}\n\n`;
      output += `--- (6) NEGATIVE PROMPT ---\n${ref.negativePrompt}\n\n`;
      output += `==========================================================\n\n`;
    });

    handleCopy('global_all_refs', output);
  };

  return (
    <section id="character-reference-studio-section" className="space-y-4 sm:space-y-6">
      {/* Section Header Card */}
      <div className="bg-amber-50/70 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 border border-amber-200 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-2xl">🖼️</span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                Character Reference Studio
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300/60 whitespace-nowrap">
                Google Flow & Veo Ready
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-2xl">
              Consistent reference-image prompts and visual identity specifications derived from the authoritative Character Bible. These are visual asset blueprints for generation and model training.
            </p>
          </div>

          {/* Global Header Actions */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              id="copy-all-references-btn"
              onClick={handleCopyAllStudioPrompts}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition whitespace-nowrap cursor-pointer"
            >
              {copiedKey === 'global_all_refs' ? (
                <>
                  <Check className="w-4 h-4 text-amber-100" />
                  Copied All References!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy All Reference Prompts
                </>
              )}
            </button>

            {onRegenerateAllReferences && (
              <button
                id="regenerate-all-references-btn"
                onClick={onRegenerateAllReferences}
                disabled={isRegeneratingAll}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-2xs"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRegeneratingAll ? 'animate-spin' : ''}`} />
                {isRegeneratingAll ? 'Polishing Prompts...' : 'Regenerate References'}
              </button>
            )}

            {onOpenProductionPackage && (
              <button
                id="export-production-package-btn"
                onClick={onOpenProductionPackage}
                className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition whitespace-nowrap"
              >
                <Package className="w-4 h-4" />
                📦 Export Production Package
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Character Cards List */}
      <div className="space-y-4 sm:space-y-6">
        {characters.map((char, index) => {
          const refPkg = getReferenceForCharacter(char);
          const isExpanded = expandedCards[char.id || `char_${index}`] ?? true;
          const isGeneratingImg = generatingImageCharacterId === char.id;
          const isRegenerating = regeneratingCharacterId === char.id;

          return (
            <motion.div
              key={char.id || `char_${index}`}
              id={`character-reference-card-${char.id || index}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
            >
              {/* Card Top Header */}
              <div className="p-3.5 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-xl sm:text-2xl shadow-inner border border-amber-200 shrink-0">
                    {char.emoji || '🥕'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {char.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                        {char.veggieType}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-slate-100 text-slate-800 whitespace-nowrap">
                        {char.role}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                        <Lock className="w-3 h-3 text-amber-600 shrink-0" />
                        Locked Visual Identity
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 line-clamp-2 sm:line-clamp-1 max-w-2xl font-mono break-words font-medium">
                      {char.lockedVisualDescription}
                    </p>
                  </div>
                </div>

                {/* Card Controls */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 self-end md:self-center">
                  {onGenerateCharacterImage && (
                    <button
                      id={`generate-image-btn-${char.id || index}`}
                      onClick={() => onGenerateCharacterImage(char.id, refPkg.fullBodyPrompt)}
                      disabled={isGeneratingImg}
                      className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
                      title="Generate character reference visual"
                    >
                      <ImageIcon className={`w-3.5 h-3.5 ${isGeneratingImg ? 'animate-spin' : ''}`} />
                      {isGeneratingImg ? 'Generating Reference...' : '🎨 Generate Visual'}
                    </button>
                  )}

                  <button
                    id={`copy-all-character-prompts-${char.id || index}`}
                    onClick={() => handleCopyAllCharacterPrompts(char, refPkg)}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    {copiedKey === `all_${char.id}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Copied Package!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy All
                      </>
                    )}
                  </button>

                  {onRegenerateSingleReference && (
                    <button
                      id={`regenerate-single-ref-${char.id || index}`}
                      onClick={() => onRegenerateSingleReference(char.id)}
                      disabled={isRegenerating}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-50 border border-slate-200 cursor-pointer"
                      title="Regenerate reference package"
                    >
                      <RotateCcw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                    </button>
                  )}

                  <button
                    id={`toggle-expand-card-${char.id || index}`}
                    onClick={() => toggleExpand(char.id || `char_${index}`)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition border border-slate-200 cursor-pointer"
                    aria-label="Toggle card expansion"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Generated Image Preview Banner if exists */}
              {refPkg.generatedImageUrl && (
                <div className="p-3 sm:p-4 bg-amber-50/50 border-b border-slate-200 flex items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <img
                      src={refPkg.generatedImageUrl}
                      alt={char.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-amber-400 shadow-xs cursor-pointer hover:opacity-90 transition shrink-0"
                      onClick={() => setSelectedPreviewImage({ url: refPkg.generatedImageUrl!, name: char.name })}
                    />
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        AI Generated Reference Asset
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-700 font-medium">
                        Visual standard based on 18-point Character Bible
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedPreviewImage({ url: refPkg.generatedImageUrl!, name: char.name })}
                      className="px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 transition flex items-center gap-1 whitespace-nowrap shadow-2xs cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      View
                    </button>
                    <a
                      href={refPkg.generatedImageUrl}
                      download={`${char.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_reference.png`}
                      className="px-2.5 py-1 sm:px-3 sm:py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition flex items-center gap-1 whitespace-nowrap shadow-2xs"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </div>
                </div>
              )}

              {/* Expandable Prompts Body */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-5"
                  >
                    {/* Prompt 1: Full-Body Character Reference */}
                    <div
                      id={`prompt-fullbody-${char.id || index}`}
                      className="rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                            1
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Full-Body Character Reference
                          </h4>
                          <span className="text-[10px] sm:text-[11px] text-slate-700 font-semibold">
                            (Head-to-toe neutral turnaround pose)
                          </span>
                        </div>
                        <button
                          id={`copy-fullbody-${char.id || index}`}
                          onClick={() => handleCopy(`fullbody_${char.id}`, refPkg.fullBodyPrompt)}
                          className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 text-[11px] sm:text-xs font-bold flex items-center gap-1 shadow-2xs transition whitespace-nowrap cursor-pointer"
                        >
                          {copiedKey === `fullbody_${char.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Prompt
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 font-mono bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 select-text leading-relaxed break-words font-medium">
                        {refPkg.fullBodyPrompt}
                      </p>
                    </div>

                    {/* Prompt 2: Front-Facing Reference */}
                    <div
                      id={`prompt-frontfacing-${char.id || index}`}
                      className="rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">
                            2
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Front-Facing Portrait Reference
                          </h4>
                          <span className="text-[10px] sm:text-[11px] text-slate-700 font-semibold">
                            (Face, eyes, crown, collar details)
                          </span>
                        </div>
                        <button
                          id={`copy-frontfacing-${char.id || index}`}
                          onClick={() => handleCopy(`front_${char.id}`, refPkg.frontFacingPrompt)}
                          className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-teal-50 hover:text-teal-700 text-[11px] sm:text-xs font-bold flex items-center gap-1 shadow-2xs transition whitespace-nowrap cursor-pointer"
                        >
                          {copiedKey === `front_${char.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-teal-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Prompt
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 font-mono bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 select-text leading-relaxed break-words font-medium">
                        {refPkg.frontFacingPrompt}
                      </p>
                    </div>

                    {/* Prompt 3: Character Design Sheet */}
                    <div
                      id={`prompt-charactersheet-${char.id || index}`}
                      className="rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                            3
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Character Design Model Sheet
                          </h4>
                          <span className="text-[10px] sm:text-[11px] text-slate-700 font-semibold">
                            (4-view turnaround: Front, 3/4, Profile, Back)
                          </span>
                        </div>
                        <button
                          id={`copy-sheet-${char.id || index}`}
                          onClick={() => handleCopy(`sheet_${char.id}`, refPkg.characterSheetPrompt)}
                          className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-indigo-50 hover:text-indigo-700 text-[11px] sm:text-xs font-bold flex items-center gap-1 shadow-2xs transition whitespace-nowrap cursor-pointer"
                        >
                          {copiedKey === `sheet_${char.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-indigo-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Prompt
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 font-mono bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 select-text leading-relaxed break-words font-medium">
                        {refPkg.characterSheetPrompt}
                      </p>
                    </div>

                    {/* Prompt 4: Expression Reference Sheet */}
                    <div
                      id={`prompt-expressions-${char.id || index}`}
                      className="rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                            4
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Expression Reference Sheet
                          </h4>
                          <span className="text-[10px] sm:text-[11px] text-slate-700 font-semibold">
                            (6-expression emotion grid)
                          </span>
                        </div>
                        <button
                          id={`copy-expression-${char.id || index}`}
                          onClick={() => handleCopy(`expression_${char.id}`, refPkg.expressionSheetPrompt)}
                          className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 hover:bg-amber-50 hover:text-amber-700 text-[11px] sm:text-xs font-bold flex items-center gap-1 shadow-2xs transition whitespace-nowrap cursor-pointer"
                        >
                          {copiedKey === `expression_${char.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-amber-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Prompt
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 font-mono bg-white p-2.5 sm:p-3 rounded-lg border border-slate-200 select-text leading-relaxed break-words font-medium">
                        {refPkg.expressionSheetPrompt}
                      </p>
                    </div>

                    {/* Prompt 5: Flow / Veo Consistency Instructions */}
                    <div
                      id={`prompt-consistency-${char.id || index}`}
                      className="rounded-lg sm:rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 sm:p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            5
                          </span>
                          <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                            Flow / Veo Visual Consistency Instructions
                          </h4>
                          <span className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold">
                            (Locked visual constraints)
                          </span>
                        </div>
                        <button
                          id={`copy-consistency-${char.id || index}`}
                          onClick={() => handleCopy(`consistency_${char.id}`, refPkg.flowVeoInstructions)}
                          className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-[11px] sm:text-xs font-semibold flex items-center gap-1 shadow-2xs transition whitespace-nowrap cursor-pointer"
                        >
                          {copiedKey === `consistency_${char.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Rules
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-xs text-slate-800 font-sans whitespace-pre-wrap bg-white/90 p-2.5 sm:p-3 rounded-lg border border-emerald-200 select-text leading-relaxed break-words">
                        {refPkg.flowVeoInstructions}
                      </pre>
                    </div>

                    {/* Prompt 6: Negative / Avoid Instructions */}
                    <div
                      id={`prompt-negative-${char.id || index}`}
                      className="rounded-lg sm:rounded-xl border border-rose-200 bg-rose-50/40 p-3 sm:p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                            6
                          </span>
                          <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                            Negative / Avoid Instructions
                          </h4>
                          <span className="text-[10px] sm:text-[11px] text-rose-700 font-semibold">
                            (Anti-hallucination & anti-drift)
                          </span>
                        </div>
                        <button
                          id={`copy-negative-${char.id || index}`}
                          onClick={() => handleCopy(`negative_${char.id}`, refPkg.negativePrompt)}
                          className="px-2 sm:px-2.5 py-1 rounded-lg bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 text-[11px] sm:text-xs font-semibold flex items-center gap-1 shadow-2xs transition whitespace-nowrap cursor-pointer"
                        >
                          {copiedKey === `negative_${char.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-rose-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy Negative
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-800 font-mono bg-white/90 p-2.5 sm:p-3 rounded-lg border border-rose-200 select-text leading-relaxed break-words font-medium">
                        {refPkg.negativePrompt}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* High-Res Image Preview Modal */}
      {selectedPreviewImage && (
        <div
          id="image-preview-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-[10px] sm:p-4 bg-slate-900/40 backdrop-blur-xs"
          onClick={() => setSelectedPreviewImage(null)}
        >
          <div
            id="image-preview-modal"
            className="bg-white rounded-2xl p-4 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Reference Visual: {selectedPreviewImage.name}
              </h3>
              <button
                onClick={() => setSelectedPreviewImage(null)}
                className="p-1 rounded-lg text-slate-700 hover:text-slate-950"
              >
                ✕
              </button>
            </div>
            <img
              src={selectedPreviewImage.url}
              alt={selectedPreviewImage.name}
              referrerPolicy="no-referrer"
              className="w-full h-auto rounded-xl object-contain shadow-md border border-slate-200"
            />
            <div className="flex justify-end gap-2">
              <a
                href={selectedPreviewImage.url}
                download={`${selectedPreviewImage.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_reference.png`}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs transition"
              >
                <Download className="w-4 h-4" />
                Download Image
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
