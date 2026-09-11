"""Barcode decoding and an explicitly manual Verified by GS1 comparison.

No public GS1 pages are scraped. User-entered registry details are never
represented as an authenticated API response or as a legal finding.
"""
import hashlib
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
import zxingcpp
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, JSON
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import Base, InspectionRecord, engine, get_db

GS1_URL = "https://www.gs1.org/services/verified-by-gs1"
NOTICE = "Registry details are entered by the reviewer, not retrieved by a GS1 API. Wording differences require review; this does not establish authenticity or legal compliance."
router = APIRouter(prefix="/api/inspections", tags=["Barcode identity"])


class BarcodeIdentityRecord(Base):
    __tablename__ = "barcode_identity_reviews"
    inspection_id = Column(Integer, primary_key=True)
    payload = Column(JSON, nullable=False)


# A separate table leaves existing inspection schemas and rules unchanged.
BarcodeIdentityRecord.__table__.create(bind=engine, checkfirst=True)


def normalize_gtin(value: str) -> str:
    value = re.sub(r"[\s-]", "", value)
    if not re.fullmatch(r"(?:[0-9]{8}|[0-9]{12,14})", value):
        raise ValueError("Enter an 8, 12, 13 or 14 digit GTIN using digits only.")
    if not value.strip("0"):
        raise ValueError("An all-zero code is not a product GTIN.")
    total = sum(int(n) * (3 if i % 2 == 0 else 1) for i, n in enumerate(reversed(value[:-1])))
    if (10 - total % 10) % 10 != int(value[-1]):
        raise ValueError("The GTIN check digit is incorrect. Check the printed digits or take a sharper photo.")
    return value


def gtin_from_symbol(text: str, symbology: str) -> str | None:
    # Do not mistake arbitrary numeric QR payloads, dates or serials for GTINs.
    value = text if symbology in {"EAN-13", "EAN-8", "UPC-A"} or (symbology == "ITF" and len(text) == 14) else None
    if symbology in {"QR Code", "Data Matrix", "Code 128", "DataBar", "DataBar Expanded"}:
        match = re.match(r"^\(01\)([0-9]{14})(?:\(|$)", text)
        if not match:
            match = re.match(r"^https?://[^/\s]+/01/([0-9]{14})(?:[/?#]|$)", text)
        if match:
            value = match.group(1)
    try:
        return normalize_gtin(value) if value else None
    except ValueError:
        return None


def decode_barcodes(image: np.ndarray, photo_number: int) -> list[dict]:
    found = []
    for symbol in zxingcpp.read_barcodes(image, try_rotate=True, try_downscale=True, try_invert=True):
        gtin = gtin_from_symbol(symbol.text, str(symbol.format))
        if gtin:
            found.append({"gtin": gtin, "format": str(symbol.format), "photo_numbers": [photo_number]})
    return found


def normalized_words(value: str) -> str:
    # Keep numbers and meaningful words. No fuzzy matches or company-suffix removal.
    return " ".join(re.findall(r"[^\W_]+", unicodedata.normalize("NFKC", value).casefold()))


def compare_field(value: str, photos: list[dict]) -> dict:
    needle = normalized_words(value)
    if not needle:
        return {"registry_value": "", "status": "not_available", "evidence": []}
    evidence = []
    for photo in photos:
        text = photo["text"]
        if f" {needle} " in f" {normalized_words(text)} ":
            evidence.append({"photo_number": photo["photo_number"], "text": text})
    return {"registry_value": value, "status": "wording_found" if evidence else "needs_review", "evidence": evidence}


class RegistryReview(BaseModel):
    gtin: str = Field(max_length=32)
    registry_gtin: str = Field(max_length=32)
    outcome: Literal["found", "not_found"] = "found"
    company: str = Field(default="", max_length=300)
    product: str = Field(default="", max_length=300)
    brand: str = Field(default="", max_length=200)
    confirmed: Literal[True]


def build_review(request: RegistryReview, payload: dict) -> dict:
    gtin, registry_gtin = normalize_gtin(request.gtin), normalize_gtin(request.registry_gtin)
    if gtin.zfill(14) != registry_gtin.zfill(14):
        raise ValueError("The GS1 result is for a different GTIN. Open the lookup for this barcode and check again.")
    codes = payload["barcodes"]
    selected = next((b for b in codes if b["gtin"].zfill(14) == gtin.zfill(14)), None)
    if codes and not selected:
        raise ValueError("Select a barcode decoded from this inspection's photos.")
    values = {k: getattr(request, k).strip() if request.outcome == "found" else "" for k in ("company", "product", "brand")}
    if request.outcome == "found" and not any(normalized_words(v) for v in values.values()):
        raise ValueError("Enter the company or product information actually returned by GS1.")
    comparison = {k: compare_field(v, payload["label_photos"]) for k, v in values.items()}
    return {"gtin": gtin, "registry_gtin": registry_gtin, "barcode_source": "decoded_photo" if selected else "manually_entered",
            "registry_source": "reviewer_entered", "source_url": GS1_URL, "registry_outcome": request.outcome,
            "api_verified": False, "checked_at": datetime.now(timezone.utc).isoformat(),
            "status": "needs_review" if request.outcome == "not_found" or any(c["status"] == "needs_review" for c in comparison.values()) else "available_wording_found",
            "comparison": comparison, "notice": NOTICE}


def load_identity(inspection_id: int, db: Session) -> BarcodeIdentityRecord:
    record = db.get(InspectionRecord, inspection_id)
    if record is None:
        raise HTTPException(404, "Inspection not found.")
    saved = db.get(BarcodeIdentityRecord, inspection_id)
    if saved and saved.payload.get("evidence_sha256") == record.evidence_sha256:
        return saved
    root = Path("uploads").resolve()
    name = Path(record.image_filename).name
    manifest = root / (Path(name).stem + ".json")
    if not manifest.exists():
        raise HTTPException(410, "Original photo evidence is unavailable. Run a new scan to check its barcode.")
    photos = json.loads(manifest.read_text())["photos"]
    if not 1 <= len(photos) <= 8:
        raise HTTPException(409, "Photo manifest is invalid. Run a new scan.")
    expected_hash = photos[0]["sha256"] if len(photos) == 1 else hashlib.sha256(json.dumps(photos, sort_keys=True).encode()).hexdigest()
    if expected_hash != record.evidence_sha256:
        raise HTTPException(409, "Photo manifest integrity check failed. Barcode comparison was stopped.")
    barcodes, labels = {}, []
    for photo in photos[:8]:
        path = (root / Path(photo["image_url"]).name).resolve()
        if not path.is_relative_to(root) or not path.is_file() or path.stat().st_size > 15 * 1024 * 1024:
            raise HTTPException(410, "A source photo is unavailable. Run a new scan.")
        content = path.read_bytes()
        if hashlib.sha256(content).hexdigest() != photo["sha256"]:
            raise HTTPException(409, "Photo integrity check failed. Barcode comparison was stopped.")
        image = cv2.imdecode(np.frombuffer(content, np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(422, "Source photo could not be decoded.")
        height, width = image.shape[:2]
        if max(height, width) > 3200:
            image = cv2.resize(image, (round(width * 3200 / max(height, width)), round(height * 3200 / max(height, width))))
        for code in decode_barcodes(image, photo["photo_number"]):
            key = code["gtin"].zfill(14)
            if key in barcodes:
                barcodes[key]["photo_numbers"] = sorted(set(barcodes[key]["photo_numbers"] + code["photo_numbers"]))
            else:
                barcodes[key] = code
        text = photo.get("text", [])
        labels.append({"photo_number": photo["photo_number"], "text": "\n".join(text) if isinstance(text, list) else str(text)})
    payload = {"inspection_id": inspection_id, "evidence_sha256": record.evidence_sha256,
               "barcodes": list(barcodes.values()), "label_photos": labels, "reviews": [],
               "lookup_url": GS1_URL, "access_mode": "manual_lookup", "api_connected": False,
               "notice": NOTICE, "decoder": "ZXing-C++"}
    if saved:
        saved.payload = payload
    else:
        saved = BarcodeIdentityRecord(inspection_id=inspection_id, payload=payload)
        db.add(saved)
    try:
        db.commit()
    except IntegrityError:
        # Two browser reads may arrive together; reuse the first stored decode.
        db.rollback()
        saved = db.get(BarcodeIdentityRecord, inspection_id)
        if saved is None:
            raise
    return saved


@router.get("/{inspection_id}/barcode-identity")
def get_identity(inspection_id: int, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return load_identity(inspection_id, db).payload


@router.post("/{inspection_id}/barcode-identity")
def save_identity(inspection_id: int, request: RegistryReview, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    saved = load_identity(inspection_id, db)
    try:
        review = build_review(request, saved.payload)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    reviews = [r for r in saved.payload["reviews"] if r["gtin"].zfill(14) != review["gtin"].zfill(14)]
    saved.payload = {**saved.payload, "reviews": [*reviews, review]}
    db.commit()
    return saved.payload
