import type { PracticeDef, ProcessDef, TechCategory, TechOption } from '../engine/types.ts';
import { t } from '../i18n/index.ts';

export const TECH_CATEGORY_NAMES: Record<TechCategory, string> = {
  platform: t('Платформа клиента'),
  backend: t('Архитектура бэкенда'),
  infra: t('Инфраструктура'),
  analytics: t('Продуктовая аналитика'),
  experiments: t('A/B-тесты и фича-флаги'),
  payments: t('Платежи'),
  auth: t('Аутентификация'),
};

export const BACKEND_OPTIONS: TechOption[] = [
  {
    id: 'monolith',
    name: t('Модульный монолит (Go/Node.js + PostgreSQL)'),
    description: t('Одно приложение, разделённое на модули. Стандартный выбор для стартапа.'),
    pros: [t('Быстро разрабатывать и деплоить'), t('Просто отлаживать'), t('Легко нанять людей')],
    cons: [t('При большом росте потребуется дробить на сервисы')],
    mods: { velocity: 1, infraFixed: 250, infraPerUser: 0.012 },
  },
  {
    id: 'microservices',
    name: t('Микросервисы с первого дня'),
    description: t('Десяток сервисов, брокер сообщений, отдельные базы.'),
    pros: [t('Независимое масштабирование'), t('Звучит солидно для инвесторов')],
    cons: [t('Медленнее разработка на 25–30%'), t('Больше багов на стыках сервисов'), t('Дорогая инфраструктура')],
    mods: { velocity: 0.72, bugs: 1.25, debt: 0.9, infraFixed: 1400, infraPerUser: 0.01 },
  },
  {
    id: 'baas',
    name: 'BaaS (Firebase / Supabase)',
    description: t('Готовый бэкенд: база, авторизация, функции, хранилище.'),
    pros: [t('Очень быстрый старт'), t('Почти не нужен бэкенд-разработчик')],
    cons: [t('Стоимость растёт вместе с пользователями'), t('Привязка к вендору'), t('Сложная бизнес-логика превращается в долг')],
    mods: { velocity: 1.2, debt: 1.25, infraFixed: 50, infraPerUser: 0.03 },
  },
];

export const INFRA_OPTIONS: TechOption[] = [
  {
    id: 'paas',
    name: t('Managed-облако (Cloud Run / Render / Vercel)'),
    description: t('Платформа сама масштабирует и обновляет серверы.'),
    pros: [t('Не нужен DevOps'), t('Деплой в один клик'), t('Автомасштабирование')],
    cons: [t('Дороже «голого» железа на больших объёмах')],
    mods: { infraFixed: 300, infraPerUser: 0.012, outage: 1 },
  },
  {
    id: 'iaas',
    name: t('AWS + Kubernetes своими силами'),
    description: t('Полный контроль, кластер Kubernetes, Terraform.'),
    pros: [t('Дешевле на масштабе'), t('Гибкость')],
    cons: [t('Нужен DevOps-инженер, иначе частые падения'), t('Долгая настройка')],
    mods: { infraFixed: 900, infraPerUser: 0.006, setupPoints: 8, needsRole: 'devops', outage: 0.8 },
  },
  {
    id: 'vps',
    name: t('Пара арендованных VPS'),
    description: t('Сервер за $40 в месяц и ручной деплой по SSH.'),
    pros: [t('Очень дёшево')],
    cons: [t('Падения при нагрузке'), t('Нет автомасштабирования'), t('Ручные релизы')],
    mods: { infraFixed: 120, infraPerUser: 0.01, outage: 2.2, scaleLimit: 40000 },
  },
];

export const ANALYTICS_OPTIONS: TechOption[] = [
  {
    id: 'none',
    name: t('Без аналитики (потом добавим)'),
    description: t('Видны только деньги и установки из консоли стора/рекламы.'),
    pros: [t('Экономит пару дней разработки')],
    cons: [t('Вы не видите воронку, удержание и когорты'), t('A/B-тесты невозможны')],
    mods: { noise: -1 },
  },
  {
    id: 'basic',
    name: t('GA4 / Firebase Analytics (бесплатно)'),
    description: t('Базовые события и воронки.'),
    pros: [t('Бесплатно'), t('Быстро подключить')],
    cons: [t('Погрешность данных ±10–15%'), t('Нет когортного анализа удержания')],
    mods: { noise: 0.12, setupPoints: 2, cohorts: false },
  },
  {
    id: 'product',
    name: 'Amplitude / Mixpanel',
    description: t('Продуктовая аналитика с когортами, воронками и сегментами.'),
    pros: [t('Точные данные'), t('Когорты и удержание из коробки'), t('Стартап-программа: бесплатно первый год')],
    cons: [t('Нужен трекинг-план'), t('После роста — платный тариф')],
    mods: { noise: 0.03, setupPoints: 5, cohorts: true, monthly: 0 },
  },
  {
    id: 'dwh',
    name: t('Своё хранилище (BigQuery + dbt + BI)'),
    description: t('Сырые события в DWH, отчёты строит аналитик.'),
    pros: [t('Полный контроль над данными'), t('Можно связать с финансами')],
    cons: [t('Долго строить'), t('Без аналитика данные неточные'), t('$600/мес')],
    mods: { noise: 0.02, setupPoints: 13, cohorts: true, monthly: 600, needsRole: 'analyst' },
  },
];

export const EXPERIMENT_OPTIONS: TechOption[] = [
  {
    id: 'none',
    name: t('Без A/B-инфраструктуры'),
    description: t('Все пользователи видят одну версию.'),
    pros: [t('Ничего не стоит')],
    cons: [t('Нельзя проверить изменения экспериментом')],
    mods: {},
  },
  {
    id: 'homegrown',
    name: t('Свои фича-флаги и сплитование'),
    description: t('Самописное распределение пользователей по группам.'),
    pros: [t('Бесплатно')],
    cons: [t('Нужно время на разработку'), t('Частые ошибки сплитования (SRM)')],
    mods: { setupPoints: 8, srm: 0.2 },
  },
  {
    id: 'platform',
    name: t('Платформа экспериментов (GrowthBook / Statsig)'),
    description: t('Готовые фича-флаги, сплитование и статистика.'),
    pros: [t('Надёжное сплитование'), t('Быстрый запуск тестов'), t('+1 параллельный тест')],
    cons: [t('$400/мес')],
    mods: { setupPoints: 3, srm: 0.03, monthly: 400 },
  },
];

export const AUTH_OPTIONS: TechOption[] = [
  {
    id: 'managed',
    name: t('Готовый сервис (Firebase Auth / Auth0)'),
    description: t('Вход по email, Apple, Google из коробки.'),
    pros: [t('В 2 раза быстрее'), t('Безопасность на стороне вендора')],
    cons: [t('$100–300/мес на росте')],
    mods: { effort: { auth: 0.5 }, monthly: 150 },
  },
  {
    id: 'own',
    name: t('Своя авторизация'),
    description: t('Пишем регистрацию, сессии и восстановление пароля сами.'),
    pros: [t('Нет платы вендору')],
    cons: [t('Дольше разработка'), t('Риск уязвимостей')],
    mods: { effort: { auth: 1.4 }, bugs: 1.05 },
  },
];

export const PRACTICES: PracticeDef[] = [
  {
    id: 'cicd',
    name: 'CI/CD',
    description: t('Автоматическая сборка и деплой. Чуть быстрее релизы, меньше ошибок при выкладке.'),
    mods: { velocity: 1.05, bugs: 0.92, setupPoints: 3 },
  },
  {
    id: 'autotests',
    name: t('Автотесты'),
    description: t('Unit- и интеграционные тесты. Медленнее на ~10%, но заметно меньше багов и долга.'),
    mods: { velocity: 0.9, bugs: 0.6, debt: 0.8 },
  },
  {
    id: 'codereview',
    name: t('Код-ревью'),
    description: t('Каждое изменение смотрит второй разработчик. Меньше багов и долга, немного медленнее.'),
    mods: { velocity: 0.95, bugs: 0.8, debt: 0.8 },
  },
  {
    id: 'monitoring',
    name: t('Мониторинг и алерты (Sentry, Grafana)'),
    description: t('Инциденты замечают за минуты, а не по жалобам. $250/мес.'),
    mods: { outage: 0.5, monthly: 250, setupPoints: 2 },
  },
  {
    id: 'security',
    name: t('Безопасная разработка'),
    description: t('Проверка зависимостей, секреты в vault, ревью безопасности. Сильно снижает риск утечек.'),
    mods: { velocity: 0.97, setupPoints: 2 },
  },
];

export const PROCESSES: ProcessDef[] = [
  {
    id: 'scrum',
    name: t('Scrum, спринты по 2 недели'),
    description: t('Планирование, дейли, демо и ретро. Предсказуемые сроки, команде понятны цели.'),
    velocity: 1,
    estimateNoise: 0.8,
    bugs: 1,
  },
  {
    id: 'kanban',
    name: 'Kanban',
    description: t('Поток задач с WIP-лимитами. Гибко, чуть быстрее, но сроки предсказывать сложнее.'),
    velocity: 1.05,
    estimateNoise: 1,
    bugs: 1,
  },
  {
    id: 'adhoc',
    name: t('Без процесса'),
    description: t('«Просто делаем». Сначала кажется быстро, потом начинается хаос и выгорание.'),
    velocity: 1,
    estimateNoise: 1.4,
    bugs: 1.15,
  },
];
