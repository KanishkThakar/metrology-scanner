# Hosted setup

The Vercel project serves `FRONTEND`. The Python API needs native Tesseract and persistent storage; `Dockerfile.backend` and `render.yaml` provide that service.

1. Connect the private GitHub repo to Render and review the Blueprint. It requests a Starter web service and 1 GB disk (paid resources; obtain owner approval before provisioning).
2. Wait for `/api/health` on the Render URL to report Tesseract online.
3. Set Vercel production `METROLOGY_API_URL` to the HTTPS Render origin, then redeploy. Do not append `/api`.
4. Verify multi-photo scans, PDF links, history across restart, rules, presets, and advisor responses on the public site.

The advisor is a scripted FAQ, not a configured generative model. Complaint handling prepares a draft; it does not send email or submit to government systems. Login remains a demo login. Before collecting real user data, add authenticated per-user access control to history and evidence routes.

Do not represent the static frontend alone as a functioning hosted scanner. Keep the unavailable state until the API is actually connected.

Upstream: https://github.com/abhiramlabs/Metrology-.git
