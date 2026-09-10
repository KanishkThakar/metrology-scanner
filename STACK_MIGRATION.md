# Stack migration

The requested architecture is implemented in the same repository:

| Layer | Implementation |
| --- | --- |
| Web | `apps/web`: Next.js 16.3.4 App Router, React 19.2.3, TypeScript |
| Mobile | `apps/mobile`: Expo SDK 57, React Native 0.86.3, TypeScript |
| Backend | Existing FastAPI / Python API in `backend` |
| OCR | Existing Tesseract multi-pass engine, pinned tessdata_best price verification |
| Data | Existing SQLite database by default; PostgreSQL via SQLAlchemy + Psycopg 3 |
| Language | Backend-only Sarvam translation, speech recognition and speech synthesis |
| Shared | `packages/core`: API contracts/client, photo limits, language codes, existing language/geography catalog |

## Preserved behavior

The Next.js page renders the previous interface as JSX and loads its existing scanner controllers through a React lifecycle boundary. Event listeners, timers, animation frames and camera tracks are cleaned up on unmount. This intentionally preserves the proven camera/canvas/scan workflow during the framework migration. `FRONTEND` remains available as the rollback UI through FastAPI.

The OCR module, price consensus behavior, all rule checks and the PDF generator are unchanged. Uncertain prices remain REVIEW; translations do not modify stored evidence, numerical values or audit decisions.

Preserved web features: citizen/officer demo modes, guided tour, state/district/PIN and GPS selection, 12 built-in language labels, light/dark themes, five categories and demo presets, multi-photo file/drop/camera input, photo removal and preview, package area, OCR boxes and detected marks, rule results and price readings, PDF links, complaint drafts, packaging FAQ, inspection history/search/filter and CSV/JSON export.

Expo provides native gallery selection, camera capture, the same multi-photo API, category/presets, audit cards and OCR evidence, PDF sharing, complaint drafts, FAQ, officer history/search/filter/exports, jurisdiction/GPS, language selection and theme. Native permissions are requested when the corresponding action is used. Use the backend URL setting for a physical phone; loopback addresses refer to that phone.

## Run locally

Requires Node >=22.13, Python 3.11, and native Tesseract with English data.

```sh
npm ci
uv venv .venv --python 3.11  # only if .venv does not already exist
uv pip install --python .venv/bin/python -r backend/requirements.txt
npm run api
```

In separate terminals:

```sh
npm run dev -- --port 3001
npm run mobile -- --lan
```

Web: `http://127.0.0.1:3001`. API and existing fallback UI: `http://127.0.0.1:8000`. API binds to all interfaces by default for phone testing; set `API_HOST=127.0.0.1` for loopback only. The Expo CLI displays its development URL/QR code. On a physical phone set `EXPO_PUBLIC_API_URL` to your computer's LAN API URL or change Settings in the app.

The API launcher always opens the existing `backend/inspections.db`, regardless of the shell's working directory. `METROLOGY_DATA_DIR` overrides the storage directory for the database, uploads and PDFs.

## Sarvam

Put `SARVAM_API_KEY` in the repository `.env` or backend host environment, then restart the API. Never put it in `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`. The checked-in `.env.example` files contain no credentials.

- `GET /api/language/capabilities` reports configuration and supported languages.
- `POST /api/language/translate`: Sarvam Translate v1, including Odia (`od-IN`) and Urdu.
- `POST /api/language/transcribe`: Saaras v3, a short multipart audio recording.
- `POST /api/language/speak`: Bulbul v3, WAV output; the supported speech languages exclude Urdu.

The web's Language & voice panel translates the audit into the selected language, records speech and prepares audio playback. Mobile also supports translated FAQ questions/replies when configured. Original English FAQ behavior and all built-in UI translations work without a key. The FAQ is still scripted, not a generative legal model. Provider errors are explicit and never turn into invented successful responses.

Provider docs: [translation](https://docs.sarvam.ai/api-reference/text/translate-text), [speech recognition](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe), [speech synthesis](https://docs.sarvam.ai/api-reference/text-to-speech/convert).

## Optional PostgreSQL migration

SQLite remains active. No production database was converted. A test copy verified all 29 baseline inspection records, IDs, rule JSON and PDFs, and successful insertion of scan ID 30.

To switch later, provision an empty PostgreSQL database and keep your source backup. Set `TARGET_DATABASE_URL` in the shell without committing it, then run:

```sh
.venv/bin/python scripts/migrate-database.py --source backend/inspections.db
```

The helper refuses a populated target and reads SQLite in read-only mode. Copy `uploads/` and `reports/` into the new persistent `METROLOGY_DATA_DIR`; the database URL alone does not transfer image/PDF files. Set the API's `DATABASE_URL` to the new PostgreSQL URL, restart it and check history/PDF links. `postgres://`, `postgresql://` and `postgresql+psycopg://` are supported. Keep the source SQLite file for rollback.

## Verification

```sh
npm run typecheck
npm run build
npm run test:contracts
.venv/bin/python -m unittest discover -s backend -p 'test_price_ocr.py'
.venv/bin/python -m unittest discover -s backend -p 'test_tesseract.py'
.venv/bin/python -m unittest discover -s backend -p 'test_language.py'
# Start a separate API with an isolated METROLOGY_DATA_DIR before web QA.
# Configure apps/web/.env.local to point to the same API.
TEST_WEB_URL=http://127.0.0.1:3001 TEST_API_URL=http://127.0.0.1:8011 npm run test:web
```

The browser test creates synthetic split-package fixtures from the repository preset. Set `OCR_COFFEE_IMAGE` to a local JPEG of the reference coffee label to also check the real ₹99 regression. Personal package photos are not committed. Browser QA writes test inspections into the selected test API database.

Fresh checks completed during migration:

- Original Tesseract and 12 rule/PDF functions unchanged; real Atta scan responses match the pre-migration baseline.
- Seven existing OCR/price tests, five Sarvam contract/failure tests, three shared-client tests.
- Next.js production build and both app type checks.
- Expo iOS/Android/web bundles and 21/21 Expo Doctor checks.
- Real browser sign-in, theme/language/rules, two-photo scan, PDF/original evidence, complaint draft, FAQ, history/export, and real coffee ₹99 REVIEW.
- Real iOS simulator sign-in, native file upload, successful scan, rule rendering and native PDF sharing preview.
- PostgreSQL copy preserved 29 baseline records, JSON payloads and PDF access; new scan and sequence worked.

Live Sarvam inference remains unverified because this project has no API key. Physical-device camera, GPS and microphone capture need a device permission test; simulator/API checks do not establish physical hardware behavior. Render deployment remains blocked on account connection. The existing demo login remains unsuitable for collecting real personal data without authenticated per-user access control.
