import React, { useState } from 'react';
import { Icon } from './icons.jsx';

const SPIN_CSS = '@keyframes rd-spin { to { transform: rotate(360deg); } }';

function LoginPage({ onLogin }) {
  const [lang, setLang] = useState(() => localStorage.getItem('rd_lang') || 'sk');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLang = (l) => {
    setLang(l);
    localStorage.setItem('rd_lang', l);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onLogin();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (lang === 'sk' ? 'Nesprávne heslo' : 'Incorrect password'));
        setPassword('');
      }
    } catch {
      setError(lang === 'sk' ? 'Chyba spojenia' : 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SPIN_CSS }} />

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        position: 'relative',
      }}>

        {/* Lang toggle — top-right corner */}
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <div className="lang-toggle">
            <button className={lang === 'sk' ? 'active' : ''} onClick={() => handleLang('sk')}>SK</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => handleLang('en')}>EN</button>
          </div>
        </div>

        <div className="card" style={{ width: '100%', maxWidth: 380, padding: '36px 32px' }}>

          {/* Brand block — centered */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            marginBottom: 28,
            paddingBottom: 24,
            borderBottom: '1px solid var(--border)',
          }}>
            <img
              src="logo.png"
              alt="Rafting Dunajec"
              style={{
                width: 56,
                height: 56,
                objectFit: 'contain',
                display: 'block',
                background: 'var(--primary-tint)',
                borderRadius: '50%',
                padding: 8,
              }}
            />
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontSize: 15,
                color: 'var(--ink)',
                lineHeight: 1.1,
              }}>
                RAFTING DUNAJEC
              </div>
              <div style={{
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--muted-2)',
                marginTop: 3,
              }}>
                {lang === 'sk' ? 'Check-in systém' : 'Check-in system'}
              </div>
            </div>
            <p style={{
              margin: 0,
              fontSize: 12.5,
              color: 'var(--muted)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              {lang === 'sk'
                ? 'Prihláste sa pre prístup k recepcii'
                : 'Sign in to access the reception desk'}
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="field" style={{ marginBottom: 20 }}>
              <label htmlFor="login-password">
                {lang === 'sk' ? 'HESLO' : 'PASSWORD'}
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => { setError(''); setPassword(e.target.value); }}
                autoFocus
                autoComplete="current-password"
                disabled={loading}
              />
              {error && (
                <p style={{
                  margin: '6px 0 0',
                  fontSize: 12,
                  color: 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  lineHeight: 1.3,
                }}>
                  <Icon name="x" size={12} />
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading || !password}
            >
              {loading && (
                <span style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,.3)',
                  borderTopColor: '#fff',
                  display: 'inline-block',
                  animation: 'rd-spin 0.65s linear infinite',
                  flexShrink: 0,
                }} />
              )}
              {loading
                ? (lang === 'sk' ? 'Prihlasujem…' : 'Signing in…')
                : (lang === 'sk' ? 'Prihlásiť sa' : 'Sign in')}
            </button>
          </form>

        </div>
      </div>
    </>
  );
}

export default LoginPage;
