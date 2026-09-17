import React from 'react';
import { CharacterCount, CHARACTER_COUNT_OPTIONS } from '../types';
import { Users, Wand2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CharacterCountSelectorProps {
  value: CharacterCount;
  onChange: (count: CharacterCount) => void;
  onPlayPop?: () => void;
}

/**
 * Cast-size control.
 *
 * Sets HOW MANY characters the story has, never who they are — identities,
 * roles, personalities and world remain generated from the topic, duration,
 * language and mode. 'Auto' hands sizing back to the runtime-based logic.
 */
export const CharacterCountSelector: React.FC<CharacterCountSelectorProps> = ({
  value,
  onChange,
  onPlayPop,
}) => {
  return (
    <div className="w-full space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
          <Users className="w-4 h-4 text-sky-600" />
          <span>6. Characters</span>
        </label>
        <span className="text-[11px] text-slate-700 font-mono font-semibold">
          {value === 'Auto' ? 'Story decides the cast' : `Exactly ${value} characters`}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Number of characters"
        className="grid grid-cols-3 sm:grid-cols-6 gap-2"
      >
        {CHARACTER_COUNT_OPTIONS.map((option) => {
          const isSelected = value === option;
          const isAuto = option === 'Auto';

          return (
            <motion.button
              key={String(option)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              id={`character-count-${String(option).toLowerCase()}-btn`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                onChange(option);
                if (onPlayPop) onPlayPop();
              }}
              className={`px-2 py-2.5 rounded-xl border text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-1 ${
                isSelected
                  ? 'bg-sky-50/70 border-sky-500 text-slate-900 shadow-xs ring-1 ring-sky-500/30'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/80'
              }`}
            >
              {isAuto ? (
                <Wand2
                  className={`w-4 h-4 ${isSelected ? 'text-sky-700' : 'text-slate-500'}`}
                />
              ) : (
                <span
                  className={`font-black text-base leading-none ${
                    isSelected ? 'text-sky-800' : 'text-slate-800'
                  }`}
                >
                  {option}
                </span>
              )}
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wide ${
                  isSelected ? 'text-sky-800' : 'text-slate-600'
                }`}
              >
                {isAuto ? 'Auto' : 'cast'}
              </span>
            </motion.button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
        {value === 'Auto'
          ? 'The Story Director sizes the cast to the runtime and what the story needs.'
          : `The Story Director will create exactly ${value} characters for this topic and give each a real role, relationships and screen time.`}
      </p>
    </div>
  );
};
