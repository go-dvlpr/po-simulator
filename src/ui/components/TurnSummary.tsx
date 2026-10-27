import { useState } from 'react';
import type { ReportLine } from '../../engine/types.ts';
import { useGame } from '../context.ts';
import { SECTIONS } from '../navigation.ts';
import type { IconName } from './Icon.tsx';
import { Icon } from './Icon.tsx';
import { Button, Inline } from './common.tsx';
import { t } from '../../i18n/index.ts';

// Needs a decision first, then problems, then good news, then everything else.
const TONES: Record<ReportLine['tone'], { icon: IconName; order: number }> = {
  action: { icon: 'zap', order: 0 },
  bad: { icon: 'alert', order: 1 },
  good: { icon: 'check', order: 2 },
  info: { icon: 'chevronRight', order: 3 },
};

// What happened during the last turn; can be dismissed until the next turn.
export function TurnSummary(props: { title?: string }) {
  const { state, setSection } = useGame();
  const [dismissedWeek, setDismissedWeek] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  if (state.lastReport.length === 0 || dismissedWeek === state.week) return null;
  const limit = 6;
  const sorted = [...state.lastReport].sort((a, b) => TONES[a.tone].order - TONES[b.tone].order);
  const lines = expanded ? sorted : sorted.slice(0, limit);
  const sections = SECTIONS[state.phase];
  const actions = sorted.filter((l) => l.tone === 'action').length;
  const problems = sorted.filter((l) => l.tone === 'bad').length;

  return (
    <section className="card accent">
      <header className="card-header">
        <div className="row grow">
          <div className="method-icon">
            <Icon name="sparkles" size={16} />
          </div>
          <div>
            <h3 className="card-title">{props.title ?? t('Что произошло')}</h3>
            <p className="card-desc">
              {t('Неделя {0}', [state.week + 1])}
              {actions > 0 && t(' · ждут решения: {0}', [actions])}
              {problems > 0 && t(' · проблем: {0}', [problems])}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" icon="x" onClick={() => setDismissedWeek(state.week)} aria-label={t('Скрыть итоги')} />
      </header>
      <div className="card-body">
        <div className="feed">
          {lines.map((line, i) => {
            const link = line.link && sections.some((x) => x.id === line.link) ? line.link : null;
            return (
              <div key={i} className={`feed-item ${line.tone}`}>
                <span className={`feed-icon ${line.tone}`}>
                  <Icon name={TONES[line.tone].icon} size={12} strokeWidth={2.2} />
                </span>
                <span className="grow">
                  <Inline text={line.text} />
                </span>
                {link && (
                  <button type="button" className="link nowrap" onClick={() => setSection(link)}>
                    {t('Открыть')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {sorted.length > limit && (
          <Button variant="ghost" size="sm" iconRight={expanded ? 'chevronUp' : 'chevronDown'} onClick={() => setExpanded(!expanded)}>
            {expanded ? t('Свернуть') : t('Ещё {0}', [sorted.length - limit])}
          </Button>
        )}
      </div>
    </section>
  );
}
