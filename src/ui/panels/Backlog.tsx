import { capabilities, featureDef, scenarioOf } from '../../engine/catalog.ts';
import { featureEffort, featureEstimate, targetSegmentId } from '../../engine/product.ts';
import type { GameState } from '../../engine/types.ts';
import { money } from '../../format.ts';
import { Badge, Button, Progress } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { Hint } from '../components/Hint.tsx';
import { t } from '../../i18n/index.ts';

export interface FeatureInsight {
  impact: number | null;
  confidence: number;
  ease: number;
  ice: number | null;
}

// What the player knows about a feature: research-based value and team estimate.
export function featureInsight(s: GameState, featureId: string): FeatureInsight {
  const signal = s.knowledge.featureSignals[targetSegmentId(s)]?.[featureId];
  const est = signal && signal.weight > 0 ? signal.sum / signal.weight : null;
  const impact = est === null ? null : Math.max(1, Math.min(10, Math.round(est * 7)));
  const confidence = Math.min(10, Math.round(2 + (signal?.weight ?? 0) * 2));
  const ease = Math.max(1, Math.min(10, Math.round(10 - featureEstimate(s, featureId) / 4)));
  return { impact, confidence, ease, ice: impact === null ? null : impact * confidence * ease };
}

function competitorCount(s: GameState, featureId: string): number | null {
  if (!s.knowledge.competitorsKnown) return null;
  return scenarioOf(s).competitors.filter((c) => c.features.includes(featureId)).length;
}

function Score(props: { value: number | null; tone: 'success' | 'info' }) {
  if (props.value === null) return <span className="text-muted">?</span>;
  return (
    <div className="row" style={{ minWidth: 90 }}>
      <span className="num text-sm" style={{ width: 16 }}>
        {props.value}
      </span>
      <div className="grow">
        <Progress value={props.value} max={10} tone={props.tone} />
      </div>
    </div>
  );
}

export function BacklogTable(props: { ids: string[]; mode: 'scope' | 'queue'; selected?: string[]; onToggle?: (id: string) => void; onMove?: (id: string, to: number) => void }) {
  const { state } = useGame();
  const sc = scenarioOf(state);
  const caps = capabilities(state);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {props.mode === 'scope' && <th style={{ width: 40 }} />}
            {props.mode === 'queue' && <th style={{ width: 40 }}>#</th>}
            <th>{t('Функция')}</th>
            <th className="num">
              {t('Оценка')}
              <Hint term="estimate" />
            </th>
            <th>
              Impact
              <Hint term="impact" />
            </th>
            <th>
              Confidence
              <Hint term="confidence" />
            </th>
            <th className="num">
              ICE
              <Hint term="ice" />
            </th>
            <th className="num">
              {t('Конкуренты')}
              <Hint title={t('Конкуренты')} text={t('У скольких конкурентов есть такая функция. Если у всех — скорее всего, это обязательная функция рынка. Видно после анализа конкурентов.')} />
            </th>
            {props.mode === 'queue' && <th />}
          </tr>
        </thead>
        <tbody>
          {props.ids.map((id, index) => {
            const def = featureDef(sc, id);
            const ins = featureInsight(state, id);
            const comp = competitorCount(state, id);
            const progress = state.product.features[id];
            const missingCap = def.requires?.find((c) => !caps.has(c));
            const inProgress = progress && progress.done > 0 && !progress.completed;
            const selected = props.selected?.includes(id) ?? false;
            const rowCls = missingCap ? 'is-disabled' : selected ? 'is-selected' : '';
            return (
              <tr key={id} className={rowCls}>
                {props.mode === 'scope' && (
                  <td>
                    <input type="checkbox" className="check" checked={selected} disabled={!!missingCap || progress?.completed} onChange={() => props.onToggle?.(id)} aria-label={def.name} />
                  </td>
                )}
                {props.mode === 'queue' && <td className="text-muted num">{index + 1}</td>}
                <td style={{ minWidth: 260 }}>
                  <div className="table-title">{def.name}</div>
                  <div className="table-sub">{def.description}</div>
                  {(missingCap || def.monthlyCost || def.perUserCost || def.enablesRevenue || def.enablesChannel || inProgress || progress?.completed) && (
                    <div className="row wrap mt-sm">
                      {missingCap && <Badge tone="danger">{t('недоступно на вашей платформе')}</Badge>}
                      {def.monthlyCost && <Badge tone="warning">{t('+{0}/мес', [money(def.monthlyCost)])}</Badge>}
                      {def.perUserCost && <Badge tone="warning">{t('затраты на пользователя')}</Badge>}
                      {def.enablesRevenue && <Badge tone="accent">{t('нужна для выручки')}</Badge>}
                      {def.enablesChannel && <Badge tone="info">{t('открывает канал')}</Badge>}
                      {inProgress && <Badge tone="info">{t('в работе {0}%', [Math.round((progress.done / featureEffort(state, id)) * 100)])}</Badge>}
                      {progress?.completed && <Badge tone="success">{t('готово')}</Badge>}
                    </div>
                  )}
                </td>
                <td className="num">{featureEstimate(state, id)} SP</td>
                <td>
                  <Score value={ins.impact} tone="success" />
                </td>
                <td>
                  <Score value={ins.confidence} tone="info" />
                </td>
                <td className="num">{ins.ice === null ? <span className="text-muted">?</span> : <strong>{ins.ice}</strong>}</td>
                <td className="num text-sm">{comp === null ? <span className="text-muted">?</span> : t('{0} из {1}', [comp, sc.competitors.length])}</td>
                {props.mode === 'queue' && (
                  <td className="nowrap">
                    <div className="row">
                      <Button variant="ghost" size="sm" icon="arrowTop" disabled={index === 0} onClick={() => props.onMove?.(id, 0)} aria-label={t('В начало очереди')} title={t('В начало очереди')} />
                      <Button variant="ghost" size="sm" icon="arrowUp" disabled={index === 0} onClick={() => props.onMove?.(id, index - 1)} aria-label={t('Выше')} />
                      <Button variant="ghost" size="sm" icon="arrowDown" disabled={index === props.ids.length - 1} onClick={() => props.onMove?.(id, index + 1)} aria-label={t('Ниже')} />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
