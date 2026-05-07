"""
Flask API Server for Speech-to-Text
A Python Flask implementation that replaces the Next.js /api/speech-to-text route
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv, find_dotenv

# Load environment variables from .env or .env.local
load_dotenv(find_dotenv('.env.local'))
load_dotenv(find_dotenv('.env'))

from speech_to_text import GroqSpeechToText

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

# Initialize the speech-to-text client
try:
    stt_client = GroqSpeechToText()
except ValueError:
    print("Warning: GROQ_API_KEY not found. Set it as environment variable.")
    stt_client = None

@app.route('/api/speech-to-text', methods=['POST'])
def speech_to_text():
    """
    POST /api/speech-to-text
    Transcribe audio using Groq's Whisper Large v3 model
    
    Expected JSON payload:
    {
        "audio": "base64_encoded_audio_data",
        "mimeType": "audio/wav",  // optional, defaults to "audio/wav"
        "language": "hi",        // optional, defaults to "hi"
        "fieldName": ""          // optional, for context-aware prompts
    }
    """
    
    if not stt_client:
        return jsonify({
            "error": "Speech-to-text service not configured. GROQ_API_KEY is missing."
        }), 500
    
    try:
        # Parse JSON data
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
        
        audio = data.get('audio')
        if not audio:
            return jsonify({"error": "Audio data is required"}), 400
        
        mime_type = data.get('mimeType', 'audio/wav')
        language = data.get('language', 'hi')
        field_name = data.get('fieldName', '')
        
        # Transcribe the audio
        result = stt_client.transcribe_from_base64(
            audio_base64=audio,
            mime_type=mime_type,
            language=language,
            field_name=field_name
        )
        
        # Return the result
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            "error": "Failed to process speech-to-text",
            "message": str(e)
        }), 500

@app.route('/api/speech-to-text/file', methods=['POST'])
def speech_to_text_file():
    """
    POST /api/speech-to-text/file
    Transcribe audio file upload
    
    Expected form data:
    - file: audio file
    - language: language code (optional, defaults to "hi")
    - fieldName: field name for context (optional)
    """
    
    if not stt_client:
        return jsonify({
            "error": "Speech-to-text service not configured. GROQ_API_KEY is missing."
        }), 500
    
    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Get optional parameters
        language = request.form.get('language', 'hi')
        field_name = request.form.get('fieldName', '')
        
        # Read file content and convert to base64
        import base64
        import io
        
        # Save file temporarily and process
        file_content = file.read()
        audio_base64 = base64.b64encode(file_content).decode('utf-8')
        
        # Determine MIME type
        mime_type = file.content_type or 'audio/wav'
        
        # Transcribe the audio
        result = stt_client.transcribe_from_base64(
            audio_base64=audio_base64,
            mime_type=mime_type,
            language=language,
            field_name=field_name
        )
        
        # Return the result
        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            "error": "Failed to process speech-to-text",
            "message": str(e)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "speech-to-text",
        "groq_configured": stt_client is not None
    }), 200

@app.route('/', methods=['GET'])
def home():
    """Root endpoint with API information"""
    return jsonify({
        "service": "Vaani AI Speech-to-Text Service",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/speech-to-text": "Transcribe base64 audio data",
            "POST /api/speech-to-text/file": "Transcribe uploaded audio file",
            "GET /health": "Health check",
            "GET /": "This information"
        },
        "groq_configured": stt_client is not None
    })

if __name__ == '__main__':
    # Set up environment
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    print(f"Starting Vaani AI Speech-to-Text Service on port {port}")
    print(f"Debug mode: {debug}")
    print(f"Groq API configured: {stt_client is not None}")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )