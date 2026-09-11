"""PaddleOCR mobile models on CPU, with optional Tesseract price verification."""
from importlib.util import find_spec
from threading import RLock
import cv2
import numpy as np

from ocr import _refine_prices, price_values
from ocr_cache import cached_ocr

PADDLE_MODEL = "PaddleOCR PP-OCRv4 mobile (ONNX Runtime CPU)"
PADDLE_AVAILABLE = find_spec("rapidocr_onnxruntime") is not None
_engine = None
_engine_lock = RLock()


def init_paddle_engine():
    global _engine
    with _engine_lock:
        if _engine is None:
            from rapidocr_onnxruntime import RapidOCR
            from rapidocr_onnxruntime.ch_ppocr_det.utils import DetPreProcess
            # Bundled, pinned models: no model download during a scan.
            _engine = RapidOCR(
                det_limit_side_len=960, det_limit_type="max", rec_batch_num=1,
                intra_op_num_threads=1, inter_op_num_threads=1,
            )
            # RapidOCR 1.4 otherwise raises max-mode detection to 2000 px.
            # Bound only detection; recognition crops keep the original pixels.
            detector = _engine.text_det
            detector.get_preprocess = lambda _max_wh: DetPreProcess(
                960, "max", detector.mean, detector.std
            )
    return _engine


def _read_paddle(image):
    with _engine_lock:
        result, _ = init_paddle_engine()(image)
    height, width = image.shape[:2]
    lines = []
    for quad, text, confidence in result or []:
        points = np.asarray(quad, dtype=np.float32)
        x0, y0 = np.floor(points.min(axis=0)).astype(int)
        x1, y1 = np.ceil(points.max(axis=0)).astype(int)
        x0, x1 = max(0, x0), min(width, x1)
        y0, y1 = max(0, y0), min(height, y1)
        if x1 <= x0 or y1 <= y0 or not text.strip():
            continue
        line = {"text": text.strip(), "confidence": float(confidence), "source": "paddleocr",
                "bbox": [[int(x0), int(y0)], [int(x1), int(y0)], [int(x1), int(y1)], [int(x0), int(y1)]],
                "source_quad": points.tolist()}
        values = sorted(set(price_values(line["text"])))
        if values:
            line.update(price_candidates=values, price_value=values[0] if len(values) == 1 else None,
                        price_needs_review=True,
                        price_evidence=[{"text": line["text"], "confidence": float(confidence), "method": "paddleocr"}])
        lines.append(line)
    return [line["text"] for line in lines], lines


def _verify_prices(image, lines):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    for line in lines:
        if not price_values(line["text"]):
            continue
        points = np.asarray(line["source_quad"], dtype=np.float32)
        width = max(1, round(max(np.linalg.norm(points[0]-points[1]), np.linalg.norm(points[2]-points[3]))))
        height = max(1, round(max(np.linalg.norm(points[0]-points[3]), np.linalg.norm(points[1]-points[2]))))
        target = np.float32([[0, 0], [width, 0], [width, height], [0, height]])
        crop = cv2.warpPerspective(gray, cv2.getPerspectiveTransform(points, target), (width, height),
                                   flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        if crop.shape[0] > crop.shape[1] * 1.5:
            crop = np.ascontiguousarray(np.rot90(crop))
        h, w = crop.shape
        pad = max(5, round(h*.3))
        crop = cv2.copyMakeBorder(crop, pad, pad, pad, pad, cv2.BORDER_REPLICATE)
        candidate = {"text": line["text"], "confidence": line["confidence"],
                     "bbox": [[pad, pad], [pad+w, pad], [pad+w, pad+h], [pad, pad+h]]}
        refined = _refine_prices(crop, [candidate])[0]
        if refined.get("price_value") is None and not any(
            price_values(reading["text"]) for reading in refined["price_evidence"][1:]
        ):
            # The line classifier can read upside-down crops; verify that angle too.
            candidate = {"text": line["text"], "confidence": line["confidence"],
                         "bbox": [[pad, pad], [pad+w, pad], [pad+w, pad+h], [pad, pad+h]]}
            retry = _refine_prices(np.ascontiguousarray(np.rot90(crop, 2)), [candidate])[0]
            if retry.get("price_value") is not None:
                retry["price_evidence"].extend(refined["price_evidence"][1:])
                refined = retry
        refined["price_evidence"][0]["method"] = "paddleocr"
        winner = refined.get("price_value")
        # A strong Paddle reading alone must not certify a weak Tesseract result.
        refined["price_needs_review"] |= not any(
            reading["confidence"] >= .75 and price_values(reading["text"]) == [winner]
            for reading in refined["price_evidence"][1:]
        )
        # Keep coordinates tied to the original photo, not the verification crop.
        line.update({key: value for key, value in refined.items() if key != "bbox"})
    return [line["text"] for line in lines], lines


def extract_paddle(image, verify_prices=False):
    image = np.ascontiguousarray(image)
    def compute():
        texts, lines = cached_ocr(image, "paddle-v4-mobile-960-v1", lambda: _read_paddle(image))
        return _verify_prices(image, lines) if verify_prices else (texts, lines)
    return cached_ocr(image, ("paddle-hybrid-v1", verify_prices), compute)
