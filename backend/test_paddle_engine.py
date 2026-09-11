"""Real model regression checks for selectable OCR and independent cached evidence."""
import unittest
import cv2
import numpy as np
from fastapi.testclient import TestClient
from main import app, check_mrp
from paddle_engine import extract_paddle
from ocr_cache import cached_ocr, clear_ocr_cache


class PaddleEngineTests(unittest.TestCase):
    def test_rotated_real_three_digit_price_is_preserved(self):
        image = np.full((190, 850, 3), 255, np.uint8)
        cv2.putText(image, 'MRP: Rs. 997/-', (30, 85), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 2)
        cv2.putText(image, 'Net Weight 1 kg', (30, 145), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 2)
        for turns in range(4):
            rotated = np.ascontiguousarray(np.rot90(image, turns))
            for hybrid in [False, True]:
                with self.subTest(turns=turns, hybrid=hybrid):
                    text, data = extract_paddle(rotated, hybrid)
                    mrp = check_mrp(text, 'inclusive of all taxes', data)
                    self.assertEqual(mrp['detected_value'], '₹ 997.00')
                    for item in data:
                        (x, y), _, (xx, yy), _ = item['bbox']
                        self.assertTrue(0 <= x < xx <= rotated.shape[1])
                        self.assertTrue(0 <= y < yy <= rotated.shape[0])
                    if hybrid:
                        evidence = next(d['price_evidence'] for d in data if 'price_evidence' in d)
                        self.assertEqual(evidence[0]['method'], 'paddleocr')
                        self.assertTrue(any(r['method'] == 'best_binary' for r in evidence))

    def test_blank_photo(self):
        self.assertEqual(extract_paddle(np.full((150, 450, 3), 255, np.uint8)), ([], []))

    def test_cache_does_not_mix_modes_or_mutated_coordinates(self):
        clear_ocr_cache()
        image = np.zeros((40, 40, 3), np.uint8)
        calls = []
        def compute():
            calls.append(1)
            return ['example'], [{'bbox': [[2, 3], [20, 3], [20, 30], [2, 30]]}]
        first = cached_ocr(image, 'test-mode-one', compute)
        first[1][0]['bbox'][0][1] += 500
        second = cached_ocr(image, 'test-mode-one', compute)
        self.assertEqual(second[1][0]['bbox'][0][1], 3)
        self.assertEqual(len(calls), 1)
        cached_ocr(image, 'test-mode-two', compute)
        self.assertEqual(len(calls), 2)

    def test_unknown_engine_rejected(self):
        with TestClient(app) as client:
            response = client.post('/api/scan', data={'ocr_engine': 'unknown'})
            self.assertEqual(response.status_code, 422)


if __name__ == '__main__':
    unittest.main()
