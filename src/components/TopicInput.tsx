import React, { useState, useMemo } from 'react';
import { StoryLanguage, StoryMode, TopicSuggestion } from '../types';
import { TOPIC_SUGGESTIONS } from '../data/suggestions';
import { Sparkles, Dices, X, Lightbulb, ChevronDown, ChevronUp, Check, Users, Layers, Search, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TopicInputProps {
  value: string;
  onChange: (val: string) => void;
  selectedLanguage: StoryLanguage;
  onPlayPop?: () => void;
  onSelectStoryMode?: (mode: StoryMode) => void;
}

type IdeaCategory = 'ALL' | 'Friendship' | 'Adventure' | 'Moral Story' | 'Comedy & Fun' | 'Mystery & Magic';

export const TopicInput: React.FC<TopicInputProps> = ({
  value,
  onChange,
  selectedLanguage,
  onPlayPop,
  onSelectStoryMode,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<IdeaCategory>('ALL');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [shuffledSeed, setShuffledSeed] = useState<number>(0);

  // Filter ideas strictly for the selected language
  const languageSuggestions = useMemo(() => {
    const list = TOPIC_SUGGESTIONS.filter((s) => s.language === selectedLanguage);
    return list.length > 0 ? list : TOPIC_SUGGESTIONS;
  }, [selectedLanguage]);

  // Apply category and search filters
  const filteredSuggestions = useMemo(() => {
    let list = languageSuggestions;
    if (selectedCategory !== 'ALL') {
      list = list.filter((item) => item.category === selectedCategory);
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.topic.toLowerCase().includes(q) ||
          item.vibe.toLowerCase().includes(q) ||
          (item.characters && item.characters.some((c) => c.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [languageSuggestions, selectedCategory, searchFilter, shuffledSeed]);

  const handleRandomIdea = () => {
    const list = languageSuggestions;
    const randomItem = list[Math.floor(Math.random() * list.length)];
    if (randomItem) {
      onChange(randomItem.topic);
      if (randomItem.suggestedMode && onSelectStoryMode) {
        onSelectStoryMode(randomItem.suggestedMode);
      }
      if (onPlayPop) onPlayPop();
    }
  };

  const handleSelectIdea = (item: TopicSuggestion) => {
    onChange(item.topic);
    if (item.suggestedMode && onSelectStoryMode) {
      onSelectStoryMode(item.suggestedMode);
    }
    if (onPlayPop) onPlayPop();
  };

  const handleShuffle = () => {
    setShuffledSeed((prev) => prev + 1);
    if (onPlayPop) onPlayPop();
  };

  const getPlaceholder = () => {
    switch (selectedLanguage) {
      case 'Hindi':
        return 'उदाहरण: गाजर और टमाटर की अनोखी दोस्ती, आलू और शिमला मिर्च की जादुई रेस... (नीचे दिए गए 15 सुझावों में से भी चुन सकते हैं)';
      case 'Urdu':
        return 'مثال: گاجر اور ٹماٹر کی انوکھی دوستی، آلو اور شملہ مرچ کی دلچسپ دوڑ... (نیچے دی گئی 15 کہانیوں میں سے بھی منتخب کر سکتے ہیں)';
      default:
        return 'e.g. Gajar aur Tamatar ki dosti, Aloo aur Shimla Mirch ki race, Baingan Raja ka cake... (Or pick from 15 curated ideas below)';
    }
  };

  const categories: { id: IdeaCategory; label: string }[] = [
    { id: 'ALL', label: `All Ideas (${languageSuggestions.length})` },
    { id: 'Friendship', label: 'Friendship' },
    { id: 'Adventure', label: 'Adventure' },
    { id: 'Moral Story', label: 'Moral & Wisdom' },
    { id: 'Comedy & Fun', label: 'Comedy & Fun' },
    { id: 'Mystery & Magic', label: 'Mystery & Magic' },
  ];

  return (
    <div className="w-full space-y-3">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="story-topic-input"
          className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-slate-800"
        >
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>3. Story Topic & Concept</span>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
            {languageSuggestions.length} Curated Ideas
          </span>
        </label>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleShuffle}
            title="Shuffle ideas view"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            <Shuffle className="w-3 h-3 text-slate-700" />
            <span className="hidden sm:inline">Shuffle</span>
          </button>
          <button
            type="button"
            onClick={handleRandomIdea}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
          >
            <Dices className="w-3.5 h-3.5 text-amber-600" />
            <span>Surprise Idea</span>
          </button>
        </div>
      </div>

      {/* Main Textarea */}
      <div className="relative">
        <textarea
          id="story-topic-input"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={getPlaceholder()}
          dir={selectedLanguage === 'Urdu' ? 'rtl' : 'ltr'}
          className={`w-full p-4 text-sm sm:text-base font-medium rounded-xl border transition-colors resize-none shadow-xs bg-white text-slate-900 placeholder:text-slate-600 font-medium ${
            value.trim()
              ? 'border-emerald-500 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/30 outline-hidden'
              : 'border-slate-300 focus:border-slate-400 outline-hidden'
          } ${selectedLanguage === 'Urdu' ? 'font-serif text-lg leading-relaxed' : ''}`}
        />

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              if (onPlayPop) onPlayPop();
            }}
            className="absolute top-3.5 right-3.5 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 transition-colors font-bold cursor-pointer"
            title="Clear text"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggested Story Ideas Section */}
      <div className="space-y-2.5 pt-1 rounded-xl bg-slate-50/70 border border-slate-200 p-3 sm:p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900">
              Suggested Story Ideas for {selectedLanguage}
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
              {languageSuggestions.length} Available
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onPlayPop) onPlayPop();
              setIsExpanded((prev) => !prev);
            }}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isExpanded ? 'Collapse Ideas' : `Browse All ${languageSuggestions.length} Ideas`}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Category Filter Pills & Search */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (onPlayPop) onPlayPop();
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-2xs font-bold'
                      : 'bg-white text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {isExpanded && (
            <div className="relative w-full sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search ideas..."
                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-900 placeholder:text-slate-600 font-medium focus:outline-hidden focus:border-emerald-500"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Ideas Display: Quick Chips vs Expanded Rich Grid */}
        {!isExpanded ? (
          /* Compact View: Shows quick clickable chips (up to 8) with a button to show all 15 */
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap gap-2">
              {filteredSuggestions.slice(0, 8).map((item, idx) => {
                const isSelected = value.trim() === item.topic.trim();
                return (
                  <motion.button
                    key={idx}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleSelectIdea(item)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer text-left border ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 border-emerald-400 ring-1 ring-emerald-500/30 font-bold shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-950 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-emerald-600 ml-0.5" />}
                  </motion.button>
                );
              })}
            </div>

            {filteredSuggestions.length > 8 && (
              <div className="pt-1 text-center sm:text-left">
                <button
                  type="button"
                  onClick={() => {
                    if (onPlayPop) onPlayPop();
                    setIsExpanded(true);
                  }}
                  className="text-xs font-bold text-emerald-800 hover:text-emerald-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>+ View remaining {filteredSuggestions.length - 8} ideas ({filteredSuggestions.length} total)</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Expanded Full View: Detailed cards for all 15 ideas with cast, vibes, and 1-click select */
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1.5 max-h-96 overflow-y-auto pr-1"
            >
              {filteredSuggestions.map((item, idx) => {
                const isSelected = value.trim() === item.topic.trim();
                return (
                  <motion.div
                    key={idx}
                    whileHover={{ translateY: -1 }}
                    onClick={() => handleSelectIdea(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'bg-emerald-50/70 border-emerald-500 ring-1 ring-emerald-500/40 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-300 hover:border-slate-400 shadow-2xs'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{item.emoji}</span>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug truncate">
                            {item.label}
                          </h4>
                        </div>
                        {isSelected && (
                          <span className="p-0.5 rounded-full bg-emerald-600 text-white shrink-0">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-800 font-medium leading-relaxed line-clamp-3 break-words">
                        {item.topic}
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-1 text-[10.5px]">
                      {item.category && (
                        <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {item.category}
                        </span>
                      )}
                      {item.vibe && (
                        <span className="text-amber-800 font-semibold italic">
                          {item.vibe}
                        </span>
                      )}
                      {item.characters && item.characters.length > 0 && (
                        <div className="w-full flex items-center gap-1 text-slate-700 font-medium mt-0.5 truncate">
                          <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">Cast: {item.characters.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
