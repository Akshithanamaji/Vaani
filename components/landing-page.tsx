'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, QrCode, Shield, Users, Languages, ArrowRight, CheckCircle2 } from 'lucide-react';

// Falling animation keyframes
const FALLING_ANIMATION = `
  @keyframes fallDown {
    0% {
      opacity: 0;
      transform: translateY(-100vh) rotate(10deg) scale(0.5);
    }
    60% {
      opacity: 1;
      transform: translateY(10px) rotate(-2deg) scale(1.05);
    }
    80% {
      transform: translateY(-5px) rotate(1deg) scale(0.98);
    }
    100% {
      opacity: 1;
      transform: translateY(0) rotate(0) scale(1);
    }
  }

  .card-fall {
    animation: fallDown 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    opacity: 0;
  }
`;

interface Language {
  code: 'en' | 'hi' | 'te' | 'kn' | 'ta' | 'ml' | 'mr' | 'bn' | 'gu' | 'or' | 'pa' | 'ur';
  name: string;
  nativeName: string;
  flag: string;
}

interface LandingPageProps {
  onGetStarted: () => void;
  onStartSpeaking: () => void;
  selectedLanguage: Language | null;
}

// Voice instructions — ULTRA SHORT to stay under Google TTS URL limit.
// Indian script chars encode to 6-9 bytes each, so keep under ~30 native chars.
const voiceInstructions: Record<string, string> = {
  en: 'Welcome to Vaani AI. Select your language to begin.',
  hi: 'वाणी AI में स्वागत। भाषा चुनें और शुरू करें।',
  te: 'వాది AI కి స్వాగతం. భాష ఎంచుకోండి.',
  ta: 'வாணி AI வரவேற்கிறோம். மொழி தேர்ந்தெடுக்கவும்.',
  ml: 'വാണി AIലേക്കു സ്വാഗതം. ഭാഷ തിരഞ്ഞെടുക്കൂ.',
  kn: 'ವಾಣಿ AIಗೆ ಸ್ವಾಗತ. ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ.',
  mr: 'वाणी AI मध्ये स्वागत. भाषा निवडा.',
  bn: 'ভানী AIতে স্বাগতম। ভাষা বেছে নিন।',
  gu: 'વાણી AIમાં સ્વાગત. ભાષા પસંદ કરો.',
  or: 'ଭାଣୀ AIରେ ସ୍ୱାଗତ। ଭାଷା ବାଛନ୍ତୁ।',
  pa: 'ਵਾਣੀ AIਵਿੱਚ ਸੁਆਗਤ। ਭਾਸ਼ਾ ਚੁਣੋ।',
  ur: 'وانی AI میں خوش آمدید۔ زبان چنیں۔',
};

// Language confirmation messages in all 12 languages
const languageConfirmationMessages: Record<string, Record<string, string>> = {
  en: {
    en: 'You have selected English.',
    hi: 'You have selected Hindi.',
    te: 'You have selected Telugu.',
    kn: 'You have selected Kannada.',
    ta: 'You have selected Tamil.',
    ml: 'You have selected Malayalam.',
    mr: 'You have selected Marathi.',
    bn: 'You have selected Bengali.',
    gu: 'You have selected Gujarati.',
    or: 'You have selected Odia.',
    pa: 'You have selected Punjabi.',
    ur: 'You have selected Urdu.',
  },
  hi: {
    en: 'आपने अंग्रेजी चुनी है।',
    hi: 'आपने हिंदी चुनी है।',
    te: 'आपने तेलुगु चुनी है।',
    kn: 'आपने कन्नड़ चुनी है।',
    ta: 'आपने तमिल चुनी है।',
    ml: 'आपने मलयालम चुनी है।',
    mr: 'आपने मराठी चुनी है।',
    bn: 'आपने बंगाली चुनी है।',
    gu: 'आपने गुजराती चुनी है।',
    or: 'आपने ओडिया चुनी है।',
    pa: 'आपने पंजाबी चुनी है।',
    ur: 'आपने उर्दू चुनी है।',
  },
  te: {
    en: 'మీరు ఆంగ్లభాషను ఎంచుకున్నారు.',
    hi: 'మీరు హిందీను ఎంచుకున్నారు.',
    te: 'మీరు తెలుగుని ఎంచుకున్నారు.',
    kn: 'మీరు కన్నడను ఎంచుకున్నారు.',
    ta: 'మీరు తమిళ్లను ఎంచుకున్నారు.',
    ml: 'మీరు మలయాళ్లను ఎంచుకున్నారు.',
    mr: 'మీరు మరాఠీని ఎంచుకున్నారు.',
    bn: 'మీరు బెంగాలీని ఎంచుకున్నారు.',
    gu: 'మీరు గుజరాతీని ఎంచుకున్నారు.',
    or: 'మీరు ఓడియాని ఎంచుకున్నారు.',
    pa: 'మీరు పంజాబీని ఎంచుకున్నారు.',
    ur: 'మీరు ఉర్దూను ఎంచుకున్నారు.',
  },
  ta: {
    en: 'நீங்கள் ஆங்கிலத்தை தேர்ந்தெடுத்தீர்கள்.',
    hi: 'நீங்கள் இந்தியைத் தேர்ந்தெடுத்தீர்கள்.',
    te: 'நீங்கள் తెలుగుவைத் தேர்ந்தெடுத்தீர்கள்.',
    kn: 'நீங்கள் கன্నடத்தை தேர்ந்தெடுத்தீர்கள்.',
    ta: 'நீங்கள் தமிழத்தை தேர்ந்தெடுத்தீர்கள்.',
    ml: 'நீங்கள் മലയാളத്தை தேர்ந்தெடுத்தீர்கள்.',
    mr: 'நீங்கள் मराठीஐ தேர்ந்தெடுத்தீர்கள்.',
    bn: 'நீங்கள் బెంగാలીஐ தேர்ந்தெடுத்தீர்கள்.',
    gu: 'நீங்கள் ગુજરાતીஐ தேர்ந்தெடுத்தீர்கள்.',
    or: 'நீங்கள் ଓଡ଼ିଆஐ தேர்ந்தெடுத்தீர்கள்.',
    pa: 'நீங்கள் ਪੰਜਾਬੀஐ தேர்ந்தெடுத்தீர்கள்.',
    ur: 'நீங்கள் اردوஐ தேர்ந்தெடுத்தீர்கள்.',
  },
  kn: {
    en: 'ನೀವು ಇಂಗ್ಲಿಷ್ ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    hi: 'ನೀವು ಹಿಂದಿ ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    te: 'ನೀವು తెలుగు ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    kn: 'ನೀವು ಕನ್ನಡ ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    ta: 'ನೀವು ತಮಿಳು ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    ml: 'ನೀವು മലയാളം ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    mr: 'ನೀವು मराठी ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    bn: 'ನೀವು বাঙ্গালি ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    gu: 'ನೀವು ગુજરાતી ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    or: 'ನೀವು ଓଡ଼ିଆ ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    pa: 'ನೀವು ਪੰਜਾਬੀ ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
    ur: 'ನೀವು اردو ಆಯ್ಕೆ ಮಾಡಿದ್ದೀರಿ.',
  },
  ml: {
    en: 'നിങ്ങൾ ഇംഗ്ലീഷ് തിരഞ്ഞെടുത്തു.',
    hi: 'നിങ്ങൾ ഹിന്ദി തിരഞ്ഞെടുത്തു.',
    te: 'നിങ്ങൾ തെലുഗു തിരഞ്ഞെടുത്തു.',
    kn: 'നിങ്ങൾ കന്നഡ തിരഞ്ഞെടുത്തു.',
    ta: 'നിങ്ങൾ തമിഴ് തിരഞ്ഞെടുത്തു.',
    ml: 'നിങ്ങൾ മലയാളം തിരഞ്ഞെടുത്തു.',
    mr: 'നിങ്ങൾ മരാഠി തിരഞ്ഞെടുത്തു.',
    bn: 'നിങ്ങൾ ബംഗാളി തിരഞ്ഞെടുത്തു.',
    gu: 'നിങ്ങൾ ഗുജറാതി തിരഞ്ഞെടുത്തു.',
    or: 'നിങ്ങൾ ഒഡിയ തിരഞ്ഞെടുത്തു.',
    pa: 'നിങ്ങൾ പഞ്ജാബി തിരഞ്ഞെടുത്തു.',
    ur: 'നിങ്ങൾ ഉർദു തിരഞ്ഞെടുത്തു.',
  },
  mr: {
    en: 'आपने इंग्रजी निवडली आहे.',
    hi: 'आपने हिंदी निवडली आहे.',
    te: 'आपने తెలుగు निवडली आहे.',
    kn: 'आपने कन्नड़ निवडली आहे.',
    ta: 'आपने तमिल निवडली आहे.',
    ml: 'आपने मलयालम निवडली आहे.',
    mr: 'आपने मराठी निवडली आहे.',
    bn: 'आपने बंगाली निवडली आहे.',
    gu: 'आपने गुजराती निवडली आहे.',
    or: 'आपने ओड़िया निवडली आहे.',
    pa: 'आपने पंजाबी निवडली आहे.',
    ur: 'आपने उर्दू निवडली आहे.',
  },
  bn: {
    en: 'আপনি ইংরেজি নির্বাচন করেছেন।',
    hi: 'আপনি হিন্দি নির্বাচন করেছেন।',
    te: 'আপনি తెలుగు নির্বাচন করেছেন।',
    kn: 'আপনি ಕನ್ನಡ নির্বাচন করেছেন।',
    ta: 'আপনি தமிழ் নির্বাচন করেছেন।',
    ml: 'আপনি മലയാളം নির্বাচন করেছেন।',
    mr: 'আপনি मराठी নির্বাচন করেছেন।',
    bn: 'আপনি বাংলা নির্বाচন করেছেন।',
    gu: 'আপনি ગુજરાતી নির্বাচন করেছেন।',
    or: 'আপনি ଓଡ଼ିଆ নির্বাচন করেছেন।',
    pa: 'আপনি ਪੰਜਾਬੀ নির্বাচন করেছেন।',
    ur: 'আপনি اردو নির্বाচন করেছেন।',
  },
  gu: {
    en: 'તમે અંગ્રેજી પસંદ કરી છે.',
    hi: 'તમે હિંદી પસંદ કરી છે.',
    te: 'તમે తెలుగు પસંદ કરી છે.',
    kn: 'તમે ಕನ್ನಡ પસંદ કરી છે.',
    ta: 'તમે தமிழ் પસંદ કરી છે.',
    ml: 'તમે മലയാളം પસંદ કરી છે.',
    mr: 'તમે मराठी પસંદ કરી છે.',
    bn: 'તમે বাংলা પસંદ કરી છે.',
    gu: 'તમે ગુજરાતી પસંદ કરી છે.',
    or: 'તમે ଓଡ଼ିଆ પસંદ કરી છે.',
    pa: 'તમે ਪੰਜਾਬੀ પસંદ કરી છે.',
    ur: 'તમે اردو પસંદ કરી છે.',
  },
  or: {
    en: 'ଆପଣ ଇଂରେଜୀ ବାଛିଛନ୍ତି।',
    hi: 'ଆପଣ ହିଂଦୀ ବାଛିଛନ୍ତି।',
    te: 'ଆପଣ తెలుగు ବାଛିଛନ୍ତି।',
    kn: 'ଆପଣ ಕನ್ನಡ ବାଛିଛନ୍ତି।',
    ta: 'ଆପଣ தமிழ் ବାଛିଛନ୍ତି।',
    ml: 'ଆପଣ മലയാളം ବାଛିଛନ୍ତି।',
    mr: 'ଆପଣ मराठी ବାଛିଛନ୍ତି।',
    bn: 'ଆପଣ বাংলা ବାଛିଛନ୍ତି।',
    gu: 'ଆପଣ ગુજરાતી ବାଛିଛନ୍ତି।',
    or: 'ଆପଣ ଓଡ଼ିଆ ବାଛିଛନ୍ତି।',
    pa: 'ଆପଣ ਪੰਜਾਬੀ ବାଛିଛନ୍ତି।',
    ur: 'ଆପଣ اردو ବାଛିଛନ୍ତି।',
  },
  pa: {
    en: 'ਤੁਸੀਂ ਅੰਗਰੇਜ਼ੀ ਚੁਣੀ ਹੈ।',
    hi: 'ਤੁਸੀਂ ਹਿੰਦੀ ਚੁਣੀ ਹੈ।',
    te: 'ਤੁਸੀਂ తెలుగు ਚੁਣੀ ਹੈ।',
    kn: 'ਤੁਸੀਂ ಕನ್ನಡ ਚੁਣੀ ਹੈ।',
    ta: 'ਤੁਸੀਂ தமிழ் ਚੁਣੀ ਹੈ।',
    ml: 'ਤੁਸੀਂ മലയാളം ਚੁਣੀ ਹੈ।',
    mr: 'ਤੁਸੀਂ मराठी ਚੁਣੀ ਹੈ।',
    bn: 'ਤੁਸੀਂ বাংলা ਚੁਣੀ ਹੈ।',
    gu: 'ਤੁਸੀਂ ગુજરાતી ਚੁਣੀ ਹੈ।',
    or: 'ਤੁਸੀਂ ଓଡ଼ିଆ ਚੁਣੀ ਹੈ।',
    pa: 'ਤੁਸੀਂ ਪੰਜਾਬੀ ਚੁਣੀ ਹੈ।',
    ur: 'ਤੁਸੀਂ اردو ਚੁਣੀ ਹੈ।',
  },
  ur: {
    en: 'آپ نے انگریزی منتخب کی ہے۔',
    hi: 'آپ نے ہندی منتخب کی ہے۔',
    te: 'آپ نے تیلگو منتخب کی ہے۔',
    kn: 'آپ نے کنڑ منتخب کی ہے۔',
    ta: 'آپ نے تمل منتخب کی ہے۔',
    ml: 'آپ نے مالابار منتخب کی ہے۔',
    mr: 'آپ نے مراٹھی منتخب کی ہے۔',
    bn: 'آپ نے بنگالی منتخب کی ہے۔',
    gu: 'آپ نے گجراتی منتخب کی ہے۔',
    or: 'آپ نے اوڑیا منتخب کی ہے۔',
    pa: 'آپ نے پنجابی منتخب کی ہے۔',
    ur: 'آپ نے اردو منتخب کی ہے۔',
  },
};

const landingLabels = {
  en: {
    title: 'Voice-Powered Government Forms',
    subtitle: 'Fill government forms in your local language using just your voice.',
    startSpeaking: 'Start Speaking',
    getStarted: 'Get Started',
    learnMore: 'Learn More',
    digitalIndia: 'Digital India Initiative',
    secure: 'Secure',
    whyVaani: 'Why Vaani Ai?',
    breakingBarriers: 'Breaking literacy barriers with voice technology',
    howItWorks: 'How It Works',
    readyStarted: 'Ready to Get Started?',
    startNow: 'Get Started Now',
    noTyping: 'No typing. No literacy barriers. No agents.',
    languages: 'Languages',
    qrValidity: 'QR Expires',
    qrValidityValue: 'Application Done',
    // Why Vaani AI cards
    voiceFirstTitle: 'Voice-First Interface',
    voiceFirstDesc: 'Speak in Hindi, Telugu, Tamil, Bengali, or English. No typing required.',
    multiLangTitle: 'Multi-Language Support',
    multiLangDesc: 'Support for 5+ Indian languages with accurate speech recognition.',
    secureTitle: 'Secure & Private',
    secureDesc: 'End-to-end encryption. QR code expires once the admin marks your application as completed.',
    qrTitle: 'Instant QR Generation',
    qrDesc: 'Get your unique QR code instantly. Officers can scan and print.',
    noMiddleTitle: 'No Middlemen',
    noMiddleDesc: 'Direct access. No agents, no fees, no exploitation.',
    easyTitle: 'Easy for Everyone',
    easyDesc: 'Designed for rural, elderly, and low-literacy citizens.',
    // How It Works
    stepsSubtitle: 'Three simple steps to fill your government form',
    step1Title: 'Speak Your Details',
    step1Desc: 'Choose your language and speak your information naturally. Our AI understands your voice.',
    step2Title: 'Review & Confirm',
    step2Desc: 'Check the auto-filled form. Make any corrections if needed.',
    step3Title: 'Get QR Code',
    step3Desc: 'Receive a unique QR code. Show it to the officer to print your form instantly.',
    // CTA Section
    ctaText: 'Join thousands of citizens using Vaani Ai for hassle-free government services',
  },
  hi: {
    title: 'वॉयस-पावर्ड सरकारी फॉर्म',
    subtitle: 'अपनी स्थानीय भाषा में सिर्फ अपनी आवाज का इस्तेमाल करके सरकारी फॉर्म भरें।',
    startSpeaking: 'बोलना शुरू करें',
    getStarted: 'शुरू करें',
    learnMore: 'और जानें',
    digitalIndia: 'डिजिटल इंडिया पहल',
    secure: 'सुरक्षित',
    whyVaani: 'वानी AI क्यों?',
    breakingBarriers: 'वॉयस टेक्नोलॉजी के साथ साक्षरता बाधाओं को तोड़ना',
    howItWorks: 'यह कैसे काम करता है',
    readyStarted: 'शुरू करने के लिए तैयार हैं?',
    startNow: 'अभी शुरू करें',
    noTyping: 'कोई टाइपिंग नहीं। कोई साक्षरता बाधा नहीं। कोई एजेंट नहीं।',
    languages: 'भाषाएँ',
    qrValidity: 'QR समाप्त होता है',
    qrValidityValue: 'पूर्ण होने पर',
    voiceFirstTitle: 'वॉयस-प्रथम इंटरफेस',
    voiceFirstDesc: 'हिंदी, तेलुगु, तमिल, बंगाली या अंग्रेजी में बोलें। कोई टाइपिंग की आवश्यकता नहीं।',
    multiLangTitle: 'बहुभाषी समर्थन',
    multiLangDesc: 'सटीक भाषण पहचान के साथ 5+ भारतीय भाषाओं का समर्थन।',
    secureTitle: 'सुरक्षित और निजी',
    secureDesc: 'एंड-टू-एंड एन्क्रिप्शन। एडमिन द्वारा आवेदन पूरा होते ही QR कोड समाप्त हो जाता है।',
    qrTitle: 'तत्काल QR कोड जनरेशन',
    qrDesc: 'तुरंत अपना अद्वितीय QR कोड प्राप्त करें। अधिकारियों को स्कैन और प्रिंट कर सकते हैं।',
    noMiddleTitle: 'कोई बिचौलिया नहीं',
    noMiddleDesc: 'प्रत्यक्ष पहुंच। कोई एजेंट नहीं, कोई शुल्क नहीं, कोई शोषण नहीं।',
    easyTitle: 'सभी के लिए आसान',
    easyDesc: 'ग्रामीण, बुजुर्ग और कम साक्षरता वाले नागरिकों के लिए डिजाइन किया गया।',
    stepsSubtitle: 'अपने सरकारी फॉर्म को भरने के लिए तीन सरल कदम',
    step1Title: 'अपने विवरण बोलें',
    step1Desc: 'अपनी भाषा चुनें और स्वाभाविक रूप से अपनी जानकारी बोलें। हमारा AI आपकी आवाज को समझता है।',
    step2Title: 'समीक्षा और पुष्टि करें',
    step2Desc: 'स्वत:भरे गए फॉर्म की जांच करें। यदि आवश्यक हो तो कोई सुधार करें।',
    step3Title: 'QR कोड प्राप्त करें',
    step3Desc: 'एक अद्वितीय QR कोड प्राप्त करें। अधिकारी को तुरंत फॉर्म प्रिंट करने के लिए दिखाएं।',
    ctaText: 'Vaani Ai का उपयोग करके हजारों नागरिकों से जुड़ें परेशानी मुक्त सरकारी सेवाओं के लिए',
  },
  te: {
    title: 'వాయిస్-ఆధారిత ప్రభుత్వ ఫారమ్‌లు',
    subtitle: 'మీ స్థానిక భాషలో సిర్ఫ మీ వాయిస్ ఉపయోగించి ప్రభుత్వ ఫారమ్‌లను పూరించండి.',
    startSpeaking: 'మాట్లాడటం ప్రారంభించండి',
    getStarted: 'ప్రారంభించండి',
    learnMore: 'మరిన్ని తెలుసుకోండి',
    digitalIndia: 'డిజిటల్ ఇండియా సంచిక',
    secure: 'సురక్షితమైన',
    whyVaani: 'వానీ AI ఎందుకు?',
    breakingBarriers: 'వాయిస్ టెక్నాలజీ ద్వారా సాక్ష్యరత బాధలను విచ్ఛిన్నం చేయడం',
    howItWorks: 'ఇది ఎలా కార్యం చేస్తుంది',
    readyStarted: 'ప్రారంభం చేయడానికి సిద్ధమైనారా?',
    startNow: 'ఇప్పుడు ప్రారంభించండి',
    noTyping: 'టైపింగ్ లేదు. సాక్ష్యరత అవరోధాలు లేవు. ఏజెంట్లు లేరు.',
    languages: 'భాషలు',
    qrValidity: 'QR గడువు తీరుతుంది',
    qrValidityValue: 'పూర్తయినప్పుడు',
    voiceFirstTitle: 'వాయిస్-ప్రధమ ఇంటర్ఫేస్',
    voiceFirstDesc: 'హిందీ, తెలుగు, తమిళ్లు, బెంగాలీ లేదా ఇంగ్లీష్‌లో మాట్లాడండి. టైపింగ్ అవసరం లేదు.',
    multiLangTitle: 'బహుభాష సపోర్ట్',
    multiLangDesc: 'ఖచ్చితమైన గుర్తింపుతో 5+ భారతీయ భాషలకు సపోర్ట్.',
    secureTitle: 'సురక్షితమైన & ఖాసగీ',
    secureDesc: 'ఎండ్-టు-ఎండ్ ఎన్‌క్రిప్షన్. అడ్మిన్ దరఖాస్తు పూర్తి చేసిన తర్వాత QR కోడ్ గడువు తీరుతుంది.',
    qrTitle: 'తక్షణ QR కోడ్ జనరేషన్',
    qrDesc: 'మీ ప్రత్యేక QR కోడ్‌ను తక్షణమే పొందండి. అధికారులు స్కాన్ మరియు ప్రింట్ చేయవచ్చు.',
    noMiddleTitle: 'మధ్యస్థులు లేరు',
    noMiddleDesc: 'ప్రత్యక్ష ప్రాప్యత. ఏజెంట్లు లేరు, ఫీసు లేరు, దోపిడీ లేదు.',
    easyTitle: 'సిద్ధులకు సులభం',
    easyDesc: 'గ్రామీణ, వృద్ధ మరియు తక్కువ సాక్ష్యరత ఉన్న పట్టణ నివాసుల కోసం రూపొందించబడింది.',
    stepsSubtitle: 'మీ ప్రభుత్వ ఫారమ్ భరించడానికి మూడు సరళ దశలు',
    step1Title: 'మీ వివరాలను మాట్లాడండి',
    step1Desc: 'మీ భాషను ఎంచుకుని, ప్రకృతిలో మీ సమాచారం మాట్లాడండి. మా AI మీ వాయిస్‌ను అర్థం చేస్కుంటుంది.',
    step2Title: 'సమీక్ష మరియు నిర్ధారణ',
    step2Desc: 'స్వయంచాలక-నిండిన ఫారమ్‌ను తనిఖీ చేయండి. అవసరమైతే ఏవైనా సవరణలు చేయండి.',
    step3Title: 'QR కోడ్ పొందండి',
    step3Desc: 'ఒక ప్రత్యేక QR కోడ్ పొందండి. అధికారికి తక్షణమే ఫారమ్ ప్రింట్ చేయమని చూపండి.',
    ctaText: 'Vaani Ai ఉపయోగించి సుళువైన ప్రభుత్వ సేవల కోసం వేల మంది నాగరికుల కూడా చేరండి',
  },
  kn: {
    title: 'ವಾಯಿಸ್-ಆಧಾರಿತ ಸರ್ಕಾರಿ ಫಾರ್ಮ್‌ಗಳು',
    subtitle: 'ನಿಮ್ಮ ಸ್ಥಳೀಯ ಭಾಷೆಯಲ್ಲಿ ಕೇವಲ ನಿಮ್ಮ ಧ್ವನಿ ಬಳಸಿ ಸರ್ಕಾರಿ ಫಾರ್ಮ್‌ಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ.',
    startSpeaking: 'ಮಾತನಾಡುವುದು ಪ್ರಾರಂಭಿಸಿ',
    getStarted: 'ಪ್ರಾರಂಭಿಸಿ',
    learnMore: 'ಹೆಚ್ಚು ತಿಳಿಯಿರಿ',
    digitalIndia: 'ಡಿಜಿಟಲ್ ಇಂಡಿಯಾ ಉದ್ಯೋಗ',
    secure: 'ಸುರಕ್ಷಿತ',
    whyVaani: 'ವಾಣಿ AI ಏಕೆ?',
    breakingBarriers: 'ವೈಶ್ವಿಕ ತಂತ್ರಜ್ಞಾನದೊಂದಿಗೆ ಸಾಕ್ಷರತೆ ತೊಂದರೆಗಳನ್ನು ಮುರಿಯುವುದು',
    howItWorks: 'ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ',
    readyStarted: 'ಶುರು ಮಾಡಲು ಸಿದ್ಧರಾಗಿದ್ದೀರಿ?',
    startNow: 'ಈಗ ಶೂರು ಮಾಡಿ',
    noTyping: 'ನೀವು ಗುರುತಿಸುವುದೇ ಇಲ್ಲ. ಸಾಕ್ಷರತೆ ಅವರೋಧಗಳು ಇಲ್ಲ. ವಿನಿಯೋಗಿಗಳು ಇಲ್ಲ.',
    languages: 'ಭಾಷೆಗಳು',
    qrValidity: 'QR ಮುಕ್ತಾಯ',
    qrValidityValue: 'ಪೂರ್ಣದ ಮೇಲೆ',
    voiceFirstTitle: 'ವಾಯಿಸ್-ಪ್ರಥಮ ಇಂಟರ್ಫೇಸ್',
    voiceFirstDesc: 'ಹಿಂದಿ, ತೆಲುಗು, ತಮಿಳು, ಬೆಂಗಾಲಿ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಮಾತನಾಡಿ. ಯಾವುದೇ ಟೈಪಿಂಗ್ ಅಗತ್ಯವಿಲ್ಲ.',
    multiLangTitle: 'ಬಹುಭಾಷಾ ಬೆಂಬಲ',
    multiLangDesc: 'ನಿಖುರ ಭಾಷಣ ಸ್ವೀಕೃತಿಯೊಂದಿಗೆ 5+ ಭಾರತೀಯ ಭಾಷೆಗಳಿಗೆ ಬೆಂಬಲ.',
    secureTitle: 'ಸುರಕ್ಷಿತ ಮತ್ತು ಖಾಸಗಿ',
    secureDesc: 'ಎಂದ್-ಟು-ಎಂದ್ ಎನ್‌ಕ್ರಿಪ್ಷನ್. ನಿರ್ವಾಹಕರು ಅರ್ಜಿ ಪೂರ್ಣಗೊಳಿಸಿದ ನಂತರ QR ಕೋಡ್ ಮುಕ್ತಾಯಗೊಳ್ಳುತ್ತದೆ.',
    qrTitle: 'ತಕ್ಷಣ QR ಕೋಡ್ ಜನರೇಶನ್',
    qrDesc: 'ನೀವರ ಅನನ್ಯ QR ಕೋಡ್ ತಕ್ಷಣವೇ ಪಡೆಯಿರಿ. ಅಧಿಕಾರಿಗಳು ಸ್ಕ್ಯಾನ್ ಮತ್ತು ಪ್ರಿಂಟ್ ಮಾಡಬಹುದು.',
    noMiddleTitle: 'ಯಾವುದೇ ಮಧ್ಯವರ್ತಿ ಇಲ್ಲ',
    noMiddleDesc: 'ನೇರ ಪ್ರವೇಶ. ಕೋನೇ ಏಜೆಂಟ್‌ಗಳು, ಫೀಸುಗಳು ಅಥವಾ ಶೋಷಣೆ ಇಲ್ಲ.',
    easyTitle: 'ಎಲ್ಲರಿಗೆ ಸುಲಭ',
    easyDesc: 'ಗ್ರಾಮೀಣ, ವಯಸ್ಕ ಮತ್ತು ಕಡಿಮೆ ಸಾಕ್ಷರತಾ ನಾಗರಿಕರಿಗೆ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ.',
    stepsSubtitle: 'ನಿಮ್ಮ ಸರ್ಕಾರಿ ಫಾರ್ಮ್ ತುಂಬಲು ಮೂರು ಸರಳ ಹಂತಗಳು',
    step1Title: 'ನಿಮ್ಮ ವಿವರಗಳು ಮಾತನಾಡಿ',
    step1Desc: 'ನಿಮ್ಮ ಭಾಷೆ ಆರಿಸಿ ಮತ್ತು ನೈಸರ್ಗಿಕವಾಗಿ ನಿಮ್ಮ ಮಾಹಿತಿ ಮಾತನಾಡಿ. ನಮ್ಮ AI ನಿಮ್ಮ ಧ್ವನಿ ತಿಳುವಳಿಕೆ ಹೊಂದಿದೆ.',
    step2Title: 'ಪರಿಶೀಲನ ಮತ್ತು ದೃಢೀಕರಣ',
    step2Desc: 'ಸ್ವಯಂ-ಭೂಮೆ ಮಾಡಿದ ಫಾರ್ಮ್ ಪರಿಶೀಲಿಸಿ. ಅವಶ್ಯಕತೆ ಇದ್ದರೆ ಯಾವುದೇ ತಿದ್ದುಪಡಿಗಳನ್ನು ಮಾಡಿ.',
    step3Title: 'QR ಕೋಡ್ ಪಡೆಯಿರಿ',
    step3Desc: 'ಒಂದು ಅನನ್ಯ QR ಕೋಡ್ ಸ್ವೀಕರಿಸಿ. ಆಫಿಸರಿಗೆ ಫಾರ್ಮ್ ತಕ್ಷಣವೇ ಪ್ರಿಂಟ್ ಮಾಡಲು ತೋರಿಸಿ.',
    ctaText: 'Vaani Ai ಬಳಸಿ ತೊಂದರೆ-ಮುಕ್ತ ಸರ್ಕಾರಿ ಸೇವೆಗಳಿಗೆ ಸಾವಿರ ಜನ ನಾಗರಿಕರಲ್ಲಿ ಸೇರಿಕೊಳ್ಳಿ',
  },
  ta: {
    title: 'குரல் சக்தியால் கட்டப்பட்ட அரசாங்க ஆவணங்கள்',
    subtitle: 'உங்கள் உள்ளூர் மொழியில் உங்கள் குரலை வைத்து அரசாங்க படிவங்களை நிரப்பவும்.',
    startSpeaking: 'பேசத் தொடங்கவும்',
    getStarted: 'தொடங்கவும்',
    learnMore: 'மேலும் அறிக',
    digitalIndia: 'டிஜிட்டல் இந்தியா முயற்சி',
    secure: 'பாதுகாப்பான',
    whyVaani: 'வாணி AI ஏன்?',
    breakingBarriers: 'குரல் தொழில்நுட்பத்துடன் சாক்ষரத தடைகளை உடைப்பது',
    howItWorks: 'இது எவ்வாறு செயல்படுகிறது',
    readyStarted: 'தொடங்க தயாரா?',
    startNow: 'இப்போது தொடங்கவும்',
    noTyping: 'எந்த டைபிங் இல்லை. எந்த சாக்ஷரத தடைகள் இல்லை. எந்த முகவர்கள் இல்லை.',
    languages: 'மொழிகள்',
    qrValidity: 'QR காலாவதி',
    qrValidityValue: 'முடிந்ததும்',
    voiceFirstTitle: 'குரல்-முதல் இடைமுகம்',
    voiceFirstDesc: 'தமிழ், தெலுங்கு, தமிழ், வங்காளம் அல்லது ஆங்கிலத்தில் பேசுங்கள். எந்த டைபிங் தேவையில்லை.',
    multiLangTitle: 'பல மொழி ஆதரவு',
    multiLangDesc: 'துல்லியமான பேச்சு அங்கீகாரத்துடன் 5+ இந்திய மொழிகளுக்கு ஆதரவு.',
    secureTitle: 'பாதுகாப்பான & தனிப்பட்ட',
    secureDesc: 'முனை-முனை குறியாக்கம். நிர்வாகி விண்ணப்பத்தை முடித்தபின் QR குறியீடு காலாவதியாகும்.',
    qrTitle: 'உடனடி QR குறியீடு உৎபादனம்',
    qrDesc: 'உங்கள் தனிய QR குறியீட்டை உடனடியாக பெறுங்கள். அதிகாரிகள் நக்ஷ்ட்ர மற்றும் அச்சிட முடியும்.',
    noMiddleTitle: 'எந்த இடைநிலை இல்லை',
    noMiddleDesc: 'நேரடி அணுகல். கோனு முகவர்கள் இல்லை, கட்டணங்கள் இல்லை, சுரண்டல் இல்லை.',
    easyTitle: 'அனைவருக்கும் எளிமையான',
    easyDesc: 'கிராமக் பகுதி, வயஸ்கர மற்றும் குறைந்த சாக்ஷரத குடிமக்களுக்கு வடிவமைக்கப்பட்டுள்ளது.',
    stepsSubtitle: 'உங்கள் அரசாங்க படிவத்தை நிரப்ப மூன்று எளிய படிகள்',
    step1Title: 'உங்கள் விவரங்களை பேசுங்கள்',
    step1Desc: 'உங்கள் மொழியைத் தேர்ந்தெடுத்து, இயற்கையாகவே உங்கள் தகவல்களை பேசுங்கள். எங்கள் AI உங்கள் குரலைப் புரிந்துகொள்கிறது.',
    step2Title: 'மறுபரிசீலனை மற்றும் உறுதிப்படுத்தல்',
    step2Desc: 'தானாகவே நிரப்பப்பட்ட படிவத்தை பரிசீலிக்கவும். தேவைப்பட்டால் ஏதேனும் திருத்தங்கள் செய்யவும்.',
    step3Title: 'QR குறியீட்டைப் பெறுங்கள்',
    step3Desc: 'ஒரு தனிய QR குறியீட்டைப் பெறுங்கள். அதிகாரிக உடனடியாக அச்சிட வெளிப்படுத்துங்கள்.',
    ctaText: 'Vaani Ai ஐ பயன்படுத்தி சிரமம் இல்லாத அரசாங்க பணிகளுக்கு ஆயிரம் பேரை விட பல குடிமக்களுடன் சேரவும்',
  },
  ml: {
    title: 'കണ്ഠസ്വര ആധാരിത സരകാരി ഫോമുകൾ',
    subtitle: 'നിങ്ങളുടെ പ്രാദേശിക ഭാഷയിൽ നിങ്ങളുടെ കണ്ഠസ്വരം മാത്രം ഉപയോഗിച്ച് സർകാരി ഫോമുകൾ പൂരിപ്പിക്കുക.',
    startSpeaking: 'സംസാരം തുടങ്ങുക',
    getStarted: 'ആരംഭിക്കുക',
    learnMore: 'കൂടുതൽ അറിയുക',
    digitalIndia: 'ഡിജിറ്റൽ ഇന്ത്യ സംരംഭണം',
    secure: 'സുരക്ഷിതമായ',
    whyVaani: 'വാണി AI എന്തെന്ന് കാരണം?',
    breakingBarriers: 'കണ്ഠസ്വര സാങ്കേതിക വിദ്യ വഴി സാക്ഷരത തടസ്സ തകർക്കുക',
    howItWorks: 'ഇത് എങ്ങനെ സംരംഭിക്കുന്നു',
    readyStarted: 'ആരംഭിക്കാൻ പ്രസ്തുത?',
    startNow: 'ഇപ്പോൾ ആരംഭിക്കുക',
    noTyping: 'ടൈപ്പിംഗൊന്നുമില്ല. സാക്ഷരത തടസ്സങ്ങളൊന്നുമില്ല. ഏജന്റുമാരൊന്നുമില്ല.',
    languages: 'ഭാഷകൾ',
    qrValidity: 'QR കാലഹരണം',
    qrValidityValue: 'പൂർത്തിയാകുമ്പോൾ',
    voiceFirstTitle: 'കണ്ഠസ്വര-ആദ്യ ഇന്റർഫേസ്',
    voiceFirstDesc: 'മലയാളം, തെലുങ്ക്, തമിഴ്, ബംഗാളി അല്ലെങ്കിൽ ഇംഗ്ലീഷ് സംസാരിക്കുക. ടൈപ്പിംഗ് ആവശ്യമില്ല.',
    multiLangTitle: 'ബഹുഭാഷാ സഹായം',
    multiLangDesc: 'കൃത്യമായ സ്പീച്ച് റെക്കഗ്നിഷനിനൊപ്പം 5+ ഇന്ത്യൻ ഭാഷകൾക്കുള്ള സഹായം.',
    secureTitle: 'സുരക്ഷിതവും സ്വകാര്യവും',
    secureDesc: 'എൻഡ്-ടു-എൻഡ് എൻക്രിപ്ഷൻ. അഡ്മിൻ അപേക്ഷ പൂർത്തിയാക്കിയ ശേഷം QR കോഡ് കാലഹരണപ്പെടും.',
    qrTitle: 'തൽക്ഷണ QR കോഡ് ജനറേഷൻ',
    qrDesc: 'നിങ്ങളുടെ സവിശേഷ QR കോഡ് ഉടൻ സ്വീകരിക്കുക. ഓഫീസർമാർ സ്കാൻ ചെയ്ത് പ്രിന്റ് ചെയ്യാൻ കഴിയും.',
    noMiddleTitle: 'ഇടനിലക്കാരില്ല',
    noMiddleDesc: 'നേരിട്ടുള്ള പ്രവേശനം. ഏജന്റുമാരില്ല, ഫീസുകളില്ല, ചൂഷണമില്ല.',
    easyTitle: 'എല്ലാവർക്കും എളുപ്പം',
    easyDesc: 'ഗ്രാമീണ, പ്രായമായ, കുറഞ്ഞ സാക്ഷരത കൈഗാരിക നഗരവാസികൾക്കായി ഡിസൈൻ ചെയ്തത്.',
    stepsSubtitle: 'നിങ്ങളുടെ സർക്കാർ ഫോം പൂരിപ്പിക്കാൻ മൂന്ന് ലളിത പടികൾ',
    step1Title: 'നിങ്ങളുടെ വിശദാംശങ്ങൾ സംസാരിക്കുക',
    step1Desc: 'നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുത്ത് സ്വാഭാവികമായി നിങ്ങളുടെ വിവരങ്ങൾ സംസാരിക്കുക. ഞങ്ങളുടെ AI നിങ്ങളുടെ കണ്ഠസ്വരം മനസ്സിലാക്കുന്നു.',
    step2Title: 'അവലോകനം ചെയ്ത് സ്ഥിരീകരിക്കുക',
    step2Desc: 'സ്വയമേവ പൂരിപ്പിച്ച ഫോം പരിശോധിക്കുക. ആവശ്യമെങ്കിൽ ഏതെങ്കിലും തിരുത്തലുകൾ വരുത്തുക.',
    step3Title: 'QR കോഡ് സ്വീകരിക്കുക',
    step3Desc: 'ഒരു സവിശേഷ QR കോഡ് സ്വീകരിക്കുക. ഓഫീസരേ പെട്ടെന്ന് ഫോം പ്രിന്റ് ചെയ്യാൻ കാണിക്കുക.',
    ctaText: 'Vaani Ai ഉപയോഗിച്ച് ഝാമ്പ-പ്രായ സർക്കാരി സേവനങ്ങൾക്കായി ആയിരം പേരായ നാഗരികരിൽ ചേരുക',
  },
  mr: {
    title: 'व्हॉयस-आधारित सरकारी फॉर्म',
    subtitle: 'आपल्या स्थानिक भाषेत केवळ आपल्या व्हॉयसचा वापर करून सरकारी फॉर्म भरा.',
    startSpeaking: 'बोलायला सुरुवात करा',
    getStarted: 'सुरुवात करा',
    learnMore: 'अधिक जाणून घ्या',
    digitalIndia: 'डिजिटल इंडिया पहल',
    secure: 'सुरक्षित',
    whyVaani: 'वाणी AI का?',
    breakingBarriers: 'व्हॉयस तंत्रज्ञान सह साक्षरता अडचणी तोडणे',
    howItWorks: 'हे कसे कार्य करते',
    readyStarted: 'सुरुवात करण्यासाठी तयार?',
    startNow: 'आता सुरुवात करा',
    noTyping: 'कोणतेही टाइपिंग नाही. कोणतीही साक्षरता अडचणी नाहीत. कोणतेही एजंट नाहीत.',
    languages: 'भाषा',
    qrValidity: 'QR कालबाह्य',
    qrValidityValue: 'पूर्ण झाल्यावर',
    voiceFirstTitle: 'व्हॉयस-प्रथमा इंटरफेस',
    voiceFirstDesc: 'हिंदी, तेलुगु, तमिळ, बंगाली किंवा इंग्रजीत बोला. कोणतेही टाइपिंग आवश्यक नाही.',
    multiLangTitle: 'बहुभाषी समर्थन',
    multiLangDesc: 'अचूक भाषण ओळख सह 5+ भारतीय भाषांचे समर्थन.',
    secureTitle: 'सुरक्षित & खाजगी',
    secureDesc: 'एंड-टू-एंड एन्क्रिप्शन. प्रशासकाने अर्ज पूर्ण केल्यावर QR कोड कालबाह्य होतो.',
    qrTitle: 'तात्कालिक QR कोड जनरेशन',
    qrDesc: 'आपले अद्वितीय QR कोड लगेच मिळा. अधिकारी स्कॅन आणि प्रिंट करू शकतात.',
    noMiddleTitle: 'कोणतेही दलाल नाहीत',
    noMiddleDesc: 'थेट प्रवेश. कोणतेही एजंट नाहीत, कोणतेही शुल्क नाहीत, कोणतेही शोषण नाहीत.',
    easyTitle: 'सर्वांसाठी सोपे',
    easyDesc: 'ग्रामीण, वयस्क आणि कमी साक्षरता असलेल्या नागरिकांसाठी डिजाइन केलेले.',
    stepsSubtitle: 'आपल्या सरकारी फॉर्म भरण्यासाठी तीन सोप्या पायऱ्या',
    step1Title: 'आपले तपशील बोला',
    step1Desc: 'आपली भाषा निवडा आणि स्वाभाविकरित्या आपली माहिती बोला. आमचे AI आपली आवाज समजते.',
    step2Title: 'पुनरावलोकन आणि पुष्टी करा',
    step2Desc: 'स्वतः भरलेल्या फॉर्मची तपासणी करा. आवश्यक असल्यास कोणतेही सुधार करा.',
    step3Title: 'QR कोड मिळा',
    step3Desc: 'एक अद्वितीय QR कोड प्राप्त करा. तुरुंगाधीशांना तात्काळ फॉर्म प्रिंट करायला दाखवा.',
    ctaText: 'Vaani Ai वापरून अडचणीमुक्त सरकारी सेवांसाठी हजारो नागरिकांसह सामील व्हा',
  },
  bn: {
    title: 'ভয়েস-চালিত সরকারি ফর্ম',
    subtitle: 'আপনার স্থানীয় ভাষায় কেবল আপনার ভয়েস ব্যবহার করে সরকারি ফর্ম পূরণ করুন।',
    startSpeaking: 'কথা বলা শুরু করুন',
    getStarted: 'শুরু করুন',
    learnMore: 'আরও জানুন',
    digitalIndia: 'ডিজিটাল ইন্ডিয়া উদ্যোগ',
    secure: 'সুরক্ষিত',
    whyVaani: 'ভানী AI কেন?',
    breakingBarriers: 'ভয়েস প্রযুক্তির সাথে সাক্ষরতার বাধা ভাঙা',
    howItWorks: 'এটি কীভাবে কাজ করে',
    readyStarted: 'শুরু করতে প্রস্তুত?',
    startNow: 'এখনই শুরু করুন',
    noTyping: 'কোন টাইপিং নেই। সাক্ষরতার কোন বাধা নেই। কোন এজেন্ট নেই।',
    languages: 'ভাষা',
    qrValidity: 'QR মেয়াদ শেষ',
    qrValidityValue: 'সম্পন্ন হলে',
    voiceFirstTitle: 'ভয়েস-প্রথম ইন্টারফেস',
    voiceFirstDesc: 'হিন্দি, তেলুগু, তামিল, বাংলা বা ইংরেজিতে কথা বলুন। কোন টাইপিং প্রয়োজন নেই।',
    multiLangTitle: 'বহুভাষিক সমর্থন',
    multiLangDesc: 'নির্ভুল কণ্ঠস্বর স্বীকৃতি সহ 5+ ভারতীয় ভাষার জন্য সমর্থন।',
    secureTitle: 'সুরক্ষিত এবং ব্যক্তিগত',
    secureDesc: 'এন্ড-টু-এন্ড এনক্রিপশন। অ্যাডমিন আবেদন সম্পন্ন করলে QR কোডের মেয়াদ শেষ হয়।',
    qrTitle: 'তাৎক্ষণিক QR কোড জেনারেশন',
    qrDesc: 'আপনার অনন্য QR কোড তাৎক্ষণিকভাবে পান। অফিসাররা স্ক্যান এবং প্রিন্ট করতে পারেন।',
    noMiddleTitle: 'কোন মধ্যস্থতাকারী নেই',
    noMiddleDesc: 'সরাসরি অ্যাক্সেস। কোন এজেন্ট নেই, কোন ফি নেই, কোন শোষণ নেই।',
    easyTitle: 'সবার জন্য সহজ',
    easyDesc: 'গ্রামীণ, বয়স্ক এবং কম সাক্ষর নাগরিকদের জন্য ডিজাইন করা হয়েছে।',
    stepsSubtitle: 'আপনার সরকারি ফর্ম পূরণের জন্য তিনটি সহজ ধাপ',
    step1Title: 'আপনার বিবরণ বলুন',
    step1Desc: 'আপনার ভাষা নির্বাচন করুন এবং প্রাকৃতিকভাবে আপনার তথ্য বলুন। আমাদের AI আপনার কণ্ঠস্বর বোঝে।',
    step2Title: 'পর্যালোচনা ও নিশ্চিত করুন',
    step2Desc: 'স্বয়ংক্রিয়ভাবে পূর্ণ করা ফর্ম পরীক্ষা করুন। প্রয়োজনে কোনো সংশোধন করুন।',
    step3Title: 'QR কোড পান',
    step3Desc: 'একটি অনন্য QR কোড পান। অফিসারকে তাৎক্ষণিকভাবে ফর্ম প্রিন্ট করতে দেখান।',
    ctaText: 'Vaani Ai ব্যবহার করে ঝামেলামুক্ত সরকারি পরিষেবার জন্য হাজার হাজার নাগরিকের সাথে যোগ দিন',
  },
  gu: {
    title: 'અવાજ-આધારિત સરકારી ફોર્મ્સ',
    subtitle: 'તમારી સ્થાનિક ભાષામાં માત્ર તમારાં અવાજનો ઉપયોગ કરીને સરકારી ફોર્મ્સ ભરો.',
    startSpeaking: 'બોલવું શરૂ કરો',
    getStarted: 'શરૂ કરો',
    learnMore: 'વધુ જાણો',
    digitalIndia: 'ડિજિટલ ઇન્ડિયા ઉદ્યોગ',
    secure: 'સુરક્ષિત',
    whyVaani: 'વાણી AI કેમ?',
    breakingBarriers: 'અવાજ તકનીક સાથે સાક્ષરતાની અવરોધ તોડવી',
    howItWorks: 'તે કેવી રીતે કાર્ય કરે છે',
    readyStarted: 'શરૂ કરવા માટે તૈયાર?',
    startNow: 'હવે શરૂ કરો',
    noTyping: 'કોઈ ટાઈપિંગ નહીં. કોઈ સાક્ષરતા અવરોધ નહીં. કોઈ એજન્ટ નહીં.',
    languages: 'ભાષા',
    qrValidity: 'QR સમાપ્ત',
    qrValidityValue: 'પૂર્ણ પર',
    voiceFirstTitle: 'અવાજ-પ્રથમ ઇન્ટરફેસ',
    voiceFirstDesc: 'ગુજરાતીમાં, હિન્દીમાં, તેલુગુમાં, તમિલમાં કે કન્નડમાં બોલો. કોઈ ટાઈપિંગ આવશ્યક નથી.',
    multiLangTitle: 'બહુભાષી સમર્થન',
    multiLangDesc: 'સચોટ વાણી ઓળખ સાથે 5+ ભારતીય ભાષાનું સમર્થન.',
    secureTitle: 'સુરક્ષિત અને ખાનગી',
    secureDesc: 'અંત-થી-અંત એન્ક્રિપ્શન. એડમિન અરજી પૂર્ણ કર્યા પછી QR કોડ સમાપ્ત થાય છે.',
    qrTitle: 'તાત્કાલીક QR કોડ જનરેશન',
    qrDesc: 'તમારો અનોખો QR કોડ તાત્કાલીક મેળવો. અધિકારીઓ સ્કેન અને છાપી શકે છે.',
    noMiddleTitle: 'કોઈ મધ્યસ્થી નથી',
    noMiddleDesc: 'સીધો અ્যાક્સેસ. કોઈ એજન્ટ નથી, કોઈ ચાર્જ નથી, કોઈ શોષણ નથી.',
    easyTitle: 'બધા માટે સરળ',
    easyDesc: 'ગ્રામીણ, વયસ્ક અને ઓછી સાક્ષરતા ધરાવતા નાગરિકો માટે ડિજાઇન કર્યું.',
    stepsSubtitle: 'તમારા સરકારી ફોર્મ ભરવા માટે ત્રણ સરળ પગલાં',
    step1Title: 'તમારી વિગતો બોલો',
    step1Desc: 'તમારી ભાષા પસંદ કરો અને કુદરતી રીતે તમારી માહિતી બોલો. આમનો AI તમારી આવાજ સમજે છે.',
    step2Title: 'પુનરાવલોકન અને પુષ્ટી કરો',
    step2Desc: 'આપોઆપ ભરેલ ફોર્મ તપાસો. જરૂર પડે તો કોઈ સુધાર કરો.',
    step3Title: 'QR કોડ મેળવો',
    step3Desc: 'એક અનોખું QR કોડ મેળવો. અધિકારીને તાત્કાલીક ફોર્મ છાપવા માટે બતાવો.',
    ctaText: 'Vaani Ai વાપરીને પરેશાનીમુક્ત સરકારી સેવાઓ માટે હજારો નાગરિક સાથે જોડાઓ',
  },
  or: {
    title: 'ଭଏସ-ଆଧାରିତ ସରକାରୀ ଫର୍ମ',
    subtitle: 'ଆପଣଙ୍କ ସ୍ଥାନୀୟ ଭାଷାରେ କେବଳ ଆପଣଙ୍କ ଭଏସ ବ୍ୟବହାର କରି ସରକାରୀ ଫର୍ମ ପୂରଣ କରନ୍ତୁ।',
    startSpeaking: 'କହିବା ଆରମ୍ଭ କରନ୍ତୁ',
    getStarted: 'ଆରମ୍ଭ କରନ୍ତୁ',
    learnMore: 'ଅଧିକ ଜାଣନ୍ତୁ',
    digitalIndia: 'ଡିଜିଟାଲ ଇଣ୍ଡିଆ ପଦକ୍ଷେପ',
    secure: 'ସୁରକ୍ଷିତ',
    whyVaani: 'ଭୟସ୍ଥି AI କାହିଁକି?',
    breakingBarriers: 'ଭଏସ ରଣନୀତି ସହ ସାକ୍ଷରତା ଦିଗ ଭାଙ୍ଗି ଦେବା',
    howItWorks: 'ଏଟା କିଭାବେ କାଜ କରେ',
    readyStarted: 'ଆରମ୍ଭ ସିଦ୍ଧ?',
    startNow: 'ଏବେ ଆରମ୍ଭ କରନ୍ତୁ',
    noTyping: 'କୌଣସି ଟାଇପିଂ ନାହିଁ। କୌଣସି ସାକ୍ଷରତା ବାଧା ନାହିଁ। କୌଣସି ଏଜେଣ୍ଟ ନାହିଁ।',
    languages: 'ଭାଷା',
    qrValidity: 'QR ସମାପ୍ତ',
    qrValidityValue: 'ଶେଷ ହେଲେ',
    voiceFirstTitle: 'ଭଏସ-ପ୍ରଥମ ଇନ୍ଟରଫେସ',
    voiceFirstDesc: 'ଓଡିଆ, ହିନ୍ଦୀ, ତେଲୁଗୁ, ତାମିଲ, କନ୍ନଡ କିମ୍ବା ଇଂରାଜୀରେ କହନ୍ତୁ। ଟାଇପିଂ ଦରକାର ନାହିଁ।',
    multiLangTitle: 'ବହୁଭାଷିକ ସମର୍ଥନ',
    multiLangDesc: 'ସଠିକ ଭାଷଣ ସ୍ୱୀକୃତି ସହିତ 5+ ଭାରତୀୟ ଭାଷାଗୁଡ଼ିକ ପାଇଁ ସମର୍ଥନ।',
    secureTitle: 'ସୁରକ୍ଷିତ ଏବଂ ବ୍ୟକ୍ତିଗତ',
    secureDesc: 'ଏଣ୍ଡ-ଟୁ-ଏଣ୍ଡ ଏନକ୍ରିପ୍ଶନ। ଏଡମିନ ଆବେଦନ ସମ୍ପୂର୍ଣ ହେଲେ QR କୋଡ ସମାପ୍ତ ହୁଏ।',
    qrTitle: 'ତାତ୍କ୍ଷଣିକ QR କୋଡ ଜେନେରେସନ୍',
    qrDesc: 'ଆପଣଙ୍କର ଅନନ୍ୟ QR କୋଡ ତାତ୍କ୍ଷଣିକ ପାଇନ୍ତୁ। ଅଫିସର୍ମାନେ ସ୍କ୍ୟାନ୍ ଏବଂ ଛାପିବାକୁ ପାରିବେ।',
    noMiddleTitle: 'କୌଣସି ମାଧ୍ୟମ ନାହିଁ',
    noMiddleDesc: 'ସିଧା ଆକ୍ସେସ। କୌଣସି ଏଜେଣ୍ଟ ନାହିଁ, କୌଣସି ଫି ନାହିଁ, କୌଣସି ଶୋଷଣ ନାହିଁ।',
    easyTitle: 'ସବୁଙ୍କ ପାଇଁ ସୁଲଭ',
    easyDesc: 'ଗ୍ରାମୀଣ, ବୟସ୍କ ଏବଂ ସୀମିତ ସାକ୍ଷରତା ନାଗରିକମାନଙ୍କ ପାଇଁ ଡିଜାଇନ୍ କରାଯାଇଛି।',
    stepsSubtitle: 'ଆପଣଙ୍କର ସରକାରୀ ଫର୍ମ ପୂରଣ ପାଇଁ ତିନୋଟି ସରଳ ପଦକ୍ଷେପ',
    step1Title: 'ଆପଣଙ୍କର ବିବରଣୀ କହନ୍ତୁ',
    step1Desc: 'ଆପଣଙ୍କର ଭାଷା ଚୟନ କରନ୍ତୁ ଏବଂ ସ୍ୱାଭାବିକ ଭାବରେ ଆପଣଙ୍କର ତଥ୍ୟ କହନ୍ତୁ। ଆମାର AI ଆପଣଙ୍କର ଧ୍ୱନି ବୁଝନ୍ତୋ।',
    step2Title: 'ସମୀକ୍ଷା ଏବଂ ନିଶ୍ଚିତ କରନ୍ତୁ',
    step2Desc: 'ସ୍ୱୟଂଚାଳିତ ଭାବରେ ପୂର୍ଣ୍ଣ ଫର୍ମ ଯାଚାଇ ଦେଖନ୍ତୁ। ଆବଶ୍ୟକ ପକ୍ଷେ କୌଣସି ସଂଶୋଧନ କରନ୍ତୁ।',
    step3Title: 'QR କୋଡ ପାଇନ୍ତୁ',
    step3Desc: 'ଏକ ଅନନ୍ୟ QR କୋଡ ପାଇନ୍ତୁ। ଅଫିସରକୁ ତାତ୍କାଳିକ ଫର୍ମ ଛାପିବା ପାଇଁ ଦେଖାଇ ଦିନ୍ତୁ।',
    ctaText: 'Vaani Ai ବ୍ୟବହାର କରି ଝଞ୍ଝଟମୁକ୍ତ ସରକାରୀ ସେବା ଦ୍ୱାରା ହଜାର ନାଗରିକଙ୍କ ସହ ଯୋଗ ଦିନ୍ତୁ',
  },
  pa: {
    title: 'ਵਾਇਸ-ਆਧਾਰਿਤ ਸਰਕਾਰੀ ਫਾਰਮ',
    subtitle: 'ਆਪਣੀ ਸਥਾਨਕ ਭਾਸ਼ਾ ਵਿੱਚ ਸਿਰਫ਼ ਆਪਣੀ ਆਵਾਜ਼ ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਸਰਕਾਰੀ ਫਾਰਮ ਭਰੋ।',
    startSpeaking: 'ਬੋਲਨਾ ਸ਼ੁਰੂ ਕਰੋ',
    getStarted: 'ਸ਼ੁਰੂ ਕਰੋ',
    learnMore: 'ਹੋਰ ਜਾਣੋ',
    digitalIndia: 'ਡਿਜੀਟਲ ਇੰਡੀਆ ਯੋਜਨਾ',
    secure: 'ਸੁਰੱਖਿਅਤ',
    whyVaani: 'ਵਾਂਈ AI ਕਿਉਂ?',
    breakingBarriers: 'ਵਾਇਸ ਪ੍ਰਣਾਲੀ ਦੀ ਸਹਾਇਤਾ ਨਾਲ ਸਾਖਰਤਾ ਦੀ ਰੁਕਾਵਟ ਤੋੜਨਾ',
    howItWorks: 'ਇਹ ਕਿਵੇ ਕਾਮ ਕਰਦਾ ਹੈ',
    readyStarted: 'ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਤਿਆਰ?',
    startNow: 'ਹੁਣ ਸ਼ੁਰੂ ਕਰੋ',
    noTyping: 'ਕੋਈ ਟਾਈਪਿੰਗ ਨਹੀਂ। ਕੋਈ ਸਾਖਰਤਾ ਰੁਕਾਵਟ ਨਹੀਂ। ਕੋਈ ਏਜੰਟ ਨਹੀਂ।',
    languages: 'ਭਾਸ਼ਾਵਾਂ',
    qrValidity: 'QR ਸਮਾਪਤੀ',
    qrValidityValue: 'ਪੂਰਾ ਹੋਣ ਤੇ',
    voiceFirstTitle: 'ਵਾਇਸ-ਪਹਿਲਾ ਇੰਟਰਫੇਸ',
    voiceFirstDesc: 'ਪੰਜਾਬੀ, ਹਿੰਦੀ, ਤੇਲੁਗੂ, ਤਾਮਿਲ ਜਾਂ ਕੰਨੜ ਵਿੱਚ ਬੋਲੋ। ਕੋਈ ਟਾਈਪਿੰਗ ਦੀ ਲੋੜ ਨਹੀਂ।',
    multiLangTitle: 'ਬਹੁ-ਭਾਸ਼ਾ ਸਹਾਇਤਾ',
    multiLangDesc: 'ਸਟੀਕ ਵੈੱਚ ਟੁ ਸਪੀਚ ਚੀਨ੍ਹ ਦੇ ਨਾਲ 5+ ਭਾਰਤੀ ਭਾਸ਼ਾਵਾਂ ਲਈ ਸਹਾਇਤਾ।',
    secureTitle: 'ਸੁਰੱਖਿਅਤ ਅਤੇ ਨਿੱਜੀ',
    secureDesc: 'ਏਂਡ-ਟੂ-ਏਂਡ ਐਨਕ੍ਰਿਪਸ਼ਨ। ਐਡਮਿਨ ਦੁਆਰਾ ਬੇਨਤੀ ਪੂਰੀ ਹੋਣ ਤੇ QR ਕੋਡ ਸਮਾਪਤ ਹੋ ਜਾਂਦਾ ਹੈ।',
    qrTitle: 'ਤੁਰੰਤ QR ਕੋਡ ਜਨਰੇਸ਼ਨ',
    qrDesc: 'ਆਪਣਾ ਵਿਲੱਖਣ QR ਕੋਡ ਤੁਰੰਤ ਪ੍ਰਾਪਤ ਕਰੋ। ਅਫਸਰ ਸਕੈਨ ਅਤੇ ਪ੍ਰਿੰਟ ਕਰ ਸਕਦੇ ਹਨ।',
    noMiddleTitle: 'ਕੋਈ ਦਲਾਲ ਨਹੀਂ',
    noMiddleDesc: 'ਸੱਚਮੁੱਚ ਲਈ ਰਸਤਾ। ਕੋਈ ਏਜੰਟ ਨਹੀਂ, ਕੋਈ ਫੀਸ ਨਹੀਂ, ਕੋਈ ਸ਼ੋਸ਼ਣ ਨਹੀਂ।',
    easyTitle: 'ਸਭ ਲਈ ਆਸਾਨ',
    easyDesc: 'ਗ੍ਰਾਮੀਣ, ਬਜ਼ੁਰਗ ਅਤੇ ਘੱਟ ਸਾਖਰਤਾ ਵਾਲੇ ਨਾਗਰਿਕਾਂ ਲਈ ਡਿਜ਼ਾਇਨ ਕੀਤਾ ਗਿਆ।',
    stepsSubtitle: 'ਆਪਣਾ ਸਰਕਾਰੀ ਫਾਰਮ ਭਰਨ ਲਈ ਤਿੰਨ ਆਸਾਨ ਪੜਾਅ',
    step1Title: 'ਆਪਣੀ ਜਾਣਕਾਰੀ ਬੋਲੋ',
    step1Desc: 'ਆਪਣੀ ਭਾਸ਼ਾ ਚੁਣੋ ਅਤੇ ਕੁਦਰਤੀ ਤੌਰ ਤੇ ਆਪਣੀ ਜਾਣਕਾਰੀ ਬੋਲੋ। ਸਾਡਾ AI ਤੁਹਾਡੀ ਆਵਾਜ ਨੂੰ ਸਮਝਦਾ ਹੈ।',
    step2Title: 'ਸਮੀਖਿਆ ਕਰੋ ਅਤੇ ਪ੍ਰਵਰਧਨ ਕਰੋ',
    step2Desc: 'ਖੁੰਮ ਆਪ ਬਰਤ ਫਾਰਮ ਦੀ ਜਾਂਚ ਕਰੋ। ਲੋੜ ਪਰੇ ਕੋਈ ਸਲਾਹਵੇ ਕਰੋ।',
    step3Title: 'QR ਕੋਡ ਪ੍ਰਾਪਤ ਕਰੋ',
    step3Desc: 'ਇੱਕ ਵਿਲੱਖਣ QR ਕੋਡ ਪ੍ਰਾਪਤ ਕਰੋ। ਅਫਸਰ ਨੂੰ ਤੁਰੰਤ ਫਿੰਮ ਪ੍ਰਿੰਟ ਕਰਨ ਲਈ ਦਿਖਾਉ।',
    ctaText: 'Vaani Ai ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਝਜਿਬਾ-ਮੁਕਤ ਸਰਕਾਰੀ ਸੇਵਾਵਾਂ ਲਈ ਹਜ਼ਾਰਾਂ ਨਾਗਰਿਕਾਂ ਦੇ ਨਾਲ ਸੰਭਂਦ ਪ੍ਛ੍ਤ ਘਣ।',
  },
  ur: {
    title: 'وائس سے چلنے والی حکومتی فارمز',
    subtitle: 'اپنی مقامی زبان میں محض اپنی آواز کے ذریعے حکومتی فارمز بھریں۔',
    startSpeaking: 'بات کرنا شروع کریں',
    getStarted: 'شروع کریں',
    learnMore: 'مزید جانیں',
    digitalIndia: 'ڈیجیٹل انڈیہ منصوبہ',
    secure: 'محفوظ',
    whyVaani: 'وانی AI کیوں؟',
    breakingBarriers: 'وائس ٹیکنالوجی سے خواندگی کی رکاوٹ توڑنا',
    howItWorks: 'یہ کیسے کام کرتا ہے',
    readyStarted: 'شروع کرنے کے لیے تیار ہیں؟',
    startNow: 'اب شروع کریں',
    noTyping: 'کوئی ٹائپنگ نہیں۔ کوئی خواندگی کی رکاوٹ نہیں۔ کوئی ایجنٹ نہیں۔',
    languages: 'زبانیں',
    qrValidity: 'QR میعاد ختم',
    qrValidityValue: 'مکمل پر',
    voiceFirstTitle: 'وائس-پہلے انٹرفیس',
    voiceFirstDesc: 'اردو، ہندی، تیلگو، تمل یا کنڑ میں بات کریں۔ کوئی ٹائپنگ کی ضرورت نہیں۔',
    multiLangTitle: 'کثیر الثقافت معاونت',
    multiLangDesc: 'درست آواز کی شناخت کے ساتھ 5+ بھارتی زبانوں کی معاونت۔',
    secureTitle: 'محفوظ اور نجی',
    secureDesc: 'شروع سے آخر تک خفیہ کاری۔ ایڈمن کی درخواست مکمل ہونے پر QR کوڈ کی میعاد ختم ہو جاتی ہے۔',
    qrTitle: 'فوری QR کوڈ تیاری',
    qrDesc: 'اپنا منفرد QR کوڈ فوری حاصل کریں۔ افسران اسکین اور پرنٹ کر سکتے ہیں۔',
    noMiddleTitle: 'کوئی درمیانہ فریق نہیں',
    noMiddleDesc: 'براہ راست رسائی۔ کوئی ایجنٹ نہیں، کوئی فیس نہیں، کوئی استحصال نہیں۔',
    easyTitle: 'سب کے لیے آسان',
    easyDesc: 'دیہاتی، بزرگ اور کم خواندگی والے شہری کے لیے ڈیزائن کیا گیا۔',
    stepsSubtitle: 'اپنا حکومتی فارم بھرنے کے لیے تین آسان مراحل',
    step1Title: 'اپنی تفصیلات بتائیں',
    step1Desc: 'اپنی زبان منتخب کریں اور قدرتی طریقے سے اپنی معلومات بتائیں۔ ہمارا AI آپ کی آواز سمجھتا ہے۔',
    step2Title: 'دوبارہ جانچیں اور تصدیق کریں',
    step2Desc: 'خود بخود بھرے ہوئے فارم کو جانچیں۔ ضرورت کے مطابق کوئی بھی اصلاح کریں۔',
    step3Title: 'QR کوڈ حاصل کریں',
    step3Desc: 'ایک منفرد QR کوڈ حاصل کریں۔ افسر کو فوری فارم پرنٹ کرنے دکھائیں۔',
    ctaText: 'Vaani Ai استعمال کرتے ہوئے مسئلہ سے پاک حکومتی خدمات کے لیے ہزاروں شہری کے ساتھ شامل ہوں',
  },
};

export function LandingPage({ onGetStarted, onStartSpeaking, selectedLanguage }: LandingPageProps) {
  // Display text in selected language, fallback to English
  const currentLabels = landingLabels[selectedLanguage?.code as keyof typeof landingLabels] || landingLabels['en'];
  const [isPlayingInstruction, setIsPlayingInstruction] = useState(false);
  // Ref mirror — lets the confirmation useEffect read the latest value
  // without adding isPlayingInstruction to the dep array (keeps array size stable).
  const isPlayingInstructionRef = useRef(false);
  const setIsPlayingInstructionSync = (val: boolean) => {
    isPlayingInstructionRef.current = val;
    setIsPlayingInstruction(val);
  };
  const [lastPlayedLanguageCode, setLastPlayedLanguageCode] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // true only after the user physically clicks something — prevents autoplay-policy errors
  // that occur when selectedLanguage is restored from localStorage before any interaction.
  const userHasInteracted = useRef(false);
  const [hasScrolled, setHasScrolled] = useState(false);

  // AUTO-SCROLL LOGIC: Once language is selected, scroll down then auto-enter sign-in
  useEffect(() => {
    if (selectedLanguage && !hasScrolled) {
      setHasScrolled(true);
      
      // Give time for text-to-speech confirmation message ("You have selected...")
      setTimeout(() => {
        const totalHeight = document.body.scrollHeight;
        const duration = 10000; // 10 seconds for a very slow, readable scroll
        const startTime = performance.now();
        const startPos = window.scrollY;

        const animateScroll = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Linear scroll for constant readable speed
          window.scrollTo(0, startPos + (totalHeight * progress));

          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          } else {
            // Once finished, wait a few more seconds at the bottom then move to sign-in
            setTimeout(() => {
              onGetStarted();
            }, 3000); // 3-second pause at the bottom
          }
        };

        requestAnimationFrame(animateScroll);
      }, 3500); // Start scroll 3.5s after language selection
    }
  }, [selectedLanguage, hasScrolled, onGetStarted]);


  // A ref to hold a cancel function for the currently active audio loop.
  // Calling it will immediately stop playback and prevent the next step from firing.
  const cancelPlaybackRef = useRef<(() => void) | null>(null);

  // Stop all audio/speech playback safely (also cancels any sequential loop)
  const stopAudio = () => {
    // Cancel the sequential loop if one is running
    if (cancelPlaybackRef.current) {
      cancelPlaybackRef.current();
      cancelPlaybackRef.current = null;
    }
    // Stop Web Speech API synthesis
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Stop & clean up the current HTMLAudio element
    if (audioRef.current) {
      try {
        // Clear handlers FIRST so they don't fire after we stop
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      } catch {
        // Ignore errors during stop
      }
      audioRef.current = null;
    }
    setIsPlayingInstructionSync(false);
  };

  // Language code to BCP-47 locale map for Web Speech API
  const langToLocale: Record<string, string> = {
    en: 'en-IN', hi: 'hi-IN', te: 'te-IN', kn: 'kn-IN',
    ta: 'ta-IN', ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN',
    gu: 'gu-IN', or: 'or-IN', pa: 'pa-IN', ur: 'ur-PK',
  };

  // Stop any speechSynthesis playback
  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  // Play voice instructions in ALL 12 languages — one by one via TTS proxy
  // Exact order: English, Hindi, Telugu, Tamil, Malayalam, Kannada, Marathi, Bengali, Gujarati, Odia, Punjabi, Urdu
  const playVoiceInstructions = async () => {
    userHasInteracted.current = true;
    if (isPlayingInstructionRef.current) return;

    // Stop any previous playback cleanly
    stopAudio();
    setIsPlayingInstructionSync(true);
    console.log('[🎤 VOICE] Starting instruction playback for all 12 languages');

    // Exact order requested by user (line 1 → line 12)
    const sequence = [
      { label: 'English', lang: 'en' },
      { label: 'Hindi', lang: 'hi' },
      { label: 'Telugu', lang: 'te' },
      { label: 'Tamil', lang: 'ta' },
      { label: 'Malayalam', lang: 'ml' },
      { label: 'Kannada', lang: 'kn' },
      { label: 'Marathi', lang: 'mr' },
      { label: 'Bengali', lang: 'bn' },
      { label: 'Gujarati', lang: 'gu' },
      { label: 'Odia', lang: 'or' },
      { label: 'Punjabi', lang: 'pa' },
      { label: 'Urdu', lang: 'ur' },
    ];

    // Pre-fetch all audio blobs first (no browser autoplay restrictions on fetching)
    console.log('[🎤 VOICE] Pre-fetching all TTS audio for 12 languages...');
    const audioBlobs: { lang: string; label: string; blob: Blob | null; error?: string }[] = [];
    
    for (const { label, lang } of sequence) {
      try {
        const text = voiceInstructions[lang];
        if (!text) {
          console.warn(`[🎤 VOICE] ⚠️ Missing text for ${lang}, skipping`);
          audioBlobs.push({ lang, label, blob: null, error: 'No text' });
          continue;
        }

        console.log(`[🎤 VOICE] Fetching ${label} [${lang}]...`);
        const res = await fetch(`/api/tts-proxy?text=${encodeURIComponent(text)}&lang=${lang}`);
        if (!res.ok) {
          audioBlobs.push({ lang, label, blob: null, error: `HTTP ${res.status}` });
          console.warn(`[🎤 VOICE] ⚠️ Failed to fetch ${label}: HTTP ${res.status}`);
          continue;
        }

        const blob = await res.blob();
        console.log(`[🎤 VOICE] ✓ Fetched ${label}: ${blob.size} bytes`);
        audioBlobs.push({ lang, label, blob });
      } catch (err) {
        console.error(`[🎤 VOICE] ❌ Fetch error for ${label}:`, err);
        audioBlobs.push({ lang, label, blob: null, error: String(err) });
      }
    }

    console.log(`[🎤 VOICE] Pre-fetch complete. Now playing sequentially...`);

    // Now play them sequentially
    let cancelled = false;
    cancelPlaybackRef.current = () => { 
      cancelled = true; 
      console.log('[🎤 VOICE] Playback cancelled');
    };

    const playSequence = async () => {
      for (let i = 0; i < audioBlobs.length; i++) {
        if (cancelled) {
          console.log('[🎤 VOICE] Playback stopped by user');
          break;
        }

        const { lang, label, blob, error } = audioBlobs[i];

        if (!blob) {
          console.warn(`[🎤 VOICE] Skipping ${label}: ${error}`);
          continue;
        }

        try {
          const blobUrl = URL.createObjectURL(blob);

          // Stop the previous audio element and clear its handlers BEFORE creating the new one
          if (audioRef.current) {
            audioRef.current.onended = null;
            audioRef.current.onerror = null;
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
          }

          if (cancelled) {
            URL.revokeObjectURL(blobUrl);
            break;
          }

          const audio = new Audio(blobUrl);
          audioRef.current = audio;
          audio.volume = 1.0;
          audio.playbackRate = 1.0;
          audio.loop = false;

          let audioCleanedUp = false;
          const cleanup = () => {
            if (!audioCleanedUp) {
              audioCleanedUp = true;
              if (blobUrl) URL.revokeObjectURL(blobUrl);
              audio.onended = null;
              audio.onerror = null;
            }
          };

          console.log(`[🎤 VOICE] (${i + 1}/12) Playing ${label}...`);
          
          // Create a promise that resolves when audio finishes or errors
          const audioPromise = new Promise<void>((resolve) => {
            audio.onended = () => {
              console.log(`[🎤 VOICE] ✓ Finished ${label}`);
              cleanup();
              resolve();
            };
            
            audio.onerror = (err) => {
              console.error(`[🎤 VOICE] Audio playback error for ${label}:`, err);
              cleanup();
              resolve(); // Continue to next language on error
            };

            // Play audio - this should work because we're in the async chain started by user click
            audio.play().catch((err) => {
              if (err.name === 'NotAllowedError') {
                console.warn(`[🎤 VOICE] Browser blocked autoplay for ${label} (NotAllowedError). User may need to interact with page first.`);
              } else if (err.name === 'NotSupportedError') {
                console.warn(`[🎤 VOICE] Browser doesn't support this audio format for ${label}`);
              } else {
                console.error(`[🎤 VOICE] Failed to play ${label}:`, err.message);
              }
              cleanup();
              resolve(); // Continue anyway
            });
          });

          // Wait for this audio to finish before moving to next
          await audioPromise;

          // 400ms pause between languages for natural pacing
          if (i < audioBlobs.length - 1 && !cancelled) {
            await new Promise(r => setTimeout(r, 400));
          }
        } catch (err) {
          console.error(`[🎤 VOICE] Unexpected error playing ${label}:`, err);
        }
      }

      if (!cancelled) {
        console.log('[🎤 VOICE] ✅ All 12 languages played successfully');
      }
      setIsPlayingInstructionSync(false);
    };

    // Start the sequence
    playSequence();
  };

  // Play language confirmation message when language is selected
  const playLanguageConfirmation = async (selectedLang: Language) => {
    if (!selectedLang || isPlayingInstructionRef.current) return;

    // Only play if language has changed
    if (lastPlayedLanguageCode === selectedLang.code) {
      console.log(`[🎤 LANG] Language confirmation already played for ${selectedLang.code}`);
      return;
    }

    setLastPlayedLanguageCode(selectedLang.code);
    console.log(`[🎤 LANG] Playing confirmation for ${selectedLang.name} [${selectedLang.code}]`);

    try {
      // Get the confirmation message in the user's selected language
      const confirmationText = languageConfirmationMessages[selectedLang.code]?.[selectedLang.code] ||
        languageConfirmationMessages['en']?.[selectedLang.code] ||
        `You have selected ${selectedLang.name}`;

      console.log(`[🎤 LANG] Fetching TTS for: "${confirmationText.substring(0, 50)}..."`);
      const response = await fetch(`/api/tts-proxy?text=${encodeURIComponent(confirmationText)}&lang=${selectedLang.code}`);
      if (!response.ok) {
        console.error(`[🎤 LANG] TTS fetch failed: HTTP ${response.status}`);
        return;
      }
      
      const blob = await response.blob();
      console.log(`[🎤 LANG] Received audio blob: ${blob.size} bytes`);
      const blobUrl = URL.createObjectURL(blob);

      // Stop any previous audio (clears handlers + pauses)
      stopAudio();

      const audio = new Audio(blobUrl);
      audio.volume = 1.0;
      audio.playbackRate = 1.0;
      audio.loop = false;
      audioRef.current = audio;

      let audioCleanedUp = false;
      const handleCompletion = () => {
        if (!audioCleanedUp) {
          audioCleanedUp = true;
          URL.revokeObjectURL(blobUrl);
          audio.onended = null;
          audio.onerror = null;
        }
      };

      audio.onended = () => {
        console.log(`[🎤 LANG] ✓ Confirmation finished for ${selectedLang.name}`);
        handleCompletion();
      };
      
      audio.onerror = (err) => {
        console.error(`[🎤 LANG] Audio error for ${selectedLang.name}:`, err);
        handleCompletion();
      };

      console.log(`[🎤 LANG] ▶️ Playing confirmed message for ${selectedLang.name}`);
      try {
        await audio.play();
      } catch (playError: any) {
        console.error(`[🎤 LANG] Play failed for ${selectedLang.name}:`, playError.name, playError.message);
        if (playError.name === 'NotAllowedError') {
          console.warn(`[🎤 LANG] Browser blocked autoplay. User may need to interact with page.`);
        }
        handleCompletion();
      }
    } catch (err) {
      console.error(`[🎤 LANG] Unexpected error:`, err);
    }
  };

  // Mark as interacted on mount because to reach this component, 
  // the user must have clicked the splash screen (gesture).
  useEffect(() => {
    userHasInteracted.current = true;
  }, []);

  // Play confirmation only when the user has already interacted with the page.
  useEffect(() => {
    if (!selectedLanguage || isPlayingInstructionRef.current) return;
    if (!userHasInteracted.current) return;
    
    console.log(`[🎤 LANG] Language changed to ${selectedLanguage.name}, scheduling confirmation`);
    
    // Small delay to ensure it doesn't overlap with previous sounds
    const t = setTimeout(async () => {
      console.log(`[🎤 LANG] Executing confirmation playback (after 200ms delay)`);
      await playLanguageConfirmation(selectedLanguage);
    }, 200);
    return () => {
      clearTimeout(t);
      console.log(`[🎤 LANG] Language selection effect cleanup`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLanguage?.code]);

  // Block Get Started if no language selected
  const handleStartSpeakingClick = () => {
    userHasInteracted.current = true;
    stopAudio();
    onStartSpeaking();
  };

  const handleGetStartedClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    userHasInteracted.current = true;

    // STRICT BLOCK: If no language selected, play voice instructions in all languages
    // do NOT open sign-in page
    if (!selectedLanguage) {
      console.log('[🎤 VOICE] No language selected, triggering voice instructions in all languages');
      playVoiceInstructions();
      return; // <-- NEVER reaches onGetStarted()
    }
    // Language is selected — allow navigation to sign-in page
    stopAudio();
    onGetStarted();
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Inject falling animation styles */}
      <style dangerouslySetInnerHTML={{ __html: FALLING_ANIMATION }} />


      {/* ── Global animation keyframes ── */}
      <style>{`
        /* hover lift for cards */
        .card-hover {
          transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        .card-hover:hover {
          transform: translateY(-6px) scale(1.02);
          box-shadow: 0 16px 40px rgba(0,0,0,0.4);
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.jpeg" alt="Logo" className="h-16 w-16 rounded-lg object-cover" />
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">Vaani Ai</span>
              {selectedLanguage && (
                <div className="ml-4 inline-flex items-center gap-2 px-3 py-1 bg-white/10 text-gray-300 text-sm font-semibold rounded-full border border-white/20">
                  <span>{selectedLanguage.flag}</span>
                  <span>{selectedLanguage.nativeName}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={handleGetStartedClick} className={`rounded-full px-6 font-semibold border ${selectedLanguage ? 'bg-white/10 text-white hover:bg-white/20 border-white/20' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 animate-pulse'}`}>
                {isPlayingInstruction ? '🔊 Listen...' : currentLabels.getStarted}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative px-4 py-28 text-center overflow-hidden">
        {/* ambient glow orbs */}
        <div style={{ position: 'absolute', top: '-80px', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '10%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(147,51,234,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="max-w-3xl mx-auto relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-full text-sm text-cyan-300 font-medium mb-8 card-fall" style={{ animationDelay: '0s' }}>
            🇮🇳 {currentLabels.digitalIndia}
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 card-fall" style={{ animationDelay: '0.08s' }}>
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
              {currentLabels.title}
            </span>
          </h1>

          <p className="text-xl text-gray-400 mb-3 leading-relaxed card-fall" style={{ animationDelay: '0.16s' }}>
            {currentLabels.subtitle}
          </p>
          <p className="text-lg text-white font-bold mb-10 card-fall" style={{ animationDelay: '0.24s' }}>
            {currentLabels.noTyping}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center card-fall" style={{ animationDelay: '0.32s' }}>
            <Button onClick={handleStartSpeakingClick} size="lg" className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 text-white h-14 px-8 rounded-lg text-lg font-bold border-0 shadow-lg" style={{ transition: 'transform 0.2s ease, opacity 0.2s ease' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <Mic className="mr-2 h-5 w-5" />
              {currentLabels.startSpeaking}
            </Button>
            <Button
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              size="lg"
              className="h-14 px-8 rounded-lg text-lg font-bold bg-transparent text-white border border-white/30 hover:bg-white/10 shadow-sm"
              style={{ transition: 'transform 0.2s ease' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {currentLabels.learnMore}
            </Button>
          </div>

          {/* Stats Row */}
          <div className="mt-16 flex flex-wrap justify-center gap-4">
            {[
              { value: '5+', label: currentLabels.languages },
              { value: currentLabels.qrValidityValue, label: currentLabels.qrValidity },
              { value: '100%', label: currentLabels.secure },
            ].map((stat, index) => (
              <div key={stat.label} className="card-hover px-8 py-5 bg-white/5 border border-white/10 rounded-2xl text-center min-w-[110px] card-fall" style={{ animationDelay: `${0.4 + (index * 0.08)}s` }}>
                <div className="text-3xl font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">{stat.value}</div>
                <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY VAANI AI — 6-card grid ── */}
      <section className="px-4 py-20 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-3 card-fall" style={{ animationDelay: '0.64s' }}>
            {currentLabels.whyVaani}
          </h2>
          <p className="text-center text-gray-400 mb-14 card-fall" style={{ animationDelay: '0.72s' }}>
            {currentLabels.breakingBarriers}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Mic className="h-6 w-6 text-cyan-400" />, bg: 'bg-cyan-500/20', title: currentLabels.voiceFirstTitle, desc: currentLabels.voiceFirstDesc },
              { icon: <Languages className="h-6 w-6 text-purple-400" />, bg: 'bg-purple-500/20', title: currentLabels.multiLangTitle, desc: currentLabels.multiLangDesc },
              { icon: <Shield className="h-6 w-6 text-emerald-400" />, bg: 'bg-emerald-500/20', title: currentLabels.secureTitle, desc: currentLabels.secureDesc },
              { icon: <QrCode className="h-6 w-6 text-yellow-400" />, bg: 'bg-yellow-500/20', title: currentLabels.qrTitle, desc: currentLabels.qrDesc },
              { icon: <Users className="h-6 w-6 text-rose-400" />, bg: 'bg-rose-500/20', title: currentLabels.noMiddleTitle, desc: currentLabels.noMiddleDesc },
              { icon: <CheckCircle2 className="h-6 w-6 text-blue-400" />, bg: 'bg-blue-500/20', title: currentLabels.easyTitle, desc: currentLabels.easyDesc },
            ].map((card, index) => (
              <div
                key={card.title}
                className={`card-hover p-7 bg-white/5 border border-white/10 rounded-2xl card-fall`}
                style={{ animationDelay: `${0.8 + (index * 0.08)}s` }}
              >
                <div className={`h-12 w-12 rounded-xl ${card.bg} flex items-center justify-center mb-4`}>
                  {card.icon}
                </div>
                <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section >

      {/* ── HOW IT WORKS — 3 steps ── */}
      < section id="how-it-works" className="px-4 py-20 border-t border-white/10" >
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-3 card-fall" style={{ animationDelay: '1.28s' }}>
            {currentLabels.howItWorks}
          </h2>
          <p className="text-center text-gray-400 mb-14 card-fall" style={{ animationDelay: '1.36s' }}>
            {currentLabels.stepsSubtitle}
          </p>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { num: '1', title: currentLabels.step1Title, desc: currentLabels.step1Desc },
              { num: '2', title: currentLabels.step2Title, desc: currentLabels.step2Desc },
              { num: '3', title: currentLabels.step3Title, desc: currentLabels.step3Desc },
            ].map((step, index) => (
              <div
                key={step.num}
                className="card-hover p-8 bg-white/5 border border-white/10 rounded-2xl text-center card-fall"
                style={{ animationDelay: `${1.44 + (index * 0.08)}s` }}
              >
                <div className="h-14 w-14 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-5 text-white text-xl font-extrabold">
                  {step.num}
                </div>
                <h3 className="text-base font-bold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section >

      {/* ── CTA SECTION ── */}
      < section className="px-4 py-20" >
        <div
          className="max-w-3xl mx-auto bg-gradient-to-r from-cyan-500 to-purple-600 p-12 rounded-2xl text-white text-center shadow-lg card-hover card-fall"
          style={{ animationDelay: '1.68s' }}
        >
          <h2 className="text-4xl font-bold mb-4">{currentLabels.readyStarted}</h2>
          <p className="text-white/80 mb-8 text-lg">{currentLabels.ctaText}</p>
          <Button
            onClick={handleGetStartedClick}
            size="lg"
            className={`h-14 px-10 rounded-full text-lg font-bold border-0 ${selectedLanguage ? 'bg-white text-gray-900 hover:bg-gray-100' : 'bg-yellow-400 text-black animate-pulse'}`}
            style={{ transition: 'transform 0.2s ease' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {isPlayingInstruction ? '🔊 Listen...' : currentLabels.startNow}
          </Button>
        </div>
      </section >
    </div >
  );
}