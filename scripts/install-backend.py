"""Install both OCR engines without replacing headless OpenCV with a GUI build."""
from pathlib import Path
import subprocess
import sys
from importlib.util import find_spec

if find_spec("pip") is None:
    import ensurepip
    ensurepip.bootstrap()

root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(root / "backend/requirements.txt")], check=True)
subprocess.run([sys.executable, "-m", "pip", "install", "--no-deps", "-r", str(root / "backend/requirements-paddle.txt")], check=True)
