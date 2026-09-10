import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Copy,
  Check,
  Download,
  FileText,
  Sparkles,
  Clapperboard,
  BookOpen,
  UserCheck,
  Film,
  ShieldCheck,
  Printer,
} from 'lucide-react';
import { VeggieStory } from '../types';
import { validateTimeline, computeProductionChecklist } from '../utils/validation';

interface ProductionPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: VeggieStory;
}

export const ProductionPackageModal: React.FC<ProductionPackageModalProps> = ({
  isOpen,
  onClose,
  story,
}) => {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'json'>('preview');

  if (!isOpen) return null;

  const generateMarkdownPackage = (): string => {
    const characters = story.characters || [];
    const scenes = story.scenes || [];
    const references = story.characterReferences || [];
    const report = validateTimeline(story);
    const checklist = computeProductionChecklist(story);

    let md = `# 🎬 ANAMSTUDIO - COMPLETE ANIMATION PRE-PRODUCTION PACKAGE\n\n`;
    md += `**Project:** ${story.title}\n`;
    if (story.tagline) md += `**Tagline:** ${story.tagline}\n`;
    md += `**Language:** ${story.language}\n`;
    if (story.storyMode) md += `**Story Mode:** ${story.storyMode}\n`;
    md += `**Target Duration:** ${story.duration}\n`;
    md += `**Visual Animation Style:** ${story.animationStyle || 'Cute 3D'}\n`;
    md += `**Total Production Scenes:** ${scenes.length} (~10s per shot)\n`;
    if (story.isLongForm) md += `**Format:** 🎬 Long-Form Cinematic Tale\n`;
    md += `**Moral:** ${story.moral}\n\n`;
    md += `---\n\n`;

    // 0. TIMELINE & PRE-PRODUCTION VALIDATION
    md += `## 📋 0. PRE-PRODUCTION VALIDATION & TIMELINE AUDIT\n\n`;
    md += `- **Timeline Validation:** ${report.isValid ? '✅ VALIDATED' : '⚠️ DISCREPANCY DETECTED'}\n`;
    md += `- **Target Duration:** ${report.selectedDuration}\n`;
    md += `- **Expected Scenes:** ${report.expectedSceneCount} | **Actual Scenes:** ${report.actualSceneCount}\n`;
    md += `- **Continuous Timeline:** ${report.actualTimeline}\n`;
    md += `- **Dynamic Cast:** ${report.characterCount} Characters in Master Bible\n`;
    md += `- **Reference Assets:** ${report.referenceCount} Generated Reference Packages\n`;
    md += `- **Flow Readiness:** ${checklist.readyForFlow ? '🟢 READY FOR FLOW' : '⚪ PENDING'}\n\n`;
    md += `---\n\n`;

    // 1. FULL STORY SCRIPT
    md += `## 📖 1. FULL STORY SCRIPT & AUDIO NARRATION\n\n`;
    md += `${story.fullStoryText}\n\n`;
    if (story.funQuestion) {
      md += `**Interactive Question for Kids:** ${story.funQuestion}\n\n`;
    }
    md += `---\n\n`;

    // 2. CHARACTER BIBLE
    md += `## 🥕 2. MASTER CHARACTER BIBLE (LOCKED VISUAL IDENTITY)\n\n`;
    characters.forEach((char, idx) => {
      const imp = char.importance ? ` [${char.importance}]` : '';
      md += `### Character #${idx + 1}: ${char.emoji || '🥕'} ${char.name} (${char.veggieType})${imp}\n`;
      md += `- **Importance Tier:** ${char.importance || 'MAIN'}\n`;
      md += `- **Role:** ${char.role}\n`;
      md += `- **Personality:** ${char.personality}\n`;
      md += `- **Age/Feel:** ${char.agePersonalityFeel}\n`;
      md += `- **Body Shape & Proportions:** ${char.bodyShape}\n`;
      md += `- **Face Design:** ${char.faceDesign}\n`;
      md += `- **Eye Style & Color:** ${char.eyeStyleAndColor}\n`;
      md += `- **Mouth & Expression:** ${char.mouthStyle}\n`;
      md += `- **Botanical Anatomy / Features:** ${char.veggieFeatures}\n`;
      md += `- **Clothing:** ${char.clothing}\n`;
      md += `- **Shoes:** ${char.shoes}\n`;
      md += `- **Accessories:** ${char.accessories}\n`;
      md += `- **Color Palette:** ${char.mainColors}\n`;
      md += `- **Voice Personality:** ${char.voicePersonality}\n`;
      md += `- **Speaking Style:** ${char.speakingStyle}\n`;
      md += `- **Movement Style:** ${char.movementStyle}\n`;
      md += `- **Typical Expressions:** ${char.typicalExpressions}\n`;
      if (char.catchphrase) md += `- **Catchphrase:** "${char.catchphrase}"\n`;
      md += `- **🔒 LOCKED VISUAL PROMPT:** \`${char.lockedVisualDescription}\`\n\n`;
    });
    md += `---\n\n`;

    // 3. CHARACTER REFERENCE STUDIO PROMPTS
    md += `## 🖼️ 3. CHARACTER REFERENCE STUDIO PROMPTS & CONSISTENCY GUIDELINES\n\n`;
    references.forEach((ref) => {
      md += `### ${ref.characterName} (${ref.veggieType}) - Visual Assets\n\n`;
      md += `#### (A) Full-Body Character Reference Prompt\n\`\`\`text\n${ref.fullBodyPrompt}\n\`\`\`\n\n`;
      md += `#### (B) Front-Facing Portrait Reference Prompt\n\`\`\`text\n${ref.frontFacingPrompt}\n\`\`\`\n\n`;
      md += `#### (C) Character Model Turnaround Sheet Prompt\n\`\`\`text\n${ref.characterSheetPrompt}\n\`\`\`\n\n`;
      md += `#### (D) Expression Reference Sheet Prompt\n\`\`\`text\n${ref.expressionSheetPrompt}\n\`\`\`\n\n`;
      md += `#### (E) Flow / Veo Visual Consistency Instructions\n${ref.flowVeoInstructions}\n\n`;
      md += `#### (F) Negative / Avoid Prompt\n\`\`\`text\n${ref.negativePrompt}\n\`\`\`\n\n`;
    });
    md += `---\n\n`;

    // 4. 10-SECOND SCENE BREAKDOWN & TIMELINE
    md += `## ⏱️ 4. 10-SECOND SCENE TIMELINE & PRODUCTION BREAKDOWN\n\n`;
    scenes.forEach((scene) => {
      md += `### Scene #${scene.sceneNumber} (${scene.timeRange} | ${scene.duration})\n`;
      md += `- **Purpose:** ${scene.purpose}\n`;
      md += `- **Characters Present:** ${scene.charactersPresent.join(', ')}\n`;
      md += `- **Primary Visual Action (Single Focus):** ${scene.characterActions}\n`;
      md += `- **Facial Expressions & Emotion:** ${scene.facialExpressions}\n`;
      md += `- **Spoken Dialogue (${story.language}):** ${scene.dialogue}\n`;
      if (scene.dialogueTurns && scene.dialogueTurns.length > 0) {
        md += `- **Multi-Character Dialogue Turns:**\n`;
        scene.dialogueTurns.forEach((turn) => {
          md += `  - **${turn.speaker}:** "${turn.line}" ${turn.facialExpression ? `[Face: ${turn.facialExpression}]` : ''} ${turn.accompanyingAction ? `[Action: ${turn.accompanyingAction}]` : ''}\n`;
        });
      }
      md += `- **Environment & Setting:** ${scene.environment}\n`;
      md += `- **Key Props:** ${scene.props}\n`;
      md += `- **Camera Framing & Shot:** ${scene.cameraShot}\n`;
      md += `- **Camera Movement:** ${scene.cameraMovement}\n`;
      md += `- **Lighting & Mood:** ${scene.lighting}\n`;
      md += `- **Animation Direction:** ${scene.animationDirection}\n`;
      md += `- **Sound Effects (Foley):** ${scene.soundEffects}\n`;
      md += `- **Background Music Mood:** ${scene.backgroundMusicMood}\n`;
      md += `- **Continuity From Previous Scene:** ${scene.continuityFromPrevious}\n`;
      md += `- **Continuity Into Next Scene:** ${scene.continuityIntoNext}\n`;
      if (scene.startState) md += `- **Start State (Inherited):** ${scene.startState}\n`;
      if (scene.endState) md += `- **End State (Handoff):** ${scene.endState}\n`;
      if (scene.nextSceneHandoff) md += `- **Next Scene Handoff Directive:** ${scene.nextSceneHandoff}\n`;
      if (scene.transitionContract) {
        md += `- **Transition Contract:**\n`;
        md += `  - Prev End: ${scene.transitionContract.previousSceneEnd}\n`;
        md += `  - This Start: ${scene.transitionContract.thisSceneStart}\n`;
        md += `  - This End: ${scene.transitionContract.thisSceneEnd}\n`;
        md += `  - Next Handoff: ${scene.transitionContract.nextSceneHandoff}\n`;
      }
      md += `- **Character Consistency Verification:** ${scene.characterConsistencyNotes}\n`;
      md += `- **Visual Summary:** ${scene.visualDescription}\n\n`;
      md += `#### 🎥 Google Flow / Veo Video Generation Prompt (Scene #${scene.sceneNumber})\n`;
      md += `\`\`\`text\n${scene.finalVideoPrompt}\n\`\`\`\n\n`;
    });

    return md;
  };

  const handleCopy = async (type: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownPackage();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_production_package.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(story, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_production_package.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to export PDF');
      return;
    }
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${story.title} - AnamStudio Production Package</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; max-width: 850px; margin: 0 auto; background: #ffffff; }
    h1 { color: #065f46; border-bottom: 2px solid #065f46; padding-bottom: 12px; font-size: 24px; }
    h2 { color: #047857; margin-top: 35px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; font-size: 18px; }
    h3 { color: #0f766e; margin-top: 24px; font-size: 14px; }
    pre { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #334155; }
    .meta-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; }
    @media print { 
      body { padding: 20px; }
      pre { background: #ffffff; border: 1px solid #cbd5e1; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align: right; margin-bottom: 20px;">
    <button onclick="window.print()" style="background: #059669; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px;">🖨️ Print / Save as PDF</button>
  </div>
  <h1>🎬 ANAMSTUDIO - COMPLETE ANIMATION PRODUCTION PACKAGE</h1>
  <div class="meta-box">
    <strong>Project:</strong> ${story.title}<br/>
    <strong>Language:</strong> ${story.language} | <strong>Target Duration:</strong> ${story.duration} | <strong>Scenes:</strong> ${story.scenes?.length || 0}<br/>
    <strong>Moral:</strong> ${story.moral}
  </div>
  <pre>${markdownContent}</pre>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 500); };
  </script>
</body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const markdownContent = generateMarkdownPackage();

  return (
    <AnimatePresence>
      <div
        id="production-package-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-[10px] sm:p-4 bg-slate-900/40 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          id="production-package-modal"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Modal Header */}
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Clapperboard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  📦 Complete Animation Production Package
                </h3>
                <p className="text-xs text-slate-700 font-medium">
                  Full Story Script, Character Bible, Reference Prompts, and 10-Second Scene Breakdown
                </p>
              </div>
            </div>

            <button
              id="close-package-modal-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-200/60 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Stats & Controls Bar */}
          <div className="px-5 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-slate-700">
              <span className="flex items-center gap-1 font-semibold">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                {story.language} ({story.duration})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                {story.characters?.length || 0} Locked Characters
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold">
                <Film className="w-3.5 h-3.5 text-indigo-600" />
                {story.scenes?.length || 0} Video Scenes
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  id="tab-markdown-preview-btn"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950 font-semibold'
                  }`}
                >
                  Formatted Preview
                </button>
                <button
                  id="tab-json-preview-btn"
                  onClick={() => setActiveTab('json')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'json'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-slate-700 hover:text-slate-950 font-semibold'
                  }`}
                >
                  Raw JSON
                </button>
              </div>

              <button
                id="copy-markdown-package-btn"
                onClick={() => handleCopy('markdown', markdownContent)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                {copiedType === 'markdown' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-100" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Package
                  </>
                )}
              </button>

              <button
                id="download-md-btn"
                onClick={handleDownloadMarkdown}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Download as Markdown file"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                .MD
              </button>

              <button
                id="download-json-btn"
                onClick={handleDownloadJSON}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Download as JSON file"
              >
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                .JSON
              </button>

              <button
                id="export-pdf-btn"
                onClick={handleExportPDF}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title="Export formatted story and character bible as PDF / Print document"
              >
                <Printer className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-5 flex-1 overflow-y-auto font-mono text-xs text-slate-800 leading-relaxed bg-slate-50/50">
            {activeTab === 'preview' ? (
              <pre className="whitespace-pre-wrap font-sans text-xs bg-white p-4 rounded-xl border border-slate-200 select-text leading-relaxed">
                {markdownContent}
              </pre>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-xs bg-white p-4 rounded-xl border border-slate-200 select-text leading-relaxed">
                {JSON.stringify(story, null, 2)}
              </pre>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-700 font-medium">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Production-ready formatting for Google Flow & Veo prompts</span>
            </div>

            <button
              id="close-package-modal-bottom-btn"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
