import type { GameState } from '../engine/types.ts';
import { t } from '../i18n/index.ts';

export interface ChecklistItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  points: number;
  skipRisk: string;
  available?: (s: GameState) => boolean;
}

export const LAUNCH_CHECKLIST: ChecklistItem[] = [
  {
    id: 'tracking',
    name: t('Трекинг-план и проверка событий аналитики'),
    description: t('Описать события воронки и проверить, что они реально приходят и не дублируются.'),
    cost: 0,
    points: 3,
    skipRisk: t('Данные могут быть неверными, и вы узнаете об этом через месяцы.'),
    available: (s) => s.tech.analytics !== 'none',
  },
  {
    id: 'payments_test',
    name: t('Проверка платежей на продакшене'),
    description: t('Реальные покупки, продление, отмена и возврат на боевом окружении.'),
    cost: 0,
    points: 2,
    skipRisk: t('Высокий риск ошибок со списаниями — самых болезненных для пользователей.'),
  },
  {
    id: 'privacy',
    name: t('Политика конфиденциальности и согласие на обработку данных'),
    description: t('GDPR/CCPA: юрист, тексты, баннер согласия, процесс удаления данных.'),
    cost: 1500,
    points: 1,
    skipRisk: t('Магазины приложений и крупные клиенты требуют это обязательно; риск штрафа.'),
  },
  {
    id: 'store_page',
    name: t('Посадочная страница: скриншоты, видео, описание, отзывы'),
    description: t('Страница в сторе или лендинг с понятной ценностью и социальными доказательствами.'),
    cost: 1200,
    points: 0,
    skipRisk: t('Ниже конверсия из рекламы и поиска в установку или регистрацию.'),
  },
  {
    id: 'monitoring',
    name: t('Мониторинг ошибок и алерты'),
    description: t('Sentry, алерты на падения и ошибки оплаты.'),
    cost: 0,
    points: 2,
    skipRisk: t('Об инцидентах вы будете узнавать из гневных отзывов.'),
    available: (s) => !s.tech.practices.includes('monitoring'),
  },
  {
    id: 'support_kb',
    name: t('База знаний и канал поддержки'),
    description: t('FAQ, форма обратной связи, шаблоны ответов.'),
    cost: 400,
    points: 1,
    skipRisk: t('Вопросы пользователей останутся без ответа — выше отток.'),
  },
  {
    id: 'load_test',
    name: t('Нагрузочное тестирование'),
    description: t('Проверить, что сервис выдержит волну трафика после запуска.'),
    cost: 0,
    points: 3,
    skipRisk: t('При всплеске трафика сервис может упасть.'),
  },
  {
    id: 'regression',
    name: t('Регрессионное тестирование перед релизом'),
    description: t('Пройти все ключевые сценарии на всех платформах.'),
    cost: 0,
    points: 4,
    skipRisk: t('Больше багов дойдёт до первых пользователей.'),
  },
  {
    id: 'onboarding_emails',
    name: t('Приветственная цепочка писем и push'),
    description: t('Письма и уведомления, которые доводят новичка до первого результата.'),
    cost: 0,
    points: 2,
    skipRisk: t('Часть новичков потеряется до «момента ценности».'),
  },
];
