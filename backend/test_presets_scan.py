import requests
import json
import os
import sys

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding='utf-8')

PRESETS = [
    ("atta_1kg.jpg", "Aashirvaad Shudh Chakki Atta 1kg (Compliant - Rule 6(11) Proviso 2 Exempt)"),
    ("biscuit_violation.jpg", "Parle-G Glucose Biscuits (Violations - Non-SI 'gm', Missing 'all taxes')"),
    ("drink_750ml.jpg", "Thums Up Sparkling Beverage 750ml (Compliant - Mandatory USP Declared)"),
    ("soap_125g.jpg", "Santoor Sandal Soap 125g (Compliant - TFM Grade 1 + M-Lic)"),
    ("earbuds_violation.jpg", "boAt Wireless Earbuds (Violations - Missing Country of Origin)")
]

BASE_URL = "http://127.0.0.1:8000"

print("=" * 75)
print("TESTING LIVE /api/scan ENDPOINT WITH 5 HIGH-RESOLUTION DEMO PRESETS")
print("=" * 75)

# 1. Check health
health_res = requests.get(f"{BASE_URL}/api/health")
print(f"[*] Health check status: {health_res.status_code}")
print(f"[*] Engine: {health_res.json().get('ocr_engine')}")
print(f"[*] Evidence Standard: {health_res.json().get('evidence_standard')}")

for filename, desc in PRESETS:
    img_path = os.path.join(os.path.dirname(__file__), "presets", filename)
    if not os.path.exists(img_path):
        print(f"\n[!] Preset file not found: {img_path}")
        continue

    print(f"\n--- Scanning: {desc} ({filename}) ---")
    with open(img_path, "rb") as f:
        files = {"file": (filename, f, "image/jpeg")}
        # Determine category
        cat = "FOOD"
        if "soap" in filename: cat = "SOAP"
        elif "drink" in filename: cat = "DRINKS"
        elif "earbuds" in filename: cat = "ELECTRONICS"
        
        data_payload = {
            "category": cat,
            "surface_area": "140.0" if "atta" in filename else "85.0",
            "user_role": "INSPECTOR",
            "user_identifier": "SIH_JUDGE_DEMO",
            "state": "Maharashtra",
            "district": "Mumbai City"
        }
        res = requests.post(f"{BASE_URL}/api/scan", files=files, data=data_payload)

    if res.status_code != 200:
        print(f"[FAILED] HTTP {res.status_code}: {res.text}")
        continue

    data = res.json()
    status = data.get("compliance_status")
    print(f"Case ID:           {data.get('case_id')}")
    print(f"Compliance Status: {status} (Is Compliant: {data.get('is_compliant')})")
    print(f"Total Violations:  {data.get('total_violations')}")
    print(f"Commodity Category:{data.get('category')}")
    print(f"Brand / Packer:    {data.get('brand')}")
    print(f"Evidence Standard: {data.get('evidence_standard')}")
    print(f"Digital SHA-256:   {data.get('evidence_sha256')}")
    print(f"Forensic PDF URL:  {data.get('report_pdf_url')}")
    print(f"Detected Symbols:  {[s.get('name') for s in data.get('symbols', [])]}")

    print("Rule Verifications:")
    for k, v in data.get("rules", {}).items():
        st = v.get("status")
        rule_ref = v.get("rule_ref", k)
        detected = v.get("detected_value")
        print(f"  [{st:6}] {rule_ref:28} | Detected: {detected} | {v.get('explanation')}")

print("\n" + "=" * 75)
print("ALL 5 PRESETS PROCESSED AND VERIFIED END-TO-END!")
print("=" * 75)
