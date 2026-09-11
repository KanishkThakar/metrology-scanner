"""Start the private API bundle in Render's official Python image.

This API-only deployment is used when Render cannot clone the private repository.
Only application source is uploaded; scan databases, uploads and credentials are
excluded. The pinned public OCR model is fetched separately and hash checked.
"""
import base64
import hashlib
import io
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import urllib.request

MODEL_URL = "https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/e12c65a915945e4c28e237a9b52bc4a8f39a0cec/eng.traineddata"
MODEL_SHA256 = "8280aed0782fe27257a68ea10fe7ef324ca0f8d85bd2fd145d1c2b560bcb66ba"


def unpack_bundle(secret_dir, destination, expected_hash):
    archive = base64.b64decode((secret_dir / "metrology-source.b64").read_bytes(), validate=True)
    if hashlib.sha256(archive).hexdigest() != expected_hash:
        raise RuntimeError("Backend source checksum mismatch")
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as tar:
        for member in tar.getmembers():
            path = Path(member.name)
            if not member.isfile() or path.is_absolute() or ".." in path.parts or path.parts[0] not in {"backend", "FRONTEND"}:
                raise RuntimeError("Invalid backend source archive member")
        tar.extractall(destination, filter="data")
    # Both frontends use the exact same committed preset images.
    shutil.copytree(destination / "backend/presets", destination / "FRONTEND/presets", dirs_exist_ok=True)


def main():
    app_dir = Path("/app")
    print("[setup] Verifying private backend source", flush=True)
    unpack_bundle(Path("/etc/secrets"), app_dir, os.environ["METROLOGY_BUNDLE_SHA256"])
    print("[setup] Installing native Tesseract", flush=True)
    subprocess.run(["apt-get", "-qq", "update"], check=True)
    subprocess.run(["apt-get", "-qq", "install", "-y", "--no-install-recommends", "tesseract-ocr", "tesseract-ocr-eng", "libglib2.0-0"], check=True)
    shutil.rmtree("/var/lib/apt/lists", ignore_errors=True)
    print("[setup] Installing pinned Python dependencies", flush=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--no-cache-dir", "--only-binary=:all:", "-r", str(app_dir / "backend/requirements-render.lock")], check=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--no-cache-dir", "--no-deps", "--only-binary=:all:", "-r", str(app_dir / "backend/requirements-paddle.txt")], check=True)
    print("[setup] Verifying the OCR price-reading model", flush=True)
    model = app_dir / "backend/tessdata/eng.traineddata"
    model.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(MODEL_URL, timeout=120) as response:
        model_bytes = response.read()
    if hashlib.sha256(model_bytes).hexdigest() != MODEL_SHA256:
        raise RuntimeError("OCR model checksum mismatch")
    model.write_bytes(model_bytes)
    print("[setup] Starting FastAPI", flush=True)
    os.chdir(app_dir / "backend")
    os.execv(sys.executable, [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", os.environ.get("PORT", "10000")])


if __name__ == "__main__":
    main()
