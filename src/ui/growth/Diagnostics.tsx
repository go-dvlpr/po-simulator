import { DEADLINE_WEEKS, scenarioOf } from '../../engine/catalog.ts';
import { COMPLIANCE } from '../../data/compliance.ts';
import { estimatedBurn } from '../../engine/growth.ts';
import { competitivePressure, missingCompliance } from '../../engine/market.ts';
import { mrrGrowth } from '../../engine/metrics.ts';
import { seriesACriteria } from '../../engine/scoring.ts';
import { STAKEHOLDERS, stakeholderIds } from '../../engine/stakeholders.ts';
import type { BenchmarkKey, GameState } from '../../engine/types.ts';
import { compactMoney, fixed, pct } from '../../format.ts';
import { benchmarkRange } from '../benchmarks.ts';
import { Hint } from '../components/Hint.tsx';
import type { IconName } from '../components/Icon.tsx';
import { Icon } from '../components/Icon.tsx';
import { Card } from '../components/common.tsx';
import { useGame } from '../context.ts';
import type { GlossaryId } from '../glossary.ts';
import { t } from '../../i18n/index.ts';

interface Advice {
  tone: 'bad' | 'warning' | 'good' | 'info';
  title: string;
  text: string;
  section?: string;
  term?: GlossaryId;
}

const STEPS: { key: BenchmarkKey; label: string; term: GlossaryId; fix: string; section: string }[] = [
  { key: 'registrationRate', label: t('Регистрация'), term: 'registration', fix: t('Упростите вход в продукт: тесты регистрации в один тап, страница в сторе или лендинг, понятная цена.'), section: 'experiments' },
  { key: 'activationRate', label: t('Активация'), term: 'activation', fix: t('Люди не доходят до первой ценности. Закажите юзабилити-тест, тестируйте онбординг, поднимите в очереди функции для первого результата.'), section: 'analytics' },
  { key: 'conversionRate', label: t('Конверсия в оплату'), term: 'conversion', fix: t('Проверьте цену и пейволл: тесты пейволла и тарифов, отзывы, понятные условия. Цену меняйте только через тест.'), section: 'experiments' },
  { key: 'retentionM1', label: t('Удержание 30-го дня'), term: 'retention', fix: t('Пользователи уходят после первого месяца. Поговорите с ушедшими, включите напоминания и CRM, усиливайте ценность.'), section: 'analytics' },
  { key: 'churnRate', label: t('Отток платящих'), term: 'churn', fix: t('Платящие уходят быстрее нормы. Интервью с ушедшими покажут причину: цена, баги или мало ценности.'), section: 'analytics' },
];

const ICONS: Record<Advice['tone'], IconName> = { bad: 'alert', warning: 'alert', good: 'checkCircle', info: 'info' };

// A few prioritized hints from the numbers, like a mentor would give.
export function adviceFor(state: GameState): Advice[] {
  const sc = scenarioOf(state);
  const last = state.history[state.history.length - 1];
  if (!last) return [];
  const out: Advice[] = [];

  let worst: { step: (typeof STEPS)[number]; gap: number; value: number } | null = null;
  for (const step of STEPS) {
    const b = sc.benchmarks[step.key];
    const value = last.obs[step.key];
    if (!b || value === null) continue;
    const gap = b.better === 'up' ? (b.low - value) / b.low : (value - b.high) / b.high;
    if (gap > 0 && (!worst || gap > worst.gap)) worst = { step, gap, value };
  }
  if (worst) {
    out.push({ tone: 'bad', title: t('Слабое место воронки: {0} {1} при норме {2}', [worst.step.label.toLowerCase(), pct(worst.value), benchmarkRange(state, worst.step.key)]), text: worst.step.fix, section: worst.step.section, term: worst.step.term });
  } else if (last.obs.activationRate !== null) {
    out.push({ tone: 'good', title: t('Все шаги воронки в норме рынка'), text: t('Можно сосредоточиться на росте: каналы, цена и масштабирование того, что работает.') });
  }

  const missing = missingCompliance(state);
  if (missing.length > 0) {
    const names = COMPLIANCE.filter((c) => missing.includes(c.id)).map((c) => c.name.split(':')[0]);
    out.push({ tone: 'bad', title: t('Не закрыта регуляторика: {0}', [names.join(', ')]), text: t('Пока этого нет, возможны штрафы, снятие из стора или потерянные сделки. Обычно это дешевле, чем последствия.'), section: 'competition', term: 'compliance' });
  }

  const burn = estimatedBurn(state);
  const runway = burn > 0 ? state.cash / burn : Infinity;
  const ltvCac = last.obs.ltvCac;
  if (ltvCac !== null) {
    if (ltvCac < 1) {
      const priciest = sc.channels
        .filter((c) => c.kind === 'paid' && (last.spend[c.id] ?? 0) > 0 && (last.payingBy[c.id] ?? 0) > 0)
        .map((c) => ({ name: c.name.split(' (')[0], cac: (last.spend[c.id] ?? 0) / (last.payingBy[c.id] ?? 1) }))
        .sort((a, b) => b.cac - a.cac)[0];
      const channelHint = priciest ? t(' Самый дорогой канал — {0}: около {1} за платящего.', [priciest.name, compactMoney(priciest.cac)]) : '';
      out.push({
        tone: 'bad',
        title: t('Каждый новый клиент убыточен: LTV {0} при CAC {1}', [compactMoney(last.obs.ltv), compactMoney(last.obs.cacBlended)]),
        text: t('Не увеличивайте рекламу — она сжигает деньги.{0} Снижайте CAC (дешевле каналы, органика) или повышайте LTV: удержание, годовой план, тариф Pro, цена через A/B-тест.', [channelHint]),
        section: 'marketing',
        term: 'ltvCac',
      });
    } else if (ltvCac < 2.5) {
      out.push({ tone: 'warning', title: t('Экономика на грани: LTV / CAC = {0}', [fixed(ltvCac, 1)]), text: t('Растите бюджет осторожно и следите за CAC. Параллельно улучшайте самый слабый шаг воронки.'), section: 'marketing', term: 'ltvCac' });
    } else if (runway >= 6) {
      out.push({ tone: 'good', title: t('Экономика позволяет масштабироваться: LTV / CAC = {0}', [fixed(ltvCac, 1)]), text: t('Увеличивайте бюджет каналов постепенно, на 20–30% в месяц, и следите, чтобы CAC не рос быстрее LTV. Помните про убывающую отдачу каналов.'), section: 'marketing', term: 'ltvCac' });
    }
  }

  if (runway < 6) {
    out.push({ tone: 'bad', title: t('Денег на {0} мес.', [fixed(runway, 1)]), text: t('Сократите расходы, которые не дают роста, или рассмотрите бридж-раунд, пока runway не стал критичным.'), section: 'finance', term: 'runway' });
  }

  const target = seriesACriteria(state).find((c) => c.id === 'mrr');
  const monthsLeft = Math.floor((DEADLINE_WEEKS - state.week) / 4);
  if (target && last.mrr < target.target && monthsLeft > 0) {
    const need = (target.target / Math.max(last.mrr, 1)) ** (1 / monthsLeft) - 1;
    const now = mrrGrowth(state, Math.min(3, state.history.length - 1));
    out.push({
      tone: now !== null && now >= need ? 'info' : 'warning',
      title: t('Темп до цели: +{0} MRR в месяц', [pct(need, 0)]),
      text: t('Чтобы дойти до {0} за {1} мес., MRR должен расти на {2} в месяц. Сейчас {3}.', [compactMoney(target.target), monthsLeft, pct(need, 0), now === null ? t('рост ещё не измерить') : t('{0} в месяц', [pct(now, 0)])]),
      term: 'mrr',
    });
  }

  if (last.support && last.support.tickets > last.support.capacity) {
    out.push({ tone: 'warning', title: t('Поддержка не успевает: CSAT {0}', [pct(last.support.csat, 0)]), text: t('Обращений больше, чем команда может обработать. Клиенты ждут и уходят. Наймите специалиста поддержки или выделите время на баги.'), section: 'team', term: 'supportLoad' });
  }
  const upset = stakeholderIds(state).filter((id) => state.stakeholders[id] < 30);
  if (upset.length > 0) {
    out.push({ tone: 'warning', title: t('Испорчены отношения: {0}', [upset.map((id) => STAKEHOLDERS[id].name).join(', ')]), text: t('Эта область работает хуже. Посмотрите, что важно этим людям, и учтите это в ближайших решениях.'), section: 'stakeholders', term: 'stakeholders' });
  }
  if (!state.pricing.dunning && (last.involuntary ?? 0) >= (sc.kind === 'b2b' ? 1 : 5)) {
    out.push({ tone: 'info', title: t('Подписки теряются из-за неудачных платежей'), text: t('Включите повторные списания (dunning) в разделе «Монетизация»: они возвращают большую часть таких клиентов.'), section: 'money', term: 'dunning' });
  }
  const pressure = competitivePressure(state);
  if (pressure > 0.5) {
    out.push({ tone: 'warning', title: t('Сильное давление конкурентов: {0}', [pct(pressure, 0)]), text: t('Конверсия ниже, реклама дороже. Помогают уникальные функции, которых нет у конкурентов, и точный сегмент.'), section: 'competition', term: 'pressure' });
  }

  if (!state.growthResearch.some((g) => g.kind === 'pmf')) {
    out.push({ tone: 'info', title: t('PMF ещё не измерен'), text: t('Это один из критериев раунда A. Закажите опрос Шона Эллиса в разделе «Данные» — он стоит $300.'), section: 'analytics', term: 'pmf' });
  }
  return out.slice(0, 5);
}

export function Diagnostics() {
  const { state, setSection } = useGame();
  const advice = adviceFor(state);
  if (advice.length === 0) return null;
  return (
    <Card title={t('Что улучшить в первую очередь')} help={t('Подсказки по вашим цифрам: самое слабое место воронки, можно ли масштабировать рекламу, хватит ли денег и темпа до цели. Решать всё равно вам.')}>
      <div className="advice-list">
        {advice.map((a) => (
          <div key={a.title} className={`advice ${a.tone}`}>
            <span className={`feed-icon ${a.tone === 'good' ? 'good' : a.tone === 'info' ? 'info' : a.tone === 'warning' ? 'action' : 'bad'}`}>
              <Icon name={ICONS[a.tone]} size={13} />
            </span>
            <div className="grow stack-xs">
              <div className="text-sm text-strong">
                {a.title}
                {a.term && <Hint term={a.term} />}
              </div>
              <div className="text-sm text-2">{a.text}</div>
            </div>
            {a.section && (
              <button type="button" className="link nowrap" onClick={() => setSection(a.section ?? '')}>
                {t('Открыть')}
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
