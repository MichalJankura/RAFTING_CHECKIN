/**
 * auth.js — minimal login/logout routes for a single-operator deployment.
 *
 * POST /api/auth/login   { password: "..." }  → sets session cookie
 * POST /api/auth/logout                        → destroys session
 * GET  /api/auth/me                            → 200 if authenticated, 401 if not
 */

import { Router } from 'express';
import { readSecret } from '../secrets.js';
import { timingSafeEqual, createHash } from 'node:crypto';

const router = Router();

// Load the app password once at startup.
const APP_PASSWORD = readSecret('app_password', 'APP_PASSWORD');

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both inputs are hashed to ensure equal buffer length regardless of content.
 */
function safeCompare(a, b) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Chýba heslo' });
  }

  if (!safeCompare(password, APP_PASSWORD)) {
    // Uniform response — do not distinguish "wrong password" from "no such user"
    return res.status(401).json({ error: 'Nesprávne heslo' });
  }

  // Regenerate session ID on login to prevent session fixation
  req.session.regenerate((err) => {
    if (err) {
      console.error('[auth] session regenerate error:', err);
      return res.status(500).json({ error: 'Chyba servera' });
    }
    req.session.authenticated = true;
    res.json({ ok: true });
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('[auth] session destroy error:', err);
    res.clearCookie('sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me — used by the frontend to check if the session is still valid
router.get('/me', (req, res) => {
  if (req.session?.authenticated) {
    return res.json({ authenticated: true });
  }
  res.status(401).json({ authenticated: false });
});

export default router;
