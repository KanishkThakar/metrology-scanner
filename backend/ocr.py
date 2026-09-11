"""Tesseract OCR with line boxes expressed in the input image coordinates."""
import os
from pathlib import Path
import shlex
import re
from collections import Counter

import cv2
import numpy as np
import pytesseract
from ocr_cache import cached_ocr

DATA_DIR = Path(os.environ.get("TESSERACT_DATA_DIR", Path(__file__).parent / "tessdata"))
MODEL_CONFIG = "--tessdata-dir " + shlex.quote(str(DATA_DIR)) if (DATA_DIR / "eng.traineddata").exists() else ""
ENGINE_NAME = "Tesseract OCR (multi-pass + tessdata_best price verification)" if MODEL_CONFIG else "Tesseract OCR (system LSTM)"


def init_ocr_engine():
    command = os.environ.get("TESSERACT_CMD")
    if command:
        pytesseract.pytesseract.tesseract_cmd = command
    pytesseract.get_tesseract_version()  # Fail startup if the native engine is missing.
    language = os.environ.get("TESSERACT_LANG", "eng")
    available = pytesseract.get_languages(config=MODEL_CONFIG)
    missing = set(language.split("+")) - set(available)
    if missing:
        raise RuntimeError(f"Missing Tesseract language data: {sorted(missing)}")


def _read_lines(image, psm=11, min_confidence=15, model_config=""):
    data = pytesseract.image_to_data(
        image, lang=os.environ.get("TESSERACT_LANG", "eng"),
        config=f"{model_config} --oem 1 --psm {psm}", output_type=pytesseract.Output.DICT, timeout=float(os.environ.get("TESSERACT_TIMEOUT_SECONDS", "20")),
    )
    groups = {}
    for i, text in enumerate(data["text"]):
        text = text.strip()
        confidence = float(data["conf"][i])
        if not text or confidence < min_confidence:
            continue
        key = tuple(data[field][i] for field in ("page_num", "block_num", "par_num", "line_num"))
        x, y, w, h = (int(data[field][i]) for field in ("left", "top", "width", "height"))
        groups.setdefault(key, []).append((text, confidence, x, y, x+w, y+h))
    result = []
    for words in groups.values():
        x0, y0 = min(w[2] for w in words), min(w[3] for w in words)
        x1, y1 = max(w[4] for w in words), max(w[5] for w in words)
        result.append({"text": " ".join(w[0] for w in words),
                       "confidence": sum(w[1] for w in words) / (100 * len(words)),
                       "bbox": [[x0,y0], [x1,y0], [x1,y1], [x0,y1]]})
    return result


PRICE_PATTERN = re.compile(
    r"(?:\brs\b\.?|\binr\b|₹|\bm[. ]*r[. ]*p\b[.]*)[\s.:₹-]*(?:rs[. ]*)?"
    r"((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d.,])", re.I)


def price_values(text):
    values = []
    for match in PRICE_PATTERN.finditer(text):
        tail = text[match.end():]
        if re.match(r"\s*(?:per\b|/\s*(?:g|kg|ml|l)\b)", tail, re.I):
            continue
        value = float(match.group(1).replace(",", ""))
        if value > 0:
            values.append(value)
    return values


def _refine_prices(gray, lines):
    """Re-read currency regions without assuming a preferred amount or digit count."""
    for line in lines:
        if not price_values(line["text"]):
            continue
        (x0, y0), _, (x1, y1), _ = line["bbox"]
        pad = max(5, round((y1-y0)*.35))
        xpad = max(10, round((y1-y0)*.5))
        crop = gray[max(0,y0-pad):min(gray.shape[0],y1+pad), max(0,x0-xpad):min(gray.shape[1],x1+xpad)]
        scale = min(4, max(1.5, 60/max(1,y1-y0)))
        crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        binary = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)[1]
        # Light dilation of dark ink joins dot-matrix strokes without deleting digits.
        joined = cv2.erode(binary, np.ones((2,2), np.uint8))
        readings = [{"text": line["text"], "confidence": line["confidence"], "method": "page"}]
        for name, variant in (("crop_gray", crop), ("crop_binary", binary), ("crop_joined", joined), ("best_binary", binary)):
            result = _read_lines(variant, psm=7, min_confidence=0, model_config=MODEL_CONFIG if name.startswith("best") else "")
            readings.append({"text": " ".join(r["text"] for r in result),
                             "confidence": min((r["confidence"] for r in result), default=0), "method": name})
        votes = Counter()
        for reading in readings:
            values = price_values(reading["text"])
            if len(set(values)) == 1:
                votes[values[0]] += 1
        ranked = votes.most_common()
        winner = ranked[0][0] if ranked and ranked[0][1] >= 2 and (len(ranked)==1 or ranked[0][1] > ranked[1][1]) else None
        line["price_evidence"] = readings
        line["price_candidates"] = sorted(votes)
        line["price_value"] = winner
        line["price_needs_review"] = winner is None or len(votes) > 1
        if winner is not None:
            candidates = [r for r in readings if price_values(r["text"]) == [winner]]
            chosen = max(candidates, key=lambda r:r["confidence"])
            line["original_text"] = line["text"]
            line["text"] = chosen["text"]
            line["confidence"] = chosen["confidence"]
            line["price_needs_review"] |= chosen["confidence"] < .75
    return lines


def _recover_faint_text(gray, lines):
    """A second contrast/scale pass recovers small print on difficult packaging."""
    if not lines or sum(x["confidence"] for x in lines)/len(lines) >= .85:
        return lines
    enhanced = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8)).apply(gray)
    scale = min(2.0, 3000/max(gray.shape))
    enhanced = cv2.resize(enhanced, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    recovered = _read_lines(enhanced)
    for item in recovered:
        if item["confidence"] < .65 or len(item["text"]) < 3:
            continue
        item["bbox"] = [[round(x/scale), round(y/scale)] for x,y in item["bbox"]]
        (x,y),_,(xx,yy),_ = item["bbox"]
        overlaps = []
        for index,old in enumerate(lines):
            (a,b),_,(aa,bb),_ = old["bbox"]
            intersection = max(0,min(xx,aa)-max(x,a))*max(0,min(yy,bb)-max(y,b))
            if intersection/max(1,min((xx-x)*(yy-y),(aa-a)*(bb-b))) > .5:
                overlaps.append(index)
        if not overlaps:
            lines.append(item)
        elif len(overlaps)==1:
            old = lines[overlaps[0]]
            if item["confidence"] > old["confidence"] + .12 and not price_values(old["text"]):
                lines[overlaps[0]] = item
    return sorted(lines, key=lambda item:(item["bbox"][0][1],item["bbox"][0][0]))


def _extract_text_uncached(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    best, best_score = [], -1
    for turns in range(4):
        rotated = np.ascontiguousarray(np.rot90(gray, turns))
        lines = _read_lines(rotated)
        keywords = sum(len(re.findall(r"\b(mrp|net|weight|quantity|taxes|mfg|packed|care|india|kg|ml)\b", item["text"], re.I)) for item in lines)
        score = keywords * 10 + sum(item["confidence"] * len(item["text"]) for item in lines)
        if score > best_score:
            best, best_score, best_turns = lines, score, turns
        if turns == 0 and keywords >= 5:
            break
    upright = np.ascontiguousarray(np.rot90(gray, best_turns))
    best = _recover_faint_text(upright, best)
    best = _refine_prices(upright, best)
    for item in best:
        points = []
        for x, y in item["bbox"]:
            if best_turns == 1:
                x, y = width-y, x
            elif best_turns == 2:
                x, y = width-x, height-y
            elif best_turns == 3:
                x, y = y, height-x
            points.append((x,y))
        x0, x1 = min(p[0] for p in points), max(p[0] for p in points)
        y0, y1 = min(p[1] for p in points), max(p[1] for p in points)
        item["bbox"] = [[x0,y0], [x1,y0], [x1,y1], [x0,y1]]
    return [item["text"] for item in best], best


def extract_text(image):
    image = np.ascontiguousarray(image)
    namespace = ("tesseract-v1", os.getenv("TESSERACT_LANG", "eng"), MODEL_CONFIG)
    return cached_ocr(image, namespace, lambda: _extract_text_uncached(image))
