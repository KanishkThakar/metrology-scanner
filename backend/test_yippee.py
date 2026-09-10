import sys
import re
import cv2
import easyocr
sys.stdout.reconfigure(encoding='utf-8')

from main import run_compliance_pipeline, detect_symbols

img_path = r"C:\Users\DELL\.gemini\antigravity\brain\8d5a4dc9-3a33-4512-b625-4b3e317d6ac6\.user_uploaded\media_1788713609195.jpg"
img = cv2.imread(img_path)
h, w, _ = img.shape

reader = easyocr.Reader(['en'], gpu=False)
res = reader.readtext(img)

raw_lines = [str(t).strip() for (_, t, c) in res if str(t).strip() and float(c) > 0.15]
ocr_data = [{"text": str(t).strip(), "confidence": float(c), "bbox": [[int(p[0]), int(p[1])] for p in bbox]} for (bbox, t, c) in res if str(t).strip()]

full_text = " ".join(raw_lines)
print("=== FULL EXTRACTED TEXT ===")
print(full_text)

detected_symbols = detect_symbols(img, full_text)
print("\n=== DETECTED SYMBOLS ===")
for s in detected_symbols:
    print(f"- {s['name']} ({s['type']})")

pipeline_res = run_compliance_pipeline(
    raw_lines=raw_lines,
    ocr_data=ocr_data,
    area=95.0,
    category="FOOD",
    orig_w=w,
    orig_h=h,
    detected_symbols=detected_symbols
)

print("\n=== PIPELINE RESULTS ===")
for k, v in pipeline_res["rules"].items():
    print(f"[{v['status']}] {k}: {v.get('detected_value')} | Error: {v.get('error_code')}")
    if v.get('explanation'):
        print(f"    Explanation: {v['explanation']}")

print("\nOverall Status:", pipeline_res["compliance_status"])
print("Total Violations:", pipeline_res["total_violations"])
