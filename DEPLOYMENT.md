# Hosting the migrated stack

## Vercel web

The Vercel project now uses the **Next.js** preset with Root Directory **apps/web**. Install command: `npm ci`; build command: `npm run build`; output: `.next`. The private repository is `KanishkThakar/metrology-scanner`.

Set production `METROLOGY_API_URL` to the backend HTTPS origin (no `/api` suffix), then deploy. Do not place Sarvam keys in Vercel's public frontend environment. Without a hosted API URL the website retains the unavailable/preview state; a rendered frontend is not proof of working hosted OCR.

## Render backend

`Dockerfile.backend` includes native Tesseract, the FastAPI API, Sarvam client and PostgreSQL driver. `render.yaml` specifies a Starter web service and 1 GB persistent disk mounted at `/data`. The previously discussed cost is approximately $7.25/month before tax/overages; recheck Render pricing before changing the plan.

The prepared backend is already in the private repository. Render needs an authenticated account and repository access before the service can be created. No hosted backend URL exists until that deployment succeeds.

1. Connect the private GitHub repository to Render and select the Blueprint or `Dockerfile.backend`.
2. Keep `METROLOGY_DATA_DIR=/data`; the default database is SQLite on the disk.
3. Optionally set `DATABASE_URL` for PostgreSQL; images/PDFs still require persistent storage.
4. Optionally set backend-only `SARVAM_API_KEY` for language and voice.
5. Wait for `/api/health` to respond successfully, then verify a real multi-photo scan and PDF retrieval.
6. Add the Render HTTPS URL as Vercel `METROLOGY_API_URL`, redeploy the frontend and test from the public website.

The advisor remains a scripted FAQ. Complaint handling prepares a draft; it sends no email or official notice. The login is a demo. Add real authenticated per-user access control before collecting personal or confidential data on a public deployment.

## Expo mobile

Run `npm run mobile -- --lan` for Expo Go or create a development/production build with Expo tooling. Configure `EXPO_PUBLIC_API_URL` or use Settings in the app. An Expo bundle is not an App Store/Play Store release; no store submission was requested or performed.
