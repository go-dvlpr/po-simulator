import type { Locale } from '../../i18n/index.ts';
import { LOCALES, locale, setLocale, t } from '../../i18n/index.ts';
import { Icon } from './Icon.tsx';

// Switching reloads the page in the new language; the game is saved in the browser and continues.
export function LanguageSelect(props: { compact?: boolean }) {
  return (
    <label className={`lang-select ${props.compact ? 'compact' : 'sb-item'}`} title={t('Язык интерфейса')}>
      <Icon name="globe" size={15} />
      <select value={locale} aria-label={t('Язык интерфейса')} onChange={(e) => setLocale(e.target.value as Locale)}>
        {LOCALES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size={13} />
    </label>
  );
}
