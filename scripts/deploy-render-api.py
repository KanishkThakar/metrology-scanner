"""Deploy the committed backend privately to Render's free plan via its API.

Requires the local Render CLI login (or RENDER_API_KEY), httpx and PyYAML.
Does not grant GitHub permissions, publish source, or create paid resources.
Use --prepare-only to validate and save a deployment bundle without deploying.
"""
import argparse
import base64
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile

import httpx
import yaml

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "docker.io/library/python@sha256:d1053354624536b044162aaab1e418bd000ea35184fb1ae098ab3166b1072e72"
NAME = "metrology-scanner-api"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def build_bundle():
    files = git("ls-tree", "-r", "--name-only", "HEAD", "backend", "FRONTEND").decode().splitlines()
    contents = {name: git("show", "HEAD:" + name) for name in files if not name.endswith(".traineddata")}
    for name in list(contents):
        if name.startswith("FRONTEND/presets/"):
            if contents[name] != contents.get(name.replace("FRONTEND/", "backend/", 1)):
                raise RuntimeError("Frontend preset differs from backend preset")
            del contents[name]
    for name in contents:
        if any(part in {"uploads", "reports", "models", ".env"} for part in Path(name).parts) or ".db" in name:
            raise RuntimeError("Refusing to upload local runtime data: " + name)
    if "backend/requirements-render.lock" not in contents:
        raise RuntimeError("Commit requirements-render.lock before deployment")
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w") as tar:
        for name, content in sorted(contents.items()):
            info = tarfile.TarInfo(name); info.size = len(content); info.mode = 0o644
            tar.addfile(info, io.BytesIO(content))
    archive = gzip.compress(output.getvalue(), mtime=0)
    return archive, git("rev-parse", "HEAD").decode().strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    config = yaml.safe_load((Path.home() / ".render/cli.yaml").read_text())
    owner = config["workspace"]
    archive, commit = build_bundle()
    source = base64.b64encode(archive).decode()
    bootstrap = git("show", "HEAD:scripts/render-runtime-bootstrap.py").decode()
    if len(source) + len(bootstrap.encode()) > 1_000_000:
        raise RuntimeError("Source exceeds Render's combined 1 MB secret-file limit")
    checksum = hashlib.sha256(archive).hexdigest()
    env = {"METROLOGY_DATA_DIR": "/data", "TESSERACT_LANG": "eng", "OMP_THREAD_LIMIT": "1", "OPENBLAS_NUM_THREADS": "1", "PYTHONUNBUFFERED": "1", "METROLOGY_BUNDLE_SHA256": checksum, "METROLOGY_SOURCE_COMMIT": commit}
    secrets = [{"name": "metrology-source.b64", "content": source}, {"name": "metrology-bootstrap.py", "content": bootstrap}]
    payload = {"type": "web_service", "name": NAME, "ownerId": owner, "autoDeploy": "no", "image": {"imagePath": IMAGE, "ownerId": owner}, "envVars": [{"key": key, "value": value} for key, value in env.items()], "secretFiles": secrets, "serviceDetails": {"runtime": "docker", "plan": "free", "region": "singapore", "healthCheckPath": "/api/health", "numInstances": 1, "envSpecificDetails": {"dockerCommand": "python /etc/secrets/metrology-bootstrap.py"}}}
    work = ROOT / "work"; work.mkdir(exist_ok=True)
    (work / "render-source.tar.gz").write_bytes(archive)
    print(json.dumps({"commit": commit, "archive_sha256": checksum, "secret_bytes": len(source) + len(bootstrap.encode()), "plan": "free"}), flush=True)
    if args.prepare_only:
        return
    key = os.environ.get("RENDER_API_KEY") or config["api"]["key"]
    with httpx.Client(base_url="https://api.render.com/v1", headers={"Authorization": "Bearer " + key}, timeout=90) as client:
        existing = client.get("/services", params={"ownerId": owner, "name": NAME, "limit": 100})
        existing.raise_for_status()
        services = [x["service"] for x in existing.json() if x["service"]["name"] == NAME]
        if services:
            service = services[0]
            if service["serviceDetails"]["plan"] != "free" or service.get("repo"):
                raise RuntimeError("Existing service is not this free image deployment; inspect before updating")
            service_id = service["id"]
            for secret in secrets:
                client.put(f"/services/{service_id}/secret-files/{secret['name']}", json={"content": secret["content"]}).raise_for_status()
            for name, value in env.items():
                client.put(f"/services/{service_id}/env-vars/{name}", json={"value": value}).raise_for_status()
            response = client.post(f"/services/{service_id}/deploys", json={})
            response.raise_for_status()
            deploy_id = response.json()["id"]
        else:
            response = client.post("/services", json=payload)
            if response.status_code != 201:
                print("Render creation failed:", response.status_code, response.text[:1600])
                raise SystemExit(1)
            data = response.json(); service = data["service"]; deploy_id = data.get("deployId")
        result = {"service_id": service["id"], "url": service["serviceDetails"]["url"], "deploy_id": deploy_id, "commit": commit, "plan": "free", "source_sha256": checksum, "image": IMAGE}
        (work / "render-api-deployment.json").write_text(json.dumps(result, indent=2) + "\n")
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
