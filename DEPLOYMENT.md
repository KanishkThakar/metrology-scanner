# Hosting the migrated stack

## Vercel web

The Vercel project now uses the **Next.js** preset with Root Directory **apps/web**. Install command: `npm ci`; build command: `npm run build`; output: `.next`. The private repository is `KanishkThakar/metrology-scanner`.

Set production `METROLOGY_API_URL` to the backend HTTPS origin (no `/api` suffix), then deploy. Do not place Sarvam keys in Vercel's public frontend environment. Without a hosted API URL the website retains the unavailable/preview state; a rendered frontend is not proof of working hosted OCR.

## Render backend

`Dockerfile.backend` includes native Tesseract, the FastAPI API, Sarvam client and PostgreSQL driver. `render.yaml` uses only the **free** web-service plan in Singapore, as requested. There is no paid disk or paid database. `OMP_THREAD_LIMIT=1` avoids competing Tesseract worker threads on the small CPU.

The prepared backend is already in the private repository. The Render CLI is authenticated. Private repository access must also be granted to the Render GitHub App before a Git deployment can succeed.

1. Connect the private GitHub repository to Render and select the Blueprint or `Dockerfile.backend`.
2. Keep `METROLOGY_DATA_DIR=/data`; the default database is SQLite in the free instance's temporary filesystem.
3. Optionally set `DATABASE_URL` for PostgreSQL; images/PDFs still require persistent storage.
4. Optionally set backend-only `SARVAM_API_KEY` for language and voice.
5. Wait for `/api/health` to respond successfully, then verify a real multi-photo scan and PDF retrieval.
6. Add the Render HTTPS URL as Vercel `METROLOGY_API_URL`, redeploy the frontend and test from the public website.

Free Render servers sleep after inactivity and may take about a minute to wake. The web client keeps the selected photos while connecting and checks that the response is real API health, not Render's loading HTML. **Hosted SQLite records, photos and reports are lost when the free service sleeps, restarts or redeploys. Download reports and history exports before that happens.** The local Developer folder and its original database remain intact. See [Render's free-instance limits](https://render.com/docs/free).

The advisor remains a scripted FAQ. Complaint handling prepares a draft; it sends no email or official notice. The login is a demo. Add real authenticated per-user access control before collecting personal or confidential data on a public deployment.

## Expo mobile

Run `npm run mobile -- --lan` for Expo Go or create a development/production build with Expo tooling. Configure `EXPO_PUBLIC_API_URL` or use Settings in the app. An Expo bundle is not an App Store/Play Store release; no store submission was requested or performed.
