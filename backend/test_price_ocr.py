"""Price extraction must preserve digits and withhold conflicting OCR."""
import unittest
import cv2
import numpy as np
from ocr import extract_text, price_values
from main import check_mrp, run_compliance_pipeline


class PriceTests(unittest.TestCase):
    def test_parse_price_suffix_and_unit_price(self):
        for text, expected in [('RS.99/-', [99]), ('Rs.997/-', [997]),
                               ('MRP: Rs. 1,299.50', [1299.5]), ('Rs. 99.50', [99.5]),
                               ('Rs.4.40 Per g', []), ('Rs.4.40 /g', []), ('99 grams', [])]:
            self.assertEqual(price_values(text), expected, text)

    def test_genuine_three_digit_price(self):
        image = np.full((160, 800, 3), 255, np.uint8)
        cv2.putText(image, 'MRP: Rs. 997/-', (30,80), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0,0,0), 2)
        lines, data = extract_text(image)
        self.assertTrue(any(d.get('price_value') == 997 for d in data), lines)
        self.assertFalse(any(d.get('price_value') == 99 for d in data))

    def test_conflicts_require_review(self):
        data = [{'bbox': [[0,0],[200,0],[200,30],[0,30]], 'price_candidates': [99,997],
                 'price_value': 99, 'price_needs_review': True,
                 'price_evidence': [{'text':'RS.997-'},{'text':'RS.99/-'}]}]
        result = check_mrp(['RS.99/-'], 'Inclusive of all taxes', data)
        self.assertEqual(result['detected_value'], '₹ 99.00')
        self.assertEqual(result['status'], 'REVIEW')
        result = run_compliance_pipeline(['RS.99/-','Net weight 500 g'], data,95,'FOOD',800,1000,[])
        self.assertEqual(result['rules']['usp']['status'], 'REVIEW')

    def test_different_photos_cannot_silently_choose_price(self):
        data = [dict(bbox=[[0,0]]*4, price_candidates=[v], price_value=v,
                     price_needs_review=False, price_evidence=[]) for v in [99,199]]
        result = check_mrp(['MRP Rs 99','MRP Rs 199'],'inclusive of all taxes', data)
        self.assertEqual(result['status'],'REVIEW')
        self.assertIsNone(result['detected_value'])

    def test_unverified_nutrition_number_is_not_mrp(self):
        result = check_mrp(['MRP','24 vitamins'],'MRP 24 vitamins',[])
        self.assertEqual(result['status'],'REVIEW')
        self.assertIsNone(result['detected_value'])

if __name__ == '__main__':
    unittest.main()
