# NyayaLens voice conversation

Open **Talk to NyayaLens** on the website, or **Advisor → Talk with AI** in the Expo app. Speak or type a question. Sarvam transcribes speech, generates a multi-turn answer, then speaks the reply. The existing Quick FAQ remains available separately.

- Saaras v3 speech recognition with automatic language detection.
- Sarvam 105B Conversations for bounded conversational replies.
- Bulbul v3 speech output, with Ritu, Shubh, Priya and Aditya voices.
- Hindi, English and nine other supported Indian speech languages.
- Optional hands-free turn taking: listen again only after reply playback finishes.
- Browser pause detection; native pause detection when audio metering is supported. Finish speaking always submits manually. Expo web uses manual finish.
- Stop, interrupt, clear history, typed input and replay controls. Closing the panel, leaving the app voice view, or backgrounding stops capture/playback.
- Optional saved scan context, loaded on the server. The model can explain preliminary results with rule references; it cannot change scan results or authenticate a product.

## Server configuration

Keep `SARVAM_API_KEY` in the backend `.env` locally, and the Render service environment when hosted. Never use a `NEXT_PUBLIC_` or `EXPO_PUBLIC_` key. `SARVAM_CHAT_MODEL` defaults to `sarvam-105b-conversations`; `sarvam-105b` is also allowed. Restart/redeploy the backend after rotating credentials. The frontend needs only the API origin.

GET `/api/voice/capabilities` reports configuration without exposing credentials. POST `/api/voice/reply` accepts a message (up to 1,500 characters), up to eight previous user/assistant messages, a supported reply language or `auto`, and an optional saved inspection ID. Speech uses `/api/language/transcribe` and `/api/language/speak`. No model-generated HTML is inserted into the UI.

The public demo applies a process-local budget of 30 provider requests per client per minute and 300 per hour overall, shared across conversation, speech and translation. A spoken turn normally uses three provider requests. These budgets do not replace account-level provider spending controls and reset with the process. Hosting remains on the existing free service; provider API usage uses the configured Sarvam account.

## Verification

`cd backend && ../.venv/bin/python -m unittest test_language test_voice`

`npm run test:contracts && npm run typecheck && npm run build`

`npx playwright test tests/voice-assistant.spec.ts tests/voice-mobile.spec.ts`

Live provider checks require explicit `VOICE_LIVE=1`. The browser recording check also requires `VOICE_MIC=1` and an untracked PCM WAV speech fixture at `work/voice-microphone-fixture.wav`. It injects that recording as a simulated microphone stream, then uses real MediaRecorder, pause detection, backend recognition, conversation and audio playback. It is not evidence of a physical phone microphone test. Expo iOS/Android bundles should be exported and separately tested on devices before a native release.

Provider errors are displayed as errors; a written model reply remains visible if voice generation or browser autoplay fails. No transcript is uploaded when browser silence detection hears no speech. The feature is an AI assistant, not AGI, and its explanations require review.
