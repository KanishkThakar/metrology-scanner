"""Run with python -m unittest test_scan_concurrency from backend/."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from main import app


class ScanConcurrencyTest(unittest.TestCase):
    def test_slow_ocr_leaves_health_responsive_and_releases_capacity(self):
        started, release = Event(), Event()
        image = (Path(__file__).parent / "presets/atta_1kg.jpg").read_bytes()

        def slow_ocr(_image):
            started.set()
            release.wait(5)
            return [], []

        with TestClient(app) as client, patch("main.extract_text", side_effect=slow_ocr), ThreadPoolExecutor(3) as pool:
            def scan():
                return client.post("/api/scan", files={"file": ("label.jpg", image, "image/jpeg")})
            pending = pool.submit(scan)
            self.assertTrue(started.wait(3))
            try:
                health = pool.submit(client.get, "/api/health").result(timeout=1)
                self.assertEqual(health.status_code, 200)
                busy = pool.submit(scan).result(timeout=1)
                self.assertEqual(busy.status_code, 429)
                self.assertIn("Another scan", busy.json()["detail"])
            finally:
                release.set()
            self.assertEqual(pending.result(timeout=3).status_code, 422)
            self.assertEqual(scan().status_code, 422)  # The slot is released on failure.


if __name__ == "__main__":
    unittest.main()
