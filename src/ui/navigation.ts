import type { GameState, Phase } from '../engine/types.ts';
import { missingCompliance } from '../engine/market.ts';
import { stakeholderIds } from '../engine/stakeholders.ts';
import type { IconName } from './components/Icon.tsx';
import { t } from '../i18n/index.ts';

export interface PhaseDef {
  id: Phase;
  label: string;
  icon: IconName;
}

export interface SectionDef {
  id: string;
  label: string;
  icon: IconName;
  // One line under the page title.
  desc: string;
  // What to do on this page, shown behind "?".
  help?: string;
  // Handbook articles linked from the page header.
  articles?: { id: string; label: string }[];
  // Sections of one group share a sidebar item and show as tabs.
  group?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: IconName;
  sections: SectionDef[];
}

export const PHASES: PhaseDef[] = [
  { id: 'discovery', label: t('Исследование'), icon: 'flask' },
  { id: 'strategy', label: t('Стратегия'), icon: 'target' },
  { id: 'setup', label: t('Подготовка'), icon: 'layers' },
  { id: 'build', label: t('Разработка'), icon: 'code' },
  { id: 'launch', label: t('Запуск'), icon: 'rocket' },
  { id: 'growth', label: t('Рост'), icon: 'trending' },
  { id: 'end', label: t('Итоги'), icon: 'trophy' },
];

const GROUPS: Record<string, { label: string; icon: IconName }> = {
  product: { label: t('Продукт'), icon: 'box' },
  market: { label: t('Рынок и маркетинг'), icon: 'megaphone' },
  data: { label: t('Данные и деньги'), icon: 'activity' },
  people: { label: t('Команда'), icon: 'users' },
};

const TEAM_HELP = t('Разработчики дают story points, остальные роли усиливают свою область: QA снижает баги, маркетолог удешевляет рекламу, продажи закрывают B2B-сделки. Зарплата идёт с первого рабочего дня.');
const TECH_HELP = t('Платформу, бэкенд и платежи можно выбрать только до начала разработки. Аналитику, A/B-инфраструктуру и практики можно подключить позже, но команде понадобится время на настройку.');

export const SECTIONS: Record<Phase, SectionDef[]> = {
  discovery: [
    {
      id: 'board',
      label: t('Гипотезы и исследования'),
      icon: 'flask',
      desc: t('Сформулируйте гипотезы с критериями успеха и проверьте их исследованиями'),
      help: t('Сначала гипотеза, потом исследование. Начните с самого рискованного: есть ли у сегмента острая проблема и готов ли он платить. Каждая неделя стоит денег, а CEO ждёт решения. Когда данных хватит, нажмите «Перейти к стратегии».'),
      articles: [
        { id: 'hypotheses', label: t('Гипотезы') },
        { id: 'custdev', label: 'CustDev' },
        { id: 'mvp-types', label: t('Виды MVP') },
      ],
    },
    { id: 'reports', label: t('Отчёты'), icon: 'file', desc: t('Результаты исследований: цифры, выводы и цитаты'), help: t('Сравнивайте сегменты по поведению людей, а не по словам. Цитаты помогают понять боль, а цифры — её масштаб.') },
    { id: 'segments', label: t('Сегменты рынка'), icon: 'users', desc: t('Четыре возможные аудитории и всё, что вы о них узнали'), help: t('Какой сегмент лучший — скрыто и меняется от игры к игре. Сравните их по данным исследований.'), articles: [{ id: 'segmentation', label: t('Сегментация') }] },
    { id: 'team', label: t('Найм заранее'), icon: 'userPlus', desc: t('Найм в штат занимает 3–6 недель: можно начать до конца исследований'), help: t('Нанятые заранее люди выйдут к началу разработки. Но зарплата пойдёт с первого рабочего дня, даже если исследования покажут, что идея не работает.'), articles: [{ id: 'team', label: t('Команда') }] },
  ],
  strategy: [
    {
      id: 'strategy',
      label: t('Стратегия продукта'),
      icon: 'target',
      desc: t('Выберите сегмент, обещание, главную метрику и модель монетизации'),
      help: t('Опирайтесь на данные исследований, а не на интуицию CEO. Под каждым сегментом видно, что вы о нём узнали. После утверждения вернуться к исследованиям нельзя.'),
      articles: [
        { id: 'segmentation', label: t('Сегменты') },
        { id: 'value-prop', label: t('Позиционирование') },
        { id: 'north-star', label: 'North Star' },
        { id: 'pricing', label: t('Цены') },
      ],
    },
  ],
  setup: [
    {
      id: 'mvp',
      label: t('Объём MVP'),
      icon: 'box',
      desc: t('Отметьте функции, без которых продукт не решит главную проблему сегмента'),
      help: t('Обязательные функции уже отмечены. Каждая лишняя функция удлиняет разработку. Оценки команды обычно оптимистичны.'),
      articles: [{ id: 'prioritization', label: 'ICE / Kano' }, { id: 'mvp-types', label: 'MVP' }],
    },
    { id: 'tech', label: t('Технологии'), icon: 'server', desc: t('Платформа, архитектура, аналитика и практики разработки'), help: TECH_HELP, articles: [{ id: 'tech-stack', label: t('Технологии') }] },
    { id: 'team', label: t('Команда'), icon: 'users', desc: t('Кого нанять до начала разработки'), help: TEAM_HELP, articles: [{ id: 'team', label: t('Команда') }] },
    {
      id: 'plan',
      label: t('План и срок'),
      icon: 'calendar',
      desc: t('Оцените срок и пообещайте CEO дату запуска с запасом'),
      help: t('Оценка — это прогноз, а не обещание. Реальная работа часто на 15–50% больше, плюс внеплановые задачи и события. Если планируете закрытую бету, добавьте ещё 4 недели.'),
      articles: [{ id: 'agile', label: t('Оценки') }],
    },
  ],
  build: [
    { id: 'sprint', label: t('Спринт'), icon: 'zap', desc: t('Распределите время команды и проводите спринты до готовности MVP'), help: t('Каждый спринт — две недели. Следите за багами и техдолгом: они замедляют команду. Когда обязательные функции готовы, переходите к запуску — лишние спринты сдвигают обещанный срок.'), articles: [{ id: 'agile', label: t('Спринты') }, { id: 'tech-debt', label: t('Техдолг') }] },
    { id: 'scope', label: t('Объём MVP'), icon: 'box', desc: t('Можно убрать или добавить функции по ходу разработки'), help: t('Убрать незавершённую функцию — нормальный способ успеть к сроку. Готовые функции убрать нельзя.') },
    { id: 'team', label: t('Команда'), icon: 'users', desc: t('Найм и увольнения во время разработки'), help: TEAM_HELP },
    { id: 'tech', label: t('Технологии'), icon: 'server', desc: t('Что ещё можно подключить по ходу разработки'), help: TECH_HELP },
  ],
  launch: [
    {
      id: 'launch',
      label: t('Подготовка к запуску'),
      icon: 'rocket',
      desc: t('Бета, чек-лист и стратегия выхода на рынок'),
      help: t('Бета показывает первые метрики и находит баги, но сдвигает запуск на 4 недели. Пункты чек-листа страхуют от дорогих проблем после запуска. После запуска игра идёт по месяцам.'),
      articles: [{ id: 'launch', label: t('Запуск') }],
    },
  ],
  growth: [
    {
      id: 'overview',
      label: t('Обзор'),
      icon: 'grid',
      desc: t('Главные метрики месяца, цели и то, что требует решения'),
      help: t('Каждый ход — месяц. Посмотрите, что изменилось, настройте маркетинг, продукт и тесты, затем нажмите «Завершить месяц». Рядом с метриками — нормы рынка: так видно, где слабое место воронки.'),
      articles: [{ id: 'unit-economics', label: t('Юнит-экономика') }, { id: 'aarrr', label: t('Воронка') }],
    },
    { id: 'product', label: t('Разработка'), icon: 'box', group: 'product', desc: t('Очередь функций, время команды и способ выпуска'), help: t('Команда делает функции сверху вниз. Поднимайте то, что по данным принесёт больше пользы. Выпуск за фича-флагом покажет реальный эффект каждой функции.'), articles: [{ id: 'prioritization', label: t('Приоритизация') }, { id: 'feature-flags', label: t('Фича-флаги') }] },
    { id: 'experiments', label: t('A/B-тесты'), icon: 'split', group: 'product', desc: t('Проверяйте изменения на части пользователей'), help: t('Перед запуском теста посмотрите на мощность: если она ниже 50%, тест почти наверняка ничего не покажет. Решение принимайте по p-value, SRM и guardrail-метрикам.'), articles: [{ id: 'ab-testing', label: t('Основы') }, { id: 'ab-pitfalls', label: t('Ошибки') }] },
    { id: 'research', label: t('Гипотезы и интервью'), icon: 'flask', group: 'product', desc: t('Исследования продолжаются после запуска'), help: t('Проверяйте новые гипотезы: другой сегмент перед пивотом, готовность платить больше, причины оттока. Результаты приходят в конце месяца.'), articles: [{ id: 'custdev', label: 'CustDev' }] },
    { id: 'inbox', label: t('Входящие'), icon: 'inbox', group: 'product', desc: t('Отзывы, обращения в поддержку, запросы продаж и CEO'), help: t('Пишут самые активные и недовольные. Используйте входящие как сигнал, который надо проверить исследованием, а не как готовый план.'), articles: [{ id: 'feedback', label: t('Обратная связь') }] },
    { id: 'marketing', label: t('Каналы'), icon: 'megaphone', group: 'market', desc: t('Бюджеты рекламы, органика и CRM'), help: t('Начните с 1–2 каналов и небольших сумм. Удвоение бюджета не удваивает результат. Решения принимайте по реальному blended CAC, а не по цифрам кабинетов.'), articles: [{ id: 'performance-marketing', label: t('Перформанс') }, { id: 'attribution', label: t('Атрибуция') }] },
    {
      id: 'competition',
      label: t('Рынок и конкуренты'),
      icon: 'globe',
      group: 'market',
      desc: t('Конкуренты, регуляторика и выход на новые рынки'),
      help: t('Конкуренты копируют то, что у вас работает, и иногда снижают цены. Уникальные функции снижают давление. Регуляторика стоит денег, но без неё бывают штрафы и потерянные сделки.'),
      articles: [{ id: 'competitors', label: t('Конкуренты') }, { id: 'legal-security', label: t('Безопасность и право') }],
    },
    { id: 'money', label: t('Монетизация'), icon: 'card', group: 'market', desc: t('Модель, цена, тарифы и пивот'), help: t('Новую цену безопаснее сначала проверить A/B-тестом и смотреть на выручку с пользователя. Повышение для всех текущих клиентов вызовет волну отписок.'), articles: [{ id: 'pricing', label: t('Цены') }] },
    { id: 'analytics', label: t('Аналитика'), icon: 'activity', group: 'data', desc: t('Воронка, когорты, исследования и история изменений'), help: t('Найдите шаг воронки, который сильнее всего ниже нормы, — это главное место для работы. Когорты показывают, становится ли продукт лучше со временем.'), articles: [{ id: 'analytics', label: t('Аналитика') }, { id: 'retention', label: t('Удержание') }] },
    { id: 'finance', label: t('Финансы'), icon: 'wallet', group: 'data', desc: t('Деньги, burn и прибыль по месяцам'), help: t('Следите за runway: деньги кончаются быстрее, чем кажется. Рост на платной рекламе сначала сжигает деньги и только потом окупается.'), articles: [{ id: 'finance', label: t('Финансы') }] },
    { id: 'team', label: t('Команда'), icon: 'users', group: 'people', desc: t('Найм, роли и зарплаты'), help: TEAM_HELP },
    {
      id: 'stakeholders',
      label: t('Стейкхолдеры'),
      icon: 'briefcase',
      group: 'people',
      desc: t('Отношения с руководителями направлений'),
      help: t('CTO, продажи, маркетинг и поддержка реагируют на ваши решения. Испорченные отношения ухудшают работу их области, хорошие — немного помогают. Прозрачная приоритизация помогает договориться со всеми.'),
      articles: [{ id: 'stakeholders', label: t('Стейкхолдеры') }],
    },
    { id: 'tech', label: t('Технологии'), icon: 'server', group: 'people', desc: t('Аналитика, A/B-инфраструктура и практики'), help: TECH_HELP },
  ],
  end: [
    { id: 'summary', label: t('Результат'), icon: 'trophy', desc: t('Чем закончились 18 месяцев и как оценены ваши решения') },
    { id: 'debrief', label: t('Разбор рынка'), icon: 'eye', desc: t('Скрытая правда о рынке рядом с вашими выводами') },
    { id: 'log', label: t('Журнал решений'), icon: 'compass', desc: t('Каждое оценённое решение с объяснением') },
  ],
};

export function phaseIndex(phase: Phase): number {
  return PHASES.findIndex((p) => p.id === phase);
}

export function sectionDef(phase: Phase, id: string): SectionDef {
  return SECTIONS[phase].find((s) => s.id === id) ?? SECTIONS[phase][0];
}

// Sidebar items: a section on its own, or a group of sections shown as tabs.
export function navGroups(phase: Phase): NavGroup[] {
  const out: NavGroup[] = [];
  for (const s of SECTIONS[phase]) {
    const key = s.group ?? s.id;
    const existing = out.find((g) => g.id === key);
    if (existing) existing.sections.push(s);
    else out.push({ id: key, label: s.group ? GROUPS[s.group].label : s.label, icon: s.group ? GROUPS[s.group].icon : s.icon, sections: [s] });
  }
  return out;
}

export function groupOf(phase: Phase, sectionId: string): NavGroup {
  return navGroups(phase).find((g) => g.sections.some((s) => s.id === sectionId)) ?? navGroups(phase)[0];
}

// Counters that tell the player something waits for them.
export function sectionBadges(state: GameState): Record<string, number> {
  return {
    reports: state.phase === 'discovery' ? state.reports.length : 0,
    experiments: state.experiments.filter((e) => e.status === 'done').length,
    inbox: state.inbox.filter((m) => m.week === state.week).length,
    competition: state.phase === 'growth' ? missingCompliance(state).length : 0,
    stakeholders: stakeholderIds(state).filter((id) => state.stakeholders[id] < 30).length,
  };
}
