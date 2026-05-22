/**
 * server/routes/ocr.js
 *
 * POST /api/ocr/scan-id
 *   Body:    { image: "<base64 or data-URI>" }
 *   Returns: { mapped: { name, surname, country, idCode, source }, raw, totalDetections }
 *
 * The image is forwarded to the EasyOCR sidecar and then discarded.
 * It is never logged or stored. The route requires a valid session.
 *
 * Field mapping strategy:
 *   1. Try MRZ parsing (TD3 passport 2×44, TD1 ID card 3×30) — most accurate.
 *   2. Fall back to heuristic: ID-number regex + uppercase-name lines + country keywords.
 */

import { Router } from 'express';

const router = Router();
const OCR_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5000';
const MAX_B64_BYTES = 7 * 1024 * 1024; // ~5 MB image after base64 overhead

// ── Country code tables ───────────────────────────────────────────────────────

// ISO 3166-1 alpha-3 → app COUNTRIES list value
const MRZ_COUNTRY = {
  SVK: 'Slovensko / Slovakia',
  CZE: 'Česko / Czechia',
  POL: 'Poľsko / Poland',
  HUN: 'Maďarsko / Hungary',
  DEU: 'Nemecko / Germany',
  AUT: 'Rakúsko / Austria',
  UKR: 'Ukrajina / Ukraine',
  GBR: 'Veľká Británia / UK',
  NLD: 'Holandsko / Netherlands',
  FRA: 'Francúzsko / France',
  ITA: 'Taliansko / Italy',
  USA: 'USA',
};

// Keyword lists for heuristic country detection (lowercase)
const COUNTRY_KEYWORDS = [
  { country: 'Slovensko / Slovakia',    kw: ['slovensko', 'slovenská republika', 'slovak', 'svk'] },
  { country: 'Česko / Czechia',         kw: ['česká republika', 'ceska republika', 'czechia', 'czech', 'cze'] },
  { country: 'Poľsko / Poland',         kw: ['polska', 'poland', 'pol'] },
  { country: 'Maďarsko / Hungary',      kw: ['magyarország', 'hungary', 'hun', 'magyar'] },
  { country: 'Nemecko / Germany',       kw: ['deutschland', 'germany', 'deu'] },
  { country: 'Rakúsko / Austria',       kw: ['österreich', 'austria', 'aut'] },
  { country: 'Ukrajina / Ukraine',      kw: ['ukraine', 'україна', 'ukr'] },
  { country: 'Veľká Británia / UK',     kw: ['united kingdom', 'great britain', 'gbr'] },
  { country: 'Holandsko / Netherlands', kw: ['nederland', 'netherlands', 'nld'] },
  { country: 'Francúzsko / France',     kw: ['france', 'fra'] },
  { country: 'Taliansko / Italy',       kw: ['italia', 'italy', 'ita'] },
  { country: 'USA',                     kw: ['united states', 'usa'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/\b[\wÀ-ÿ]/g, c => c.toUpperCase());
}

function stripFill(s) {
  return s.replace(/<+$/, '').replace(/</g, ' ').trim();
}

// ── MRZ parsers ───────────────────────────────────────────────────────────────

function parseTD3(line1, line2) {
  // line1: P<SVK + SURNAME<<GIVEN_NAMES<<<...  (44 chars)
  // line2: DOCNUM + check + COUNTRY + DOB + ... (44 chars)
  try {
    const country = MRZ_COUNTRY[line1.substring(2, 5)] || null;
    const nameRaw = stripFill(line1.substring(5));
    const sep = nameRaw.indexOf('  ');
    const surname = titleCase(sep >= 0 ? nameRaw.substring(0, sep) : nameRaw);
    const name    = sep >= 0 ? titleCase(nameRaw.substring(sep + 2).replace(/ {2,}/g, ' ').trim()) : '';
    const idCode  = line2.substring(0, 9).replace(/<+$/, '');
    return { name: name || null, surname: surname || null, country, idCode: idCode || null };
  } catch { return null; }
}

function parseTD1(line1, line2, line3) {
  // line3: SURNAME<<GIVEN_NAMES (30 chars)
  try {
    const ctry1 = MRZ_COUNTRY[line1.substring(2, 5)] || null;
    const ctry2 = line2.length >= 18 ? MRZ_COUNTRY[line2.substring(15, 18)] || null : null;
    const country = ctry1 || ctry2;
    const idCode  = stripFill(line1.substring(5, 14));
    const nameRaw = stripFill(line3);
    const sep     = nameRaw.indexOf('  ');
    const surname = titleCase(sep >= 0 ? nameRaw.substring(0, sep) : nameRaw);
    const name    = sep >= 0 ? titleCase(nameRaw.substring(sep + 2).replace(/ {2,}/g, ' ').trim()) : '';
    return { name: name || null, surname: surname || null, country, idCode: idCode || null };
  } catch { return null; }
}

function tryMRZ(texts) {
  const mrzRe = /^[A-Z0-9<]{28,44}$/;
  const mrzLines = texts
    .map(t => t.text.replace(/\s+/g, '').toUpperCase())
    .filter(l => mrzRe.test(l));

  // TD3 passport: exactly 44 chars
  const td3 = mrzLines.filter(l => l.length === 44);
  if (td3.length >= 2) {
    const l1 = td3.find(l => l[0] === 'P') || td3[0];
    const l2 = td3.find(l => l !== l1)      || td3[1];
    const r  = parseTD3(l1, l2);
    if (r) return r;
  }

  // TD1 ID card: exactly 30 chars
  const td1 = mrzLines.filter(l => l.length === 30);
  if (td1.length >= 3) return parseTD1(td1[0], td1[1], td1[2]);
  if (td1.length === 2) {
    // Two-line fallback: treat last line as name line
    const l1 = td1.find(l => /^[IP]/.test(l)) || td1[0];
    const l3 = td1.find(l => l !== l1)         || td1[1];
    const country = MRZ_COUNTRY[l1.substring(2, 5)] || null;
    const idCode  = stripFill(l1.substring(5, 14));
    const nameRaw = stripFill(l3);
    const sep     = nameRaw.indexOf('  ');
    const surname = titleCase(sep >= 0 ? nameRaw.substring(0, sep) : nameRaw);
    const name    = sep >= 0 ? titleCase(nameRaw.substring(sep + 2).trim()) : '';
    return { name: name || null, surname: surname || null, country, idCode: idCode || null };
  }

  return null;
}

// ── Heuristic fallback ────────────────────────────────────────────────────────

// Noise words that appear on ID cards but are not names
const NOISE = [
  'SLOVENSKÁ REPUBLIKA', 'ČESKÁ REPUBLIKA', 'IDENTITY CARD', 'ID CARD',
  'PASSPORT', 'DRIVING LICENCE', 'REPUBLIC', 'NATIONAL',
  'MENO', 'NAME', 'PRIEZVISKO', 'SURNAME', 'OBČIANSKY',
];

function tryHeuristic(texts) {
  const allText = texts.map(t => t.text).join('\n');
  const lines   = texts.map(t => t.text.trim()).filter(t => t.length >= 2);
  let name = null, surname = null, country = null, idCode = null;

  // ID number: Slovak AB123456, Czech passport, 9-digit doc number
  for (const t of texts) {
    const m = t.text.match(/\b([A-Z]{2}[0-9]{6,7}|[A-Z][0-9]{7,9}|[0-9]{9})\b/);
    if (m) { idCode = m[1]; break; }
  }

  // Country from keywords
  const lower = allText.toLowerCase();
  for (const { country: c, kw } of COUNTRY_KEYWORDS) {
    if (kw.some(k => lower.includes(k))) { country = c; break; }
  }

  // Names: all-caps lines (Central European chars), no digits, not noise
  const nameRe = /^[A-ZÁČĎÉĚÍĽĹŇÓÔŔŠŤÚŮÝŽÄÖÜÀÈÌÙÂÊÎÛÔ\- ]{3,35}$/;
  const nameLines = lines.filter(l =>
    nameRe.test(l) &&
    !/\d/.test(l) &&
    !NOISE.some(n => l.includes(n))
  );

  if (nameLines.length >= 1) surname = titleCase(nameLines[0]);
  if (nameLines.length >= 2) name    = titleCase(nameLines[1]);

  return { name, surname, country, idCode };
}

// ── Main mapper ───────────────────────────────────────────────────────────────

function mapOcrToCustomer(texts) {
  const mrzResult = tryMRZ(texts);
  if (mrzResult && (mrzResult.name || mrzResult.surname || mrzResult.idCode)) {
    return { ...mrzResult, source: 'mrz' };
  }
  return { ...tryHeuristic(texts), source: 'heuristic' };
}

// ── Route ─────────────────────────────────────────────────────────────────────

router.post('/scan-id', async (req, res) => {
  const { image } = req.body;

  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image field required (base64 string or data URI)' });
  }
  if (Buffer.byteLength(image, 'utf8') > MAX_B64_BYTES) {
    return res.status(413).json({ error: 'Image too large — please reduce to under 5 MB' });
  }

  let ocrPayload;
  try {
    const ocrRes = await fetch(`${OCR_URL}/ocr`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ image }),
      signal:  AbortSignal.timeout(90_000),
    });

    if (!ocrRes.ok) {
      const err = await ocrRes.json().catch(() => ({}));
      return res.status(502).json({ error: err.error || `OCR service returned ${ocrRes.status}` });
    }
    ocrPayload = await ocrRes.json();
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'OCR service timed out — try a clearer image' });
    }
    console.error('[ocr] Service unreachable:', err.message);
    return res.status(503).json({ error: 'OCR service unavailable' });
  }

  const texts  = ocrPayload.results || [];
  const mapped = mapOcrToCustomer(texts);
  const raw    = texts.map(t => t.text).join('\n');

  // Never log the image; log only the count for diagnostics
  console.info(`[ocr] scan-id: ${texts.length} blocks, source=${mapped.source}`);

  res.json({ mapped, raw, totalDetections: texts.length });
});

export default router;
