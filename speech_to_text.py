"""
Speech-to-Text Conversion using Groq's Whisper API
Python implementation to replace the JavaScript/TypeScript version
"""

import os
import base64
import requests
import json
from typing import Dict, Any, Optional
from pathlib import Path
import io

class GroqSpeechToText:
    """Groq Speech-to-Text client for audio transcription"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize with Groq API key"""
        self.api_key = api_key or os.getenv('GROQ_API_KEY')
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable is required")
        
        self.base_url = "https://api.groq.com/openai/v1/audio/transcriptions"
        
        # Context prompts for better accuracy based on field types
        self.whisper_prompts = {
            'name': 'This is a person full name spoken in India. Common examples include Akshitha, Akshithanamaji, Ramesh Kumar, Priya Sharma, Mohammed Ali, or South Indian names ending in -tha like Anvitha, Harshitha.',
            'full_name': 'This is a person full name spoken in India. Examples: Akshitha, Akshithanamaji, Ramesh Kumar, Priya Sharma. South Indian names often use "th" for the dental sound (e.g., Akshitha instead of Akshita).',
            'father_name': 'This is the name of a father, spoken in India. Common Indian names like Anand, Venkatesh, Rajesh.',
            'mother_name': 'This is the name of a mother, spoken in India. Common Indian names like Lakshmi, Sunita, Akshitha.',
            'husband_name': 'This is a spouse name spoken in India.',
            'guardian_name': 'This is a guardian name spoken in India.',
            'owner_name': 'This is an owner name spoken in India.',
            'applicant_name': 'This is an applicant full name spoken in India. Precise spelling expected for names like Akshitha.',
            'phone': 'This is a 10-digit Indian mobile phone number. The speaker may say the digits individually or in groups.',
            'mobile': 'This is a 10-digit Indian mobile phone number. The speaker may say the digits individually or in groups.',
            'mobile_no': 'This is a 10-digit Indian mobile phone number.',
            'aadhaar': 'This is a 12-digit Aadhaar number. The speaker may say the digits individually or in groups.',
            'aadhaar_no': 'This is a 12-digit Aadhaar number.',
            'pan': 'This is a PAN card number with 5 letters, 4 digits, and 1 letter. For example ABCDE1234F.',
            'pincode': 'This is a 6-digit Indian postal PIN code.',
            'email': 'This is an email address. The speaker may say dot for . and at for @.',
            'dob': 'This is a date of birth. The speaker will likely say the Date, then Month, then Year (e.g., "15th August 1990" or "01 01 1980"). Precise number detection is critical.',
            'date_of_birth': 'This is a date of birth spoken in India. The speaker will likely say the Date, then Month, then Year.',
            'address': 'This is a residential address in India.',
            'village': 'This is a village, town, or city name in India.',
            'district': 'This is an Indian district or city name.',
            'state': 'This is an Indian state name.',
            'occupation': 'This is an occupation or job title.',
            'income': 'This is an amount in Indian Rupees. The speaker may say lakhs or thousands.',
            'annual_income': 'This is an annual income amount in Indian Rupees.',
            'land_area': 'This is a land area measurement in acres or hectares.',
            'bank_account': 'This is a bank account number.',
            'ifsc': 'This is an IFSC code for a bank branch in India.',
        }

    def _get_file_extension(self, mime_type: str) -> str:
        """Get appropriate file extension based on MIME type"""
        if 'mp4' in mime_type:
            return 'mp4'
        elif 'ogg' in mime_type:
            return 'ogg'
        elif 'mp3' in mime_type or 'mpeg' in mime_type:
            return 'mp3'
        else:
            return 'webm'  # default

    def _get_whisper_prompt(self, field_name: str = "") -> str:
        """Get context prompt for better transcription accuracy"""
        field_key = field_name.lower().replace('-', '_')
        
        # Direct match
        if field_key in self.whisper_prompts:
            return self.whisper_prompts[field_key]
        
        # Partial match
        for key, prompt in self.whisper_prompts.items():
            if key in field_key:
                return prompt
        
        # Default prompt
        return 'This is a spoken response for an Indian government form. Transcribe accurately.'

    def transcribe_from_base64(self, 
                             audio_base64: str, 
                             mime_type: str = "audio/wav", 
                             language: str = "hi", 
                             field_name: str = "") -> Dict[str, Any]:
        """
        Transcribe audio from base64 encoded data
        
        Args:
            audio_base64: Base64 encoded audio data
            mime_type: MIME type of the audio
            language: Language code (default: 'hi' for Hindi)
            field_name: Field name for context-aware prompts
            
        Returns:
            Dictionary with transcription result
        """
        try:
            # Convert base64 to bytes
            audio_bytes = base64.b64decode(audio_base64)
            
            # Get appropriate file extension
            file_ext = self._get_file_extension(mime_type)
            
            # Get context prompt
            whisper_prompt = self._get_whisper_prompt(field_name)
            
            # Prepare form data
            files = {
                'file': (f'audio.{file_ext}', io.BytesIO(audio_bytes), mime_type)
            }
            
            data = {
                'model': 'whisper-large-v3',
                'prompt': whisper_prompt,
                'temperature': '0' if ('phone' in field_name.lower() or 'aadhaar' in field_name.lower() or 'pin' in field_name.lower()) else '0.1' 
            }
            
            if language and language.lower() != 'auto':
                data['language'] = language
            
            headers = {
                'Authorization': f'Bearer {self.api_key}'
            }
            
            print(f"[SpeechToText] Sending audio to Groq Whisper API (Language: {language}, Format: {mime_type}, File: audio.{file_ext})...")
            
            # Make API request
            response = requests.post(
                self.base_url,
                headers=headers,
                files=files,
                data=data
            )
            
            if not response.ok:
                error_text = response.text
                print(f"[SpeechToText] Groq API error ({response.status_code}): {error_text}")
                
                try:
                    error_data = response.json()
                except:
                    error_data = {"message": error_text}
                
                # Handle specific error types
                if response.status_code == 429:
                    error_msg = "Groq rate limit reached. Please wait a moment and try again."
                elif response.status_code == 401:
                    error_msg = "Invalid Groq API key. Check your GROQ_API_KEY environment variable."
                else:
                    error_msg = f"Groq transcription failed ({response.status_code})"
                
                return {
                    "success": False,
                    "error": error_msg,
                    "details": error_data
                }
            
            result = response.json()
            print(f"[SpeechToText] Transcription successful: {result['text']}")
            
            return {
                "success": True,
                "text": result["text"],
                "language": language,
                "raw": result
            }
            
        except Exception as e:
            print(f"[SpeechToText] Unexpected error: {str(e)}")
            return {
                "success": False,
                "error": "Failed to process speech-to-text",
                "message": str(e)
            }

    def transcribe_from_file(self, 
                           file_path: str, 
                           language: str = "hi", 
                           field_name: str = "") -> Dict[str, Any]:
        """
        Transcribe audio from file path
        
        Args:
            file_path: Path to audio file
            language: Language code (default: 'hi' for Hindi)
            field_name: Field name for context-aware prompts
            
        Returns:
            Dictionary with transcription result
        """
        try:
            path = Path(file_path)
            if not path.exists():
                return {
                    "success": False,
                    "error": f"File not found: {file_path}"
                }
            
            # Read file and convert to base64
            with open(path, 'rb') as f:
                audio_bytes = f.read()
                audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            
            # Determine MIME type from file extension
            ext = path.suffix.lower()
            mime_type_map = {
                '.wav': 'audio/wav',
                '.mp3': 'audio/mp3',
                '.ogg': 'audio/ogg',
                '.mp4': 'audio/mp4',
                '.webm': 'audio/webm'
            }
            mime_type = mime_type_map.get(ext, 'audio/wav')
            
            return self.transcribe_from_base64(audio_base64, mime_type, language, field_name)
            
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to read file: {str(e)}"
            }