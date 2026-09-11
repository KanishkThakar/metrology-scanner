# Hosting the migrated stack

## Vercel web

The Vercel project now uses the **Next.js** preset with Root Directory **apps/web**. Install command: `npm ci`; build command: `npm run build`; output: `.next`. The private repository is `KanishkThakar/metrology-scanner`.

Set production `METROLOGY_API_URL` to the backend HTTPS origin (no `/api` suffix), then deploy. Do not place Sarvam keys in Vercel's public frontend environment. Without a hosted API URL the website retains the unavailable/preview state; a rendered frontend is not proof of working hosted OCR.

## Render backend — free plan

Backend origin: **https://metrology-scanner-api.onrender.com**. Service ID: `srv-dahsk4id0e5s738ov9qg` (Singapore). No paid disk or paid database is provisioned.

The live service uses an official Python container pinned by digest. The application source is uploaded privately through Render's API as a checksum-verified secret-file bundle. This avoids granting Render access to the GitHub repository. The bundle contains only committed backend/frontend code and demo presets; local databases, reports, user photos and credentials are excluded. The backend includes selectable PaddleOCR, Tesseract and combined modes. Existing rule checks and report flows are retained. The scan endpoint runs its blocking OCR work in a worker thread, leaving health checks responsive; a second simultaneous scan receives a clear HTTP 429 response to keep memory bounded on the free instance.

At startup `scripts/render-runtime-bootstrap.py` installs native Tesseract, the pinned PaddleOCR mobile models, and Python dependencies pinned to the working local versions, restores the demo images, verifies the pinned `tessdata_best` model's SHA-256 and starts FastAPI. Startup on the free CPU can take several minutes. `TESSERACT_TIMEOUT_SECONDS=120` allows difficult photos to complete on that CPU while local OCR retains its 20-second per-pass default. `OMP_THREAD_LIMIT=1` and `OPENBLAS_NUM_THREADS=1` prevent excess worker threads. Render health checks succeed only once both OCR engines and the database are ready.

### Update the deployed API

From the clean publishing checkout, commit the intended changes first. The deploy script uploads **HEAD**, so uncommitted files are not published:

```sh
# Use the project Python environment containing httpx and PyYAML.
python scripts/deploy-render-api.py --prepare-only
python scripts/deploy-render-api.py
```

The script uses the signed-in Render CLI account (or `RENDER_API_KEY`) without printing credentials. It refuses to update a paid service or an unrelated Git-backed service, preserves unrelated environment variables and uploads only its two managed secret files. No GitHub push automatically updates this image-backed Render service; run the script after committing backend changes. `render.yaml` and `Dockerfile.backend` remain available for conventional Git-backed deployment after repository access is connected.

Set Vercel production `METROLOGY_API_URL` to the HTTPS backend origin without `/api`, then redeploy the frontend. The web browser calls Render directly for image uploads and report downloads.

### Free hosting behavior

Free Render instances sleep after inactivity. Their SQLite records, uploaded images and PDFs are lost when the service sleeps, restarts or redeploys. Download reports and export history while the instance is active. Original local data stays in the Developer folder. See [Render's free-instance limits](https://render.com/docs/free).

Built-in language labels, both OCR engines, PDF generation and the scripted FAQ do not need paid API keys. Sarvam voice and translation need a backend-only `SARVAM_API_KEY`; they remain unavailable until configured. Complaint handling prepares a draft and sends no email or official notice. The existing login is a demo; add authenticated per-user access control before collecting confidential data publicly.

## Expo mobile

Run `npm run mobile -- --lan` for Expo Go or create a development/production build with Expo tooling. Configure `EXPO_PUBLIC_API_URL` or use Settings in the app. An Expo bundle is not an App Store/Play Store release; no store submission was requested or performed.
