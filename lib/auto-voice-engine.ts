/**
 * AutoVoiceEngine — Hybrid Google-grade accuracy voice pipeline.
 * 
 * Performance:
 * 1. Uses native Web Speech API for real-time interim feedback (low-latency).
 * 2. Uses Groq Whisper Large-v3 for final transcription (high-accuracy).
 * 3. Dynamic language detection: Can handle mixed language speech (e.g. Hindi + English).
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { speakText, stopSpeaking, transcribeWithGroqWhisper } from './voice-utils';
import { translations } from './translations';

// Keywords for confirmation
const YES_WORDS = new Set(['yes', 'yeah', 'yep', 'correct', 'right', 'ok', 'okay', 'confirm', 'sure', 'fine', 'good', 'great', 'proceed', 'next', 'continue', 'done', 'हाँ', 'हां', 'ठीक', 'सही', 'బిల్కుల్', 'ఓకే', 'అవును', 'సరి', 'సరే', 'ఓకే', 'ಹೌದು', 'ಸರಿ', 'ಓಕೆ', 'ஆம்', 'சரி', 'ஓகே', 'അതെ', 'ശരി', 'ഓകെ', 'हो', 'होय', 'बरोबर', 'ठीक आहे', 'হ্যাঁ', 'হ্যা', 'ঠিক', 'ওকে', 'હા', 'સાચું', 'ઠીક', 'ઓકે', 'ହଁ', 'ଠିକ୍', 'ଓକେ', 'ਹਾਂ', 'ਠੀਕ', 'ਓਕੇ', 'ہاں', 'جی', 'ٹھیک', 'اوکے']);
const NO_WORDS = new Set(['no', 'nope', 'wrong', 'incorrect', 'retry', 'again', 'redo', 'back', 'cancel', 'नहीं', 'नही', 'गलत', 'फिर से', 'दोबारा', 'కాదు', 'లేదు', 'తప్పు', 'మళ్ళీ', 'ಇಲ್ಲ', 'ಇಲ್ಲಾ', 'ತಪ್ಪು', 'ಮತ್ತೆ', ' இல்லை', 'தவறு', 'மீண்டும்', 'ഇല്ല', 'തെറ്റ്', 'വീണ്ടും', 'नाही', 'चुकीचे', 'पुन्हा', 'না', 'না না', 'ভুল', 'আবার', 'ના', 'ખોટું', 'ફરી', 'ନା', 'ଭୁଲ', 'ପୁନଃ', 'ਨਹੀਂ', 'ਗਲਤ', 'ਮੁੜ', 'نہیں', 'غلط', 'دوبارہ']);

// Per-language confirmation prompts — avoids reading English "Is that correct?" in wrong language
const CONFIRM_PROMPTS: Record<string, string> = {
  en: 'Is that correct?',
  hi: 'क्या यह सही है?',
  te: 'ఇది సరైనదా?',
  kn: 'ಇದು ಸರಿಯಾಗಿದೆಯೇ?',
  ta: 'இது சரியா?',
  ml: 'ഇത് ശരിയാണോ?',
  mr: 'हे बरोबर आहे का?',
  bn: 'এটা কি ঠিক আছে?',
  gu: 'શું આ સાચું છે?',
  or: 'ଏହା ଠିକ୍ ଅଛି କି?',
  pa: 'ਕੀ ਇਹ ਸਹੀ ਹੈ?',
  ur: 'کیا یہ درست ہے؟',
};

export const LISTENING_LABELS: Record<string, string> = {
  en: '🎤 Listening…', hi: '🎤 सुन रहा हूँ…', te: '🎤 వింటున్నాను…', kn: '🎤 ಕೇಳುತ್ತಿದ್ದೇನೆ…', ta: '🎤 கேட்கிறேன்…', ml: '🎤 കേൾക്കുന്നു…', mr: '🎤 ऐकत आहे…', bn: '🎤 শুনছি…', gu: '🎤 સાંભળી રહ્યો છું…', or: '🎤 Listening…', pa: '🎤 ਸੁਣ ਰਿਹਾ ਹਾਂ…', ur: '🎤 سن رہا ہوں…',
};

export type AutoVoicePhase = 'idle' | 'speaking' | 'listening' | 'confirming' | 'confirm_listen' | 'processing';

export interface AutoVoiceState {
  phase: AutoVoicePhase;
  transcript: string;
  interim: string;
  pendingValue: string;
}

export interface UseAutoVoiceOptions {
  language: string;
  onConfirmed: (value: string) => void;
  onRetry?: () => void;
  onError?: (err: string) => void;
  micDelay?: number;
  skipConfirm?: boolean;
  fieldName?: string; 
}

export function useAutoVoice({
  language,
  onConfirmed,
  onRetry,
  onError,
  micDelay = 1000,
  skipConfirm = true,
  fieldName = "",
}: UseAutoVoiceOptions) {
  const [state, setState] = useState<AutoVoiceState>({
    phase: 'idle', transcript: '', interim: '', pendingValue: ''
  });

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Session ID — incremented each time we start a new mic session.
  // Lets onstop handlers detect if they belong to a stale (superseded) session.
  const sessionIdRef = useRef(0);

  const langCode = (language || 'en').split('-')[0];
  const t = translations[langCode] || translations['en'];

  const setPhase = useCallback((phase: AutoVoicePhase) =>
    setState(s => ({ ...s, phase })), []);

  const stopMic = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }
  }, []);

  const stopAll = useCallback(() => {
    cancelledRef.current = true;
    sessionIdRef.current++; // invalidate any in-flight onstop handlers
    stopSpeaking();
    stopMic();
    setState({ phase: 'idle', transcript: '', interim: '', pendingValue: '' });
  }, [stopMic]);

  useEffect(() => () => { stopAll(); }, [stopAll]);

  const openMic = useCallback((onResult: (text: string) => void) => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      if (onError) onError('not-supported');
      return;
    }

    // Capture the session ID for this mic open — used to detect stale onstop callbacks
    const mySession = ++sessionIdRef.current;
    stopMic();
    audioChunksRef.current = [];

    // Track Web Speech API final result — used as primary transcript
    let webSpeechFinalText = '';

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      // If another session started while we were waiting for mic permission, bail out
      if (sessionIdRef.current !== mySession) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
      const supportedMime = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        // Ignore this callback if we've been cancelled OR if a newer session has started
        if (cancelledRef.current) return;
        if (sessionIdRef.current !== mySession) return;

        setPhase('processing');

        // PRIMARY: Use Web Speech API final result (already in the user's language, no hallucination)
        if (webSpeechFinalText.trim()) {
          if (cancelledRef.current) return;
          if (sessionIdRef.current !== mySession) return;
          setState(s => ({ ...s, transcript: webSpeechFinalText, interim: '' }));
          onResult(webSpeechFinalText);
          return;
        }

        // FALLBACK: If Web Speech gave nothing, try Groq Whisper (e.g. browser doesn't support final results)
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const transcription = await transcribeWithGroqWhisper(blob, langCode, fieldName);
        
        // Re-check after async Groq call — another session may have started
        if (cancelledRef.current) return;
        if (sessionIdRef.current !== mySession) return;

        if (transcription.success && transcription.text.trim()) {
          setState(s => ({ ...s, transcript: transcription.text, interim: '' }));
          onResult(transcription.text);
        } else {
          if (onRetry) onRetry();
        }
      };

      recorder.start();

      const rec: any = new SpeechRec();
      rec.lang = language.includes('-') ? language : `${language}-IN`;
      rec.continuous = true;
      rec.interimResults = true;
      recognitionRef.current = rec;

      const resetSilenceTimer = () => {
         if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
         silenceTimeoutRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
               mediaRecorderRef.current.stop();
            }
            try { rec.stop(); } catch {}
         }, 2500);
      };

      rec.onresult = (ev: any) => {
        let interimText = '';
        let finalText = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const result = ev.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }
        // Accumulate final results from Web Speech API
        if (finalText) {
          webSpeechFinalText += finalText;
        }
        // Show interim + any accumulated finals as live feedback
        setState(s => ({ ...s, interim: webSpeechFinalText + interimText }));
        resetSilenceTimer();
      };

      rec.onerror = (ev: any) => {
        if (ev.error === 'no-speech') {
            if (mediaRecorderRef.current?.state === 'recording') recorder.stop();
        }
      };

      rec.onstart = () => resetSilenceTimer();

      try { rec.start(); } catch { /* ignore */ }

    }).catch(() => {
      if (onError) onError('mic-access');
    });

  }, [language, stopMic, setPhase, onError, fieldName, onRetry]);

  const askQuestion = useCallback(async (prompt: string) => {
    cancelledRef.current = false;
    sessionIdRef.current++; // invalidate any in-flight onstop from the previous question
    stopMic();
    stopSpeaking();

    setState(s => ({ ...s, phase: 'speaking', transcript: '', interim: '', pendingValue: '' }));
    await speakText(prompt, language);

    if (cancelledRef.current) return;
    await new Promise(r => setTimeout(r, micDelay));
    if (cancelledRef.current) return;

    setPhase('listening');
    openMic(skipConfirm ? onConfirmed : handleConfirmation);
  }, [language, micDelay, openMic, stopMic, onConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const announce = useCallback(async (text: string) => {
    cancelledRef.current = false;
    stopMic();
    setState(s => ({ ...s, phase: 'speaking' }));
    await speakText(text, language);
    if (!cancelledRef.current) setPhase('idle');
  }, [language, stopMic, setPhase]);

  const handleConfirmation = useCallback((text: string) => {
    const confirmPhrase = CONFIRM_PROMPTS[langCode] || CONFIRM_PROMPTS['en'];
    setState(s => ({ ...s, phase: 'confirming', pendingValue: text }));

    speakText(confirmPhrase, language).then(() => {
      if (cancelledRef.current) return;
      setState(s => ({ ...s, phase: 'confirm_listen' }));
      openMic((confirmation) => {
        const confirmationText = confirmation.toLowerCase().trim();
        const cleanConfirmation = confirmationText.replace(/[.,!?।]/g, '').trim();
        
        const yesList = [...Array.from(YES_WORDS), 'यस', 'येस', 'యెస్', 'ಯೆಸ್', 'யெஸ்', 'യെസ്', 'ಎಸ್', 'यस', 'ইয়েস', 'યેસ', 'ୟେସ୍', 'ਯੈਸ', 'یس', 'ya'];
        const noList = [...Array.from(NO_WORDS), 'नो', 'నో', 'ನೋ', 'நோ', 'നോ', 'नो', 'নো', 'નો', 'ନୋ', 'ਨੋ', 'نو', 'nah', 'not'];
        
        let isYes = false;
        let isNo = false;

        // Exact match
        if (yesList.includes(cleanConfirmation)) isYes = true;
        if (noList.includes(cleanConfirmation)) isNo = true;

        // Token match
        const tokens = cleanConfirmation.split(/\s+/);
        for (const token of tokens) {
          if (yesList.includes(token)) isYes = true;
          if (noList.includes(token)) isNo = true;
        }

        // Substring fallback
        if (!isYes && !isNo) {
          if (cleanConfirmation.includes('yes') || cleanConfirmation.includes('ok') || cleanConfirmation.includes('हाँ') || cleanConfirmation.includes('అవును')) {
             isYes = true;
          }
          if (cleanConfirmation.includes('no') || cleanConfirmation.includes('not') || cleanConfirmation.includes('नहीं') || cleanConfirmation.includes('కాదు') || cleanConfirmation.includes('లేదు')) {
             isNo = true;
          }
        }

        if (isYes && !isNo) {
          onConfirmed(text);
        } else if (isNo) {
          if (onRetry) onRetry();
        } else {
          // Ambiguous — retry confirmation
          if (onRetry) onRetry();
        }
      });
    });
  }, [language, langCode, openMic, onConfirmed, onRetry]);

  return { state, askQuestion, announce, stopAll, langCode };
}
