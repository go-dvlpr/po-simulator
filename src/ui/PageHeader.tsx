import { Hint } from './components/Hint.tsx';
import { Icon } from './components/Icon.tsx';
import { Theory } from './components/common.tsx';
import { useGame } from './context.ts';
import { groupOf, sectionBadges, sectionDef } from './navigation.ts';

// Title, one-line purpose, "what to do here" hint, theory links and tabs of the section group.
export function PageHeader() {
  const { state, section, setSection } = useGame();
  const def = sectionDef(state.phase, section);
  const group = groupOf(state.phase, section);
  const tabs = group.sections.length > 1 ? group.sections : [];
  const badges = sectionBadges(state);

  return (
    <header className="page-header">
      <div className="page-head-row">
        <div className="page-head-text">
          <h1 className="page-title">
            {tabs.length > 0 ? group.label : def.label}
            {def.help && <Hint title={def.label} text={def.help} />}
          </h1>
          <p className="page-desc">{def.desc}</p>
        </div>
        {def.articles && (
          <div className="page-head-links">
            {def.articles.map((a) => (
              <Theory key={a.id} article={a.id} label={a.label} />
            ))}
          </div>
        )}
      </div>
      {tabs.length > 0 && (
        <nav className="page-tabs" aria-label={group.label}>
          {tabs.map((t) => (
            <button key={t.id} type="button" className={`page-tab ${t.id === def.id ? 'active' : ''}`} aria-current={t.id === def.id ? 'page' : undefined} onClick={() => setSection(t.id)}>
              <Icon name={t.icon} size={14} />
              {t.label}
              {(badges[t.id] ?? 0) > 0 && <span className="count">{badges[t.id]}</span>}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
