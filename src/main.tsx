import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { locale } from './i18n/index.ts';
import { applyTheme, loadTheme } from './ui/components/ThemeToggle.tsx';
import './styles.css';

applyTheme(loadTheme());
document.documentElement.lang = locale;

const root = document.getElementById('root');
if (!root) throw new Error('root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
