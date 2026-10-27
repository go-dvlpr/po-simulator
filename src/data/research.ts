import type { CriterionDef, HypothesisKind, ResearchMethod, ResearchParams } from '../engine/types.ts';
import { t } from '../i18n/index.ts';

export const HYPOTHESIS_KIND_NAMES: Record<HypothesisKind, string> = {
  problem: t('Проблема'),
  wtp: t('Готовность платить'),
  channel: t('Канал привлечения'),
  solution: t('Решение (ценность)'),
};

export const HYPOTHESIS_KIND_HINTS: Record<HypothesisKind, string> = {
  problem: t('Есть ли у сегмента острая проблема, которую он уже пытается решать?'),
  wtp: t('Готовы ли люди платить выбранную цену — деньгами, а не словами?'),
  channel: t('Можно ли дёшево достучаться до сегмента через этот канал?'),
  solution: t('Решает ли наш продукт проблему так, что люди возвращаются?'),
};

export const CRITERIA: CriterionDef[] = [
  {
    id: 'p_interview',
    kind: 'problem',
    method: 'interviews',
    observation: 'painShare',
    quality: 'strong',
    template: t('Интервью: ≥ {t}% собеседников описывают проблему на реальных примерах из прошлого опыта'),
    thresholds: [40, 60, 80],
    unit: '%',
    lesson: t('Хороший критерий: опирается на прошлое поведение, а не на мнения. Но работает только с открытыми (не наводящими) вопросами.'),
  },
  {
    id: 'p_survey',
    kind: 'problem',
    method: 'survey',
    observation: 'surveyPainShare',
    quality: 'medium',
    template: t('Опрос: ≥ {t}% респондентов оценивают остроту проблемы на 4–5 из 5'),
    thresholds: [30, 50, 70],
    unit: '%',
    lesson: t('Средний критерий: опросы дают масштаб, но люди склонны преувеличивать проблему, когда их о ней спрашивают.'),
  },
  {
    id: 'p_smoke',
    kind: 'problem',
    method: 'smoke',
    observation: 'smokeCr',
    quality: 'strong',
    template: t('Smoke-тест: ≥ {t}% посетителей лендинга оставляют email'),
    thresholds: [4, 8, 12],
    unit: '%',
    lesson: t('Сильный критерий: измеряет реальное действие людей, которые не знают, что участвуют в эксперименте.'),
  },
  {
    id: 'p_like',
    kind: 'problem',
    method: 'interviews',
    observation: 'likeShare',
    quality: 'invalid',
    template: t('Собеседникам нравится наша идея'),
    thresholds: [0],
    unit: '',
    lesson: t('Плохой критерий: «нравится» — вежливость, а не проблема. Такую гипотезу нельзя опровергнуть, поэтому она «подтверждается» всегда.'),
  },
  {
    id: 'w_survey',
    kind: 'wtp',
    method: 'survey',
    observation: 'vwAcceptable',
    quality: 'medium',
    template: t('Опрос (Van Westendorp): приемлемая цена ≥ цены гипотезы'),
    thresholds: [0],
    unit: '$',
    lesson: t('Средний критерий: заявленная готовность платить обычно в 1,5–2 раза выше реальной (say–do gap).'),
  },
  {
    id: 'w_fakedoor',
    kind: 'wtp',
    method: 'smoke',
    observation: 'fakeDoorRate',
    quality: 'strong',
    template: t('Fake door: ≥ {t}% посетителей нажимают «Купить» при цене гипотезы'),
    thresholds: [2, 3.5, 5],
    unit: '%',
    lesson: t('Сильный критерий: клик по кнопке с ценой — поведенческий сигнал. Цена на лендинге должна совпадать с ценой гипотезы.'),
  },
  {
    id: 'w_concierge',
    kind: 'wtp',
    method: 'concierge',
    observation: 'conciergePaid',
    quality: 'strong',
    template: t('Консьерж-MVP: ≥ {t}% участников реально платят цену гипотезы'),
    thresholds: [20, 35, 50],
    unit: '%',
    lesson: t('Самый сильный критерий: реальные деньги за реальную ценность. Минус — маленькая выборка и высокая стоимость.'),
  },
  {
    id: 'w_would',
    kind: 'wtp',
    method: 'survey',
    observation: 'wouldPayShare',
    quality: 'invalid',
    template: t('Респонденты говорят, что готовы платить за такой продукт'),
    thresholds: [0],
    unit: '',
    lesson: t('Плохой критерий: «готов платить» в опросе ничего не стоит респонденту. Нет порога — нечего опровергать.'),
  },
  {
    id: 'c_smoke',
    kind: 'channel',
    method: 'smoke',
    observation: 'smokeCpl',
    quality: 'strong',
    template: t('Smoke-тест в канале: стоимость лида (CPL) ≤ ${t}'),
    thresholds: [],
    unit: '$',
    lowerIsBetter: true,
    lesson: t('Сильный критерий: реальная стоимость лида в канале на небольшом бюджете. Учтите, что при масштабировании она вырастет.'),
  },
  {
    id: 'c_expert',
    kind: 'channel',
    method: 'expert',
    observation: 'channelPresence',
    quality: 'weak',
    template: t('Эксперты подтверждают, что наша аудитория есть в этом канале'),
    thresholds: [0],
    unit: '',
    lesson: t('Слабый критерий: «аудитория там есть» не говорит, сколько стоит её привлечь.'),
  },
  {
    id: 's_prototype',
    kind: 'solution',
    method: 'prototype',
    observation: 'prototypeSuccess',
    quality: 'strong',
    template: t('Тест прототипа: ≥ {t}% участников проходят ключевой сценарий и оценивают ценность на 4–5'),
    thresholds: [45, 60, 75],
    unit: '%',
    lesson: t('Хороший критерий для ранней проверки решения: дёшево и быстро, но это ещё не реальное использование.'),
  },
  {
    id: 's_concierge',
    kind: 'solution',
    method: 'concierge',
    observation: 'conciergeActive',
    quality: 'strong',
    template: t('Консьерж-MVP: ≥ {t}% участников активны на 4-й неделе'),
    thresholds: [30, 45, 60],
    unit: '%',
    lesson: t('Сильный критерий: удержание — лучший индикатор ценности решения.'),
  },
  {
    id: 's_interview',
    kind: 'solution',
    method: 'interviews',
    observation: 'wouldUseShare',
    quality: 'weak',
    template: t('Интервью: ≥ {t}% собеседников говорят, что пользовались бы продуктом'),
    thresholds: [50, 70],
    unit: '%',
    lesson: t('Слабый критерий: вопрос о будущем («пользовались бы?») почти всегда получает «да».'),
  },
];

export function criterionDef(id: string): CriterionDef {
  const c = CRITERIA.find((x) => x.id === id);
  if (!c) throw new Error(`unknown criterion ${id}`);
  return c;
}

export interface ResearchMethodDef {
  id: ResearchMethod;
  name: string;
  description: string;
  measures: string;
  needsSegment: boolean;
  article: string;
}

export const RESEARCH_METHODS: ResearchMethodDef[] = [
  {
    id: 'desk',
    name: t('Кабинетное исследование рынка'),
    description: t('Отчёты аналитиков, статистика, обзоры рынка. Оценка TAM/SAM/SOM по сегментам.'),
    measures: t('Размер рынка (с погрешностью), тренды'),
    needsSegment: false,
    article: 'market-sizing',
  },
  {
    id: 'competitors',
    name: t('Анализ конкурентов'),
    description: t('Разбор 4 конкурентов: функции, цены, отзывы в сторах и на G2.'),
    measures: t('Обязательные функции рынка, ценовые ориентиры'),
    needsSegment: false,
    article: 'competitors',
  },
  {
    id: 'expert',
    name: t('Экспертные интервью'),
    description: t('3 разговора с людьми из индустрии: маркетологи, инвесторы, владельцы похожих продуктов.'),
    measures: t('Подсказки по каналам и бенчмаркам (субъективные)'),
    needsSegment: true,
    article: 'performance-marketing',
  },
  {
    id: 'interviews',
    name: t('Глубинные интервью (CustDev)'),
    description: t('Разговоры 1-на-1 с представителями сегмента. Качество сильно зависит от сценария вопросов.'),
    measures: t('Острота проблемы, текущие решения, цитаты, важные функции'),
    needsSegment: true,
    article: 'custdev',
  },
  {
    id: 'survey',
    name: t('Количественный опрос'),
    description: t('Анкета через панель респондентов. Шкалы, приоритеты функций, ценовой опрос Van Westendorp.'),
    measures: t('Заявленная острота проблемы, заявленная цена, рейтинг функций'),
    needsSegment: true,
    article: 'surveys',
  },
  {
    id: 'smoke',
    name: t('Smoke-тест лендинга + fake door'),
    description: t('Лендинг с ценностным предложением и ценой, трафик из рекламного канала, сбор email и клики «Купить».'),
    measures: t('Реальная конверсия, CPL канала, клики по цене, лист ожидания'),
    needsSegment: true,
    article: 'mvp-types',
  },
  {
    id: 'prototype',
    name: t('Юзабилити-тест прототипа'),
    description: t('Кликабельный прототип в Figma, 8 участников из сегмента проходят ключевые сценарии.'),
    measures: t('Понятность решения, оценка ценности, проблемы UX'),
    needsSegment: true,
    article: 'mvp-types',
  },
  {
    id: 'concierge',
    name: t('Консьерж-MVP'),
    description: t('Оказываете услугу вручную 12 клиентам в течение 4 недель и в конце просите заплатить.'),
    measures: t('Реальное удержание и реальная оплата (маленькая выборка)'),
    needsSegment: true,
    article: 'mvp-types',
  },
];

export function researchMethodDef(id: ResearchMethod): ResearchMethodDef {
  const m = RESEARCH_METHODS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown research method ${id}`);
  return m;
}

// Duration and cost of a research activity.
export function researchPlan(method: ResearchMethod, params: ResearchParams, isB2B: boolean): { weeks: number; cost: number } {
  switch (method) {
    case 'desk':
      return { weeks: 1, cost: 300 };
    case 'competitors':
      return { weeks: 1, cost: 500 };
    case 'expert':
      return { weeks: 1, cost: 600 };
    case 'interviews': {
      const n = params.count ?? 10;
      const perInterview = isB2B ? 90 : 40;
      return { weeks: Math.ceil(n / 5), cost: 200 + n * perInterview };
    }
    case 'survey': {
      const n = params.count ?? 300;
      const perResponse = isB2B ? 9 : 3;
      return { weeks: n >= 1000 ? 2 : 1, cost: 300 + n * perResponse };
    }
    case 'smoke':
      return { weeks: 2, cost: (params.budget ?? 2500) + 400 };
    case 'prototype':
      return { weeks: 2, cost: 1200 };
    case 'concierge':
      return { weeks: 4, cost: 1500 };
  }
}

export const RESEARCH_SLOTS = 2;
