'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/file-upload';
import {
  speakText,
  stopSpeaking,
  getFieldDescription,
} from '@/lib/voice-utils';
import { GOVERNMENT_SERVICES, getTranslatedService } from '@/lib/government-services';
import { translations } from '@/lib/translations';
import { FIELD_TRANSLATIONS } from '@/lib/field-translations';
import { runSmartValidation, type ValidationIssue } from '@/lib/smart-validation';
import { useAutoVoice, LISTENING_LABELS } from '@/lib/auto-voice-engine';
import QRDisplay from './qr-display';

interface VoiceFormProps {
  serviceName?: string;
  service?: any;
  userEmail?: string;
  language?: string;
  selectedLocation?: { state: string; district: string };
  onSubmitSuccess?: () => void;
  onSubmit?: (data: any) => void;
  onBack?: () => void;
}

interface BackendResponse {
  success: boolean;
  response: string;
  isConfirmed: boolean;
  action?: 'confirm' | 'retry' | 'proceed';
  nextField?: string;
  error?: string;
}

const VoiceFormComponent = ({ service, userEmail, language = 'en-IN', selectedLocation, onSubmitSuccess, onSubmit, onBack }: VoiceFormProps) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const [submittedQR, setSubmittedQR] = useState<any>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backendResponse, setBackendResponse] = useState<string | null>(null);

  // ── Smart Validation state ────────────────────────────────────────────────
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationDone, setValidationDone] = useState(false);
  const [aiValidationDone, setAiValidationDone] = useState(false);
  const [fileValidated, setFileValidated] = useState(false);

  const fields = service?.fields || [];
  const currentField = fields[currentFieldIndex];

  // ── Refs so callbacks always see the latest values (avoids stale closures) ──
  const currentFieldIndexRef = useRef(currentFieldIndex);
  const currentFieldRef = useRef(currentField);
  useEffect(() => { currentFieldIndexRef.current = currentFieldIndex; }, [currentFieldIndex]);
  useEffect(() => { currentFieldRef.current = fields[currentFieldIndex]; }, [currentFieldIndex, fields]);

  const langCode = (typeof language === 'string' ? language.split('-')[0] : 'en');
  const t = translations[langCode] || translations['en'];
  const translatedService = service ? getTranslatedService(service, langCode) : service;

  const getFieldLabel = (fieldId: string, fallbackLabel: string) => {
    const translation = FIELD_TRANSLATIONS[fieldId]?.[langCode];
    return translation || fallbackLabel;
  };

  // ── Auto-voice engine ─────────────────────────────────────────────────────
  const autoVoice = useAutoVoice({
    language,
    skipConfirm: false,   // detect → show detected text → user confirms → next field
    onConfirmed: (value) => {
      // Use refs to avoid stale closure — always read the current field/index
      const activeField = currentFieldRef.current;
      const activeIndex = currentFieldIndexRef.current;
      const fieldId = activeField?.id;
      if (!fieldId) return;

      let processedValue = value;
      let errorMsg = null;

      // ── 1. Determine if it's a numeric field ───────────────────────────────
      const fieldNameLower = fieldId.toLowerCase();
      const isNumericField =
        fieldNameLower.includes('phone') ||
        fieldNameLower.includes('mobile') ||
        fieldNameLower.includes('aadhaar') ||
        fieldNameLower.includes('pincode') ||
        fieldNameLower.includes('pin_code') ||
        activeField.type === 'tel';

      if (isNumericField) {
        processedValue = value.replace(/\s+/g, '').replace(/[^0-9]/g, '');

        if (fieldNameLower.includes('aadhaar')) {
          if (processedValue.length > 12) errorMsg = t.tooManyDigits + " " + t.enterExactly.replace('{COUNT}', '12');
          else if (processedValue.length < 12) errorMsg = t.tooFewDigits + " " + t.enterExactly.replace('{COUNT}', '12');
        } else if (fieldNameLower.includes('phone') || fieldNameLower.includes('mobile')) {
          if (processedValue.length > 10) errorMsg = t.tooManyDigits + " " + t.enterExactly.replace('{COUNT}', '10');
          else if (processedValue.length < 10) errorMsg = t.tooFewDigits + " " + t.enterExactly.replace('{COUNT}', '10');
        } else if (fieldNameLower.includes('pincode') || fieldNameLower.includes('pin_code')) {
          if (processedValue.length > 6) errorMsg = t.tooManyDigits + " " + t.enterExactly.replace('{COUNT}', '6');
          else if (processedValue.length < 6) errorMsg = t.tooFewDigits + " " + t.enterExactly.replace('{COUNT}', '6');
        }
      }

      // ── Date Validation ────────────────────────────────────────────────────
      if (activeField.type === 'date') {
        const trimmedValue = processedValue.trim().toLowerCase();
        if (trimmedValue === 'na' || trimmedValue === 'nada' || !trimmedValue) {
          errorMsg = t.invalidInput || 'Please provide a valid date';
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(processedValue)) {
          errorMsg = t.invalidInput || 'Please provide a date in the format YYYY-MM-DD';
        } else {
          const date = new Date(processedValue);
          if (isNaN(date.getTime())) {
            errorMsg = t.invalidInput || 'Please provide a valid date';
          }
        }
      }

      // ── Email Validation ───────────────────────────────────────────────────
      if (activeField.type === 'email' && processedValue.trim().toLowerCase() !== 'skip') {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(processedValue.trim())) {
          errorMsg = t.invalidEmailFormat;
        }
      }

      // ── General Regex Validation ───────────────────────────────────────────
      if (!errorMsg && activeField.validation?.pattern) {
        const regex = new RegExp(activeField.validation.pattern);
        if (!regex.test(processedValue)) {
          const lang = (language || 'en-IN').split('-')[0];
          errorMsg = activeField.validation.message?.[lang] || activeField.validation.message?.['en'] || t.invalidInput;
        }
      }

      // ── Handle Error ──────────────────────────────────────────────────────
      if (errorMsg) {
        setVoiceError(errorMsg);
        setTimeout(async () => {
          await speakText(errorMsg, language);
          setTimeout(() => triggerFieldPrompt(activeIndex), 1200);
        }, 300);
        return;
      }

      // ── Success: Save and Advance ─────────────────────────────────────────
      setFormData(prev => ({ ...prev, [fieldId]: processedValue }));
      setVoiceError(null);

      // Stop any ongoing speech to avoid replaying previous prompts
      stopSpeaking();

      const nextIndex = activeIndex + 1;
      setTimeout(() => {
        if (nextIndex < fields.length) {
          setCurrentFieldIndex(nextIndex);
        } else {
          setIsReviewing(true);
        }
      }, 800);
    },
    onRetry: () => {
      triggerFieldPrompt(currentFieldIndexRef.current);
    },
    onError: (err: string) => {
      setVoiceError((t as any).micError || "Microphone access denied. Please check site permissions.");
    }
  });

  // ── Show interim speech result live in the current field ──────────────────
  useEffect(() => {
    if (autoVoice.state.interim && currentField?.id &&
      currentField.type !== 'file' && !currentField.requiresFile) {
      setFormData(prev => ({ ...prev, [currentField.id]: autoVoice.state.interim }));
    }
  }, [autoVoice.state.interim]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trigger voice prompt for a field ──────────────────────────────────────
  const triggerFieldPrompt = useCallback(async (idx: number) => {
    const field = fields[idx];
    if (!field || field.type === 'file' || field.requiresFile) return;

    try {
      const res = await fetch(
        `/api/voice-process?fieldName=${encodeURIComponent(field.id)}&language=${encodeURIComponent(language)}`
      );
      const result = await res.json();
      const prompt = result.voicePrompt ||
        field.voiceLabel?.[langCode] ||
        field.voiceLabel?.['en'] ||
        `${t.pleaseEnterYour} ${field.label}`;
      autoVoice.askQuestion(prompt);
    } catch {
      const prompt =
        field.voiceLabel?.[langCode] ||
        field.voiceLabel?.['en'] ||
        `${t.pleaseEnterYour} ${field.label}`;
      autoVoice.askQuestion(prompt);
    }
  }, [fields, language, langCode, t, autoVoice]);

  useEffect(() => {
    const initialData: Record<string, string> = {};
    fields.forEach((f: any) => (initialData[f.id] = ''));
    setFormData(initialData);
  }, [service]);

  useEffect(() => () => { stopSpeaking(); }, []);

  // ── Auto-trigger prompt when field changes ───────────────────────────────
  useEffect(() => {
    if (!isReviewing && !submittedQR && currentField) {
      const timer = setTimeout(() => triggerFieldPrompt(currentFieldIndex), 500);
      return () => clearTimeout(timer);
    }
  }, [currentFieldIndex, language, isReviewing, submittedQR]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send transcription to backend for processing (kept for file-field or manual override)
  const sendToBackend = async (transcript: string, fieldId: string) => {
    // fieldId is always the one captured at record-start — do NOT re-read currentField here
    console.log('[VoiceForm] sendToBackend called with transcript:', transcript, 'fieldId:', fieldId);
    try {
      setIsProcessing(true);

      const payload = {
        transcript,
        language,
        fieldName: fieldId,   // use the captured fieldId, not currentField
        context: formData,
      };

      console.log('[VoiceForm] Sending to backend:', JSON.stringify(payload, null, 2));

      const response = await fetch('/api/voice-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[VoiceForm] Backend response status:', response.status);

      const result: BackendResponse = await response.json();

      console.log('[VoiceForm] Backend response received:', JSON.stringify(result, null, 2));

      if (result.success) {
        // Use the Gemini-formatted transcription from the backend if available
        let transcriptToSave = (result as any).transcript || transcript;

        // CLIENT SIDE VALIDATION OVERRIDE
        if (currentField?.validation) {
          const { pattern, message } = currentField.validation;
          const lang = (language || 'en-IN').split('-')[0];

          // Clean transcript (remove spaces if it should be numeric)
          if (pattern && pattern.includes('0-9')) {
            transcriptToSave = transcriptToSave.replace(/\s+/g, '');
          }

          if (pattern && !new RegExp(pattern).test(transcriptToSave)) {
            const errorMsg = message?.[lang] || message?.['en'] || t.invalidInput;
            setVoiceError(errorMsg);
            speakText(errorMsg, language);
            setIsProcessing(false);
            return;
          }
        }

        // Save the data to form
        setFormData((prev) => ({
          ...prev,
          [fieldId]: transcriptToSave,
        }));

        // Store backend response for display
        setBackendResponse(result.response);
        console.log('[VoiceForm] Backend response stored:', result.response);

        // Speak the backend response in the user's selected language
        await speakText(result.response, language);

        // Determine next action based on backend response
        if (result.action === 'proceed' || result.isConfirmed) {
          // Field is valid - move to next field
          console.log('[VoiceForm] Valid input - moving to next field');
          setTimeout(() => {
            if (currentFieldIndex < fields.length - 1) {
              setCurrentFieldIndex(currentFieldIndex + 1);
              setBackendResponse(null);
              setIsProcessing(false);
            } else {
              setIsReviewing(true);
              setIsProcessing(false);
            }
          }, 2000);
        } else if (result.action === 'retry') {
          // Field is invalid or empty - ask user to try again
          console.log('[VoiceForm] Invalid input - user needs to retry');
          setVoiceError(result.response || t.pleaseTryAgain);
          setTimeout(() => {
            setIsProcessing(false);
          }, 2000);
        } else {
          // Default: confirm action
          setTimeout(() => {
            setIsProcessing(false);
          }, 2000);
        }
      } else {
        console.error('[VoiceForm] Backend returned error:', result.error);
        setVoiceError(result.error || t.failedToProcess);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('[Voice Form] Backend error:', error);
      setVoiceError(t.networkError);
      setIsProcessing(false);
    }
  };


  const handleNext = () => {
    // Check if current field is filled
    const currentFieldValue = formData[currentField?.id] || '';
    const trimmedValue = currentFieldValue.trim();

    // For file fields, check if any file is selected AND AI-validated
    if (currentField?.type === 'file' || currentField?.requiresFile) {
      if (!trimmedValue || trimmedValue.length === 0) {
        setVoiceError(t.pleaseUploadFile);
        speakText(t.pleaseUploadFile, language);
        return;
      }
      if (!fileValidated) {
        setVoiceError('Please upload the correct document before continuing.');
        return;
      }
    } else {
      // For text fields, check if text is filled
      if (!trimmedValue || trimmedValue.length === 0) {
        console.log('[VoiceForm] Cannot proceed - current field is empty:', currentField?.id);
        setVoiceError(t.pleaseFillField);
        return;
      }

      // Check validation pattern if it exists
      if (currentField?.validation) {
        const { pattern, message } = currentField.validation;
        const langCode = (language || 'en-IN').split('-')[0];

        if (pattern && !new RegExp(pattern).test(trimmedValue)) {
          const errorMsg = message?.[langCode] || message?.['en'] || t.invalidInput;
          console.log('[VoiceForm] Validation failed for field:', currentField.id, errorMsg);
          setVoiceError(errorMsg);
          speakText(errorMsg, language);
          return;
        }
      }
    }

    // Clear any error messages
    setVoiceError(null);

    // Move to next field or review
    if (currentFieldIndex < fields.length - 1) {
      setCurrentFieldIndex(currentFieldIndex + 1);
    } else {
      setIsReviewing(true);
    }
  };

  const handlePrevious = () => {
    setVoiceError(null);
    setFileValidated(false); // reset file validation when navigating back
    if (currentFieldIndex > 0) {
      setCurrentFieldIndex(currentFieldIndex - 1);
    }
  };

  const handleEditField = (index: number) => {
    setCurrentFieldIndex(index);
    setIsReviewing(false);
  };

  // ── Smart Validation logic ────────────────────────────────────────────────
  const runValidation = useCallback(async (currentData: Record<string, string>) => {
    const langCode = (language || 'en-IN').split('-')[0];

    // Step 1: instant rule-based check
    setIsValidating(true);
    setValidationDone(false);
    setAiValidationDone(false);
    const ruleResult = runSmartValidation(fields, currentData, langCode, service?.id);
    setValidationIssues(ruleResult.issues);
    setValidationDone(true);
    setIsValidating(false);

    // Step 2: AI deep validation (async, non-blocking)
    try {
      const res = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields,
          formData: currentData,
          language,
          serviceId: service?.id,
          serviceName: service?.name,
          useAI: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.issues?.length) {
          setValidationIssues(prev => {
            const existingCodes = new Set(prev.map((i: ValidationIssue) => `${i.fieldId}:${i.code}`));
            const newOnes = data.issues.filter((i: ValidationIssue) => !existingCodes.has(`${i.fieldId}:${i.code}`));
            return [...prev, ...newOnes];
          });
        }
      }
    } catch (e) {
      // AI step failed silently — rule-based still visible
    } finally {
      setAiValidationDone(true);
    }
  }, [fields, language, service]);

  const handleSubmit = async () => {
    try {
      setIsProcessing(true);

      // Include location and user email in user details
      const submissionDetails = {
        ...formData,
        ...(userEmail && { email: userEmail.trim().toLowerCase(), userEmail: userEmail.trim().toLowerCase() }),
        ...(selectedLocation && {
          _state: selectedLocation.state,
          _district: selectedLocation.district,
        }),
      };

      // Call backend to create submission
      const response = await fetch('/api/submissions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: service.name,
          serviceId: service.id,
          userDetails: submissionDetails,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[VoiceForm] Error creating submission:', data);
        setVoiceError(t.failedToCreate);
        return;
      }

      // Format submission for display
      const submission = {
        id: data.submission.id,
        serviceId: data.submission.serviceId,
        serviceName: data.submission.serviceName,
        qrCode: data.submission.qrCode,
        qrUrl: data.submission.qrUrl,
        status: data.submission.status || 'submitted',
        statusLabel: data.submission.statusLabel,
        submittedAt: data.submission.submittedAt,
        userDetails: submissionDetails,
      };

      console.log('[VoiceForm] Submission created:', submission.id);

      if (onSubmit) {
        onSubmit(submission);
      } else {
        setSubmittedQR(submission);
      }
    } catch (error) {
      console.error('[VoiceForm] Error:', error);
      setVoiceError(t.networkError);
    } finally {
      setIsProcessing(false);
    }
  };

  if (submittedQR && !onSubmit) {
    return (
      <QRDisplay submission={submittedQR} language={language} onNewApplication={() => {
        setSubmittedQR(null);
        setCurrentFieldIndex(0);
        setIsReviewing(false);
        onSubmitSuccess?.();
      }} />
    );
  }

  // Trigger validation when entering review mode
  useEffect(() => {
    if (isReviewing) {
      setValidationIssues([]);
      setValidationDone(false);
      setAiValidationDone(false);
      runValidation(formData);
    }
  }, [isReviewing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isReviewing) {
    const hasErrors = validationIssues.filter(i => i.severity === 'error').length > 0;
    const hasWarnings = validationIssues.filter(i => i.severity === 'warning').length > 0;

    return (
      <div className="min-h-screen bg-black py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card className="shadow-2xl border border-neutral-800 bg-black overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-purple-600 p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>

              <Button onClick={onBack} variant="ghost" size="sm" className="mb-6 text-white/80 hover:text-white hover:bg-white/10 p-0 h-auto font-medium">
                ← {t.back}
              </Button>

              <div className="relative z-10">
                <h2 className="text-4xl font-bold mb-3 leading-tight">{t.reviewApplication}</h2>
                <p className="text-white/80 text-lg leading-relaxed max-w-2xl">{t.verifyInfo}</p>
              </div>
            </div>

            <div className="p-8 bg-black">
              <div className="grid gap-6 mb-8">
                {fields.map((field: any, index: number) => (
                  <div key={field.id} className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 hover:border-neutral-700 transition-all duration-200 hover:shadow-md group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                          {getFieldLabel(field.id, field.label)}
                        </label>
                        <div className="text-lg text-white font-medium leading-relaxed">
                          {field.type === 'file' && formData[field.id] ? (
                            <div className="flex flex-col gap-2">
                              {typeof formData[field.id] === 'string' && formData[field.id].startsWith('data:image') ? (
                                <img src={formData[field.id]} className="h-32 w-auto object-contain rounded-lg border border-neutral-700 bg-neutral-950" alt="File Preview" />
                              ) : typeof formData[field.id] === 'string' && formData[field.id].startsWith('data:application/pdf') ? (
                                <div className="flex items-center gap-2 text-sm text-cyan-400 bg-cyan-950/30 p-2 rounded-lg border border-cyan-800/30 w-fit">
                                  <span>📄 PDF Document</span>
                                </div>
                              ) : (
                                <span className="text-sm text-neutral-400">Document Attached</span>
                              )}
                            </div>
                          ) : (
                            formData[field.id] || <span className="text-neutral-500 italic font-normal">{t.notSpecified}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditField(index)}
                        className="ml-4 border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-600 hover:bg-neutral-800 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        {t.edit}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Smart Validation Panel ── */}
              {(isValidating || validationDone) && (
                <div className="mb-6">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isValidating ? 'bg-blue-500/20 text-blue-400 animate-pulse' :
                      hasErrors ? 'bg-red-500/20 text-red-400' :
                        hasWarnings ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                      }`}>
                      {isValidating ? '⟳' : hasErrors ? '✕' : hasWarnings ? '!' : '✓'}
                    </div>
                    <div>
                      <p className={`font-bold text-sm ${isValidating ? 'text-blue-400' :
                        hasErrors ? 'text-red-400' :
                          hasWarnings ? 'text-amber-400' :
                            'text-emerald-400'
                        }`}>
                        {isValidating ? '🤖 AI is checking your application…' :
                          hasErrors ? `❌ ${validationIssues.filter(i => i.severity === 'error').length} issue${validationIssues.filter(i => i.severity === 'error').length > 1 ? 's' : ''} found — Please fix before submitting` :
                            hasWarnings ? `⚠️ ${validationIssues.length} warning${validationIssues.length > 1 ? 's' : ''} — Review before submitting` :
                              '✅ All checks passed — Ready to submit!'}
                      </p>
                      {!aiValidationDone && validationDone && (
                        <p className="text-xs text-neutral-500 mt-0.5">🤖 AI deep scan in progress…</p>
                      )}
                    </div>
                  </div>

                  {/* Issue cards */}
                  {validationIssues.length > 0 && (
                    <div className="space-y-2">
                      {validationIssues.map((issue, idx) => {
                        const fieldIndex = fields.findIndex((f: any) => f.id === issue.fieldId);
                        return (
                          <div
                            key={`${issue.fieldId}-${idx}`}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border ${issue.severity === 'error'
                              ? 'bg-red-950/40 border-red-800/50'
                              : 'bg-amber-950/40 border-amber-800/50'
                              }`}
                          >
                            <span className={`text-lg mt-0.5 shrink-0 ${issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'
                              }`}>
                              {issue.severity === 'error' ? '✗' : '⚠'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${issue.severity === 'error' ? 'text-red-400' : 'text-amber-400'
                                }`}>
                                {issue.fieldLabel}
                              </p>
                              <p className="text-sm text-white">{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-xs text-neutral-400 mt-1">💡 {issue.suggestion}</p>
                              )}
                            </div>
                            {fieldIndex >= 0 && (
                              <button
                                onClick={() => handleEditField(fieldIndex)}
                                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${issue.severity === 'error'
                                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                  : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                  }`}
                              >
                                Fix →
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-6 border-t border-neutral-800">
                <Button
                  onClick={() => setIsReviewing(false)}
                  variant="outline"
                  className="flex-1 h-14 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800 text-neutral-300 hover:text-white font-semibold rounded-xl"
                >
                  ← {t.backToForm}
                </Button>
                <Button
                  onClick={hasErrors ? undefined : handleSubmit}
                  disabled={isProcessing || isValidating || hasErrors}
                  className={`flex-1 h-14 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 ${hasErrors
                    ? 'bg-neutral-700 cursor-not-allowed opacity-60'
                    : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90'
                    }`}
                >
                  {isProcessing ? '⟳ Submitting…' : hasErrors ? '⚠ Fix Issues First' : t.submitApplication}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const progress = ((currentFieldIndex + 1) / fields.length) * 100;

  return (
    <div className="min-h-screen bg-black py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="shadow-2xl border border-neutral-800 bg-black overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-cyan-500 to-purple-600 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24"></div>

            <Button onClick={onBack} variant="ghost" size="sm" className="mb-6 text-white/80 hover:text-white hover:bg-white/10 p-0 h-auto font-medium">
              ← {t.back}
            </Button>

            <div className="relative z-10">
              <h2 className="text-4xl font-bold mb-3 leading-tight">{translatedService.name}</h2>
              <p className="text-white/80 text-lg mb-4 leading-relaxed max-w-2xl">{translatedService.description}</p>

              {/* Selected Location Badge */}
              {selectedLocation && (
                <div className="flex items-center gap-2 mb-6">
                  <span className="px-3 py-1.5 bg-white/20 backdrop-blur rounded-full text-sm font-semibold text-white flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {selectedLocation.district}, {selectedLocation.state}
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-white/80">{t.progress}</span>
                  <span className="text-white">{Math.round(progress)}% {t.complete}</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-white h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-medium text-white/60">
                  <span>{t.question} {currentFieldIndex + 1} {t.of} {fields.length}</span>
                  <span>{fields.length - currentFieldIndex - 1} {t.remaining}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-8 lg:p-12 bg-black">
            <div className="max-w-2xl mx-auto">
              {/* Current Field */}
              <div className="mb-10">
                <div className="mb-6">
                  <label className="block text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">
                    {getFieldLabel(currentField?.id, currentField?.label)}
                  </label>
                  <div className="mb-4 text-sm text-neutral-400 leading-relaxed">
                    {currentField?.description || `${t.pleaseProvide} ${(getFieldLabel(currentField?.id, currentField?.label) || '').toLowerCase()}`}
                  </div>
                </div>

                <div className="relative group">
                  {currentField?.type === 'file' || currentField?.requiresFile ? (
                    <FileUpload
                      label={getFieldLabel(currentField?.id, currentField?.label)}
                      fieldId={currentField?.id}
                      accept=".pdf,.jpg,.jpeg,.png"
                      maxSize={5}
                      currentFile={formData[currentField?.id]}
                      onFileChange={async (fileName, file) => {
                        if (file) {
                          // 1. Set placeholder immediately so handleNext doesn't see "empty" field
                          setFormData(prev => ({
                            ...prev,
                            [currentField?.id]: 'loading_file...'
                          }));

                          // 2. Convert to base64 for real storage
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setFormData(prev => ({
                              ...prev,
                              [currentField?.id]: reader.result as string
                            }));
                          };
                          reader.readAsDataURL(file);
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            [currentField?.id]: ''
                          }));
                          setFileValidated(false);
                        }
                        console.log('[VoiceForm] File selected:', fileName);
                      }}
                      onValidationChange={(valid) => {
                        console.log('[VoiceForm] onValidationChange:', valid);
                        setFileValidated(valid);
                        if (valid) {
                          setVoiceError(null);
                          // Auto-advance to next question if file is correctly validated
                          // Wait a bit longer to ensure formData state 'loading_file...' is flushed
                          setTimeout(() => {
                            handleNext();
                          }, 1000);
                        }
                      }}
                      error={voiceError}
                      language={langCode}
                    />
                  ) : currentField?.type === 'textarea' ? (
                    <Textarea
                      value={formData[currentField?.id] || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, [currentField.id]: e.target.value }))}
                      onClick={() => {
                        // Allow tap-to-retry if the voice engine crashed or stopped
                        if (autoVoice.state.phase === 'idle' || voiceError) {
                          setVoiceError(null);
                          triggerFieldPrompt(currentFieldIndex);
                        }
                      }}
                      placeholder={
                        autoVoice.state.phase === 'listening'
                          ? (LISTENING_LABELS[autoVoice.langCode] || '🎤 Listening…')
                          : 'Tap here to answer by voice, or type…'
                      }
                      className={`text-lg min-h-[140px] border-2 focus:ring-2 rounded-xl px-6 py-5 transition-all duration-300 bg-neutral-900 text-white placeholder:text-neutral-500 shadow-sm hover:shadow-md resize-none ${autoVoice.state.phase === 'listening' || autoVoice.state.phase === 'confirm_listen'
                          ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-neutral-800 focus:border-cyan-500 focus:ring-cyan-500/20'
                        }`}
                    />
                  ) : (
                    <>
                      <Input
                        type={currentField?.type === 'date' && formData[currentField?.id] && !/^\d{4}-\d{2}-\d{2}$/.test(formData[currentField?.id]) ? 'text' : (currentField?.type || 'text')}
                        value={formData[currentField?.id] || ''}
                        onChange={(e) => {
                          let newValue = e.target.value;
                          // For date inputs, ensure the value is in valid yyyy-MM-dd format
                          if (currentField?.type === 'date' && newValue && !/^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
                            // Don't allow invalid date values
                            return;
                          }
                          setFormData(prev => ({ ...prev, [currentField.id]: newValue }));
                        }}
                        onClick={() => {
                          // Allow tap-to-retry if the voice engine crashed or stopped
                          if (autoVoice.state.phase === 'idle' || voiceError) {
                            setVoiceError(null);
                            triggerFieldPrompt(currentFieldIndex);
                          }
                        }}
                        placeholder={
                          autoVoice.state.phase === 'listening'
                            ? (LISTENING_LABELS[autoVoice.langCode] || '🎤 Listening…')
                            : autoVoice.state.phase === 'confirm_listen'
                              ? '🎤 Say YES or NO…'
                              : 'Tap here to answer by voice, or type…'
                        }
                        style={{ colorScheme: 'dark' }}
                        className={
                          `text-lg h-16 border-2 rounded-xl px-6 transition-all duration-300 shadow-sm hover:shadow-md text-white placeholder:text-neutral-400 ` +
                          (autoVoice.state.phase === 'listening' || autoVoice.state.phase === 'confirm_listen'
                            ? 'border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-neutral-900'
                            : currentField?.type === 'date'
                              ? 'border-neutral-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 bg-neutral-900 cursor-pointer'
                              : 'border-neutral-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 bg-neutral-900')
                        }
                      />

                      {/* Display Options if available (e.g., Gender) */}
                      {currentField?.options && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {currentField.options.map((opt: { label: string; value: string }) => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, [currentField.id]: opt.label }));
                                setVoiceError(null);
                              }}
                              className={`px-4 py-2 rounded-full border-2 transition-all font-bold text-sm ${formData[currentField.id] === opt.label
                                ? 'bg-cyan-500 border-cyan-500 text-white shadow-lg scale-105'
                                : 'border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white bg-neutral-900'
                                }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>

              {/* Live interim + confirmation box */}
              {(autoVoice.state.interim ||
                autoVoice.state.phase === 'confirming' ||
                autoVoice.state.phase === 'confirm_listen') && (
                <div className="mt-3 px-1 space-y-2">

                  {/* Live transcript while speaking */}
                  {autoVoice.state.interim && autoVoice.state.phase !== 'confirming' && autoVoice.state.phase !== 'confirm_listen' && (
                    <p className="text-xs text-neutral-400 italic">🎙️ {autoVoice.state.interim}…</p>
                  )}

                  {/* Detected value — shown during confirm phases */}
                  {(autoVoice.state.phase === 'confirming' || autoVoice.state.phase === 'confirm_listen') && autoVoice.state.pendingValue && (
                    <div className="bg-neutral-900 border-2 border-cyan-500/60 rounded-xl px-5 py-4">
                      <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-2">{t.captured}</p>
                      <p className="text-2xl font-bold text-white leading-tight">{autoVoice.state.pendingValue}</p>
                      {autoVoice.state.phase === 'confirm_listen' && (
                        <p className="text-sm text-neutral-400 mt-3">🎙️ {t.sayYesOrNo}</p>
                      )}
                      {autoVoice.state.phase === 'confirming' && (
                        <p className="text-sm text-cyan-300 mt-3 animate-pulse">🔊 {t.processing || 'Processing…'}</p>
                      )}
                    </div>
                  )}

                </div>
              )}


              {voiceError && (
                <div className="mb-6 p-3 bg-red-900/50 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-300 font-medium">{voiceError}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-4 pt-8 border-t border-neutral-800">
                <Button
                  onClick={handlePrevious}
                  disabled={currentFieldIndex === 0}
                  variant="outline"
                  className="flex-1 h-14 border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800 text-neutral-300 hover:text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← {t.previous}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={(currentField?.type === 'file' || currentField?.requiresFile) && !fileValidated}
                  className={`flex-1 h-14 text-white font-semibold rounded-xl shadow-lg transition-all duration-200
                    ${(currentField?.type === 'file' || currentField?.requiresFile) && !fileValidated
                      ? 'bg-neutral-700 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 hover:shadow-xl'
                    }`}
                >
                  {(currentField?.type === 'file' || currentField?.requiresFile) && !fileValidated
                    ? '🔒 Upload correct document first'
                    : currentFieldIndex === fields.length - 1 ? t.reviewApplication : `${t.nextQuestion} →`}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export const VoiceForm = VoiceFormComponent;
export default VoiceFormComponent;
