import { ceoStyle } from '../../data/context.ts';
import { scenarioOf } from '../../engine/catalog.ts';
import { STAKEHOLDERS, stakeholderIds } from '../../engine/stakeholders.ts';
import { Hint } from '../components/Hint.tsx';
import { Icon } from '../components/Icon.tsx';
import { Badge, Callout, Card, Progress } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

function status(v: number): { text: string; tone: 'danger' | 'warning' | 'success' | 'neutral' } {
  if (v < 30) return { text: t('отношения испорчены'), tone: 'danger' };
  if (v < 45) return { text: t('напряжённо'), tone: 'warning' };
  if (v > 75) return { text: t('союзник'), tone: 'success' };
  return { text: t('рабочие отношения'), tone: 'neutral' };
}

export function StakeholdersPanel() {
  const { state } = useGame();
  const sc = scenarioOf(state);
  const ceo = ceoStyle(state.world.ceo);
  const trust = status(state.trust);

  return (
    <>
      <Callout tone="info" title={t('Работа PO — договариваться')} icon="users">
        {t('У каждого руководителя свои цели, и они часто конфликтуют. Отношения меняются от ваших решений: выделили время на техдолг — CTO доволен, урезали бюджет — маркетинг обижен. Ниже 30 отношения портятся, и область работает хуже.')}
      </Callout>
      <div className="grid cols-2">
        <Card title={`CEO ${sc.ceoName}`} term="trust" desc={t('Стиль: {0}', [ceo.title])}>
          <div className="stack-sm">
            <div className="row-between text-sm">
              <span className="text-2">{t('Доверие')}</span>
              <span className="row">
                <strong className="num">{Math.round(state.trust)}</strong>
                <Badge tone={trust.tone}>{trust.text}</Badge>
              </span>
            </div>
            <Progress value={state.trust} tone="auto" />
            <p className="text-sm text-2">{ceo.text}</p>
          </div>
        </Card>
        {stakeholderIds(state).map((id) => {
          const def = STAKEHOLDERS[id];
          const v = state.stakeholders[id];
          const st = status(v);
          return (
            <Card key={id} title={def.name} desc={def.role}>
              <div className="stack-sm">
                <div className="row-between text-sm">
                  <span className="text-2">{t('Отношения')}</span>
                  <span className="row">
                    <strong className="num">{Math.round(v)}</strong>
                    <Badge tone={st.tone}>{st.text}</Badge>
                  </span>
                </div>
                <Progress value={v} tone="auto" />
                <div className="text-sm">
                  <span className="text-muted">{t('Что важно:')}{' '}</span>
                  {def.cares}
                </div>
                <div className="row-top text-xs text-muted">
                  <Icon name="alert" size={12} />
                  <span>
                    {t('Ниже 30: {0}. Выше 75: {1}.', [def.low.toLowerCase(), def.high.toLowerCase()])}
                    <Hint term="stakeholders" />
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
