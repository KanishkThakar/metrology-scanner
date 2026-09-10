"""Real engine checks: rotated recognition, coordinates, and unreadable input."""
import unittest
import cv2
import numpy as np
from ocr import extract_text, init_ocr_engine


class TesseractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_ocr_engine()

    def test_rotated_label_and_boxes(self):
        original = np.full((180, 800, 3), 255, dtype=np.uint8)
        cv2.putText(original, 'MRP Rs 100 Net Weight 1 kg', (30, 90),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 2)
        for turns in range(4):
            image = np.ascontiguousarray(np.rot90(original, turns))
            lines, detections = extract_text(image)
            self.assertIn('100', ' '.join(lines))
            for detection in detections:
                (x0,y0), _, (x1,y1), _ = detection['bbox']
                self.assertTrue(0 <= x0 < x1 <= image.shape[1])
                self.assertTrue(0 <= y0 < y1 <= image.shape[0])
                self.assertLess(image[y0:y1,x0:x1].min(), 128)
                self.assertTrue(0 <= detection['confidence'] <= 1)

    def test_blank(self):
        self.assertEqual(extract_text(np.full((100, 300, 3), 255, dtype=np.uint8)), ([], []))


if __name__ == '__main__':
    unittest.main()
