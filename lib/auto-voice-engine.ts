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

// Keywords for confirmation
const YES_WORDS = new Set(['yes', 'yeah', 'yep', 'correct', 'right', 'ok', 'okay', 'confirm', 'sure', 'fine', 'good', 'great', 'proceed', 'next', 'continue', 'done', 'हाँ', 'हां', 'ठीक', 'सही', 'బిల్కుల్', 'ఓకే', 'అవును', 'సరి', 'సరే', 'ఓకే', 'ಹೌದು', 'ಸರಿ', 'ಓಕೆ', 'ஆம்', 'சரி', 'ஓகே', 'അതെ', 'ശരി', 'ഓകെ', 'हो', 'होय', 'बरोबर', 'ठीक आहे', 'হ্যাঁ', 'হ্যা', 'ঠিক', 'ওকে', 'હા', 'સાચું', 'ઠીક', 'ઓકે', 'ହଁ', 'ଠିକ୍', 'ଓକେ', 'ਹਾਂ', 'ਠੀਕ', 'ਓਕੇ', 'ہاں', 'جی', 'ٹھیک', 'اوکے']);
const NO_WORDS = new Set(['no', 'nope', 'wrong', 'incorrect', 'retry', 'again', 'redo', 'back', 'cancel', 'नहीं', 'नही', 'गलत', 'फिर से', 'दोबारा', 'కాదు', 'లేదు', 'తప్పు', 'మళ్ళీ', 'ಇಲ್ಲ', 'ಇಲ್ಲಾ', 'ತಪ್ಪು', 'ಮತ್ತೆ', 'ಇல்லை', 'தவறு', 'மீண்டும்', 'ഇല്ല', 'തെറ്റ്', 'വീണ്ടും', 'नाही', 'चुकीचे', 'पुन्हा', 'না', 'না না', 'ভুল', 'আবার', 'ના', 'ખોટું', 'ફરી', 'ନା', 'ଭୁଲ', 'ପୁନଃ', 'ਨਹੀਂ', 'ਗਲਤ', 'ਮੁੜ', 'نہیں', 'غلط', 'دوبارہ']);

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
  const langCode = (language || 'en').split('-')[0];

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

    stopMic();
    audioChunksRef.current = [];

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
      const supportedMime = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
      const recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (cancelledRef.current) return;

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        
        setPhase('processing');
        
        // Pass 'auto' for language if the user wants "any language" detection (Google-style)
        // Or pass current langCode as a hint. We'll use 'auto' for best multi-lingual results.
        const transcription = await transcribeWithGroqWhisper(blob, 'auto', fieldName);
        
        if (!cancelledRef.current) {
          if (transcription.success && transcription.text.trim()) {
            setState(s => ({ ...s, transcript: transcription.text, interim: '' }));
            onResult(transcription.text);
          } else {
            if (onRetry) onRetry();
          }
        }
      };

      recorder.start();

      const rec: any = new SpeechRec();
      rec.lang = language.includes('-') ? language : `${language}-IN`;
      rec.continuous = true; // Stay open until we manually stop it
      rec.interimResults = true;
      recognitionRef.current = rec;

      const resetSilenceTimer = () => {
         if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
         // Increased silence window to 2.5 seconds to prevent cutting off names/long inputs
         silenceTimeoutRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
               mediaRecorderRef.current.stop();
            }
            try { rec.stop(); } catch {}
         }, 2500);
      };

      rec.onresult = (ev: any) => {
        let interimText = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          interimText += ev.results[i][0].transcript;
        }
        setState(s => ({ ...s, interim: interimText }));
        resetSilenceTimer();
      };

      rec.onerror = (ev: any) => {
        if (ev.error === 'no-speech') {
            if (mediaRecorderRef.current?.state === 'recording') recorder.stop();
        }
      };

      rec.onstart = () => resetSilenceTimer();

      try { rec.start(); } catch { /* ignore */ }

    }).catch(err => {
      if (onError) onError('mic-access');
    });

  }, [language, stopMic, setPhase, onError, fieldName, onRetry]);

  const askQuestion = useCallback(async (prompt: string) => {
    cancelledRef.current = false;
    stopMic();
    stopSpeaking();

    setState(s => ({ ...s, phase: 'speaking', transcript: '', interim: '', pendingValue: '' }));
    await speakText(prompt, language);

    if (cancelledRef.current) return;
    await new Promise(r => setTimeout(r, micDelay));
    if (cancelledRef.current) return;

    setPhase('listening');
    openMic(onConfirmed);
  }, [language, micDelay, openMic, stopMic, onConfirmed]);

  const announce = useCallback(async (text: string) => {
    cancelledRef.current = false;
    stopMic();
    setState(s => ({ ...s, phase: 'speaking' }));
    await speakText(text, language);
    if (!cancelledRef.current) setPhase('idle');
  }, [language, stopMic, setPhase]);

  return { state, askQuestion, announce, stopAll, langCode };
}
