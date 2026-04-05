"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { INDIAN_STATES, State, District } from '@/lib/indian-locations';
import { MapPin, Search, ChevronRight, ArrowLeft, CheckCircle2, Building2, Mic, MicOff, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Translation cache: lang -> (english_name -> translated_name)
const translationCache: Record<string, Record<string, string>> = {};

/** Fetch translations from /api/translate for any texts missing from cache */
async function fetchTranslations(texts: string[], lang: string): Promise<void> {
  if (lang === 'en' || texts.length === 0) return;
  if (!translationCache[lang]) translationCache[lang] = {};
  const missing = texts.filter(t => !translationCache[lang][t]);
  if (missing.length === 0) return;
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: missing, target: lang }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.translations && Array.isArray(data.translations)) {
      missing.forEach((text, idx) => {
        translationCache[lang][text] = data.translations[idx] || text;
      });
    }
  } catch {
    // silently fail — will show English fallback
  }
}
import {
  speakText,
  initVoiceRecognition,
  startVoiceRecording,
  stopVoiceRecording,
  abortVoiceRecording,
  transcribeWithGroqWhisper,
  type VoiceRecognitionResult
} from '@/lib/voice-utils';
import { useAudioRecorder } from '@/lib/audio-recorder';

interface LocationSelectorProps {
  serviceName: string;
  onLocationSelected: (state: string, district: string) => void;
  onCancel: () => void;
}

export function LocationSelector({ serviceName, onLocationSelected, onCancel }: LocationSelectorProps) {
  const { selectedLanguage } = useLanguage();
  const language = selectedLanguage?.code || 'en';
  const [step, setStep] = useState<'state' | 'district'>('state');
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Bump this counter to trigger a re-render after translations load into cache
  const [translateVersion, setTranslateVersion] = useState(0);

  // Voice recording state
  const [listeningStatus, setListeningStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [shouldTranscribeBlob, setShouldTranscribeBlob] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  const [useGroqWhisper] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hasWebSpeech = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
    return !hasWebSpeech;
  });

  const { isRecording, audioBlob, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  // Voice cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { abortVoiceRecording(recognitionRef.current); } catch (e) { }
      }
    };
  }, []);

  // Handle Groq whisper transcription
  useEffect(() => {
    if (shouldTranscribeBlob && audioBlob) {
      setShouldTranscribeBlob(false);
      const transcribeNow = async () => {
        const langCode = (language || 'en-IN').split('-')[0];
        const result = await transcribeWithGroqWhisper(audioBlob, langCode, step === 'state' ? 'state' : 'district');
        resetRecording();
        if (result.success && result.text) {
          handleVoiceTranscript(result.text);
        } else {
          setVoiceError("Transcription failed");
          setListeningStatus('idle');
        }
      };
      transcribeNow();
    }
  }, [shouldTranscribeBlob, audioBlob]);

  const handleVoiceTranscript = (transcript: string) => {
    const matchText = transcript.toLowerCase().trim();
    setSearchQuery(matchText);
    setListeningStatus('idle');
    setVoiceError(null);

    // Give react time to update searchQuery which filters the list, but we can also match manually
    if (step === 'state') {
      const match = INDIAN_STATES.find(s =>
        s.name.toLowerCase() === matchText ||
        Object.values(s).some(v => typeof v === 'string' && v.toLowerCase() === matchText)
      );
      if (match) {
        handleStateSelect(match);
      } else {
        const partials = INDIAN_STATES.filter(state =>
          state.name.toLowerCase().includes(matchText) ||
          Object.entries(state).some(([key, value]) =>
            key.startsWith('name') && typeof value === 'string' && value.toLowerCase().includes(matchText)
          )
        );
        if (partials.length === 1) {
          handleStateSelect(partials[0]);
        }
      }
    } else {
      if (selectedState) {
        const match = selectedState.districts.find(d =>
          d.name.toLowerCase() === matchText ||
          Object.values(d).some(v => typeof v === 'string' && v.toLowerCase() === matchText)
        );
        if (match) {
          handleDistrictSelect(match);
        } else {
          const partials = selectedState.districts.filter(district =>
            district.name.toLowerCase().includes(matchText) ||
            Object.entries(district).some(([key, value]) =>
              key.startsWith('name') && typeof value === 'string' && value.toLowerCase().includes(matchText)
            )
          );
          if (partials.length === 1) {
            handleDistrictSelect(partials[0]);
          }
        }
      }
    }
  };

  const handleStartListening = async () => {
    if (isRecording || listeningStatus !== 'idle') return;
    setVoiceError(null);
    setSearchQuery('');

    if (!useGroqWhisper) {
      setListeningStatus('listening');
      if (recognitionRef.current) {
        try { abortVoiceRecording(recognitionRef.current); } catch (e) { }
        recognitionRef.current = null;
      }

      const recognition = initVoiceRecognition(
        language,
        (result: VoiceRecognitionResult) => {
          if (result.transcript) {
            if (result.isFinal) {
              setListeningStatus('processing');
              stopVoiceRecording(recognitionRef.current);
              handleVoiceTranscript(result.transcript);
            } else {
              setSearchQuery(result.transcript);
            }
          }
        },
        (error: string) => {
          if (!error.includes('aborted')) {
            setListeningStatus('idle');
            setVoiceError('Could not recognize voice. Try again.');
          }
        },
        () => { setListeningStatus('idle'); },
        () => { setListeningStatus('listening'); }
      );

      if (!recognition) {
        setVoiceError('Voice recognition not supported');
        setListeningStatus('idle');
        return;
      }
      recognitionRef.current = recognition;
      try { startVoiceRecording(recognitionRef.current); } catch (e) { setListeningStatus('idle'); }
      return;
    }

    setListeningStatus('listening');
    try { await startRecording(); } catch (e) { setListeningStatus('idle'); }
  };

  const handleStopListening = async () => {
    if (useGroqWhisper) {
      if (isRecording) {
        stopRecording();
        setListeningStatus('processing');
        setShouldTranscribeBlob(true);
      }
    } else {
      if (recognitionRef.current) {
        try { stopVoiceRecording(recognitionRef.current); } catch (e) { }
      }
      setListeningStatus('processing');
    }
  };

  // Pre-fetch translations for all state names when language changes
  useEffect(() => {
    if (language === 'en') return;
    const stateNames = INDIAN_STATES.map(s => s.name);
    fetchTranslations(stateNames, language).then(() => setTranslateVersion(v => v + 1));
  }, [language]);

  // Pre-fetch translations for district names when a state is selected or language changes
  useEffect(() => {
    if (language === 'en' || !selectedState) return;
    const districtNames = selectedState.districts.map(d => d.name);
    fetchTranslations(districtNames, language).then(() => setTranslateVersion(v => v + 1));
  }, [selectedState, language]);

  // Voice effect when step changes
  useEffect(() => {
    const prompt = step === 'state' ? t.selectState : t.selectDistrict;
    if (prompt) {
      speakText(prompt, language);
    }
  }, [step, language]);

  // Translations
  const translations = {
    en: {
      selectState: 'Select Your State',
      selectDistrict: 'Select Your District',
      searchState: 'Search state...',
      searchDistrict: 'Search district...',
      statesUnion: 'States & Union Territories',
      districtsIn: 'Districts in',
      applying: 'Applying for',
      back: 'Back',
      cancel: 'Cancel',
      noResults: 'No results found',
      selectLocation: 'Select your location to continue',
      selectedStateLabel: 'Selected State:',
      districtsCount: 'districts',
      language: 'Language',
    },
    hi: {
      selectState: 'अपना राज्य चुनें',
      selectDistrict: 'अपना जिला चुनें',
      searchState: 'राज्य खोजें...',
      searchDistrict: 'जिला खोजें...',
      statesUnion: 'राज्य और केंद्र शासित प्रदेश',
      districtsIn: 'जिले',
      applying: 'आवेदन',
      back: 'वापस',
      cancel: 'रद्द करें',
      noResults: 'कोई परिणाम नहीं मिला',
      selectLocation: 'जारी रखने के लिए अपना स्थान चुनें',
      selectedStateLabel: 'चुना हुआ राज्य:',
      districtsCount: 'जिले',
      language: 'भाषा',
    },
    te: {
      selectState: 'మీ రాష్ట్రాన్ని ఎంచుకోండి',
      selectDistrict: 'మీ జిల్లాను ఎంచుకోండి',
      searchState: 'రాష్ట్రం శోధించండి...',
      searchDistrict: 'జిల్లా శోధించండి...',
      statesUnion: 'రాష్ట్రాలు & కేంద్రపాలిత ప్రాంతాలు',
      districtsIn: 'జిల్లాలు',
      applying: 'దరఖాస్తు',
      back: 'వెనుకకు',
      cancel: 'రద్దు చేయండి',
      noResults: 'ఫలితాలు కనుగొనబడలేదు',
      selectLocation: 'కొనసాగించడానికి మీ స్థానాన్ని ఎంచుకోండి',
      selectedStateLabel: 'ఎంచుకున్న రాష్ట్రం:',
      districtsCount: 'జిల్లాలు',
      language: 'భాష',
    },
    kn: {
      selectState: 'ನಿಮ್ಮ ರಾಜ್ಯವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ',
      selectDistrict: 'ನಿಮ್ಮ ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ',
      searchState: 'ರಾಜ್ಯವನ್ನು ಹುಡುಕಿ...',
      searchDistrict: 'ಜಿಲ್ಲೆಯನ್ನು ಹುಡುಕಿ...',
      statesUnion: 'ರಾಜ್ಯಗಳು ಮತ್ತು ಕೇಂದ್ರಾಡಳಿತ ಪ್ರದೇಶಗಳು',
      districtsIn: 'ಜಿಲ್ಲೆಗಳು',
      applying: 'ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ',
      back: 'ಹಿಂದೆ',
      cancel: 'ರದ್ದುಮಾಡಿ',
      noResults: 'ಯಾವುದೇ ಫಲಿತಾಂಶಗಳು ಕಂಡುಬಂದಿಲ್ಲ',
      selectLocation: 'ಮುಂದುವರಿಯಲು ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಆಯ್ಕೆಮಾಡಿ',
      selectedStateLabel: 'ಆಯ್ಕೆಮಾಡಿದ ರಾಜ್ಯ:',
      districtsCount: 'ಜಿಲ್ಲೆಗಳು',
      language: 'ಭಾಷೆ',
    },
    ta: {
      selectState: 'உங்கள் மாநிலத்தைத் தேர்ந்தெடுக்கவும்',
      selectDistrict: 'உங்கள் மாவட்டத்தைத் தேர்ந்தெடுக்கவும்',
      searchState: 'மாநிலத்தைத் தேடுங்கள்...',
      searchDistrict: 'மாவட்டத்தைத் தேடுங்கள்...',
      statesUnion: 'மாநிலங்கள் மற்றும் யூனியன் பிரதேசங்கள்',
      districtsIn: 'மாவட்டங்கள்',
      applying: 'விண்ணப்பிக்கிறது',
      back: 'பின்னால்',
      cancel: 'ரத்து செய்',
      noResults: 'முடிவுகள் எதுவும் இல்லை',
      selectLocation: 'தொடர உங்கள் இருப்பிடத்தைத் தேர்ந்தெடுக்கவும்',
      selectedStateLabel: 'தேர்ந்தெடுக்கப்பட்ட மாநிலம்:',
      districtsCount: 'மாவட்டங்கள்',
      language: 'மொழி',
    },
    ml: {
      selectState: 'നിങ്ങളുടെ സംസ്ഥാനം തിരഞ്ഞെടുക്കുക',
      selectDistrict: 'നിങ്ങളുടെ ജില്ല തിരഞ്ഞെടുക്കുക',
      searchState: 'സംസ്ഥാനം തിരയുക...',
      searchDistrict: 'ജില്ല തിരയുക...',
      statesUnion: 'സംസ്ഥാനങ്ങളും കേന്ദ്രഭരണ പ്രദേശങ്ങളും',
      districtsIn: 'ജില്ലകൾ',
      applying: 'അപേക്ഷിക്കുന്നു',
      back: 'പിന്നിലേക്ക്',
      cancel: 'റദ്ദാക്കുക',
      noResults: 'ഫലങ്ങളൊന്നും കണ്ടെത്തിയില്ല',
      selectLocation: 'തുടരാൻ നിങ്ങളുടെ ലൊക്കേഷൻ തിരഞ്ഞെടുക്കുക',
      selectedStateLabel: 'തിരഞ്ഞെടുത്ത സംസ്ഥാനം:',
      districtsCount: 'ജില്ലകൾ',
      language: 'ഭാഷ',
    },
    mr: {
      selectState: 'आपले राज्य निवडा',
      selectDistrict: 'आपला जिल्हा निवडा',
      searchState: 'राज्य शोधा...',
      searchDistrict: 'जिल्हा शोधा...',
      statesUnion: 'राज्ये आणि केंद्रशासित प्रदेश',
      districtsIn: 'जिल्हे',
      applying: 'अर्ज करत आहे',
      back: 'मागे',
      cancel: 'रद्द करा',
      noResults: 'कोणतेही निकाल सापडले नाहीत',
      selectLocation: 'पुढे जाण्यासाठी आपले स्थान निवडा',
      selectedStateLabel: 'निवडलेले राज्य:',
      districtsCount: 'जिल्हे',
      language: 'भाषा',
    },
    bn: {
      selectState: 'আপনার রাজ্য নির্বাচন করুন',
      selectDistrict: 'আপনার জেলা নির্বাচন করুন',
      searchState: 'রাজ্য খুঁজুন...',
      searchDistrict: 'জেলা খুঁজুন...',
      statesUnion: 'রাজ্য ও কেন্দ্রশাসিত অঞ্চল',
      districtsIn: 'জেলা',
      applying: 'আবেদন করা হচ্ছে',
      back: 'পিছনে',
      cancel: 'বাতিল করুন',
      noResults: 'কোন ফলাফল পাওয়া যায়নি',
      selectLocation: 'চালিয়ে যেতে আপনার অবস্থান নির্বাচন করুন',
      selectedStateLabel: 'নির্বাচিত রাজ্য:',
      districtsCount: 'জেলা',
      language: 'ভাষা',
    },
    gu: {
      selectState: 'તમારું રાજ્ય પસંદ કરો',
      selectDistrict: 'તમારો જિલ્લો પસંદ કરો',
      searchState: 'રાજ્ય શોધો...',
      searchDistrict: 'જિલ્લો શોધો...',
      statesUnion: 'રાજ્યો અને કેન્દ્રશાસિત પ્રદેશો',
      districtsIn: 'જિલ્લાઓ',
      applying: 'અરજી કરી રહ્યા છીએ',
      back: 'પાછળ',
      cancel: 'રદ કરો',
      noResults: 'કોઈ પરિણામ મળ્યા નથી',
      selectLocation: 'આગળ વધવા માટે તમારું સ્થાન પસંદ કરો',
      selectedStateLabel: 'પસંદ કરેલ રાજ્ય:',
      districtsCount: 'જિલ્લાઓ',
      language: 'ભાષા',
    },
    or: {
      selectState: 'ଆପଣଙ୍କ ରାଜ୍ୟ ଚୟନ କରନ୍ତୁ',
      selectDistrict: 'ଆପଣଙ୍କ ଜିଲ୍ଲା ଚୟନ କରନ୍ତୁ',
      searchState: 'ରାଜ୍ୟ ଖୋଜନ୍ତୁ...',
      searchDistrict: 'ଜିଲ୍ଲା ଖୋଜନ୍ତୁ...',
      statesUnion: 'ରାଜ୍ୟ ଏବଂ କେନ୍ଦ୍ର ଶାସିତ ଅଞ୍ଚଳ',
      districtsIn: 'ଜିଲ୍ଲା',
      applying: 'ଆବେଦନ କରୁଛୁ',
      back: 'ପଛକୁ',
      cancel: 'ବାତିଲ କରନ୍ତୁ',
      noResults: 'କୌଣସି ଫଳାଫଳ ମିଳିଲା ନାହିଁ',
      selectLocation: 'ଆଗକୁ ବଢିବା ପାଇଁ ଆପଣଙ୍କ ସ୍ଥାନ ଚୟନ କରନ୍ତୁ',
      selectedStateLabel: 'ଚୟନିତ ରାଜ୍ୟ:',
      districtsCount: 'ଜିଲ୍ଲା',
      language: 'ଭାଷା',
    },
    pa: {
      selectState: 'ਆਪਣੇ ਰਾਜ ਦੀ ਚੋਣ ਕਰੋ',
      selectDistrict: 'ਆਪਣੇ ਜ਼ਿਲ੍ਹੇ ਦੀ ਚੋਣ ਕਰੋ',
      searchState: 'ਰਾਜ ਦੀ ਖੋਜ ਕਰੋ...',
      searchDistrict: 'ਜ਼ਿਲ੍ਹੇ ਦੀ ਖੋਜ ਕਰੋ...',
      statesUnion: 'ਰਾਜ ਅਤੇ ਕੇਂਦਰ ਸ਼ਾਸਤ ਪ੍ਰਦੇਸ਼',
      districtsIn: 'ਜ਼ਿਲ੍ਹੇ',
      applying: 'ਅਪਲਾਈ ਕਰ ਰਹੇ ਹੋ',
      back: 'ਪਿੱਛੇ',
      cancel: 'ਰੱਦ ਕਰੋ',
      noResults: 'ਕੋਈ ਨਤੀਜਾ ਨਹੀਂ ਮਿਲਿਆ',
      selectLocation: 'ਜਾਰੀ ਰੱਖਣ ਲਈ ਆਪਣਾ ਸਥਾਨ ਚੁਣੋ',
      selectedStateLabel: 'ਚੁਣਿਆ ਹੋਇਆ ਰਾਜ:',
      districtsCount: 'ਜ਼ਿਲ੍ਹੇ',
      language: 'ਭਾਸ਼ਾ',
    },
    ur: {
      selectState: 'اپنی ریاست منتخب کریں',
      selectDistrict: 'اپنا ضلع منتخب کریں',
      searchState: 'ریاست تلاش کریں...',
      searchDistrict: 'ضلع تلاش کریں...',
      statesUnion: 'ریاستیں اور مرکز کے زیر انتظام علاقے',
      districtsIn: 'اضلاع',
      applying: 'درخواست دے رہے ہیں',
      back: 'واپس',
      cancel: 'منسوخ کریں',
      noResults: 'کوئی نتیجہ نہیں ملا',
      selectLocation: 'آگے بڑھنے کے لیے اپنا مقام منتخب کریں',
      selectedStateLabel: 'منتخب ریاست:',
      districtsCount: 'اضلاع',
      language: 'زبان',
    }
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  // Filter states based on search
  const filteredStates = useMemo(() => {
    if (!searchQuery) return INDIAN_STATES;
    const query = searchQuery.toLowerCase();
    return INDIAN_STATES.filter(state =>
      state.name.toLowerCase().includes(query) ||
      Object.entries(state).some(([key, value]) =>
        key.startsWith('name') && typeof value === 'string' && value.includes(searchQuery)
      ) ||
      state.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Filter districts based on search
  const filteredDistricts = useMemo(() => {
    if (!selectedState) return [];
    if (!searchQuery) return selectedState.districts;
    const query = searchQuery.toLowerCase();
    return selectedState.districts.filter(district =>
      district.name.toLowerCase().includes(query) ||
      Object.entries(district).some(([key, value]) =>
        key.startsWith('name') && typeof value === 'string' && value.includes(searchQuery)
      )
    );
  }, [selectedState, searchQuery]);

  const handleStateSelect = (state: State) => {
    setSelectedState(state);
    setSearchQuery('');
    setStep('district');
  };

  const handleDistrictSelect = (district: District) => {
    if (selectedState) {
      onLocationSelected(selectedState.name, district.name);
    }
  };

  const handleBack = () => {
    if (step === 'district') {
      setStep('state');
      setSelectedState(null);
      setSearchQuery('');
    } else {
      onCancel();
    }
  };

  /** Get static pre-translated state name for the current language */
  const getStaticStateName = (state: State): string => {
    switch (language) {
      case 'hi': return state.nameHi || '';
      case 'te': return state.nameTe || '';
      case 'kn': return state.nameKn || '';
      case 'ta': return state.nameTa || '';
      case 'ml': return state.nameMl || '';
      case 'mr': return state.nameMr || '';
      case 'bn': return state.nameBn || '';
      case 'gu': return state.nameGu || '';
      case 'or': return state.nameOr || '';
      case 'pa': return state.namePa || '';
      case 'ur': return state.nameUr || '';
      default: return state.name;
    }
  };

  /** Get static pre-translated district name for the current language */
  const getStaticDistrictName = (district: District): string => {
    switch (language) {
      case 'hi': return district.nameHi || '';
      case 'te': return district.nameTe || '';
      case 'kn': return district.nameKn || '';
      case 'ta': return district.nameTa || '';
      case 'ml': return district.nameMl || '';
      case 'mr': return district.nameMr || '';
      case 'bn': return district.nameBn || '';
      case 'gu': return district.nameGu || '';
      case 'or': return district.nameOr || '';
      case 'pa': return district.namePa || '';
      case 'ur': return district.nameUr || '';
      default: return district.name;
    }
  };

  /**
   * Returns the best available name for a state:
   * 1. Pre-translated static data  2. Dynamic cache  3. English fallback
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getStateName = useCallback((state: State): string => {
    if (language === 'en') return state.name;
    const staticName = getStaticStateName(state);
    if (staticName) return staticName;
    // Check dynamic translation cache
    const cached = translationCache[language]?.[state.name];
    return cached || state.name;
    // translateVersion included so this re-computes when cache updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, translateVersion]);

  /**
   * Returns the best available name for a district:
   * 1. Pre-translated static data  2. Dynamic cache  3. English fallback
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getDistrictName = useCallback((district: District): string => {
    if (language === 'en') return district.name;
    const staticName = getStaticDistrictName(district);
    if (staticName) return staticName;
    const cached = translationCache[language]?.[district.name];
    return cached || district.name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, translateVersion]);

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{step === 'state' ? t.cancel : t.back}</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                <MapPin className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent font-semibold uppercase tracking-wider">{t.applying}</p>
                <h1 className="text-2xl font-black text-white">{serviceName}</h1>
              </div>
            </div>

            {/* Language Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl self-start md:self-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.language}:</span>
              <span className="text-lg">{selectedLanguage?.flag}</span>
              <span className="text-sm font-bold text-white">
                {selectedLanguage?.name}
                {selectedLanguage?.nativeName && selectedLanguage.nativeName !== selectedLanguage.name && (
                  <span className="ml-1 text-neutral-400 font-normal">({selectedLanguage.nativeName})</span>
                )}
              </span>
            </div>
          </div>
          <p className="text-gray-400 mt-2">{t.selectLocation}</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${step === 'state' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'bg-green-500/20 text-green-400'}`}>
            {step === 'district' ? <CheckCircle2 className="w-5 h-5" /> : <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-sm font-bold">1</span>}
            <span className="font-semibold text-sm">{t.selectState}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-600" />
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${step === 'district' ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white' : 'bg-white/10 text-gray-500'}`}>
            <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-sm font-bold">2</span>
            <span className="font-semibold text-sm">{t.selectDistrict}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder={step === 'state' ? t.searchState : t.searchDistrict}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-16 h-14 text-lg border-2 border-white/20 bg-white/10 text-white placeholder-gray-500 focus:border-purple-500 rounded-2xl cursor-text"
          />
          <button
            onClick={listeningStatus === 'listening' ? handleStopListening : handleStartListening}
            disabled={listeningStatus === 'processing'}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${listeningStatus === 'listening'
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse'
              : listeningStatus === 'processing'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'
              }`}
          >
            {listeningStatus === 'listening' ? (
              <MicOff className="w-5 h-5" />
            ) : listeningStatus === 'processing' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </div>

        {voiceError && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700/50 rounded-xl text-red-400 text-sm">
            {voiceError}
          </div>
        )}

        {/* Content */}
        <Card className="bg-black shadow-xl rounded-3xl border border-neutral-800 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                {step === 'state' ? t.statesUnion : `${t.districtsIn} ${selectedState ? getStateName(selectedState) : ''}`}
              </h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/5">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">{t.language}:</span>
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                  <span>{selectedLanguage?.flag}</span>
                  <span>{selectedLanguage?.nativeName || selectedLanguage?.name}</span>
                </span>
              </div>
            </div>

            {step === 'state' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredStates.length === 0 ? (
                  <p className="col-span-full text-center py-8 text-neutral-500">{t.noResults}</p>
                ) : (
                  filteredStates.map((state) => (
                    <button
                      key={state.code}
                      onClick={() => handleStateSelect(state)}
                      className="group flex items-center justify-between p-4 bg-neutral-900 hover:bg-neutral-800 rounded-xl border-2 border-neutral-800 hover:border-cyan-500/50 transition-all text-left"
                    >
                      <div>
                        <p className="font-bold text-white group-hover:text-cyan-400">{getStateName(state)}</p>
                        {language !== 'en' && getStateName(state) !== state.name && (
                          <p className="text-xs text-neutral-500 mt-0.5">{state.name}</p>
                        )}
                        <p className="text-xs text-neutral-500 mt-1">{state.districts.length} {t.districtsCount}</p>
                      </div>
                      <div className="w-8 h-8 bg-neutral-800 group-hover:bg-cyan-500/20 rounded-full flex items-center justify-center">
                        <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-cyan-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredDistricts.length === 0 ? (
                  <p className="col-span-full text-center py-8 text-neutral-500">{t.noResults}</p>
                ) : (
                  filteredDistricts.map((district, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDistrictSelect(district)}
                      className="group flex items-center justify-between p-4 bg-neutral-900 hover:bg-neutral-800 rounded-xl border-2 border-neutral-800 hover:border-green-500/50 transition-all text-left"
                    >
                      <div>
                        <p className="font-bold text-white group-hover:text-green-400">{getDistrictName(district)}</p>
                        {language !== 'en' && getDistrictName(district) !== district.name && (
                          <p className="text-xs text-neutral-500 mt-0.5">{district.name}</p>
                        )}
                      </div>
                      <div className="w-8 h-8 bg-neutral-800 group-hover:bg-green-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-neutral-500 group-hover:text-green-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Selected State Badge (in district step) */}
        {step === 'district' && selectedState && (
          <div className="mt-6 flex items-center gap-2 justify-center">
            <span className="text-sm text-neutral-400">{t.selectedStateLabel}</span>
            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full font-semibold text-sm">
              {getStateName(selectedState)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
