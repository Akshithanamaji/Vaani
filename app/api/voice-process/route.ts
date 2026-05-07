import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface VoiceProcessResponse {
  success: boolean;
  response: string;
  isConfirmed: boolean;
  nextField?: string;
  action?: string;
  error?: string;
  transcript?: string;
  voicePrompt?: string; // Initial voice prompt for the field
}

/**
 * Generate voice prompt for any field in any language
 */
function getVoicePrompt(fieldName: string, language: string, translatedLabel: string | null = null): string {
  const langCode =
    language && typeof language === "string" ? language.split("-")[0] : "en";

  // Common field prompts in all languages
  const prompts: Record<string, Record<string, string>> = {
    // Personal Information
    name: {
      en: "Please tell me your full name",
      hi: "कृपया अपना पूरा नाम बताएं",
      te: "దయచేసి మీ పూర్తి పేరు చెప్పండి",
      ta: "தயவுசெய்து உங்கள் முழு பெயரைச் சொல்லுங்கள்",
      ml: "ദയവായി നിങ്ങളുടെ പൂർണ്ണ നാമം പറയുക",
      kn: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಹೇಳಿ",
      mr: "कृपया आपले पूर्ण नाव सांगा",
      bn: "দয়া করে আপনার পূর্ণ নাম বলুন",
      gu: "કૃપા કરીને તમારું પૂરું નામ જણાવો",
      or: "ଦୟାକରି ଆପଣଙ୍କର ପୂର୍ଣ୍ଣ ନାମ କୁହନ୍ତୁ",
      pa: "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਪੂਰਾ ਨਾਮ ਦੱਸੋ",
      ur: "براہ کرم اپنا پورا نام بتائیں",
    },
    email: {
      en: "What is your email address?",
      hi: "आपका ईमेल पता क्या है?",
      te: "మీ ఈమెయిల్ అడ్రస్ ఏమిటి?",
      ta: "உங்கள் மின்னஞ்சல் முகவரி என்ன?",
      ml: "നിങ്ങളുടെ ഇമെയിൽ വിലാസം എന്താണ്?",
      kn: "ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸ ಏನು?",
      mr: "तुमचा ईमेल पत्ता काय आहे?",
      bn: "আপনার ইমেল ঠিকানা কী?",
      gu: "તમારું ઇમેઇલ સરનામું શું છે?",
      or: "ଆପଣଙ୍କର ଇମେଲ୍ ଠିକଣା କଣ?",
      pa: "ਤੁਹਾਡਾ ਈਮੇਲ ਪਤਾ ਕੀ ਹੈ?",
      ur: "آپ کا ای میل پتہ کیا ہے؟",
    },
    phone: {
      en: "What is your phone number?",
      hi: "आपका फोन नंबर क्या है?",
      te: "మీ ఫోన్ నంబర్ ఏమిటి?",
      ta: "உங்கள் தொலைபேசி எண் என்ன?",
      ml: "നിങ്ങളുടെ ഫോൺ നമ്പർ എന്താണ്?",
      kn: "ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆ ಏನು?",
      mr: "तुमचा फोन नंबर काय आहे?",
      bn: "আপনার ফোন নম্বর কী?",
      gu: "તમારો ફોન નંબર શું છે?",
      or: "ଆପଣଙ୍କର ଫୋନ୍ ନମ୍ବର କଣ?",
      pa: "ਤੁਹਾਡਾ ਫੋਨ ਨੰਬਰ ਕੀ ਹੈ?",
      ur: "آپ کا فون نمبر کیا ہے؟",
    },
    address: {
      en: "Please tell me your complete address",
      hi: "कृपया अपना पूरा पता बताएं",
      te: "దయచేసి మీ పూర్తి చిరునామా చెప్పండి",
      ta: "தயவுசெய்து உங்கள் முழு முகவரியைச் சொல்லுங்கள்",
      ml: "ദയവായി നിങ്ങളുടെ പൂർണ്ണ വിലാസം പറയുക",
      kn: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಂಪೂರ್ಣ ವಿಳಾಸವನ್ನು ಹೇಳಿ",
      mr: "कृपया आपला संपूर्ण पत्ता सांगा",
      bn: "দয়া করে আপনার সম্পূর্ণ ঠিকানা বলুন",
      gu: "કૃપા કરીને તમારું સંપૂર્ણ સરનામું જણાવો",
      or: "ଦୟାକରି ଆପଣଙ୍କର ସମ୍ପୂର୍ଣ୍ଣ ଠିକଣା କୁହନ୍ତୁ",
      pa: "ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਪੂਰਾ ਪਤਾ ਦੱਸੋ",
      ur: "براہ کرم اپنا مکمل پتہ بتائیں",
    },
    gender: {
      en: "What is your gender?",
      hi: "आपका लिंग क्या है?",
      te: "మీ లింగం ఏమిటి?",
      ta: "உங்கள் பாலினம் என்ன?",
      ml: "നിങ്ങളുടെ ലിംഗം എന്താണ്?",
      kn: "ನಿಮ್ಮ ಲಿಂಗ ಏನು?",
      mr: "तुमचे लिंग काय आहे?",
      bn: "আপনার লিঙ্গ কী?",
      gu: "તમારું લિંગ શું છે?",
      or: "ଆପଣଙ୍କର ଲିଙ୍ଗ କଣ?",
      pa: "ਤੁਹਾਡਾ ਲਿੰਗ ਕੀ ਹੈ?",
      ur: "آپ کی جنس کیا ہے؟",
    },
    dob: {
      en: "What is your date of birth?",
      hi: "आपकी जन्म तिथि क्या है?",
      te: "మీ పుట్టిన తేదీ ఏమిటి?",
      ta: "உங்கள் பிறந்த தேதி என்ன?",
      ml: "നിങ്ങളുടെ ജനനത്തീയതി എന്താണ്?",
      kn: "ನಿಮ್ಮ ಜನ್ಮ ದಿನಾಂಕ ಏನು?",
      mr: "तुमची जन्मतारीख काय आहे?",
      bn: "আপনার জন্ম তারিখ কী?",
      gu: "તમારી જન્મ તારીખ શું છે?",
      or: "ଆପଣଙ୍କର ଜନ୍ମ ତିଥି କଣ?",
      pa: "ਤੁਹਾਡੀ ਜਨਮ ਤਾਰੀਖ ਕੀ ਹੈ?",
      ur: "آپ کی پیدائش کی تاریخ کیا ہے؟",
    },
  };

  // Check if we have a specific prompt for this field
  if (prompts[fieldName]) {
    return prompts[fieldName][langCode] || prompts[fieldName]["en"];
  }

  // Generate generic prompt based on field name
  const fieldLabel = translatedLabel || fieldName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim();

  const genericPrompts: Record<string, string> = {
    en: `Please provide your ${fieldLabel}`,
    hi: `कृपया अपना ${fieldLabel} प्रदान करें`,
    te: `దయచేసి మీ ${fieldLabel} అందించండి`,
    ta: `தயவுசெய்து உங்கள் ${fieldLabel} வழங்கவும்`,
    ml: `ദയവായി നിങ്ങളുടെ ${fieldLabel} നൽകുക`,
    kn: `ದಯವಿಟ್ಟು ನಿಮ್ಮ ${fieldLabel} ಒದಗಿಸಿ`,
    mr: `कृपया आपला ${fieldLabel} प्रदान करा`,
    bn: `দয়া করে আপনার ${fieldLabel} প্রদান করুন`,
    gu: `કૃપા કરીને તમારું ${fieldLabel} પ્રદાન કરો`,
    or: `ଦୟାକରି ଆପଣଙ୍କର ${fieldLabel} ପ୍ରଦାନ କରନ୍ତୁ`,
    pa: `ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ${fieldLabel} ਪ੍ਰਦਾਨ ਕਰੋ`,
    ur: `براہ کرم اپنا ${fieldLabel} فراہم کریں`,
  };

  return genericPrompts[langCode] || genericPrompts["en"];
}

/**
 * Get response and guidance based on field and user input
 */
function getBackendResponse(
  transcript: string,
  language: string,
  fieldName: string,
  context?: Record<string, any>,
): {
  response: string;
  isConfirmed: boolean;
  action?: string;
  nextField?: string;
} {
  const langCode =
    language && typeof language === "string" ? language.split("-")[0] : "en";

  // Validation and response logic for different fields
  const responses: Record<string, Record<string, any>> = {
    name: {
      en: {
        confirm: `I heard "${transcript}". Is this your correct name?`,
        success: `Thank you. Your name has been recorded as ${transcript}.`,
        error: "Please provide a valid name with at least 2 characters.",
      },
      hi: {
        confirm: `मैंने "${transcript}" सुना। क्या यह आपका सही नाम है?`,
        success: `धन्यवाद। आपका नाम ${transcript} के रूप में दर्ज किया गया है।`,
        error: "कृपया कम से कम 2 वर्णों वाला मान्य नाम प्रदान करें।",
      },
      te: {
        confirm: `నేను "${transcript}" విని. ఇది మీ సరైన పేరా?`,
        success: `ధన్యవాదాలు. మీ పేరు ${transcript} గా నమోదు చేయబడింది.`,
        error: "దయచేసి కనీసం 2 అక్షరాలు కలిగిన చెల్లుబాటైన పేరు ఇవ్వండి.",
      },
      ta: {
        confirm: `நான் "${transcript}" கேட்டேன். இது உங்கள் சரியான பெயரா?`,
        success: `நன்றி. உங்கள் பெயர் ${transcript} என பதிவு செய்யப்பட்டது.`,
        error:
          "தயவுசெய்து குறைந்தபட்சம் 2 எழுத்துக்கள் கொண்ட செல்லுபடியாகும் பெயரை வழங்கவும்.",
      },
      ml: {
        confirm: `ഞാൻ "${transcript}" കേട്ടു. ഇതാണ് നിങ്ങളുടെ ശരിയായ പേരോ?`,
        success: `നന്ദി. നിങ്ങളുടെ പേര് ${transcript} ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`,
        error: "കൃപയാ കുറഞ്ഞത് 2 അക്ഷരങ്ങളുള്ള സാധുവായ പേര് നല്കുക.",
      },
      kn: {
        confirm: `ನಾನು "${transcript}" ಕೇಳಿದೆ. ಇದು ನಿಮ್ಮ ಸರಿಯಾದ ಹೆಸರೇ?`,
        success: `ಧನ್ಯವಾದ. ನಿಮ್ಮ ಹೆಸರು ${transcript} ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.`,
        error: "ದಯವಿಟ್ಟು ಕನಿಷ್ಠ 2 ಅಕ್ಷರಗಳನ್ನು ಹೊಂದಿರುವ ಮಾನ್ಯ ಹೆಸರು ಒದಗಿಸಿ.",
      },
      mr: {
        confirm: `मी "${transcript}" ऐकले. हे तुमचे योग्य नाव आहे का?`,
        success: `धन्यवाद. तुमचे नाव ${transcript} म्हणून दाखल केले गेले आहे.`,
        error: "कृपया कमीत कमी २ वर्ण असलेले वैध नाव द्या.",
      },
      bn: {
        confirm: `আমি "${transcript}" শুনেছি। এটি কি আপনার সঠিক নাম?`,
        success: `ধন্যবাদ। আপনার নাম ${transcript} হিসাবে রেকর্ড করা হয়েছে।`,
        error: "দয়া করে কমপক্ষে ২ টি অক্ষর সহ একটি বৈধ নাম প্রদান করুন।",
      },
      gu: {
        confirm: `મેં "${transcript}" સાંભળ્યું. આ તમારું યોગ્ય નામ છે?`,
        success: `આભાર. તમારું નામ ${transcript} તરીકે રેકોર્ડ કરવામાં આવ્યું છે.`,
        error: "કૃપા કરીને ઓછામાં ઓછા २ અક્ષર સાથે માન્ય નાম પ્રદાન કરો.",
      },
      or: {
        confirm: `ମୁଁ "${transcript}" ଶୁଣିଛି। ଏହା ତୁମର ସଠିକ ନାମ?`,
        success: `ଧନ୍ୟବାଦ। ତୁମର ନାମ ${transcript} ଭାବରେ ରେକର୍ଡ କରାଯାଇଛି।`,
        error: "ଦୟାକରି ଅତିକମରେ २ ଅକ୍ଷର ସହ ଏକ ବୈଧ ନାମ ପ୍ରଦାନ କରନ୍ତୁ।",
      },
      pa: {
        confirm: `ਮੈਂ "${transcript}" ਸੁਣਿਆ। ਕੀ ਇਹ ਤੁਹਾਡਾ ਸਹੀ ਨਾਮ ਹੈ?`,
        success: `ਧੰਨਵਾਦ। ਤੁਹਾਡਾ ਨਾਮ ${transcript} ਦੇ ਰੂਪ ਵਿੱਚ ਰਿਕਾਰਡ ਕੀਤਾ ਗਿਆ ਹੈ।`,
        error: "ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ 2 ਅੱਖਰਾਂ ਵਾਲਾ ਮਾਨ ਯੋਗ ਨਾਮ ਦਿਓ।",
      },
      ur: {
        confirm: `میں نے "${transcript}" سنا ہے۔ کیا یہ آپ کا صحیح نام ہے؟`,
        success: `شکریہ۔ آپ کا نام ${transcript} کے طور پر ریکارڈ کیا گیا ہے۔`,
        error: "براہ کرم کم از کم 2 حروف کے ساتھ ایک درست نام فراہم کریں۔",
      },
    },
    email: {
      en: {
        confirm: `I heard "${transcript}". Is this your correct email address?`,
        success: `Your email has been recorded as ${transcript}.`,
        error: "Please provide a valid email address (e.g., name@example.com).",
      },
      hi: {
        confirm: `मैंने "${transcript}" सुना। क्या यह आपका सही ईमेल है?`,
        success: `आपका ईमेल ${transcript} के रूप में दर्ज किया गया है।`,
        error: "कृपया एक मान्य ईमेल पता प्रदान करें (जैसे name@example.com)।",
      },
      te: {
        confirm: `నేను "${transcript}" విని. ఇది మీ సరైన ఇమెయిల్ చిరునామా?`,
        success: `మీ ఇమెయిల్ ${transcript} గా నమోదు చేయబడింది.`,
        error:
          "దయచేసి చెల్లుబాటైన ఇమెయిల్ చిరునామా ఇవ్వండి (ఉదా: name@example.com).",
      },
      ta: {
        confirm: `நான் "${transcript}" கேட்டேன். இது உங்கள் சரியான மின்னஞ்சல் முகவரியா?`,
        success: `உங்கள் மின்னஞ்சல் ${transcript} என பதிவு செய்யப்பட்டது.`,
        error:
          "தயவுசெய்து சரியான மின்னஞ்சல் முகவரியை வழங்கவும் (உ.ம: name@example.com).",
      },
      ml: {
        confirm: `ഞാൻ "${transcript}" കേട്ടു. ഇതാണ് നിങ്ങളുടെ ശരിയായ ഇമെയിൽ വിലാസമോ?`,
        success: `നിങ്ങളുടെ ഇമെയിൽ ${transcript} ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`,
        error: "കൃപയാ സാധുവായ ഇമെയിൽ വിലാസം നല്കുക (ഉ.ദാ: name@example.com).",
      },
      kn: {
        confirm: `ನಾನು "${transcript}" ಕೇಳಿದೆ. ಇದು ನಿಮ್ಮ ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸವೇ?`,
        success: `ನಿಮ್ಮ ಇಮೇಲ್ ${transcript} ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.`,
        error: "ದಯವಿಟ್ಟು ಮಾನ್ಯ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನೀಡಿ (ಉ.ದಾ: name@example.com).",
      },
      mr: {
        confirm: `मी "${transcript}" ऐकले. हे तुमचा योग्य ईमेल आहे का?`,
        success: `तुमचा ईमेल ${transcript} म्हणून दाखल केला गेला आहे.`,
        error: "कृपया वैध ईमेल पत्ता द्या (उ.दा: name@example.com).",
      },
      bn: {
        confirm: `আমি "${transcript}" শুনেছি। এটি কি আপনার সঠিক ইমেল ঠিকানা?`,
        success: `আপনার ইমেল ${transcript} হিসাবে রেকর্ড করা হয়েছে।`,
        error:
          "দয়া করে একটি বৈধ ইমেল ঠিকানা প্রদান করুন (যেমন name@example.com)।",
      },
      gu: {
        confirm: `મેં "${transcript}" સાંભળ્યું. આ તમારું યોગ્ય ઇમેઇલ સરનામું છે?`,
        success: `તમારું ઇમેઇલ ${transcript} તરીકે રેકોર્ડ કરવામાં આવ્યું છે.`,
        error: "કૃપા કરીને માન્ય ઇમેઇલ સરનામું આપો (ઉ.દા: name@example.com).",
      },
      or: {
        confirm: `ମୁଁ "${transcript}" ଶୁଣିଛି। ଏହା ତୁମର ସଠିକ ଇମେଲ୍ ଠିକଣା?`,
        success: `ତୁମର ଇମେଲ୍ ${transcript} ଭାବରେ ରେକର୍ଡ କରାଯାଇଛି।`,
        error:
          "ଦୟାକରି ଏକ ବୈଧ ଇମେଲ୍ ଠିକଣା ପ୍ରଦାନ କରନ୍ତୁ (ଉ.ଦା: name@example.com)।",
      },
      pa: {
        confirm: `ਮੈਂ "${transcript}" ਸੁਣਿਆ। ਕੀ ਇਹ ਤੁਹਾਡਾ ਸਹੀ ਈਮੇਲ ਪਤਾ ਹੈ?`,
        success: `ਤੁਹਾਡਾ ਈਮੇਲ ${transcript} ਦੇ ਰੂਪ ਵਿੱਚ ਰਿਕਾਰਡ ਕੀਤਾ ਗਿਆ ਹੈ।`,
        error: "ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵੈਧ ਈਮੇਲ ਪਤਾ ਦਿਓ (ਜਿਵੇਂ name@example.com)।",
      },
      ur: {
        confirm: `میں نے "${transcript}" سنا ہے۔ کیا یہ آپ کا صحیح ای میل پتہ ہے؟`,
        success: `آپ کا ای میل ${transcript} کے طور پر ریکارڈ کیا گیا ہے۔`,
        error:
          "براہ کرم ایک درست ای میل پتہ فراہم کریں (مثلاً name@example.com)۔",
      },
    },
    phone: {
      en: {
        confirm: `I heard "${transcript}". Is this your correct phone number?`,
        success: `Your phone number has been recorded as ${transcript}.`,
        error: "Please provide a valid 10-digit phone number.",
      },
      hi: {
        confirm: `मैंने "${transcript}" सुना। क्या यह आपका सही फोन नंबर है?`,
        success: `आपका फोन नंबर ${transcript} के रूप में दर्ज किया गया है।`,
        error: "कृपया एक मान्य 10-अंकीय फोन नंबर प्रदान करें।",
      },
      te: {
        confirm: `నేను "${transcript}" విని. ఇది మీ సరైన ఫోన్ నంబర్?`,
        success: `మీ ఫోన్ నంబర్ ${transcript} గా నమోదు చేయబడింది.`,
        error: "దయచేసి చెల్లుబాటైన 10 అంకెల ఫోన్ నంబర్ ఇవ్వండి.",
      },
      ta: {
        confirm: `நான் "${transcript}" கேட்டேன். இது உங்கள் சரியான தொலைபேசி எண்ணா?`,
        success: `உங்கள் தொலைபேசி எண் ${transcript} என பதிவு செய்யப்பட்டது.`,
        error: "தயவுசெய்து சரியான 10 இலக்க தொலைபேசி எண்ணை வழங்கவும்.",
      },
      ml: {
        confirm: `ഞാൻ "${transcript}" കേട്ടു. ഇതാണ് നിങ്ങളുടെ ശരിയായ ഫോൺ നമ്പറോ?`,
        success: `നിങ്ങളുടെ ഫോൺ നമ്പർ ${transcript} ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`,
        error: "കൃപയാ സാധുവായ 10 അക്ക ഫോൺ നമ്പർ നല്കുക.",
      },
      kn: {
        confirm: `ನಾನು "${transcript}" ಕೇಳಿದೆ. ಇದು ನಿಮ್ಮ ಸರಿಯಾದ ಫೋನ್ ಸಂಖ್ಯೆಯೇ?`,
        success: `ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ${transcript} ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.`,
        error: "ದಯವಿಟ್ಟು ಮಾನ್ಯ 10 ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆಯನ್ನು ನೀಡಿ.",
      },
      mr: {
        confirm: `मी "${transcript}" ऐकले. हे तुमचा योग्य फोन नंबर आहे का?`,
        success: `तुमचा फोन नंबर ${transcript} म्हणून दाखल केला गेला आहे.`,
        error: "कृपया वैध 10-अंकीय फोन नंबर द्या.",
      },
      bn: {
        confirm: `আমি "${transcript}" শুনেছি। এটি কি আপনার সঠিক ফোন নম্বর?`,
        success: `আপনার ফোন নম্বর ${transcript} হিসাবে রেকর্ড করা হয়েছে।`,
        error: "দয়া করে একটি বৈধ 10-অঙ্কের ফোন নম্বর প্রদান করুন।",
      },
      gu: {
        confirm: `મેં "${transcript}" સાંભળ્યું. આ તમારો યોગ્ય ફોન નંબર છે?`,
        success: `તમારો ફોન નંબર ${transcript} તરીકે રેકોર્ડ કરવામાં આવ્યો છે.`,
        error: "કૃપા કરીને માન્ય 10-અંકનો ફોન નંબર આપો.",
      },
      or: {
        confirm: `ମୁଁ "${transcript}" ଶୁଣିଛି। ଏହା ତୁମର ସଠିକ ଫୋନ୍ ନମ୍ବର?`,
        success: `ତୁମର ଫୋନ୍ ନମ୍ବର ${transcript} ଭାବରେ ରେକର୍ଡ କରାଯାଇଛି।`,
        error: "ଦୟାକରି ଏକ ବୈଧ 10-ଅଙ୍କ ଫୋନ୍ ନମ୍ବର ପ୍ରଦାନ କରନ୍ତୁ।",
      },
      pa: {
        confirm: `ਮੈਂ "${transcript}" ਸੁਣਿਆ। ਕੀ ਇਹ ਤੁਹਾਡਾ ਸਹੀ ਫੋਨ ਨੰਬਰ ਹੈ?`,
        success: `ਤੁਹਾਡਾ ਫੋਨ ਨੰਬਰ ${transcript} ਦੇ ਰੂਪ ਵਿੱਚ ਰਿਕਾਰਡ ਕੀਤਾ ਗਿਆ ਹੈ।`,
        error: "ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵੈਧ 10-ਅੰਕੀ ਫੋਨ ਨੰਬਰ ਦਿਓ।",
      },
      ur: {
        confirm: `میں نے "${transcript}" سنا ہے۔ کیا یہ آپ کا صحیح فون نمبر ہے؟`,
        success: `آپ کا فون نمبر ${transcript} کے طور پر ریکارڈ کیا گیا ہے۔`,
        error: "براہ کرم ایک درست 10 ہندسوں کا فون نمبر فراہم کریں۔",
      },
    },
    address: {
      en: {
        confirm: `I heard "${transcript}". Is this your correct address?`,
        success: `Your address has been recorded as ${transcript}.`,
        error: "Please provide a complete address with at least 10 characters.",
      },
      hi: {
        confirm: `मैंने "${transcript}" सुना। क्या यह आपका सही पता है?`,
        success: `आपका पता ${transcript} के रूप में दर्ज किया गया है।`,
        error: "कृपया कम से कम 10 वर्णों वाला एक संपूर्ण पता प्रदान करें।",
      },
      te: {
        confirm: `నేను "${transcript}" విని. ఇది మీ సరైన చిరునామా?`,
        success: `మీ చిరునామా ${transcript} గా నమోదు చేయబడింది.`,
        error: "దయచేసి కనీసం 10 అక్షరాలు కలిగిన పూర్తి చిరునామా ఇవ్వండి.",
      },
      ta: {
        confirm: `நான் "${transcript}" கேட்டேன். இது உங்கள் சரியான முகவரியா?`,
        success: `உங்கள் முகவரி ${transcript} என பதிவு செய்யப்பட்டது.`,
        error:
          "தயவுசெய்து குறைந்தபட்சம் 10 எழுத்துக்கள் கொண்ட முழுமையான முகவரியை வழங்கவும்.",
      },
      ml: {
        confirm: `ഞാൻ "${transcript}" കേട്ടു. ഇതാണ് നിങ്ങളുടെ ശരിയായ വിലാസമോ?`,
        success: `നിങ്ങളുടെ വിലാസം ${transcript} ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`,
        error: "കൃപയാ കുറഞ്ഞത് 10 അക്ഷരങ്ങളുള്ള പൂർണ്ണ വിലാസം നല്കുക.",
      },
      kn: {
        confirm: `ನಾನು "${transcript}" ಕೇಳಿದೆ. ಇದು ನಿಮ್ಮ ಸರಿಯಾದ ವಿಳಾಸವೇ?`,
        success: `ನಿಮ್ಮ ವಿಳಾಸವನ್ನು ${transcript} ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.`,
        error:
          "ದಯವಿಟ್ಟು ಕನಿಷ್ಠ 10 ಅಕ್ಷರಗಳನ್ನು ಹೊಂದಿರುವ ಸಂಪೂರ್ಣ ವಿಳಾಸವನ್ನು ನೀಡಿ.",
      },
      mr: {
        confirm: `मी "${transcript}" ऐकले. हे तुमचा योग्य पत्ता आहे का?`,
        success: `तुमचा पत्ता ${transcript} म्हणून दाखल केला गेला आहे.`,
        error: "कृपया किमान 10 वर्ण असलेला संपूर्ण पत्ता द्या.",
      },
      bn: {
        confirm: `আমি "${transcript}" শুনেছি। এটি কি আপনার সঠিক ঠিকানা?`,
        success: `আপনার ঠিকানা ${transcript} হিসাবে রেকর্ড করা হয়েছে।`,
        error:
          "দয়া করে কমপক্ষে 10 টি অক্ষর সহ একটি সম্পূর্ণ ঠিকানা প্রদান করুন।",
      },
      gu: {
        confirm: `મેં "${transcript}" સાંભળ્યું. આ તમારું યોગ્ય સરનામું છે?`,
        success: `તમારું સરનામું ${transcript} તરીકે રેકોર્ડ કરવામાં આવ્યું છે.`,
        error: "કૃપા કરીને ઓછામાં ઓછા 10 અક્ષરો સાથે સંપૂર્ણ સરનામું આપો.",
      },
      or: {
        confirm: `ମୁଁ "${transcript}" ଶୁଣିଛି। ଏହା ତୁମର ସଠିକ ଠିକଣା?`,
        success: `ତୁମର ଠିକଣା ${transcript} ଭାବରେ ରେକର୍ଡ କରାଯାଇଛି।`,
        error: "ଦୟାକରି ଅତିକମରେ 10 ଅକ୍ଷର ସହ ଏକ ସଂପୂର୍ଣ୍ଣ ଠିକଣା ପ୍ରଦାନ କରନ୍ତୁ।",
      },
      pa: {
        confirm: `ਮੈਂ "${transcript}" ਸੁਣਿਆ। ਕੀ ਇਹ ਤੁਹਾਡਾ ਸਹੀ ਪਤਾ ਹੈ?`,
        success: `ਤੁਹਾਡਾ ਪਤਾ ${transcript} ਦੇ ਰੂਪ ਵਿੱਚ ਰਿਕਾਰਡ ਕੀਤਾ ਗਿਆ ਹੈ।`,
        error: "ਕਿਰਪਾ ਕਰਕੇ ਘੱਟੋ-ਘੱਟ 10 ਅੱਖਰਾਂ ਵਾਲਾ ਪੂਰਾ ਪਤਾ ਦਿਓ।",
      },
      ur: {
        confirm: `میں نے "${transcript}" سنا ہے۔ کیا یہ آپ کا صحیح پتہ ہے؟`,
        success: `آپ کا پتہ ${transcript} کے طور پر ریکارڈ کیا گیا ہے۔`,
        error: "براہ کرم کم از کم 10 حروف کے ساتھ مکمل پتہ فراہم کریں۔",
      },
    },
    gender: {
      en: {
        confirm: `I heard "${transcript}". Is this your correct gender?`,
        success: `Your gender has been recorded as ${transcript}.`,
        error: "Please provide a valid gender (Male, Female, or Other).",
      },
      hi: {
        confirm: `मैंने "${transcript}" सुना। क्या यह आपका सही लिंग है?`,
        success: `आपका लिंग ${transcript} के रूप में दर्ज किया गया है।`,
        error: "कृपया एक मान्य लिंग प्रदान करें (पुरुष, महिला, या अन्य)।",
      },
      te: {
        confirm: `నేను "${transcript}" విని. ఇది మీ సరైన లింగం?`,
        success: `మీ లింగం ${transcript} గా నమోదు చేయబడింది.`,
        error:
          "దయచేసి చెల్లుబాటైన లింగం ఇవ్వండి (పురుషుడు, స్త్రీ, లేదా ఇతరులు).",
      },
      ta: {
        confirm: `நான் "${transcript}" கேட்டேன். இது உங்கள் சரியான பாலினமா?`,
        success: `உங்கள் பாலினம் ${transcript} என பதிவு செய்யப்பட்டது.`,
        error: "தயவுசெய்து சரியான பாலினத்தை வழங்கவும் (ஆண், பெண், அல்லது பிற).",
      },
      ml: {
        confirm: `ഞാൻ "${transcript}" കേട്ടു. ഇതാണ് നിങ്ങളുടെ ശരിയായ ലിംഗമോ?`,
        success: `നിങ്ങളുടെ ലിംഗം ${transcript} ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`,
        error:
          "കൃപയാ സാധുവായ ലിംഗം നല്കുക (പുരുഷൻ, സ്ത്രീ, അല്ലെങ്കിൽ മറ്റുള്ളവ).",
      },
      kn: {
        confirm: `ನಾನು "${transcript}" ಕೇಳಿದೆ. ಇದು ನಿಮ್ಮ ಸರಿಯಾದ ಲಿಂಗವೇ?`,
        success: `ನಿಮ್ಮ ಲಿಂಗವನ್ನು ${transcript} ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.`,
        error: "ದಯವಿಟ್ಟು ಮಾನ್ಯ ಲಿಂಗವನ್ನು ನೀಡಿ (ಪುರುಷ, ಸ್ತ್ರೀ, ಅಥವಾ ಇತರರು).",
      },
      mr: {
        confirm: `मी "${transcript}" ऐकले. हे तुमचे योग्य लिंग आहे का?`,
        success: `तुमचे लिंग ${transcript} म्हणून दाखल केले गेले आहे.`,
        error: "कृपया वैध लिंग द्या (पुरुष, स्त्री, किंवा इतर).",
      },
      bn: {
        confirm: `আমি "${transcript}" শুনেছি। এটি কি আপনার সঠিক লিঙ্গ?`,
        success: `আপনার লিঙ্গ ${transcript} হিসাবে রেকর্ড করা হয়েছে।`,
        error:
          "দয়া করে একটি বৈধ লিঙ্গ প্রদান করুন (পুরুষ, মহিলা, বা অন্যান্য)।",
      },
      gu: {
        confirm: `મેં "${transcript}" સાંભળ્યું. આ તમારું યોગ્ય લિંગ છે?`,
        success: `તમારું લિંગ ${transcript} તરીકે રેકોર્ડ કરવામાં આવ્યું છે.`,
        error: "કૃપા કરીને માન્ય લિંગ આપો (પુરુષ, સ્ત્રી, અથવા અન્ય).",
      },
      or: {
        confirm: `ମୁଁ "${transcript}" ଶୁଣିଛି। ଏହା ତୁମର ସଠିକ ଲିଙ୍ଗ?`,
        success: `ତୁମର ଲିଙ୍ଗ ${transcript} ଭାବରେ ରେକର୍ଡ କରାଯାଇଛି।`,
        error:
          "ଦୟାକରି ଏକ ବୈଧ ଲିଙ୍ଗ ପ୍ରଦାନ କରନ୍ତୁ (ପୁରୁଷ, ସ୍ତ୍ରୀ, କିମ୍ବା ଅନ୍ୟ)।",
      },
      pa: {
        confirm: `ਮੈਂ "${transcript}" ਸੁਣਿਆ। ਕੀ ਇਹ ਤੁਹਾਡਾ ਸਹੀ ਲਿੰਗ ਹੈ?`,
        success: `ਤੁਹਾਡਾ ਲਿੰਗ ${transcript} ਦੇ ਰੂਪ ਵਿੱਚ ਰਿਕਾਰਡ ਕੀਤਾ ਗਿਆ ਹੈ।`,
        error: "ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਵੈਧ ਲਿੰਗ ਦਿਓ (ਪੁਰਸ਼, ਔਰਤ, ਜਾਂ ਹੋਰ)।",
      },
      ur: {
        confirm: `میں نے "${transcript}" سنا ہے۔ کیا یہ آپ کی صحیح جنس ہے؟`,
        success: `آپ کی جنس ${transcript} کے طور پر ریکارڈ کی گئی ہے۔`,
        error: "براہ کرم ایک درست جنس فراہم کریں (مرد، عورت، یا دیگر)۔",
      },
    },
    dob: {
      en: {
        confirm: `I heard "${transcript}". Is this your correct date of birth?`,
        success: `Your date of birth has been recorded as ${transcript}.`,
        error: "Please provide a valid date of birth (e.g., 15 August 1990).",
      },
      hi: {
        confirm: `मैंने "${transcript}" सुना। क्या यह आपकी सही जन्म तारीख है?`,
        success: `आपकी जन्म तारीख ${transcript} के रूप में दर्ज की गई है।`,
        error: "कृपया एक मान्य जन्म तारीख प्रदान करें (जैसे 15 अगस्त 1990)।",
      },
      te: {
        confirm: `నేను "${transcript}" విని. ఇది మీ సరైన జన్మ తేదీ?`,
        success: `మీ జన్మ తేదీ ${transcript} గా నమోదు చేయబడింది.`,
        error: "దయచేసి చెల్లుబాటైన జన్మ తేదీ ఇవ్వండి (ఉదా: 15 ఆగస్టు 1990).",
      },
      ta: {
        confirm: `நான் "${transcript}" கேட்டேன். இது உங்கள் சரியான பிறந்த தேதிதா?`,
        success: `உங்கள் பிறந்த தேதி ${transcript} என பதிவு செய்யப்பட்டது.`,
        error:
          "தயவுசெய்து சரியான பிறந்த தேதியை வழங்கவும் (உ.ம:ஆ 15 ஆகஸ்ட் 1990).",
      },
      ml: {
        confirm: `ഞാൻ "${transcript}" കേട്ടു. ഇതാണ് നിങ്ങളുടെ ശരിയായ ജന്മ തീയതിയോ?`,
        success: `നിങ്ങളുടെ ജന്മ തീയതി ${transcript} ആയി രേഖപ്പെടുത്തിയിരിക്കുന്നു.`,
        error: "കൃപയാ സാധുവായ ജന്മ തീയതി നല്കുക (ഉ.ദാ: 15 ഓഗസ്റ്റ് 1990).",
      },
      kn: {
        confirm: `ನಾನು "${transcript}" ಕೇಳಿದೆ. ಇದು ನಿಮ್ಮ ಸರಿಯಾದ ಜನ್ಮ ದಿನಾಂಕವೇ?`,
        success: `ನಿಮ್ಮ ಜನ್ಮ ದಿನಾಂಕವನ್ನು ${transcript} ಎಂದು ದಾಖಲಿಸಲಾಗಿದೆ.`,
        error: "ದಯವಿಟ್ಟು ಮಾನ್ಯ ಜನ್ಮ ದಿನಾಂಕವನ್ನು ನೀಡಿ (ಉ.ದಾ: 15 ಆಗಸ್ಟ್ 1990).",
      },
      mr: {
        confirm: `मी "${transcript}" ऐकले. हे तुमची योग्य जन्मतारीख आहे का?`,
        success: `तुमची जन्मतारीख ${transcript} म्हणून दाखल केली गेली आहे.`,
        error: "कृपया वैध जन्मतारीख द्या (उ.दा: 15 ऑगस्ट 1990).",
      },
      bn: {
        confirm: `আমি "${transcript}" শুনেছি। এটি কি আপনার সঠিক জন্ম তারিখ?`,
        success: `আপনার জন্ম তারিখ ${transcript} হিসাবে রেকর্ড করা হয়েছে।`,
        error: "দয়া করে একটি বৈধ জন্ম তারিখ প্রদান করুন (যেমন 15 আগস্ট 1990)।",
      },
      gu: {
        confirm: `મેં "${transcript}" સાંભળ્યું. આ તમારી યોગ્ય જન્મ તારીખ છે?`,
        success: `તમારી જન્મ તારીખ ${transcript} તરીકે રેકોર્ડ કરવામાં આવી છે.`,
        error: "કૃપા કરીને માન્ય જન્મ તારીખ આપો (ઉ.દા: 15 ઓગસ્ટ 1990).",
      },
      or: {
        confirm: `ମୁଁ "${transcript}" ଶୁଣିଛି। ଏହା ତୁମର ସଠିକ ଜନ୍ମ ତିଥି?`,
        success: `ତୁମର ଜନ୍ମ ତିଥି ${transcript} ଭାବରେ ରେକର୍ଡ କରାଯାଇଛି।`,
        error: "ଦୟାକରି ଏକ ବୈଧ ଜନ୍ମ ତିଥି ପ୍ରଦାନ କରନ୍ତୁ (ଉ.ଦା: 15 ଅଗଷ୍ଟ 1990)।",
      },
      pa: {
        confirm: `ਮੈਂ "${transcript}" ਸੁਣਿਆ। ਕੀ ਇਹ ਤੁਹਾਡੀ ਸਹੀ ਜਨਮ ਤਾਰੀਖ ਹੈ?`,
        success: `ਤੁਹਾਡੀ ਜਨਮ ਤਾਰੀਖ ${transcript} ਦੇ ਤੌਰ 'ਤੇ ਦਰਜ ਕੀਤੀ ਗਈ ਹੈ।`,
        error: "ਕਿਰਪਾ ਕਰਕੇ ਵੈਧ ਜਨਮ ਤਾਰੀਖ ਦਿਓ (ਜਿਵੇਂ 15 ਅਗਸਤ 1990)।",
      },
      ur: {
        confirm: `میں نے "${transcript}" سنا ہے۔ کیا یہ آپ کی صحیح پیدائش کی تاریخ ہے؟`,
        success: `آپ کی پیدائش کی تاریخ ${transcript} کے طور پر ریکارڈ کی گئی ہے۔`,
        error: "براہ کرم درست پیدائش کی تاریخ فراہم کریں (مثلاً 15 اگست 1990)۔",
      },
    },
    // ... other docs
  };

  // Default responses for file uploads
  const fileFields = [
    "poi_file",
    "poa_file",
    "dob_file",
    "poi_doc",
    "poa_doc",
    "dob_doc",
    "doc_type",
    "citizen_proof",
    "address_proof",
    "hospital_doc",
    "parent_doc",
    "caste_proof_file",
    "income_proof_file",
    "income_proof_doc",
    "family_id_doc",
    "birth_cert_file",
    "id_proof_file",
    "address_proof_file",
  ];
  const fieldResponses = responses[fieldName] || responses["name"];
  const langResponses = fieldResponses[langCode] || fieldResponses["en"];

  let isValid = true;
  let action = "retry";
  let nextField: string | undefined;

  if (fileFields.includes(fieldName)) {
    return {
      response: "File field - please upload file directly.",
      isConfirmed: true,
      action: "proceed",
      nextField: undefined,
    };
  }

  // Trim and check if transcript is empty
  const trimmedTranscript = transcript.trim();

  if (!trimmedTranscript || trimmedTranscript.length === 0) {
    isValid = false;
  } else if (fieldName === "name" && trimmedTranscript.length < 2) {
    isValid = false;
  } else if (fieldName === "email" && !trimmedTranscript.includes("@")) {
    isValid = false;
  } else if (
    fieldName === "phone" &&
    !/^\d{10}$/.test(trimmedTranscript.replace(/\D/g, ""))
  ) {
    isValid = false;
  } else if (fieldName === "address" && trimmedTranscript.length < 10) {
    isValid = false;
  } else if (fieldName === "dob" && trimmedTranscript.length < 4) {
    isValid = false;
  } else if (fieldName === "gender") {
    const validGenders = [
      "male",
      "female",
      "other",
      "man",
      "woman",
      "m",
      "f",
      "masculino",
      "femenino",
      "पुरुष",
      "महिला",
      "अन्य",
    ];
    const lowerTranscript = trimmedTranscript.toLowerCase();
    if (!validGenders.some((gender) => lowerTranscript.includes(gender))) {
      isValid = false;
    }
  }

  let response: string;
  if (!isValid) {
    response = langResponses.error;
    action = "retry";
  } else {
    response = langResponses.confirm;
    action = "proceed";
  }

  return {
    response,
    isConfirmed: isValid,
    action,
    nextField,
  };
}

/**
 * GET handler for health check and voice prompt retrieval
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fieldName = searchParams.get("fieldName");
  const language = searchParams.get("language") || "en-IN";
  const translatedLabel = searchParams.get("translatedLabel");
  const englishPrompt = searchParams.get("englishPrompt");

  // If fieldName is provided, return the voice prompt for that field
  if (fieldName) {
    let voicePrompt = getVoicePrompt(fieldName, language, translatedLabel);
    
    // If the language is not English and we have an explicit English explanation,
    // translate the rich explanation dynamically for a better voice experience across all 55 applications.
    if (englishPrompt && !language.startsWith('en')) {
      try {
        console.log(`[API] Dynamically translating field explanation for ${fieldName} to ${language}`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Translate the following form instruction into the language with code '${language}'. The translation must be natural, polite, and conversational, just like a voice assistant asking a user for information. ONLY return the translated text without any quotes or extra explanation. Text: "${englishPrompt}"`;
        
        const result = await model.generateContent(prompt);
        const translatedText = result.response.text().trim();
        
        if (translatedText) {
          voicePrompt = translatedText;
          console.log(`[API] Translated ${fieldName}: "${englishPrompt}" -> "${voicePrompt}"`);
        }
      } catch (e) {
        console.error("[API] Translation error for voice prompt:", e);
      }
    }

    return NextResponse.json({
      success: true,
      fieldName,
      language,
      voicePrompt,
    });
  }

  // Otherwise, return health check
  return NextResponse.json({
    status: "ok",
    message: "Voice processing API is running",
  });
}

/**
 * POST handler for voice transcription processing
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let transcript = "";
    let language = "en-IN";
    let fieldName = "";
    let context = {};

    // Handle Multipart Form Data (Audio File)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("audio") as File;
      fieldName = formData.get("fieldName") as string;
      language = (formData.get("language") as string) || "en-IN";

      if (!file) {
        return NextResponse.json(
          { success: false, error: "No audio file provided" },
          { status: 400 },
        );
      }

      // Transcribe using Gemini
      console.log("[API] Transcribing audio with Gemini...");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const arrayBuffer = await file.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString("base64");

      const prompt = `Transcribe the following audio accurately in the language: ${language}. Return ONLY the transcribed text, nothing else.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: file.type || "audio/webm",
            data: base64Audio,
          },
        },
      ]);

      transcript = result.response.text().trim();
      console.log("[API] Transcription result:", transcript);
    } else {
      // Handle JSON (Direct Text)
      const body = await request.json();
      transcript = body.transcript;
      language = body.language || "en-IN";
      fieldName = body.fieldName;
      context = body.context;

      // OPTIONAL BUT VITAL: Use Gemini to normalize spoken dates, emails, phones, and Aadhaar into strictly formatted strings.
      // IMPORTANT: Only normalize fields that benefit from it. NEVER reformat name fields.
      const NAME_FIELD_IDS = ['name', 'owner', 'father', 'mother', 'husband', 'guardian', 'applicant', 'spouse', 'nominee'];
      const isNameField = NAME_FIELD_IDS.some(k => fieldName.toLowerCase().includes(k));

      const NORMALIZE_FIELDS = ['dob', 'date', 'email', 'phone', 'mobile', 'aadhaar', 'aadhar', 'pan', 'pincode', 'ifsc', 'gstin', 'uan'];
      const shouldNormalize = !isNameField && NORMALIZE_FIELDS.some(k => fieldName.toLowerCase().includes(k));

      if (shouldNormalize && transcript) {
        try {
          console.log(`[API] Using Gemini to normalize '${fieldName}' from transcript: ${transcript}`);
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          let prompt = `Extract the core information from this spoken transcript: "${transcript}". `;

          if (fieldName.includes('dob') || fieldName.includes('date'))
            prompt += `Format it STRICTLY as YYYY-MM-DD. For example, "18th September 2004" becomes "2004-09-18". Return NOTHING ELSE but the formatted date.`;
          else if (fieldName.includes('email'))
            prompt += `Format as a standard email address. Convert words like 'at' to @ and 'dot' to . Make it fully lowercase. Return NOTHING ELSE but the email.`;
          else if (fieldName.includes('phone') || fieldName.includes('mobile'))
            prompt += `Extract just the 10 digits of the Indian mobile number. Remove all spaces and non-digits. Return NOTHING ELSE but the 10 digits.`;
          else if (fieldName.includes('aadhaar') || fieldName.includes('aadhar'))
            prompt += `Extract just the 12 digits of the Aadhaar number. Remove all spaces. Return NOTHING ELSE but the 12 digits.`;
          else if (fieldName.includes('pan'))
            prompt += `The PAN card format is 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F). Extract and format this. Return NOTHING ELSE in uppercase.`;
          else if (fieldName.includes('pincode'))
            prompt += `Extract just the 6-digit PIN code. Return NOTHING ELSE but the 6 digits.`;
          else if (fieldName.includes('ifsc'))
            prompt += `The IFSC code is 4 letters + 0 + 6 alphanumeric characters (e.g. SBIN0001234). Return it in uppercase. Return NOTHING ELSE.`;
          else if (fieldName.includes('gstin'))
            prompt += `Format as a standard GSTIN (15 chars). Return in UPPERCASE. Return NOTHING ELSE.`;
          else if (fieldName.includes('uan'))
            prompt += `Extract just the 12-digit UAN number. Return NOTHING ELSE but the digits.`;
          else
            prompt += `Return only the extracted value with no explanation.`;

          const result = await model.generateContent(prompt);
          let formatted = result.response.text().trim();

          // Apply lowercase ONLY for email — never for other fields
          if (fieldName.includes('email')) {
            formatted = formatted.toLowerCase();
          }

          if (formatted) {
            console.log(`[API] Gemini normalized ${fieldName}: "${transcript}" -> "${formatted}"`);
            transcript = formatted;
          }
        } catch (e) {
          console.error('[API] Failed to use Gemini to re-format', e);
        }
      } else if (!isNameField && !shouldNormalize && transcript) {
        // For other text fields (address, occupation etc.) — minor cleanup only
        // Trim but preserve original casing
        transcript = transcript.trim();
      }
    }

    // Validate request
    if (!transcript || !fieldName) {
      return NextResponse.json(
        {
          success: false,
          error: "transcript and fieldName are required",
        } as VoiceProcessResponse,
        { status: 400 },
      );
    }

    // Get backend response logic
    const backendResponse = getBackendResponse(
      transcript,
      language,
      fieldName,
      context,
    );

    // Get voice prompt for this field
    const voicePrompt = getVoicePrompt(fieldName, language);

    const responseData: VoiceProcessResponse = {
      success: true,
      response: backendResponse.response,
      isConfirmed: backendResponse.isConfirmed,
      action: backendResponse.action,
      nextField: backendResponse.nextField,
      transcript: transcript,
      voicePrompt: voicePrompt,
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("[Voice API] Error processing voice:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process voice input",
      } as VoiceProcessResponse,
      { status: 500 },
    );
  }
}
