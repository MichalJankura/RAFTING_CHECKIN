// RAFTING DUNAJEC — ID scan modal
// Supports: mobile camera with ID-frame overlay, desktop file upload / scanner drop-zone.
// The captured image is resized/compressed in-browser, sent to /api/ocr/scan-id,
// and discarded immediately — it is never stored locally or server-side.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Icon } from './icons.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isMobileDevice() {
  return (
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1024)
  );
}

function hasCameraAPI() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Resize + JPEG-compress a data URL to keep the payload under ~4 MB.
function compressImage(dataUrl, maxW = 1920, maxH = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Sample pixel variance in the ID-card overlay region to infer card presence.
// Returns a 0-1 score; > 0.18 means a document is likely in frame.
function measureCardPresence(video, overlayFrac = 0.72) {
  try {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return 0;

    const ow = Math.round(vw * overlayFrac);
    const oh = Math.round(ow / 1.586);  // ID card ratio (85.6 × 53.98 mm)
    const ox = Math.round((vw - ow) / 2);
    const oy = Math.round((vh - oh) / 2);

    const cv = document.createElement('canvas');
    cv.width  = ow;
    cv.height = oh;
    cv.getContext('2d').drawImage(video, ox, oy, ow, oh, 0, 0, ow, oh);
    const px = cv.getContext('2d').getImageData(0, 0, ow, oh).data;

    let sum = 0, sumSq = 0, count = 0;
    const stride = Math.max(4, Math.floor(px.length / (4 * 2000))) * 4;
    for (let i = 0; i < px.length; i += stride) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      sum   += lum;
      sumSq += lum * lum;
      count++;
    }
    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    return Math.min(1, Math.sqrt(variance) / 80);
  } catch { return 0; }
}

// ── Component ─────────────────────────────────────────────────────────────────

function ScanIdModal({ lang, onApply, onClose }) {
  const canCamera = hasCameraAPI();
  const [mode, setMode]               = useState(() => (isMobileDevice() && canCamera) ? 'camera' : 'upload');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState(null);
  const [cardDetected, setCardDetected] = useState(false);
  const [scanning, setScanning]         = useState(false);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState(null);
  const [previewSrc, setPreviewSrc]     = useState(null);
  const [dragOver, setDragOver]         = useState(false);

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const detectorRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Camera control ──────────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (detectorRef.current) {
      clearInterval(detectorRef.current);
      detectorRef.current = null;
    }
    setCameraActive(false);
    setCardDetected(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCardDetected(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setCameraActive(true);
      }
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? (lang === 'sk' ? 'Prístup ku kamere bol zamietnutý. Povoľte ho v nastaveniach prehliadača.' : 'Camera access denied. Enable it in browser settings.')
        : err.name === 'NotFoundError'
          ? (lang === 'sk' ? 'Žiadna kamera nebola nájdená.' : 'No camera found on this device.')
          : (lang === 'sk'
              ? 'Kamera nie je dostupná. Pre snímanie na mobile vyžaduje HTTPS. Skúste režim nahratia súboru.'
              : 'Camera unavailable. Mobile camera requires HTTPS. Use file upload instead.');
      setCameraError(msg);
    }
  }, [lang]);

  // Card-presence detection loop
  useEffect(() => {
    if (!cameraActive || !videoRef.current) return;
    detectorRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      setCardDetected(measureCardPresence(video) > 0.18);
    }, 500);
    return () => { if (detectorRef.current) clearInterval(detectorRef.current); };
  }, [cameraActive]);

  // Start/stop camera when mode changes
  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode]); // intentionally omitting startCamera/stopCamera to avoid restart loops

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), []); // eslint-disable-line

  // ── Image processing ────────────────────────────────────────────────────────

  const processImage = useCallback(async (dataUrl) => {
    setScanning(true);
    setError(null);
    setResult(null);
    setPreviewSrc(null);

    let compressed;
    try {
      compressed = await compressImage(dataUrl);
    } catch {
      compressed = dataUrl;
    }
    setPreviewSrc(compressed);

    try {
      const res = await fetch('/api/ocr/scan-id', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ image: compressed }),
      });

      if (res.status === 401) { window.location.reload(); return; }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `OCR failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const cv = document.createElement('canvas');
    cv.width  = video.videoWidth;
    cv.height = video.videoHeight;
    cv.getContext('2d').drawImage(video, 0, 0);
    stopCamera();
    processImage(cv.toDataURL('image/jpeg', 0.95));
  }, [stopCamera, processImage]);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => processImage(e.target.result);
    reader.readAsDataURL(file);
  }, [processImage]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setPreviewSrc(null);
    setScanning(false);
    if (mode === 'camera') startCamera();
  }, [mode, startCamera]);

  // ── Apply helpers ───────────────────────────────────────────────────────────

  const applyField  = (key, val) => { onApply({ [key]: val }); };
  const applyAll    = () => {
    if (!result?.mapped) return;
    const { source: _s, ...fields } = result.mapped;
    const defined = Object.fromEntries(Object.entries(fields).filter(([, v]) => v));
    if (Object.keys(defined).length) onApply(defined);
    onClose();
  };

  const hasMapped = result?.mapped &&
    Object.entries(result.mapped).some(([k, v]) => k !== 'source' && v);

  const FIELD_META = [
    { key: 'name',    label: lang === 'sk' ? 'Meno'            : 'First name' },
    { key: 'surname', label: lang === 'sk' ? 'Priezvisko'      : 'Surname'    },
    { key: 'country', label: lang === 'sk' ? 'Krajina'         : 'Country'    },
    { key: 'idCode',  label: lang === 'sk' ? 'Číslo dokladu'   : 'ID number'  },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal scan-modal">

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <Icon name="scan" size={16} />
              {lang === 'sk' ? 'Načítať doklad' : 'Scan / Load ID'}
            </div>
            <div className="muted-text" style={{ fontSize: 11, marginTop: 3 }}>
              {lang === 'sk'
                ? 'Doklad nie je ukladaný — obraz sa spracuje cez OCR a zahodí.'
                : 'Image is not stored — forwarded to OCR and discarded.'}
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} title="Close">
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Mode toggle — hidden while scanning or showing results */}
        {!scanning && !result && !error && (
          <div className="modal-tabs">
            <button
              className={'modal-tab' + (mode === 'camera' ? ' active' : '')}
              disabled={!canCamera}
              onClick={() => { stopCamera(); setMode('camera'); }}
            >
              <Icon name="scan" size={13} />
              {lang === 'sk' ? 'Kamera' : 'Camera'}
            </button>
            <button
              className={'modal-tab' + (mode === 'upload' ? ' active' : '')}
              onClick={() => { stopCamera(); setMode('upload'); }}
            >
              <Icon name="download" size={13} />
              {lang === 'sk' ? 'Súbor / Skener' : 'File / Scanner'}
            </button>
          </div>
        )}

        <div className="modal-body">

          {/* ── CAMERA MODE ── */}
          {mode === 'camera' && !scanning && !result && !error && (
            <div className="camera-wrap">
              {cameraError ? (
                <div className="notice" style={{ margin: 0, flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Icon name="info" size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
                    <span>{cameraError}</span>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn btn-sm btn-primary" onClick={startCamera}>
                      {lang === 'sk' ? 'Skúsiť znova' : 'Try again'}
                    </button>
                    <button className="btn btn-sm" onClick={() => setMode('upload')}>
                      {lang === 'sk' ? 'Nahrať súbor' : 'Upload file'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="video-frame">
                    <video
                      ref={videoRef}
                      className="camera-video"
                      playsInline
                      muted
                      autoPlay
                    />
                    {/* ID-card overlay with animated corner brackets */}
                    <div className={'id-frame' + (cardDetected ? ' detected' : '')}>
                      <span className="corner tl" />
                      <span className="corner tr" />
                      <span className="corner bl" />
                      <span className="corner br" />
                    </div>
                    <div className={'frame-hint' + (cardDetected ? ' ready' : '')}>
                      {cardDetected
                        ? (lang === 'sk' ? '✓ Doklad v rámiku — môžete odfotiť' : '✓ ID in frame — ready to capture')
                        : (lang === 'sk' ? 'Priložte doklad do rámika' : 'Place your ID inside the frame')}
                    </div>
                  </div>
                  <button
                    className={'btn btn-lg capture-btn' + (cardDetected ? ' btn-accent' : ' btn-primary')}
                    onClick={capturePhoto}
                    disabled={!cameraActive}
                  >
                    <Icon name="scan" size={16} />
                    {lang === 'sk' ? 'Odfotiť' : 'Capture'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── UPLOAD MODE ── */}
          {mode === 'upload' && !scanning && !result && !error && (
            <div
              className={'drop-zone' + (dragOver ? ' drag-over' : '')}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={e => handleFile(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <Icon name="download" size={36} style={{ opacity: 0.35 }} />
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 14 }}>
                {lang === 'sk'
                  ? 'Kliknite alebo pretiahnite obrázok dokladu'
                  : 'Click or drag & drop your ID image'}
              </div>
              <div className="muted-text" style={{ fontSize: 12, marginTop: 4 }}>
                JPG · PNG · BMP · TIFF · max 5 MB
              </div>
            </div>
          )}

          {/* ── SCANNING / LOADING ── */}
          {scanning && (
            <div className="scan-loading">
              <div className="ocr-spinner" />
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 18 }}>
                {lang === 'sk' ? 'Spracovávam doklad…' : 'Processing ID…'}
              </div>
              <div className="muted-text" style={{ fontSize: 12, marginTop: 5 }}>
                {lang === 'sk' ? 'EasyOCR číta text — chvíľu počkajte' : 'EasyOCR reading text — please wait'}
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {error && !scanning && (
            <div>
              <div className="notice" style={{
                borderColor: 'var(--danger)', background: 'var(--danger-tint)', color: 'var(--danger)',
                marginBottom: 16,
              }}>
                <Icon name="info" size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
                <span>{error}</span>
              </div>

              {previewSrc && (
                <div style={{ marginBottom: 16 }}>
                  <div className="muted-text" style={{ fontSize: 12, marginBottom: 6 }}>
                    {lang === 'sk' ? 'Náhľad (doklad nerozpoznaný)' : 'Preview (ID not recognized)'}
                  </div>
                  <img
                    src={previewSrc} alt="ID preview"
                    style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              <button className="btn btn-primary" onClick={reset}>
                <Icon name="scan" size={13} />
                {lang === 'sk' ? 'Skúsiť znova' : 'Try again'}
              </button>
            </div>
          )}

          {/* ── RESULTS ── */}
          {result && !scanning && (
            <div>
              {/* Mapped fields */}
              {hasMapped && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>
                      {lang === 'sk' ? 'Rozpoznané údaje' : 'Detected fields'}
                    </span>
                    <span className={'tag ' + (result.mapped.source === 'mrz' ? 'success' : 'accent')}
                      style={{ fontSize: 9, letterSpacing: '0.06em' }}>
                      {result.mapped.source === 'mrz' ? 'MRZ ✓' : lang === 'sk' ? 'ODHAD' : 'ESTIMATE'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {FIELD_META.map(({ key, label }) => {
                      const val = result.mapped[key];
                      if (!val) return null;
                      return (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 12px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r-sm)',
                        }}>
                          <span className="muted-text" style={{ fontSize: 11, minWidth: 110 }}>{label}</span>
                          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{val}</span>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => applyField(key, val)}
                          >
                            {lang === 'sk' ? 'Použiť' : 'Apply'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    className="btn btn-accent"
                    style={{ marginTop: 12, width: '100%' }}
                    onClick={applyAll}
                  >
                    <Icon name="check" size={13} />
                    {lang === 'sk' ? 'Použiť všetky polia' : 'Apply all fields'}
                  </button>
                </div>
              )}

              {/* Raw OCR text (always shown for manual copy-paste) */}
              {result.raw && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="copy" size={12} />
                    {lang === 'sk' ? 'Celý rozpoznaný text (kliknite → označí sa)' : 'Full OCR text (click to select)'}
                  </div>
                  <textarea
                    readOnly
                    value={result.raw}
                    onClick={e => e.target.select()}
                    rows={Math.min(10, result.raw.split('\n').length + 1)}
                    style={{
                      width: '100%',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-sm)',
                      background: 'var(--surface-2)',
                      resize: 'vertical',
                      cursor: 'text',
                    }}
                  />
                </div>
              )}

              {/* ID preview when OCR found very little */}
              {result.totalDetections < 3 && previewSrc && (
                <div style={{ marginBottom: 16 }}>
                  <div className="muted-text" style={{ fontSize: 12, marginBottom: 6 }}>
                    {lang === 'sk'
                      ? 'Náhľad dokladu (OCR nenašiel veľa textu — skúste lepšie osvetlenie)'
                      : 'Document preview (OCR found little text — try better lighting)'}
                  </div>
                  <img
                    src={previewSrc} alt="ID preview"
                    style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              {/* Footer actions */}
              <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={reset}>
                  <Icon name="scan" size={13} />
                  {lang === 'sk' ? 'Skenovať znova' : 'Scan again'}
                </button>
                <button className="btn btn-ghost" onClick={onClose}>
                  {lang === 'sk' ? 'Zavrieť' : 'Close'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export { ScanIdModal };
