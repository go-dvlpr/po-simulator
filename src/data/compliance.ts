// Regulatory and security work. Which items apply depends on the scenario and the product.

import { scenarioOf } from '../engine/catalog.ts';
import type { GameState } from '../engine/types.ts';
import { t } from '../i18n/index.ts';

export interface ComplianceDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  points: number;
  // What happens while it is missing.
  risk: string;
  applies: (s: GameState) => boolean;
}

export const COMPLIANCE: ComplianceDef[] = [
  {
    id: 'gdpr',
    name: t('GDPR / CCPA: согласия и удаление данных'),
    description: t('Баннер согласий, обработка запросов на удаление данных, договоры с подрядчиками. С согласиями часть людей откажется от трекинга — атрибуция станет немного хуже.'),
    cost: 6000,
    points: 4,
    risk: t('Штраф регулятора и требование удалить данные пользователей.'),
    applies: () => true,
  },
  {
    id: 'coppa',
    name: t('Детская приватность (COPPA)'),
    description: t('Согласие родителей, никакой рекламы и трекинга детей, проверка возраста.'),
    cost: 8000,
    points: 5,
    risk: t('Стор может снять приложение, регулятор — выписать штраф.'),
    applies: (s) => {
      const id = scenarioOf(s).flavor.kidsFeature;
      return id !== undefined && s.product.features[id]?.shipped === true;
    },
  },
  {
    id: 'soc2',
    name: 'SOC 2 Type I',
    description: t('Аудит безопасности: политики, доступы, журналы действий. Без него служба безопасности крупного клиента не пропускает закупку.'),
    cost: 25000,
    points: 8,
    risk: t('Сделки через продажи закрываются медленнее: крупные клиенты требуют аудит безопасности.'),
    applies: (s) => scenarioOf(s).kind === 'b2b',
  },
  {
    id: 'fin_review',
    name: t('Проверка банка-партнёра и регулятора'),
    description: t('Аудит хранения финансовых данных, политики безопасности, проверка банком-партнёром и юристами.'),
    cost: 15000,
    points: 6,
    risk: t('Банк-партнёр может приостановить синхронизацию счетов до проверки.'),
    applies: (s) => scenarioOf(s).flavor.regulated === true,
  },
];
