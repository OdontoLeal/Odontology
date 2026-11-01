import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// @ts-expect-error CSS files are handled by the bundler and have no TypeScript declarations.
import './index.css';

// Interceptor global para adjuntar token Bearer a peticiones autenticadas si está disponible
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let token = window.sessionStorage.getItem('odontoleal_jwt_token');
    if (!token) {
      const rawSession = window.sessionStorage.getItem('odontoleal_active_session_v1');
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          token = parsed.token;
        } catch {}
      }
    }

    init = init || {};
    init.credentials = init.credentials || 'include';

    if (token) {
      const headers = new Headers(init.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init.headers = headers;
    }

    return originalFetch(input, init);
  };
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);