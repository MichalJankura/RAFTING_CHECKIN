FROM python:3.11-slim

# System libs required by EasyOCR / OpenCV headless
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libgomp1 libglib2.0-0 libsm6 libxext6 libxrender-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Step 1: CPU-only PyTorch + torchvision ────────────────────────────────────
# MUST be installed before easyocr so that pip never pulls the CUDA build as a
# transitive dependency.  Both packages must come from the same CPU wheel index.
RUN pip install --no-cache-dir \
    torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# ── Step 2: EasyOCR and helpers ───────────────────────────────────────────────
# torch/torchvision are already present, so pip will not reinstall them.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Step 3: Pre-download language models ──────────────────────────────────────
# Models are baked into this image layer so the container starts in ~30 s
# instead of downloading them every time.
RUN python -c "\
import easyocr; \
easyocr.Reader(['sk','cs','en','hu','de','pl'], gpu=False, verbose=False)"

COPY app.py .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "120", "app:app"]
