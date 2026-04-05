import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Language name to native script map for stronger enforcement
const languageNativeMap: Record<string, string> = {
    'Hindi': 'हिंदी',
    'Telugu': 'తెలుగు',
    'Kannada': 'ಕನ್ನಡ',
    'Tamil': 'தமிழ்',
    'Malayalam': 'മലയാളം',
    'Marathi': 'मराठी',
    'Bengali': 'বাংলা',
    'Gujarati': 'ગુજરાતી',
    'Punjabi': 'ਪੰਜਾਬੀ',
    'Odia': 'ଓଡ଼ିଆ',
    'Urdu': 'اردو',
    'English': 'English',
};

export async function POST(req: NextRequest) {
    try {
        const { message, language, languageCode, serviceName } = await req.json();

        const nativeScript = languageNativeMap[language] || language;
        const isEnglish = language === 'English' || !language;

        const serviceContext = serviceName
            ? `The user is asking about the "${serviceName}" government service/application.`
            : 'The user is asking about a government service or application.';

        const systemPrompt = isEnglish
            ? `You are Vaani AI Assistant, a helpful and polite Indian government service AI assistant.
You help people understand government applications, schemes, and certificates (like Passport, Driving License, Income Certificate, Caste Certificate, Post-Matric Scholarship, Birth Certificate, Voter ID, Aadhaar Update, PAN Card, etc.).
You explain how each service is useful, where it can be used, and how it benefits people.
Keep your answers highly informative, concise, and easy to understand.
${serviceContext}
IMPORTANT: You MUST respond ONLY in English. Do not use any other language.`
            : `You are Vaani AI Assistant, a helpful and polite Indian government service AI assistant.
You help people understand government applications, schemes, and certificates (like Passport, Driving License, Income Certificate, Caste Certificate, Post-Matric Scholarship, Birth Certificate, Voter ID, Aadhaar Update, PAN Card, etc.).
You explain how each service is useful, where it can be used, and how it benefits people.
Keep your answers highly informative, concise, and easy to understand.
${serviceContext}

CRITICAL LANGUAGE INSTRUCTION: You MUST respond ONLY in ${language} (${nativeScript} script). 
- Do NOT write even a single word in English unless it is a proper noun like "PAN Card", "Aadhaar", "OTP".
- Write ALL explanations, ALL sentences, and ALL words in ${language} using ${nativeScript} script.
- If the user asks in any language, always reply in ${language} (${nativeScript}).
- Your entire response must be in ${language}. This is mandatory and non-negotiable.`;

        let text = "";

        // Attempt Gemini First (if key exists)
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({
                    model: "gemini-1.5-flash",
                    systemInstruction: systemPrompt
                });
                const result = await model.generateContent(message);
                text = result.response.text();
            } catch (geminiError: any) {
                console.error("Gemini failed, falling back to Groq...", geminiError.message);
            }
        }

        // Attempt Groq if Gemini hasn't succeeded
        if (!text && process.env.GROQ_API_KEY) {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const completion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.3,
                max_tokens: 1024,
            });
            text = completion.choices[0]?.message?.content || "";
        }

        if (!text) {
            return NextResponse.json({ 
                success: false, 
                text: "I am unable to process your request because both Groq and Gemini API keys are either missing or restricted. Please update your AI API keys.",
                error: "API Keys missing or restricted."
            });
        }

        return NextResponse.json({ success: true, text });
    } catch (error) {
        let errorMessage = error instanceof Error ? error.message : String(error);

        console.error("Error in chat API:", errorMessage);
        
        // Return a developer-friendly error directly in text if something hard fails
        if (errorMessage.includes("400") || errorMessage.includes('organization_restricted')) {
             return NextResponse.json({ 
                 success: true, 
                 text: "I cannot answer this right now because my AI provider (Groq) has restricted the API key used. Please edit the .env.local file to update the GROQ_API_KEY or add a GEMINI_API_KEY." 
             });
        }

        return NextResponse.json({ success: false, error: "Failed to generate response", details: errorMessage }, { status: 500 });
    }
}
