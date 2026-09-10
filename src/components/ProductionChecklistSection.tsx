import React from 'react';
import { VeggieStory } from '../types';
import { computeProductionChecklist, validateTimeline } from '../utils/validation';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Film,
  Users,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ProductionChecklistSectionProps {
  story: VeggieStory;
  onGoToFlow?: () => void;
}

export const ProductionChecklistSection: React.FC<ProductionChecklistSectionProps> = ({
  story,
  onGoToFlow,
}) => {
  const checklist = computeProductionChecklist(story);
  const report = validateTimeline(story);

  const checklistItems = [
    {
      label: 'Character references ready',
      done: checklist.characterReferencesReady,
      detail: `${report.referenceCount} reference packages generated`,
    },
    {
      label: 'Character identities locked',
      done: checklist.characterIdentitiesLocked,
      detail: `${report.characterBibleCount} locked master descriptions in Bible`,
    },
    {
      label: 'Story duration validated',
      done: checklist.storyDurationValidated,
      detail: `Target duration: ${report.selectedDuration}`,
    },
    {
      label: 'Scene count validated',
      done: checklist.sceneCountValidated,
      detail: `${report.actualSceneCount} of ${report.expectedSceneCount} expected scenes`,
    },
    {
      label: 'Timeline validated',
      done: checklist.timelineValidated,
      detail: `Continuous range: ${report.actualTimeline}`,
    },
    {
      label: 'Dialogue validated',
      done: checklist.dialogueValidated,
      detail: `Spoken dialogue formatted in ${story.language}`,
    },
    {
      label: 'Continuity validated',
      done: checklist.continuityValidated,
      detail: 'Visual state chained across scenes',
    },
    {
      label: 'Video prompts generated',
      done: checklist.videoPromptsGenerated,
      detail: 'Google Flow / Veo cinematography prompts ready',
    },
    {
      label: 'Audio direction generated',
      done: checklist.audioDirectionGenerated,
      detail: 'SFX foley cues and music mood tags present',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Studio Production Readiness Card */}
      <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 text-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 shadow-xs">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                checklist.readyForFlow ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
              <span>Production Pipeline Status:</span>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md border uppercase tracking-wider whitespace-nowrap ${
                  checklist.readyForFlow
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {checklist.readyForFlow ? '🟢 READY FOR FLOW' : '⚪ VERIFICATION IN PROGRESS'}
              </span>
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 font-medium max-w-xl">
            {checklist.readyForFlow
              ? 'All pre-production criteria, character consistency constraints, and scene timelines are mathematically verified. Ready for video synthesis.'
              : 'Some pre-production assets or scene batches are still compiling or require confirmation.'}
          </p>
        </div>

        {onGoToFlow && (
          <button
            type="button"
            onClick={onGoToFlow}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer whitespace-nowrap"
          >
            <span>Open Flow Production Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Grid: 1. Production Checklist | 2. Timeline Validation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Production Checklist */}
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <h4 className="font-bold text-sm sm:text-base text-slate-900">Pre-Production Checklist</h4>
            </div>
            <span className="text-xs font-mono text-slate-700 font-semibold whitespace-nowrap">
              {checklistItems.filter((i) => i.done).length} / {checklistItems.length} Verified
            </span>
          </div>

          <div className="space-y-2 sm:space-y-2.5">
            {checklistItems.map((item, idx) => (
              <div
                key={idx}
                className={`p-2.5 sm:p-3 rounded-xl border flex items-start gap-2.5 sm:gap-3 transition-colors ${
                  item.done
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 text-xs min-w-0">
                  <span className="font-semibold text-slate-900 block">{item.label}</span>
                  <span className="text-slate-700 font-medium text-[11px] break-words">{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline & Cast Validation Report (PART 21) */}
        <div className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              <h4 className="font-bold text-sm sm:text-base text-slate-900">Timeline & Cast Validation</h4>
            </div>
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded-md font-semibold whitespace-nowrap ${
                report.isValid
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {report.isValid ? 'VALIDATED' : 'DISCREPANCY DETECTED'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-700 font-semibold block text-[11px]">Selected Duration</span>
              <span className="font-bold text-slate-900 text-sm">{report.selectedDuration}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-700 font-semibold block text-[11px]">Actual Timeline</span>
              <span className="font-mono font-bold text-amber-800 text-sm break-words">{report.actualTimeline}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-700 font-semibold block text-[11px]">Expected Scene Count</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {report.expectedSceneCount} scenes (~10s each)
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-700 font-semibold block text-[11px]">Actual Scene Count</span>
              <span
                className={`font-mono font-bold text-sm ${
                  report.actualSceneCount === report.expectedSceneCount
                    ? 'text-emerald-700'
                    : 'text-amber-800'
                }`}
              >
                {report.actualSceneCount} scenes
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-700 font-semibold block text-[11px]">Dynamic Cast Size</span>
              <span className="font-bold text-slate-900 text-sm">{report.characterCount} characters</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-slate-700 font-semibold block text-[11px]">Character Bible Count</span>
              <span className="font-bold text-emerald-700 text-sm">
                {report.characterBibleCount} of {report.characterCount} locked
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:col-span-2">
              <span className="text-slate-700 font-semibold block text-[11px]">Reference Studio Assets</span>
              <span className="font-bold text-slate-900 text-sm">
                {report.referenceCount} reference packages generated
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 space-y-1.5 text-xs">
            <span className="text-slate-800 font-bold block text-[11px] uppercase tracking-wider">
              Diagnostic Notes:
            </span>
            {report.notes.map((note, i) => (
              <p key={i} className="text-slate-800 text-[11px] font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="break-words">{note}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
