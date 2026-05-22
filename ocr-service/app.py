"""
EasyOCR microservice for RAFTING DUNAJEC ID scanning.

Images are processed in memory and never written to disk.
Accepts base64-encoded JPEG/PNG, returns list of detected text blocks.
"""

import base64
import io
import logging
import os

import easyocr
import numpy as np
from flask import Flask, jsonify, request
from PIL import Image

app = Flask(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Languages common on Central European IDs and passports.
LANGUAGES = ["sk", "cs", "en", "hu", "de", "pl"]

logger.info("Initializing EasyOCR reader (models load once on first start)…")
reader = easyocr.Reader(LANGUAGES, gpu=False, verbose=False)
logger.info("EasyOCR ready.")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/ocr", methods=["POST"])
def ocr():
    data = request.get_json(force=True, silent=True)
    if not data or "image" not in data:
        return jsonify({"error": "Missing 'image' field (base64 encoded)"}), 400

    try:
        raw = data["image"]
        # Strip data URI prefix if present (data:image/jpeg;base64,...)
        if "," in raw:
            raw = raw.split(",", 1)[1]

        image_bytes = base64.b64decode(raw)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_array = np.array(image)

        results = reader.readtext(img_array, detail=1, paragraph=False)

        texts = [
            {"text": r[1], "confidence": round(float(r[2]), 3)}
            for r in results
        ]

        return jsonify({"results": texts})

    except Exception as exc:
        logger.error("OCR error: %s", exc, exc_info=True)
        return jsonify({"error": "OCR processing failed"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
