import sys
import re
sys.stdout.reconfigure(encoding='utf-8')
from main import check_mrp, check_net_quantity, check_consumer_care, check_date_declarations

test_text = (
    "Jr Premidm Producte in Bpt WELL IELL SREE BELL PREMIUM IDLY RAVVA Cooks WELL TAsTES GoOd "
    "CeNtric_ ALL The Products Are GIENIcALLY MANUFACTURED UNTOUCHED By HAND StrIcT QUALITY CONTROL "
    "Eai license No; 10112004000197| NUTRITiONAL FACTS Serving Per : 100 9 Energy; 355 kcal Total Fat; 0.56 g "
    "Cholesterol:_ 0.0 g Carbohydrates. 83 g Protein . 7.0 g Minerals. 1.8 g INGREDIENTS BOILED RICE "
    "StorE IN AN Airtigh CONTAINER AWAY Quallty Product trom FROM Light AND MURALI MOHANA Moisture To KEEP "
    "Manuractured Packed DNE 0610 200 The CONTENTS Fresh SRee MURALI MOHANA D: No: (Oid 1-54) savaram (QuD "
    "NET WEIGHT: kg Komarlpalem, Blccavole Mandal 555 Andhra Pradbal 5JJ J46. "
    "Max. Retail Price: RS 60.00 of all taxes) RS.0.060 per 9 consurier CARE "
    "Per GRAM Price: 001 For any 135,40 235056,878 BATCH No: 01/08/2026 ao@ To PACKED ON: 21/01/2027 "
    "Best Before: Rice GROUP BOiLeD Limited , 1-90, (Incluslve 70057 425"
)

raw_lines = test_text.split(" ")
norm_text = test_text

print("--- TESTING CHECK_MRP ---")
res_mrp = check_mrp(raw_lines, norm_text)
print("MRP status:", res_mrp["status"])
print("MRP detected:", res_mrp["detected_value"])
print("MRP error:", res_mrp["error_code"])
print("MRP explanation:", res_mrp["explanation"])
assert res_mrp["status"] == "PASS", f"Expected PASS, got {res_mrp['status']}: {res_mrp['explanation']}"
assert res_mrp["error_code"] is None

print("\n--- TESTING CHECK_NET_QUANTITY ---")
res_net = check_net_quantity(raw_lines, norm_text)
print("Net Qty status:", res_net["status"])
print("Net Qty detected:", res_net["detected_value"])
print("Net Qty error:", res_net["error_code"])
assert res_net["status"] == "PASS"

print("\n--- TESTING CHECK_CONSUMER_CARE ---")
res_care = check_consumer_care(raw_lines, norm_text)
print("Consumer Care status:", res_care["status"])
print("Consumer Care detected:", res_care["detected_value"])
assert res_care["status"] == "PASS"

print("\n--- TESTING CHECK_DATE ---")
res_date = check_date_declarations(raw_lines, norm_text)
print("Date status:", res_date["status"])
print("Date detected:", res_date["detected_value"])
assert res_date["status"] == "PASS"

print("\n>>> ALL TESTS PASSED! Case 39 correctly evaluated as PASS! <<<")
