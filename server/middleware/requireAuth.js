/**
 * requireAuth.js
 *
 * Express middleware that rejects unauthenticated requests to API routes.
 * The frontend should redirect to /login on receiving a 401 response.
 */

export function requireAuth(req, res, next) {
  if (req.session?.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Neprihlásený' });
}
