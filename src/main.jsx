import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import LoginPage from './login.jsx';

function Root() {
  // 'loading' | 'authed' | 'anon'
  const [authState, setAuthState] = useState('loading');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        setAuthState(res.ok ? 'authed' : 'anon');
      })
      .catch(() => {
        setAuthState('anon');
      });
  }, []);

  if (authState === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <style>{`@keyframes rd-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2.5px solid var(--border-strong)',
          borderTopColor: 'var(--primary)',
          animation: 'rd-spin 0.7s linear infinite',
        }} />
      </div>
    );
  }

  if (authState === 'anon') {
    return <LoginPage onLogin={() => setAuthState('authed')} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
