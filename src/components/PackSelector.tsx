import React from 'react';
import { PACKS, type PackId, type PackDescriptor } from '../shared/packs';
import { Sprout, Egg, MessageSquare, VolumeX } from 'lucide-react';
import { motion } from 'motion/react';

interface PackSelectorProps {
  value: PackId;
  onChange: (pack: PackId) => void;
  onPlayPop?: () => void;
  /** Locked once a story exists, so a half-generated film cannot change world. */
  disabled?: boolean;
}

const PACK_ICON: Record<PackId, React.ElementType> = {
  vegetables: Sprout,
  poultry: Egg,
};

/**
 * Which film world this story is told in.
 *
 * First in the form, before language and mode, because it is the most
 * consequential choice on the page: it decides the cast, and — for a wordless
 * pack — whether the film has dialogue at all. Everything below it is a
 * refinement of a decision made here.
 */
export const PackSelector: React.FC<PackSelectorProps> = ({
  value,
  onChange,
  onPlayPop,
  disabled = false,
}) => {
  const handleSelect = (pack: PackDescriptor) => {
    if (disabled || pack.id === value) return;
    onPlayPop?.();
    onChange(pack.id);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <label className="block text-sm font-bold text-slate-900">
          Story World
        </label>
        {disabled && (
          <span className="text-xs text-slate-500">
            Locked for this story
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PACKS.map((pack) => {
          const Icon = PACK_ICON[pack.id] ?? Sprout;
          const isActive = pack.id === value;
          const wordless = pack.dialogue === 'none';
          const SpeechIcon = wordless ? VolumeX : MessageSquare;

          return (
            <motion.button
              key={pack.id}
              type="button"
              onClick={() => handleSelect(pack)}
              disabled={disabled}
              aria-pressed={isActive}
              whileTap={disabled ? undefined : { scale: 0.985 }}
              className={[
                'relative text-left rounded-xl border p-4 transition-colors',
                disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                isActive
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                    isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600',
                  ].join(' ')}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">
                      {pack.emoji} {pack.label}
                    </span>
                    <span
                      className={[
                        'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                        isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700',
                      ].join(' ')}
                    >
                      {pack.badge}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    {pack.description}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2.5 text-[11px] font-medium text-slate-500">
                    <SpeechIcon className="w-3.5 h-3.5" />
                    <span>
                      {wordless
                        ? 'No spoken lines — action, Foley and score'
                        : 'Full spoken dialogue'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
