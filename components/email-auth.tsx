'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { isValidEmail } from '@/lib/auth-utils';
import { Mail, User, Phone, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { translations } from '@/lib/translations';

// Sign-in page voice instructions in all 12 supported languages
const signInVoiceInstructions: Record<string, string> = {
  en: 'Welcome to Vaani AI. Tell us your full name and phone number to get started. I will listen to you automatically.',
  hi: 'वानी एआई में आपका स्वागत है। शुरू करने के लिए अपना पूरा नाम और फोन नंबर बताएं। मैं आपकी बात अपने आप सुनूँगा।',
  te: 'వానీ AI కు స్వాగతం. ప్రారంభించడానికి మీ పూర్తి పేరు మరియు ఫోన్ నంబర్ చెప్పండి. నేను ఆటోమేటిక్గా వింటాను.',
  kn: 'ವಾಣಿ AI ಗೆ ಸ್ವಾಗತ. ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಮತ್ತು ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ತಿಳಿಸಿ. ನಾನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಕೇಳುತ್ತೇನೆ.',
  ta: 'வாணி AI-க்கு வரவேற்கிறோம். தொடங்குவதற்கு உங்கள் முழுப் பெயர் மற்றும் தொலைபேసి எண்ணைக் கூறுங்கள். நான் தானாகவே கேட்பேன்.',
  ml: 'വാണി AI-ലേക്ക് സ്വാഗതം. തുടങ്ങാനായി നിങ്ങളുടെ മുഴുവൻ പേരും ഫോൺ നമ്പറും പറയുക. ഞാൻ അത് സ്വയം കേൾക്കും.',
  mr: 'वाणी AI मध्ये तुमचे स्वागत आहे. सुरू करण्यासाठी तुमचे पूर्ण नाव आणि फोन नंबर सांगा. मी आपोआप ऐकेन.',
  bn: 'ভানী AI-তে আপনাকে স্বাগতম। শুরু করতে আপনার পুরো নাম এবং ফোন নম্বর বলুন। আমি স্বয়ংক্রিয়ভাবে শুনব।',
  gu: 'વાણી AI માં ફરી એકવાર સ્વાગત છે. શરૂ કરવા માટે તમારું નામ અને ફોન નંબર જણાવો. હું આપોઆપ સાંભળીશ.',
  or: 'ଭାଣୀ AI କୁ ସ୍ୱାଗତ। ଆରମ୍ଭ କରିବା ପାଇଁ ଆପଣଙ୍କ ପୂର୍ଣ୍ଣ ନାମ ଏବଂ ଫୋନ୍ ନମ୍ବର କୁହନ୍ତୁ। ମୁଁ ଆପେ ଆପେ ଶୁଣିବି।',
  pa: 'ਵਾਣੀ AI ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਆਪਣਾ ਪੂਰਾ ਨਾਮ ਅਤੇ ਫ਼ੋਨ ਨੰਬਰ ਦੱਸੋ। ਮੈਂ ਆਪਣੇ ਆਪ ਸੁਣਾਂਗਾ।',
  ur: 'وانی AI میں خوش آمدید۔ شروع کرنے کے لیے اپنا پورا نام اور فون نمبر بتائیں۔ میں خود بخود سنوں گا۔',
};

// Field-level voice prompts in all 12 languages
const fieldVoicePrompts: Record<string, Record<string, string>> = {
  name: {
    en: 'Please say your full name.',
    hi: 'कृपया अपना पूरा नाम बोलें।',
    te: 'దయచేసి మీ పూర్తి పేరు చెప్పండి.',
    kn: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಹೇಳಿ.',
    ta: 'உங்கள் முழு பெயரைச் சொல்லுங்கள்.',
    ml: 'നിങ്ങളുടെ പൂർണ്ണ നാമം പറയുക.',
    mr: 'कृपया आपले पूर्ण नाव सांगा.',
    bn: 'অনুগ্রহ করে আপনার পূর্ণ নাম বলুন।',
    gu: 'કૃપા કરીને તમારું પૂરું નામ બોલો.',
    or: 'ଦୟାକରି ଆପଣଙ୍କ ପୂର୍ଣ ନାମ କୁହନ୍ତୁ।',
    pa: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਪੂਰਾ ਨਾਮ ਬੋਲੋ।',
    ur: 'براہ کرم اپنا پورا نام بولیں۔',
  },
  phone: {
    en: 'Please say your phone number.',
    hi: 'कृपया अपना फ़ोन नंबर बोलें।',
    te: 'దయచేసి మీ ఫోన్ నంబర్ చెప్పండి.',
    kn: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಫೋನ್ ನಂಬರ್ ಹೇಳಿ.',
    ta: 'உங்கள் தொலைபேசி எண்ணைச் சொல்லுங்கள்.',
    ml: 'നിങ്ങളുടെ ഫോൺ നമ്പർ പറയുക.',
    mr: 'कृपया आपला फोन नंबर सांगा.',
    bn: 'অনুগ্রহ করে আপনার ফোন নম্বর বলুন।',
    gu: 'કૃપા કરીને તમારો ફоન નંбр બоλо.',
    or: 'ଦୟାକରି ଆପଣଙ୍କ ଫୋନ ନମ୍ବର କୁହନ୍ତୁ।',
    pa: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਫ਼ੋਨ ਨੰਬਰ ਬੋਲੋ।',
    ur: 'براہ کرم اپنا فون نمبر بولیں۔',
  },
  email: {
    en: 'Please say your email address.',
    hi: 'कृपया अपना ईमेल पता बोलें।',
    te: 'దయచేసి మీ ఇమెయిల్ చిరునామా చెప్పండి.',
    kn: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸ ಹೇಳಿ.',
    ta: 'உங்கள் மின்னஞ்சல் முகவரியைச் சொல்லுங்கள்.',
    ml: 'നിങ്ങളുടെ ഇമെയിൽ വിലാസം പറയുക.',
    mr: 'कृपया आपला ईमेल पत्ता सांगा.',
    bn: 'অনুগ্রহ করে আপনার ইমেইল ঠিকানা বলুন।',
    gu: 'કૃपा করীने তमারо ई-মেইল सरनামु बोलो.',
    or: 'ଦୟାକରି ଆପଣଙ୍କ ଇ-ମେଲ ଠିକଣା କୁହନ୍ତୁ।',
    pa: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਈਮੇਲ ਪਤਾ ਬੋਲੋ।',
    ur: 'براہ کرم اپنا ای میل پتہ بولیں۔',
  },
};

// Language code to BCP-47 tag for speech recognition
const langToBCP47: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', te: 'te-IN', kn: 'kn-IN', ta: 'ta-IN',
  ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', or: 'or-IN',
  pa: 'pa-IN', ur: 'ur-PK',
};

// Listen button label in selected language
const listenLabel: Record<string, string> = {
  en: 'Listen', hi: 'सुनें', te: 'వినండి', kn: 'ಕೇಳಿ', ta: 'கேளுங்கள்',
  ml: 'കേൾക്കുക', mr: 'ऐका', bn: 'শুনুন', gu: 'સાંભળો', or: 'ଶୁଣନ୍ତୁ',
  pa: 'ਸੁਣੋ', ur: 'سنیں',
};
const stopLabel: Record<string, string> = {
  en: 'Stop', hi: 'रोकें', te: 'ఆపు', kn: 'ನಿಲ್ಲಿಸಿ', ta: 'நிறுத்து',
  ml: 'നിർത്തുക', mr: 'थांबा', bn: 'থামুন', gu: 'રોકો', or: 'ବନ୍ଦ',
  pa: 'ਰੋਕੋ', ur: 'رکیں',
};

interface EmailAuthProps {
  onAuthSuccess: (email: string) => void;
  language?: any;
}

export function EmailAuth({ onAuthSuccess, language }: EmailAuthProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Use refs to avoid stale closures in voice callbacks
  const nameRef = useRef('');
  const phoneRef = useRef('');

  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { phoneRef.current = phone; }, [phone]);

  const [error, setError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeField, setActiveField] = useState<'name' | 'phone' | 'email' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const recognitionRef = useRef<any>(null);
  const hasSpokenRef = useRef(false);
  const isSpeakingPromptRef = useRef(false);
  const ignoreUntilRef = useRef(0);

  const langCode = language?.code || 'en';
  const t = translations[langCode] || translations['en'];
  const bcp47 = langToBCP47[langCode] || 'en-IN';

  const autoTriggerRef = useRef(false);

  // AUTO-VOICE FLOW ON MOUNT
  useEffect(() => {
    if (autoTriggerRef.current) return;
    autoTriggerRef.current = true;

    const runAutoFlow = async () => {
      // 1. Initial Greeting
      const { speakText } = await import('@/lib/voice-utils');
      const instruction = signInVoiceInstructions[langCode] || signInVoiceInstructions['en'];
      
      // Wait a tiny bit for the component to be fully visible
      setTimeout(async () => {
        setIsSpeaking(true);
        await speakText(instruction, bcp47);
        setIsSpeaking(false);

        // 2. Start collecting NAME
        startVoiceInput('name');
      }, 1000);
    };

    runAutoFlow();

    return () => {
      if (recognitionRef.current) {
        import('@/lib/voice-utils').then(({ stopVoiceRecording }) => {
          try { stopVoiceRecording(recognitionRef.current); } catch (e) { }
        });
      }
      import('@/lib/voice-utils').then(({ stopSpeaking }) => stopSpeaking());
    };
  }, []);


  // Replay / stop instructions
  const handleListenInstructions = async () => {
    const { speakText, stopSpeaking } = await import('@/lib/voice-utils');
    if (isSpeaking) { stopSpeaking(); setIsSpeaking(false); return; }
    const instruction = signInVoiceInstructions[langCode] || signInVoiceInstructions['en'];
    setIsSpeaking(true);
    speakText(instruction, bcp47).finally(() => setIsSpeaking(false));
  };

  // Start/stop voice input for a specific field
  const startVoiceInput = async (field: 'name' | 'phone' | 'email') => {
    const { stopSpeaking, speakText, initVoiceRecognition, startVoiceRecording, stopVoiceRecording } =
      await import('@/lib/voice-utils');

    stopSpeaking();
    setIsSpeaking(false);
    isSpeakingPromptRef.current = false;

    // Toggle off if already listening to same field
    if (isListening && activeField === field) {
      if (recognitionRef.current) {
        try { stopVoiceRecording(recognitionRef.current); } catch (e) { }
        recognitionRef.current = null;
      }
      setIsListening(false);
      setActiveField(null);
      setVoiceStatus('');
      return;
    }

    // Stop any previous recognition
    if (recognitionRef.current) {
      try { stopVoiceRecording(recognitionRef.current); } catch (e) { }
      recognitionRef.current = null;
    }

    // Speak the field prompt but DO NOT await it.
    // Awaiting it takes several seconds, causing the browser to revoke the user-gesture token,
    // which secretly blocks the microphone from starting (NotAllowedError).
    const prompt = fieldVoicePrompts[field]?.[langCode] || fieldVoicePrompts[field]?.['en'];
    const normalizedPrompt = prompt.toLowerCase().replace(/[.,!?।॥]/g, '').trim();

    isSpeakingPromptRef.current = true;
    speakText(prompt, bcp47).finally(() => {
      isSpeakingPromptRef.current = false;
      ignoreUntilRef.current = Date.now() + 1000;
    }).catch(e => {
      console.warn(e);
      isSpeakingPromptRef.current = false;
    });

    setActiveField(field);
    setIsListening(true);
    setVoiceStatus('...');

    const recognition = initVoiceRecognition(
      bcp47,
      async (result: any) => {
        if (!result.transcript) return;
        
        let text = result.transcript.trim();
        const textLower = text.toLowerCase().replace(/[.,!?।॥]/g, '').trim();

        if (isSpeakingPromptRef.current || Date.now() < ignoreUntilRef.current) {
          if (normalizedPrompt.includes(textLower) || textLower.includes(normalizedPrompt)) {
             return; // ignore prompt echo
          }
          if (!result.isFinal) return; // ignore interim during speech
        }

        if (textLower === normalizedPrompt) return;
        if (textLower.startsWith(normalizedPrompt) && textLower.length > normalizedPrompt.length) {
           text = text.substring(prompt.length).trim();
        }

        if (!text) return;

        // Interim results: show exactly what the user is saying live
        if (!result.isFinal) {
          if (field === 'name') setName(text);
          else if (field === 'phone') setPhone(text);
        } else {
          // Final Result: Call Gemini API to parse and format it cleanly
          setVoiceStatus('Formatting...');
          try {
            const response = await fetch('/api/voice-process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                transcript: text,
                language: bcp47,
                fieldName: field,
                context: {}
              })
            });
            const data = await response.json();
            const formattedText = data.success && data.transcript ? data.transcript : text;

            if (field === 'name') {
              setName(formattedText);
              // AUTO MOVE TO PHONE after a successful name capture
              setTimeout(() => startVoiceInput('phone'), 1500);
            }
            else if (field === 'phone') {
              setPhone(formattedText);
              // AUTO SUBMIT after a successful phone capture
              setTimeout(() => handleGetStarted(formattedText), 1500);
            }
          } catch (e) {
            // Fallback
            if (field === 'name') {
              setName(text);
              setTimeout(() => startVoiceInput('phone'), 1500);
            }
            else if (field === 'phone') {
              setPhone(text);
              setTimeout(() => handleGetStarted(text), 1500);
            }
          }
          setVoiceStatus('');
        }
      },
      (err: any) => {
        console.warn('[VoiceInput] Error:', err);
        setVoiceStatus(''); setIsListening(false); setActiveField(null);
      },
      () => { 
        setIsListening(false); 
        setActiveField(null); 
        setVoiceStatus(''); 
      },
      () => { setVoiceStatus('...'); }
    );

    if (recognition) {
      recognitionRef.current = recognition;
      startVoiceRecording(recognition);
    } else {
      setIsListening(false); setActiveField(null); setVoiceStatus('');
    }
  };

  const handleGetStarted = async (finalPhone?: string) => {
    setError('');
    const currentName = nameRef.current;
    const currentPhone = finalPhone || phoneRef.current;
    
    if (!currentName.trim()) { 
      setError(t.enterName); 
      return; 
    }
    if (!currentPhone.trim()) { 
      setError(t.enterPhone); 
      return; 
    }

    setLoading(true);
    try {
      // Use phone number based identifier since email is removed
      const normalizedEmail = `${currentPhone.trim().replace(/\D/g, '')}@vaani.ai`;
      localStorage.setItem(`profile_name_${normalizedEmail}`, currentName);
      localStorage.setItem(`profile_phone_${normalizedEmail}`, currentPhone);
      await new Promise((resolve) => setTimeout(resolve, 300));
      onAuthSuccess(normalizedEmail);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logo.jpeg" alt="Logo" className="h-24 w-24 rounded-3xl object-cover shadow-xl transition-transform hover:scale-105 border border-white/10" />
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">Vaani Ai</h1>
          <p className="text-neutral-400 font-bold uppercase tracking-[0.2em] text-[10px]">Digital India Voice Portal</p>

          {/* Selected language badge */}
          {language && (
            <div className="mt-3 inline-flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-full px-3 py-1">
              <span className="text-lg">{language.flag}</span>
              <span className="text-xs font-bold text-neutral-300">{language.nativeName}</span>
            </div>
          )}

          {/* Voice status text */}
          {voiceStatus && (
            <p className="mt-4 text-xs text-cyan-400 font-bold animate-pulse">{voiceStatus}</p>
          )}
        </div>


        <Card className="p-10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-neutral-800 rounded-[40px] bg-black">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white mb-2 text-center">{t.title}</h2>
              <p className="text-center text-sm text-neutral-400 font-medium">{t.subtitle}</p>
            </div>

            <div className="space-y-5">
              {/* Name field */}
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2 px-1">
                  <User size={12} className="text-cyan-400" />
                  {t.nameLabel}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder={t.namePlaceholder}
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    disabled={loading}
                    className={`bg-neutral-900 h-12 text-white border-2 rounded-2xl transition-all placeholder:text-neutral-500 ${activeField === 'name'
                      ? 'border-cyan-500 ring-4 ring-cyan-500/20'
                      : 'border-neutral-800 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10'
                      }`}
                  />
                </div>
              </div>


              {/* Phone field */}
              <div className="space-y-2">
                <label className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2 px-1">
                  <Phone size={12} className="text-cyan-400" />
                  {t.phoneLabel}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    placeholder={t.phonePlaceholder}
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(''); }}
                    disabled={loading}
                    className={`bg-neutral-900 h-12 text-white border-2 rounded-2xl transition-all placeholder:text-neutral-500 ${activeField === 'phone'
                      ? 'border-cyan-500 ring-4 ring-cyan-500/20'
                      : 'border-neutral-800 focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/10'
                      }`}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-800 rounded-2xl text-red-400 text-sm font-bold animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}


            <Button
              onClick={() => handleGetStarted()}
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:opacity-95 h-14 rounded-2xl text-lg font-black shadow-xl transition-all active:scale-95"
            >
              {loading ? t.sending : t.getStarted}
            </Button>
          </div>
        </Card>

        <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-widest mt-10">
          Secure & Privacy Protected | AI Powered
        </p>
      </div>
    </div>
  );
}
