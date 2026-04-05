import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Categories of what a field accepts.
 * "multi" = accepts any of several government documents (Aadhaar, PAN, Voter ID, etc.)
 * "specific" = must be one exact document type
 */
type FieldCategory =
    | { type: 'multi'; label: string; examples: string }
    | { type: 'specific'; label: string; description: string }
    | { type: 'any'; label: string };

function categorizeField(fieldId: string, fieldLabel: string): FieldCategory {
    const id = fieldId.toLowerCase().replace(/-/g, '_');
    const label = fieldLabel.toLowerCase();

    // ── 1. Specific document fields (Check these FIRST) ────────────────────────
    const specificDocs: Record<string, string> = {
        aadhaar_card: 'Aadhaar card (has 12-digit UID number, issued by UIDAI)',
        aadhar_card: 'Aadhaar card (has 12-digit UID number, issued by UIDAI)',
        pan_card: 'PAN card (Permanent Account Number card, has 10-character alphanumeric PAN)',
        voter_card: 'Voter ID card (Election Commission of India)',
        passport_copy: 'Indian Passport',
        driving_licence: 'Driving Licence',
        ration_card_doc: 'Ration Card',
        photo: 'recent passport-size photograph of a person with face clearly visible',
        photograph: 'recent passport-size photograph of a person with face clearly visible',
        passport_photo: 'recent passport-size photograph of a person with face clearly visible',
        selfie: 'recent passport-size photograph of a person with face clearly visible',
        signature: 'signature on a white paper',
        sign_doc: 'signature on a white paper',
        sign: 'signature on a white paper',
        bank_passbook: 'bank passbook or bank statement',
        marksheet: 'academic marksheet or grade sheet',
        birth_certificate: 'birth certificate from hospital or municipality',
        death_certificate: 'death certificate',
        medical_certificate: 'medical certificate from a registered doctor',
        disability_certificate: 'disability certificate (UDID)',
        land_document: 'land ownership document or patta',
        property_doc: 'property ownership document',
    };

    for (const [k, desc] of Object.entries(specificDocs)) {
        if (id.includes(k) || label.includes(k)) {
            return { type: 'specific', label: fieldLabel, description: desc };
        }
    }

    // ── 2. Multi-document proof fields (accept Aadhaar, PAN, Voter ID, etc.) ──────
    const multiProofPatterns = [
        'poi', 'proof_of_identity', 'identity_proof', 'id_proof',
        'poa', 'proof_of_address', 'address_proof', 'residence_proof',
        'dob', 'proof_of_dob', 'dob_proof', 'birth_proof',
        'proof_doc', 'proof_file', 'supporting_doc', 'document',
        'id_card', 'id_document', 'govt_id', 'government_id',
        'income_proof', 'age_proof', 'proof',
        'parent_doc', 'family_id', 'family_doc',
    ];

    const isMultiProof = multiProofPatterns.some(p => id.includes(p) || id === p);
    const labelHasProof = label.includes('proof') || label.includes('upload') ||
        label.includes('document') || label.includes('proof of');

    if (isMultiProof || labelHasProof) {
        // Determine which type of proof based on label/id
        if (id.includes('address') || id.includes('poa') || label.includes('address')) {
            return {
                type: 'multi',
                label: fieldLabel,
                examples: 'Aadhaar card, Voter ID, passport, electricity bill, water bill, bank passbook, ration card, or any government-issued address proof',
            };
        }
        if (id.includes('dob') || id.includes('birth') || label.includes('birth') || label.includes('age')) {
            return {
                type: 'multi',
                label: fieldLabel,
                examples: 'Aadhaar card, birth certificate, passport, school leaving certificate, or any document showing date of birth',
            };
        }
        if (id.includes('income') || label.includes('income')) {
            return {
                type: 'multi',
                label: fieldLabel,
                examples: 'income certificate, salary slip, Form 16, bank statement, or any document showing income',
            };
        }
        if (id.includes('caste') || id.includes('community') || label.includes('caste')) {
            return {
                type: 'multi',
                label: fieldLabel,
                examples: 'caste certificate, community certificate, SC/ST/OBC certificate issued by government',
            };
        }
        // Generic identity/proof field
        return {
            type: 'multi',
            label: fieldLabel,
            examples: 'Aadhaar card, PAN card, Voter ID, passport, driving licence, or any valid government-issued identity or address document',
        };
    }

    // fallback — accept anything that looks like a document
    return { type: 'any', label: fieldLabel };
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const fieldId = (formData.get('fieldId') as string) || '';
        const fieldLabel = (formData.get('fieldLabel') as string) || fieldId;
        const language = (formData.get('language') as string) || 'en';

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        const mimeType = file.type || 'image/jpeg';
        const isPDF = mimeType === 'application/pdf';
        const isImage = mimeType.startsWith('image/');

        // PDFs — accept directly (vision can't parse them)
        if (isPDF) {
            return NextResponse.json({ success: true, isValid: true, reason: 'PDF accepted.', errorMessage: '' });
        }

        if (!isImage) {
            return NextResponse.json({
                success: true,
                isValid: false,
                reason: 'Invalid file format.',
                errorMessage: 'Please upload an image file (JPG or PNG).',
            });
        }

        // Read as base64
        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');

        const fieldCategory = categorizeField(fieldId, fieldLabel);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        let prompt = '';

        if (fieldCategory.type === 'multi') {
            prompt = `You are a document verification assistant for Indian government forms.

The user was asked to upload: "${fieldLabel}"
This field accepts any of the following documents: ${fieldCategory.examples}

Look at this image and answer:
1. Does it show a recognisable document (Aadhaar, PAN, Voter ID, passport, any government ID, certificate, bill, or similar)? 
2. Is it readable and not a random photo, screenshot of something unrelated, or blank image?

Be LENIENT — if it looks like ANY kind of official document, certificate, bill, or ID card, accept it.
Only reject if it is clearly a selfie/person photo, a landscape/nature photo, a blank image, or completely unrelated content.

Respond ONLY in this exact JSON format:
{"isValid": true or false, "reason": "one short sentence"}`;
        } else if (fieldCategory.type === 'specific') {
            prompt = `You are a document verification assistant for Indian government forms.

The user was asked to upload: "${fieldLabel}"
The required document is: ${fieldCategory.description}

Look at this image. Does it clearly show a "${fieldCategory.description}"?
Be reasonably lenient — if it looks like the right type of document even if slightly blurry or partial, accept it.
Only reject if it is clearly a completely different type of document.

Respond ONLY in this exact JSON format:
{"isValid": true or false, "reason": "one short sentence"}`;
        } else {
            // type === 'any' — accept any document-looking image
            prompt = `You are a document verification assistant.

The user uploaded a file for: "${fieldLabel}"

Look at this image. Is it a document, certificate, ID card, form, or any official paper?
Accept it unless it's clearly a selfie, landscape photo, or blank/random image.

Respond ONLY in this exact JSON format:
{"isValid": true or false, "reason": "one short sentence"}`;
        }

        let isValid = false;
        let reason = '';

        try {
            const result = await model.generateContent([
                prompt,
                { inlineData: { mimeType, data: base64Data } },
            ]);

            const responseText = result.response.text().trim();
            console.log(`[ValidateFile] Gemini response for ${fieldId}:`, responseText);

            const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                isValid = parsed.isValid === true;
                reason = parsed.reason || '';
            } else {
                // If Gemini didn't return JSON, parse its intent
                const lower = responseText.toLowerCase();
                isValid = lower.includes('valid') || lower.includes('correct') || lower.includes('aadhaar') || lower.includes('document');
                reason = responseText.substring(0, 80);
            }
        } catch (e) {
            console.error('[ValidateFile] Gemini error:', e);
            // Graceful fallback — accept the file
            isValid = true;
            reason = 'Document accepted.';
        }

        // Build multilingual error if invalid
        let errorMessage = '';
        if (!isValid) {
            const langCode = (language || 'en').split('-')[0];
            const WRONG_FILE_MESSAGES: Record<string, string> = {
                en: `This doesn't look like a valid document for "${fieldLabel}". Please upload the correct file.`,
                hi: `यह "${fieldLabel}" के लिए सही दस्तावेज़ नहीं लगता। कृपया सही फ़ाइल अपलोड करें।`,
                te: `ఇది "${fieldLabel}" కోసం సరైన పత్రంలా కనపడటం లేదు. దయచేసి సరైన ఫైల్ అప్‌లోడ్ చేయండి.`,
                kn: `ಇದು "${fieldLabel}" ಗಾಗಿ ಸರಿಯಾದ ದಾಖಲೆ ಅಲ್ಲ. ದಯವಿಟ್ಟು ಸರಿಯಾದ ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.`,
                ta: `இது "${fieldLabel}" க்கான சரியான ஆவணம் இல்லை. சரியான கோப்பை பதிவேற்றவும்.`,
                ml: `ഇത് "${fieldLabel}" ന് ശരിയായ രേഖ അല്ല. ശരിയായ ഫൈൽ അപ്‌ലോഡ് ചെയ്യുക.`,
                mr: `हे "${fieldLabel}" साठी योग्य दस्तऐवज नाही. योग्य फाइल अपलोड करा.`,
                bn: `এটি "${fieldLabel}" এর জন্য সঠিক নথি নয়। সঠিক ফাইল আপলোড করুন।`,
                gu: `આ "${fieldLabel}" માટે સાચો દસ્તાવેજ નથી. સાચી ફાઇલ અપલોડ કરો.`,
                pa: `ਇਹ "${fieldLabel}" ਲਈ ਸਹੀ ਦਸਤਾਵੇਜ਼ ਨਹੀਂ ਹੈ। ਸਹੀ ਫਾਈਲ ਅਪਲੋਡ ਕਰੋ।`,
                or: `ଏହା "${fieldLabel}" ପାଇଁ ଭୁଲ ଦଲିଲ। ସଠିକ ଫାଇଲ ଅପଲୋଡ କରନ୍ତୁ।`,
                ur: `یہ "${fieldLabel}" کے لیے درست دستاویز نہیں ہے۔ درست فائل اپلوڈ کریں۔`,
            };
            errorMessage = WRONG_FILE_MESSAGES[langCode] || WRONG_FILE_MESSAGES['en'];
        }

        return NextResponse.json({ success: true, isValid, reason, errorMessage });

    } catch (error: any) {
        console.error('[ValidateFile] Error:', error);
        // On error, accept the file (don't block the user)
        return NextResponse.json({ success: true, isValid: true, reason: 'Accepted.', errorMessage: '' });
    }
}
