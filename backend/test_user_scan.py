import sys
import urllib.request
import json

sys.stdout.reconfigure(encoding='utf-8')

img_path = "uploads/7ba3a8cb-bc15-42f0-b922-65ceb16acf25.jpeg"
with open(img_path, "rb") as f:
    img_bytes = f.read()

def test_scan_with_area(area_val):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        b"--" + boundary.encode() + b"\r\n"
        b'Content-Disposition: form-data; name="file"; filename="test.jpg"\r\n'
        b"Content-Type: image/jpeg\r\n\r\n"
        + img_bytes + b"\r\n"
        b"--" + boundary.encode() + b"\r\n"
        b'Content-Disposition: form-data; name="surface_area"\r\n\r\n'
        + str(area_val).encode() + b"\r\n"
        b"--" + boundary.encode() + b"\r\n"
        b'Content-Disposition: form-data; name="category"\r\n\r\n'
        b"FOOD\r\n"
        b"--" + boundary.encode() + b"--\r\n"
    )

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/scan",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print(f"\n=== SCAN RESULT WITH AREA = {area_val} cm² ===")
        print(f"Overall Status: {res.get('compliance_status')}")
        print(f"Total Violations: {res.get('total_violations')}")
        print(f"MRP Status: {res['rules']['mrp']['status']} ({res['rules']['mrp']['detected_value']})")
        print(f"Net Qty Status: {res['rules']['net_qty']['status']} ({res['rules']['net_qty']['detected_value']})")
        print(f"Font Compliance: {res['rules']['font_compliance']['status']} | {res['rules']['font_compliance']['detected_value']}")
        print(f"Font Explanation: {res['rules']['font_compliance']['explanation']}")

print("--- Testing Area = 95.0 cm² (New Interface Default) ---")
test_scan_with_area(95.0)

print("\n--- Testing Area = 120.0 cm² (Borderline Measurement Tier) ---")
test_scan_with_area(120.0)
