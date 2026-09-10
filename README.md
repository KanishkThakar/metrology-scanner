---
title: Legal Metrology AI Enforcement Gateway
emoji: ⚖️
colorFrom: blue
colorTo: indigo
sdk: streamlit
sdk_version: 1.40.0
app_file: app.py
pinned: false
license: apache-2.0
short_description: Legal Metrology PCR 2011 Statutory Compliance AI Engine
---

# Metrology platform stack

The current application uses Next.js 16 for web, Expo SDK 57 / React Native for mobile, FastAPI / Python for the API, Tesseract for OCR, SQLite by default or PostgreSQL, and optional Sarvam speech and translation APIs.

See [STACK_MIGRATION.md](STACK_MIGRATION.md) for architecture, setup, feature parity, database migration and verification. Existing scan data stays in `backend/inspections.db`, `backend/uploads` and `backend/reports` unless a persistent data directory is configured. The previous frontend remains in `FRONTEND` for rollback.

```sh
npm ci
uv pip install --python .venv/bin/python -r backend/requirements.txt
npm run api
# In another terminal:
npm run dev -- --port 3001
# In another terminal, for mobile:
npm run mobile -- --lan
```

Open the Next.js app on port 3001 and the API on port 8000. Native phones need your computer's LAN API address or an HTTPS hosted API, configured in the app's Settings. Sarvam requires a backend-only `SARVAM_API_KEY`; built-in language labels and scans work without it.


# National Legal Metrology AI Enforcement Gateway
### Smart India Hackathon 2026 — Problem Statement #26034
> **"Software System to check compliance of Packaged Commodities under Legal Metrology (Packaged Commodities) Rules, 2011 by scanning products, images and labels."**

---

## 🏛️ Executive Summary

Under the **Legal Metrology Act, 2009** and the **Legal Metrology (Packaged Commodities) Rules, 2011 (PCR 2011)**, all pre-packaged commodities sold in the territory of India must bear statutory, tamper-proof declarations on their Principal Display Panel (PDP). Violations such as missing MRP tax declarations, non-SI units (e.g. `gm` or `ltr` instead of standard `g` or `l`), missing manufacturer addresses, missing Unit Sale Price (USP), or charging prices higher than printed MRP attract severe penal liabilities under **Section 36** (fines up to ₹25,000 for a 1st offense, ₹50,000 for a 2nd offense, and imprisonment for subsequent offenses).

This repository contains a package-label screening prototype with deterministic rule checks and OCR uncertainty. The demo login is not production authentication; reports require human review.

---

## ⚡ Key Architectural Features

1. **Deterministic Rule Engine (No LLM Hallucinations)**:
   - AI is strictly restricted to text recognition, multi-orientation decoding, and visual symbol detection.
   - The compliance verdict is 100% deterministic, executed via 10 statutory validation functions backed by a structured SQLite database.

2. **Tesseract OCR Pipeline**:
   - Tesseract LSTM reads package text, confidence scores, and line bounding boxes.
   - Checks quarter-turn orientations when the upright text has few packaging keywords.
   - Boxes map back to the original image; unreadable images return a retry error.
   - English recognition by default. Install additional traineddata and set `TESSERACT_LANG` for other languages.

3. **Symbolic Decoupling & Spacing Normalization**:
   - Decouples dot-matrix inkjet templates: `##` for MRP, `@@` for Net Qty, `@` for Packaging Date, `Δ` / `^` for Unit Sale Price.
   - Cleans spacing variations around composite weight stamps (`155g` vs `155 g`, `105g + 50g EXTRA`), preventing division-by-zero errors in mathematical USP verification (`MRP / Net Quantity`).

4. **Dedicated Regulatory Visual Symbol Detector**:
   - **Vegetarian Symbol**: Green circular dot inside green square border (FSSAI mandatory regulation).
   - **Non-Vegetarian Symbol**: Brown triangle / circle inside brown square.
   - **Recycling & EPR Mark**: Plastic waste management rules & Mobius loop resin codes (PETE 1, HDPE 2).
   - **FSSAI Food Safety Stamp**: 14-digit statutory food safety license registration.
   - **BIS / ISI Mark**: Mandatory certification mark for electronics and electrical appliances.

5. **4-Tier Statutory Compliance Statuses**:
   - `PASS`: Certified Compliant with statutory rules.
   - `FAIL`: Flagged Violations with specific violation error codes and statutory references.
   - `REVIEW REQUIRED`: Ambiguous or partial declarations detected for manual officer review.
   - `EXEMPT`: Statutory exemption applicable (e.g. **Rule 6(11) Second Proviso** for 1 kg / 1 L packs, or **Rule 26** for packs ≤ 10g / 10ml).

6. **Section 63 BSA 2023 / Section 65B IEA 1872 Forensic Evidence Report**:
   - Generates an authentic legal evidence PDF certified under **Section 63 of the Bharatiya Sakshya Adhiniyam (BSA), 2023** and **Section 65B of the Indian Evidence Act, 1872**.
   - Cryptographic **SHA-256 digital evidence hash** embedded on the PDF.
   - Audit Case ID badge (`DoCA-LM-2026-XXXX`).
   - Rule-by-rule evaluation breakdown with penalty clauses under Section 36 of Legal Metrology Act, 2009.

7. **12-Language Localization Engine**:
   - Full dynamic UI and rules re-rendering in:
     **English, Telugu (తెలుగు), Hindi (हिन्दी), Tamil (தமிழ்), Kannada (ಕನ್ನಡ), Malayalam (മലയാളം), Marathi (मराठी), Gujarati (ગુજરાતી), Bengali (বাংলা), Punjabi (ਪੰਜਾਬੀ), Odia (ଓଡ଼ିଆ), Urdu (اردو)**.

8. **Interactive Metrology AI Legal Advisor**:
   - Multi-turn conversational assistant analyzing real-world legal metrology scenarios:
     - Dual pricing and refrigeration/cooling charges at airports or multiplexes (Section 36(3)).
     - Sticky price labels or smudged stickers covering printed MRP.
     - Rule 6(11) USP calculation and Second Proviso exemptions.
     - Direct routing to **National Consumer Helpline (NCH 1915 / 1800-11-4000)** and Department of Consumer Affairs.

9. **1-Click Judge Demonstration Presets**:
   - Built-in instant presets across commodity archetypes:
     - 🌾 **Atta 1 kg**: Compliant, Rule 6(11) Proviso 2 USP Exemption, FSSAI, Veg mark.
     - 🍪 **Biscuits 200 gm**: Violation for non-SI unit `gm` and missing `inclusive of all taxes`.
     - 🥤 **Cola 750 ml**: Compliant with explicit USP ₹0.05/ml, dual volume, and best before date.
     - 🧼 **Sandal Soap 125 g**: Compliant with TFM 76% Grade 1 standard and M-Lic.
     - 🎧 **Wireless Earbuds**: Violation for missing Rule 6(1)(m) Country of Origin.

---

## 📂 Project Structure

```
project/
│
├── backend/
│   ├── main.py                      # FastAPI gateway, OCR pipeline, 10 deterministic checks, PDF generator
│   ├── database.py                  # SQLite schema (WAL mode), thread-safe pooling, PCR 2011 rule seeding
│   ├── test_compliance_engine.py    # Automated unit and integration test suite
│   ├── requirements.txt             # Python dependencies
│   ├── presets/                     # Pre-configured synthetic packaging images for judge presets
│   ├── models/                      # OCR weights storage directory
│   ├── uploads/                     # Secure storage for scanned packaging photos
│   └── reports/                     # Generated Section 63 BSA 2023 / 65B forensic audit PDFs
│
├── frontend/ (or FRONTEND/)
│   ├── index.html                   # Responsive SPA dashboard, 3D canvas login, 1-click presets bar
│   ├── style.css                    # Dual-theme (Light Sky / Dark Cyber), 4-tier badges, responsive styles
│   ├── script.js                    # Multi-origin network probing, 12-language dictionary, bounding boxes, chat
│   └── presets/                     # Static preset packaging image assets
│
├── uploads/
├── reports/
└── README.md
```

---

## 🛠️ Technology Stack

| Layer | Technology | Key Capabilities |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JS | Single-Page Architecture, 3D Floating Packaging Physics, 12 Regional Languages |
| **Backend** | Python 3.10-3.13, FastAPI | Async high-speed processing, auto-mounting static assets, CORS protection |
| **Database** | SQLite + SQLAlchemy | Write-Ahead Logging (WAL) mode, thread-safe connection pooling, automatic rule seeding |
| **OCR Engine** | Tesseract LSTM + pytesseract | Line text, confidence, bounding boxes, quarter-turn orientation checks |
| **Vision & Symbols** | OpenCV & PIL | HSV color segmentation for Veg/Non-Veg symbols, contour hierarchy, recycling & FSSAI marks |
| **Forensic PDF** | ReportLab | Section 63 BSA 2023 / Section 65B IEA certified compliance dossiers with SHA-256 hash |

---

## 🚀 Quick Start Guide

### 1. Setup Python Environment & Dependencies
Open a terminal in the project directory:
```bash
brew install tesseract  # macOS; Linux: apt-get install tesseract-ocr
uv venv --python 3.11 .venv
uv pip install --python .venv/bin/python -r requirements.txt
source .venv/bin/activate
cd backend
```

### 2. Run Automated Test Suite
Verify that all 10 statutory validation functions, symbol detectors, and PDF generators pass:
```bash
python test_compliance_engine.py
```
*Expected output: `ALL AUTOMATED UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!`*

### 3. Launch the Backend Server
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- API Health Endpoint: `http://127.0.0.1:8000/api/health`
- Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

### 4. Launch the Frontend Server
Open a second terminal window:
```bash
cd FRONTEND
python -m http.server 8080 --bind 0.0.0.0
```
Now open your browser and navigate to:
👉 **`http://localhost:8080`** or **`http://127.0.0.1:8080`**

*(The frontend includes active multi-origin network probing to ensure zero connection errors regardless of whether you access via localhost, 127.0.0.1, or local Wi-Fi IP).*

---

## 🎯 1-Minute Live Demo Flow for Judges

1. **Login Gateway**:
   - Experience the **3D Floating Packaged Commodities** canvas background.
   - Click **Citizen Portal** (Mock OTP: `26034`) or **Officer Parichay SSO**.
2. **Instant 1-Click Presets**:
   - In the top presets bar, click **"Atta 1 kg"** -> System instantly analyzes the package, verifies standard units, and displays **`EXEMPT`** under **Rule 6(11) Second Proviso** for Unit Sale Price.
   - Click **"Biscuits 200 gm"** -> System immediately flags **`FAIL`** with error code `NON_SI_UNIT_GM` and `MRP_NO_TAX_DECLARATION`.
   - Click **"Wireless Earbuds"** -> System flags violation under **Rule 6(1)(m)** for missing Country of Origin.
3. **Canvas Visual Bounding Boxes**:
   - View green bounding boxes around compliant statutory declarations and cyan bounding boxes with tags for detected regulatory symbols (Vegetarian mark, FSSAI stamp, Recycling mark).
4. **Download Forensic Section 63 BSA / 65B PDF**:
   - Click **"Download Section 65B/BSA Report PDF"** -> Inspect the official government audit dossier with the SHA-256 evidence hash and Section 36 legal penalty provisions.
5. **12-Language Localization**:
   - Switch language selector to **Telugu (తెలుగు)** or **Hindi (हिन्दी)** -> Notice the dynamic re-rendering of all audit cards, error messages, and statutory rules modal.
6. **Conversational Metrology AI Legal Advisor**:
   - Click **🤖 Metrology AI** at the bottom right.
   - Click the **"❄️ Cooling Charges"** quick chip -> Review the instant legal analysis citing Section 36(3), Supreme Court precedent, and ₹25,000 penalties.
   - Click **"📞 Helpline 1915"** -> See official Department of Consumer Affairs contact channels.

---

## 📜 Legal Mapping: PCR 2011 & Legal Metrology Act, 2009

| Statutory Rule | Parameter Checked | Mandatory Condition / Exemption | Error Code |
| :--- | :--- | :--- | :--- |
| **Rule 6(1)(e)** | Maximum Retail Price (MRP) | Mandatory ₹ currency & 'inclusive of all taxes' | `MRP_NO_TAX_DECLARATION` |
| **Rule 6(1)(c)** | Net Quantity & Metric Units | Strictly standard SI units (`g`, `kg`, `ml`, `l`) | `NON_SI_UNIT_GM` / `NON_SI_UNIT_LTR` |
| **Rule 6(1)(d)** | Month & Year of Mfg/Packing | Clear `MM/YYYY` or Best Before timeline | `MFG_DATE_MISSING` |
| **Rule 6(1)(a)** | Manufacturer / Packer Name | Corporate identity on Principal Display Panel | `MANUFACTURER_MISSING` |
| **Rule 6(1)(a)** | Geographical Address | Complete address with postal PIN code | `MANUFACTURER_ADDRESS_MISSING` |
| **Rule 6(1)(n)** | Consumer Grievance Contact | Telephone/Toll-Free number, email, or care cell | `CONSUMER_CARE_MISSING` |
| **Rule 6(11)** | Unit Sale Price (USP) | Declared in ₹/g or ₹/ml (<1kg/<1L) or ₹/kg (>1kg) | `USP_NOT_DECLARED` |
| **Rule 6(11) Proviso 2**| 1 kg / 1 L / 1 Unit Exemption | Separate USP not required if Net Qty = 1kg / 1L | `EXEMPT` |
| **Rule 6(1)(m)** | Country of Origin | Mandatory for Electronics & Imported goods | `COUNTRY_OF_ORIGIN_MISSING` |
| **Rule 7, Table II** | Min Numeral Height | Calculated from Principal Display Panel area | `FONT_HEIGHT_SUB_STATUTORY` |
| **Section 63 BSA / 65B**| Forensic Digital Hash | SHA-256 cryptographic digest for legal evidence | Certified Electronic Record |

---

## ⚖️ National Consumer Escalation Channels

- **National Consumer Helpline (NCH)**: Toll-Free **1915** or **1800-11-4000**
- **SMS Redressal**: **8800001915**
- **INGRAM Grievance Portal**: [consumerhelpline.gov.in](https://consumerhelpline.gov.in/)
- **Department of Consumer Affairs**: [lm.doca.gov.in](https://lm.doca.gov.in/) | `enforcement@doca.gov.in`

---
*Developed for Smart India Hackathon 2026 — Ministry of Consumer Affairs, Food & Public Distribution.*

### Multiple package photos
The web scanner accepts up to 8 images of the same package (15 MB each, 60 MB total). Add front, back and side photos in separate selections, drag them together, or capture more camera frames. Remove a photo with its × button. Tesseract reads each image and combines the text into one audit and labeled contact sheet. Original image bytes and a per-photo hash/text manifest are retained in uploads. Multi-photo font scale requires manual review. The API accepts repeated `files` multipart fields and still accepts the original single `file` field.

### OCR verification and uncertainty
Scanning retains up to a 2400-pixel image edge, checks quarter-turn orientation, and performs a second contrast/scale pass on difficult text. Price regions are re-read using grayscale, thresholded and joined-stroke images, with the pinned official `tessdata_best` English model providing another reading. It does not apply product-specific price replacements.

Conflicting or weak price readings return `REVIEW`; dependent unit-price calculations are withheld. The UI exposes the individual price readings. Different prices across photos also require review. English OCR is not a guarantee of correct recognition on every label; unclear fields still need a close-up or human verification.

Run the OCR regressions with `.venv/bin/python -m unittest discover -s backend -p 'test_*ocr.py'` and `.venv/bin/python -m unittest discover -s backend -p test_tesseract.py`.
