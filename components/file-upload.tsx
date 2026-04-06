'use client';

import { useState } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FileUploadProps {
  label: string;
  fieldId: string;
  accept?: string;
  maxSize?: number; // in MB
  currentFile?: string;
  onFileChange: (fileName: string, file: File | null) => void;
  onValidationChange?: (isValid: boolean) => void; // new: notify parent of validity
  error?: string | null;
  isListening?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  voicePrompt?: string;
  language?: string;
}

export function FileUpload({
  label,
  fieldId,
  accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx',
  maxSize = 5,
  currentFile,
  onFileChange,
  onValidationChange,
  error,
  language = 'en',
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isFileValid, setIsFileValid] = useState<boolean | null>(null);

  const validateFileLocally = (file: File): boolean => {
    const maxSizeBytes = maxSize * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setFileError(`File too large. Max size: ${maxSize}MB (yours: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
      return false;
    }
    const allowedTypes = accept.split(',').map(t => t.trim().toLowerCase());
    const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
    if (!allowedTypes.includes(fileExtension)) {
      setFileError(`Only accepted: ${allowedTypes.join(', ')}`);
      return false;
    }
    return true;
  };

  const validateFileWithAI = async (file: File) => {
    setIsValidating(true);
    setFileError(null);
    setIsFileValid(null);
    onValidationChange?.(false); // block next until validated

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fieldId', fieldId);
      formData.append('fieldLabel', label);
      formData.append('language', language);

      const res = await fetch('/api/validate-file', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (result.isValid) {
        setIsFileValid(true);
        setFileError(null);
        onFileChange(file.name, file);
        onValidationChange?.(true); // unblock next after state update signal
      } else {
        setIsFileValid(false);
        setFileError(result.errorMessage || `Wrong file. Please upload your ${label}.`);
        onValidationChange?.(false);
        // Clear the file — force user to re-upload
        setSelectedFile(null);
        onFileChange('', null);
        const input = document.getElementById(`file-input-${fieldId}`) as HTMLInputElement;
        if (input) input.value = '';
      }
    } catch (e) {
      console.error('[FileUpload] AI validation error:', e);
      // On API error — accept the file anyway (graceful fallback)
      setIsFileValid(true);
      setFileError(null);
      onFileChange(file.name, file);
      onValidationChange?.(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!validateFileLocally(file)) return;
    setSelectedFile(file);
    await validateFileWithAI(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setIsFileValid(null);
    setFileError(null);
    onFileChange('', null);
    onValidationChange?.(false);
    const input = document.getElementById(`file-input-${fieldId}`) as HTMLInputElement;
    if (input) input.value = '';
  };

  const displayFileName = isFileValid ? (currentFile || selectedFile?.name) : null;

  return (
    <div className="space-y-3">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 text-center cursor-pointer
          ${dragActive ? 'border-purple-500 bg-purple-500/10' : ''}
          ${isValidating ? 'border-yellow-500 bg-yellow-500/5' : ''}
          ${isFileValid === true ? 'border-green-500 bg-green-500/5' : ''}
          ${isFileValid === false || fileError ? 'border-red-500 bg-red-500/5' : ''}
          ${!dragActive && !isValidating && isFileValid === null && !fileError
            ? 'border-neutral-700 bg-neutral-900 hover:border-purple-500 hover:bg-purple-500/5'
            : ''}
        `}
      >
        <input
          type="file"
          id={`file-input-${fieldId}`}
          accept={accept}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isValidating}
        />

        <div className="space-y-3 pointer-events-none">
          {isValidating ? (
            <>
              <Loader2 className="w-12 h-12 text-yellow-400 mx-auto animate-spin" />
              <p className="text-sm font-medium text-yellow-400">Checking your document…</p>
            </>
          ) : isFileValid === true ? (
            <>
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-sm font-semibold text-green-400">Document verified ✓</p>
              <p className="text-xs text-neutral-400">{displayFileName}</p>
            </>
          ) : isFileValid === false ? (
            <>
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
              <p className="text-sm font-semibold text-red-400">Wrong document — please try again</p>
              <p className="text-xs text-neutral-500">Click or drag to upload the correct file</p>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 text-neutral-500 mx-auto" />
              <p className="text-sm font-semibold text-neutral-300">
                Click or drag &amp; drop to upload
              </p>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      {(fileError || (error && isFileValid !== true)) && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{fileError || error}</p>
        </div>
      )}

      {/* Remove button when valid */}
      {isFileValid === true && displayFileName && (
        <button
          onClick={handleRemove}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs text-neutral-500 hover:text-red-400 transition-colors"
        >
          <X className="w-4 h-4" />
          Remove and re-upload
        </button>
      )}
    </div>
  );
}

export default FileUpload;
