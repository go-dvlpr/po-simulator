import { useState } from 'react';
import type { IconName } from './Icon.tsx';
import { Icon } from './Icon.tsx';
import { t } from '../../i18n/index.ts';

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'po-simulator-theme';
const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const META: Record<ThemePref, { label: string; icon: IconName }> = {
  system: { label: t('Тема: как в системе'), icon: 'monitor' },
  light: { label: t('Тема: светлая'), icon: 'sun' },
  dark: { label: t('Тема: тёмная'), icon: 'moon' },
};

export function loadTheme(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: ThemePref): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
}

function saveTheme(theme: ThemePref): void {
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // The choice still applies for this visit.
  }
}

export function ThemeToggle(props: { className?: string }) {
  const [theme, setTheme] = useState(loadTheme);
  const meta = META[theme];
  return (
    <button
      type="button"
      className={props.className ?? 'sb-item'}
      title={t('Сменить тему')}
      onClick={() => {
        const next = NEXT[theme];
        setTheme(next);
        applyTheme(next);
        saveTheme(next);
      }}
    >
      <Icon name={meta.icon} size={15} />
      <span className="grow">{meta.label}</span>
    </button>
  );
}
