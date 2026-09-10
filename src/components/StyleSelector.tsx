import React from 'react';
import { AnimationStyle } from '../types';
import { Palette, Sparkles, Smile, Film } from 'lucide-react';
import { motion } from 'motion/react';

interface StyleSelectorProps {
  value: AnimationStyle;
  onChange: (style: AnimationStyle) => void;
  onPlayPop?: () => void;
}

const STYLES: {
  id: AnimationStyle;
  title: string;
  badge: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: 'Cute 3D',
    title: 'Cute 3D',
    badge: 'Pixar / Illumination',
    description: 'Chubby veggies with glossy eyes, bouncy expressions and playful physics',
    icon: Smile,
  },
  {
    id: 'Cartoon',
    title: 'Cartoon',
    badge: 'Classic 2D Toon',
    description: 'Vibrant slapstick fun with exaggerated squashes, stretches and comic sounds',
    icon: Sparkles,
  },
  {
    id: 'Cinematic 3D',
    title: 'Cinematic 3D',
    badge: 'Animated Feature',
    description: 'Atmospheric lighting, dramatic hero shots, cinematic veggie adventures',
    icon: Film,
  },
];

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  value,
  onChange,
  onPlayPop,
}) => {
  return (
    <div className="w-full space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
          <Palette className="w-4 h-4 text-purple-600" />
          <span>5. Animation Visual Style</span>
        </label>
        <span className="text-[11px] text-slate-700 font-mono font-semibold">
          Aesthetic render pipeline
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STYLES.map((st) => {
          const isSelected = value === st.id;
          const Icon = st.icon;
          return (
            <motion.button
              key={st.id}
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                onChange(st.id);
                if (onPlayPop) onPlayPop();
              }}
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer relative ${
                isSelected
                  ? 'bg-purple-50/70 border-purple-500 text-slate-900 shadow-xs ring-1 ring-purple-500/30'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg border ${
                      isSelected
                        ? 'bg-purple-100 text-purple-800 border-purple-300'
                        : 'bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-900">
                    {st.title}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                    isSelected
                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                >
                  {st.badge}
                </span>
              </div>

              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                {st.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
