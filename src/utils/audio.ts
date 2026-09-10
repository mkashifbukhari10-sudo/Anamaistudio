// Kid-friendly Web Audio Synthesizer for pleasant UI sound cues
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playPopSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // Gracefully ignore audio errors if blocked by browser policy
  }
}

export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.09);

      gain.gain.setValueAtTime(0.12, ctx.currentTime + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.09 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.09);
      osc.stop(ctx.currentTime + index * 0.09 + 0.35);
    });
  } catch {
    // Gracefully ignore
  }
}

// Story Narration via Web Speech Synthesis
export interface SpeechController {
  speak: (text: string, lang: string, onEnd?: () => void) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  isSpeaking: () => boolean;
  isPaused: () => boolean;
}

export function createSpeechNarration(): SpeechController {
  return {
    speak: (text: string, lang: string, onEnd?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92; // Slightly slower, comfortable for kids
      utterance.pitch = 1.05; // Slightly cheerful pitch

      // Match voice language
      const voices = window.speechSynthesis.getVoices();
      if (lang === 'Hindi') {
        const hindiVoice = voices.find(v => v.lang.startsWith('hi'));
        if (hindiVoice) utterance.voice = hindiVoice;
        utterance.lang = 'hi-IN';
      } else if (lang === 'Urdu') {
        const urduVoice = voices.find(v => v.lang.startsWith('ur'));
        if (urduVoice) utterance.voice = urduVoice;
        utterance.lang = 'ur-PK';
      } else {
        // Roman Urdu / Default
        const indianEngVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('hi'));
        if (indianEngVoice) utterance.voice = indianEngVoice;
      }

      if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
      }

      window.speechSynthesis.speak(utterance);
    },
    pause: () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.pause();
      }
    },
    resume: () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    },
    stop: () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    },
    isSpeaking: () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        return window.speechSynthesis.speaking && !window.speechSynthesis.paused;
      }
      return false;
    },
    isPaused: () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        return window.speechSynthesis.paused;
      }
      return false;
    },
  };
}
