'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mic, Globe, Volume2, VolumeX, Square } from 'lucide-react';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  voiceCode: string;
  /** Short announcement text in that language */
  announcement: string;
  /** Language code for Google TTS ('or' not supported, falls back to 'en') */
  ttsLang: string;
}

const LANGUAGES: Language[] = [
  {
    code: 'en', name: 'English',   nativeName: 'English',  flag: '🇺🇸', voiceCode: 'en-IN', ttsLang: 'en',
    announcement: 'Number 1. English.',
  },
  {
    code: 'hi', name: 'Hindi',     nativeName: 'हिन्दी',    flag: '🇮🇳', voiceCode: 'hi-IN', ttsLang: 'hi',
    announcement: 'नंबर 2. हिन्दी.',
  },
  {
    code: 'te', name: 'Telugu',    nativeName: 'తెలుగు',   flag: '🇮🇳', voiceCode: 'te-IN', ttsLang: 'te',
    announcement: 'నంబర్ 3. తెలుగు.',
  },
  {
    code: 'kn', name: 'Kannada',   nativeName: 'ಕನ್ನಡ',    flag: '🇮🇳', voiceCode: 'kn-IN', ttsLang: 'kn',
    announcement: 'ನಂಬರ್ 4. ಕನ್ನಡ.',
  },
  {
    code: 'ta', name: 'Tamil',     nativeName: 'தமிழ்',    flag: '🇮🇳', voiceCode: 'ta-IN', ttsLang: 'ta',
    announcement: 'எண் 5. தமிழ்.',
  },
  {
    code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം',   flag: '🇮🇳', voiceCode: 'ml-IN', ttsLang: 'ml',
    announcement: 'നമ്പർ 6. മലയാളം.',
  },
  {
    code: 'mr', name: 'Marathi',   nativeName: 'मराठी',    flag: '🇮🇳', voiceCode: 'mr-IN', ttsLang: 'mr',
    announcement: 'क्रमांक 7. मराठी.',
  },
  {
    code: 'bn', name: 'Bengali',   nativeName: 'বাংলা',    flag: '🇮🇳', voiceCode: 'bn-IN', ttsLang: 'bn',
    announcement: 'নম্বর 8. বাংলা.',
  },
  {
    code: 'gu', name: 'Gujarati',  nativeName: 'ગુજરાતી',  flag: '🇮🇳', voiceCode: 'gu-IN', ttsLang: 'gu',
    announcement: 'નંબર 9. ગુજરાતી.',
  },
  {
    code: 'or', name: 'Odia',      nativeName: 'ଓଡ଼ିଆ',    flag: '🇮🇳', voiceCode: 'or-IN', ttsLang: 'hi',
    // Odia not supported by Google TTS → Hindi fallback (same voice tone)
    announcement: 'नंबर 10. ओडिया.',
  },
  {
    code: 'pa', name: 'Punjabi',   nativeName: 'ਪੰਜਾਬੀ',   flag: '🇮🇳', voiceCode: 'pa-IN', ttsLang: 'pa',
    announcement: 'ਨੰਬਰ 11. ਪੰਜਾਬੀ.',
  },
  {
    code: 'ur', name: 'Urdu',      nativeName: 'اردو',     flag: '🇮🇳', voiceCode: 'ur-IN', ttsLang: 'ur',
    announcement: 'نمبر 12. اردو.',
  },
];

// Ask-prompt in every language — after announcing all 12, ask user to pick
const ASK_PROMPTS: { lang: string; ttsLang: string; text: string }[] = [
  { lang: 'en', ttsLang: 'en', text: 'Which language do you want? Please say the language name.' },
  { lang: 'hi', ttsLang: 'hi', text: 'आप कौन सी भाषा चाहते हैं? भाषा का नाम बोलें।' },
  { lang: 'te', ttsLang: 'te', text: 'మీకు ఏ భాష కావాలి? భాష పేరు చెప్పండి.' },
  { lang: 'kn', ttsLang: 'kn', text: 'ನಿಮಗೆ ಯಾವ ಭಾಷೆ ಬೇಕು? ಭಾಷೆಯ ಹೆಸರು ಹೇಳಿ.' },
  { lang: 'ta', ttsLang: 'ta', text: 'உங்களுக்கு எந்த மொழி வேண்டும்? மொழி பெயர் சொல்லுங்கள்.' },
  { lang: 'ml', ttsLang: 'ml', text: 'നിങ്ങൾക്ക് ഏത് ഭാഷ വേണം? ഭാഷ പേര് പറയൂ.' },
  { lang: 'mr', ttsLang: 'mr', text: 'तुम्हाला कोणती भाषा हवी? भाषेचे नाव सांगा.' },
  { lang: 'bn', ttsLang: 'bn', text: 'আপনি কোন ভাষা চান? ভাষার নাম বলুন।' },
  { lang: 'gu', ttsLang: 'gu', text: 'તમને કઈ ભાષા જોઈએ? ભાષાનું નામ કહો.' },
  { lang: 'ur', ttsLang: 'ur', text: 'آپ کون سی زبان چاہتے ہیں؟ زبان کا نام بتائیں۔' },
];

// All possible voice-recognition aliases → language code
const LANGUAGE_KEYWORDS: Record<string, string> = {
  // English
  english: 'en', 'english language': 'en', 'अंग्रेजी': 'en', 'ఆంగ్లం': 'en',
  // Hindi
  hindi: 'hi', 'हिन्दी': 'hi', 'हिंदी': 'hi', 'hindi language': 'hi',
  'హిందీ': 'hi', 'ஹிந்தி': 'hi', 'ഹിന്ദി': 'hi', 'ਹਿੰਦੀ': 'hi',
  'হিন্দি': 'hi', 'ಹಿಂದಿ': 'hi', 'हिंदी भाषा': 'hi',
  // Telugu
  telugu: 'te', 'తెలుగు': 'te', 'తెలుగు language': 'te', 'telugu language': 'te',
  'తెలుగు భాష': 'te',
  // Kannada
  kannada: 'kn', 'ಕನ್ನಡ': 'kn', 'kannada language': 'kn', 'ಕನ್ನಡ ಭಾಷೆ': 'kn',
  // Tamil
  tamil: 'ta', 'தமிழ்': 'ta', 'tamil language': 'ta', 'தமிழ் மொழி': 'ta',
  // Malayalam
  malayalam: 'ml', 'മലയാളം': 'ml', 'malayalam language': 'ml', 'മലയാളം ഭാഷ': 'ml',
  // Marathi
  marathi: 'mr', 'मराठी': 'mr', 'marathi language': 'mr', 'मराठी भाषा': 'mr',
  // Bengali
  bengali: 'bn', 'বাংলা': 'bn', 'bengali language': 'bn', 'বাংলা ভাষা': 'bn',
  bangla: 'bn',
  // Gujarati
  gujarati: 'gu', 'ગુજરાતી': 'gu', 'gujarati language': 'gu', 'ગુજરાતી ભાષા': 'gu',
  // Odia
  odia: 'or', 'ଓଡ଼ିଆ': 'or', 'odia language': 'or', 'odiya': 'or', 'oriya': 'or',
  // Punjabi
  punjabi: 'pa', 'ਪੰਜਾਬੀ': 'pa', 'punjabi language': 'pa', 'ਪੰਜਾਬੀ ਭਾਸ਼ਾ': 'pa',
  // Urdu
  urdu: 'ur', 'اردو': 'ur', 'urdu language': 'ur',
};

interface LanguageSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onLanguageSelect: (language: Language) => void;
}

/** Fetch TTS audio as a blob URL, then play it. Resolves when done. */
async function playClip(text: string, lang: string, isCancelled: () => boolean): Promise<void> {
  if (isCancelled()) return;
  try {
    const res = await fetch(
      `/api/tts-proxy?text=${encodeURIComponent(text)}&lang=${lang}`
    );
    if (!res.ok || isCancelled()) return;

    const blob = await res.blob();
    if (isCancelled()) return;

    const blobUrl = URL.createObjectURL(blob);
    const audio   = new Audio(blobUrl);

    await new Promise<void>((resolve) => {
      const cleanup = () => { URL.revokeObjectURL(blobUrl); resolve(); };
      const timer = setTimeout(cleanup, 12000);
      audio.onended  = () => { clearTimeout(timer); cleanup(); };
      audio.onerror  = () => { clearTimeout(timer); cleanup(); };
      audio.play().catch(() => { clearTimeout(timer); cleanup(); });
    });
  } catch {
    /* skip on network or decode error */
  }
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Match a transcript string to a language code */
function detectLanguageFromSpeech(transcript: string): string | null {
  const lower = transcript.toLowerCase().trim();
  // Direct map lookup
  for (const [keyword, code] of Object.entries(LANGUAGE_KEYWORDS)) {
    if (lower.includes(keyword.toLowerCase())) {
      return code;
    }
  }
  return null;
}

export function LanguageSelector({ isOpen, onClose, onLanguageSelect }: LanguageSelectorProps) {
  const [selected, setSelected]           = useState<Language | null>(null);
  /** -1 = intro, 0-11 = language index, 'ask' = asking prompt, null = idle */
  const [speaking, setSpeaking]           = useState<number | 'ask' | null>(null);
  const [muted, setMuted]                 = useState(false);
  const [isListening, setIsListening]     = useState(false);
  const [voiceHint, setVoiceHint]         = useState('');
  const [phase, setPhase]                 = useState<'announcing' | 'asking' | 'listening' | 'idle'>('idle');

  const cancelRef  = useRef(false);
  const mutedRef   = useRef(muted);
  const running    = useRef(false);
  const recognitionRef = useRef<any>(null);
  const listeningActiveRef = useRef(false);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  /* ── stop speech recognition ──────────────────────────────────── */
  const stopListening = useCallback(() => {
    listeningActiveRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setVoiceHint('');
  }, []);

  /* ── stop everything ─────────────────────────────────────────── */
  const stopAll = useCallback(() => {
    cancelRef.current = true;
    running.current   = false;
    setSpeaking(null);
    setPhase('idle');
    stopListening();
  }, [stopListening]);

  /* ── start continuous voice listening ────────────────────────── */
  const startListening = useCallback(() => {
    if (listeningActiveRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceHint('Voice recognition not supported in this browser.');
      return;
    }

    listeningActiveRef.current = true;
    setIsListening(true);
    setVoiceHint('Listening... Say the language name');

    const recognition: any = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = true;
    // Use multiple languages so it can detect any of them
    recognition.lang            = 'hi-IN'; // Hindi as primary; browser will also pick up others
    recognitionRef.current      = recognition;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceHint(`Heard: "${transcript}"`);

      const detectedCode = detectLanguageFromSpeech(transcript);
      if (detectedCode) {
        const lang = LANGUAGES.find(l => l.code === detectedCode);
        if (lang) {
          recognition.abort();
          listeningActiveRef.current = false;
          setIsListening(false);
          setVoiceHint('');
          setSelected(lang);
          setPhase('idle');
          // Auto-confirm — play confirmation & select
          if (!mutedRef.current) {
            playClip(lang.nativeName, lang.ttsLang, () => false);
          }
          // Small delay then auto-confirm
          setTimeout(() => {
            onLanguageSelect(lang);
            onClose();
          }, 1500);
          return;
        }
      }
    };

    recognition.onend = () => {
      // If still active, restart to keep listening
      if (listeningActiveRef.current && !cancelRef.current) {
        try {
          recognition.start();
        } catch {
          listeningActiveRef.current = false;
          setIsListening(false);
        }
      }
    };

    recognition.onerror = () => {
      if (listeningActiveRef.current && !cancelRef.current) {
        try {
          recognition.start();
        } catch {
          listeningActiveRef.current = false;
          setIsListening(false);
        }
      }
    };

    try {
      recognition.start();
    } catch {
      listeningActiveRef.current = false;
      setIsListening(false);
    }
  }, [onLanguageSelect, onClose]);

  /* ── play "which language?" prompts then start listening ──────── */
  const runAskPrompts = useCallback(async () => {
    if (cancelRef.current) return;
    setSpeaking('ask');
    setPhase('asking');
    const isCancelled = () => cancelRef.current || mutedRef.current;

    for (let i = 0; i < ASK_PROMPTS.length; i++) {
      if (isCancelled()) return;
      const { text, ttsLang } = ASK_PROMPTS[i];
      await playClip(text, ttsLang, isCancelled);
      if (isCancelled()) return;
      await wait(200);
    }

    setSpeaking(null);
    setPhase('listening');
    running.current = false;
    // Start listening now
    startListening();
  }, [startListening]);

  /* ── main tour ───────────────────────────────────────────────── */
  const runTour = useCallback(async () => {
    if (running.current) return;
    running.current   = true;
    cancelRef.current = false;
    setPhase('announcing');
    const isCancelled = () => cancelRef.current || mutedRef.current;

    // Each language announces itself
    for (let i = 0; i < LANGUAGES.length; i++) {
      if (isCancelled()) break;
      setSpeaking(i);
      const lang = LANGUAGES[i];
      await playClip(lang.announcement, lang.ttsLang, isCancelled);
      if (isCancelled()) break;
      await wait(300);
    }

    if (!cancelRef.current && !mutedRef.current) {
      // After all announcements, ask which language they want
      await runAskPrompts();
    } else {
      setSpeaking(null);
      running.current = false;
      setPhase('idle');
    }
  }, [runAskPrompts]);

  /* ── open / close ────────────────────────────────────────────── */
  useEffect(() => {
    if (!isOpen) {
      stopAll();
      return () => {};
    }
    setSelected(null);
    setSpeaking(null);
    cancelRef.current = false;
    setPhase('idle');
    runTour();
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /* ── mute toggle ─────────────────────────────────────────────── */
  const handleMuteToggle = () => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) {
      stopAll();
    } else {
      cancelRef.current = false;
      runTour();
    }
  };

  /* ── card click ──────────────────────────────────────────────── */
  const handleSelect = (lang: Language) => {
    stopAll();
    setSelected(lang);
    if (!mutedRef.current) {
      cancelRef.current = false;
      playClip(lang.nativeName, lang.ttsLang, () => false);
    }
  };

  /* ── confirm ─────────────────────────────────────────────────── */
  const handleConfirm = () => {
    if (!selected) return;
    stopAll();
    onLanguageSelect(selected);
    onClose();
    setSelected(null);
  };

  /* ── derived ─────────────────────────────────────────────────── */
  const isAnnouncingLang = typeof speaking === 'number' && speaking >= 0;
  const activeName = isAnnouncingLang && typeof speaking === 'number'
    ? LANGUAGES[speaking]?.name
    : null;
  const progress = isAnnouncingLang && typeof speaking === 'number'
    ? Math.round(((speaking + 1) / LANGUAGES.length) * 100)
    : 0;

  return (
    <>
      <style>{`
        @keyframes ls-glow {
          0%   { box-shadow: 0 0 0 0   rgba(99,102,241,.7); }
          55%  { box-shadow: 0 0 0 10px rgba(99,102,241,.1); }
          100% { box-shadow: 0 0 0 0   rgba(99,102,241,0); }
        }
        @keyframes ls-bar {
          0%,100% { transform: scaleY(1);   }
          50%     { transform: scaleY(2.6); }
        }
        @keyframes ls-mic-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(239,68,68,.6); }
          70%  { box-shadow: 0 0 0 18px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0   rgba(239,68,68,0); }
        }
        .ls-card-on {
          border-color: #6366f1 !important;
          background: linear-gradient(135deg,#eef2ff,#dde4ff) !important;
          animation: ls-glow 1s ease-in-out infinite;
        }
        .ls-wave span {
          display: inline-block;
          width: 3px; border-radius: 2px;
          background: #6366f1;
          animation: ls-bar .6s ease-in-out infinite;
        }
        .ls-wave span:nth-child(1){ animation-delay:0s;   height:7px; }
        .ls-wave span:nth-child(2){ animation-delay:.1s;  height:13px; }
        .ls-wave span:nth-child(3){ animation-delay:.2s;  height:9px;  }
        .ls-wave span:nth-child(4){ animation-delay:.3s;  height:15px; }
        .ls-wave span:nth-child(5){ animation-delay:.4s;  height:10px; }
        .ls-mic-pulse {
          animation: ls-mic-pulse 1.2s ease-out infinite;
        }
        .ls-red-wave span {
          display: inline-block;
          width: 3px; border-radius: 2px;
          background: #ef4444;
          animation: ls-bar .6s ease-in-out infinite;
        }
        .ls-red-wave span:nth-child(1){ animation-delay:0s;   height:7px; }
        .ls-red-wave span:nth-child(2){ animation-delay:.1s;  height:13px; }
        .ls-red-wave span:nth-child(3){ animation-delay:.2s;  height:9px;  }
        .ls-red-wave span:nth-child(4){ animation-delay:.3s;  height:15px; }
        .ls-red-wave span:nth-child(5){ animation-delay:.4s;  height:10px; }
      `}</style>

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">

          {/* ── HEADER ── */}
          <DialogHeader>
            <div className="flex items-center justify-between">
              <span className="flex-1" />
              <DialogTitle className="flex-1 text-2xl font-bold text-center flex items-center justify-center gap-2">
                <Globe className="w-6 h-6 text-indigo-600" />
                Choose Your Language
              </DialogTitle>
              <span className="flex-1 flex justify-end gap-1">
                {/* Stop button — only while tour is running */}
                {(phase === 'announcing' || phase === 'asking') && (
                  <button
                    onClick={stopAll}
                    title="Stop announcement"
                    className="p-2 rounded-full hover:bg-red-50 transition"
                  >
                    <Square className="w-4 h-4 text-red-400 fill-current" />
                  </button>
                )}
                <button
                  onClick={handleMuteToggle}
                  title={muted ? 'Unmute' : 'Mute'}
                  className="p-2 rounded-full hover:bg-gray-100 transition"
                >
                  {muted
                    ? <VolumeX className="w-5 h-5 text-gray-400" />
                    : <Volume2 className="w-5 h-5 text-indigo-500" />}
                </button>
              </span>
            </div>

            {/* ── LIVE STATUS BAR — Announcing ── */}
            {phase === 'announcing' && !muted && isAnnouncingLang && (
              <div className="mt-3 px-4 py-3 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <div className="ls-wave flex items-end gap-[3px]">
                    <span/><span/><span/><span/><span/>
                  </div>
                  <span className="text-sm font-semibold text-indigo-700">
                    {`Now announcing: ${activeName}`}
                  </span>
                  <div className="ls-wave flex items-end gap-[3px]">
                    <span/><span/><span/><span/><span/>
                  </div>
                </div>
                <div>
                  <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-indigo-400 mt-1">
                    Language {(speaking as number) + 1} of {LANGUAGES.length}
                  </p>
                </div>
              </div>
            )}

            {/* ── LIVE STATUS BAR — Asking which language ── */}
            {phase === 'asking' && !muted && (
              <div className="mt-3 px-4 py-3 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                <div className="flex items-center justify-center gap-3">
                  <div className="ls-wave flex items-end gap-[3px]">
                    <span/><span/><span/><span/><span/>
                  </div>
                  <span className="text-sm font-semibold text-amber-700">
                    🎙️ Asking which language you want…
                  </span>
                  <div className="ls-wave flex items-end gap-[3px]">
                    <span/><span/><span/><span/><span/>
                  </div>
                </div>
              </div>
            )}

            {/* ── LIVE STATUS BAR — Listening for voice ── */}
            {phase === 'listening' && isListening && (
              <div className="mt-3 px-4 py-4 bg-red-50 rounded-2xl border border-red-200 space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500 ls-mic-pulse flex items-center justify-center">
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-700">
                      🎤 Listening… Say a language name!
                    </p>
                    <p className="text-xs text-red-500 mt-0.5">
                      e.g. "Hindi", "Telugu", "English", "தமிழ்", "हिंदी"
                    </p>
                  </div>
                  <div className="ls-red-wave flex items-end gap-[3px]">
                    <span/><span/><span/><span/><span/>
                  </div>
                </div>
                {voiceHint && (
                  <p className="text-xs text-center text-red-600 font-medium bg-red-100 rounded-lg py-1 px-3">
                    {voiceHint}
                  </p>
                )}
              </div>
            )}
          </DialogHeader>

          {/* ── LANGUAGE GRID ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {LANGUAGES.map((lang, idx) => {
              const isOn  = speaking === idx && !muted;
              const isSel = selected?.code === lang.code;

              return (
                <button
                  key={lang.code}
                  id={`lang-${lang.code}`}
                  onClick={() => handleSelect(lang)}
                  className={[
                    'p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-lg text-center',
                    isOn  ? 'ls-card-on'
                    : isSel ? 'border-indigo-500 bg-indigo-50 shadow-md'
                            : 'border-gray-200 hover:border-indigo-300 bg-white',
                  ].join(' ')}
                >
                  <div className="text-xs font-bold text-indigo-400 mb-1">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="text-3xl mb-2">{lang.flag}</div>
                  <div className="font-semibold text-gray-900">{lang.name}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{lang.nativeName}</div>

                  {isSel && (
                    <div className="mt-2 flex justify-center items-center gap-1">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                      <span className="text-xs text-indigo-600 font-semibold">Selected</span>
                    </div>
                  )}
                  {isOn && (
                    <div className="mt-2 ls-wave flex justify-center items-end gap-[3px]" style={{ height: 18 }}>
                      <span/><span/><span/><span/><span/>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── INFO BAR ── */}
          <div className="flex items-center justify-center gap-3 mt-5 p-3 bg-indigo-50 rounded-xl">
            <Mic className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-sm text-indigo-700 font-medium">
              {isListening
                ? '🎙️ Speak now — say any language name and it will be selected automatically!'
                : 'Voice recognition and text-to-speech will use your selected language'}
            </span>
          </div>

          {/* ── ACTIONS ── */}
          <div className="flex justify-center gap-4 mt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              id="lang-confirm"
              onClick={handleConfirm}
              disabled={!selected}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
            >
              Continue with {selected?.name ?? '…'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}