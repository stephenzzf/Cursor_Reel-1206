# VEO 3.1 Video Generation Service

## Overview
This service integrates Google's Veo 3.1 model for text-to-video and image-to-video generation.

## Features
- **Text-to-Video**: Generate videos from text prompts.
- **Image-to-Video**: Generate videos using a reference image (Start Frame).
- **Cloud Archiving**: Automatically uploads reference images to Firebase Storage and tracks metadata in Firestore.
- **Memory Bridging**: Efficiently handles image data in memory without local disk I/O.

## API Endpoints

### `POST /api/video/generate`

**Payload:**
```json
{
  "prompt": "Cinematic shot of...",
  "images": [
    { "data": "base64...", "mimeType": "image/jpeg" }
  ],
  "modelName": "veo_fast", // or "veo_gen"
  "aspectRatio": "16:9"
}
```

**Note on Start/End Frames:**
Currently, the API gracefully handles multiple images but **only uses the first image** as a reference (Start Frame) due to pending API documentation for the "Start/End Frame Interpolation" feature in `veo-3.1-generate-preview`. Support for interpolation will be enabled once the correct payload structure is confirmed.

## Configuration
Ensure `.env` contains:
- `GEMINI_API_KEY`: Google AI Studio API Key
- `FIREBASE_CREDENTIALS_PATH` or `FIREBASE_CREDENTIALS_JSON`: Firebase Service Account
- `FIREBASE_STORAGE_BUCKET`: Firebase Storage Bucket Name

## Testing
Run E2E test:
```bash
python3 e2e_test_video_backend_dual.py
```

