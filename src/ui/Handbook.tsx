import { useMemo, useRef, useState } from 'react';
import { HANDBOOK } from '../data/handbook.ts';
import { Icon } from './components/Icon.tsx';
import { Button, Inline, useDialog } from './components/common.tsx';
import { t } from '../i18n/index.ts';

const GROUPS: { title: string; ids: string[] }[] = [
  { title: t('Основы'), ids: ['po-role', 'stakeholders', 'finance'] },
  { title: t('Исследования'), ids: ['hypotheses', 'custdev', 'jtbd', 'market-sizing', 'competitors', 'surveys', 'mvp-types', 'segmentation', 'feedback'] },
  { title: t('Продукт и стратегия'), ids: ['value-prop', 'prioritization', 'pricing', 'north-star', 'okr', 'launch'] },
  { title: t('Метрики'), ids: ['aarrr', 'vanity-metrics', 'retention', 'unit-economics', 'pmf', 'analytics'] },
  { title: t('Эксперименты'), ids: ['ab-testing', 'ab-pitfalls', 'feature-flags'] },
  { title: t('Рост'), ids: ['performance-marketing', 'attribution', 'organic-growth', 'seasonality', 'b2b-saas'] },
  { title: t('Разработка и команда'), ids: ['tech-stack', 'tech-debt', 'agile', 'team', 'legal-security'] },
];

function ArticleBody(props: { body: string }) {
  const blocks = useMemo(() => {
    const out: { kind: 'p' | 'h' | 'ul' | 'f'; lines: string[] }[] = [];
    for (const raw of props.body.split('\n')) {
      const line = raw.trimEnd();
      if (line.trim() === '') {
        out.push({ kind: 'p', lines: [] });
        continue;
      }
      const kind = line.startsWith('### ') ? 'h' : line.startsWith('- ') ? 'ul' : line.startsWith('= ') ? 'f' : 'p';
      const text = kind === 'h' ? line.slice(4) : kind === 'ul' || kind === 'f' ? line.slice(2) : line;
      const last = out[out.length - 1];
      if (last && last.kind === kind && kind !== 'h' && last.lines.length > 0) last.lines.push(text);
      else out.push({ kind, lines: [text] });
    }
    return out.filter((b) => b.lines.length > 0);
  }, [props.body]);

  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'h') return <h4 key={i}>{b.lines[0]}</h4>;
        if (b.kind === 'ul')
          return (
            <ul key={i}>
              {b.lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l} />
                </li>
              ))}
            </ul>
          );
        if (b.kind === 'f')
          return (
            <pre key={i} className="formula">
              {b.lines.join('\n')}
            </pre>
          );
        return (
          <p key={i}>
            <Inline text={b.lines.join(' ')} />
          </p>
        );
      })}
    </>
  );
}

export function Handbook(props: { articleId: string | null; onClose: () => void; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, props.onClose);
  const article = HANDBOOK.find((a) => a.id === props.articleId) ?? HANDBOOK[0];
  const q = query.trim().toLowerCase();
  const match = (id: string) => {
    const a = HANDBOOK.find((x) => x.id === id);
    return a !== undefined && (q === '' || (a.title + ' ' + a.summary + ' ' + a.body).toLowerCase().includes(q));
  };

  return (
    <div className="overlay" onClick={props.onClose}>
      <div ref={ref} tabIndex={-1} className="modal xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('Справочник продакт-оунера')}>
        <header className="modal-header" style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div className="row grow">
            <div className="method-icon">
              <Icon name="book" size={18} />
            </div>
            <div>
              <h2 className="modal-title">{t('Справочник продакт-оунера')}</h2>
              <p className="modal-desc">{t('{0} статей: теория, формулы, бенчмарки и типичные ошибки', [HANDBOOK.length])}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" icon="x" onClick={props.onClose} aria-label={t('Закрыть')} />
        </header>
        <div className="handbook">
          <aside className="handbook-nav">
            <div className="input-prefix">
              <span>
                <Icon name="search" size={14} />
              </span>
              <input className="input input-sm" placeholder={t('Поиск по статьям')} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {GROUPS.map((g) => {
              const ids = g.ids.filter(match);
              if (ids.length === 0) return null;
              return (
                <div key={g.title} className="hb-group">
                  <div className="eyebrow" style={{ padding: '4px 10px' }}>
                    {g.title}
                  </div>
                  {ids.map((id) => (
                    <button key={id} type="button" className={`hb-item ${id === article.id ? 'active' : ''}`} onClick={() => props.onOpen(id)}>
                      {HANDBOOK.find((a) => a.id === id)?.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </aside>
          <div className="handbook-article">
            <article className="article">
              <h2>{article.title}</h2>
              <p className="text-muted" style={{ fontSize: 15, marginTop: 6 }}>
                {article.summary}
              </p>
              <hr className="divider" style={{ margin: '18px 0' }} />
              <ArticleBody body={article.body} />
              {article.related && article.related.length > 0 && (
                <div className="stack-sm mt-md">
                  <span className="eyebrow">{t('Связанные темы')}</span>
                  <div className="row wrap">
                    {article.related.map((id) => {
                      const r = HANDBOOK.find((a) => a.id === id);
                      return r ? (
                        <button key={id} type="button" className="chip" onClick={() => props.onOpen(id)}>
                          {r.title}
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
