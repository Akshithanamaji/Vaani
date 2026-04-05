/**
 * AutoVoiceEngine  — simple, reliable voice pipeline.
 *
 * Default flow (skipConfirm = true, used in forms):
 *   1. speak(prompt)       → TTS asks the question
 *   2. startListening()    → mic opens after TTS ends (1000ms gap)
 *   3. interim updates     → live text shown in field as user speaks
 *   4. onConfirmed(value)  → fires immediately on final speech result
 *
 * Legacy flow (skipConfirm = false):
 *   Same as above but adds: TTS "I heard X?" → user says YES/NO
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { speakText, stopSpeaking } from './voice-utils';

// ── YES / NO keyword sets ─────────────────────────────────────────────────────
const YES_WORDS = new Set([
  'yes', 'yeah', 'yep', 'correct', 'right', 'ok', 'okay', 'confirm', 'sure',
  'fine', 'good', 'great', 'proceed', 'next', 'continue', 'done',
  'हाँ', 'हां', 'ठीक', 'सही', 'बिल्कुल', 'ओके', 'आगे',
  'అవును', 'సరి', 'సరే', 'ఓకే',
  'ಹೌದು', 'ಸರಿ', 'ಓಕೆ',
  'ஆம்', 'சரி', 'ஓகே',
  'അതെ', 'ശരി', 'ഓകെ',
  'हो', 'होय', 'बरोबर', 'ठीक आहे',
  'হ্যাঁ', 'হ্যা', 'ঠিক', 'ওকে',
  'હા', 'સાચું', 'ઠীक', 'ઓકে',
  'ହଁ', 'ଠिक', 'ଓକେ',
  'ਹਾਂ', 'ਠੀਕ', 'ਓਕੇ',
  'ہاں', 'جی', 'ٹھیک', 'اوکے',
]);

const NO_WORDS = new Set([
  'no', 'nope', 'wrong', 'incorrect', 'retry', 'again', 'redo', 'back', 'cancel',
  'नहीं', 'नही', 'गलत', 'फिर से', 'दोबारा',
  'కాదు', 'లేదు', 'తప్పు', 'మళ్ళీ',
  'ಇಲ್ಲ', 'ಇಲ್ಲಾ', 'ತಪ್ಪು', 'ಮತ್ತೆ',
  'இல்லை', 'தவறு', 'மீண்டும்',
  'ഇല്ല', 'തെറ്റ്', 'വீണ്ടും',
  'नाही', 'चुकीचे', 'पुन्हा',
  'না', 'না না', 'ভুল', 'আবার',
  'ના', 'ખोटું', 'ફрी',
  'ନା', 'ଭୁଲ', 'ପুনঃ',
  'ਨਹੀਂ', 'ਗਲਤ', 'ਮੁੜ',
  'نہیں', 'غلط', 'دوبارہ',
]);

/** Confirmation prompts in all 12 languages */
export const CONFIRM_PROMPTS: Record<string, string> = {
  en: 'I heard "{VALUE}". Is that correct? Say Yes or No.',
  hi: 'मैंने "{VALUE}" सुना। क्या यह सही है? हाँ या नहीं बोलें।',
  te: 'నేను "{VALUE}" విన్నాను. అది సరైనదా? అవును లేదా కాదు అని చెప్పండి.',
  kn: 'ನಾನು "{VALUE}" ಕೇಳಿದೆ. ಅದು ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಇಲ್ಲ ಎಂದು ಹೇಳಿ.',
  ta: 'நான் "{VALUE}" கேட்டேன். அது சரியா? ஆம் அல்லது இல்லை என்று சொல்லுங்கள்.',
  ml: 'ഞാൻ "{VALUE}" കേട്ടു. അത് ശരിയാണോ? അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് മറുപടി പറയൂ.',
  mr: 'मी "{VALUE}" ऐकले. ते बरोबर आहे का? हो किंवा नाही सांगा.',
  bn: 'আমি "{VALUE}" শুনলাম। এটা কি ঠিক? হ্যাঁ বা না বলুন।',
  gu: 'મE "{VALUE}" સાांभળ्युं. ते सही है? हा या ना कहो.',
  or: 'I heard "{VALUE}". Is that correct? Say Yes or No.',
  pa: 'ਮੈਂ "{VALUE}" ਸੁਣਿਆ। ਕੀ ਇਹ ਸਹੀ ਹੈ? ਹਾਂ ਜਾਂ ਨਹੀਂ ਕਹੋ।',
  ur: 'میں نے "{VALUE}" سنا۔ کیا یہ درست ہے؟ ہاں یا نہیں کہیں۔',
};

/** Generic "please say again" retry prompts */
export const RETRY_PROMPTS: Record<string, string> = {
  en: 'Sorry, please say that again.',
  hi: 'माफ़ करें, फिर से बोलें।',
  te: 'క్షమించండి, దయచేసి మళ్ళీ చెప్పండి.',
  kn: 'ಕ್ಷಮಿಸಿ, ದಯಾಮಾಡಿ ಮತ್ತೆ ಹೇಳಿ.',
  ta: 'மன்னிக்கவும், மீண்டும் சொல்லுங்கள்.',
  ml: 'ക്ഷമിക്കണം, ദയവായി വീണ്ടും പറयൂ.',
  mr: 'माफ करा, कृपया पुन्हा सांगा.',
  bn: 'দুঃখিত, আবার বলুন।',
  gu: 'माफ करो, फिर कहो.',
  or: 'Sorry, please say that again.',
  pa: 'ਮਾਫ਼ ਕਰਨਾ, ਦੁਬਾਰਾ ਕਹੋ।',
  ur: 'معاف کریں، دوبارہ کہیں۔',
};

/** "Listening…" indicator labels in 12 languages */
export const LISTENING_LABELS: Record<string, string> = {
  en: '🎤 Listening…',
  hi: '🎤 सुन रहा हूँ…',
  te: '🎤 వింటున్నాను…',
  kn: '🎤 ಕೇಳುತ್ತಿದ್ದೇನೆ…',
  ta: '🎤 கேட்கிறேன்…',
  ml: '🎤 കേൾക്കുന്നു…',
  mr: '🎤 ऐकत आहे…',
  bn: '🎤 শুনছি…',
  gu: '🎤 સাংભળু छु…',
  or: '🎤 Listening…',
  pa: '🎤 ਸੁਣ ਰਿਹਾ ਹਾਂ…',
  ur: '🎤 سن رہا ہوں…',
};

export type AutoVoicePhase =
  | 'idle'
  | 'speaking'
  | 'listening'
  | 'confirming'
  | 'confirm_listen'
  | 'processing';

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
  /** ms gap after TTS ends before mic opens (default 1000) */
  micDelay?: number;
  /**
   * true (default) = skip YES/NO confirmation, save immediately.
   * false = legacy speak→confirm→yes/no cycle.
   */
  skipConfirm?: boolean;
}

export function useAutoVoice({
  language,
  onConfirmed,
  onRetry,
  onError,
  micDelay = 1000,
  skipConfirm = true,
}: UseAutoVoiceOptions) {
  const [state, setState] = useState<AutoVoiceState>({
    phase: 'idle',
    transcript: '',
    interim: '',
    pendingValue: '',
  });

  const recognitionRef = useRef<any>(null);
  const cancelledRef   = useRef(false);
  const langCode = (language || 'en').split('-')[0];

  const setPhase = useCallback((phase: AutoVoicePhase) =>
    setState(s => ({ ...s, phase })), []);

  const stopMic = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    cancelledRef.current = true;
    stopSpeaking();
    stopMic();
    setState({ phase: 'idle', transcript: '', interim: '', pendingValue: '' });
  }, [stopMic]);

  useEffect(() => () => { stopAll(); }, [stopAll]);

  /* ── open mic and collect one utterance ───────────────────────── */
  const openMic = useCallback((onResult: (text: string) => void) => {
    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('[AutoVoice] SpeechRecognition not supported in this browser');
      if (onError) onError('not-supported');
      return;
    }

    stopMic();

    const rec: any = new SpeechRec();
    rec.lang            = language.includes('-') ? language : `${language}-IN`;
    // Setting continuous to false allows the browser's built-in utterance detection to stop and finalize faster
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 3;         // consider more alternatives for better accuracy
    recognitionRef.current = rec;

    let finalReceived = false;
    let silenceTimer: NodeJS.Timeout | null = null;
    
    // Helper to commit the result
    const commitResult = (text: string) => {
      if (!text.trim() || finalReceived) return;
      finalReceived = true;
      if (silenceTimer) clearTimeout(silenceTimer);
      try { rec.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
      const cleaned = text.trim();
      setState(s => ({ ...s, interim: '', transcript: cleaned }));
      onResult(cleaned);
    };

    rec.onresult = (ev: any) => {
      let interimText = '';
      let finalText   = '';

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];

        // Pick highest-confidence alternative
        let bestText = result[0].transcript;
        let bestConf = result[0].confidence || 0;
        for (let j = 1; j < result.length; j++) {
          if ((result[j].confidence || 0) > bestConf) {
            bestConf = result[j].confidence || 0;
            bestText = result[j].transcript;
          }
        }

        if (result.isFinal) {
          finalText += bestText;
        } else {
          interimText += bestText;
        }
      }

      // Show live interim text in UI immediately
      const currentText = finalText || interimText;
      setState(s => ({ ...s, interim: currentText }));

      if (silenceTimer) clearTimeout(silenceTimer);

      if (finalText.trim() && !finalReceived) {
        commitResult(finalText);
      } else if (interimText.trim() && !finalReceived) {
        // Auto-commit interim after 2 seconds of silence
        silenceTimer = setTimeout(() => {
          commitResult(interimText);
        }, 2000);
      }
    };

    rec.onerror = (ev: any) => {
      const err = ev?.error || '';
      console.warn('[AutoVoice] SpeechRecognition error:', err);
      
      if (err === 'not-allowed' || err === 'audio-capture') {
        // Fatal error, microphone blocked or missing
        try { rec.stop(); } catch {}
        cancelledRef.current = true;
        setPhase('idle');
        if (onError) onError(err);
        return;
      }
      
      if (!cancelledRef.current && err !== 'aborted') {
        // On no-speech or network error, let onend handle the restart to avoid InvalidStateError
        try { rec.stop(); } catch {}
      }
    };

    rec.onend = () => {
      if (!finalReceived && recognitionRef.current === rec && !cancelledRef.current) {
        // Small delay to allow browser audio pipeline to reset
        setTimeout(() => {
           if (!finalReceived && recognitionRef.current === rec && !cancelledRef.current) {
             try { rec.start(); } catch { /* give up */ }
           }
        }, 200);
      }
    };

    try { rec.start(); } catch { /* ignore InvalidStateError */ }
  }, [language, stopMic, setPhase, onError]);

  /* ── legacy: listen for YES/NO confirmation ───────────────────── */
  const listenForConfirmation = useCallback((pendingValue: string) => {
    if (cancelledRef.current) return;
    setPhase('confirm_listen');
    openMic((answer) => {
      const lower = answer.toLowerCase().trim();
      const isYes = [...YES_WORDS].some(w => lower.includes(w));
      const isNo  = [...NO_WORDS].some(w  => lower.includes(w));
      if (isYes) {
        setPhase('processing');
        onConfirmed(pendingValue);
      } else if (isNo) {
        setPhase('idle');
        onRetry?.();
      } else {
        listenForConfirmation(pendingValue);
      }
    });
  }, [openMic, onConfirmed, onRetry, setPhase]);

  /* ── legacy: speak confirm prompt ────────────────────────────── */
  const speakAndConfirm = useCallback(async (value: string) => {
    if (cancelledRef.current) return;
    const prompt = (CONFIRM_PROMPTS[langCode] || CONFIRM_PROMPTS['en']).replace('{VALUE}', value);
    setState(s => ({ ...s, phase: 'confirming', pendingValue: value }));
    await speakText(prompt, language);
    if (cancelledRef.current) return;
    await new Promise(r => setTimeout(r, micDelay));
    listenForConfirmation(value);
  }, [langCode, language, micDelay, listenForConfirmation]);

  /* ── main: speak question then listen for answer ─────────────── */
  const askQuestion = useCallback(async (prompt: string) => {
    cancelledRef.current = false;
    stopMic();
    stopSpeaking();

    setState(s => ({ ...s, phase: 'speaking', transcript: '', interim: '', pendingValue: '' }));
    await speakText(prompt, language);

    if (cancelledRef.current) return;

    // Wait for audio to fully clear before opening mic (avoids TTS bleed-in)
    await new Promise(r => setTimeout(r, micDelay));
    if (cancelledRef.current) return;

    setPhase('listening');

    openMic(async (answer) => {
      if (cancelledRef.current) return;
      setState(s => ({ ...s, transcript: answer }));

      if (skipConfirm) {
        // Direct: save immediately, no confirmation round-trip
        setPhase('processing');
        onConfirmed(answer);
      } else {
        // Legacy: ask "is that correct?"
        await speakAndConfirm(answer);
      }
    });
  }, [language, micDelay, openMic, speakAndConfirm, stopMic, setPhase, skipConfirm, onConfirmed]);

  /* ── speak only, no listening ────────────────────────────────── */
  const announce = useCallback(async (text: string) => {
    cancelledRef.current = false;
    stopMic();
    setState(s => ({ ...s, phase: 'speaking' }));
    await speakText(text, language);
    if (!cancelledRef.current) setPhase('idle');
  }, [language, stopMic, setPhase]);

  return { state, askQuestion, announce, stopAll, langCode };
}
