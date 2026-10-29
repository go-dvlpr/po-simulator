import { scenarioOf } from '../engine/catalog.ts';
import { eventDef } from '../engine/events.ts';
import type { GameState, LogEntry } from '../engine/types.ts';
import { Icon } from './components/Icon.tsx';
import type { IconName } from './components/Icon.tsx';
import { Badge, Button, Modal } from './components/common.tsx';
import type { SceneKind } from './components/EventScene.tsx';
import { EventScene } from './components/EventScene.tsx';
import { useGame } from './context.ts';
import { t } from '../i18n/index.ts';

interface Speaker {
  name: string;
  role: string;
  icon: IconName;
  color: string;
  scene: SceneKind;
}

const GROUPS: Record<string, string[]> = {
  ceo: ['d_ceo_impatient', 'd_ceo_idea', 'd_friends', 'b_scope_creep', 'g_ceo_pet', 'q_cash_vs_mrr', 'q_pvalue'],
  board: ['d_investor_check', 'q_retention_drop', 'g_bridge_offer', 'g_cash_crunch', 'g_acquihire', 'board_meeting'],
  research: ['d_noshow'],
  team: ['b_senior_offer', 'b_estimate_wrong', 'b_redesign', 'b_conflict', 'b_microservices', 'b_burnout', 'b_freelancer_gone', 'g_morale_low', 'g_debt_crisis'],
  market: ['competitor_raise', 'g_competitor_price', 'g_ad_ban'],
  growth: ['g_influencer', 'g_press', 'g_big_client', 'g_sales_promise', 'g_featuring', 'g_partnership'],
};

function speakerOf(state: GameState, eventId: string): Speaker {
  const group = Object.keys(GROUPS).find((g) => GROUPS[g].includes(eventId)) ?? 'ops';
  switch (group) {
    case 'ceo':
      return { name: scenarioOf(state).ceoName, role: t('CEO и основатель'), icon: 'building', color: '#6366f1', scene: 'board' };
    case 'board':
      return { name: t('Совет директоров'), role: 'Northwind Ventures', icon: 'briefcase', color: '#0ea5e9', scene: 'board' };
    case 'team':
      return { name: t('Команда'), role: t('Разработка и дизайн'), icon: 'users', color: '#14b8a6', scene: 'office' };
    case 'research':
      return { name: t('Исследования'), role: t('Интервью и рекрутинг респондентов'), icon: 'message', color: '#10b981', scene: 'office' };
    case 'market':
      return { name: t('Рынок'), role: t('Конкуренты и платформы'), icon: 'globe', color: '#f59e0b', scene: 'market' };
    case 'growth':
      return { name: t('Возможность роста'), role: t('Партнёры, медиа, клиенты'), icon: 'megaphone', color: '#8b5cf6', scene: 'market' };
    default:
      return { name: t('Инцидент'), role: t('Качество, безопасность, данные'), icon: 'alert', color: '#f43f5e', scene: 'office' };
  }
}

function SpeakerHeader(props: { speaker: Speaker; meta?: string }) {
  return (
    <div className="speaker">
      <div className="avatar" style={{ background: props.speaker.color }}>
        <Icon name={props.speaker.icon} size={20} />
      </div>
      <div className="grow">
        <div className="speaker-name">{props.speaker.name}</div>
        <div className="speaker-role">{props.speaker.role}</div>
      </div>
      {props.meta && <Badge outline>{props.meta}</Badge>}
    </div>
  );
}

export function EventDialog(props: { outcome: LogEntry | null; onResolve: () => void; onCloseOutcome: () => void }) {
  const { state, dispatch } = useGame();

  if (props.outcome) {
    const e = props.outcome;
    const tone = e.tone === 'good' ? 'good' : e.tone === 'bad' ? 'bad' : 'neutral';
    return (
      <Modal
        footer={
          <Button variant="primary" iconRight="arrowRight" onClick={props.onCloseOutcome} autoFocus>
            {state.pendingEvents.length > 0 ? t('Следующее событие') : t('Продолжить')}
          </Button>
        }
      >
        <div className="stack">
          <div className="row-top gap-lg">
            <div className={`outcome-icon ${tone}`}>
              <Icon name={tone === 'good' ? 'checkCircle' : tone === 'bad' ? 'alert' : 'info'} size={24} />
            </div>
            <div className="stack-xs grow">
              <span className="eyebrow">{t('Итог решения')}</span>
              <h2 className="modal-title">{e.title}</h2>
            </div>
          </div>
          <p className="text-lg text-2">{e.text}</p>
          {e.points !== undefined && e.points !== 0 && (
            <div className="row">
              <Badge tone={e.points > 0 ? 'success' : 'danger'}>
                {t('{0} {1} к оценке решений', [e.points > 0 ? '+' : '', e.points])}
              </Badge>
              <span className="text-xs text-muted">{t('Запись сохранена в журнале решений')}</span>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  const pending = state.pendingEvents[0];
  if (!pending) return null;
  const def = eventDef(pending.eventId);
  const data = pending.data ?? {};
  const queued = state.pendingEvents.length - 1;
  const speaker = speakerOf(state, def.id);

  return (
    <Modal size="lg" header={<SpeakerHeader speaker={speaker} meta={queued > 0 ? t('ещё {0} в очереди', [queued]) : undefined} />}>
      <div className="event-scene-wrap">
        <EventScene kind={speaker.scene} accent={speaker.color} />
      </div>
      <h2 className="modal-title">{def.title}</h2>
      <div className="message">{def.text(state, data)}</div>
      <div className="eyebrow mt-md">{t('Ваше решение')}</div>
      <div className="choice-cards">
        {def.options.map((o, i) => {
          const available = o.available ? o.available(state, data) : true;
          return (
            <button
              key={i}
              type="button"
              className="choice-card"
              disabled={!available}
              onClick={() => {
                props.onResolve();
                dispatch({ type: 'resolve_event', option: i });
              }}
            >
              <span className="choice-card-key">{String.fromCharCode(65 + i)}</span>
              <span className="choice-card-label">{o.label}</span>
              {o.hint && <span className="choice-card-hint">{available ? o.hint : t('Недоступно: {0}', [o.hint.toLowerCase()])}</span>}
              <span className="choice-card-cta">
                {available ? t('Выбрать') : t('Недоступно')}
                {available && <Icon name="arrowRight" size={14} />}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
