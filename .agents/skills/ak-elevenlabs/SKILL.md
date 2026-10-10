---
name: ak:elevenlabs
description: Generate speech, clone voices, create sound effects & music with ElevenLabs API. TTS, voice design, audio generation, conversational AI agents.
user-invocable: true
when_to_use: "Invoke to generate speech, clone voices, or create sound effects with ElevenLabs."
category: media
keywords: [elevenlabs, speech, voice, tts, sound-effects]
argument-hint: "[action: speak|clone|sfx] [text-or-file]"
metadata:
  author: agentkit
  version: "1.0.2"
---

# ElevenLabs

AI audio generation platform for text-to-speech, voice cloning, sound effects, music, and conversational AI agents.

## Resolve the Audio Task

Choose TTS, voice design, cloning, sound effects/music, or a voice agent. Inspect the installed SDK/CLI and available authorized provider capability; verify supported models, voice IDs, formats, and account permissions before a call. Do not install both SDKs or assume a key exists.

Read only the matching guide below. `references/available-models.md` is background material, not a live model inventory; use current provider evidence for availability, price, limits, and latency. For TTS, use the supplied language, voice preference, pronunciation, and text. For cloning, establish the speaker's consent and permitted use of the recording before upload or voice creation.

Save and inspect the actual audio: spoken text/language, duration, format, and audible artifacts. A failed or unavailable API produces an explicit limitation, never a claimed generated file.

## Core Capabilities

### 1. Text-to-Speech
Convert text to lifelike audio. See `references/text-to-speech-guide.md` for:
- Voice settings (stability, similarity, speed)
- SSML tags for pauses/pronunciation
- Emotional control techniques
- Output formats & streaming

### 2. Voice Cloning
Clone voices instantly or professionally. See `references/voice-cloning-guide.md` for:
- Instant clone (1-2 min audio)
- Professional clone (30+ min audio)
- Recording best practices

### 3. Voice Design
Create voices from text prompts. See `references/voice-design-prompting-guide.md` for:
- Prompt templates & examples
- Attribute controls (age, accent, tone)

### 4. Sound Effects & Music
Generate audio from descriptions. See `references/sound-effects-and-music-generation-guide.md` for:
- Sound effect prompts (max 30s)
- Music composition (10s-5min)
- Looping audio

### 5. Conversational AI Agents
Build voice agents. See `references/conversational-ai-agents-guide.md` for:
- Python/JS SDK setup
- WebSocket streaming
- Phone integration (Twilio, SIP)

## Scripts

| Script | Purpose |
|--------|---------|
| `elevenlabs-text-to-speech-generator.py` | Text-to-speech generation |
| `elevenlabs-voice-manager.py` | List/manage voices |
| `elevenlabs-voice-cloner.py` | Voice cloning |
| `elevenlabs-sound-effects-generator.py` | Sound effects generation |

## Audio Quality

Choose a voice that fits the brief, tune pronunciation and pacing from listening evidence, and reuse valid audio for identical text/settings. Select streaming only when the application needs it. Model pricing and latency require current provider evidence; do not repeat historical values as guarantees.

## Resources

- [API Docs](https://elevenlabs.io/docs)
- [Voice Library](https://elevenlabs.io/voice-library)
- [Models Reference](https://elevenlabs.io/docs/overview/models)
