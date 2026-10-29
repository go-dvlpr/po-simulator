import { useEffect, useRef, useState } from 'react';
import { scenarioOf } from '../../engine/catalog.ts';
import { missingCompliance } from '../../engine/market.ts';
import { mustFeatures } from '../../engine/product.ts';
import type { GameState } from '../../engine/types.ts';
import { useGame } from '../context.ts';
import { PHASES } from '../navigation.ts';
import { Icon } from './Icon.tsx';
import { Button, Progress } from './common.tsx';
import { t } from '../../i18n/index.ts';

interface Step {
  title: string;
  hint?: string;
  done: boolean;
  section?: string;
}

// Recommended steps for the current phase. They tick themselves from the game state.
function stepsFor(s: GameState): Step[] {
  const tested = (kind: string) => s.hypotheses.some((h) => h.kind === kind && h.status !== 'untested');
  const devs = s.team.filter((m) => m.role === 'developer').length;
  switch (s.phase) {
    case 'discovery':
      return [
        { title: t('Сформулировать гипотезу о проблеме'), hint: t('С метрикой и порогом до исследования'), done: s.hypotheses.some((h) => h.kind === 'problem'), section: 'board' },
        { title: t('Проверить остроту проблемы'), hint: t('Интервью без наводящих вопросов или опрос'), done: tested('problem'), section: 'board' },
        { title: t('Проверить готовность платить'), hint: t('Smoke-тест или консьерж-MVP: люди платят делом, а не словами'), done: tested('wtp'), section: 'board' },
        { title: t('Изучить рынок и конкурентов'), done: s.knowledge.competitorsKnown || Object.keys(s.knowledge.marketSize).length > 0, section: 'board' },
        { title: t('Сравнить хотя бы два сегмента'), done: new Set(s.reports.map((r) => r.params.segmentId).filter(Boolean)).size >= 2, section: 'segments' },
        { title: t('Заранее начать найм разработчиков'), hint: t('Найм занимает 3–6 недель'), done: devs > 0, section: 'team' },
      ];
    case 'setup':
      return [
        { title: t('Подключить продуктовую аналитику'), hint: t('Без неё после запуска не видно воронки и когорт'), done: s.tech.analytics !== 'none', section: 'tech' },
        { title: t('Подготовить инфраструктуру A/B-тестов'), done: s.tech.experiments !== 'none', section: 'tech' },
        { title: t('Нанять минимум двух разработчиков'), done: devs >= 2, section: 'team' },
        { title: t('Позаботиться о качестве'), hint: t('QA-инженер или автотесты'), done: s.team.some((m) => m.role === 'qa') || s.tech.practices.includes('autotests'), section: 'team' },
      ];
    case 'build': {
      const musts = mustFeatures(scenarioOf(s), s.strategy?.segmentId ?? '');
      return [
        { title: t('Довести обязательные функции'), done: musts.every((id) => s.product.features[id]?.completed), section: 'scope' },
        { title: t('Держать открытые баги ниже 20'), done: s.product.bugs < 20, section: 'sprint' },
        { title: t('Выделять часть спринта на техдолг'), done: s.allocation.debt >= 0.1, section: 'sprint' },
        { title: t('Не жить в постоянных овертаймах'), done: !s.overtime, section: 'sprint' },
      ];
    }
    case 'growth':
      return [
        { title: t('Задать бюджет 1–2 рекламным каналам'), done: Object.values(s.marketing.budgets).some((b) => b > 0), section: 'marketing' },
        { title: t('Завершить первый месяц и посмотреть воронку'), done: s.history.length > 0, section: 'overview' },
        { title: t('Поставить цели квартала (OKR)'), hint: t('Совет проверит их на ближайшей встрече'), done: s.okrs.length > 0, section: 'overview' },
        { title: t('Замерить PMF опросом Шона Эллиса'), done: s.growthResearch.some((g) => g.kind === 'pmf'), section: 'analytics' },
        { title: t('Поговорить с ушедшими клиентами'), done: s.growthResearch.some((g) => g.kind === 'churn'), section: 'analytics' },
        { title: t('Запустить первый A/B-тест'), done: s.experiments.some((e) => !e.featureId), section: 'experiments' },
        { title: t('Выпускать функции за фича-флагом'), hint: t('Чтобы знать эффект каждой функции'), done: s.releaseWithAb, section: 'product' },
        { title: t('Закрыть обязательную регуляторику'), hint: t('Защита данных, аудит безопасности'), done: missingCompliance(s).length === 0, section: 'competition' },
        { title: t('Включить повторные списания (dunning)'), hint: t('Возвращают клиентов с неудачной оплатой'), done: s.pricing.dunning, section: 'money' },
      ];
    default:
      return [];
  }
}

// The checklist lives in the top bar: a compact button that opens a panel.
// It opens by itself once per phase while nothing is done yet.
export function GuideMenu() {
  const { state, setSection } = useGame();
  const steps = stepsFor(state);
  const done = steps.filter((s) => s.done).length;
  const [open, setOpen] = useState(false);
  const shown = useRef(new Set<string>());
  const ref = useRef<HTMLDivElement>(null);

  // Opens by itself once per phase, but never over an event the player has to answer.
  const blocked = state.pendingEvents.length > 0;
  useEffect(() => {
    if (blocked || steps.length === 0 || shown.current.has(state.phase)) return;
    shown.current.add(state.phase);
    if (done === 0) setOpen(true);
  }, [state.phase, steps.length, done, blocked]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (steps.length === 0) return null;
  const phase = PHASES.find((p) => p.id === state.phase);
  const complete = done === steps.length;

  return (
    <div className="guide-menu" ref={ref}>
      <button type="button" className={`guide-trigger ${complete ? 'complete' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name={complete ? 'checkCircle' : 'map'} size={15} />
        <span className="guide-trigger-label">{t('Гид этапа')}</span>
        <span className="guide-count num">
          {done}/{steps.length}
        </span>
      </button>
      {open && (
        <div className="guide-panel" role="dialog" aria-label={t('Гид этапа «{0}»', [phase?.label])}>
          <div className="guide-panel-head">
            <div>
              <div className="card-title">{t('Что сделать на этапе «{0}»', [phase?.label ?? ''])}</div>
              <div className="card-desc">{t('Рекомендованные шаги. Галочки ставятся сами, когда шаг сделан')}</div>
            </div>
            <Button variant="ghost" size="sm" icon="x" onClick={() => setOpen(false)} aria-label={t('Закрыть гид')} />
          </div>
          <Progress value={done} max={steps.length} tone={complete ? 'success' : 'info'} />
          <div className="guide-steps">
            {steps.map((step) => (
              <div key={step.title} className={`guide-step ${step.done ? 'done' : ''}`}>
                <span className="guide-check">{step.done && <Icon name="check" size={11} strokeWidth={3} />}</span>
                <span className="grow">
                  <span className="guide-title">{step.title}</span>
                  {step.hint && <span className="guide-hint">{step.hint}</span>}
                </span>
                {!step.done && step.section && (
                  <Button
                    size="sm"
                    variant="ghost"
                    iconRight="arrowRight"
                    onClick={() => {
                      setSection(step.section ?? '');
                      setOpen(false);
                    }}
                  >
                    {t('Открыть')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
