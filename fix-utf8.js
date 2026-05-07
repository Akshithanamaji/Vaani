const fs = require('fs');
const path = './components/voice-form.tsx';

try {
  const buf = fs.readFileSync(path);
  let str = buf.toString('utf8');

  // Find the start of the useEffect for introMessages
  const startIdx = str.indexOf('  useEffect(() => {\n    const introMessages: Record<string, string> = {');
  
  if (startIdx === -1) {
    console.log('Could not find the start of the introMessages block. The file might be corrupted differently.');
  } else {
    // Find the end of this useEffect block
    const endStr = '    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [service?.id]);';
    let endIdx = str.indexOf(endStr, startIdx);
    
    if (endIdx === -1) {
      console.log('Could not find the end of the block. Attempting to locate the next useEffect as fallback.');
      const fallbackEndStr = '  // ── Auto-trigger prompt when field changes';
      endIdx = str.indexOf(fallbackEndStr, startIdx);
      if (endIdx !== -1) {
        // Step back over whitespace/newlines before this comment
        while (str[endIdx - 1] === '\n' || str[endIdx - 1] === '\r' || str[endIdx - 1] === ' ') {
          endIdx--;
        }
      }
    } else {
      endIdx += endStr.length;
    }

    if (endIdx !== -1) {
      const properBlock = `  useEffect(() => {
    const introMessages: Record<string, string> = {
      en: \`Welcome to \${translatedService.name}. I will help you fill this form step by step using your voice.\`,
      hi: \`\${translatedService.name} में आपका स्वागत है। मैं आपकी आवाज़ से इस फॉर्म को भरने में मदद करूंगा।\`,
      te: \`\${translatedService.name}కి స్వాగతం. నేను మీ గొంతుతో ఈ ఫారమ్ నింపడంలో సహాయం చేస్తాను.\`,
      kn: \`\${translatedService.name}ಗೆ ಸ್ವಾಗತ. ನಿಮ್ಮ ಧ್ವನಿಯ ಮೂಲಕ ಈ ಫಾರ್ಮ್ ಭರ್ತಿ ಮಾಡಲು ನಾನು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ.\`,
      ta: \`\${translatedService.name}க்கு வரவேற்கிறோம். உங்கள் குரல் மூலம் இந்த படிவத்தை நிரப்ப நான் உதவுவேன்.\`,
      mr: \`\${translatedService.name}मध्ये आपले स्वागत आहे. मी तुमच्या आवाजाने हा फॉर्म भरण्यास मदत करेन.\`,
      bn: \`\${translatedService.name}-এ আপনাকে স্বাগতম। আমি আপনার কণ্ঠস্বর দিয়ে এই ফর্মটি পূরণ করতে সাহায্য করব।\`,
      gu: \`\${translatedService.name}માં આપનું સ્વાગત છે. હું આपना અવાજ વડે આ ફોર્મ ભરવામાં મદદ કરીશ.\`,
      pa: \`\${translatedService.name} ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਮੈਂ ਤੁਹਾਡੀ ਆਵਾਜ਼ ਨਾਲ ਇਹ ਫਾਰਮ ਭਰਨ ਵਿੱਚ ਮਦਦ ਕਰਾਂਗਾ।\`,
      ur: \`\${translatedService.name} میں آپ کا خیر مقدم ہے۔ میں آپ کی آواز سے یہ فارم بھرنے میں مدد کروں گا۔\`,
      or: \`\${translatedService.name}ରେ ଆପଣଙ୍କୁ ସ୍ୱାଗତ। ଆପଣଙ୍କ ଗୋଲ ଦ୍ୱାରା ଏହି ଫର୍ମ ପୂରଣ କରିବାରେ ମୁଁ ସାହାଯ୍ୟ କରିବି।\`,
    };
    const intro = introMessages[langCode] || introMessages['en'];

    // Small delay ensures audio.play() is called after the browser considers the
    // component fully settled (avoids silent autoplay-policy blocks on first render).
    const t = setTimeout(() => {
      speakText(intro, language).then(() => {
        if (fields.length > 0 && !isReviewing && !submittedQR) {
          setTimeout(() => triggerFieldPrompt(0), 400);
        }
      });
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id]);`;

      str = str.substring(0, startIdx) + properBlock + str.substring(endIdx);
      fs.writeFileSync(path, str, 'utf8');
      console.log('Successfully fixed the voice-form.tsx file completely and restored UTF-8 integrity!');
    } else {
      console.log('Failed to find end index.');
    }
  }
} catch (e) {
  console.error(e);
}
