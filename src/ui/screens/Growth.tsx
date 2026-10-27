import { dateLabel } from '../../engine/catalog.ts';
import { estimatedBurn } from '../../engine/growth.ts';
import { compactMoney, months } from '../../format.ts';
import { Button, TurnBar } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { AnalyticsTab } from '../growth/Analytics.tsx';
import { CompetitionTab } from '../growth/Competition.tsx';
import { StakeholdersPanel } from '../panels/Stakeholders.tsx';
import { ExperimentsTab } from '../growth/Experiments.tsx';
import { FinanceTab } from '../growth/Finance.tsx';
import { InboxTab } from '../growth/Inbox.tsx';
import { MarketingTab } from '../growth/Marketing.tsx';
import { MonetizationTab } from '../growth/Monetization.tsx';
import { OverviewTab } from '../growth/Overview.tsx';
import { ProductTab } from '../growth/Product.tsx';
import { ResearchTab } from '../growth/Research.tsx';
import { TeamPanel } from '../panels/TeamPanel.tsx';
import { TechPanel } from '../panels/TechPanel.tsx';
import { t } from '../../i18n/index.ts';

export function GrowthScreen() {
  const { state, dispatch, section } = useGame();
  const budget = Object.values(state.marketing.budgets).reduce((a, b) => a + b, 0) + state.marketing.crm;
  const burn = estimatedBurn(state);
  const runway = burn > 0 ? state.cash / burn : Infinity;

  return (
    <div className="stack-lg">
      {section === 'overview' && <OverviewTab />}
      {section === 'marketing' && <MarketingTab />}
      {section === 'product' && <ProductTab />}
      {section === 'experiments' && <ExperimentsTab />}
      {section === 'research' && <ResearchTab />}
      {section === 'inbox' && <InboxTab />}
      {section === 'analytics' && <AnalyticsTab />}
      {section === 'money' && <MonetizationTab />}
      {section === 'competition' && <CompetitionTab />}
      {section === 'stakeholders' && <StakeholdersPanel />}
      {section === 'team' && <TeamPanel />}
      {section === 'tech' && <TechPanel />}
      {section === 'finance' && <FinanceTab />}

      <TurnBar
        stats={[
          { label: t('Месяц'), value: `${state.history.length + 1} · ${dateLabel(state.week)}` },
          { label: t('Маркетинг'), value: t('{0}/мес', [compactMoney(budget)]) },
          { label: 'Burn', value: compactMoney(Math.max(0, burn)) },
          { label: 'Runway', value: months(runway) },
        ]}
        note={t('Перед завершением месяца проверьте бюджеты, очередь разработки и эксперименты.')}
      >
        <Button variant="primary" size="lg" iconRight="arrowRight" onClick={() => dispatch({ type: 'run_month' })}>
          {t('Завершить месяц')}
        </Button>
      </TurnBar>
    </div>
  );
}
