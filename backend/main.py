import sys
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

import re
import math
import uuid
import hashlib
import json
from contextlib import asynccontextmanager
from threading import BoundedSemaphore
from typing import List, Dict, Any, Optional, Tuple, Literal
from time import perf_counter
from datetime import datetime, timezone

from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text
from barcode_identity import router as barcode_identity_router
from voice import router as voice_router
from language import router as language_router
import cv2
import numpy as np
from ocr import ENGINE_NAME, init_ocr_engine, extract_text
from paddle_engine import PADDLE_AVAILABLE, PADDLE_MODEL, init_paddle_engine, extract_paddle

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors

# Cloud runtime stores the database, evidence and reports on the mounted disk.
if os.environ.get("METROLOGY_DATA_DIR"):
    os.makedirs(os.environ["METROLOGY_DATA_DIR"], exist_ok=True)
    os.chdir(os.environ["METROLOGY_DATA_DIR"])

from database import engine, get_db, InspectionRecord, ComplianceRule, FontHeightThreshold, seed_database

# ---------------------------------------------------------------------------
# GLOBAL OCR ENGINE CONFIGURATION WITH GRACEFUL FALLBACK TO OFFLINE WEIGHTS
# ---------------------------------------------------------------------------
ocr_engine_name: str = ENGINE_NAME

# ANSI Terminal Color Formatting for Government Console Logging
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_database()
    init_ocr_engine()
    if PADDLE_AVAILABLE:
        init_paddle_engine()
    print(f"\n{CYAN}{BOLD}{'='*75}{RESET}")
    print(f"{CYAN}{BOLD}⚖️   GOVERNMENT OF INDIA — DEPARTMENT OF CONSUMER AFFAIRS{RESET}")
    print(f"{CYAN}{BOLD}    LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011{RESET}")
    print(f"{BOLD}    Universal Automated Compliance AI Engine — SIH Problem Statement #26034{RESET}")
    print(f"{CYAN}{'-'*75}{RESET}")
    print(f"    ● Node Identity:          26034-DOCA-CENTRAL-AI")
    print(f"    ● Active OCR Engine:      {ocr_engine_name}")
    print(f"    ● Evidence Admissibility: Section 63 BSA 2023 / Section 65B IEA 1872")
    print(f"    ● Local Backend Host:     http://127.0.0.1:8000")
    print(f"    ● Interactive Swagger UI: http://127.0.0.1:8000/docs")
    print(f"    ● ReDoc Architecture:    http://127.0.0.1:8000/redoc")
    print(f"    ● Health & Diagnostics:   http://127.0.0.1:8000/api/v1/health")
    print(f"    ● SQLite Storage:         data/inspections.db (WAL Mode)")
    print(f"{CYAN}{BOLD}{'='*75}{RESET}\n")
    yield
    print(f"{YELLOW}[SHUTDOWN] Legal Metrology Gateway Terminated.{RESET}")

app = FastAPI(
    title="National Legal Metrology Multi-Category AI Gateway",
    description="Universal PCR 2011 Automated Inspection Gateway (SIH #26034)",
    version="20.0.0",
    lifespan=lifespan
)

app.include_router(voice_router)
app.include_router(language_router)
app.include_router(barcode_identity_router)

# Open CORS to eliminate loopback and browser connection errors across origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

os.makedirs("uploads", exist_ok=True)
os.makedirs("reports", exist_ok=True)
os.makedirs("models", exist_ok=True)
os.makedirs("presets", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/reports", StaticFiles(directory="reports"), name="reports")
app.mount("/presets", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "presets")), name="presets")

@app.get("/api/v1/health")
@app.get("/api/health")
def health_check():
    """System health & diagnostic telemetry for judiciary and inspection officers."""
    try:
        with engine.connect() as connection:
            connection.execute(sql_text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status":"UNAVAILABLE", "error":"Database unavailable"})
    return {
        "status": "ONLINE",
        "node_id": "26034-DOCA-CENTRAL-AI",
        "service": "National Legal Metrology Enforcement AI Engine",
        "authority": "Department of Consumer Affairs (DoCA), Government of India",
        "statutory_act": "Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011",
        "evidence_framework": "Section 63 Bharatiya Sakshya Adhiniyam, 2023 / Section 65B Indian Evidence Act",
        "ocr_engine": ocr_engine_name,
        "ocr_engines": {"tesseract": True, "paddleocr": PADDLE_AVAILABLE, "hybrid": PADDLE_AVAILABLE},
        "paddle_model": PADDLE_MODEL if PADDLE_AVAILABLE else None,
        "database": engine.dialect.name,
        "language_provider": "Sarvam",
        "language_configured": bool(os.getenv("SARVAM_API_KEY", "").strip()),
        "swagger_docs": "/docs",
        "redoc_docs": "/redoc",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ---------------------------------------------------------------------------
# CORE UTILITY & FORENSIC FUNCTIONS
# ---------------------------------------------------------------------------
def compute_sha256(data: bytes) -> str:
    """Computes SHA-256 digest for Section 63 BSA 2023 / Section 65B IEA evidence."""
    return hashlib.sha256(data).hexdigest()

def normalize_text_spacing(text: str) -> str:
    """
    Normalizes spacing variations around composite weight stamps and units:
    e.g., '155g' -> '155 g', '750ml' -> '750 ml', '1.5kg' -> '1.5 kg', '100gm' -> '100 gm'.
    Prevents token clumping and guarantees deterministic regex parsing.
    """
    if not text:
        return ""
    # Standardize currency
    norm = text.replace("₹", "Rs. ").replace("`", "").replace("~", "").replace("Rs.", "Rs. ")
    norm = norm.replace("|", "/").replace("\\", "/")
    
    # Normalize unit spacing: 155g -> 155 g, 155 g -> 155 g
    norm = re.sub(r'(\d+(?:\.\d+)?)\s*(kg|kilograms?|grams?|gm|gms|g|ml|millilitres?|ltr|litres?|l|units?|pieces?|cm|m)\b', r'\1 \2', norm, flags=re.IGNORECASE)
    # Normalize price spacing: Rs.50 -> Rs. 50, ##50 -> ## 50
    norm = re.sub(r'(Rs\.?|INR|##|#)\s*(\d+)', r'\1 \2', norm, flags=re.IGNORECASE)
    return norm

def get_required_font_height_mm(area_sq_cm: float) -> float:
    """Rule 7, Table II minimum numeral height thresholds."""
    if area_sq_cm <= 50.0:
        return 1.0
    elif area_sq_cm <= 100.0:
        return 1.5
    elif area_sq_cm <= 500.0:
        return 2.5
    elif area_sq_cm <= 2500.0:
        return 4.0
    else:
        return 6.0

def measure_actual_font_height_mm(ocr_data: List[Dict[str, Any]], package_area: float, orig_w: int, orig_h: int) -> float:
    """Calculates actual median numeral height in millimetres from bounding box geometry."""
    numeral_heights_px = []
    for item in ocr_data:
        text = str(item.get("text", ""))
        bbox = item.get("bbox", [])
        if re.search(r"[0-9]", text) and len(bbox) == 4:
            try:
                h_px = float(((bbox[3][1] - bbox[0][1]) + (bbox[2][1] - bbox[1][1])) / 2.0)
                if h_px > 4.0:
                    numeral_heights_px.append(h_px)
            except Exception:
                continue

    if not numeral_heights_px or orig_w <= 0 or orig_h <= 0:
        return 2.5

    total_area_sq_mm = float(package_area) * 100.0
    total_pixels = float(orig_w * orig_h)
    mm_per_pixel = math.sqrt(total_area_sq_mm / total_pixels)
    median_px = float(np.median(numeral_heights_px))
    return float(round(median_px * mm_per_pixel, 2))

# ---------------------------------------------------------------------------
# VISUAL SYMBOL & REGULATORY MARK DETECTOR
# ---------------------------------------------------------------------------
def detect_symbols(img_bgr: np.ndarray, full_text: str) -> List[Dict[str, Any]]:
    """
    Detects packaging symbols and regulatory marks:
    1. Vegetarian Stamp (Green Circle in Green Square)
    2. Non-Vegetarian Stamp (Brown Triangle / Circle in Brown Square)
    3. Recycling Mark / Resin Code (Mobius Loop / PETE / HDPE)
    4. FSSAI Certification Stamp / Logo
    5. ISI / BIS Certification Mark
    6. Dot-Matrix Inkjet Batch Markers (##, @@, @, Δ)
    """
    symbols = []
    h, w = img_bgr.shape[:2]
    
    # Color-based mark detection in HSV space
    try:
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        
        # 1. Green Vegetarian Dot in Square
        lower_green = np.array([35, 60, 60])
        upper_green = np.array([85, 255, 255])
        green_mask = cv2.inRange(hsv, lower_green, upper_green)
        green_contours, _ = cv2.findContours(green_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        has_veg_contour = False
        for cnt in green_contours:
            area = cv2.contourArea(cnt)
            if 100 < area < (h * w * 0.08):
                x, y, cw, ch = cv2.boundingRect(cnt)
                aspect = float(cw) / max(ch, 1)
                if 0.75 <= aspect <= 1.35:
                    symbols.append({
                        "name": "Vegetarian Mark (Green Dot/Square)",
                        "type": "VEG_SYMBOL",
                        "status": "PASS",
                        "confidence": 0.92,
                        "bbox": [[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch]]
                    })
                    has_veg_contour = True
                    break
        
        if not has_veg_contour and re.search(r"\b(veg|vegetarian|100%\s*veg|green\s*dot)\b", full_text, re.IGNORECASE):
            symbols.append({
                "name": "Vegetarian Declaration",
                "type": "VEG_SYMBOL",
                "status": "PASS",
                "confidence": 0.88,
                "bbox": [[10, 10], [100, 10], [100, 50], [10, 50]]
            })

        # 2. Brown Non-Vegetarian Mark
        lower_brown = np.array([8, 100, 50])
        upper_brown = np.array([20, 255, 180])
        brown_mask = cv2.inRange(hsv, lower_brown, upper_brown)
        brown_contours, _ = cv2.findContours(brown_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        has_nonveg = False
        for cnt in brown_contours:
            area = cv2.contourArea(cnt)
            if 100 < area < (h * w * 0.08):
                x, y, cw, ch = cv2.boundingRect(cnt)
                aspect = float(cw) / max(ch, 1)
                if 0.75 <= aspect <= 1.35:
                    symbols.append({
                        "name": "Non-Vegetarian Mark (Brown Square/Triangle)",
                        "type": "NON_VEG_SYMBOL",
                        "status": "PASS",
                        "confidence": 0.89,
                        "bbox": [[x, y], [x + cw, y], [x + cw, y + ch], [x, y + ch]]
                    })
                    has_nonveg = True
                    break
        if not has_nonveg and re.search(r"\b(non[\s-]*veg|non-vegetarian|contains\s*egg|meat|fish)\b", full_text, re.IGNORECASE):
            symbols.append({
                "name": "Non-Vegetarian Declaration",
                "type": "NON_VEG_SYMBOL",
                "status": "PASS",
                "confidence": 0.85,
                "bbox": [[10, 10], [100, 10], [100, 50], [10, 50]]
            })
    except Exception as e:
        print(f"[SYMBOL DETECT WARN]: {e}")

    # 3. Recycling Mark / Plastic EPR
    if re.search(r"(?:recycle|recyclable|pete?|hdpe|pp\b|ldpe|mobius|plastic\s*waste|50\s*micron)", full_text, re.IGNORECASE):
        symbols.append({
            "name": "Recycling & EPR Plastic Mark",
            "type": "RECYCLING_MARK",
            "status": "PASS",
            "confidence": 0.90,
            "bbox": [[w - 120, h - 60], [w - 10, h - 60], [w - 10, h - 10], [w - 120, h - 10]]
        })

    # 4. FSSAI Stamp
    fssai_match = re.search(r"(?:fssai|lic(?:\.|\s*no)?[:\s]*)(\d{14})", full_text, re.IGNORECASE)
    if fssai_match or re.search(r"\bfssai\b", full_text, re.IGNORECASE):
        symbols.append({
            "name": "FSSAI Statutory Safety Stamp",
            "type": "FSSAI_MARK",
            "status": "PASS",
            "confidence": 0.95,
            "bbox": [[w - 140, 20], [w - 10, 20], [w - 10, 70], [w - 140, 70]]
        })

    # 5. BIS / ISI Mark
    if re.search(r"(?:is[:\s]*\d{3,5}|cm[\s\/]*l[\s\-]*\d{7}|bis\s*reg|isi\s*mark)", full_text, re.IGNORECASE):
        symbols.append({
            "name": "BIS / ISI Quality Certification",
            "type": "BIS_MARK",
            "status": "PASS",
            "confidence": 0.93,
            "bbox": [[20, h - 70], [140, h - 70], [140, h - 20], [20, h - 20]]
        })

    # 6. Inkjet Dot-Matrix Batch Markers
    dot_matrix_found = []
    if "##" in full_text: dot_matrix_found.append("## (MRP Marker)")
    if "@@" in full_text: dot_matrix_found.append("@@ (Net Qty Marker)")
    if "Δ" in full_text or re.search(r"Δ\s*(?:rs\.?|₹)?\s*0\.[0-9]", full_text, re.IGNORECASE): dot_matrix_found.append("Δ (Unit Sale Price Marker)")
    
    if dot_matrix_found:
        symbols.append({
            "name": f"Dot-Matrix Inkjet Markers: {', '.join(dot_matrix_found)}",
            "type": "DOT_MATRIX_MARKERS",
            "status": "PASS",
            "confidence": 0.96,
            "bbox": [[10, 80], [240, 80], [240, 120], [10, 120]]
        })

    # 7. Statutory Digital E-Label QR Code (Rule 6(1) Digital Provision / GSR 779(E))
    has_qr_symbol = False
    try:
        qr_detector = cv2.QRCodeDetector()
        _, qr_pts, _ = qr_detector.detectAndDecode(img)
        if qr_pts is not None and len(qr_pts) > 0:
            p_arr = qr_pts[0]
            bbox = [[int(pt[0]), int(pt[1])] for pt in p_arr]
            symbols.append({
                "name": "Statutory Digital E-Label QR Code (Rule 6(1) Brand & Manufacturing Address)",
                "type": "QR_CODE",
                "status": "PASS",
                "confidence": 0.98,
                "bbox": bbox
            })
            has_qr_symbol = True
    except Exception:
        pass

    if not has_qr_symbol and re.search(r"(?:scan\s*(?:the\s*)?qr(?:\s*code)?|qr\s*code\s*(?:for|to|please)|please\s*scan)", full_text, re.IGNORECASE):
        symbols.append({
            "name": "Statutory Digital E-Label QR Code (Rule 6(1) Brand & Manufacturing Address)",
            "type": "QR_CODE",
            "status": "PASS",
            "confidence": 0.92,
            "bbox": [[w - 120, 10], [w - 10, 10], [w - 10, 100], [w - 120, 100]]
        })

    return symbols

# ---------------------------------------------------------------------------
# DETERMINISTIC STATUTORY RULE VALIDATION ENGINE (10 DEDICATED FUNCTIONS)
# ---------------------------------------------------------------------------
def check_mrp(raw_lines: List[str], norm_text: str, ocr_data=None) -> Dict[str, Any]:
    """
    1. Maximum Retail Price (MRP) Check - Rule 6(1)(e)
    Enforces currency in Rs./₹, numeric value, and mandatory 'inclusive of all taxes' phrase.
    Handles all variants of:
    - MRP, M.R.P., Max Retail Price, Maximum Retail Price, Max Retial, Retail Price
    - Pre-printed dot-matrix decoupling templates (e.g. ##, ₹ 10)
    - Declarations where taxes clause precedes or follows price
    - All statutory tax formulations ('inclusive of all taxes', 'inclusive of taxes',
      'incl. of all taxes', 'incl. of taxes', 'all taxes included/inclusive',
      'inclusive of all applicable taxes', 'inclusive of GST', etc.)
    """
    result = {
        "key": "mrp",
        "rule_ref": "Rule 6(1)(e)",
        "status": "FAIL",
        "detected_value": None,
        "error_code": "MRP_MISSING",
        "explanation": "Maximum Retail Price is missing or illegible on the packaging.",
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e)",
        "penalty_clause": "Section 36(3), Legal Metrology Act, 2009 (Fine up to ₹25,000 for 1st offense)"
    }

    full_str = f"{' '.join(raw_lines)} {norm_text}"

    # 1. Comprehensive Statutory Tax Declaration Pattern
    # Matches all standard variations, colloquial FMCG abbreviations, and OCR character confusions:
    # e.g., 'inclusive of all taxes', 'incl. of all taxes', 'of all taxes)', 'all taxes included',
    # 'taxes inclusive', 'incl. of taxes', 'inclusive of gst', 'incluslve', 'inciusive', etc.
    tax_phrases_pattern = re.compile(
        r'(?:'
        r'(?:incl[a-z0-9\.,]*|inclusive|inclus[il1]ve|incius[il1]ve|indusive|including|incld|incldg|inc[\.,]?)\s*'
        r'[\(\[\{/:\-]*\s*'
        r'(?:of\s*)?(?:all\s*)?(?:applicable\s*|local\s*|govt\s*)?(?:taxes|tax|lax[a-z]*|taxcs|tazes|1axes|gst|duties|vat|charges?|chg)'
        r'|'
        r'of\s+(?:all\s+)?(?:applicable\s*|local\s*|govt\s*)?(?:taxes|tax|lax[a-z]*|taxcs|tazes|1axes|gst|duties|charges?|chg)'
        r'|'
        r'all\s*(?:applicable\s*|local\s*)?(?:taxes|tax|lax[a-z]*|taxcs|tazes|charges?)\s*(?:included|inclusive|inclus[il1]ve|incl[\.,]?)'
        r'|'
        r'(?:taxes|tax|lax[a-z]*|taxcs|tazes|charges?)\s*(?:included|inclusive|inclus[il1]ve|incl[\.,]?)'
        r'|'
        r'incl[\.,]?\s*(?:all\s*)?(?:taxes|tax|gst|charges?)'
        r')',
        re.IGNORECASE
    )
    direct_phrase_match = bool(tax_phrases_pattern.search(full_str))

    # Decoupled / Multi-Line / Cross-Column OCR Token Matcher
    # When OCR places '(Inclusive' on one line/column and 'of all taxes)' on another
    has_inclusive_token = bool(re.search(r'\b(?:inclusive|inclus[il1]ve|incius[il1]ve|indusive|including|incld|incldg|incl[\.,]?)\b', full_str, re.IGNORECASE))
    has_tax_token = bool(re.search(r'\b(?:taxes|tax|taxcs|tazes|laxcs|laxes|gst|duties|charges?)\b', full_str, re.IGNORECASE))
    decoupled_match = has_inclusive_token and has_tax_token

    has_tax = direct_phrase_match or decoupled_match

    # 2. Comprehensive MRP Extraction
    mrp_header = r'(?:m\.?r\.?p\.?|max(?:imum)?\.?\s*ret[ai]{2}l(?:\s*price)?|retail\s*price|price)'
    not_per_unit = r'(?![\s:.\-\/]*(?:per|\/)\s*(?:g|gm|kg|ml|l|ltr|meter|cm|unit))\b'
    
    # Priority 1: Header directly before price (e.g. MRP: Rs. 55.00, Max Retail Price: ₹ 50, RS 60.00)
    p1 = re.search(mrp_header + r'[\s:.\-\/]*(?:rs\.?|inr|₹)?[\s:.\-\/]*([0-9]+(?:\.[0-9]{1,2})?)' + not_per_unit, full_str, re.IGNORECASE)
    # Priority 2: Dot-matrix ## symbol (e.g. ## ₹ 10)
    p2 = re.search(r'(?:##|#)[\s:.\-\/]*(?:rs\.?|inr|₹)?[\s:.\-\/]*([0-9]+(?:\.[0-9]{1,2})?)' + not_per_unit, full_str, re.IGNORECASE)
    # Priority 3: Parenthesized rate format (e.g. 10 (A80.10))
    p3 = re.search(r'\b([1-9][0-9]{0,4}(?:\.[0-9]{1,2})?)\s*\(\s*(?:[A-Za-z<Δ^]|₹|rs)?\s*(?:[0-9]+(?:\.[0-9]{1,2})?)\s*\)', full_str, re.IGNORECASE)
    # Priority 4: Header followed by tax clause then price (e.g. Maximum Retail Price (inclusive of all taxes): Rs. 50.00)
    p4 = re.search(mrp_header + r'[^\d\n\r]{0,80}?(?:rs\.?|inr|₹)?[\s:.\-\/]*([0-9]+(?:\.[0-9]{1,2})?)' + not_per_unit, full_str, re.IGNORECASE)
    # Priority 5: Explicit currency prefix (e.g. Rs. 50.00, RS 60.00, ₹ 1499.00)
    p5 = re.search(r'(?:rs\.?|inr|₹)[\s:.\-\/]*([0-9]+(?:\.[0-9]{1,2})?)' + not_per_unit, full_str, re.IGNORECASE)

    mrp_val = None
    if p1 and float(p1.group(1)) > 0:
        mrp_val = p1.group(1)
    elif p2 and float(p2.group(1)) > 0:
        mrp_val = p2.group(1)
    elif p3 and float(p3.group(1)) > 0:
        mrp_val = p3.group(1)
    elif p4 and float(p4.group(1)) > 0:
        mrp_val = p4.group(1)
    elif p5 and float(p5.group(1)) > 0:
        mrp_val = p5.group(1)

    price_review = False
    if ocr_data is not None:
        evidence = [d for d in ocr_data if "price_candidates" in d]
        values = {d["price_value"] for d in evidence if d.get("price_value") is not None}
        mrp_val = format(next(iter(values)), ".2f") if len(values) == 1 else None
        price_review = not evidence or len(values) != 1 or any(d.get("price_needs_review", True) for d in evidence)
        result["ocr_evidence"] = [{"photo_number": d.get("photo_number", 1), "bbox": d["bbox"],
                                   "readings": d["price_evidence"], "candidates": d["price_candidates"]} for d in evidence]

    if mrp_val:
        result["detected_value"] = f"₹ {mrp_val}"
        if has_tax:
            result["status"] = "PASS"
            result["error_code"] = None
            result["explanation"] = f"MRP declared as ₹ {mrp_val} with statutory 'inclusive of all taxes' declaration under Rule 6(1)(e)."
        else:
            result["status"] = "FAIL"
            result["error_code"] = "MRP_NO_TAX_DECLARATION"
            result["explanation"] = f"MRP declared as ₹ {mrp_val} but mandatory statutory phrase 'inclusive of all taxes' is missing."
    else:
        result["status"] = "FAIL"
        result["error_code"] = "MRP_MISSING"
        result["explanation"] = "No legible Maximum Retail Price (MRP) was detected on the packaging."

    if price_review:
        result.update(status="REVIEW", error_code="MRP_OCR_UNCERTAIN",
                      explanation="Price OCR readings disagree or are insufficient. Confirm the printed MRP from a close-up before using it in calculations.")

    return result

def check_net_quantity(raw_lines: List[str], norm_text: str) -> Dict[str, Any]:
    """
    2. Net Quantity & Standard Metric Units - Rule 6(1)(c)
    Enforces SI metric units (g, kg, ml, l).
    Flags non-standard units (e.g. 'gm', 'ltr', 'gms').
    Handles dual density (edible oils) and composite promotional packs (105g + 50g).
    """
    result = {
        "key": "net_qty",
        "rule_ref": "Rule 6(1)(c)",
        "status": "FAIL",
        "detected_value": None,
        "error_code": "NET_QTY_MISSING",
        "explanation": "Net Quantity declaration is missing on packaging.",
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(c)",
        "penalty_clause": "Section 29 & 36, Legal Metrology Act, 2009 (Penalty for non-standard metric units)"
    }

    # Strip nutritional breakdown elements (fat, protein, carbs, energy, minerals, serving sizes)
    # so they are never mistaken for the commodity's net package weight
    clean_text = re.sub(
        r"(?:per|serving\s*size|servings|total\s*fat|fat|cholesterol|carbohydrates?|protein|minerals?|energy)[\s:;._-]*[0-9]+(?:\.[0-9]+)?\s*(?:g|gm|grams|mg|kcal|cal|kj)\b",
        "",
        norm_text,
        flags=re.IGNORECASE
    )
    # Strip cooking preparation instructions (e.g. "boil 250 ml water") so recipe water volume is never mistaken for package net weight
    clean_text = re.sub(
        r"(?:boil|cook|prepare|add|mix|water|cup|cups)[\s:0-9]*(?:ml|l|litres?|grams|g|gm)\b",
        "",
        clean_text,
        flags=re.IGNORECASE
    )

    # A: Dual Density (Edible oils: 1 L / 910 g)
    dual_oil = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(?:l|litre|ltr)\s*(?:\/|\()\s*([0-9]+(?:\.[0-9]+)?)\s*(?:g|gm|grams)", clean_text, re.IGNORECASE)
    # B: Composite Promotional Formats (105 g + 50 g EXTRA)
    promo = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(?:g|gm|kg|ml|l)\s*\+\s*([0-9]+(?:\.[0-9]+)?)\s*(?:g|gm|kg|ml|l)\s*extra", clean_text, re.IGNORECASE)
    compound = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(g|kg|ml|l)\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*(?:g|kg|ml|l)\s*\+\s*[0-9]+", clean_text, re.IGNORECASE)
    # C: Symbolic Inkjet Stamp (@@ 155 g)
    symbolic = re.search(r"(?:@@|@)\s*([0-9]+(?:\.[0-9]+)?)\s*(kg|g|gm|grams|ml|l|ltr|litres|n|u|units?|pieces?)\b", clean_text, re.IGNORECASE)
    # D: Standard Statutory Formats ("Net Quantity: 750 ml", "Net Wt. 1 kg", "NET WEIGHT: 240 g")
    std = re.search(r"(?:net\s*(?:wt\.?|weight|qty\.?|quantity|content|mass|volume)|volume|vol\.?)[\s:.]*([0-9]+(?:\.[0-9]+)?)\s*(kg|g|gm|grams|ml|l|litre|ltr|litres|m|meter|cm|units?|n|u)?\b", clean_text, re.IGNORECASE)
    # E: Standard Unit Alone (e.g. "NET WEIGHT: kg" when OCR drops numeral 1)
    unit_alone = re.search(r"(?:net\s*(?:wt\.?|weight|qty\.?|quantity|content|mass|volume)|volume|vol\.?)[\s:.]*(kg|g|gm|grams|ml|l|litre|ltr|litres|units?|n|u)\b", clean_text, re.IGNORECASE)
    # F: Dimensions (1.20 m x 2.40 m)
    dim = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|cm)\s*(?:x|\*)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|cm)", clean_text, re.IGNORECASE)
    # G: Loose Quantity (only if no Net Quantity header found)
    loose = re.search(r"\b([0-9]+(?:\.[0-9]+)?)\s*(kg|kilograms?|g|gm|grams|ml|l|litres?|ltr)\b", clean_text, re.IGNORECASE)

    val = None
    unit = ""
    parsed_kg = 0.0
    net_grams = 0.0

    if promo:
        base_v = float(promo.group(1))
        extra_v = float(promo.group(2))
        tot_v = base_v + extra_v
        result["status"] = "PASS"
        result["detected_value"] = f"{tot_v:.0f} g ({base_v:.0f} g + {extra_v:.0f} g EXTRA)"
        result["error_code"] = None
        result["explanation"] = "Promotional composite net weight declared in standard metric units."
        parsed_kg = tot_v / 1000.0
        net_grams = tot_v
    elif dual_oil:
        result["status"] = "PASS"
        result["detected_value"] = f"{dual_oil.group(1)} L / {dual_oil.group(2)} g (Dual Statement)"
        result["error_code"] = None
        result["explanation"] = "Dual volume and weight declared in standard metric units."
        parsed_kg = float(dual_oil.group(1))
        net_grams = float(dual_oil.group(2))
    elif compound:
        result["status"] = "PASS"
        result["detected_value"] = f"{compound.group(1)} {compound.group(2)} (Promotional Composite Pack)"
        result["error_code"] = None
        result["explanation"] = "Promotional composite net weight declared in standard units."
        val = float(compound.group(1))
        unit = compound.group(2).lower()
        base_v = float(compound.group(3))
        net_grams = base_v if unit in ["g", "gm"] else base_v * 1000.0
        parsed_kg = val if unit == "kg" else val / 1000.0
    elif symbolic:
        val = float(symbolic.group(1))
        unit = symbolic.group(2).lower()
        result["detected_value"] = f"{val} {unit}"
    elif std:
        val = float(std.group(1))
        unit = (std.group(2) or "g").lower()
        result["detected_value"] = f"{val:g} {unit}"
    elif unit_alone:
        val = 1.0
        unit = unit_alone.group(1).lower()
        result["detected_value"] = f"{val:.0f} {unit}"
    elif dim:
        result["status"] = "PASS"
        result["detected_value"] = dim.group(0)
        result["error_code"] = None
        result["explanation"] = "Dimensions declared in standard SI metric units (meters/cm)."
    elif loose:
        val = float(loose.group(1))
        unit = loose.group(2).lower()
        result["detected_value"] = f"{val} {unit}"

    if val is not None and result["status"] != "PASS":
        if unit in ["kg", "kilogram", "kilograms"]:
            parsed_kg = val
            net_grams = val * 1000.0
        elif unit in ["g", "gm", "grams"]:
            parsed_kg = val / 1000.0
            net_grams = val
        elif unit in ["l", "litre", "litres", "ltr"]:
            parsed_kg = val
            net_grams = val * 1000.0
        elif unit in ["ml", "millilitres"]:
            parsed_kg = val / 1000.0
            net_grams = val

        if unit in ["gm", "grams", "gms"]:
            result["status"] = "FAIL"
            result["error_code"] = "NON_SI_UNIT_GM"
            result["explanation"] = f"Non-standard symbol '{unit}' used. Rule 6(1)(c) strictly mandates standard SI unit 'g'."
        elif unit in ["ltr", "litres"]:
            result["status"] = "FAIL"
            result["error_code"] = "NON_SI_UNIT_LTR"
            result["explanation"] = f"Non-standard symbol '{unit}' used. Rule 6(1)(c) strictly mandates standard SI unit 'l' or 'L'."
        else:
            result["status"] = "PASS"
            result["error_code"] = None
            result["explanation"] = f"Net quantity declared in valid standard SI metric unit '{unit}'."

    result["parsed_kg"] = parsed_kg
    result["net_grams"] = net_grams
    return result

def check_manufacturer_details(raw_lines: List[str], norm_text: str) -> Dict[str, Any]:
    """
    3. Manufacturer / Packer / Importer Identity - Rule 6(1)(a)
    Identifies corporate entity, brand, or 'Manufactured/Packed by' declaration.
    """
    result = {
        "key": "manufacturer",
        "rule_ref": "Rule 6(1)(a)",
        "status": "FAIL",
        "detected_value": None,
        "error_code": "MANUFACTURER_MISSING",
        "explanation": "Manufacturer, packer, or importer identity is not clearly declared on the Principal Display Panel.",
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(a)",
        "penalty_clause": "Section 36(1), Legal Metrology Act, 2009"
    }

    full_str = f"{' '.join(raw_lines)} {norm_text}"
    corp_match = re.search(r"([A-Za-z0-9\s]+(?:Pvt\.?\s*Ltd|Limited|Labs|Industries|Foods|Enterprises|Beverages|India|Holdings|Consumer Products))", full_str, re.IGNORECASE)
    mfg_clause = re.search(r"(?:manufactured|packed|marketed|imported|bottled)\s*(?:by|for)[\s:.]*([^\n\r,]+)", full_str, re.IGNORECASE)
    fssai_entity = re.search(r"(?:fssai|lic[a-z]*)[^\d]{0,30}(\d{14})", full_str, re.IGNORECASE) or re.search(r"\b([12]\d{13})\b", full_str)

    if corp_match:
        result["status"] = "PASS"
        result["detected_value"] = str(corp_match.group(1)).strip()[:55]
        result["error_code"] = None
        result["explanation"] = f"Manufacturer/Corporate entity declared: {result['detected_value']}"
    elif mfg_clause:
        result["status"] = "PASS"
        result["detected_value"] = str(mfg_clause.group(1)).strip()[:55]
        result["error_code"] = None
        result["explanation"] = f"Manufacturing/Marketing entity declared: {result['detected_value']}"
    elif fssai_entity:
        result["status"] = "PASS"
        result["detected_value"] = f"Registered Entity (FSSAI Lic: {fssai_entity.group(1)})"
        result["error_code"] = None
        result["explanation"] = "Manufacturer identified through statutory licensing records."
    else:
        result["status"] = "FAIL"
        result["error_code"] = "MANUFACTURER_MISSING"

    return result

def check_address(raw_lines: List[str], norm_text: str, detected_symbols: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    4. Complete Geographical Address Check - Rule 6(1)(a)
    Verifies that the complete address with city, state, and pincode is present,
    or digital QR code address under Legal Metrology Rule 6(1) / GSR 779(E).
    """
    result = {
        "key": "address",
        "rule_ref": "Rule 6(1)(a)",
        "status": "FAIL",
        "detected_value": None,
        "error_code": "MANUFACTURER_ADDRESS_MISSING",
        "explanation": "Complete geographical address of the manufacturer/packer is missing.",
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(a)",
        "penalty_clause": "Section 36(1), Legal Metrology Act, 2009"
    }

    full_str = f"{' '.join(raw_lines)} {norm_text}"
    pin_match = re.search(r"\b([1-9][0-9]{5})\b", full_str)
    addr_match = re.search(r"(?:at|plot\s*no|phase|sector|road|industrial\s*area|village|dist|mumbai|delhi|bengaluru|hyderabad|chennai|kolkata|pune|ahmedabad|gujarat|maharashtra|karnataka|haryana|up|tamil\s*nadu)", full_str, re.IGNORECASE)
    qr_address_match = re.search(
        r"(?:scan\s*(?:the\s*)?qr(?:\s*code)?|qr\s*code\s*(?:for|to|please)|brand\s*owner'?s?\s*address.*qr|scan\s*qr|address[^\n\r]{0,30}please\s*scan)",
        full_str,
        re.IGNORECASE
    )

    has_qr_symbol = False
    if detected_symbols:
        for s in detected_symbols:
            if s.get("type") == "QR_CODE":
                has_qr_symbol = True
                break

    if pin_match and addr_match:
        result["status"] = "PASS"
        result["detected_value"] = f"Geographical Address with PIN {pin_match.group(1)} declared"
        result["error_code"] = None
        result["explanation"] = "Complete geographical address with postal pin code verified."
    elif qr_address_match or has_qr_symbol:
        result["status"] = "PASS"
        result["detected_value"] = "Digital QR Code Address Declaration (Rule 6(1))"
        result["error_code"] = None
        result["explanation"] = "Brand owner and manufacturing unit addresses declared digitally via statutory QR Code under Legal Metrology Rule 6(1) / GSR 779(E)."
    elif pin_match or addr_match:
        result["status"] = "REVIEW"
        val = f"PIN {pin_match.group(1)}" if pin_match else "Partial Address Elements Detected"
        result["detected_value"] = val
        result["error_code"] = "ADDRESS_PARTIAL"
        result["explanation"] = "Partial address found. Physical verification of complete premises recommended."
    else:
        result["status"] = "FAIL"
        result["error_code"] = "MANUFACTURER_ADDRESS_MISSING"

    return result

def check_consumer_care(raw_lines: List[str], norm_text: str, detected_symbols: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    5. Consumer Grievance Contact Details - Rule 6(1)(n)
    Detects toll-free numbers (1800-xxx), phone numbers, email addresses, consumer care reference,
    or statutory digital e-label QR codes / portals under Rule 6(1) / GSR 779(E).
    """
    result = {
        "key": "consumer_care",
        "rule_ref": "Rule 6(1)(n)",
        "status": "FAIL",
        "detected_value": None,
        "error_code": "CONSUMER_CARE_MISSING",
        "explanation": "No consumer care helpline, telephone, or grievance email address declared.",
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(n)",
        "penalty_clause": "Section 36(1), Legal Metrology Act, 2009"
    }

    full_str = f"{' '.join(raw_lines)} {norm_text}"
    toll_free = re.search(r"(?:1800[\s-]?[0-9]{3}[\s-]?[0-9]{3,4})", full_str)
    phone_match = re.search(r"(?:(?:\+91[\-\s]?)?[6789]\d{9}|\b0\d{2,4}[-\s]?\d{6,8}\b)", full_str)
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", full_str)
    care_clause = re.search(r"(?:consumer|customer|consurier|consumr|customr)\s*care(?:\s*cell|no|executive|helpline)?", full_str, re.IGNORECASE)

    contacts = []
    if toll_free: contacts.append(toll_free.group(0))
    if email_match: contacts.append(email_match.group(0))
    if phone_match and not toll_free: contacts.append(phone_match.group(0))

    web_match = re.search(r"(?:https?:\/\/|www\.)?[\w\.-]+\.(?:itcportal|com|in|org|net|co\.in)\b", full_str, re.IGNORECASE)
    qr_care_match = re.search(r"(?:scan\s*(?:the\s*)?qr(?:\s*code)?|qr\s*code|please\s*scan|store\s*locator|brand\s*owner'?s?\s*address)", full_str, re.IGNORECASE)

    has_qr_symbol = False
    if detected_symbols:
        for s in detected_symbols:
            if s.get("type") == "QR_CODE":
                has_qr_symbol = True
                break

    if contacts:
        result["status"] = "PASS"
        result["detected_value"] = ", ".join(contacts)
        result["error_code"] = None
        result["explanation"] = f"Statutory consumer grievance contact declared: {result['detected_value']}."
    elif care_clause:
        result["status"] = "PASS"
        result["detected_value"] = "Consumer Care Cell Declared"
        result["error_code"] = None
        result["explanation"] = "Dedicated consumer care cell reference declared on label."
    elif has_qr_symbol or qr_care_match or web_match:
        result["status"] = "PASS"
        val = web_match.group(0) if web_match else ("Statutory E-Label QR Code (Rule 6(1))" if has_qr_symbol else "Digital Redressal Portal")
        result["detected_value"] = f"Digital Redressal Portal: {val}"
        result["error_code"] = None
        result["explanation"] = "Consumer grievance redressal and brand owner details provided via statutory digital portal / QR Code under Rule 6(1) / GSR 779(E)."
    else:
        result["status"] = "FAIL"
        result["error_code"] = "CONSUMER_CARE_MISSING"

    return result

def check_date_declarations(raw_lines: List[str], norm_text: str) -> Dict[str, Any]:
    """
    6. Month & Year of Manufacture/Packing/Import - Rule 6(1)(d)
    Detects standard date declarations (MM/YYYY, MM/YY, Best Before, PKD/MFD).
    """
    result = {
        "key": "mfg_date",
        "rule_ref": "Rule 6(1)(d)",
        "status": "FAIL",
        "detected_value": None,
        "error_code": "MFG_DATE_MISSING",
        "explanation": "Month and year of manufacture, packing, or import is not declared.",
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(d)",
        "penalty_clause": "Section 36(1), Legal Metrology Act, 2009"
    }

    # Alphanumeric compact dates: e.g. 04NOV25, O4NOV25, 04NOV2025, 04/NOV/25, 04-NOV-2025, 04NOV25/01AUG26
    month_names = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)"
    single_alpha_date = rf"[0-3oO]?[0-9][\s\.\/\-]*{month_names}[a-z]*[\s\.\/\-]*(?:20)?[123][0-9]"
    dual_alpha_date = rf"{single_alpha_date}(?:[\s\.\/\-]+{single_alpha_date})?"
    date_prefix = r"(?:pkd[\s\.\/]*(?:and\s*|\/\s*|&)?use\s*by|mfg[\s\.\/]*(?:and\s*|\/\s*|&)?(?:exp|use\s*by)|pkd|packed(?:\s*on)?|mfg|mfd|date|use\s*by|best\s*before|exp(?:iry)?)"

    compact_alpha = re.search(date_prefix + r"[\s:.\/]*(" + dual_alpha_date + r")", norm_text, re.IGNORECASE)
    standalone_alpha = re.search(r"\b(" + dual_alpha_date + r")\b", norm_text, re.IGNORECASE)
    sym_date = re.search(r"(?:@)\s*([0-1]?[0-9][\/\-\.](?:20)?[0-9]{2})", norm_text)
    std_date = re.search(
        r"(?:pkd|packed(?:\s*on)?|mfg|mfd|date|use\s*by|best\s*before|exp(?:iry)?)[\s:.\/]*([0-3]?[0-9][\/\-\.][0-1]?[0-9][\/\-\.](?:20)?[0-9]{2}|[0-1]?[0-9][\/\-\.](?:20)?[0-9]{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\.\,\-\/]*(?:20)?[0-9]{2})",
        norm_text, re.IGNORECASE
    )
    duration = re.search(r"(?:best\s*before|use\s*within)[\s:]*([0-9]+\s*(?:months|days|weeks|years))", norm_text, re.IGNORECASE)
    slash_date = re.search(r"\b([0-1]?[0-9][\/\-](?:20)?[123][0-9])\b", norm_text)

    if compact_alpha:
        raw_d = compact_alpha.group(1).strip()
        clean_d = re.sub(r'\b[oO](\d)', r'0\1', raw_d).upper()
        result["status"] = "PASS"
        result["detected_value"] = f"Date: {clean_d}"
        result["error_code"] = None
        result["explanation"] = f"Statutory date of packing & consumption timeline verified: {clean_d} (Rule 6(1)(d))."
    elif standalone_alpha:
        raw_d = standalone_alpha.group(1).strip()
        clean_d = re.sub(r'\b[oO](\d)', r'0\1', raw_d).upper()
        result["status"] = "PASS"
        result["detected_value"] = f"Date: {clean_d}"
        result["error_code"] = None
        result["explanation"] = f"Statutory date of packing & consumption timeline verified: {clean_d} (Rule 6(1)(d))."
    elif sym_date:
        result["status"] = "PASS"
        result["detected_value"] = f"Date: {sym_date.group(1)} (Dot-Matrix Inkjet Stamp)"
        result["error_code"] = None
        result["explanation"] = f"Packing date identified from inkjet stamp: {sym_date.group(1)}."
    elif std_date:
        result["status"] = "PASS"
        result["detected_value"] = str(std_date.group(0)).strip()
        result["error_code"] = None
        result["explanation"] = f"Statutory date declaration verified: {result['detected_value']}."
    elif duration:
        result["status"] = "PASS"
        result["detected_value"] = str(duration.group(0)).strip()
        result["error_code"] = None
        result["explanation"] = f"Perishable consumption timeline declared: {result['detected_value']}."
    elif slash_date:
        result["status"] = "PASS"
        result["detected_value"] = f"Date: {slash_date.group(1)}"
        result["error_code"] = None
        result["explanation"] = f"Month and year declared: {slash_date.group(1)}."
    else:
        result["status"] = "FAIL"
        result["error_code"] = "MFG_DATE_MISSING"

    return result

def check_country_of_origin(raw_lines: List[str], norm_text: str, category: str) -> Dict[str, Any]:
    """
    7. Country of Origin Check - Rule 6(1)(m)
    Mandatory for imported goods and Electronics & Appliances.
    """
    cat_upper = str(category or "FOOD").upper()
    is_electronics = cat_upper == "ELECTRONICS"
    
    result = {
        "key": "country_of_origin",
        "rule_ref": "Rule 6(1)(m)",
        "status": "EXEMPT",
        "detected_value": "Exempt for indigenous domestic commodities",
        "error_code": None,
        "explanation": "Country of origin declaration is optional for domestic indigenous groceries/cosmetics under Rule 6(1)(m).",
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(m)",
        "penalty_clause": "Section 36(1), Legal Metrology Act, 2009"
    }

    full_str = f"{' '.join(raw_lines)} {norm_text}"
    origin_match = re.search(r"(?:country\s*of\s*origin|made\s*in|manufactured\s*in|imported\s*from)[\s:]*([A-Za-z\s]+)", full_str, re.IGNORECASE)

    if origin_match and not re.search(r"\b(?:not\s*declared|unknown|none|n\/?a)\b", origin_match.group(1), re.IGNORECASE):
        country_name = str(origin_match.group(1)).strip().split("\n")[0][:30]
        result["status"] = "PASS"
        result["detected_value"] = f"Origin: {country_name}"
        result["error_code"] = None
        result["explanation"] = f"Country of origin declared as {country_name}."
    elif is_electronics:
        result["status"] = "FAIL"
        result["detected_value"] = "Not Declared on Packaging"
        result["error_code"] = "COUNTRY_OF_ORIGIN_MISSING"
        result["explanation"] = "Country of Origin is strictly mandatory for electronics & imported items under Rule 6(1)(m)."

    return result

def check_usp_and_rule_6_11(raw_lines: List[str], norm_text: str, mrp_float: float, net_grams: float, parsed_kg: float) -> Dict[str, Any]:
    """
    8. Unit Sale Price (USP) & Rule 6(11) Second Proviso Exemption
    - Packages containing exactly 1 kg, 1 L, or 1 unit are exempt from declaring separate USP (MRP = USP).
    - Packages <= 10g or <= 10ml are exempt under Rule 26.
    - Otherwise enforces USP in ₹/g or ₹/ml (for <1kg/<1L) or ₹/kg or ₹/L (for >1kg/>1L).
    """
    result = {
        "key": "usp",
        "rule_ref": "Rule 6(11)",
        "status": "FAIL",
        "detected_value": None,
        "error_code": "USP_NOT_DECLARED",
        "explanation": "Unit Sale Price (USP) is missing on the package.",
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(11)",
        "penalty_clause": "Section 36(1), Legal Metrology Act, 2009"
    }

    # Check Rule 26 Small Pack Exemption (<= 10g / <= 10ml)
    if 0.0 < net_grams <= 10.0:
        result["status"] = "EXEMPT"
        result["detected_value"] = f"Exempt under Rule 26 (Small Package: {net_grams:.1f} g <= 10 g)"
        result["error_code"] = None
        result["explanation"] = "Small packages with net quantity <= 10 g or <= 10 ml are exempt from retail declaration requirements under Rule 26."
        return result

    # Check Rule 6(11) Second Proviso Exemption (1 kg / 1 L packs)
    if math.isclose(parsed_kg, 1.0, rel_tol=0.01) or (parsed_kg == 0 and math.isclose(net_grams, 1000.0, rel_tol=0.01)):
        result["status"] = "EXEMPT"
        price_str = f"₹ {mrp_float:.2f}" if mrp_float > 0 else "MRP"
        result["detected_value"] = f"Exempt under Rule 6(11) Second Proviso (1 kg / 1 L Pack: USP = {price_str})"
        result["error_code"] = None
        result["explanation"] = "Second Proviso to Rule 6(11) exempts packages of exactly 1 kg / 1 L from declaring separate USP since MRP equals the Unit Price."
        return result

    usp_detected = None

    # Priority 1: Mathematical verification against package tokens (MRP / Net Quantity)
    # E.g. MRP ₹ 56 / 240 g = ₹ 0.23 / g. Matches printed token "0.23" on label with high precision.
    math_usp = None
    if mrp_float > 0 and net_grams > 0:
        calc_per_g = mrp_float / net_grams
        calc_per_kg = calc_per_g * 1000.0

        for line in raw_lines:
            tokens = re.findall(r"\b([0-9]+(?:\.[0-9]{1,3})?)\b", line)
            for tok in tokens:
                try:
                    num = float(tok)
                    if math.isclose(num, calc_per_g, rel_tol=0.10) or math.isclose(num, round(calc_per_g, 2), abs_tol=0.03):
                        math_usp = f"₹ {tok} / g"
                        break
                    elif parsed_kg > 1.0 and math.isclose(num, calc_per_kg, rel_tol=0.05):
                        math_usp = f"₹ {tok} / kg"
                        break
                except Exception:
                    continue
            if math_usp:
                break

    # Priority 2: Parenthesized rate adjacent to MRP (e.g. "56 (0.23)" accompanied by "(Rs: per g)")
    paren_mrp_rate = re.search(r"\b[0-9]+(?:\.[0-9]{1,2})?\s*\(\s*(?:rs\.?|₹)?\s*(0\.[0-9]{1,3})\s*\)", norm_text, re.IGNORECASE)
    has_per_unit = bool(re.search(r"(?:rs\.?|₹)?[\s:.]*(?:per|\/)\s*(?:g|gm|kg|ml|l)\b", norm_text, re.IGNORECASE))
    standalone_paren_rate = re.search(r"\(\s*(?:rs\.?|₹)?\s*(0\.[0-9]{1,3})\s*\)", norm_text, re.IGNORECASE)

    # Priority 3: Explicit USP header or currency with rate unit (e.g. "USP: Rs. 0.23 / g", "Rs. 0.23 per g", "₹ 0.23 / g")
    direct_rate = re.search(
        r"(?:(?:u\.?s\.?p\.?|unit\s*(?:sale)?\s*price)[\s:.]*(?:rs\.?|inr|₹)?[\s:.]*([0-9]+(?:\.[0-9]{1,3})?)|(?:rs\.?|inr|₹)[\s:.]*([0-9]+(?:\.[0-9]{1,3})?))[\s:.]*(?:\/|per)\s*(?:g|gm|grams|kg|ml|l|ltr|100g|100ml|piece|unit|n)\b",
        norm_text, re.IGNORECASE
    )

    # Priority 4: True Inkjet delta marker (Δ 0.23/g) - must be followed by decimal price or explicit unit
    delta_match = re.search(r"Δ\s*(?:rs\.?|₹)?\s*(0\.[0-9]{1,3}|[0-9]+(?:\.[0-9]{1,3})?\s*(?:\/|per)\s*(?:g|gm|kg|ml|l))", norm_text, re.IGNORECASE)

    # Priority 5: Standalone decimal rate when package has unit indicator (e.g. 0.23 near "Rs: per g")
    dec_match = re.search(r"\b(0\.[0-9]{2,3})\b", norm_text)

    if math_usp:
        usp_detected = math_usp
    elif paren_mrp_rate:
        usp_detected = f"₹ {paren_mrp_rate.group(1)} / g"
    elif direct_rate:
        rate_val = direct_rate.group(1) or direct_rate.group(2)
        if rate_val and float(rate_val) > 0:
            val_f = float(rate_val)
            unit_str = "g" if "g" in direct_rate.group(0).lower() and "kg" not in direct_rate.group(0).lower() else ("ml" if "ml" in direct_rate.group(0).lower() else "kg")
            usp_detected = f"₹ {val_f} / {unit_str}"
    elif standalone_paren_rate and has_per_unit:
        usp_detected = f"₹ {standalone_paren_rate.group(1)} / g"
    elif delta_match:
        usp_detected = f"₹ {delta_match.group(1)} / g (Symbol-Linked Inkjet Declaration)"
    elif has_per_unit and dec_match:
        usp_detected = f"₹ {dec_match.group(1)} / g"

    if usp_detected:
        result["status"] = "PASS"
        result["detected_value"] = str(usp_detected)
        result["error_code"] = None
        result["explanation"] = f"Unit Sale Price correctly declared under Rule 6(11): {usp_detected}."
    else:
        result["status"] = "FAIL"
        result["detected_value"] = "Not declared on packaging"
        result["error_code"] = "USP_NOT_DECLARED"
        result["explanation"] = "Retail package exceeds 10g/10ml and is not 1kg/1L; separate USP declaration in ₹/g or ₹/ml is mandatory under Rule 6(11)."

    return result

def check_font_compliance_table_ii(ocr_data: List[Dict[str, Any]], area: float, orig_w: int, orig_h: int) -> Dict[str, Any]:
    """
    9. Rule 7, Table II Numeral Height Compliance Check
    Computes required minimum mm based on PDP area and compares against measured actual numeral height.
    Implements intelligent error categorization:
    - PASS: actual_font >= req_font
    - REVIEW: Borderline measurements within optical tolerance band (actual_font >= req_font * 0.75 or diff <= 0.5 mm),
      acknowledging that 2D image pixel-to-metric estimation is an optical approximation requiring manual physical verification.
    - FAIL: Numerals severely below statutory minimum.
    """
    req_font = float(get_required_font_height_mm(area))
    actual_font = float(measure_actual_font_height_mm(ocr_data, area, orig_w, orig_h))
    
    if actual_font >= req_font:
        status = "PASS"
        error_code = None
        explanation = f"Numerals conform to Table II minimum ({actual_font:.2f} mm >= {req_font:.1f} mm)."
    elif actual_font >= (req_font * 0.75) or (req_font - actual_font) <= 0.5:
        status = "REVIEW"
        error_code = "FONT_HEIGHT_MARGINAL_REVIEW"
        pct = int((actual_font / req_font) * 100)
        explanation = (
            f"Measured numeral height of {actual_font:.2f} mm is near the Table II statutory threshold of {req_font:.1f} mm "
            f"for surface area {area:.1f} cm² ({pct}% of requirement). Optical pixel estimation from flat 2D images is an "
            f"approximation subject to camera perspective and packaging curvature; manual physical verification with an optical comparator or micrometer is recommended."
        )
    else:
        status = "FAIL"
        error_code = "FONT_HEIGHT_SUB_STATUTORY"
        explanation = f"Numeral height of {actual_font:.2f} mm is significantly below statutory Table II minimum of {req_font:.1f} mm for surface area {area:.1f} cm²."

    result = {
        "key": "font_compliance",
        "rule_ref": "Rule 7, Table II",
        "status": status,
        "detected_value": f"Measured: {actual_font:.2f} mm | Min Required: {req_font:.1f} mm (PDP: {area:.1f} cm²)",
        "error_code": error_code,
        "explanation": explanation,
        "statutory_ref": "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 7, Table II",
        "penalty_clause": "Section 36(1), Legal Metrology Act, 2009"
    }
    return result

def check_category_statutory_mandates(raw_lines: List[str], norm_text: str, category: str, detected_symbols: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    10. Category-Specific Statutory Mandates:
    - Food & Beverages: FSSAI License 14-digit number and Vegetarian/Non-Vegetarian mark.
    - Soaps & Detergents: Total Fatty Matter (TFM) % or Grade, M-Lic.
    - Cosmetics & Toiletries: Manufacturing License (M-Lic), Ingredients list.
    - Electronics: BIS / ISI Mark and Country of Origin.
    """
    cat_upper = str(category or "FOOD").upper()
    full_str = " ".join(raw_lines)
    
    result = {
        "key": "category_statutory",
        "rule_ref": f"{cat_upper} Statutory Regulations",
        "status": "PASS",
        "detected_value": "General Statutory Compliance Verified",
        "error_code": None,
        "explanation": "General packaged commodity declarations verified.",
        "statutory_ref": "Category Mandates & PCR 2011",
        "penalty_clause": "Respective Statutory Acts"
    }

    if cat_upper in ["FOOD", "DRINKS"]:
        has_fssai = bool(re.search(r"(?:fssai|lic[a-z]*)[^\d]{0,30}(\d{14})", full_str, re.IGNORECASE)) or bool(re.search(r"\b([12]\d{13})\b", full_str)) or any(s.get("type") == "FSSAI_MARK" for s in detected_symbols)
        has_veg = any(s.get("type") in ["VEG_SYMBOL", "NON_VEG_SYMBOL"] for s in detected_symbols) or bool(re.search(r"(?:veg|vegetarian|green\s*dot|dietary)", full_str, re.IGNORECASE))

        if has_fssai and has_veg:
            result["status"] = "PASS"
            result["detected_value"] = "FSSAI 14-Digit License & Dietary Mark Verified"
            result["explanation"] = "Both mandatory FSSAI food safety license and Veg/Non-Veg indicators are declared."
        elif has_fssai or has_veg:
            result["status"] = "REVIEW"
            missing = "Dietary Mark" if has_fssai else "FSSAI 14-Digit License"
            result["detected_value"] = f"Partial: {missing} Missing or Ambiguous"
            result["error_code"] = "FOOD_PARTIAL_DECLARATION"
            result["explanation"] = f"Food/Beverage package is missing statutory {missing}."
        else:
            result["status"] = "FAIL"
            result["detected_value"] = "Mandatory FSSAI License & Dietary Symbol Missing"
            result["error_code"] = "FOOD_FSSAI_OR_VEG_MISSING"
            result["explanation"] = "FSSAI Food Safety Regulations and PCR 2011 mandate 14-digit FSSAI number and Veg/Non-Veg symbol on retail food packs."

    elif cat_upper in ["COSMETICS", "SOAP"]:
        has_mfg_lic = bool(re.search(r"(?:m\.?\s*lic|cosmetic\s*lic|mfg\s*lic|reg\s*no)", full_str, re.IGNORECASE))
        has_tfm = bool(re.search(r"(?:tfm|total\s*fatty\s*matter|grade\s*[123])", full_str, re.IGNORECASE))

        if has_mfg_lic or has_tfm:
            result["status"] = "PASS"
            tfm_val = "TFM / Grade Declared" if has_tfm else "Cosmetic M-Lic Verified"
            result["detected_value"] = tfm_val
            result["explanation"] = "Statutory cosmetic manufacturing license or soap TFM grade standard verified."
        else:
            result["status"] = "FAIL"
            result["detected_value"] = "Cosmetic Manufacturing License (M-Lic) Not Stated"
            result["error_code"] = "COSMETIC_LIC_MISSING"
            result["explanation"] = "Drugs and Cosmetics Rules & PCR 2011 mandate cosmetic manufacturing license number on package."

    elif cat_upper == "ELECTRONICS":
        has_bis = bool(re.search(r"(?:bis|isi|r-\d{8}|crs)", full_str, re.IGNORECASE))
        has_origin = bool(re.search(r"(?:country\s*of\s*origin|made\s*in|imported)[\s:]*(?!not\s*declared|unknown|none)[a-z]+", full_str, re.IGNORECASE))

        if has_bis and has_origin:
            result["status"] = "PASS"
            result["detected_value"] = "BIS Standard Mark & Country of Origin Declared"
            result["explanation"] = "Electronics statutory safety registration (BIS) and Rule 6(1)(m) origin verified."
        elif has_origin:
            result["status"] = "PASS"
            result["detected_value"] = "Rule 6(1)(m) Country of Origin Declared"
            result["explanation"] = "Statutory country of origin declared under Legal Metrology Rule 6(1)(m)."
        else:
            result["status"] = "FAIL"
            result["detected_value"] = "Missing Country of Origin under Rule 6(1)(m)"
            result["error_code"] = "ELECTRONIC_ORIGIN_MISSING"
            result["explanation"] = "Country of origin is strictly mandatory on all electronic commodities under Rule 6(1)(m)."

    return result

# ---------------------------------------------------------------------------
# SECTION 63 BSA 2023 / SECTION 65B IEA 1872 FORENSIC PDF GENERATOR
# ---------------------------------------------------------------------------
def generate_forensic_pdf_report(
    report_id: int, 
    image_path: str, 
    result: Dict[str, Any], 
    output_path: str, 
    user_id: str, 
    state: str, 
    district: str, 
    evidence_hash: str
):
    """
    Generates a formal electronic legal evidence certificate complying with:
    - Section 63 of the Bharatiya Sakshya Adhiniyam (BSA), 2023
    - Section 65B of the Indian Evidence Act, 1872
    """
    c = canvas.Canvas(output_path, pagesize=letter)
    
    # Header Banner
    c.setFillColor(colors.HexColor("#0f172a"))
    c.rect(0, 720, 612, 72, fill=1, stroke=0)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(45, 765, "GOVERNMENT OF INDIA — DEPARTMENT OF CONSUMER AFFAIRS")
    c.setFont("Helvetica", 9)
    c.drawString(45, 750, "LEGAL METROLOGY (PACKAGED COMMODITIES) RULES, 2011 — STATUTORY AUDIT")
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(45, 735, "Forensic Electronic Evidence Dossier | SIH Problem Statement #26034")

    # Case Metadata Block
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.rect(40, 630, 532, 75, fill=1, stroke=1)
    
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(50, 690, f"Audit Case ID: DoCA-LM-2026-{report_id:04d}")
    c.drawString(50, 675, f"Inspector / Citizen: {user_id}")
    c.drawString(50, 660, f"Jurisdiction: {district}, {state} (PIN: {result.get('pincode', '110001')})")
    c.drawString(50, 645, f"Timestamp: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")

    # Verdict Badge
    status = result["compliance_status"]
    status_color = colors.HexColor("#16a34a") if status == "PASS" else (colors.HexColor("#d97706") if status == "REVIEW" else colors.HexColor("#dc2626"))
    c.setFillColor(status_color)
    c.rect(370, 645, 190, 50, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    status_label = "COMPLIANT (PASS)" if status == "PASS" else ("REVIEW REQUIRED" if status == "REVIEW" else f"NON-COMPLIANT ({result['total_violations']} VIOLATIONS)")
    c.drawCentredString(465, 665, status_label)

    # Section 63 BSA 2023 Certification Header
    c.setFillColor(colors.HexColor("#0284c7"))
    c.rect(40, 605, 532, 18, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(48, 610, "SECTION 63 BHARATIYA SAKSHYA ADHINIYAM (BSA), 2023 / SECTION 65B EVIDENCE CERTIFICATE")

    c.setFillColor(colors.black)
    c.setFont("Helvetica", 7.5)
    cert_text = (
        "This electronic record is produced by an automated Legal Metrology inspection device operating properly under Section 63 of "
        "the Bharatiya Sakshya Adhiniyam, 2023 / Section 65B of the Indian Evidence Act, 1872. Digital evidence integrity is certified via SHA-256."
    )
    c.drawString(42, 592, cert_text[:115])
    c.drawString(42, 582, cert_text[115:])

    # Table Header
    y = 560
    c.setFillColor(colors.HexColor("#e2e8f0"))
    c.rect(40, y, 532, 16, fill=1, stroke=0)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(45, y + 4, "STATUS")
    c.drawString(100, y + 4, "STATUTORY RULE & DECLARATION")
    c.drawString(280, y + 4, "EXTRACTED EVIDENCE VALUE")
    c.drawString(460, y + 4, "ERROR / EXEMPTION")

    # Table Rows
    y -= 18
    for key, rule in result["rules"].items():
        if y < 90:
            c.showPage()
            y = 720

        st = rule.get("status", "FAIL")
        if st == "PASS":
            c.setFillColor(colors.HexColor("#16a34a"))
            st_str = "[ PASS ]"
        elif st == "EXEMPT":
            c.setFillColor(colors.HexColor("#0284c7"))
            st_str = "[ EXEMPT ]"
        elif st == "REVIEW":
            c.setFillColor(colors.HexColor("#d97706"))
            st_str = "[ REVIEW ]"
        else:
            c.setFillColor(colors.HexColor("#dc2626"))
            st_str = "[ FAIL ]"

        c.setFont("Helvetica-Bold", 8)
        c.drawString(45, y, st_str)
        
        c.setFillColor(colors.black)
        c.drawString(100, y, f"{rule.get('rule_ref', key)}: {key.upper()[:16]}")
        
        c.setFont("Helvetica", 7.5)
        val = str(rule.get("detected_value") or "Not Detected")
        c.drawString(280, y, val[:35])
        
        err = str(rule.get("error_code") or ("Exempt" if st == "EXEMPT" else "Verified Compliant"))
        if st == "FAIL":
            c.setFillColor(colors.HexColor("#dc2626"))
        c.drawString(460, y, err[:20])
        c.setFillColor(colors.black)

        y -= 16

    # Forensic Footer & Legal Citation
    c.setLineWidth(1)
    c.setStrokeColor(colors.HexColor("#0284c7"))
    c.line(40, 80, 572, 80)

    c.setFont("Helvetica-Bold", 7)
    c.drawString(40, 68, f"Digital Evidence SHA-256: {evidence_hash}")
    c.setFont("Helvetica", 6.5)
    c.drawString(40, 56, "Statutory Authority: Legal Metrology Act, 2009 (Section 36 fines up to ₹25,000 for 1st offense, ₹50,000 / imprisonment for subsequent offenses).")
    c.drawString(40, 46, "Evidence Admissibility: Certified under Section 63 of the Bharatiya Sakshya Adhiniyam (BSA), 2023 / Section 65B of the Indian Evidence Act, 1872.")
    c.drawString(40, 36, "National Consumer Helpline (NCH): 1915 / 1800-11-4000 | Department of Consumer Affairs, New Delhi.")

    c.save()

# ---------------------------------------------------------------------------
# UNIVERSAL DETERMINISTIC COMPLIANCE PIPELINE
# ---------------------------------------------------------------------------
def run_compliance_pipeline(
    raw_lines: List[str], 
    ocr_data: List[Dict[str, Any]], 
    area: float, 
    category: str, 
    orig_w: int, 
    orig_h: int,
    detected_symbols: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Executes all 10 deterministic statutory validation functions.
    Returns 4-tier statuses: PASS, FAIL, REVIEW, EXEMPT.
    """
    full_text = " ".join(raw_lines)
    norm_text = normalize_text_spacing(full_text)

    # 1. MRP
    r_mrp = check_mrp(raw_lines, norm_text, ocr_data)
    mrp_float = 0.0
    if r_mrp.get("detected_value") and r_mrp["status"] != "REVIEW":
        m = re.search(r"([0-9]+(?:\.[0-9]+)?)", r_mrp["detected_value"])
        if m: mrp_float = float(m.group(1))

    # 2. Net Quantity
    r_net_qty = check_net_quantity(raw_lines, norm_text)
    parsed_kg = r_net_qty.get("parsed_kg", 0.0)
    net_grams = r_net_qty.get("net_grams", 0.0)

    # 3. Manufacturer Details
    r_mfg = check_manufacturer_details(raw_lines, norm_text)

    # 4. Address Details
    r_addr = check_address(raw_lines, norm_text, detected_symbols)

    # 5. Consumer Care
    r_care = check_consumer_care(raw_lines, norm_text, detected_symbols)

    # 6. Date Declarations
    r_date = check_date_declarations(raw_lines, norm_text)

    # 7. Country of Origin
    r_origin = check_country_of_origin(raw_lines, norm_text, category)

    # 8. Unit Sale Price & Rule 6(11) Second Proviso
    r_usp = check_usp_and_rule_6_11(raw_lines, norm_text, mrp_float, net_grams, parsed_kg)

    if r_mrp["status"] == "REVIEW" and r_usp["status"] != "EXEMPT":
        r_usp.update(status="REVIEW", error_code="USP_PRICE_UNCERTAIN",
                     explanation="Unit sale price verification is withheld until the printed MRP is confirmed.")

    # 9. Font Compliance Table II
    r_font = check_font_compliance_table_ii(ocr_data, area, orig_w, orig_h)

    # 10. Category Statutory Mandates
    r_cat = check_category_statutory_mandates(raw_lines, norm_text, category, detected_symbols)

    rules = {
        "mrp": r_mrp,
        "net_qty": r_net_qty,
        "mfg_date": r_date,
        "manufacturer": r_mfg,
        "address": r_addr,
        "consumer_care": r_care,
        "usp": r_usp,
        "country_of_origin": r_origin,
        "font_compliance": r_font,
        "category_statutory": r_cat
    }

    # Count violations and determine overall verdict
    total_violations = sum(1 for r in rules.values() if r["status"] == "FAIL")
    has_review = any(r["status"] == "REVIEW" for r in rules.values())

    if total_violations == 0:
        compliance_status = "REVIEW" if has_review else "PASS"
        is_compliant = (compliance_status == "PASS")
    else:
        compliance_status = "FAIL"
        is_compliant = False

    return {
        "rules": rules,
        "is_compliant": is_compliant,
        "compliance_status": compliance_status,
        "total_violations": total_violations
    }

# ---------------------------------------------------------------------------
# API ENDPOINTS
# ---------------------------------------------------------------------------
@app.get("/api/rules")
def get_compliance_rules(db: Session = Depends(get_db)):
    """Retrieves all statutory PCR 2011 compliance rules and Table II thresholds."""
    rules = db.query(ComplianceRule).all()
    thresholds = db.query(FontHeightThreshold).order_by(FontHeightThreshold.min_area_sq_cm).all()
    return {
        "rules": [{
            "id": r.id,
            "key": r.rule_key,
            "rule_reference": r.rule_reference,
            "title": r.title,
            "description": r.description,
            "is_mandatory": r.is_mandatory,
            "category": r.category_applicability,
            "error_code": r.default_error_code,
            "penalty": r.penalty_reference
        } for r in rules],
        "thresholds": [{
            "min_area": t.min_area_sq_cm,
            "max_area": t.max_area_sq_cm,
            "min_font_height_mm": t.min_font_height_mm,
            "reference": t.rule_reference
        } for t in thresholds]
    }

# Keep heavy image work out of the event loop and bound memory on free hosts.
_scan_capacity = BoundedSemaphore(1)

def reserve_scan_slot():
    if not _scan_capacity.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="Another scan is running. Please wait for it to finish and try again.")
    try:
        yield
    finally:
        _scan_capacity.release()

@app.post("/api/scan", dependencies=[Depends(reserve_scan_slot)])
def scan_package(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    surface_area: Optional[str] = Form("120.0"),
    user_role: Optional[str] = Form("CITIZEN"),
    user_identifier: Optional[str] = Form("GUEST_CITIZEN"),
    state: Optional[str] = Form("National"),
    district: Optional[str] = Form("General"),
    pincode: Optional[str] = Form("110001"),
    category: Optional[str] = Form("FOOD"),
    ocr_engine: Literal["tesseract", "paddleocr", "hybrid"] = Form("tesseract"),
    db: Session = Depends(get_db)
):
    started = perf_counter()
    try:
        if ocr_engine != "tesseract" and not PADDLE_AVAILABLE:
            return JSONResponse(status_code=503, content={"error": "PaddleOCR is unavailable. Select Tesseract OCR and try again."})
        photos = ([file] if file else []) + (files or [])
        if not 1 <= len(photos) <= 8:
            return JSONResponse(status_code=400, content={"error": "Attach between 1 and 8 photos of the same package."})
        decoded = []
        total_bytes = 0
        for number, photo in enumerate(photos, 1):
            content = photo.file.read(15 * 1024 * 1024 + 1)
            total_bytes += len(content)
            if len(content) > 15 * 1024 * 1024 or total_bytes > 60 * 1024 * 1024:
                return JSONResponse(status_code=413, content={"error": "Use photos under 15 MB each and 60 MB total."})
            img = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
            if img is None:
                return JSONResponse(status_code=400, content={"error": f"Photo {number} is not a readable image."})
            h, w = img.shape[:2]
            if max(h, w) > 2400:
                scale = 2400 / max(h, w)
                img = cv2.resize(img, (max(1, round(w*scale)), max(1, round(h*scale))))
            decoded.append((content, img))

        raw_lines, ocr_data, detected_symbols, sources = [], [], [], []
        tiles = []
        offset = 0
        batch_id = str(uuid.uuid4())
        for number, (content, img) in enumerate(decoded, 1):
            lines, detections = (extract_text(img) if ocr_engine == "tesseract" else
                                 extract_paddle(img, verify_prices=ocr_engine == "hybrid"))
            if not lines:
                return JSONResponse(status_code=422, content={"error": f"No readable text in photo {number}. Remove it or upload a sharper label photo."})
            symbols = detect_symbols(img, " ".join(lines))
            header = 36 if len(photos) > 1 else 0
            for item in detections + symbols:
                item["photo_number"] = number
                item["bbox"] = [[int(x), int(y)+offset+header] for x, y in item["bbox"]]
            tile = cv2.copyMakeBorder(img, header, 0, 0, 0, cv2.BORDER_CONSTANT, value=(255,255,255))
            if header:
                cv2.putText(tile, f"Photo {number}", (10,25), cv2.FONT_HERSHEY_SIMPLEX, .7, (0,0,0), 2)
            tiles.append(tile)
            offset += tile.shape[0]
            raw_lines.extend(lines)
            ocr_data.extend(detections)
            detected_symbols.extend(symbols)
            sources.append({"photo_number": number, "sha256": compute_sha256(content),
                            "image_url": f"/uploads/{batch_id}-{number}.original", "text": lines})
        width = max(tile.shape[1] for tile in tiles)
        img = np.vstack([cv2.copyMakeBorder(tile, 0, 0, 0, width-tile.shape[1], cv2.BORDER_CONSTANT, value=(255,255,255)) for tile in tiles])
        orig_h, orig_w = img.shape[:2]
        saved_filename = f"{batch_id}.jpg"
        saved_path = os.path.join("uploads", saved_filename)
        cv2.imwrite(saved_path, img)
        for source, (content, _) in zip(sources, decoded):
            with open(source["image_url"].lstrip('/'), 'wb') as out:
                out.write(content)
        evidence_hash = (sources[0]["sha256"] if len(sources) == 1 else
                         compute_sha256(json.dumps(sources, sort_keys=True).encode()))
        with open(f"uploads/{batch_id}.json", 'w') as out:
            json.dump({"photos": sources, "evidence_sha256": evidence_hash}, out)

        area_float = float(surface_area) if surface_area else 120.0
        pipeline_result = run_compliance_pipeline(
            raw_lines, ocr_data, area_float, str(category or "FOOD"), orig_w, orig_h, detected_symbols
        )
        if len(photos) > 1:
            # A contact sheet cannot establish the physical scale of individual sides.
            pipeline_result["rules"]["font_compliance"].update(
                status="REVIEW", detected_value="Multiple photos: physical scale requires review",
                explanation="Measure numeral height on the actual package; combined photo dimensions do not establish scale.")
            count = sum(r["status"] == "FAIL" for r in pipeline_result["rules"].values())
            pipeline_result.update(total_violations=count, is_compliant=False,
                                   compliance_status="FAIL" if count else "REVIEW")
        brand = str(pipeline_result["rules"]["manufacturer"]["detected_value"] or "Packaged Commodity")

        # Database Logging with WAL connection pooling
        db_id = 1
        try:
            record = InspectionRecord(
                case_id=f"DoCA-LM-2026-TEMP",
                user_role=str(user_role or "CITIZEN"),
                user_identifier=str(user_identifier or "GUEST_CITIZEN"),
                state=str(state or "National"),
                district=str(district or "General"),
                pincode=str(pincode or "110001"),
                commodity_category=str(category or "FOOD"),
                brand_name=brand[:90],
                image_filename=saved_filename,
                package_area_sq_cm=area_float,
                is_compliant=bool(pipeline_result["is_compliant"]),
                compliance_status=str(pipeline_result["compliance_status"]),
                total_violations=int(pipeline_result["total_violations"]),
                extracted_text=" ".join(raw_lines),
                rule_verifications=pipeline_result["rules"],
                detected_symbols=detected_symbols,
                evidence_sha256=evidence_hash
            )
            db.add(record)
            db.flush()
            db_id = record.id
            record.case_id = f"DoCA-LM-2026-{record.id:04d}"

            pdf_filename = f"Audit_Report_{record.id}.pdf"
            pdf_path = os.path.join("reports", pdf_filename)
            generate_forensic_pdf_report(
                record.id,
                saved_path,
                pipeline_result,
                pdf_path,
                record.user_identifier,
                record.state,
                record.district,
                evidence_hash
            )
            record.pdf_report_path = pdf_path
            db.commit()
        except Exception as db_err:
            print("[WARN] Database / PDF logging error:", db_err)
            db.rollback()
            raise RuntimeError("Could not save the inspection and PDF. Please retry.") from db_err

        case_id_str = f"DoCA-LM-2026-{db_id:04d}"

        # Real-time Forensic Server Console Log for Judges & Enforcement Officers
        print(f"\n{CYAN}{BOLD}{'='*75}{RESET}")
        print(f"{CYAN}{BOLD}⚖️   [DoCA LM NODE 26034] INCOMING STATUTORY AUDIT REQUEST{RESET}")
        print(f"👤  User / Inspector:   {user_identifier} ({user_role})")
        print(f"📍  Jurisdiction:       {district}, {state} (PIN: {pincode})")
        print(f"📦  Category & PDP:     {category} | Surface Area: {area_float} cm²")
        print(f"🔒  Evidence SHA-256:   {evidence_hash[:32]}... (Sec 63 BSA 2023)")
        print(f"🔎  OCR Tokens Found:   {len(raw_lines)} tokens extracted")
        if detected_symbols:
            sym_names = ", ".join([s['name'] for s in detected_symbols])
            print(f"🛡️   Regulatory Marks:   {sym_names}")
        print(f"{CYAN}{'-'*75}{RESET}")
        print(f"{BOLD}📜  STATUTORY PCR 2011 VERIFICATION BREAKDOWN:{RESET}")
        for k, v in pipeline_result["rules"].items():
            st = v.get("status", "FAIL")
            st_col = GREEN if st == "PASS" else (CYAN if st == "EXEMPT" else (YELLOW if st == "REVIEW" else RED))
            val = str(v.get("detected_value") or "Not Detected")[:42]
            print(f"  ├─ {v.get('rule_ref', k):14s} [{k.upper():16s}]: {st_col}[{st:6s}]{RESET} {val}")
        
        status = pipeline_result["compliance_status"]
        v_col = GREEN if status == "PASS" else (YELLOW if status == "REVIEW" else RED)
        print(f"{CYAN}{'-'*75}{RESET}")
        print(f"⚖️   {BOLD}FINAL AUDIT VERDICT:{RESET} {v_col}{BOLD}{status}{RESET} (Violations: {pipeline_result['total_violations']})")
        print(f"📄  Section 63 BSA Dossier: reports/Audit_Report_{db_id}.pdf")
        print(f"💾  Committed to {engine.dialect.name}: Case ID {case_id_str}")
        print(f"{CYAN}{BOLD}{'='*75}{RESET}\n")

        return {
            "inspection_id": int(db_id),
            "ocr_engine": ocr_engine,
            "analysis_seconds": round(perf_counter() - started, 3),
            "case_id": case_id_str,
            "user_role": str(user_role),
            "user_identifier": str(user_identifier),
            "brand": brand,
            "category": str(category),
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
            "image_url": f"/uploads/{saved_filename}",
            "photo_count": len(sources),
            "photos": sources,
            "report_pdf_url": f"/reports/Audit_Report_{db_id}.pdf",
            "evidence_sha256": evidence_hash,
            "evidence_standard": "Section 63 Bharatiya Sakshya Adhiniyam, 2023 / Section 65B Indian Evidence Act, 1872",
            "is_compliant": bool(pipeline_result["is_compliant"]),
            "compliance_status": str(pipeline_result["compliance_status"]),
            "total_violations": int(pipeline_result["total_violations"]),
            "rules": pipeline_result["rules"],
            "symbols": detected_symbols,
            "detections": ocr_data
        }

    except Exception as e:
        print("[CRITICAL ERROR IN /api/scan]:", e)
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/api/inspections")
def get_inspections(db: Session = Depends(get_db)):
    try:
        records = db.query(InspectionRecord).order_by(InspectionRecord.timestamp.desc()).all()
        return [{
            "id": r.id,
            "caseId": r.case_id or f"DoCA-LM-2026-{r.id:04d}",
            "userRole": r.user_role,
            "userIdentifier": r.user_identifier,
            "time": r.timestamp.strftime("%Y-%m-%d %H:%M"),
            "brand": r.brand_name,
            "location": f"{r.district}, {r.state}",
            "status": r.compliance_status or ("PASS" if r.is_compliant else "FAIL"),
            "violations": "None (Compliant)" if r.is_compliant else f"{r.total_violations} Violations",
            "category": r.commodity_category,
            "area": r.package_area_sq_cm,
            "pdf_url": f"/reports/Audit_Report_{r.id}.pdf"
        } for r in records]
    except Exception as e:
        return []

@app.get("/api/inspections/{inspection_id}")
def get_inspection(inspection_id: int, db: Session = Depends(get_db)):
    record = db.get(InspectionRecord, inspection_id)
    if record is None:
        return JSONResponse(status_code=404, content={"error":"Record not found"})
    image_name = os.path.basename(record.image_filename)
    manifest_path = os.path.join("uploads", os.path.splitext(image_name)[0] + ".json")
    photos = []
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8") as source:
            photos = json.load(source).get("photos", [])
    return {
        "inspection_id": record.id, "case_id": record.case_id,
        "brand": record.brand_name, "category": record.commodity_category,
        "image_url": "/uploads/" + image_name,
        "photo_count": len(photos) or 1, "photos": photos,
        "report_pdf_url": f"/reports/Audit_Report_{record.id}.pdf",
        "evidence_sha256": record.evidence_sha256,
        "is_compliant": record.is_compliant, "compliance_status": record.compliance_status,
        "total_violations": record.total_violations, "rules": record.rule_verifications,
        "symbols": record.detected_symbols, "detections": [],
        "extracted_text": record.extracted_text,
    }

@app.delete("/api/inspections/{inspection_id}")
def delete_inspection(inspection_id: int, db: Session = Depends(get_db)):
    record = db.query(InspectionRecord).filter(InspectionRecord.id == inspection_id).first()
    if not record:
        return JSONResponse(status_code=404, content={"error": "Record not found"})
    db.delete(record)
    db.commit()
    return {"status": "success"}

@app.post("/api/complaints/dispatch")
def dispatch_statutory_notice(
    case_id: str = Form(...),
    sender_id: str = Form(...),
    recipient_type: str = Form(...),
    recipient_contact: Optional[str] = Form("enforcement@doca.gov.in")
):
    token = f"NOTICE-{uuid.uuid4().hex[:8].upper()}"
    return {
        "status": "DRAFT",
        "reference_id": token,
        "case_id": case_id,
        "sender": sender_id,
        "target": recipient_type,
        "contact": recipient_contact,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Complaint draft for Case {case_id}. No notice or email has been sent. Download your report and submit it through the official consumer complaint portal."
    }

# ---------------------------------------------------------------------------
# INTERACTIVE METROLOGY AI LEGAL ADVISOR ENDPOINT
# ---------------------------------------------------------------------------
class ChatQuery(BaseModel):
    query: str
    session_id: Optional[str] = "guest"

@app.post("/api/advisor/chat")
def advisor_chat(body: ChatQuery):
    q = body.query.lower().strip()
    
    # 1. Greetings
    if re.search(r"\b(hi|hello|hey|namaste|greetings)\b", q):
        return {
            "answer": (
                "Hello! 👋 I am your <strong>Legal Metrology AI Advisor</strong>.<br><br>"
                "I can analyze real-world packaging compliance scenarios under the <em>Legal Metrology (Packaged Commodities) Rules, 2011</em>.<br><br>"
                "Try asking me about:<br>"
                "• <strong>Dual pricing or cooling charges</strong> (Airports, multiplexes, retail stores)<br>"
                "• <strong>Smudged price stickers</strong> or alteration of MRP<br>"
                "• <strong>Rule 6(11) Unit Sale Price (USP)</strong> and Second Proviso exemptions<br>"
                "• <strong>Section 36 penalties</strong> (Fines up to ₹25,000 / ₹50,000)<br>"
                "• <strong>National Consumer Helpline (NCH 1915)</strong> dispute routing"
            )
        }
    
    # 2. Dual pricing & cooling charges
    elif re.search(r"(airport|multiplex|mall|cooling|refrigeration|overcharg|higher price|extra charge)", q):
        return {
            "answer": (
                "<strong>Statutory Scenario Assessment: Overcharging & Cooling Charges</strong><br><br>"
                "Charging even ₹1 above the printed MRP—under the pretext of 'refrigeration charges' or at airports/malls—is strictly illegal.<br><br>"
                "• <strong>Legal Violation:</strong> Section 36(3) of the Legal Metrology Act, 2009 & Rule 18(2) of PCR 2011.<br>"
                "• <strong>Supreme Court Precedent:</strong> The Supreme Court in <em>Federation of Hotels & Restaurants Association of India</em> held that dual pricing on identical packaged commodities is illegal.<br>"
                "• <strong>Penalties:</strong> Up to ₹25,000 fine for a 1st offense, ₹50,000 for a 2nd offense, and imprisonment for subsequent offenses.<br><br>"
                "<em>Consumer Redressal:</em> Call the <strong>National Consumer Helpline at 1915</strong> or register on the <strong>INGRAM portal (consumerhelpline.gov.in)</strong>."
            )
        }

    # 3. Stickers covering MRP or dates
    elif re.search(r"(sticker|smudge|pasted|tamper|cover|alter|hidden)", q):
        return {
            "answer": (
                "<strong>Statutory Scenario Assessment: Alteration via Price Stickers</strong><br><br>"
                "Pasting price stickers over the original MRP or manufacturing date is illegal under Rule 6 of PCR 2011 unless specifically authorized under a central gazette notification.<br><br>"
                "• <strong>Enforcement Action:</strong> Retailers and packers pasting stickers are liable for seizure of commodities by Legal Metrology Inspectors under Section 15.<br>"
                "• <strong>Offense:</strong> Section 36(1) of the Act (Non-conforming packaging declarations)."
            )
        }

    # 4. Rule 6(11) Unit Sale Price & Exemptions
    elif re.search(r"(usp|unit sale price|rule 6\(11\)|proviso|exemption|per gram|per ml)", q):
        return {
            "answer": (
                "<strong>Rule 6(11) Unit Sale Price (USP) Mandate & Statutory Exemptions:</strong><br><br>"
                "• <strong>Packs < 1 kg or < 1 L:</strong> USP must be declared in <strong>₹ per g</strong> or <strong>₹ per ml</strong>.<br>"
                "• <strong>Packs > 1 kg or > 1 L:</strong> USP must be declared in <strong>₹ per kg</strong> or <strong>₹ per L</strong>.<br>"
                "• <strong>Second Proviso Exemption:</strong> On packages containing exactly <strong>1 kg, 1 L, or 1 unit</strong>, a separate USP declaration is not required because MRP equals USP.<br>"
                "• <strong>Rule 26 Small Pack Exemption:</strong> Packages with net quantity <= 10 g or <= 10 ml are exempt from retail declarations."
            )
        }

    # 5. Penalties under Section 36
    elif re.search(r"(penalty|fine|jail|imprisonment|section 36|section 29)", q):
        return {
            "answer": (
                "<strong>Penalties under Legal Metrology Act, 2009:</strong><br><br>"
                "• <strong>Section 36(1) (Non-standard Declarations):</strong> Fine up to ₹25,000 for 1st offense; ₹50,000 for 2nd offense; up to ₹1,00,000 or imprisonment up to 1 year for subsequent offenses.<br>"
                "• <strong>Section 36(3) (Overcharging over MRP):</strong> Fine up to ₹25,000 for 1st offense; up to ₹50,000 for 2nd offense.<br>"
                "• <strong>Section 29 (Non-SI Metric Units like 'gm', 'ltr'):</strong> Fine up to ₹10,000.<br>"
                "• <strong>Compounding:</strong> Offenses may be compounded by the Controller under Section 48 upon payment of statutory compounding fees."
            )
        }

    # 6. Official Contacts & National Consumer Helpline
    elif re.search(r"(contact|helpline|phone|email|call|nch|ingram|complain)", q):
        return {
            "answer": (
                "<strong>Official Consumer Redressal Escalation Channels:</strong><br><br>"
                "📞 <strong>National Consumer Helpline (NCH):</strong><br>"
                "• Toll-Free: <strong>1915</strong> or <strong>1800-11-4000</strong> (8 AM to 8 PM, all days)<br>"
                "• SMS Support: <strong>8800001915</strong><br>"
                "• Portal: <a href='https://consumerhelpline.gov.in/' target='_blank' style='color: #0284c7;'>consumerhelpline.gov.in</a><br><br>"
                "🏛️ <strong>Department of Consumer Affairs:</strong><br>"
                "• Legal Metrology Portal: <a href='https://lm.doca.gov.in/' target='_blank' style='color: #0284c7;'>lm.doca.gov.in</a><br>"
                "• Directorate Email: <strong>enforcement@doca.gov.in</strong>"
            )
        }

    # Default fallback
    else:
        return {
            "answer": (
                "I am your <strong>Legal Metrology Statutory Advisor</strong>.<br><br>"
                "You can ask me about retail packaging compliance, the Legal Metrology (Packaged Commodities) Rules, 2011, "
                "Section 36 penalties, Unit Sale Price exemptions, or how to file grievances with the <strong>National Consumer Helpline (1915)</strong>."
            )
        }

# ---------------------------------------------------------------------------
# SAMPLE PACKAGING PRESETS (DEMO MODE READY FOR JUDGES)
# ---------------------------------------------------------------------------
@app.get("/api/presets")
def get_packaging_presets():
    """Returns pre-configured packaging test cases across commodity archetypes."""
    return [
        {
            "id": "atta_1kg_compliant",
            "title": "Aashirvaad Shuddh Chakki Atta 1 kg",
            "category": "FOOD",
            "pdp_area": 140,
            "expected_verdict": "PASS",
            "highlight": "Compliant: Rule 6(11) Second Proviso USP Exemption (1 kg pack), FSSAI license & Veg mark",
            "image_url": "/presets/atta_1kg.jpg"
        },
        {
            "id": "biscuit_non_si_violation",
            "title": "Glucose Biscuits 200 gm",
            "category": "FOOD",
            "pdp_area": 85,
            "expected_verdict": "FAIL",
            "highlight": "Violation: Non-SI unit 'gm' (Rule 6(1)(c)) and missing 'inclusive of all taxes'",
            "image_url": "/presets/biscuit_violation.jpg"
        },
        {
            "id": "cold_drink_750ml_compliant",
            "title": "Sparkling Cola Beverage 750 ml",
            "category": "DRINKS",
            "pdp_area": 110,
            "expected_verdict": "PASS",
            "highlight": "Compliant: Explicit USP ₹0.05/ml, Dual volume, Best before date",
            "image_url": "/presets/drink_750ml.jpg"
        },
        {
            "id": "soap_tfm_compliant",
            "title": "Natural Sandal Soap Bar 125 g",
            "category": "SOAP",
            "pdp_area": 60,
            "expected_verdict": "PASS",
            "highlight": "Compliant: TFM 76% Grade 1 standard, M-Lic, standard SI unit 'g'",
            "image_url": "/presets/soap_125g.jpg"
        },
        {
            "id": "earbuds_origin_violation",
            "title": "Wireless Stereo Earphones",
            "category": "ELECTRONICS",
            "pdp_area": 75,
            "expected_verdict": "FAIL",
            "highlight": "Violation: Missing Country of Origin under Rule 6(1)(m) & BIS registration",
            "image_url": "/presets/earbuds_violation.jpg"
        }
    ]

# ---------------------------------------------------------------------------
# MOUNT FRONTEND (Serves index.html, style.css, script.js on single port 8000)
# ---------------------------------------------------------------------------
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "FRONTEND"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

