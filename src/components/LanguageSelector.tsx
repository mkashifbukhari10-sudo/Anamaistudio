import React from 'react';
import { StoryLanguage } from '../types';
import { Globe, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface LanguageSelectorProps {
  value: StoryLanguage;
  onChange: (lang: StoryLanguage) => void;
  onPlayPop?: () => void;
}

const LANGUAGES: {
  id: StoryLanguage;
  title: string;
  nativeTitle: string;
  badge: string;
  tagline: string;
  sample: string;
}[] = [
  {
    id: 'Hindi',
    title: 'Hindi',
    nativeTitle: 'हिन्दी',
    badge: 'देवनागरी',
    tagline: 'शुद्ध और सरल हिन्दी कहानियाँ',
    sample: 'नमस्ते दोस्तो! आज हम गाजर और टमाटर की कहानी सुनेंगे...',
  },
  {
    id: 'Urdu',
    title: 'Urdu',
    nativeTitle: 'اردو',
    badge: 'اردو رسم الخط',
    tagline: 'پیاری اور سبق آموز کہانیاں',
    sample: 'پیارے بچو! آج ہم سبزی باغ کی ایک انوکھی کہانی سنیں گے...',
  },
  {
    id: 'Roman Urdu',
    title: 'Roman Urdu',
    nativeTitle: 'Roman Urdu',
    badge: 'Latin Script',
    tagline: 'Aasan aur mazedaar kahaniyan',
    sample: 'Ek dafa ka zikr hai, Sabzi Baag mein Golu Gajar rehta tha...',
  },
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  onPlayPop,
}) => {
  return (
    <div className="w-full space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-800">
          <Globe className="w-4 h-4 text-emerald-600" />
          <span>1. Story Language & Script</span>
        </label>
        <span className="text-[11px] text-slate-700 font-mono font-semibold">
          Select target dialect
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LANGUAGES.map((lang) => {
          const isSelected = value === lang.id;
          return (
            <motion.button
              key={lang.id}
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                onChange(lang.id);
                if (onPlayPop) onPlayPop();
              }}
              className={`relative text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-emerald-50/70 border-emerald-500 text-slate-900 shadow-xs ring-1 ring-emerald-500/30'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/80'
              }`}
            >
              {isSelected && (
                <div className="absolute top-3.5 right-3.5 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}

              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-bold text-base text-slate-900">
                  {lang.nativeTitle}
                </span>
                <span className="text-xs text-slate-700 font-semibold">
                  ({lang.title})
                </span>
              </div>

              <p className="text-xs text-slate-700 font-medium line-clamp-1 mb-2.5">
                {lang.tagline}
              </p>

              <div className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium italic truncate font-mono">
                {lang.sample}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
