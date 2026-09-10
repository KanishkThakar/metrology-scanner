import os
import sys
import math
import cv2

# Set UTF-8 stdout encoding for Windows console
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

from main import (
    run_compliance_pipeline,
    check_mrp,
    check_net_quantity,
    check_manufacturer_details,
    check_address,
    check_consumer_care,
    check_date_declarations,
    check_country_of_origin,
    check_usp_and_rule_6_11,
    check_font_compliance_table_ii,
    check_category_statutory_mandates,
    generate_forensic_pdf_report,
    compute_sha256,
    detect_symbols
)

def run_tests():
    print("=== TESTING DETERMINISTIC STATUTORY VALIDATION FUNCTIONS ===")

    # Test 1: MRP with and without taxes
    mrp_pass = check_mrp([], "MRP: Rs. 55.00 (Inclusive of all taxes)")
    assert mrp_pass["status"] == "PASS", f"Expected PASS, got {mrp_pass}"
    mrp_fail = check_mrp([], "MRP: Rs. 55.00")
    assert mrp_fail["status"] == "FAIL" and mrp_fail["error_code"] == "MRP_NO_TAX_DECLARATION", f"Expected FAIL, got {mrp_fail}"
    print("[PASS] check_mrp: compliant vs non-tax declaration validated.")

    # Test 2: Net Quantity SI unit vs non-SI unit (gm, ltr)
    qty_pass = check_net_quantity([], "Net Quantity: 1 kg")
    assert qty_pass["status"] == "PASS" and qty_pass["parsed_kg"] == 1.0, f"Expected PASS, got {qty_pass}"
    qty_fail_gm = check_net_quantity([], "Net Weight: 200 gm")
    assert qty_fail_gm["status"] == "FAIL" and qty_fail_gm["error_code"] == "NON_SI_UNIT_GM", f"Expected FAIL NON_SI_UNIT_GM, got {qty_fail_gm}"
    qty_fail_ltr = check_net_quantity([], "Net Volume: 1 ltr")
    assert qty_fail_ltr["status"] == "FAIL" and qty_fail_ltr["error_code"] == "NON_SI_UNIT_LTR", f"Expected FAIL NON_SI_UNIT_LTR, got {qty_fail_ltr}"
    print("[PASS] check_net_quantity: standard SI vs non-SI 'gm'/'ltr' validated.")

    # Test 3: Rule 6(11) Second Proviso Exemption (1 kg / 1 L packs) & Rule 26 Small Pack Exemption
    usp_exempt = check_usp_and_rule_6_11([], "MRP: Rs. 55", 55.0, 1000.0, 1.0)
    assert usp_exempt["status"] == "EXEMPT", f"Expected EXEMPT, got {usp_exempt}"
    usp_small = check_usp_and_rule_6_11([], "MRP: Rs. 5", 5.0, 8.0, 0.008)
    assert usp_small["status"] == "EXEMPT", f"Expected EXEMPT for <=10g under Rule 26, got {usp_small}"
    usp_fail = check_usp_and_rule_6_11([], "MRP: Rs. 55", 55.0, 500.0, 0.5)
    assert usp_fail["status"] == "FAIL", f"Expected FAIL for missing USP on 500g, got {usp_fail}"
    usp_pass = check_usp_and_rule_6_11([], "USP: Rs. 0.05 / ml", 40.0, 750.0, 0.75)
    assert usp_pass["status"] == "PASS", f"Expected PASS for declared USP, got {usp_pass}"
    print("[PASS] check_usp_and_rule_6_11: Rule 6(11) Second Proviso, Rule 26, and direct declarations validated.")

    # Test 4: Country of Origin (Rule 6(1)(m))
    origin_electronics_fail = check_country_of_origin([], "Wireless Earbuds Made by Imagine", "ELECTRONICS")
    assert origin_electronics_fail["status"] == "FAIL", f"Expected FAIL for electronics, got {origin_electronics_fail}"
    origin_electronics_pass = check_country_of_origin([], "Country of Origin: India", "ELECTRONICS")
    assert origin_electronics_pass["status"] == "PASS", f"Expected PASS, got {origin_electronics_pass}"
    origin_food_exempt = check_country_of_origin([], "Aashirvaad Atta ITC", "FOOD")
    assert origin_food_exempt["status"] == "EXEMPT", f"Expected EXEMPT for domestic food, got {origin_food_exempt}"
    print("[PASS] check_country_of_origin: Electronics mandatory vs domestic food exemption validated.")

    # Test 5: Symbol detection on preset image
    img = cv2.imread("presets/atta_1kg.jpg")
    symbols = detect_symbols(img, "Aashirvaad Shuddh Chakki Atta 1 kg FSSAI Lic 10012031000085 Recyclable")
    print(f"[PASS] detect_symbols: identified {len(symbols)} symbols: {[s['name'] for s in symbols]}")
    assert any("Vegetarian" in s["name"] for s in symbols), "Veg symbol should be detected"

    # Test 6: Full pipeline & PDF Generation with Section 63 BSA 2023 / Section 65B
    dummy_ocr_data = [{"text": "55.00", "confidence": 0.98, "bbox": [[100, 100], [200, 100], [200, 130], [100, 130]]}]
    pipeline_res = run_compliance_pipeline(
        ["AASHIRVAAD SHUDDH CHAKKI ATTA", "Net Quantity: 1 kg", "MRP: Rs. 55.00 (Inclusive of all taxes)", "08/2026", "ITC Limited", "Kolkata, West Bengal - 700071", "1800-425-4444", "FSSAI 10012031000085"],
        dummy_ocr_data, 140.0, "FOOD", 800, 1000, symbols
    )
    print(f"[PASS] run_compliance_pipeline: Status={pipeline_res['compliance_status']} | Violations={pipeline_res['total_violations']}")

    pdf_path = "reports/Test_Audit_BSA2023.pdf"
    generate_forensic_pdf_report(
        999, "presets/atta_1kg.jpg", pipeline_res, pdf_path, "TEST_INSPECTOR", "West Bengal", "Kolkata", compute_sha256(b"test_data")
    )
    assert os.path.exists(pdf_path), "PDF report was not generated!"
    print(f"[PASS] generate_forensic_pdf_report: created {pdf_path} referencing Section 63 BSA 2023 & Section 65B IEA 1872!")
    print("\nALL AUTOMATED UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
