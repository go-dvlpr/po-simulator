import { useState } from 'react';
import { SCENARIO_ORDER, SCENARIOS } from '../../data/scenarios/index.ts';
import { DIFFICULTY } from '../../engine/catalog.ts';
import type { Difficulty, GameState, ScenarioId } from '../../engine/types.ts';
import { newGame } from '../../engine/world.ts';
import { compactMoney, pct } from '../../format.ts';
import { Icon } from '../components/Icon.tsx';
import type { IconName } from '../components/Icon.tsx';
import { Hint } from '../components/Hint.tsx';
import { LanguageSelect } from '../components/LanguageSelect.tsx';
import { JourneyMap } from '../components/JourneyMap.tsx';
import { ScenarioArt } from '../components/ScenarioArt.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';
import { Badge, Button, Segmented } from '../components/common.tsx';
import { loadHistory } from '../history.ts';
import { intlLocale, t } from '../../i18n/index.ts';

const STEPS: { title: string; text: string; icon: IconName }[] = [
  { title: t('Исследование'), text: t('Гипотезы с критериями, интервью, опросы, smoke-тесты, консьерж-MVP'), icon: 'flask' },
  { title: t('Стратегия'), text: t('Сегмент, ценностное предложение, North Star, монетизация'), icon: 'target' },
  { title: t('Подготовка'), text: t('Объём MVP, технологии, найм, обещанный срок'), icon: 'layers' },
  { title: t('Разработка'), text: t('Спринты, velocity, техдолг, баги и неожиданности'), icon: 'code' },
  { title: t('Запуск'), text: t('Бета, чек-лист и стратегия выхода на рынок'), icon: 'rocket' },
  { title: t('Рост'), text: t('Каналы, A/B-тесты, когорты, юнит-экономика, совет'), icon: 'trending' },
];

const SCENARIO_META: Record<ScenarioId, { icon: IconName; color: string }> = {
  b2c: { icon: 'heart', color: 'linear-gradient(135deg, #f43f5e, #f59e0b)' },
  b2b: { icon: 'calendar', color: 'linear-gradient(135deg, #6366f1, #0ea5e9)' },
  edtech: { icon: 'book', color: 'linear-gradient(135deg, #10b981, #0ea5e9)' },
  fintech: { icon: 'wallet', color: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
  devtool: { icon: 'code', color: 'linear-gradient(135deg, #0f172a, #6366f1)' },
};

export function NewGameScreen(props: { onStart: (s: GameState) => void }) {
  const [scenario, setScenario] = useState<ScenarioId>('b2c');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const sc = SCENARIOS[scenario];
  const targets = sc.targets[difficulty];
  const [played] = useState(() => [...loadHistory()].reverse());

  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-head">
          <div className="sb-logo">
            <Icon name="sparkles" size={18} />
          </div>
          <strong>Product Owner Simulator</strong>
          <Badge tone="accent">{t('тренажёр')}</Badge>
          <div className="landing-tools">
            <LanguageSelect compact />
            <ThemeToggle className="btn btn-ghost btn-sm" />
          </div>
        </div>

        <div className="stack">
          <h1 className="landing-title">{t('Проведите IT-продукт от идеи до раунда инвестиций')}</h1>
          <p className="landing-lead">
            {t('Рынок в каждой игре свой. Какой сегмент лучший, сколько люди готовы платить и какие функции им нужны — скрыто. Узнать это можно только исследованиями и экспериментами, как в реальном продукте.')}
          </p>
        </div>

        <section className="stack">
          <div className="eyebrow">{t('1 · Выберите продукт')}</div>
          <div className="scenario-grid">
            {SCENARIO_ORDER.map((id) => {
              const s = SCENARIOS[id];
              const meta = SCENARIO_META[id];
              return (
                <button key={id} type="button" role="radio" aria-checked={scenario === id} className={`scenario ${scenario === id ? 'selected' : ''}`} onClick={() => setScenario(id)}>
                  <div className="scenario-art-wrap">
                    <ScenarioArt id={id} />
                    <span className="scenario-kind">{s.kind === 'b2c' ? 'B2C' : 'B2B'}</span>
                  </div>
                  <div className="scenario-body">
                    <div className="row">
                      <span className="medal sm" style={{ background: meta.color }}>
                        <Icon name={meta.icon} size={14} />
                      </span>
                      <div className="option-title">{s.productName}</div>
                    </div>
                    <div className="text-sm text-muted">{s.title.split(' — ')[1]}</div>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {s.facts.map((f) => (
                        <Badge key={f} outline>
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="card">
            <div className="card-body stack-sm">
              <div className="eyebrow">{t('О проекте · {0}', [sc.tagline])}</div>
              {sc.intro.map((p) => (
                <p key={p} className="text-sm text-2">
                  {p}
                </p>
              ))}
              <p className="text-xs text-muted">{t('Обстановка на рынке и характер CEO выпадают случайно в каждой партии.')}</p>
            </div>
          </div>
        </section>

        <section className="grid cols-2">
          <div className="card">
            <div className="card-body stack">
              <div className="eyebrow">{t('2 · Сложность')}</div>
              <Segmented
                options={(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => ({ id: d, label: DIFFICULTY[d].name }))}
                value={difficulty}
                onChange={setDifficulty}
              />
              <p className="text-sm text-2">{DIFFICULTY[difficulty].description}</p>
              <dl className="kv">
                <dt>{t('Стартовый капитал')}</dt>
                <dd>{compactMoney(sc.startCash[difficulty])}</dd>
                <dt>{t('Срок до решения инвесторов')}</dt>
                <dd>{t('18 месяцев')}</dd>
                <dt>{t('Длительность партии')}</dt>
                <dd>{t('40–90 минут')}</dd>
              </dl>
            </div>
          </div>
          <div className="card">
            <div className="card-body stack">
              <div className="eyebrow">{t('3 · Цель — раунд A')}</div>
              <div className="grid cols-2" style={{ gap: 10 }}>
                <div className="kpi inset sm">
                  <div className="kpi-label">
                    MRR
                    <Hint term="mrr" />
                  </div>
                  <div className="kpi-value">≥ {compactMoney(targets.mrr)}</div>
                </div>
                <div className="kpi inset sm">
                  <div className="kpi-label">
                    LTV / CAC
                    <Hint term="ltvCac" />
                  </div>
                  <div className="kpi-value">≥ {targets.ltvCac}</div>
                </div>
                <div className="kpi inset sm">
                  <div className="kpi-label">
                    {t('Рост MRR в месяц')}
                    <Hint title={t('Рост MRR')} text={t('Средний рост выручки за последние три месяца. Инвесторы смотрят не только на размер, но и на скорость роста.')} />
                  </div>
                  <div className="kpi-value">≥ {pct(targets.growth, 0)}</div>
                </div>
                <div className="kpi inset sm">
                  <div className="kpi-label">
                    {t('PMF (Шон Эллис)')}
                    <Hint term="pmf" />
                  </div>
                  <div className="kpi-value">≥ {pct(targets.pmf, 0)}</div>
                </div>
              </div>
              <p className="text-xs text-muted">
                {t('Все 4 критерия — раунд A. Хотя бы 2 и MRR не ниже 40% цели — бридж. Деньги кончились или доверие упало до нуля — поражение.')}
              </p>
            </div>
          </div>
        </section>

        <section className="stack">
          <div className="eyebrow">{t('Как устроена игра')}</div>
          <div className="card journey-card">
            <JourneyMap current={0} details={STEPS.map((step) => step.text)} />
          </div>
        </section>

        {played.length > 0 && (
          <section className="stack">
            <div className="eyebrow">{t('Ваши партии · лучший результат {0}', [Math.max(...played.map((g) => g.score))])}</div>
            <div className="card">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Дата')}</th>
                      <th>{t('Продукт')}</th>
                      <th>{t('Итог')}</th>
                      <th className="num">{t('Баллы')}</th>
                      <th>{t('Главная ошибка')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {played.slice(0, 8).map((g) => (
                      <tr key={g.id}>
                        <td className="nowrap">{new Date(g.date).toLocaleDateString(intlLocale)}</td>
                        <td className="nowrap">
                          {SCENARIOS[g.scenarioId].productName} · {DIFFICULTY[g.difficulty].name}
                        </td>
                        <td>
                          <Badge tone={g.ending === 'seriesA' ? 'success' : g.ending === 'bridge' ? 'warning' : 'danger'}>{g.endingTitle}</Badge>
                        </td>
                        <td className="num text-strong">{g.score}</td>
                        <td className="text-sm text-2">{g.mistakes[0] ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <div className="card">
          <div className="card-body row-between wrap">
            <div className="row gap-lg wrap">
              <div className="stack-xs">
                <span className="text-strong">{sc.productName}</span>
                <span className="text-xs text-muted">
                  {DIFFICULTY[difficulty].name} · {compactMoney(sc.startCash[difficulty])}
                </span>
              </div>
              <label className="field" style={{ width: 170 }}>
                <span className="field-hint row" style={{ gap: 0 }}>
                  {t('Зерно мира')}
                  <Hint title={t('Зерно мира')} text={t('Одинаковое зерно — одинаковый рынок. Так можно переиграть ту же партию или сравнить решения с коллегой.')} />
                </span>
                <input className="input input-sm" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
              </label>
            </div>
            <Button variant="primary" size="lg" iconRight="arrowRight" onClick={() => props.onStart(newGame(scenario, difficulty, seed))}>
              {t('Начать игру')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
