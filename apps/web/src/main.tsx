import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
// Tipografía autoalojada (D17): Vite sirve los woff2 desde el propio origen (CSP 'self').
import '@fontsource-variable/space-grotesk';
import './ui/tokens.css';
import './ui/ui.css';
import './app/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
