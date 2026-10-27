import { useGame } from '../context.ts';
import { Reports, ResearchBoard } from '../screens/Discovery.tsx';
import { t } from '../../i18n/index.ts';

// Continuous discovery: hypotheses and interviews keep going after launch.
export function ResearchTab() {
  const { state } = useGame();
  return (
    <>
      <ResearchBoard />
      <div className="stack">
        <div className="section-title">
          <h3>{t('Отчёты исследований ({0})', [state.reports.length])}</h3>
        </div>
        <Reports reports={state.reports} />
      </div>
    </>
  );
}
