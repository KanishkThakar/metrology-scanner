"""Tesseract OCR with line boxes expressed in the input image coordinates."""
import os
import re

import cv2
import numpy as np
import pytesseract

ENGINE_NAME = "Tesseract OCR (LSTM)"


def init_ocr_engine():
    command = os.environ.get("TESSERACT_CMD")
    if command:
        pytesseract.pytesseract.tesseract_cmd = command
    pytesseract.get_tesseract_version()  # Fail startup if the native engine is missing.
    language = os.environ.get("TESSERACT_LANG", "eng")
    available = pytesseract.get_languages(config="")
    missing = set(language.split("+")) - set(available)
    if missing:
        raise RuntimeError(f"Missing Tesseract language data: {sorted(missing)}")


def _read_lines(image):
    data = pytesseract.image_to_data(
        image, lang=os.environ.get("TESSERACT_LANG", "eng"),
        config="--oem 1 --psm 11", output_type=pytesseract.Output.DICT, timeout=20,
    )
    groups = {}
    for i, text in enumerate(data["text"]):
        text = text.strip()
        confidence = float(data["conf"][i])
        if not text or confidence < 15:
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


def extract_text(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    best, best_score = [], -1
    for turns in range(4):
        rotated = np.ascontiguousarray(np.rot90(gray, turns))
        lines = _read_lines(rotated)
        keywords = sum(len(re.findall(r"\b(mrp|net|weight|quantity|taxes|mfg|packed|care|india|kg|ml)\b", item["text"], re.I)) for item in lines)
        score = keywords * 10 + sum(item["confidence"] * len(item["text"]) for item in lines)
        if score > best_score:
            for item in lines:
                points = []
                for x, y in item["bbox"]:
                    if turns == 1:
                        x, y = width-y, x
                    elif turns == 2:
                        x, y = width-x, height-y
                    elif turns == 3:
                        x, y = y, height-x
                    points.append((x,y))
                x0, x1 = min(p[0] for p in points), max(p[0] for p in points)
                y0, y1 = min(p[1] for p in points), max(p[1] for p in points)
                item["bbox"] = [[x0,y0], [x1,y0], [x1,y1], [x0,y1]]
            best, best_score = lines, score
        if turns == 0 and keywords >= 5:
            break
    return [item["text"] for item in best], best
