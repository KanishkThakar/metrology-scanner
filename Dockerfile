FROM python:3.10-slim

RUN useradd -m -u 1000 user
ENV HOME=/home/user     PATH=/home/user/.local/bin:     PYTHONUNBUFFERED=1

WORKDIR /home/user/app

RUN apt-get update && apt-get install -y --no-install-recommends     build-essential     tesseract-ocr     tesseract-ocr-eng     libgl1     libglib2.0-0     libsm6     libxext6     && rm -rf /var/lib/apt/lists/*

COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip &&     pip install --no-cache-dir -r requirements.txt

COPY --chown=user:user . .

RUN chmod -R 777 /home/user/app

USER user

EXPOSE 7860

CMD ["streamlit", "run", "app.py", "--server.port=7860", "--server.address=0.0.0.0"]
