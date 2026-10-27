// Pool of random and scheduled events. Each option applies its consequences
// and returns a short outcome with a learning point.

import { fixed, money, num } from '../format.ts';
import { channelAvailable, channelDef, hasRole, scenarioOf, scaleLimit, techMult } from '../engine/catalog.ts';
import {
  addBugs,
  addCash,
  addDebt,
  addModifier,
  addMorale,
  addTrust,
  losePoints,
} from '../engine/effects.ts';
import type { EventOutcome, GameEventDef } from '../engine/events.ts';
import { estimatedBurn } from '../engine/growth.ts';
import { lastRecord, mrrGrowth } from '../engine/metrics.ts';
import { productContext } from '../engine/product.ts';
import { chance, pick, uniform } from '../engine/rng.ts';
import { bridgeOffer } from '../engine/fundraising.ts';
import { missingCompliance } from '../engine/market.ts';
import { endGame } from '../engine/scoring.ts';
import { addRelation } from '../engine/stakeholders.ts';
import { fireMember, hireMember } from '../engine/team.ts';
import type { GameState } from '../engine/types.ts';
import { t } from '../i18n/index.ts';

const ceo = (s: GameState) => scenarioOf(s).ceoName;
const isB2C = (s: GameState) => scenarioOf(s).kind === 'b2c';
const flavor = (s: GameState) => scenarioOf(s).flavor;
const good = (text: string, category?: EventOutcome['category'], points?: number): EventOutcome => ({ text, tone: 'good', category, points });
const bad = (text: string, category?: EventOutcome['category'], points?: number): EventOutcome => ({ text, tone: 'bad', category, points });
const neutral = (text: string, category?: EventOutcome['category'], points?: number): EventOutcome => ({ text, tone: 'neutral', category, points });

function featureName(s: GameState, id: string | number | undefined): string {
  return scenarioOf(s).features.find((f) => f.id === id)?.name ?? String(id);
}

function memberName(s: GameState, id: string | number | undefined): string {
  return s.team.find((m) => m.id === id)?.name ?? t('Сотрудник');
}

// Highest-hype feature not yet built: what stakeholders tend to ask for.
function hypedFeature(s: GameState, exclude: string[]): string | null {
  const candidates = scenarioOf(s)
    .features.filter((f) => f.kano !== 'must' && !s.product.features[f.id]?.completed && !exclude.includes(f.id))
    .sort((a, b) => (b.hype ?? 0.7) - (a.hype ?? 0.7));
  return candidates[0]?.id ?? null;
}

function quarterPerformance(s: GameState): number {
  const growth = mrrGrowth(s, Math.min(3, s.history.length - 1)) ?? 0;
  const ltvCac = lastRecord(s)?.truth.ltvCac ?? 0;
  const g = Math.max(-1, Math.min(1, (growth - 0.03) / 0.07));
  const u = Math.max(-0.5, Math.min(0.5, (ltvCac - 1.5) / 2));
  return Math.max(-1, Math.min(1, g + u));
}

function biggestPaidChannel(s: GameState): string | null {
  const paid = scenarioOf(s).channels.filter((c) => c.kind === 'paid' && (s.marketing.budgets[c.id] ?? 0) > 0);
  if (paid.length === 0) return null;
  return paid.reduce((best, c) => ((s.marketing.budgets[c.id] ?? 0) > (s.marketing.budgets[best.id] ?? 0) ? c : best)).id;
}

function runway(s: GameState): number {
  const burn = estimatedBurn(s);
  return burn > 0 ? s.cash / burn : 99;
}

function spike(s: GameState, amount: number): void {
  s.flags.spike = (s.flags.spike ?? 0) + amount;
}

function addAccounts(s: GameState, mrr: number): void {
  const last = lastRecord(s);
  const arppu = last?.truth.arppu ?? s.pricing.price;
  const paying = mrr / Math.max(1, arppu);
  s.cohorts.push({
    month: s.history.length,
    week: s.week,
    activated: paying,
    newPaying: paying,
    paying,
    active: [paying],
    payingHistory: [paying],
    price: s.pricing.price,
    seatMult: 1,
    quality: 1,
  });
}

export const EVENTS: GameEventDef[] = [
  // ---------------- Discovery ----------------
  {
    id: 'd_ceo_impatient',
    phases: ['discovery'],
    weight: 3,
    once: true,
    condition: (s) => s.week >= 6,
    title: t('CEO торопит'),
    text: (s) => t('{0}: «Мы уже {1} недель только разговариваем с людьми, а конкуренты пилят продукт. Давай уже начинать разработку!»', [ceo(s), s.week]),
    options: [
      {
        label: t('Показать результаты исследований и план оставшихся проверок'),
        hint: t('Нужно минимум 3 отчёта'),
        available: (s) => s.reports.length >= 3,
        apply: (s) => {
          addTrust(s, 6);
          return good(t('CEO увидел(а), что каждая неделя снижает риск, и согласился(лась) подождать. Ожидания стейкхолдеров управляются данными, а не обещаниями.'), 'stakeholders', 3);
        },
      },
      {
        label: t('Согласиться и перейти к стратегии на этой неделе'),
        apply: (s) => {
          addTrust(s, 4);
          s.flags.promisedStrategy = s.week + 1;
          return neutral(t('CEO доволен(льна). Но если вы не закончите discovery в ближайшую неделю, доверие упадёт.'));
        },
      },
      {
        label: t('Попросить ещё месяц без объяснений'),
        apply: (s) => {
          addTrust(s, -10);
          return bad(t('CEO раздражён(а): непонятно, за что платить ещё месяц. Исследование без плана выглядит как прокрастинация.'), 'stakeholders', -2);
        },
      },
    ],
  },
  {
    id: 'd_ceo_idea',
    phases: ['discovery', 'strategy'],
    weight: 2,
    once: true,
    prepare: (s) => ({ featureId: flavor(s).ceoPetFeature }),
    title: t('Идея CEO после конференции'),
    text: (s, d) => t('{0} после отраслевой конференции: «Все говорят про это! Нам срочно нужна функция „{1}“ — давай заложим её в MVP».', [ceo(s), featureName(s, d.featureId)]),
    options: [
      {
        label: t('Превратить идею в гипотезу и проверить на исследованиях'),
        apply: (s) => {
          addTrust(s, 2);
          return good(t('Идея не отвергнута, но и не принята на веру. Опросы и интервью покажут, нужна ли она сегменту.'), 'discovery', 2);
        },
      },
      {
        label: t('Сразу записать в MVP'),
        apply: (s, _r, d) => {
          addTrust(s, 5);
          s.flags.ceoFeatureInMvp = 1;
          if (!s.mvpScope.includes(String(d.featureId))) s.mvpScope.push(String(d.featureId));
          return bad(t('Функция попала в MVP без проверки. Если она не нужна пользователям, вы потратите на неё недели разработки.'), 'strategy', -2);
        },
      },
      {
        label: t('Отказать: не в фокусе'),
        apply: (s) => {
          addTrust(s, -5);
          return neutral(t('Отказ без данных портит отношения. Лучше сказать «давай проверим», чем просто «нет».'));
        },
      },
    ],
  },
  {
    id: 'd_friends',
    phases: ['discovery'],
    weight: 2,
    once: true,
    title: t('«Друзьям нравится!»'),
    text: (s) => t('{0}: «Показал(а) идею друзьям и бывшим коллегам — все в восторге и говорят, что обязательно купят. По-моему, это и есть валидация!»', [ceo(s)]),
    options: [
      {
        label: t('Согласиться, это сильный сигнал'),
        apply: () => bad(t('Друзья и знакомые — смещённая выборка: они не хотят вас расстраивать и не платят деньгами. Это не валидация.'), 'discovery', -3),
      },
      {
        label: t('Поблагодарить, но не считать это валидацией'),
        apply: (s) => {
          addTrust(s, -1);
          return good(t('Правильно. Мнение близких — не доказательство. Нужны незнакомые люди из целевого сегмента и поведенческие сигналы.'), 'discovery', 2);
        },
      },
    ],
  },
  {
    id: 'd_investor_check',
    phases: ['discovery'],
    weight: 2,
    once: true,
    condition: (s) => s.week >= 3,
    title: t('Инвестор спрашивает о прогрессе'),
    text: () => t('Партнёр фонда Northwind Ventures просит коротко рассказать, что вы узнали за первые недели.'),
    options: [
      {
        label: t('Показать доску гипотез: что проверено и что опровергнуто'),
        hint: t('Нужно минимум 2 проверенные гипотезы'),
        available: (s) => s.hypotheses.filter((h) => h.status !== 'untested').length >= 2,
        apply: (s) => {
          addTrust(s, 8);
          return good(t('Инвестор доволен: команда учится быстро и честно говорит о рисках. Опровергнутые гипотезы — тоже прогресс.'), 'stakeholders', 2);
        },
      },
      {
        label: t('Показать красивые макеты будущего продукта'),
        apply: (s) => {
          addTrust(s, 2);
          return neutral(t('Макеты выглядят хорошо, но инвестор спрашивает: «А это кому-то нужно?» Ответа пока нет.'));
        },
      },
      {
        label: t('Рассказать про огромный размер рынка (TAM)'),
        hint: t('Нужно кабинетное исследование'),
        available: (s) => Object.keys(s.knowledge.marketSize).length > 0,
        apply: (s) => {
          addTrust(s, 3);
          return neutral(t('Большой рынок — хорошо, но инвесторы знают: размер рынка не доказывает, что ваш продукт там кому-то нужен.'));
        },
      },
    ],
  },
  {
    id: 'd_noshow',
    phases: ['discovery'],
    weight: 2,
    once: true,
    condition: (s) => s.activeResearch.some((r) => r.method === 'interviews' && r.endWeek > s.week + 0),
    title: t('Респонденты не пришли'),
    text: () => t('Половина назначенных интервью сорвалась: люди не пришли или перенесли встречу.'),
    options: [
      {
        label: t('Перенести интервью (+1 неделя)'),
        apply: (s) => {
          for (const r of s.activeResearch) if (r.method === 'interviews') r.endWeek += 1;
          return neutral(t('Обычное дело: при планировании интервью закладывайте 20–30% неявок.'));
        },
      },
      {
        label: t('Срочно добрать людей с двойным вознаграждением ($400)'),
        apply: (s) => {
          addCash(s, -400);
          return neutral(t('Сроки сохранены, но за скорость пришлось заплатить.'));
        },
      },
    ],
  },
  {
    id: 'competitor_raise',
    phases: ['discovery', 'strategy', 'setup', 'build'],
    weight: 1.5,
    once: true,
    title: t('Конкурент привлёк $20 млн'),
    text: () => t('Прямой конкурент объявил о раунде $20 млн и запустил большую рекламную кампанию. Стоимость рекламы в нише немного вырастет.'),
    options: [
      {
        label: t('Продолжать по плану и усилить фокус на своём сегменте'),
        apply: (s) => {
          addModifier(s, { id: 'competitor_cpi', label: t('Конкурент разогрел аукцион'), lever: 'cpi', mult: 1.05 }, 200);
          return good(t('Деньги конкурента не меняют проблему вашего пользователя. Фокус на нише — лучшая защита стартапа.'), 'strategy', 2);
        },
      },
      {
        label: t('Срочно ускориться: меньше исследований, быстрее в разработку'),
        apply: (s) => {
          addModifier(s, { id: 'competitor_cpi', label: t('Конкурент разогрел аукцион'), lever: 'cpi', mult: 1.05 }, 200);
          addTrust(s, 3);
          return bad(t('Паника — плохой советчик. Гонка за конкурентом без понимания своего пользователя часто заканчивается продуктом «для всех и ни для кого».'), 'strategy', -1);
        },
      },
    ],
  },

  // ---------------- Build ----------------
  {
    id: 'b_senior_offer',
    phases: ['build', 'growth'],
    weight: 1.2,
    cooldown: 20,
    condition: (s) => s.team.some((m) => m.role === 'developer' && m.level === 'senior' && m.joinWeek <= s.week),
    prepare: (s, rng) => {
      const seniors = s.team.filter((m) => m.role === 'developer' && m.level === 'senior' && m.joinWeek <= s.week);
      return seniors.length > 0 ? { memberId: pick(rng, seniors).id } : null;
    },
    title: t('Сеньору предложили оффер'),
    text: (s, d) => t('{0}, Senior-разработчик, получил(а) оффер из бигтеха на 35% больше и думает об уходе.', [memberName(s, d.memberId)]),
    options: [
      {
        label: t('Сделать контроффер: +20% к зарплате'),
        apply: (s, _r, d) => {
          const m = s.team.find((x) => x.id === d.memberId);
          if (m) m.salary = Math.round(m.salary * 1.2);
          addMorale(s, 2);
          return neutral(t('Человек остаётся, но фонд оплаты труда вырос. Контрофферы работают, если причина ухода — деньги.'));
        },
      },
      {
        label: t('Предложить опцион и интересную зону ответственности'),
        apply: (s, rng, d) => {
          if (chance(rng, 0.55)) {
            addMorale(s, 3);
            return good(t('Сработало: человеку важнее влияние на продукт, чем зарплата.'));
          }
          fireMember(s, String(d.memberId), 'left');
          losePoints(s, 8);
          return bad(t('Не сработало: сеньор ушёл(ушла). Команда потеряла скорость и знания о коде.'));
        },
      },
      {
        label: t('Отпустить и искать замену'),
        apply: (s, _r, d) => {
          fireMember(s, String(d.memberId), 'left');
          losePoints(s, 6);
          return bad(t('Уход ключевого разработчика — это не только минус скорость, но и потерянный контекст. Поиск замены займёт недели.'));
        },
      },
    ],
  },
  {
    id: 'b_scope_creep',
    phases: ['build'],
    weight: 2,
    once: true,
    prepare: (s) => {
      const id = hypedFeature(s, s.mvpScope);
      return id ? { featureId: id } : null;
    },
    title: t('CEO хочет расширить MVP'),
    text: (s, d) => t('{0}: «Давай добавим в MVP „{1}“. Без этого мы будем выглядеть хуже конкурентов».', [ceo(s), featureName(s, d.featureId)]),
    options: [
      {
        label: t('Добавить в MVP'),
        apply: (s, _r, d) => {
          s.mvpScope.push(String(d.featureId));
          addTrust(s, 5);
          return bad(t('Scope creep: каждая новая фича в MVP отодвигает запуск и момент, когда вы узнаете правду от рынка.'), 'delivery', -2);
        },
      },
      {
        label: t('Предложить обмен: добавить, но убрать менее важную фичу'),
        available: (s) => s.mvpScope.some((id) => scenarioOf(s).features.find((f) => f.id === id)?.kano !== 'must' && !s.product.features[id]?.completed),
        apply: (s, _r, d) => {
          const seg = s.strategy?.segmentId ?? '';
          const removable = s.mvpScope
            .filter((id) => scenarioOf(s).features.find((f) => f.id === id)?.kano !== 'must' && !s.product.features[id]?.completed)
            .sort((a, b) => (s.world.featureValue[a][seg] ?? 0) - (s.world.featureValue[b][seg] ?? 0));
          const removed = removable[0];
          s.mvpScope = s.mvpScope.filter((id) => id !== removed);
          s.mvpScope.push(String(d.featureId));
          addTrust(s, 2);
          return good(t('Торговались объёмом, а не сроком: убрали «{0}». Фиксированный срок + гибкий scope — здоровая модель.', [featureName(s, removed)]), 'stakeholders', 2);
        },
      },
      {
        label: t('Отказать, опираясь на данные исследований'),
        hint: t('Нужно минимум 3 отчёта'),
        available: (s) => s.reports.length >= 3,
        apply: (s) => {
          addTrust(s, -1);
          return good(t('Вы показали, что пользователи о такой функции не просили. Аргументы данными работают лучше, чем «я так считаю».'), 'stakeholders', 2);
        },
      },
      {
        label: t('Просто отказать'),
        apply: (s) => {
          addTrust(s, -6);
          return bad(t('CEO недоволен(льна): «нет» без объяснения воспринимается как сопротивление.'), 'stakeholders', -1);
        },
      },
    ],
  },
  {
    id: 'b_estimate_wrong',
    phases: ['build'],
    weight: 2.5,
    cooldown: 6,
    prepare: (s, rng) => {
      const open = s.mvpScope.filter((id) => !s.product.features[id]?.completed);
      return open.length > 0 ? { featureId: pick(rng, open) } : null;
    },
    title: t('Оценка оказалась неверной'),
    text: (s, d) => t('Тимлид: «„{0}“ оказалась сложнее, чем думали. Нужно примерно на 50% больше времени».', [featureName(s, d.featureId)]),
    options: [
      {
        label: t('Принять задержку'),
        apply: (s, _r, d) => {
          s.world.featureEffortMult[String(d.featureId)] *= 1.5;
          addTrust(s, -1);
          return neutral(t('Оценки — это прогноз, а не обязательство. Поэтому в сроки закладывают буфер 20–50%.'));
        },
      },
      {
        label: t('Убрать функцию из MVP'),
        available: (s, d) => scenarioOf(s).features.find((f) => f.id === d.featureId)?.kano !== 'must',
        apply: (s, _r, d) => {
          s.world.featureEffortMult[String(d.featureId)] *= 1.5;
          s.mvpScope = s.mvpScope.filter((id) => id !== d.featureId);
          return neutral(t('Сократили scope, чтобы удержать срок. Функцию можно сделать после запуска, если данные покажут, что она нужна.'));
        },
      },
      {
        label: t('Купить готовое решение / SDK за $3 000'),
        apply: (s, _r, d) => {
          addCash(s, -3000);
          s.world.featureEffortMult[String(d.featureId)] *= 0.8;
          return good(t('Build vs buy: за деньги сэкономили недели разработки. Для стартапа время обычно дороже денег.'), 'delivery', 1);
        },
      },
    ],
  },
  {
    id: 'b_security',
    phases: ['build', 'growth'],
    weight: 1.5,
    once: true,
    condition: (s) => !s.tech.practices.includes('security') || s.tech.auth === 'own',
    title: t('Найдена уязвимость'),
    text: () => t('Знакомый пентестер нашёл уязвимость: меняя ID в запросе, можно получить чужие данные (IDOR).'),
    options: [
      {
        label: t('Исправить сейчас (−8 SP)'),
        apply: (s) => {
          losePoints(s, 8);
          return good(t('Безопасность — не фича, которую можно отложить. Исправить до инцидента в десятки раз дешевле, чем после.'), 'delivery', 2);
        },
      },
      {
        label: t('Записать в бэклог, сейчас важнее фичи'),
        apply: (s) => {
          s.flags.securityHole = 1;
          return bad(t('Уязвимость осталась в продукте. Чем больше пользователей, тем выше шанс, что её найдут не те люди.'), 'delivery', -2);
        },
      },
    ],
  },
  {
    id: 'b_redesign',
    phases: ['build'],
    weight: 1.5,
    once: true,
    title: t('Дизайнер хочет всё переделать'),
    text: () => t('Дизайнер: «Текущий интерфейс устарел ещё до запуска. Давай переделаем все экраны, это займёт пару спринтов».'),
    options: [
      {
        label: t('Разрешить полный редизайн (−15 SP)'),
        apply: (s) => {
          losePoints(s, 15);
          s.product.ux *= 1.04;
          addMorale(s, 3);
          return neutral(t('Интерфейс стал лучше, но запуск отодвинулся. Без данных о реальном поведении пользователей сложно понять, что именно улучшать.'));
        },
      },
      {
        label: t('Ограничить: только ключевые экраны воронки (−5 SP)'),
        apply: (s) => {
          losePoints(s, 5);
          s.product.ux *= 1.02;
          return good(t('Таймбокс и фокус на экранах, которые влияют на активацию. Остальное — после запуска, по данным.'), 'delivery', 1);
        },
      },
      {
        label: t('Отказать'),
        apply: (s) => {
          addMorale(s, -4);
          return neutral(t('Дизайнер расстроен. Иногда стоит объяснить приоритеты и дать небольшой таймбокс вместо прямого отказа.'));
        },
      },
    ],
  },
  {
    id: 'b_conflict',
    phases: ['build', 'growth'],
    weight: 1.2,
    cooldown: 16,
    condition: (s) => s.team.filter((m) => m.role === 'developer').length >= 2,
    title: t('Конфликт в команде'),
    text: () => t('Бэкенд и фронтенд третий день спорят о формате API. Задачи стоят, на дейли напряжение.'),
    options: [
      {
        label: t('Собрать встречу и зафиксировать контракт API'),
        apply: (s) => {
          losePoints(s, 2);
          addMorale(s, 4);
          return good(t('PO не обязан решать технический спор, но обязан убрать блокер: собрать людей и помочь договориться.'), 'delivery', 1);
        },
      },
      {
        label: t('Пусть сами разберутся'),
        apply: (s) => {
          addMorale(s, -6);
          losePoints(s, 5);
          return bad(t('Конфликт затянулся на неделю. Невмешательство тоже решение — и часто дорогое.'));
        },
      },
    ],
  },
  {
    id: 'b_microservices',
    phases: ['build'],
    weight: 1.5,
    once: true,
    condition: (s) => s.tech.backend === 'monolith' && s.tech.platform !== 'nocode',
    title: t('Микросервисы «на вырост»'),
    text: () => t('Тимлид: «Монолит не выдержит миллион пользователей. Давай сразу перепишем на микросервисы, пока кода немного».'),
    options: [
      {
        label: t('Согласиться'),
        apply: (s) => {
          losePoints(s, 25);
          s.tech.backend = 'microservices';
          return bad(t('Преждевременная оптимизация: у вас ещё нет ни одного пользователя, а скорость разработки упала на четверть.'), 'delivery', -4);
        },
      },
      {
        label: t('Отказать: сначала product-market fit, масштаб потом'),
        apply: (s) => {
          addMorale(s, -2);
          return good(t('Правильно. Модульный монолит позволит вынести сервисы позже, когда появится реальная нагрузка.'), 'delivery', 2);
        },
      },
      {
        label: t('Дать 2 дня на исследование и решить по фактам'),
        apply: (s) => {
          losePoints(s, 3);
          return neutral(t('Тимлид сам пришёл к выводу, что нагрузка пока не та. Таймбокс на исследование — хороший способ решать споры.'));
        },
      },
    ],
  },
  {
    id: 'b_burnout',
    phases: ['build', 'growth'],
    weight: 3,
    cooldown: 10,
    condition: (s) => (s.flags.overtimeStreak ?? 0) >= 2 || s.morale < 45,
    title: t('Команда выгорает'),
    text: () => t('Больничные, ошибки в простых задачах, раздражение на встречах. Команда работает на пределе.'),
    options: [
      {
        label: t('Отменить овертайм, дать выходные и сократить план'),
        apply: (s) => {
          s.overtime = false;
          s.flags.overtimeStreak = 0;
          losePoints(s, 6);
          addMorale(s, 15);
          return good(t('Устойчивый темп важнее рывка. Выгоревшая команда делает больше багов, чем фич.'), 'delivery', 1);
        },
      },
      {
        label: t('Дотерпеть до релиза'),
        apply: (s) => {
          addMorale(s, -12);
          addBugs(s, 10);
          return bad(t('Команда дотянула, но ценой багов и мотивации. Риск ухода людей вырос.'), 'delivery', -2);
        },
      },
    ],
  },
  {
    id: 'b_freelancer_gone',
    phases: ['build', 'growth'],
    weight: 2,
    cooldown: 8,
    condition: (s) => s.team.some((m) => m.source === 'freelance' && m.joinWeek <= s.week),
    prepare: (s, rng) => {
      const list = s.team.filter((m) => m.source === 'freelance' && m.joinWeek <= s.week);
      return list.length > 0 ? { memberId: pick(rng, list).id, role: pick(rng, list).role } : null;
    },
    title: t('Фрилансер пропал'),
    text: (s, d) => t('{0} перестал(а) выходить на связь. Часть кода не задокументирована.', [memberName(s, d.memberId)]),
    options: [
      {
        label: t('Найти замену через аутсорс-агентство'),
        apply: (s, rng, d) => {
          const gone = s.team.find((m) => m.id === d.memberId);
          fireMember(s, String(d.memberId), 'left');
          addDebt(s, 5);
          if (gone) hireMember(s, rng, gone.role, gone.level, 'outsource');
          return neutral(t('Агентство дало человека через неделю, но дороже. Фрилансеры экономят деньги, но добавляют риск.'));
        },
      },
      {
        label: t('Перераспределить задачи на команду'),
        apply: (s, _r, d) => {
          fireMember(s, String(d.memberId), 'left');
          addDebt(s, 5);
          addMorale(s, -4);
          return neutral(t('Команда разбирается в чужом коде. Документация и код-ревью снижают «фактор автобуса».'));
        },
      },
    ],
  },
  {
    id: 'b_vendor_price',
    phases: ['build', 'growth'],
    weight: 1,
    once: true,
    condition: (s) => s.tech.platform === 'nocode' || s.tech.backend === 'baas',
    title: t('Вендор поднял цены'),
    text: () => t('Платформа, на которой построена часть продукта, меняет тарифы: для вашего плана +$700 в месяц.'),
    options: [
      {
        label: t('Принять новые условия'),
        apply: (s) => {
          s.flags.vendorTax = (s.flags.vendorTax ?? 0) + 700;
          return neutral(t('Vendor lock-in: чем глубже вы завязаны на платформу, тем меньше у вас переговорной силы.'));
        },
      },
      {
        label: t('Вынести критичные части на свой код (−20 SP)'),
        apply: (s) => {
          losePoints(s, 20);
          return neutral(t('Зависимость снижена, но ценой времени команды.'));
        },
      },
    ],
  },

  // ---------------- Growth ----------------
  {
    id: 'g_outage',
    phases: ['growth'],
    weight: (s) => {
      const mau = lastRecord(s)?.truth.mau ?? 0;
      const noDevops = s.tech.infra === 'iaas' && !hasRole(s, 'devops') ? 2.5 : 1;
      const overload = mau > scaleLimit(s) ? 3 : 1;
      const loadTested = s.launch?.checklist.includes('load_test') ? 0.8 : 1;
      return 1.2 * techMult(s, 'outage') * noDevops * overload * loadTested;
    },
    cooldown: 8,
    title: t('Падение сервиса'),
    text: (s) => t('Сервис лежал 6 часов в пиковое время{0}.', [s.tech.practices.includes('monitoring') ? t(' — мониторинг поднял тревогу через 3 минуты') : t(', и узнали вы об этом из жалоб пользователей')]),
    options: [
      {
        label: t('Провести постмортем и устранить причину (−10 SP)'),
        apply: (s) => {
          addModifier(s, { id: 'outage', label: t('Последствия падения'), lever: 'churn', mult: 1.08 }, 4);
          losePoints(s, 10);
          return good(t('Blameless-постмортем: ищем причину в системе, а не виноватых. Повторение маловероятно.'), 'delivery', 2);
        },
      },
      {
        label: t('Поднять и жить дальше'),
        apply: (s) => {
          addModifier(s, { id: 'outage', label: t('Последствия падения'), lever: 'churn', mult: 1.15 }, 4);
          return bad(t('Причина не устранена — инцидент может повториться.'), 'delivery', -1);
        },
      },
      {
        label: t('Честно написать пользователям и дать компенсацию'),
        apply: (s) => {
          const mrr = lastRecord(s)?.mrr ?? 0;
          addCash(s, -mrr * 0.05);
          addModifier(s, { id: 'outage', label: t('Последствия падения'), lever: 'churn', mult: 1.03 }, 4);
          addTrust(s, 2);
          return good(t('Открытая коммуникация во время инцидента сохраняет доверие лучше, чем молчание.'), 'stakeholders', 1);
        },
      },
    ],
  },
  {
    id: 'g_bad_reviews',
    phases: ['growth'],
    weight: 2.5,
    cooldown: 12,
    condition: (s) => s.product.bugs > 35 || s.product.rating < 3.8,
    title: t('Плохие отзывы'),
    text: (s) => flavor(s).badReviews.replace('{rating}', fixed(s.product.rating, 1)),
    options: [
      {
        label: t('Багфикс: 60% ресурсов команды на баги в этом месяце'),
        apply: (s) => {
          s.allocation = { features: 0.3, debt: 0.1, bugs: 0.6 };
          return good(t('Качество — тоже часть ценности. Новые фичи не помогут, если базовый сценарий ломается.'), 'delivery', 2);
        },
      },
      {
        label: t('Отвечать на отзывы и просить довольных оценить продукт'),
        apply: (s) => {
          s.product.rating = Math.min(4.9, s.product.rating + 0.2);
          return neutral(t('Рейтинг немного подрос, но причина жалоб осталась.'));
        },
      },
      {
        label: t('Игнорировать — у нас в плане новые фичи'),
        apply: (s) => {
          addModifier(s, { id: 'reviews', label: t('Плохие отзывы'), lever: 'registration', mult: 0.9 }, 8);
          return bad(t('Рейтинг отпугивает новых пользователей: конверсия страницы стора падает.'), 'delivery', -2);
        },
      },
    ],
  },
  {
    id: 'g_competitor_price',
    phases: ['growth'],
    weight: 1.2,
    once: true,
    title: t('Ценовая атака конкурента'),
    text: () => t('Конкурент снизил цену на 40% и запустил агрессивную рекламу с прямым сравнением.'),
    options: [
      {
        label: t('Снизить цену так же'),
        apply: (s) => {
          s.pricing.price = Math.round(s.pricing.price * 0.7 * 100) / 100;
          return neutral(t('Ценовая война выгодна тому, у кого больше денег. Снижение цены режет LTV у всей базы.'), 'growth', -1);
        },
      },
      {
        label: t('Подчеркнуть ценность: обновить креативы и позиционирование ($3 000)'),
        apply: (s) => {
          addCash(s, -3000);
          for (const c of scenarioOf(s).channels) s.marketing.creative[c.id] = 1;
          addModifier(s, { id: 'price_war', label: t('Конкурент демпингует'), lever: 'conversion', mult: 0.96 }, 8);
          return good(t('Вы конкурируете ценностью для своего сегмента, а не ценой. Креативы обновлены.'), 'growth', 2);
        },
      },
      {
        label: t('Ничего не делать'),
        apply: (s) => {
          addModifier(s, { id: 'price_war', label: t('Конкурент демпингует'), lever: 'conversion', mult: 0.9 }, 8);
          return neutral(t('Конверсия просела на пару месяцев.'));
        },
      },
    ],
  },
  {
    id: 'g_influencer',
    phases: ['growth'],
    weight: 1.3,
    cooldown: 16,
    prepare: (s) => ({ cost: isB2C(s) ? 12000 : 8000 }),
    title: t('Предложение от блогера'),
    text: (s, d) => flavor(s).influencer.replace('{cost}', money(Number(d.cost))),
    options: [
      {
        label: t('Заплатить фиксированную сумму'),
        apply: (s, rng, d) => {
          addCash(s, -Number(d.cost));
          const base = scenarioOf(s).launchSpike;
          const roll = rng.next();
          if (roll < 0.3) {
            spike(s, base * 1.5);
            return good(t('Попадание! Интеграция «залетела», в следующем месяце будет всплеск трафика.'));
          }
          if (roll < 0.7) {
            spike(s, base * 0.6);
            return neutral(t('Средний результат: трафик будет, но окупится ли — посмотрим по когорте.'));
          }
          spike(s, base * 0.15);
          return bad(t('Провал: аудитория блогера оказалась не вашей. Инфлюенс-маркетинг очень волатилен.'));
        },
      },
      {
        label: t('Предложить оплату за результат (промокод, CPA)'),
        apply: (s, rng) => {
          if (!chance(rng, 0.6)) return neutral(t('Блогер отказался: крупные авторы редко работают за CPA.'));
          const users = scenarioOf(s).launchSpike * 0.5 * uniform(rng, 0.6, 1.3);
          spike(s, users);
          s.flags.pendingCosts = (s.flags.pendingCosts ?? 0) + users * (isB2C(s) ? 2 : 3);
          return good(t('Договорились о CPA: платите только за пришедших пользователей. Риск переложен на партнёра.'), 'growth', 1);
        },
      },
      { label: t('Отказаться'), apply: () => neutral(t('Бюджет сохранён.')) },
    ],
  },
  {
    id: 'g_press',
    phases: ['growth'],
    weight: 1,
    once: true,
    condition: (s) => productContext(s).value > 0.7,
    title: t('Журналист хочет написать о вас'),
    text: () => t('Журналист крупного технологического издания готовит статью о стартапах в вашей нише.'),
    options: [
      {
        label: t('Дать интервью и подготовить материалы (−2 SP)'),
        apply: (s) => {
          losePoints(s, 2);
          spike(s, scenarioOf(s).launchSpike * 0.5);
          addTrust(s, 3);
          return good(t('Статья вышла: всплеск трафика и приятный бонус для инвесторов.'));
        },
      },
      { label: t('Отказаться — не до этого'), apply: () => neutral(t('PR — дешёвый канал, если продукту есть что показать.')) },
    ],
  },
  {
    id: 'g_platform_update',
    phases: ['growth'],
    weight: 1,
    once: true,
    title: t('Обновление платформы всё сломало'),
    text: (s) => flavor(s).platformUpdate,
    options: [
      {
        label: t('Срочный фикс (−6 SP)'),
        apply: (s) => {
          losePoints(s, 6);
          return good(t('Быстрая реакция на внешние изменения — часть работы. Стоит заранее тестировать бета-версии ОС и браузеров.'), 'delivery', 1);
        },
      },
      {
        label: t('Подождать, пока исправят на стороне платформы'),
        apply: (s) => {
          addModifier(s, { id: 'platform_bug', label: t('Баг после обновления платформы'), lever: 'retention', mult: 0.93 }, 8);
          return bad(t('Два месяца часть пользователей страдала. Удержание просело.'), 'delivery', -1);
        },
      },
    ],
  },
  {
    id: 'g_ad_ban',
    phases: ['growth'],
    weight: 1,
    once: true,
    condition: (s) => biggestPaidChannel(s) !== null,
    // The ban hits the channel with the biggest budget; the money can move to another paid channel.
    prepare: (s) => {
      const banned = biggestPaidChannel(s);
      if (!banned) return null;
      const alt = scenarioOf(s).channels.find((c) => c.kind === 'paid' && c.id !== banned && channelAvailable(s, c).ok);
      return { banned, alt: alt?.id ?? '' };
    },
    title: t('Рекламный аккаунт заблокирован'),
    text: (s, d) => t('{0}: аккаунт заблокирован за «нарушение рекламной политики». Апелляция займёт около месяца.', [channelDef(scenarioOf(s), String(d.banned)).name]),
    options: [
      {
        label: t('Подать апелляцию и переждать'),
        apply: (s, _rng, d) => {
          s.marketing.disabledUntil[String(d.banned)] = s.week + 4;
          return neutral(t('Месяц без главного канала. Зависимость от одного канала — риск для бизнеса.'));
        },
      },
      {
        label: t('Подать апелляцию и перенести бюджет в другой канал'),
        available: (_s, d) => String(d.alt) !== '',
        apply: (s, _rng, d) => {
          const banned = String(d.banned);
          const alt = String(d.alt);
          s.marketing.disabledUntil[banned] = s.week + 4;
          const moved = s.marketing.budgets[banned] ?? 0;
          s.marketing.budgets[alt] = (s.marketing.budgets[alt] ?? 0) + moved;
          return good(t('Бюджет {0} перенесён в «{1}». Диверсификация каналов снижает риск.', [money(moved), channelDef(scenarioOf(s), alt).name]), 'growth', 1);
        },
      },
    ],
  },
  {
    id: 'g_ceo_pet',
    phases: ['growth'],
    weight: 1.5,
    cooldown: 24,
    prepare: (s) => {
      const id = hypedFeature(s, []);
      return id ? { featureId: id } : null;
    },
    title: t('Фича для конференции'),
    text: (s, d) => t('{0}: «Через месяц выступаю на конференции. Давай к ней сделаем „{1}“ — инвесторы будут в восторге!»', [ceo(s), featureName(s, d.featureId)]),
    options: [
      {
        label: t('Поставить в начало очереди разработки'),
        apply: (s, _r, d) => {
          const id = String(d.featureId);
          s.featureQueue = [id, ...s.featureQueue.filter((x) => x !== id)];
          addTrust(s, 5);
          const v = s.world.featureValue[id]?.[s.strategy?.segmentId ?? ''] ?? 0;
          return v < 0.6
            ? bad(t('Роадмап подстроился под выступление, а не под пользователей. Эта функция мало что даст вашему сегменту.'), 'stakeholders', -2)
            : neutral(t('Повезло: функция действительно ценная для сегмента. Но решение принято не по данным.'));
        },
      },
      {
        label: t('Показать RICE-оценку и предложить для демо уже готовые сильные стороны'),
        apply: (s) => {
          addTrust(s, 1);
          return good(t('Вы перевели разговор из «хочу» в «что даст результат». Для демо достаточно показать реальные метрики и кейсы.'), 'stakeholders', 2);
        },
      },
      {
        label: t('Отказать'),
        apply: (s) => {
          addTrust(s, -6);
          return bad(t('CEO недоволен(льна) отказом без альтернативы.'), 'stakeholders', -1);
        },
      },
    ],
  },
  {
    id: 'g_big_client',
    phases: ['growth'],
    weight: 1.5,
    once: true,
    condition: (s) => !isB2C(s),
    prepare: (s) => ({ mrr: Math.round(40 * s.pricing.price) }),
    title: t('Крупный клиент с условием'),
    text: (_s, d) => t('Сеть из 40 кафе готова подписаться (около {0}/мес), если вы сделаете интеграцию с их кассовой системой за 6 недель.', [money(Number(d.mrr))]),
    options: [
      {
        label: t('Сделать кастомную интеграцию (−25 SP)'),
        apply: (s, rng, d) => {
          losePoints(s, 25);
          if (chance(rng, 0.7)) {
            addAccounts(s, Number(d.mrr));
            return neutral(t('Клиент подписался. Но 25 SP ушли на функцию для одного клиента — следите, чтобы стартап не превратился в заказную разработку.'));
          }
          return bad(t('Интеграцию сделали, но клиент перенёс решение «на следующий квартал». Обещания крупных клиентов — не контракт.'), 'stakeholders', -2);
        },
      },
      {
        label: t('Предложить стандартный продукт со скидкой 20%'),
        apply: (s, rng, d) => {
          if (chance(rng, 0.35)) {
            addAccounts(s, Number(d.mrr) * 0.8);
            return good(t('Клиент согласился на стандартный продукт. Роадмап остался вашим.'), 'stakeholders', 2);
          }
          return neutral(t('Клиент ушёл к конкуренту. Зато команда не отвлеклась.'));
        },
      },
      { label: t('Отказаться'), apply: () => neutral(t('Без кастомных доработок фокус сохранён.')) },
    ],
  },
  {
    id: 'g_sales_promise',
    phases: ['growth'],
    weight: 1.5,
    once: true,
    condition: (s) => hasRole(s, 'sales'),
    prepare: (s) => {
      const id = hypedFeature(s, []);
      return id ? { featureId: id } : null;
    },
    title: t('Продажник пообещал фичу'),
    text: (s, d) => t('Менеджер по продажам пообещал клиенту „{0}“ к следующему месяцу, чтобы закрыть сделку.', [featureName(s, d.featureId)]),
    options: [
      {
        label: t('Выполнить обещание: поставить фичу первой'),
        apply: (s, _r, d) => {
          const id = String(d.featureId);
          s.featureQueue = [id, ...s.featureQueue.filter((x) => x !== id)];
          addMorale(s, -3);
          addRelation(s, 'sales', 10);
          addRelation(s, 'cto', -4);
          return bad(t('Роадмапом начали управлять продажи. Если так пойдёт дальше, продукт станет набором обещаний разным клиентам.'), 'stakeholders', -1);
        },
      },
      {
        label: t('Честно поговорить с клиентом и договориться о реальных сроках'),
        apply: (s, rng) => {
          const kept = chance(rng, 0.7);
          addRelation(s, 'sales', -4);
          return good(t('{0} — и вы договорились с продажами: обещания по роадмапу только через PO.', [kept ? t('Клиент остался') : t('Клиент ушёл, но')]), 'stakeholders', 2);
        },
      },
    ],
  },
  {
    id: 'g_data_bug',
    phases: ['growth'],
    weight: 2,
    once: true,
    condition: (s) => s.tech.analytics !== 'none' && (!s.launch?.checklist.includes('tracking') || !hasRole(s, 'analyst')),
    title: t('Данные были неверными'),
    text: () => t('Выяснилось: события регистрации два месяца отправлялись дважды, а часть событий оплаты терялась. Часть отчётов была неверной.'),
    options: [
      {
        label: t('Починить трекинг и пересчитать отчёты (−4 SP)'),
        apply: (s) => {
          losePoints(s, 4);
          s.flags.trackingBroken = 0;
          return good(t('Качество данных — фундамент решений. Хорошая практика: трекинг-план и автоматические проверки событий.'), 'growth', 1);
        },
      },
      {
        label: t('Не трогать — сейчас не до этого'),
        apply: (s) => {
          s.flags.trackingBroken = s.week + 16;
          return bad(t('Ближайшие месяцы вы будете принимать решения по искажённым данным.'), 'growth', -2);
        },
      },
    ],
  },
  {
    id: 'g_payment_bug',
    phases: ['growth'],
    weight: 2.5,
    once: true,
    condition: (s) => !s.launch?.checklist.includes('payments_test') || s.tech.payments === 'own_iap' || s.tech.payments === 'invoice',
    title: t('Двойные списания'),
    text: () => t('Пользователи жалуются: у части подписчиков деньги списали дважды. В поддержке — шквал гневных писем.'),
    options: [
      {
        label: t('Вернуть деньги всем пострадавшим и починить (−5 SP)'),
        apply: (s) => {
          addCash(s, -(lastRecord(s)?.mrr ?? 0) * 0.08);
          losePoints(s, 5);
          addTrust(s, 2);
          return good(t('Проактивный возврат денег сохранил доверие. Ошибки с деньгами пользователи прощают хуже всего.'), 'delivery', 1);
        },
      },
      {
        label: t('Починить, деньги возвращать по запросу'),
        apply: (s) => {
          losePoints(s, 5);
          addModifier(s, { id: 'payment_bug', label: t('Двойные списания'), lever: 'churn', mult: 1.1 }, 4);
          s.product.rating = Math.max(1, s.product.rating - 0.2);
          return neutral(t('Часть пользователей ушла с плохими отзывами.'));
        },
      },
      {
        label: t('Разобраться в следующем спринте'),
        apply: (s) => {
          addModifier(s, { id: 'payment_bug', label: t('Двойные списания'), lever: 'churn', mult: 1.25 }, 8);
          s.product.rating = Math.max(1, s.product.rating - 0.4);
          return bad(t('Пока баг жил, отток вырос, а в сторе посыпались единицы.'), 'delivery', -2);
        },
      },
    ],
  },
  {
    id: 'g_breach',
    phases: ['growth'],
    weight: 3,
    once: true,
    condition: (s) => (s.flags.securityHole ?? 0) > 0 && s.history.length >= 2,
    title: t('Утечка данных'),
    text: () => t('Через ту самую уязвимость из бэклога утекла база email-адресов и истории пользователей.'),
    options: [
      {
        label: t('Публично признать, уведомить пользователей и регулятора'),
        apply: (s) => {
          addCash(s, -25000);
          addTrust(s, -10);
          addModifier(s, { id: 'breach', label: t('Последствия утечки'), lever: 'churn', mult: 1.25 }, 8);
          addModifier(s, { id: 'breach_reg', label: t('Репутация после утечки'), lever: 'registration', mult: 0.9 }, 8);
          return neutral(t('Штраф и юристы — $25 000, отток вырос. Честность смягчила удар, но урок дорогой: уязвимости нельзя откладывать.'), 'stakeholders', 1);
        },
      },
      {
        label: t('Тихо исправить и не сообщать'),
        apply: (s, rng) => {
          if (chance(rng, 0.5)) {
            addCash(s, -45000);
            addTrust(s, -30);
            addModifier(s, { id: 'breach', label: t('Скандал с утечкой'), lever: 'churn', mult: 1.4 }, 12);
            return bad(t('Журналисты узнали об утечке. Скандал, штраф $45 000 за сокрытие и потеря доверия.'), 'stakeholders', -5);
          }
          addTrust(s, -5);
          return bad(t('Пронесло, но это незаконно (GDPR требует уведомления за 72 часа) и неэтично.'), 'stakeholders', -3);
        },
      },
    ],
  },
  {
    id: 'g_morale_low',
    phases: ['build', 'growth'],
    weight: 3,
    cooldown: 12,
    condition: (s) => s.morale < 40 && s.team.length > 0,
    title: t('Команда демотивирована'),
    text: () => t('Двое в команде обновили резюме. Ретро превратились в жалобы, инициативы нет.'),
    options: [
      {
        label: t('Встречи 1-на-1 и командное мероприятие ($3 000)'),
        apply: (s) => {
          addCash(s, -3000);
          addMorale(s, 12);
          return good(t('Люди почувствовали, что их слышат. Мотивация — это ещё и понятная цель и влияние на продукт.'));
        },
      },
      {
        label: t('Повысить зарплаты на 10%'),
        apply: (s) => {
          for (const m of s.team) m.salary = Math.round(m.salary * 1.1);
          addMorale(s, 18);
          return neutral(t('Мотивация выросла, фонд оплаты труда тоже.'));
        },
      },
      {
        label: t('Ничего не делать'),
        apply: (s, rng) => {
          const devs = s.team.filter((m) => m.role === 'developer' && m.joinWeek <= s.week);
          if (devs.length > 0 && chance(rng, 0.5)) {
            fireMember(s, pick(rng, devs).id, 'left');
            return bad(t('Один разработчик ушёл. Найм замены займёт недели.'));
          }
          return neutral(t('Пока все остались. Но проблема не решена.'));
        },
      },
    ],
  },
  {
    id: 'g_bridge_offer',
    phases: ['growth'],
    weight: 3,
    once: true,
    condition: (s) => s.trust >= 60 && s.history.length >= 4 && (mrrGrowth(s, 2) ?? 0) > 0.08,
    prepare: (s) => {
      const amount = Math.round(scenarioOf(s).startCash[s.difficulty] * 0.4);
      // Good terms: the fund values the company above the usual bridge offer.
      const valuation = bridgeOffer(s).valuation * 1.3;
      return { amount, dilution: amount / (valuation + amount) };
    },
    title: t('Предложение бридж-раунда'),
    text: (_s, d) => t('Фонд видит рост и готов дать бридж-раунд {0} на хороших условиях: за {1}% компании.', [money(Number(d.amount)), fixed(Number(d.dilution) * 100, 0)]),
    options: [
      {
        label: t('Принять'),
        apply: (s, _r, d) => {
          addCash(s, Number(d.amount));
          addTrust(s, 3);
          s.dilution = 1 - (1 - s.dilution) * (1 - Number(d.dilution));
          s.flags.lastRaiseWeek = s.week;
          return good(t('Деньги лучше привлекать, когда они не нужны срочно. Runway вырос.'), 'finance', 2);
        },
      },
      {
        label: t('Отказаться — денег хватает'),
        apply: (s) => (runway(s) < 9
          ? bad(t('Runway меньше 9 месяцев, а фандрайзинг занимает 3–6. Отказ был рискованным.'), 'finance', -2)
          : neutral(t('Размытие доли не понадобилось.'))),
      },
    ],
  },
  {
    id: 'g_cash_crunch',
    phases: ['growth', 'build'],
    weight: 0,
    manual: true,
    title: t('Деньги заканчиваются'),
    text: (s) => t('Денег осталось примерно на {0} мес. Совет директоров требует план действий.', [fixed(runway(s), 1)]),
    options: [
      {
        label: t('Урезать маркетинг вдвое'),
        apply: (s) => {
          for (const k of Object.keys(s.marketing.budgets)) s.marketing.budgets[k] = Math.round(s.marketing.budgets[k] / 2);
          return neutral(t('Burn снизится, но и рост замедлится. Режьте в первую очередь каналы с худшим CAC.'));
        },
      },
      {
        label: t('Сократить команду: двое последних нанятых'),
        apply: (s) => {
          const latest = [...s.team].sort((a, b) => b.joinWeek - a.joinWeek).slice(0, 2);
          for (const m of latest) fireMember(s, m.id, 'fired');
          addMorale(s, -12);
          return neutral(t('Тяжёлое, но иногда необходимое решение. Мотивация оставшихся упала.'));
        },
      },
      {
        label: t('Попробовать срочно привлечь бридж'),
        apply: (s, rng) => {
          const growth = mrrGrowth(s, 2) ?? 0;
          const p = Math.max(0.05, Math.min(0.8, (s.trust / 100) * (0.5 + growth * 5)));
          if (chance(rng, p)) {
            addCash(s, scenarioOf(s).startCash[s.difficulty] * 0.3);
            addTrust(s, -5);
            return neutral(t('Бридж получен, но на жёстких условиях: фонд забрал большую долю.'), 'finance', 1);
          }
          addTrust(s, -10);
          return bad(t('Фонды отказали: без роста и с коротким runway деньги не дают. Начинать фандрайзинг нужно минимум за 6 месяцев.'), 'finance', -2);
        },
      },
      { label: t('Продолжать как есть'), apply: () => bad(t('Надежда — не стратегия.'), 'finance', -1) },
    ],
  },
  {
    id: 'g_acquihire',
    phases: ['growth'],
    weight: 4,
    once: true,
    condition: (s) => runway(s) < 3 && s.history.length >= 5,
    title: t('Предложение о покупке команды'),
    text: () => t('Крупная компания предлагает купить команду и технологию (acqui-hire). Инвесторы вернут часть вложений, продукт закроют.'),
    options: [
      {
        label: t('Согласиться на сделку'),
        apply: (s) => {
          endGame(s, 'acquired');
          return neutral(t('Мягкая посадка: команда трудоустроена, инвесторы вернули часть денег.'));
        },
      },
      { label: t('Отказаться и бороться дальше'), apply: () => neutral(t('Вы решили рискнуть.')) },
    ],
  },
  {
    id: 'g_support_overload',
    phases: ['growth'],
    weight: 2,
    cooldown: 16,
    condition: (s) => {
      const load = lastRecord(s)?.support;
      return load !== undefined && load.tickets > load.capacity * 1.2;
    },
    title: t('Поддержка не справляется'),
    text: (s) => {
      const load = lastRecord(s)?.support;
      return t('{0} обращений в месяц остаются без ответа. {1} по ночам лично отвечает клиентам.', [fixed(Math.max(0, (load?.tickets ?? 0) - (load?.capacity ?? 0)), 0), ceo(s)]);
    },
    options: [
      {
        label: t('Нанять специалиста поддержки через аутсорс'),
        apply: (s, rng) => {
          hireMember(s, rng, 'support', 'middle', 'outsource');
          addRelation(s, 'support', 8);
          return good(t('Поддержка — часть продукта: быстрые ответы снижают отток.'), 'growth', 1);
        },
      },
      {
        label: t('Сделать базу знаний и чат-бота (−5 SP)'),
        apply: (s) => {
          losePoints(s, 5);
          s.product.leverMods.retention *= 1.02;
          return neutral(t('Часть вопросов закрывается автоматически.'));
        },
      },
      {
        label: t('Пусть подождут'),
        apply: (s) => {
          addModifier(s, { id: 'support', label: t('Долгие ответы поддержки'), lever: 'churn', mult: 1.12 }, 8);
          s.product.rating = Math.max(1, s.product.rating - 0.2);
          addRelation(s, 'support', -10);
          return bad(t('Клиенты уходят, не дождавшись ответа.'), 'growth', -1);
        },
      },
    ],
  },
  {
    id: 'g_featuring',
    phases: ['growth'],
    weight: 1.5,
    once: true,
    condition: (s) => isB2C(s) && s.product.rating >= 4.4 && productContext(s).value >= 0.8,
    title: t('Apple хочет вас зафичерить'),
    text: (s) => t('Редакция App Store предлагает поставить {0} в подборку «Приложения недели».', [scenarioOf(s).productName]),
    options: [
      {
        label: t('Подготовить материалы (−3 SP)'),
        apply: (s) => {
          losePoints(s, 3);
          spike(s, 4000);
          return good(t('Фичеринг даст тысячи органических установок. Высокий рейтинг и качество окупаются.'));
        },
      },
      { label: t('Нет ресурсов'), apply: () => neutral(t('Упущенная возможность.')) },
    ],
  },
  {
    id: 'g_debt_crisis',
    phases: ['build', 'growth'],
    weight: 2.5,
    cooldown: 12,
    condition: (s) => s.product.debt > 55,
    title: t('Каждый релиз что-то ломает'),
    text: () => t('Разработчики: «Мы боимся трогать код — любое изменение ломает что-то в другом месте. Нужно время на рефакторинг».'),
    options: [
      {
        label: t('Выделить половину ресурсов на техдолг в этом цикле'),
        apply: (s) => {
          s.allocation = { features: 0.4, debt: 0.5, bugs: 0.1 };
          addRelation(s, 'cto', 10);
          return good(t('Технический долг — как кредит: проценты платятся скоростью команды. Регулярно выделяйте 15–25% на его погашение.'), 'delivery', 2);
        },
      },
      {
        label: t('Не сейчас'),
        apply: (s) => {
          addMorale(s, -5);
          addBugs(s, 8);
          addRelation(s, 'cto', -10);
          return bad(t('Скорость падает, багов больше, команда раздражена.'), 'delivery', -1);
        },
      },
    ],
  },
  {
    id: 'g_nocode_limits',
    phases: ['growth'],
    weight: 4,
    once: true,
    condition: (s) => s.tech.platform === 'nocode' && (lastRecord(s)?.truth.mau ?? 0) > scaleLimit(s) * 0.7,
    title: t('No-code упирается в потолок'),
    text: () => t('Приложение тормозит, часть функций невозможно сделать в конструкторе. Нужно решать, что дальше.'),
    options: [
      {
        label: t('Переписать продукт на код (−60 SP)'),
        apply: (s) => {
          losePoints(s, 60);
          s.tech.platform = flavor(s).codePlatform;
          addDebt(s, -20);
          return good(t('No-code отлично подходит для проверки гипотез, а переписывание после подтверждения спроса — нормальный путь.'), 'delivery', 1);
        },
      },
      {
        label: t('Перейти на enterprise-тариф платформы ($2 500/мес)'),
        apply: (s) => {
          s.flags.vendorTax = (s.flags.vendorTax ?? 0) + 2500;
          s.flags.scaleBoost = 3;
          return neutral(t('Потолок отодвинут, но платформа теперь заметная строка расходов.'));
        },
      },
      { label: t('Терпеть'), apply: () => bad(t('Пользователи страдают от тормозов, качество падает.'), 'delivery', -1) },
    ],
  },
  {
    id: 'g_partnership',
    phases: ['growth'],
    weight: 1,
    once: true,
    title: t('Предложение о партнёрстве'),
    text: (s) => flavor(s).partnership,
    options: [
      {
        label: t('Согласиться'),
        apply: (s) => {
          losePoints(s, 2);
          spike(s, isB2C(s) ? 3000 : 500);
          return neutral(t('Партнёрский трафик придёт в следующем месяце. Смотрите на когорту: такие пользователи конвертируются иначе, чем рекламные.'));
        },
      },
      { label: t('Отказаться'), apply: () => neutral(t('Фокус сохранён.')) },
    ],
  },

  // ---------------- Stakeholder questions (quiz-like) ----------------
  {
    id: 'q_cash_vs_mrr',
    phases: ['growth'],
    weight: 2,
    once: true,
    condition: (s) => s.history.length >= 3 && (mrrGrowth(s, 2) ?? 0) > 0 && estimatedBurn(s) > 0,
    title: t('Вопрос CEO: где деньги?'),
    text: (s) => t('{0}: «MRR растёт каждый месяц, а деньги на счёте тают быстрее, чем раньше. Объясни, почему?»', [ceo(s)]),
    options: [
      {
        label: t('Мы платим за клиента сразу (CAC), а возвращаем эти деньги постепенно за период окупаемости. Чем быстрее растём, тем больше уходит авансом'),
        apply: (s) => {
          addTrust(s, 4);
          return good(t('Верно. Рост на платном трафике «съедает» кэш до окупаемости CAC. Поэтому важны payback period и runway.'), 'finance', 2);
        },
      },
      {
        label: t('Нужно больше рекламы: масштаб всё исправит'),
        apply: () => bad(t('Если LTV/CAC < 1 или окупаемость дольше runway, масштаб только ускорит сжигание денег.'), 'finance', -2),
      },
      {
        label: t('Это ошибка бухгалтерии, деньги придут'),
        apply: (s) => {
          addTrust(s, -4);
          return bad(t('Это не ошибка: так работает юнит-экономика подписочного бизнеса.'), 'finance', -2);
        },
      },
    ],
  },
  {
    id: 'q_retention_drop',
    phases: ['growth'],
    weight: 2,
    once: true,
    condition: (s) => s.history.length >= 4,
    title: t('Вопрос инвестора про когорты'),
    text: () => t('Партнёр фонда: «Почему у ваших первых когорт удержание выше, чем у последних? Продукт же стал лучше».'),
    options: [
      {
        label: t('Первые пользователи — early adopters с острой проблемой. Масштабируя рекламу, мы привлекаем менее мотивированных людей'),
        apply: (s) => {
          addTrust(s, 4);
          return good(t('Верно. С ростом бюджета аудитория «размывается». Поэтому удержание смотрят по когортам и каналам, а не в среднем.'), 'growth', 2);
        },
      },
      {
        label: t('Это просто сезонность'),
        apply: () => neutral(t('Сезонность возможна, но это гипотеза, которую нужно проверить по данным, а не готовый ответ.')),
      },
      {
        label: t('Аналитика глючит'),
        apply: (s) => {
          addTrust(s, -3);
          return bad(t('Списывать неудобные данные на баги аналитики без проверки — плохая привычка.'), 'growth', -1);
        },
      },
    ],
  },
  {
    id: 'q_pvalue',
    phases: ['growth'],
    weight: 3,
    once: true,
    condition: (s) => s.experiments.some((e) => e.result && e.result.pValue > 0.2 && e.result.uplift > 0.04),
    title: t('Вопрос CEO про A/B-тест'),
    text: (s) => t('{0}: «В тесте вариант B лучше на несколько процентов, но ты говоришь, что внедрять рано, потому что p-value 0,3. Что это значит?»', [ceo(s)]),
    options: [
      {
        label: t('Если бы разницы на самом деле не было, такой или больший разрыв мы видели бы примерно в 30% случаев. Это похоже на шум'),
        apply: (s) => {
          addTrust(s, 3);
          return good(t('Верно. p-value — вероятность увидеть такой результат при отсутствии эффекта, а не вероятность, что B лучше.'), 'experiments', 2);
        },
      },
      {
        label: t('Это значит, что вариант B лучше с вероятностью 30%'),
        apply: () => bad(t('Частая ошибка интерпретации. p-value не говорит о вероятности того, что B лучше.'), 'experiments', -2),
      },
      {
        label: t('Неважно, внедряем — рост есть рост'),
        apply: () => bad(t('Внедрять шум — значит накапливать изменения, которые ничего не дают, а иногда вредят.'), 'experiments', -2),
      },
    ],
  },
  // ---------------- Regulation ----------------
  {
    id: 'g_privacy_fine',
    phases: ['growth'],
    weight: 1.2,
    cooldown: 24,
    condition: (s) => missingCompliance(s).includes('gdpr') && (lastRecord(s)?.truth.mau ?? 0) > 2000,
    title: t('Жалоба в регулятор по персональным данным'),
    text: () => t('Пользователь пожаловался регулятору: у вас нет согласий на обработку данных и нельзя удалить аккаунт. Пришёл запрос с угрозой штрафа.'),
    options: [
      {
        label: t('Заплатить штраф и сделать согласия (−4 SP)'),
        apply: (s) => {
          addCash(s, -15000);
          losePoints(s, 4);
          s.compliance.push('gdpr');
          return neutral(t('Приватность дешевле сделать заранее, чем после жалобы. Согласия немного ухудшат атрибуцию — это нормальная цена.'), 'stakeholders', -1);
        },
      },
      {
        label: t('Оспорить через юристов ($6 000)'),
        apply: (s, rng) => {
          addCash(s, -6000);
          if (chance(rng, 0.5)) {
            addCash(s, -25000);
            addTrust(s, -5);
            return bad(t('Спор проигран: штраф больше, а согласия всё равно придётся делать.'), 'stakeholders', -2);
          }
          return neutral(t('В этот раз обошлось, но риск остаётся, пока нет согласий.'));
        },
      },
    ],
  },
  {
    id: 'g_coppa',
    phases: ['growth'],
    weight: 2,
    once: true,
    condition: (s) => missingCompliance(s).includes('coppa'),
    title: t('Стор проверяет детский режим'),
    text: () => t('App Store и Google Play запросили подтверждение, что детский режим соответствует правилам защиты детей: согласие родителей, без трекинга и рекламы.'),
    options: [
      {
        label: t('Срочно внедрить защиту детей ($8 000, −5 SP)'),
        apply: (s) => {
          addCash(s, -8000);
          losePoints(s, 5);
          s.compliance.push('coppa');
          addModifier(s, { id: 'coppa_review', label: t('Повторная проверка в сторе'), lever: 'acquisition', mult: 0.85 }, 4);
          return good(t('Детские продукты требуют особых правил. Их закладывают в продукт до запуска функции.'), 'delivery', 1);
        },
      },
      {
        label: t('Рискнуть и ответить, что всё в порядке'),
        apply: (s, rng) => {
          if (chance(rng, 0.6)) {
            addCash(s, -30000);
            addModifier(s, { id: 'coppa_ban', label: t('Приложение снято со стора'), lever: 'acquisition', mult: 0.5 }, 4);
            addTrust(s, -8);
            return bad(t('Приложение сняли на месяц и выписали штраф. Регуляторика — не формальность.'), 'stakeholders', -3);
          }
          return bad(t('Проверка прошла поверхностно, но нарушение никуда не делось.'), 'stakeholders', -1);
        },
      },
    ],
  },
  {
    id: 'g_bank_audit',
    phases: ['growth'],
    weight: 1.5,
    once: true,
    condition: (s) => missingCompliance(s).includes('fin_review') && s.history.length >= 3,
    title: t('Банк-партнёр требует проверку'),
    text: () => t('Банк-партнёр, через которого идёт синхронизация счетов, требует аудит безопасности и политики хранения данных. Без него доступ ограничат.'),
    options: [
      {
        label: t('Пройти проверку ($15 000, −6 SP)'),
        apply: (s) => {
          addCash(s, -15000);
          losePoints(s, 6);
          s.compliance.push('fin_review');
          addModifier(s, { id: 'bank_audit', label: t('Синхронизация на проверке'), lever: 'activation', mult: 0.92 }, 4);
          return good(t('В регулируемых отраслях доверие партнёров и регуляторов — часть продукта.'), 'stakeholders', 2);
        },
      },
      {
        label: t('Попросить отсрочку'),
        apply: (s) => {
          addModifier(s, { id: 'bank_limit', label: t('Синхронизация ограничена банком'), lever: 'activation', mult: 0.75 }, 8);
          addModifier(s, { id: 'bank_limit_churn', label: t('Счета не обновляются'), lever: 'churn', mult: 1.15 }, 8);
          addTrust(s, -5);
          return bad(t('Банк ограничил доступ: часть пользователей не видит свежих транзакций и уходит.'), 'stakeholders', -2);
        },
      },
    ],
  },

  // ---------------- Stakeholders ----------------
  {
    id: 's_cto_debt',
    phases: ['build', 'growth'],
    weight: 1.2,
    cooldown: 16,
    condition: (s) => s.product.debt > 25 && s.stakeholders.cto < 75,
    title: t('CTO просит время на техдолг'),
    text: () => t('CTO: «Мы три спринта подряд делаем только фичи. Дайте четверть времени на рефакторинг, иначе через пару месяцев скорость упадёт вдвое».'),
    options: [
      {
        label: t('Выделить 25% времени команды'),
        apply: (s) => {
          s.allocation = { features: 0.6, debt: 0.25, bugs: 0.15 };
          addRelation(s, 'cto', 12);
          return good(t('Регулярная работа с техдолгом сохраняет скорость команды.'), 'delivery', 1);
        },
      },
      {
        label: t('Договориться на 15% и вернуться к вопросу через месяц'),
        apply: (s) => {
          s.allocation = { features: 0.7, debt: 0.15, bugs: 0.15 };
          addRelation(s, 'cto', 5);
          return good(t('Компромисс с понятным сроком пересмотра — нормальная договорённость.'), 'stakeholders', 1);
        },
      },
      {
        label: t('Отказать: сейчас важнее функции'),
        apply: (s) => {
          addRelation(s, 'cto', -12);
          return bad(t('CTO чувствует, что его не слышат. Долг продолжает копиться.'), 'stakeholders', -1);
        },
      },
    ],
  },
  {
    id: 's_marketing_campaign',
    phases: ['growth'],
    weight: 1,
    cooldown: 16,
    title: t('Маркетинг хочет имиджевую кампанию'),
    text: () => t('Руководитель маркетинга: «Перформанс упирается в потолок. Дайте $8 000 на имиджевую кампанию — бренд окупится».'),
    options: [
      {
        label: t('Согласиться на $8 000'),
        apply: (s) => {
          addCash(s, -8000);
          spike(s, isB2C(s) ? 1200 : 150);
          addRelation(s, 'marketing', 10);
          return neutral(t('Имиджевую рекламу сложно измерить. Заранее договоритесь, по какой метрике оцените результат.'));
        },
      },
      {
        label: t('Предложить тест за $2 000 с понятной метрикой'),
        apply: (s) => {
          addCash(s, -2000);
          spike(s, isB2C(s) ? 300 : 40);
          addRelation(s, 'marketing', 4);
          return good(t('Маленький тест с заранее выбранной метрикой — честный способ проверить идею коллеги.'), 'growth', 1);
        },
      },
      {
        label: t('Отказать'),
        apply: (s) => {
          addRelation(s, 'marketing', -10);
          return neutral(t('Деньги сохранены, но маркетинг обижен и будет менее гибким.'));
        },
      },
    ],
  },
  {
    id: 's_support_help',
    phases: ['growth'],
    weight: 1.2,
    cooldown: 16,
    condition: (s) => s.product.bugs > 25 || s.stakeholders.support < 45,
    title: t('Поддержка просит помощи'),
    text: () => t('Руководитель поддержки: «Половина обращений — про одни и те же баги. Мы не успеваем отвечать и выгораем».'),
    options: [
      {
        label: t('Неделя багфикса: половина времени команды на баги'),
        apply: (s) => {
          s.allocation = { features: 0.35, debt: 0.15, bugs: 0.5 };
          addRelation(s, 'support', 10);
          addRelation(s, 'cto', 3);
          return good(t('Баги — это продукт, а не проблема поддержки. Частые обращения — сигнал, что чинить в первую очередь.'), 'delivery', 1);
        },
      },
      {
        label: t('Нанять человека в поддержку через аутсорс'),
        apply: (s, rng) => {
          hireMember(s, rng, 'support', 'middle', 'outsource');
          addRelation(s, 'support', 8);
          return neutral(t('Поддержке легче, но причина обращений — баги — осталась.'));
        },
      },
      {
        label: t('Пусть справляются'),
        apply: (s) => {
          addRelation(s, 'support', -12);
          return bad(t('Поддержка выгорает, ответы становятся медленнее, клиенты злятся.'), 'stakeholders', -1);
        },
      },
    ],
  },
  {
    id: 's_priority_conflict',
    phases: ['growth'],
    weight: 1.4,
    cooldown: 20,
    title: t('Три срочных запроса на одну команду'),
    text: (s) =>
      t('На планировании сразу три «срочных» запроса: CTO хочет рефакторинг, маркетинг — лендинг под кампанию, {0}. На всё команды не хватит.', [scenarioOf(s).kind === 'b2b' ? t('продажи — интеграцию для крупного клиента') : t('поддержка — экран помощи и FAQ')]),
    options: [
      {
        label: t('Отдать спринт CTO'),
        apply: (s) => {
          addRelation(s, 'cto', 8);
          addRelation(s, 'marketing', -6);
          addRelation(s, isB2C(s) ? 'support' : 'sales', -6);
          addDebt(s, -8);
          losePoints(s, 6);
          return neutral(t('Техдолг стал меньше, но двое коллег недовольны.'));
        },
      },
      {
        label: t('Отдать спринт маркетингу'),
        apply: (s) => {
          addRelation(s, 'marketing', 8);
          addRelation(s, 'cto', -6);
          addRelation(s, isB2C(s) ? 'support' : 'sales', -6);
          losePoints(s, 6);
          s.product.leverMods.registration *= 1.02;
          return neutral(t('Лендинг вышел, но двое коллег недовольны.'));
        },
      },
      {
        label: t('Расставить приоритеты по данным и объяснить всем логику'),
        apply: (s) => {
          for (const id of ['cto', 'marketing', 'support', 'sales'] as const) addRelation(s, id, 2);
          return good(t('Прозрачная приоритизация по целям и данным снижает конфликты: люди легче принимают «нет», когда видят логику.'), 'stakeholders', 2);
        },
      },
    ],
  },
  {
    id: 's_sales_discount',
    phases: ['growth'],
    weight: 1.2,
    cooldown: 16,
    condition: (s) => scenarioOf(s).kind === 'b2b' && hasRole(s, 'sales') && s.pricing.dealDiscount < 0.2,
    title: t('Продажи просят скидки'),
    text: () => t('Руководитель продаж: «Чтобы закрыть квартал, дайте право на скидку до 20%. Конкуренты так делают».'),
    options: [
      {
        label: t('Разрешить скидку до 20%'),
        apply: (s) => {
          s.pricing.dealDiscount = 0.2;
          addRelation(s, 'sales', 10);
          return neutral(t('Сделок станет больше, но средний чек ниже. Клиенты быстро привыкают ждать скидку.'));
        },
      },
      {
        label: t('Разрешить до 10% для годовых договоров'),
        apply: (s) => {
          s.pricing.dealDiscount = 0.1;
          addRelation(s, 'sales', 5);
          return good(t('Скидка в обмен на годовой договор — честный обмен: вы получаете деньги вперёд и меньший отток.'), 'finance', 1);
        },
      },
      {
        label: t('Отказать: продаём ценность, а не скидку'),
        apply: (s) => {
          addRelation(s, 'sales', -8);
          return neutral(t('Чек сохранён, но продажи считают, что им связали руки.'));
        },
      },
    ],
  },
  {
    id: 'board_meeting',
    phases: ['growth'],
    weight: 0,
    manual: true,
    prepare: (s) => {
      const quarter = s.history.slice(-3);
      return {
        mrrStart: Math.round(quarter[0]?.mrr ?? 0),
        mrrEnd: Math.round(quarter[quarter.length - 1]?.mrr ?? 0),
        installs: Math.round(quarter.reduce((sum, r) => sum + (r.truth.acquired ?? 0), 0)),
        nsStart: Math.round(quarter[0]?.obs.northStar ?? -1),
        nsEnd: Math.round(quarter[quarter.length - 1]?.obs.northStar ?? -1),
      };
    },
    title: t('Совет директоров'),
    text: (s, d) => {
      const last = lastRecord(s);
      const ltvCac = last?.obs.ltvCac;
      const okr = s.okrs.find((o) => o.evaluated && o.dueMonth === s.history.length);
      const okrText = okr ? t(' Квартальные цели: выполнено {0} из {1}.', [okr.goals.filter((g) => g.met).length, okr.goals.length]) : t(' Целей на квартал не было.');
      const nsText = Number(d.nsEnd) >= 0 ? ` North Star: ${num(Math.max(0, Number(d.nsStart)))} → ${num(Number(d.nsEnd))}.` : '';
      return t('Квартальная встреча с советом. MRR за квартал: {0} → {1}. LTV/CAC: {2}. Runway: {3} мес. За квартал — {4} новых пользователей.{5}{6} Как построите отчёт?', [money(Number(d.mrrStart)), money(Number(d.mrrEnd)), ltvCac ? fixed(ltvCac, 1) : '—', fixed(runway(s), 1), fixed(Number(d.installs), 0), nsText, okrText]);
    },
    options: [
      {
        label: t('Честно: actionable-метрики, проблемы и план их решения'),
        apply: (s) => {
          const p = quarterPerformance(s);
          let delta = Math.round(10 * p);
          let text = p >= 0 ? t('Совет видит прогресс и доверяет вашим цифрам.') : t('Цифры слабые, но совет ценит честность и понятный план.');
          if ((s.flags.vanityUsed ?? 0) > 0) {
            delta -= 8;
            text += t(' Правда, совет заметил, что прошлый отчёт рисовал картину лучше реальности.');
            s.flags.vanityUsed = 0;
          }
          addTrust(s, Math.max(delta, -6));
          return good(text, 'stakeholders', 2);
        },
      },
      {
        label: t('Сделать акцент на ваниті-метриках: установки, регистрации, охват'),
        apply: (s, rng) => {
          const p = quarterPerformance(s);
          if (p < 0 && chance(rng, 0.5)) {
            addTrust(s, -20);
            s.flags.vanityUsed = 0;
            return bad(t('Член совета спросил про удержание и окупаемость. Красивая картинка развалилась, доверие резко упало.'), 'stakeholders', -4);
          }
          addTrust(s, 5);
          s.flags.vanityUsed = 1;
          return bad(t('Совет доволен большими числами. Но ваниті-метрики не отвечают на главный вопрос — работает ли бизнес. Рано или поздно это вскроется.'), 'stakeholders', -2);
        },
      },
    ],
  },
];
