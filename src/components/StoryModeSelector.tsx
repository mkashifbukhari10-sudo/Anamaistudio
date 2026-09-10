import React from 'react';
import { StoryMode } from '../types';
import {
  Sparkles,
  Heart,
  Film,
  Compass,
  Smile,
  Users,
  Award,
  Search,
  Wand2,
  Clapperboard,
} from 'lucide-react';
import { motion } from 'motion/react';

interface StoryModeSelectorProps {
  value: StoryMode;
  onChange: (mode: StoryMode) => void;
  onPlayPop?: () => void;
}

export interface StoryModeOption {
  id: StoryMode;
  title: string;
  badge: string;
  description: string;
  emoji: string;
  icon: React.ElementType;
  isCinematicSpecial?: boolean;
}

export const STORY_MODES: StoryModeOption[] = [
  {
    id: 'Cinematic Emotional',
    title: 'Cinematic Emotional',
    badge: 'Recommended',
    description: 'Deep emotional arc, genuine stakes, 18-beat cinematic narrative & warm heartfelt ending',
    emoji: '🎬❤️',
    icon: Clapperboard,
    isCinematicSpecial: true,
  },
  {
    id: 'Cinematic',
    title: 'Cinematic',
    badge: 'Feature Film',
    description: 'Grand movie-grade pacing, atmospheric visual storytelling & dramatic tension',
    emoji: '🎥✨',
    icon: Film,
    isCinematicSpecial: true,
  },
  {
    id: 'Heartwarming',
    title: 'Heartwarming',
    badge: 'Cozy & Sweet',
    description: 'Gentle, touching moments of care, empathy and tender vegetable relationships',
    emoji: '💖🌱',
    icon: Heart,
  },
  {
    id: 'Emotional',
    title: 'Emotional',
    badge: 'Feelings & Hope',
    description: 'Explores vulnerability, sadness, perseverance and triumphant relief for kids',
    emoji: '🥺🌈',
    icon: Heart,
  },
  {
    id: 'Friendship',
    title: 'Friendship',
    badge: 'Bonds & Trust',
    description: 'Celebrating companionship, resolving misunderstandings and being there for each other',
    emoji: '🤝🥕',
    icon: Users,
  },
  {
    id: 'Moral Story',
    title: 'Moral Story',
    badge: 'Life Lessons',
    description: 'Clear, meaningful character virtues: honesty, patience, sharing and kindness',
    emoji: '🌟📖',
    icon: Award,
  },
  {
    id: 'Adventure',
    title: 'Adventure',
    badge: 'Exciting Quest',
    description: 'Thrilling journey across unexplored garden beds, windy meadows and secret paths',
    emoji: '🧭🗺️',
    icon: Compass,
  },
  {
    id: 'Funny & Slapstick',
    title: 'Funny & Slapstick',
    badge: 'Giggles & Joy',
    description: 'Bouncy comedic mishaps, playful vegetable blunders and joyful laughter',
    emoji: '😂🎉',
    icon: Smile,
  },
  {
    id: 'Mystery',
    title: 'Mystery',
    badge: 'Curious Puzzles',
    description: 'Gentle, intriguing veggie investigations with clues and satisfying surprises',
    emoji: '🔍🕵️',
    icon: Search,
  },
  {
    id: 'Fantasy',
    title: 'Fantasy',
    badge: 'Magical World',
    description: 'Glowing raindrops, enchanted root tunnels and whimsical garden wonderlands',
    emoji: '✨🍄',
    icon: Wand2,
  },
  {
    id: 'Simple Kids Story',
    title: 'Simple Kids Story',
    badge: 'Quick & Sweet',
    description: 'Lighthearted, easy-to-follow playful day in Veggieville for younger toddlers',
    emoji: '🎈🥦',
    icon: Sparkles,
  },
];

export const StoryModeSelector: React.FC<StoryModeSelectorProps> = ({
  value,
  onChange,
  onPlayPop,
}) => {
  return (
    <div id="story-mode-selector-container" className="w-full space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
          <Clapperboard className="w-4 h-4 text-emerald-600" />
          <span>2. Story Mode & Narrative Arc</span>
        </label>
        <span className="text-[11px] text-slate-700 font-mono font-semibold">
          Tone & cinematic depth
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {STORY_MODES.map((mode) => {
          const isSelected = value === mode.id;

          return (
            <motion.button
              key={mode.id}
              id={`story-mode-btn-${mode.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                onChange(mode.id);
                if (onPlayPop) onPlayPop();
              }}
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-emerald-50/70 border-emerald-500 text-slate-900 shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base select-none">{mode.emoji}</span>
                  <span className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                    {mode.title}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                    isSelected
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : mode.isCinematicSpecial
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {isSelected ? 'Active' : mode.badge}
                </span>
              </div>

              <p className="text-[11.5px] text-slate-700 font-medium leading-snug line-clamp-2">
                {mode.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
