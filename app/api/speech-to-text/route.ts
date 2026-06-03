import { NextRequest, NextResponse } from "next/server";
import Groq, { toFile } from "groq-sdk";

/**
 * POST /api/speech-to-text
 * Transcribe audio using Groq's Whisper Large v3 model
 *
 * Expected request:
 * {
 *   audio: base64 encoded audio data,
 *   mimeType: "audio/wav" | "audio/mp3" | "audio/ogg" | etc.
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { audio, mimeType = "audio/wav", language = "hi", fieldName = "" } = body;

    // Normalize language code to ISO-639-1 (2 letters) for Groq
    if (language && language.includes('-')) {
      language = language.split('-')[0];
    }

    if (!audio) {
      return NextResponse.json(
        { error: "Audio data is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("[SpeechToText] GROQ_API_KEY is not set");
      return NextResponse.json(
        { error: "Speech-to-text service not configured" },
        { status: 500 },
      );
    }

    const groq = new Groq({ apiKey });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, "base64");

    // Build a context prompt for Whisper to improve accuracy for the specific field.
    // Whisper uses this as a prior to bias recognition toward the expected kind of speech.
    const WHISPER_PROMPTS: Record<string, string> = {
      name: 'This is a person full name spoken in India. It may be an Indian name like Ramesh Kumar, Priya Sharma, Mohammed Ali, or a South Indian name.',
      full_name: 'This is a person full name spoken in India. It may be an Indian name like Ramesh Kumar, Priya Sharma, Mohammed Ali, or a South Indian name.',
      father_name: 'This is the name of a father, spoken in India. Common Indian names.',
      mother_name: 'This is the name of a mother, spoken in India. Common Indian names.',
      husband_name: 'This is a spouse name spoken in India.',
      guardian_name: 'This is a guardian name spoken in India.',
      owner_name: 'This is an owner name spoken in India.',
      applicant_name: 'This is an applicant full name spoken in India.',
      phone: 'This is a 10-digit Indian mobile phone number. The speaker may say the digits individually or in groups.',
      mobile: 'This is a 10-digit Indian mobile phone number. The speaker may say the digits individually or in groups.',
      mobile_no: 'This is a 10-digit Indian mobile phone number.',
      aadhaar: 'This is a 12-digit Aadhaar number. The speaker may say the digits individually or in groups.',
      aadhaar_no: 'This is a 12-digit Aadhaar number.',
      pan: 'This is a PAN card number with 5 letters, 4 digits, and 1 letter. For example ABCDE1234F.',
      pincode: 'This is a 6-digit Indian postal PIN code.',
      email: 'This is an email address. The speaker may say dot for . and at for @.',
      dob: 'This is a date of birth. The speaker may say day month year in any order.',
      date_of_birth: 'This is a date of birth spoken in India.',
      address: 'This is a residential address in India.',
      village: 'This is a village, town, or city name in India.',
      district: 'This is an Indian district or city name.',
      state: 'This is an Indian state name.',
      occupation: 'This is an occupation or job title.',
      income: 'This is an amount in Indian Rupees. The speaker may say lakhs or thousands.',
      annual_income: 'This is an annual income amount in Indian Rupees.',
      land_area: 'This is a land area measurement in acres or hectares.',
      bank_account: 'This is a bank account number.',
      ifsc: 'This is an IFSC code for a bank branch in India.',
    };

    // Find best matching prompt — check exact ID, then partial match
    const fieldKey = (fieldName || '').toLowerCase().replace(/-/g, '_');
    const whisperPrompt =
      WHISPER_PROMPTS[fieldKey] ||
      Object.entries(WHISPER_PROMPTS).find(([k]) => fieldKey.includes(k))?.[1] ||
      'This is a spoken response for an Indian government form. Transcribe accurately.';

    // Groq uses the file EXTENSION to detect format, so the name MUST match the mimeType
    const ext = mimeType.includes('mp4') ? 'mp4'
      : mimeType.includes('ogg') ? 'ogg'
        : mimeType.includes('mp3') || mimeType.includes('mpeg') ? 'mp3'
          : 'webm'; // default to webm (chrome/edge default)

    const file = await toFile(audioBuffer, `audio.${ext}`, { type: mimeType });
    
    // Only provide language if it's a specific code. 
    const options: any = {
      file: file,
      model: 'whisper-large-v3',
      prompt: whisperPrompt,
      temperature: 0,
    };
    
    if (language && language !== 'auto' && language.trim() !== '') {
      options.language = language;
    }

    console.log(
      `[SpeechToText] Sending to Groq SDK (Lang: ${language === 'auto' ? 'AUTO-DETECT' : language}, File: audio.${ext}, Prompt: ${whisperPrompt.substring(0, 30)}...)`,
    );

    // Call Groq API via SDK
    const transcription = await groq.audio.transcriptions.create(options);

    console.log("[SpeechToText] Transcription successful:", transcription.text);

    return NextResponse.json({
      success: true,
      text: transcription.text,
      language: language,
      raw: transcription,
    });
  } catch (error: any) {
    // Log the full error so it appears in the Next.js terminal
    console.error("[SpeechToText] Unexpected error:", error?.message || error);
    return NextResponse.json(
      {
        error: `Failed to process speech-to-text: ${error instanceof Error ? error.message : String(error)}`,
        message: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 },
    );
  }
}
