import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Gracefully catch harmless asynchronous canvas animation frames on chart unmount
const isDisposedError = (e: any) => {
  const msg = (e && (e.message || (e.error && e.error.message) || String(e))) || '';
  return msg.includes('Object is disposed');
};

window.addEventListener('error', (event) => {
  if (isDisposedError(event)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (isDisposedError(event.reason)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
