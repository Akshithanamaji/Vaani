"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { INDIAN_STATES, State, District } from '@/lib/indian-locations';
import { MapPin, Search, ChevronRight, ArrowLeft, CheckCircle2, Building2, Mic, MicOff, Loader2, Globe, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
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

// Translation cache
const translationCache: Record<string, Record<string, string>> = {};

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
  } catch { /* ignore */ }
}

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
  const [translateVersion, setTranslateVersion] = useState(0);

  // Voice recording state
  const [listeningStatus, setListeningStatus] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [shouldTranscribeBlob, setShouldTranscribeBlob] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  const [useGroqWhisper] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });

  const { isRecording, audioBlob, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { abortVoiceRecording(recognitionRef.current); } catch (e) { }
      }
    };
  }, []);

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
  }, [shouldTranscribeBlob, audioBlob, language, resetRecording, step]);

  const handleVoiceTranscript = (transcript: string) => {
    const matchText = transcript.toLowerCase().trim();
    setSearchQuery(matchText);
    setListeningStatus('idle');
    setVoiceError(null);

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
        if (partials.length === 1) handleStateSelect(partials[0]);
      }
    } else if (selectedState) {
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
        if (partials.length === 1) handleDistrictSelect(partials[0]);
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

  useEffect(() => {
    if (language === 'en') return;
    const stateNames = INDIAN_STATES.map(s => s.name);
    fetchTranslations(stateNames, language).then(() => setTranslateVersion(v => v + 1));
  }, [language]);

  useEffect(() => {
    if (language === 'en' || !selectedState) return;
    const districtNames = selectedState.districts.map(d => d.name);
    fetchTranslations(districtNames, language).then(() => setTranslateVersion(v => v + 1));
  }, [selectedState, language]);

  useEffect(() => {
    const prompt = step === 'state' ? t.selectState : t.selectDistrict;
    if (prompt) {
      const t = setTimeout(() => {
        speakText(prompt, language);
      }, 100);
      return () => clearTimeout(t);
    }
  }, [step, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const translations = {
    en: {
      selectState: 'Select Your State',
      selectDistrict: 'Select Your District',
      searchState: 'Search state...',
      searchDistrict: 'Search district...',
      statesUnion: 'States & Union Territories',
      districtsIn: 'Districts in',
      applying: 'APPLYING FOR',
      back: 'Back',
      cancel: 'Cancel',
      noResults: 'No results found',
      selectLocation: 'Select your location to continue',
      selectedStateLabel: 'Selected State:',
      districtsCount: 'districts',
      language: 'LANGUAGE',
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
    te: { selectState: 'మీ రాష్ట్రాన్ని ఎంచుకోండి', selectDistrict: 'మీ జిల్లాను ఎంచుకోండి', searchState: 'రాష్ట్రం శోధించండి...', searchDistrict: 'జిల్లా శోధించండి...', statesUnion: 'రాష్ట్రాలు & కేంద్రపాలిత ప్రాంతాలు', districtsIn: 'జిల్లాలు', applying: 'దరఖాస్తు', back: 'వెనుకకు', cancel: 'రద్దు చేయండి', noResults: 'ఫలితాలు కనుగొనబడలేదు', selectLocation: 'కొనసాగించడానికి మీ స్థానాన్ని ఎంచుకోండి', selectedStateLabel: 'ఎంచుకున్న రాష్ట్రం:', districtsCount: 'జిల్లాలు', language: 'భాష' },
    kn: { selectState: 'ನಿಮ್ಮ ರಾಜ್ಯವನ್ನು ಆಯ್ಕೆ ಮಾಡಿ', selectDistrict: 'ನಿಮ್ಮ ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ', searchState: 'ರಾಜ್ಯವನ್ನು ಹುಡುಕಿ...', searchDistrict: 'ಜಿಲ್ಲೆಯನ್ನು ಹುಡುಕಿ...', statesUnion: 'ರಾಜ್ಯಗಳು ಮತ್ತು ಕೇಂದ್ರಾಡಳಿತ ಪ್ರದೇಶಗಳು', districtsIn: 'ಜಿಲ್ಲೆಗಳು', applying: 'ಅರ್ಜಿ ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ', back: 'ಹಿಂದೆ', cancel: 'ರದ್ದುಮಾಡಿ', noResults: 'ಯಾವುದೇ ಫಲಿತಾಂಶಗಳು ಕಂಡುಬಂದಿಲ್ಲ', selectLocation: 'ಮುಂದುವರಿಯಲು ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಆಯ್ಕೆಮಾಡಿ', selectedStateLabel: 'ಆಯ್ಕೆಮಾಡಿದ ರಾಜ್ಯ:', districtsCount: 'ಜಿಲ್ಲೆಗಳು', language: 'ಭಾಷೆ' },
    ta: { selectState: 'உங்கள் மாநிலத்தைத் தேர்ந்தெடுக்கவும்', selectDistrict: 'உங்கள் மாவட்டத்தைத் தேர்ந்தெடுக்கவும்', searchState: 'மாநிலத்தைத் தேடுங்கள்...', searchDistrict: 'மாவட்டத்தைத் தேடுங்கள்...', statesUnion: 'மாநிலங்கள் மற்றும் யூனியன் பிரதேசங்கள்', districtsIn: 'மாவட்டங்கள்', applying: 'விண்ணப்பிக்கிறது', back: 'பின்னால்', cancel: 'ரந்து செய்', noResults: 'முடிவுகள் எதுவும் இல்லை', selectLocation: 'தொடர உங்கள் இருப்பிடத்தைத் தேர்ந்தெடுக்கவும்', selectedStateLabel: 'தேர்ந்தெடுக்கப்பட்ட மாநிலம்:', districtsCount: 'மாவட்டங்கள்', language: 'மொழி' },
    ml: { selectState: 'നിങ്ങളുടെ സംസ്ഥാനം തിരഞ്ഞെടുക്കുക', selectDistrict: 'നിങ്ങളുടെ ജില്ല തിരഞ്ഞെടുക്കുക', searchState: 'സംസ്ഥാനം തിരയുക...', searchDistrict: 'ജില്ല തിരയുക...', statesUnion: 'സംസ്ഥാനങ്ങളും കേന്ദ്രഭരണ പ്രദേശങ്ങളും', districtsIn: 'ജില്ലകൾ', applying: 'അപേക്ഷിക്കുന്നു', back: 'പിന്നിലേക്ക്', cancel: 'റദ്ദാക്കുക', noResults: 'ഫലങ്ങളൊന്നും കണ്ടെത്തിയില്ല', selectLocation: 'തുടരാൻ നിങ്ങളുടെ ലൊക്കേഷൻ തിരഞ്ഞെടുക്കുക', selectedStateLabel: 'തിരഞ്ഞെടുത്ത സംസ്ഥാനം:', districtsCount: 'ജില്ലകൾ', language: 'ഭാഷ' },
    mr: { selectState: 'आपले राज्य निवडा', selectDistrict: 'आपला जिल्हा निवडा', searchState: 'राज्य शोधा...', searchDistrict: 'जिल्हा शोधा...', statesUnion: 'राज्ये आणि केंद्रशासित प्रदेश', districtsIn: 'जिल्हे', applying: 'अर्ज करत आहे', back: 'मागे', cancel: 'रद्द करा', noResults: 'कोणतेही निकाल सापडले नाहीत', selectLocation: 'पुढे जाण्यासाठी आपले स्थान निवडा', selectedStateLabel: 'निवडलेले राज्य:', districtsCount: 'जिल्हे', language: 'भाषा' },
    bn: { selectState: 'আপনার রাজ্য নির্বাচন করুন', selectDistrict: 'আপনার জেলা নির্বাচন করুন', searchState: 'রাজ্য খুঁজুন...', searchDistrict: 'জেলা খুঁজুন...', statesUnion: 'রাজ্য ও কেন্দ্রশাসিত অঞ্চল', districtsIn: 'জেলা', applying: 'আবেদন করা হচ্ছে', back: 'পিছনে', cancel: 'বাতিল করুন', noResults: 'কোন ফলাফল পাওয়া যায়নি', selectLocation: 'চালিয়ে যেতে আপনার অবস্থান নির্বাচন করুন', selectedStateLabel: 'নির্বাচিত রাজ্য:', districtsCount: 'জেলা', language: 'ভাষা' },
    gu: { selectState: 'તમારું રાજ્ય પસંદ કરો', selectDistrict: 'તમારો જિલ્લો પસંદ કરો', searchState: 'રાજ્ય શોધો...', searchDistrict: 'જિલ્લો શોધો...', statesUnion: 'રાજ્યો અને કેન્દ્રશાસિત પ્રદેશો', districtsIn: 'જિલ્લાઓ', applying: 'અરજી કરી રહ્યા છીએ', back: 'પાછળ', cancel: 'રદ કરો', noResults: 'કોઈ પરિણામ મળ્યા નથી', selectLocation: 'આગળ વધવા માટે તમારું સ્થાન પસંદ કરો', selectedStateLabel: 'પસંદ કરેલ રાજ્ય:', districtsCount: 'જિલ્લાઓ', language: 'ભાષા' },
    or: { selectState: 'ଆପଣଙ୍କ ରାଜ୍ୟ ଚୟନ କରନ୍ତୁ', selectDistrict: 'ଆପଣଙ୍କ ଜିଲ୍ଲା ଚୟନ କରନ୍ତୁ', searchState: 'ରାଜ୍ୟ ଖୋଜନ୍ତୁ...', searchDistrict: 'ଜିଲ୍ଲା ଖୋଜନ୍ତୁ...', statesUnion: 'ରାଜ୍ୟ ଏବଂ କେନ୍ଦ୍ର ଶାସିତ ଅଞ୍ଚଳ', districtsIn: 'ଜିଲ୍ଲା', applying: 'ଆବେଦନ କରୁଛୁ', back: 'ପଛକୁ', cancel: 'ବାତିଲ କରନ୍ତୁ', noResults: 'କୌଣସି ଫଳାଫଳ ମିଳିଲା ନାହିଁ', selectLocation: 'ଆଗକୁ ବଢିବା ପାଇଁ ଆପଣଙ୍କ ସ୍ଥାନ ଚୟନ କରନ୍ତୁ', selectedStateLabel: 'ଚୟନିତ ରାಜ୍ୟ:', districtsCount: 'ଜିଲ୍ଲା', language: 'ଭାଷା' },
    pa: { selectState: 'ਆਪਣੇ ਰਾਜ ਦੀ ਚੋਣ ਕਰੋ', selectDistrict: 'ਆਪਣੇ ਜ਼ਿਲ੍ਹੇ ਦੀ ਚੋਣ ਕਰੋ', searchState: 'ਰਾਜ ਦੀ ਖੋਜ ਕਰੋ...', searchDistrict: 'ਜ਼ਿਲ੍ਹੇ ਦੀ ਖੋਜ ਕਰੋ...', statesUnion: 'ਰਾਜ ਅਤੇ ਕੇਂਦਰ ਸ਼ਾਸਤ ਪ੍ਰਦੇਸ਼', districtsIn: 'ਜ਼ਿਲ੍ਹੇ', applying: 'ਅਪਲਾਈ ਕਰ ਰਹੇ ਹੋ', back: 'ਪਿੱਛੇ', cancel: 'ਰੱਦ ਕਰੋ', noResults: 'ਕੋਈ ਨਤੀਜਾ ਨਹੀਂ ਮਿਲਿਆ', selectLocation: 'ਜਾਰੀ ਰੱਖਣ ਲਈ ਆਪਣਾ ਸਥਾਨ ਚੁਣੋ', selectedStateLabel: 'ਚੁਣਿਆ ਹੋਇਆ ਰਾਜ:', districtsCount: 'ਜ਼ਿਲ੍ਹੇ', language: 'ਭਾਸ਼ਾ' },
    ur: { selectState: 'اپنی ریاست منتخب کریں', selectDistrict: 'اپنا ضلع منتخب کریں', searchState: 'ریاست تلاش کریں...', searchDistrict: 'ضلع تلاش کریں...', statesUnion: 'ریاستیں اور مرکز کے زیر انتظام علاقے', districtsIn: 'اضلاع', applying: 'درخواست دے رہے ہیں', back: 'واپس', cancel: 'منسوخ کریں', noResults: 'کوئی نتیجہ نہیں ملا', selectLocation: 'آگے بڑھنے کے لیے اپنا مقام منتخب کریں', selectedStateLabel: 'منتخب ریاست:', districtsCount: 'اضلاع', language: 'زبان' }
  };

  const t = (translations as any)[language] || translations.en;

  const filteredStates = useMemo(() => {
    if (!searchQuery) return INDIAN_STATES;
    const query = searchQuery.toLowerCase();
    return INDIAN_STATES.filter(state =>
      state.name.toLowerCase().includes(query) ||
      Object.entries(state).some(([key, value]) =>
        key.startsWith('name') && typeof value === 'string' && value.toLowerCase().includes(query)
      ) ||
      state.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const filteredDistricts = useMemo(() => {
    if (!selectedState) return [];
    if (!searchQuery) return selectedState.districts;
    const query = searchQuery.toLowerCase();
    return selectedState.districts.filter(district =>
      district.name.toLowerCase().includes(query) ||
      Object.entries(district).some(([key, value]) =>
        key.startsWith('name') && typeof value === 'string' && value.toLowerCase().includes(query)
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

  const getStateName = useCallback((state: State): string => {
    if (language === 'en') return state.name;
    const staticName = getStaticStateName(state);
    if (staticName) return staticName;
    return translationCache[language]?.[state.name] || state.name;
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDistrictName = useCallback((district: District): string => {
    if (language === 'en') return district.name;
    const staticName = getStaticDistrictName(district);
    if (staticName) return staticName;
    return translationCache[language]?.[district.name] || district.name;
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#000000] text-white p-4 md:p-10 font-sans selection:bg-cyan-500/30">
      <div className="max-w-6xl mx-auto">

        {/* Top Header Section with Language Badge */}
        <div className="flex flex-col md:flex-row md:items-start justify-between mb-10 gap-6">
          <div className="animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={handleBack}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <p className="text-[9px] font-black text-cyan-400 uppercase tracking-[0.3em]">{t.applying}</p>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-1 ml-11 md:ml-0 leading-tight">
              {serviceName}
            </h1>
            <p className="text-gray-500 text-base font-medium ml-11 md:ml-0">{t.selectLocation}</p>
          </div>

          <div className="flex items-center gap-2.5 px-4 py-2 bg-[#0d0d0d] border border-white/5 rounded-xl shadow-2xl self-start group hover:border-cyan-500/20 transition-all duration-500">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em] mb-0.5">{t.language}</span>
              <span className="text-sm font-black text-white tracking-tight flex items-center gap-1.5">
                {selectedLanguage?.name}
                <span className="text-lg leading-none">{selectedLanguage?.flag}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Step Progress Pills with sleek separators */}
        <div className="flex items-center gap-4 mb-10 flex-wrap">
          <div
            onClick={() => step === 'district' && handleBack()}
            className={`group flex items-center gap-3 px-6 py-3 rounded-full cursor-pointer transition-all duration-500 border-2 ${step === 'state'
              ? 'bg-gradient-to-r from-cyan-600 to-purple-700 border-transparent text-white shadow-[0_8px_30px_rgba(8,145,178,0.2)]'
              : 'bg-[#0d0d0d]/80 border-white/5 text-gray-500 hover:text-gray-300'
              }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-500 ${step === 'state' ? 'bg-white text-cyan-600' : 'bg-gray-800'}`}>1</div>
            <span className="text-xs font-black tracking-widest uppercase">{t.selectState}</span>
            {step === 'district' && <CheckCircle2 className="w-3.5 h-3.5 ml-0.5 text-cyan-400" />}
          </div>

          <ArrowRight className={`w-4 h-4 ${step === 'state' ? 'text-cyan-500/30' : 'text-gray-900'}`} />

          <div
            className={`group flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-500 border-2 ${step === 'district'
              ? 'bg-gradient-to-r from-cyan-600 to-purple-700 border-transparent text-white shadow-[0_8px_30px_rgba(8,145,178,0.2)]'
              : 'bg-[#0d0d0d]/40 border-white/5 text-gray-800'
              }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-500 ${step === 'district' ? 'bg-white text-purple-600' : 'bg-gray-900'}`}>2</div>
            <span className="text-xs font-black tracking-widest uppercase">{t.selectDistrict}</span>
          </div>
        </div>

        {/* Global Search Interface with glassmorphism */}
        <div className="relative mb-12 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-[1.7rem] blur opacity-5 group-focus-within:opacity-15 transition duration-1000"></div>
          <div className="relative flex items-center">
            <Search className="absolute left-6 w-5 h-5 text-gray-600 transition-colors group-focus-within:text-cyan-400 z-10" />
            <Input
              type="text"
              placeholder={step === 'state' ? t.searchState : t.searchDistrict}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-16 pr-20 h-16 text-lg border-white/5 bg-[#0a0a0a]/90 backdrop-blur-3xl text-white placeholder-gray-800 focus:border-cyan-500/40 focus:ring-0 rounded-[1.5rem] transition-all duration-500 shadow-inner"
            />

            <div className="absolute right-4 flex items-center gap-2">
              <button
                onClick={listeningStatus === 'listening' ? handleStopListening : handleStartListening}
                disabled={listeningStatus === 'processing'}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 transform ${listeningStatus === 'listening'
                  ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse'
                  : 'bg-white/5 text-gray-500 hover:bg-white/10 hover:text-white'
                  }`}
              >
                {listeningStatus === 'listening' ? (
                  <MicOff className="w-5 h-5" />
                ) : listeningStatus === 'processing' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Listing Section */}
        <div className="animate-in fade-in duration-1000 pb-20">
          <div className="flex items-center justify-between mb-8 px-4">
            <h2 className="text-lg font-black text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-xl">
                <Building2 className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="tracking-tight uppercase italic">
                {step === 'state' ? t.statesUnion : `${t.districtsIn} ${selectedState ? getStateName(selectedState) : ''}`}
              </span>
            </h2>

            <div className="hidden md:flex items-center gap-2 group cursor-default">
              <div className="w-1 h-1 rounded-full bg-cyan-500 group-hover:scale-150 transition-transform duration-300"></div>
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{selectedLanguage?.name} Active</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {step === 'state' ? (
              filteredStates.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-[#070707] rounded-[2rem] border border-white/5">
                  <p className="text-gray-700 font-black text-lg uppercase italic opacity-30">{t.noResults}</p>
                </div>
              ) : (
                filteredStates.map((state) => (
                  <button
                    key={state.code}
                    onClick={() => handleStateSelect(state)}
                    className="group relative p-6 bg-[#0d0d0d] hover:bg-[#121212] border border-white/5 hover:border-cyan-500/50 rounded-[2rem] transition-all duration-500 text-left shadow-xl hover:-translate-y-1"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    <div className="flex items-start justify-between relative z-10 h-full">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-white group-hover:text-cyan-400 transition-colors tracking-tight leading-tight mb-1.5">
                          {getStateName(state)}
                        </h3>
                        {language !== 'en' && getStateName(state) !== state.name && (
                          <p className="text-[9px] text-gray-600 font-bold mb-4 tracking-widest uppercase opacity-40">{state.name}</p>
                        )}
                        <span className="px-3 py-1 bg-white/[0.03] rounded-lg border border-white/5 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20 text-[9px] font-black text-gray-500 group-hover:text-cyan-400 tracking-widest uppercase transition-all">
                          {state.districts.length} {t.districtsCount}
                        </span>
                      </div>

                      <div className="w-10 h-10 bg-white/5 group-hover:bg-cyan-500 rounded-full flex items-center justify-center text-gray-500 group-hover:text-white transition-all duration-500 group-hover:rotate-[360deg] shadow-lg">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                ))
              )
            ) : (
              filteredDistricts.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-[#070707] rounded-[2rem] border border-white/5">
                  <p className="text-gray-700 font-black text-lg uppercase italic opacity-30">{t.noResults}</p>
                </div>
              ) : (
                filteredDistricts.map((district, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleDistrictSelect(district)}
                    className="group relative p-6 bg-[#0d0d0d] hover:bg-[#121212] border border-white/5 hover:border-green-500/50 rounded-[2rem] transition-all duration-500 text-left shadow-xl hover:-translate-y-1"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 blur-[40px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-white group-hover:text-green-400 transition-colors tracking-tight leading-tight mb-1.5">
                          {getDistrictName(district)}
                        </h3>
                        {language !== 'en' && getDistrictName(district) !== district.name && (
                          <p className="text-[9px] text-gray-600 font-bold tracking-widest uppercase opacity-40">{district.name}</p>
                        )}
                      </div>

                      <div className="w-11 h-11 bg-white/5 group-hover:bg-green-500 rounded-xl flex items-center justify-center text-gray-600 group-hover:text-white transition-all duration-500 shadow-lg">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    </div>
                  </button>
                ))
              )
            )}
          </div>
        </div>

        {/* Selected State Toast (Mobile friendly) */}
        {step === 'district' && selectedState && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-1000">
            <div className="px-6 py-3 bg-[#0d0d0d]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-3xl flex items-center gap-3.5 ring-1 ring-white/10">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-gray-500 uppercase tracking-[0.2em] mb-0.5">{t.selectedStateLabel}</span>
                <span className="text-base font-black text-cyan-400 tracking-tight">{getStateName(selectedState)}</span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-cyan-500" />
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .pl-16 { padding-left: 4rem; }
        .h-16 { height: 4rem; }
        body { background-color: #000000; overflow-x: hidden; }
        
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #000;
        }
        ::-webkit-scrollbar-thumb {
          background: #1a1a1a;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #222;
        }
        
        .shadow-3xl { box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.9); }
      `}</style>
    </div>
  );
}
