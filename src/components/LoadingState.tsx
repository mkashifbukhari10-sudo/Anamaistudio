import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Film,
  Sparkles,
  Users,
  Clapperboard,
  Video,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface LoadingStateProps {
  duration?: string;
  topic?: string;
}

const PRODUCTION_PHASES = [
  {
    step: 'Phase 1: Narrative & Cast Scope Analysis',
    detail: 'Analyzing character relationships, story arc, emotional progression & dynamic cast sizing...',
    icon: Sparkles,
  },
  {
    step: 'Phase 2: Master Character Bible Compilation',
    detail: 'Generating 18-point physical anatomy, voice, expressions & locked visual descriptions...',
    icon: Users,
  },
  {
    step: 'Phase 3: Character Reference Studio Asset Generation',
    detail: 'Synthesizing Full-Body, Front-Facing, Model Sheet & Flow consistency instructions for all characters...',
    icon: ShieldCheck,
  },
  {
    step: 'Phase 4: Cinematic Chapter & Multi-Act Planning',
    detail: 'Structuring narrative beats, complications, emotional low-points, climax & wholesome moral...',
    icon: Clapperboard,
  },
  {
    step: 'Phase 5: 10-Second Production Scene Orchestration',
    detail: 'Synthesizing shot-by-shot timeline with single visual focus, dialogue & camera blocking...',
    icon: Film,
  },
  {
    step: 'Phase 6: Google Flow & Veo Cinematography Prompts',
    detail: 'Formatting camera motion, lighting, character consistency notes & audio direction...',
    icon: Video,
  },
  {
    step: 'Phase 7: Timeline Validation & Pre-Production Verification',
    detail: 'Validating continuous timestamps, character presence & compiling full production package...',
    icon: CheckCircle2,
  },
];

export const LoadingState: React.FC<LoadingStateProps> = ({ duration, topic }) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(8);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    const phaseInterval = setInterval(() => {
      setPhaseIndex((prev) => {
        if (prev < PRODUCTION_PHASES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 3200);

    const progressInterval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev < 94) {
          return prev + Math.floor(Math.random() * 4) + 1;
        }
        return prev;
      });
    }, 800);

    return () => {
      clearInterval(timer);
      clearInterval(phaseInterval);
      clearInterval(progressInterval);
    };
  }, []);

  const currentPhase = PRODUCTION_PHASES[phaseIndex];
  const CurrentIcon = currentPhase.icon;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="w-full max-w-3xl mx-auto my-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs text-slate-800 space-y-7"
    >
      {/* Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Film className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <span>AnamStudio Pre-Production Engine</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase font-semibold">
                Active Director
              </span>
            </h3>
            <p className="text-xs text-slate-700 font-mono font-medium">
              Elapsed Time: {formatTime(elapsedSeconds)} • Target: {duration || 'Cinematic Story'}
            </p>
          </div>
        </div>

        <div className="text-right font-mono text-xs">
          <span className="text-slate-700 font-medium">Progress: </span>
          <span className="text-emerald-700 font-bold text-sm">{progressPercent}%</span>
        </div>
      </div>

      {/* Main Phase Display */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
            <CurrentIcon className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1 flex-1">
            <span className="text-xs font-mono font-bold text-emerald-700 uppercase tracking-wider">
              {currentPhase.step}
            </span>
            <h4 className="text-lg font-bold text-slate-900 tracking-tight">
              {topic ? `Directing "${topic}"` : 'Directing Animated Pre-Production Package'}
            </h4>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {currentPhase.detail}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-200 relative">
            <motion.div
              className="h-full bg-emerald-600 rounded-full"
              initial={{ width: '8%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ ease: 'easeOut', duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-700 font-semibold">
            <span>Phase {phaseIndex + 1} of {PRODUCTION_PHASES.length}</span>
            <span>Batch Scene Synthesis Enabled</span>
          </div>
        </div>
      </div>

      {/* Production Pipeline Roadmap */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
        <div className={`p-2.5 rounded-xl border ${phaseIndex >= 0 ? 'bg-white border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
          <div className="text-[10px] text-slate-700 font-semibold">01. CAST</div>
          <div className="font-semibold text-xs mt-0.5">Dynamic Sizing</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${phaseIndex >= 2 ? 'bg-white border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
          <div className="text-[10px] text-slate-700 font-semibold">02. BIBLE</div>
          <div className="font-semibold text-xs mt-0.5">18-Pt Locked</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${phaseIndex >= 4 ? 'bg-white border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
          <div className="text-[10px] text-slate-700 font-semibold">03. SCENES</div>
          <div className="font-semibold text-xs mt-0.5">10s Precision</div>
        </div>
        <div className={`p-2.5 rounded-xl border ${phaseIndex >= 5 ? 'bg-white border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
          <div className="text-[10px] text-slate-700 font-semibold">04. PROMPTS</div>
          <div className="font-semibold text-xs mt-0.5">Google Flow / Veo</div>
        </div>
      </div>
    </motion.div>
  );
};
