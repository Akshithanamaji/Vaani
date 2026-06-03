'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mic, Languages, Globe, Loader2 } from 'lucide-react';
import { useAutoVoice } from '@/lib/auto-voice-engine';
import { speakText, stopSpeaking } from '@/lib/voice-utils';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  voiceCode: string;
}

const AVAILABLE_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', voiceCode: 'en-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', voiceCode: 'hi-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', voiceCode: 'te-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', voiceCode: 'kn-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', voiceCode: 'ta-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', voiceCode: 'ml-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', voiceCode: 'mr-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', voiceCode: 'bn-IN' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', voiceCode: 'gu-IN' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', flag: '🇮🇳', voiceCode: 'or-IN' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', voiceCode: 'pa-IN' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇮🇳', voiceCode: 'ur-IN' },
];

// Detailed explanations in all 12 languages - played when language selector modal opens
const VOICE_EXPLANATIONS: Record<string, string> = {
  en: 'Welcome to Vaani AI. Please select your language.',
  hi: 'वाणी AI में आपका स्वागत है। कृपया अपनी भाषा चुनें।',
  te: 'వాణి AI కి స్వాగతం. దయచేసి మీ భాషను ఎంచుకోండి.',
  ta: 'வாணி AI க்கு உங்களை வரவேற்கிறோம். தயவுசெய்து உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்.',
  ml: 'വാണി AI-ലേക്ക് സ്വാഗതം. ദയവായി നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക.',
  kn: 'ವಾಣಿ AI ಗೆ ಸ್ವಾಗತ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆರಿಸಿ.',
  mr: 'वाणी AI मध्ये आपले स्वागत आहे. कृपया आपली भाषा निवडा.',
  bn: 'ভানী AI-তে আপনাকে স্বাগতম। অনুগ্রহ করে আপনার ভাষা নির্বাচন করুন।',
  gu: 'વાણી AI માં તમારું સ્વાગત છે. કૃપા કરીને તમારી ભાષા પસંદ કરો.',
  or: 'ଭାଣୀ AI କୁ ଆପଣଙ୍କୁ ସ୍ୱାଗତ। ଦୟାକରି ଆପଣଙ୍କର ଭାଷା ବାଛନ୍ତୁ।',
  pa: 'ਵਾਣੀ AI ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ।',
  ur: 'وانی AI میں خوش آمدید۔ براہ کرم اپنی زبان منتخب کریں۔',
};

/**
 * Map language names in multiple languages to their codes
 * Helps match user voice input to actual languages
 */
const LANGUAGE_NAME_VARIANTS: Record<string, string[]> = {
  en: ['english', 'eng', 'inglis', 'angrezi', 'english language'],
  hi: ['hindi', 'hin', 'hindee', 'हिंदी', 'hindustani', 'hindi language'],
  te: ['telugu', 'tel', 'telugu language', 'telugum'],
  kn: ['kannada', 'kan', 'kannada language', 'kannad'],
  ta: ['tamil', 'tam', 'tamil language', 'thamil'],
  ml: ['malayalam', 'mal', 'malayalam language', 'mallu'],
  mr: ['marathi', 'mar', 'marathi language', 'marathi'],
  bn: ['bengali', 'ben', 'bengali language', 'bangla', 'বাংলা'],
  gu: ['gujarati', 'guj', 'gujarati language', 'gujarati'],
  or: ['odia', 'odiya', 'or', 'oriya', 'odia language'],
  pa: ['punjabi', 'pan', 'punjabi language', 'panjabi'],
  ur: ['urdu', 'urd', 'urdu language', 'اردو'],
};

interface LanguageSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onLanguageSelect: (language: Language) => void;
}

export function LanguageSelector({ isOpen, onClose, onLanguageSelect }: LanguageSelectorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelPlaybackRef = useRef<(() => void) | null>(null);

  // Play all 12 language explanations sequentially when modal opens
  const playAllExplanations = async () => {
    console.log('[🎤 LANG-SELECTOR] Starting to play all 12 language explanations');

    let cancelled = false;
    cancelPlaybackRef.current = () => {
      cancelled = true;
      stopSpeaking();
      console.log('[🎤 LANG-SELECTOR] Playback cancelled');
    };

    const langCodes: Array<keyof typeof VOICE_EXPLANATIONS> = [
      'en', 'hi', 'te', 'ta', 'ml', 'kn', 'mr', 'bn', 'gu', 'or', 'pa', 'ur'
    ];

    for (let i = 0; i < langCodes.length; i++) {
      if (cancelled) break;

      const langCode = langCodes[i];
      const explanation = VOICE_EXPLANATIONS[langCode];
      const language = AVAILABLE_LANGUAGES.find(l => l.code === langCode);

      // Pre-warm the next language audio in background to minimize network gaps
      if (i < langCodes.length - 1) {
        const nextLangCode = langCodes[i + 1];
        const nextExp = VOICE_EXPLANATIONS[nextLangCode];
        const nextLang = AVAILABLE_LANGUAGES.find(l => l.code === nextLangCode);
        const nextV = nextLang?.voiceCode || nextLangCode;
        const nextUrl = `/api/tts-proxy?text=${encodeURIComponent(nextExp)}&lang=${nextV}&speed=1`;
        
        // Use a hidden audio object to trigger browser caching
        const preloader = new Audio();
        preloader.preload = 'auto';
        preloader.src = nextUrl;
      }

      try {
        console.log(`[🎤 LANG-SELECTOR] (${i + 1}/12) Speaking ${language?.name}...`);

        // Use the shared speakText utility which handles chunks and error fallbacks
        await speakText(explanation, language?.voiceCode || langCode);

        // Minimal pause between languages (10ms) to make it feel snappy
        // The natural end of the audio already provides enough separation
        if (i < langCodes.length - 1 && !cancelled) {
          await new Promise(r => setTimeout(r, 10));
        }
      } catch (err) {
        console.error(`[🎤 LANG-SELECTOR] Error for ${language?.name}:`, err);
      }
    }

    if (!cancelled) {
      console.log('[🎤 LANG-SELECTOR] ✅ All 12 language explanations finished');
    }
    cancelPlaybackRef.current = null;
  };

  // Play all explanations when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[🎤 LANG-SELECTOR] Modal opened, starting voice explanations');
      playAllExplanations().catch((err) => {
        console.error('[🎤 LANG-SELECTOR] Error during playback:', err);
      });
    } else {
      // Stop playback when modal closes
      if (cancelPlaybackRef.current) {
        cancelPlaybackRef.current();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }

    return () => {
      if (cancelPlaybackRef.current) {
        cancelPlaybackRef.current();
      }
      stopSpeaking();
    };
  }, [isOpen]);

  const handleLanguageSelect = (language: Language) => {
    setSelectedLanguage(language);

    // Stop the background explanations
    if (cancelPlaybackRef.current) {
      cancelPlaybackRef.current();
    }
    stopSpeaking();

    // Play voice feedback in the selected language
    try {
      const text = language.nativeName;
      speakText(text, language.code);
    } catch (e) {
      console.warn('Error playing audio for language selection', e);
    }
  };

  const handleConfirm = () => {
    if (selectedLanguage) {
      onLanguageSelect(selectedLanguage);
      onClose();
      setSelectedLanguage(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Globe className="w-6 h-6 text-indigo-600" />
            Choose Your Language
          </DialogTitle>
          <p className="text-center text-gray-600 mt-2">
            Select your preferred language for voice interaction and interface
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          {AVAILABLE_LANGUAGES.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageSelect(language)}
              className={`p-4 rounded-xl border-2 transition-all hover:shadow-lg ${selectedLanguage?.code === language.code
                ? 'border-indigo-500 bg-indigo-50 shadow-md'
                : 'border-gray-200 hover:border-indigo-300 bg-white'
                }`}
            >
              <div className="text-center">
                <div className="text-3xl mb-2">{language.flag}</div>
                <div className="font-semibold text-gray-900">{language.name}</div>
                <div className="text-sm text-gray-600 mt-1">{language.nativeName}</div>
                {selectedLanguage?.code === language.code && (
                  <div className="mt-2 flex justify-center">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 mt-8 p-4 bg-indigo-50 rounded-xl">
          <Mic className="w-5 h-5 text-indigo-600" />
          <span className="text-sm text-indigo-700 font-medium">
            Voice recognition and text-to-speech will be in your selected language
          </span>
        </div>

        <div className="flex justify-center gap-4 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedLanguage}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
          >
            Continue with {selectedLanguage?.name}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
