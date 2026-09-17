import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Film, Sparkles, Users, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Live generation progress.
 *
 * This previously ran its own timer, climbing by a random 1-4% every 800ms and
 * freezing at 94% no matter what the server was doing - so it read "96%" while
 * a run was still on its first call, or had already failed. Everything shown
 * here now comes from the server's real phase and scene counts.
 *
 * When progress is not yet known - the first second or two, or a serverless
 * instance that does not hold the snapshot - it says so and shows elapsed time
 * instead of inventing a number.
 */

export interface GenerationProgressView {
  known: boolean;
  phase?: string;
  label?: string;
  detail?: string;
  percent?: number;
  scenesDone?: number;
  scenesTotal?: number;
  batchesDone?: number;
  batchesTotal?: number;
}

interface LoadingStateProps {
  duration?: string;
  topic?: string;
  progress?: GenerationProgressView | null;
}

const PHASE_ICONS: Record<string, React.ElementType> = {
  starting: Loader2,
  blueprint: Sparkles,
  screenplay: Users,
  scenes: Film,
  validating: ShieldCheck,
  complete: CheckCircle2,
  failed: ShieldCheck,
};

/** The real server phases, in order, so the UI can show what is done. */
const PHASE_ORDER = ['blueprint', 'screenplay', 'scenes', 'validating'] as const;
const PHASE_NAMES: Record<string, string> = {
  blueprint: 'Story architecture',
  screenplay: 'Screenplay & cast',
  scenes: 'Scenes',
  validating: 'Validation',
};

export const LoadingState: React.FC<LoadingStateProps> = ({ duration, topic, progress }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Elapsed time is the one thing the client legitimately knows on its own.
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  const known = Boolean(progress?.known);
  const phase = progress?.phase ?? 'starting';
  const percent = known ? Math.max(0, Math.min(100, progress?.percent ?? 0)) : 0;
  const Icon = PHASE_ICONS[phase] ?? Loader2;
  const currentIndex = PHASE_ORDER.indexOf(phase as (typeof PHASE_ORDER)[number]);

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">AnamStudio Pre-Production Engine</h3>
            <p className="text-[11px] sm:text-xs text-slate-600 font-mono">
              Elapsed {formatTime(elapsedSeconds)}
              {duration ? ` • ${duration} story` : ''}
            </p>
          </div>
        </div>

        <div className="text-right">
          {known ? (
            <>
              <span className="text-xs text-slate-700 font-medium">Progress: </span>
              <span className="text-emerald-700 font-bold text-sm">{percent}%</span>
            </>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">working…</span>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
            <Icon className={`w-5 h-5 ${phase === 'starting' ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-wider text-emerald-700 font-bold">
              {progress?.label ?? 'Preparing'}
            </p>
            {topic && <p className="font-bold text-slate-900 text-sm mt-0.5 break-words">Directing “{topic}”</p>}
            <p className="text-xs text-slate-600 mt-1 break-words">
              {progress?.detail ?? 'Contacting the story engine…'}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            {known ? (
              <motion.div
                className="h-full bg-emerald-600 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            ) : (
              // Indeterminate: a moving stripe that promises nothing.
              <motion.div
                className="h-full w-1/3 bg-emerald-500/70 rounded-full"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
            <span>
              {known && currentIndex >= 0
                ? `Step ${currentIndex + 1} of ${PHASE_ORDER.length}`
                : 'Long stories take several minutes'}
            </span>
            {known && phase === 'scenes' && (progress?.scenesTotal ?? 0) > 0 && (
              <span>
                {progress!.scenesDone ?? 0} / {progress!.scenesTotal} scenes
                {(progress?.batchesTotal ?? 0) > 1
                  ? ` • batch ${progress!.batchesDone ?? 0}/${progress!.batchesTotal}`
                  : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PHASE_ORDER.map((step, index) => {
          const done = known && currentIndex > index;
          const active = known && currentIndex === index;
          return (
            <div
              key={step}
              className={`px-3 py-2 rounded-xl border text-left transition-colors ${
                done
                  ? 'bg-emerald-50 border-emerald-300'
                  : active
                  ? 'bg-white border-emerald-400 ring-1 ring-emerald-400/30'
                  : 'bg-white border-slate-200'
              }`}
            >
              <p className="font-mono text-[10px] text-slate-500">
                {String(index + 1).padStart(2, '0')}
                {done ? ' ✓' : ''}
              </p>
              <p
                className={`text-[11px] font-bold ${
                  done || active ? 'text-emerald-800' : 'text-slate-600'
                }`}
              >
                {PHASE_NAMES[step]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
