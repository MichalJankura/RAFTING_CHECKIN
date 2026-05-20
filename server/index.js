import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readSecret } from './secrets.js';
import ordersRouter from './routes/orders.js';
import authRouter   from './routes/auth.js';
import { requireAuth } from './middleware/requireAuth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app    = express();
const PORT   = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Session secret is separate from the encryption key and the app password.
// It only needs to be stable across restarts if you want sessions to survive
// a container restart. For this deployment, losing sessions on restart is fine
// — the operator just logs in again.
const SESSION_SECRET = readSecret('session_secret', 'SESSION_SECRET');

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin:      isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true, // required for cookies in dev mode
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json());

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(session({
  name:             'sid',
  secret:           SESSION_SECRET,
  resave:           false,          // in-memory store has no touch(); false is correct
  saveUninitialized: false,
  rolling:          true,           // reset the 7-day window on every response
  cookie: {
    httpOnly: true,                 // JS cannot read the cookie
    secure:   false,                // app runs plain HTTP behind Netbird VPN — secure:true would silently drop the cookie
    sameSite: 'strict',             // CSRF protection
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days rolling; operator stays logged in as long as they use the app weekly
  },
}));

// ─── Security headers (minimal, no extra dependency) ─────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth routes are public (login page does not require a session)
app.use('/api/auth', authRouter);

// All other API routes require an authenticated session
app.use('/api/orders', requireAuth, ordersRouter);

// ─── Frontend (production) ────────────────────────────────────────────────────
if (isProd) {
  const distDir = join(__dirname, '..', 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(join(distDir, 'index.html')));
}

// ─── Start ────────────────────────────────────────────────────────────────────
const host = '0.0.0.0';
createServer(app).listen(PORT, host, () => {
  console.log(`RAFTING DUNAJEC server bezi na http://localhost:${PORT}`);
});
