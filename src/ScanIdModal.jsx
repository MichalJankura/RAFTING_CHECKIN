// RAFTING DUNAJEC — ID capture modal
// Captures image (camera or file upload), compresses it, and calls onCapture(dataUrl).
// OCR processing and result display happen in the parent (checkin.jsx).
// The image is never stored locally or server-side.

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

function measureCardPresence(video, overlayFrac = 0.72) {
  try {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return 0;
    const ow = Math.round(vw * overlayFrac);
    const oh = Math.round(ow / 1.586);
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

function ScanIdModal({ lang, onCapture, onClose }) {
  const canCamera = hasCameraAPI();
  const [mode, setMode]             = useState(() => (isMobileDevice() && canCamera) ? 'camera' : 'upload');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState(null);
  const [cardDetected, setCardDetected] = useState(false);
  const [preparing, setPreparing]       = useState(false);
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
              ? 'Kamera nie je dostupná. Skúste režim nahratia súboru.'
              : 'Camera unavailable. Use file upload instead.');
      setCameraError(msg);
    }
  }, [lang]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current) return;
    detectorRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      setCardDetected(measureCardPresence(video) > 0.18);
    }, 500);
    return () => { if (detectorRef.current) clearInterval(detectorRef.current); };
  }, [cameraActive]);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => stopCamera();
  }, [mode]); // intentionally omitting startCamera/stopCamera

  useEffect(() => () => stopCamera(), []); // eslint-disable-line

  // ── Capture & compress ──────────────────────────────────────────────────────

  const handleCapture = useCallback(async (rawDataUrl) => {
    setPreparing(true);
    stopCamera();
    let compressed;
    try { compressed = await compressImage(rawDataUrl); }
    catch { compressed = rawDataUrl; }
    onCapture(compressed); // parent will close modal + start OCR
  }, [stopCamera, onCapture]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const cv = document.createElement('canvas');
    cv.width  = video.videoWidth;
    cv.height = video.videoHeight;
    cv.getContext('2d').drawImage(video, 0, 0);
    handleCapture(cv.toDataURL('image/jpeg', 0.95));
  }, [handleCapture]);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => handleCapture(e.target.result);
    reader.readAsDataURL(file);
  }, [handleCapture]);

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
                ? 'Odfotografujte doklad — OCR spustí automaticky po nasnímaní'
                : 'Capture the ID — OCR starts automatically after capture'}
            </div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} title="Close">
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* Mode toggle — hidden while preparing */}
        {!preparing && (
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

          {/* Brief compress-and-hand-off state */}
          {preparing && (
            <div className="scan-loading">
              <div className="ocr-spinner" />
              <div style={{ fontWeight: 600, fontSize: 14, marginTop: 18 }}>
                {lang === 'sk' ? 'Príprava obrazu…' : 'Preparing image…'}
              </div>
              <div className="muted-text" style={{ fontSize: 12, marginTop: 5 }}>
                {lang === 'sk' ? 'OCR spustí ihneď po odovzdaní' : 'OCR will start right after handoff'}
              </div>
            </div>
          )}

          {/* Camera mode */}
          {mode === 'camera' && !preparing && (
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

          {/* Upload mode */}
          {mode === 'upload' && !preparing && (
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

        </div>
      </div>
    </div>
  );
}

export { ScanIdModal };
