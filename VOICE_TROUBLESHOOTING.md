                                                                       # Voice Synthesis Troubleshooting Guide

## Issue: Voice only working in English and Hindi

### Root Cause
The browser's speech synthesis engine needs language-specific voice packs installed. By default, most browsers only have English and sometimes Hindi voices pre-installed.

## Solution Steps

### Step 1: Check Available Voices

1. Navigate to: `http://localhost:3000/voice-diagnostic`
2. This page will show you:
   - All available voices in your browser
   - Which languages are supported
   - Test each language individually

### Step 2: Install Language Packs (Browser-Specific)

#### For Chrome/Edge (Windows):

1. **Open Windows Settings**
   - Press `Win + I`
   - Go to **Time & Language** → **Language & Region**

2. **Add Indian Languages**
   - Click **Add a language**
   - Search and add these languages:
     - Telugu (తెలుగు)
     - Tamil (தமிழ்)
     - Malayalam (മലയാളം)
     - Kannada (ಕನ್ನಡ)
     - Marathi (मराठी)
     - Bengali (বাংলা)
     - Gujarati (ગુજરાતી)
     - Odia (ଓଡ଼ିଆ)
     - Punjabi (ਪੰਜਾਬੀ)
     - Urdu (اردو)

3. **Download Language Features**
   - For each language, click the **⋯** (three dots)
   - Select **Language options**
   - Under **Speech**, click **Download** for Text-to-speech

4. **Restart Browser**
   - Close and reopen Chrome/Edge
   - The new voices should now be available

#### For Chrome/Edge (Mac):

1. **Open System Preferences**
   - Go to **Accessibility** → **Spoken Content**

2. **System Voice**
   - Click **System Voice** dropdown
   - Click **Customize...**
   - Select and download Indian language voices

3. **Restart Browser**

#### For Chrome/Edge (Linux):

1. **Install espeak-ng**
   ```bash
   sudo apt-get install espeak-ng
   ```

2. **Install language data**
   ```bash
   sudo apt-get install espeak-ng-data
   ```

3. **Restart Browser**

### Step 3: Verify Installation

1. Go back to `http://localhost:3000/voice-diagnostic`
2. Click **Reload Voices**
3. You should now see voices for all Indian languages
4. Click **Test** button for each language
5. You should hear the test phrase in that language

### Step 4: Test in Application

1. Navigate to your application form
2. Select a language (e.g., Telugu)
3. Start filling the form
4. You should now hear voice prompts in Telugu

## Understanding Voice Selection

The application uses this logic to select voices:

1. **Exact Match**: Tries to find voice with exact language code (e.g., `te-IN`)
2. **Prefix Match**: Tries to find voice starting with language code (e.g., `te`)
3. **Fallback**: Uses first available voice if no match found

## Debugging

### Check Browser Console

Open browser console (F12) and look for these logs:

```
[Voice] Looking for voice for language: te-IN, trying codes: ["te-IN", "te"]
[Voice] Available voices: Google తెలుగు (te-IN), Microsoft Heera (te-IN), ...
[Voice] Found exact match: Google తెలుగు (te-IN)
[Voice] Voice set to: Google తెలుగు (te-IN)
[Voice] Speaking in te-IN, using voice: Google తెలుగు te-IN
```

If you see:
```
[Voice] No match found for te-IN, using first available voice: Google US English (en-US)
```

This means the Telugu voice is not installed.

### Common Issues and Solutions

#### Issue 1: "No voices available yet"
**Solution**: 
- Reload the page
- Wait a few seconds for voices to load
- Check if browser supports speech synthesis

#### Issue 2: "Using first available voice" for non-English languages
**Solution**:
- Language pack not installed
- Follow Step 2 above to install language packs

#### Issue 3: Voice speaks in wrong language
**Solution**:
- Check if correct language is selected in the app
- Check browser console to see which voice is being used
- Verify language code is correct (e.g., `te-IN` not just `te`)

#### Issue 4: Voice sounds robotic or unnatural
**Solution**:
- This is normal for some browser voices
- Edge browser typically has better quality voices
- Consider using Google Chrome with online voices (requires internet)

## Browser Compatibility

### Best Support:
- ✅ **Chrome (Windows/Mac)**: Excellent support with Google voices
- ✅ **Edge (Windows)**: Excellent support with Microsoft natural voices

### Good Support:
- ⚠️ **Chrome (Linux)**: Good support with espeak
- ⚠️ **Safari (Mac)**: Good support with system voices

### Limited Support:
- ❌ **Firefox**: Limited Indian language support
- ❌ **Mobile browsers**: Varies by device

## Testing Checklist

After installing language packs, verify:

- [ ] English voice works
- [ ] Hindi voice works
- [ ] Telugu voice works
- [ ] Tamil voice works
- [ ] Malayalam voice works
- [ ] Kannada voice works
- [ ] Marathi voice works
- [ ] Bengali voice works
- [ ] Gujarati voice works
- [ ] Odia voice works
- [ ] Punjabi voice works
- [ ] Urdu voice works

## Alternative Solution: Online TTS API

If browser voices are not sufficient, consider using an online TTS API:

### Option 1: Google Cloud Text-to-Speech
- Excellent quality
- Supports all Indian languages
- Requires API key and billing

### Option 2: Amazon Polly
- Good quality
- Supports most Indian languages
- Requires AWS account

### Option 3: Microsoft Azure Speech
- Excellent quality with neural voices
- Supports all Indian languages
- Requires Azure account

## Quick Fix for Testing

If you just want to test quickly without installing all languages:

1. Test with English and Hindi (already working)
2. For other languages, the app will fall back to English voice
3. The text will still be in the correct language, just spoken with English pronunciation

## Need Help?

If voices still don't work after following these steps:

1. Check the diagnostic page: `http://localhost:3000/voice-diagnostic`
2. Share the browser console logs
3. Share the list of available voices from the diagnostic page
4. Specify your OS and browser version
