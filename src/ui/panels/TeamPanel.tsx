import { useState } from 'react';
import { LEVEL_NAMES, ROLES, SOURCES, roleDef, sourceDef } from '../../data/roles.ts';
import { monthlyPayroll, scenarioOf } from '../../engine/catalog.ts';
import { hireCost, skillLabel } from '../../engine/team.ts';
import type { Level, RoleId, Source } from '../../engine/types.ts';
import { compactMoney, money } from '../../format.ts';
import { Badge, Button, Callout, Card, Empty, Field, Kpi, Segmented } from '../components/common.tsx';
import { useGame } from '../context.ts';
import { t } from '../../i18n/index.ts';

const ROLE_COLORS: Record<RoleId, string> = {
  developer: '#6366f1',
  qa: '#14b8a6',
  designer: '#ec4899',
  analyst: '#0ea5e9',
  devops: '#64748b',
  marketer: '#f59e0b',
  support: '#84cc16',
  sales: '#8b5cf6',
};

export function TeamPanel() {
  const { state, dispatch, confirm } = useGame();
  const sc = scenarioOf(state);
  const [role, setRole] = useState<RoleId>('developer');
  const [level, setLevel] = useState<Level>('middle');
  const [source, setSource] = useState<Source>('inhouse');
  const def = roleDef(role);
  const lvl = def.levels.includes(level) ? level : def.levels[0];
  const cost = hireCost(role, lvl, source);
  const src = sourceDef(source);
  const payroll = monthlyPayroll(state, Infinity);
  const devs = state.team.filter((m) => m.role === 'developer').length;

  return (
    <div className="split">
      <div className="stack">
        <div className="kpi-grid">
          <Kpi label={t('В команде')} value={state.team.length} foot={t('из них разработчиков: {0}', [devs])} />
          <Kpi label={t('ФОТ в месяц')} value={compactMoney(payroll)} hint={t('Включая базовые расходы {0}: {1}', [money(sc.baseMonthlyCost), sc.baseCostNote.toLowerCase()])} />
          <Kpi label={t('Ещё не вышли')} value={state.team.filter((m) => m.joinWeek > state.week).length} foot={t('ищем и оформляем')} />
        </div>
        <Card title={t('Команда')} desc={t('Скрытый уровень навыков становится понятен через месяц работы')} bodyClassName="flush">
          {state.team.length === 0 ? (
            <div style={{ padding: '8px 20px 16px' }}>
              <Empty icon="users" title={t('Пока никого')}>
                {t('Без разработчиков продукт не появится. Наймите команду справа.')}
              </Empty>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Сотрудник')}</th>
                    <th>{t('Статус')}</th>
                    <th className="num">{t('Зарплата')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.team.map((m) => {
                    const joined = m.joinWeek <= state.week;
                    const skill = skillLabel(state, m);
                    return (
                      <tr key={m.id}>
                        <td>
                          <div className="row">
                            <span className="avatar sm" style={{ background: ROLE_COLORS[m.role] }}>
                              {m.name[0]}
                            </span>
                            <div>
                              <div className="table-title">{m.name}</div>
                              <div className="table-sub">
                                {roleDef(m.role).name}
                                {m.role === 'developer' ? ` · ${LEVEL_NAMES[m.level]}` : ''} · {sourceDef(m.source).name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {joined ? (
                            <Badge tone={skill === t('сильный') ? 'success' : skill === t('слабый') ? 'danger' : 'neutral'}>{skill === t('ещё не ясно') ? t('адаптация') : skill}</Badge>
                          ) : (
                            <Badge tone="warning" dot>
                              {t('выйдет на нед. {0}', [m.joinWeek + 1])}
                            </Badge>
                          )}
                        </td>
                        <td className="num">{money(m.salary)}</td>
                        <td className="right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              confirm({
                                title: t('Расстаться с {0}?', [m.name]),
                                text: t('{0}Мотивация команды снизится, часть знаний о коде уйдёт.', [m.source === 'inhouse' && joined ? t('Выходное пособие — месячная зарплата. ') : '']),
                                confirmLabel: t('Уволить'),
                                danger: true,
                                onConfirm: () => dispatch({ type: 'fire', memberId: m.id }),
                              })
                            }
                          >
                            {t('Уволить')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="sticky">
        <Card title={t('Нанять')} desc={t('Роль, уровень и способ найма')}>
          <div className="stack">
            <Field label={t('Роль')} hint={def.description}>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value as RoleId)}>
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            {def.levels.length > 1 && (
              <Field label={t('Уровень')} help={t('Senior делает больше и с меньшим числом багов, junior дешевле, но ошибается чаще. Реальный навык человека станет понятен через месяц работы.')}>
                <Segmented options={def.levels.map((l) => ({ id: l, label: LEVEL_NAMES[l] }))} value={lvl} onChange={setLevel} />
              </Field>
            )}
            <Field label={t('Способ найма')} term="hiringSource" hint={src.description}>
              <Segmented options={SOURCES.map((s) => ({ id: s.id, label: s.name }))} value={source} onChange={setSource} />
            </Field>
            <dl className="kv">
              <dt>{t('Зарплата')}</dt>
              <dd>{t('{0}/мес', [money(cost.salary)])}</dd>
              {cost.fee > 0 && (
                <>
                  <dt>{t('Комиссия рекрутеру')}</dt>
                  <dd>{money(cost.fee)}</dd>
                </>
              )}
              <dt>{t('Выход на работу')}</dt>
              <dd>{src.minDelay === src.maxDelay ? t('через {0} нед.', [src.minDelay]) : t('через {0}–{1} нед.', [src.minDelay, src.maxDelay])}</dd>
            </dl>
            <Callout tone="info" icon="clock">
              {t('Первый месяц новичок работает вполсилы. Больше 4 разработчиков — растут затраты на координацию.')}
            </Callout>
            <Button variant="primary" icon="userPlus" block disabled={cost.fee > state.cash} onClick={() => dispatch({ type: 'hire', role, level: lvl, source })}>
              {t('Нанять · {0}/мес', [money(cost.salary)])}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
