import React from 'react';
import { StoryDuration } from '../types';
import {
  DURATION_PRESETS,
  DurationPreset,
  calculateSceneCount,
  calculateCustomSceneCount,
  clampCustomMinutes,
  findDurationPreset,
  formatTotalDuration,
  isCustomDuration,
  CUSTOM_MINUTES_MIN,
  CUSTOM_MINUTES_MAX,
  CUSTOM_MINUTES_STEP,
  CUSTOM_QUICK_MINUTES,
} from '../shared/duration';
import { Clock, Zap, Flame, BookMarked, Sparkles, Film, Clapperboard, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DurationSelectorProps {
  value: StoryDuration;
  onChange: (dur: StoryDuration) => void;
  customMinutes?: number;
  onCustomMinutesChange?: (mins: number) => void;
  onPlayPop?: () => void;
}

/**
 * Presentation only. The duration values, labels, scene counts and long-form
 * flags come from shared/duration.ts; this map just pins an icon and a colour
 * to each preset id so the picker keeps its current look.
 */
const PRESET_VISUALS: Record<string, { icon: React.ElementType; iconColor: string }> = {
  '30 seconds': { icon: Zap, iconColor: 'text-amber-700 bg-amber-50 border-amber-200' },
  '60 seconds': { icon: Flame, iconColor: 'text-orange-700 bg-orange-50 border-orange-200' },
  '90 seconds': { icon: BookMarked, iconColor: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  '2 minutes': { icon: Sparkles, iconColor: 'text-purple-700 bg-purple-50 border-purple-200' },
  '4 minutes': { icon: Film, iconColor: 'text-rose-700 bg-rose-50 border-rose-200' },
  '5 minutes': { icon: Clapperboard, iconColor: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  '6 minutes': { icon: Film, iconColor: 'text-violet-700 bg-violet-50 border-violet-200' },
  '7 minutes': { icon: Sparkles, iconColor: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200' },
  '8 minutes': { icon: BookMarked, iconColor: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
  '9 minutes': { icon: Film, iconColor: 'text-amber-700 bg-amber-50 border-amber-200' },
  '10 minutes': { icon: Clapperboard, iconColor: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  'Custom': { icon: Sliders, iconColor: 'text-teal-700 bg-teal-50 border-teal-200' },
};

const FALLBACK_VISUAL = { icon: Clock, iconColor: 'text-slate-700 bg-slate-50 border-slate-200' };

type DurationOption = DurationPreset & { icon: React.ElementType; iconColor: string };

const DURATIONS: DurationOption[] = DURATION_PRESETS.map((preset) => ({
  ...preset,
  ...(PRESET_VISUALS[preset.id] || FALLBACK_VISUAL),
}));

export const DurationSelector: React.FC<DurationSelectorProps> = ({
  value,
  onChange,
  customMinutes = 3,
  onCustomMinutesChange,
  onPlayPop,
}) => {
  const isCustom = isCustomDuration(value);
  const customOption = DURATIONS.find((d) => d.isCustom) as DurationOption;
  const defaultOption = DURATIONS.find((d) => d.id === '60 seconds') as DurationOption;
  const activeOption = DURATIONS.find((d) => d.id === value) || (isCustom ? customOption : defaultOption);

  const customEstimatedScenes = calculateCustomSceneCount(customMinutes);
  const isLongFormActive =
    (findDurationPreset(value)?.isLongForm ?? false) || (isCustom && customMinutes >= 4);

  const getEstimatedScenesNumber = (): number => {
    if (isCustom) return customEstimatedScenes;
    const preset = findDurationPreset(value);
    if (preset) return preset.scenesCount;
    if (activeOption) return activeOption.scenesCount;
    return calculateSceneCount(value);
  };

  const getTotalDurationText = (): string => {
    // Custom keeps its literal "N:00 Runtime" wording (N may be fractional).
    if (isCustom) return `${customMinutes}:00 Runtime`;
    return `${formatTotalDuration(getEstimatedScenesNumber())} Runtime`;
  };

  const handleSelect = (item: DurationOption) => {
    if (onPlayPop) onPlayPop();
    if (item.id === 'Custom') {
      onChange(`Custom: ${customMinutes} minutes`);
    } else {
      onChange(item.id as StoryDuration);
    }
  };

  const handleCustomChange = (mins: number) => {
    const clamped = clampCustomMinutes(mins);
    if (onCustomMinutesChange) {
      onCustomMinutesChange(clamped);
    }
    onChange(`Custom: ${clamped} minutes`);
  };

  return (
    <div id="duration-selector-container" className="w-full space-y-3">
      {/* Header with Title & Estimated Scenes & Long-Form Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>4. Story Duration & Scene Planning</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {/* Estimated Scenes Pill */}
          <span
            id="estimated-scenes-pill"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-slate-700 text-xs font-mono border border-slate-200 shadow-xs"
          >
            <Film className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              <strong className="text-emerald-700 font-bold">{getEstimatedScenesNumber()} Scenes</strong> (~10s each)
            </span>
            <span className="text-slate-600 font-bold">|</span>
            <span className="text-amber-700 font-semibold">{getTotalDurationText()}</span>
          </span>

          {/* Long-Form Cinematic Badge when 4m-10m or custom >=4m */}
          {isLongFormActive && (
            <motion.span
              id="long-form-cinematic-indicator"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 text-xs font-mono font-bold border border-amber-200"
            >
              <span>🎬 Long-Form Cinematic Mode</span>
            </motion.span>
          )}
        </div>
      </div>

      {/* Duration Option Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5">
        {DURATIONS.map((item) => {
          const isSelected = item.id === 'Custom' ? isCustom : value === item.id;
          const Icon = item.icon;

          const sceneBadgeText =
            item.id === 'Custom'
              ? isCustom
                ? `≈ ${customEstimatedScenes} Scenes`
                : 'Custom Scenes'
              : `≈ ${item.scenesCount} Scenes`;

          return (
            <motion.button
              key={item.id}
              id={`duration-btn-${item.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleSelect(item)}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between relative ${
                isSelected
                  ? 'bg-emerald-50/70 border-emerald-500 text-slate-900 shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg border ${item.iconColor}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                {isSelected ? (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Active
                  </span>
                ) : item.isLongForm ? (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                    Long
                  </span>
                ) : null}
              </div>

              <div>
                <span className="block font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                  {item.label}
                </span>
                <span className="block text-[11px] font-mono font-bold text-emerald-700 mt-0.5">
                  {sceneBadgeText}
                </span>
                <span className="block text-[10px] text-slate-700 font-semibold truncate mt-0.5 font-mono">
                  {item.id === 'Custom' && isCustom ? `${customMinutes} mins` : item.tag}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Custom Duration Expansion Slider / Stepper */}
      <AnimatePresence>
        {isCustom && (
          <motion.div
            id="custom-duration-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-800">
                    Custom Target Duration: <strong className="text-emerald-700 font-mono">{customMinutes} Minutes</strong> ({customMinutes * 60} seconds)
                  </span>
                </div>

                <div className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Target: ≈ {customEstimatedScenes} Scenes (~10s each)
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <input
                  id="custom-minutes-range"
                  type="range"
                  min={CUSTOM_MINUTES_MIN}
                  max={CUSTOM_MINUTES_MAX}
                  step={CUSTOM_MINUTES_STEP}
                  value={customMinutes}
                  onChange={(e) => handleCustomChange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />

                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  {CUSTOM_QUICK_MINUTES.map((quickMin) => (
                    <button
                      key={quickMin}
                      id={`custom-quick-${quickMin}m`}
                      type="button"
                      onClick={() => handleCustomChange(quickMin)}
                      className={`px-2 py-1 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${
                        customMinutes === quickMin
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {quickMin}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
