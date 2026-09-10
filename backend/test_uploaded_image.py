import cv2
import easyocr
import os
import re
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

# Import pipeline functions from main
import main

img_path = r'C:/Users/DELL/.gemini/antigravity/brain/8d5a4dc9-3a33-4512-b625-4b3e317d6ac6/.user_uploaded/media_1788703216192.jpg'
print("Image path:", img_path)
print("File exists:", os.path.exists(img_path))

img = cv2.imread(img_path)
h, w = img.shape[:2]
print(f"Original dimensions: {w}x{h}")

# Test EasyOCR at 270 deg (90 CCW)
rot_img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
rh, rw = rot_img.shape[:2]

reader = easyocr.Reader(['en'], gpu=False)
res = reader.readtext(rot_img)

raw_lines = []
ocr_data = []
for (bbox, t, c) in res:
    t_str = str(t).strip()
    if t_str and float(c) > 0.15:
        raw_lines.append(t_str)
        ocr_data.append({
            "text": t_str,
            "confidence": float(c),
            "bbox": [[int(p[0]), int(p[1])] for p in bbox]
        })

print(f"\nExtracted {len(raw_lines)} tokens from rotated image:")
for l in raw_lines:
    print("  ->", l)

# Run symbols detection
symbols = main.detect_symbols(rot_img, " ".join(raw_lines))
print("\nDetected symbols:", symbols)

# Run compliance pipeline
pipeline_res = main.run_compliance_pipeline(
    raw_lines, ocr_data, 100.0, "SOAP", rw, rh, symbols
)

print("\n" + "=" * 60)
print(f"OVERALL STATUS: {pipeline_res['compliance_status']} (Compliant: {pipeline_res['is_compliant']})")
print(f"TOTAL VIOLATIONS: {pipeline_res['total_violations']}")
print("=" * 60)

for k, v in pipeline_res["rules"].items():
    st = v.get("status")
    print(f"[{st:6}] {v.get('rule_ref', k):25} | Detected: {v.get('detected_value')}")
    if st == "FAIL":
        print(f"         Violation Explanation: {v.get('explanation')}")
