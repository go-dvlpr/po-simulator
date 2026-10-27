import type { Level, RoleDef, RoleId, Source } from '../engine/types.ts';
import { t } from '../i18n/index.ts';

export const ROLES: RoleDef[] = [
  {
    id: 'developer',
    name: t('Разработчик'),
    description: t('Пишет код и даёт команде story points. Сеньоры делают больше и с меньшим числом багов, джуны дешевле, но ошибаются чаще.'),
    salary: { junior: 3800, middle: 6200, senior: 8800 },
    levels: ['junior', 'middle', 'senior'],
  },
  {
    id: 'qa',
    name: t('QA-инженер'),
    description: t('Ловит баги до релиза: примерно на 40% меньше дефектов доходит до пользователей.'),
    salary: { junior: 4500, middle: 4500, senior: 4500 },
    levels: ['middle'],
  },
  {
    id: 'designer',
    name: t('Продуктовый дизайнер'),
    description: t('Улучшает UX: выше активация и конверсия, лучше прототипы и юзабилити-тесты. Без него работает основатель-дизайнер на полставки.'),
    salary: { junior: 5500, middle: 5500, senior: 5500 },
    levels: ['middle'],
  },
  {
    id: 'analyst',
    name: t('Продуктовый аналитик'),
    description: t('Точнее данные, когорты, +1 параллельный A/B-тест, находит аномалии в трекинге.'),
    salary: { junior: 6000, middle: 6000, senior: 6000 },
    levels: ['middle'],
  },
  {
    id: 'devops',
    name: 'DevOps / SRE',
    description: t('Стабильность и масштабирование: меньше падений, дешевле инфраструктура. Обязателен для своей инфраструктуры на Kubernetes.'),
    salary: { junior: 7500, middle: 7500, senior: 7500 },
    levels: ['middle'],
  },
  {
    id: 'marketer',
    name: t('Перформанс-маркетолог'),
    description: t('Снижает стоимость привлечения примерно на 12%, медленнее выгорают креативы. Без него можно вести не больше 2 платных каналов.'),
    salary: { junior: 6000, middle: 6000, senior: 6000 },
    levels: ['middle'],
  },
  {
    id: 'support',
    name: t('Специалист поддержки'),
    description: t('Снижает отток и повышает NPS. Без поддержки при росте базы клиентов копятся негативные отзывы.'),
    salary: { junior: 3200, middle: 3200, senior: 3200 },
    levels: ['middle'],
  },
  {
    id: 'sales',
    name: t('Менеджер по продажам'),
    description: t('Проводит демо и закрывает сделки. Нужен для outbound и для крупных клиентов, которые не покупают сами.'),
    salary: { junior: 5500, middle: 5500, senior: 5500 },
    levels: ['middle'],
  },
];

export const LEVEL_NAMES: Record<Level, string> = {
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
};

export const LEVEL_POINTS: Record<Level, number> = {
  junior: 5,
  middle: 8,
  senior: 11,
};

export const LEVEL_BUGS: Record<Level, number> = {
  junior: 1.5,
  middle: 1,
  senior: 0.7,
};

export interface SourceDef {
  id: Source;
  name: string;
  description: string;
  costMult: number;
  productivity: number;
  bugs: number;
  minDelay: number;
  maxDelay: number;
  feeMonths: number;
}

export const SOURCES: SourceDef[] = [
  {
    id: 'inhouse',
    name: t('В штат'),
    description: t('Дешевле в долгую и знания остаются в команде. Поиск 3–6 недель и разовая комиссия рекрутеру.'),
    costMult: 1,
    productivity: 1,
    bugs: 1,
    minDelay: 3,
    maxDelay: 6,
    feeMonths: 0.8,
  },
  {
    id: 'outsource',
    name: t('Аутсорс-агентство'),
    description: t('Выходит через неделю, но в 1,7 раза дороже. Хуже погружение в продукт.'),
    costMult: 1.7,
    productivity: 0.9,
    bugs: 1.1,
    minDelay: 1,
    maxDelay: 1,
    feeMonths: 0,
  },
  {
    id: 'freelance',
    name: t('Фрилансер'),
    description: t('Дёшево и быстро, но может пропасть в любой момент, а качество непредсказуемо.'),
    costMult: 0.85,
    productivity: 0.85,
    bugs: 1.25,
    minDelay: 1,
    maxDelay: 1,
    feeMonths: 0,
  },
];

export function roleDef(id: RoleId): RoleDef {
  const role = ROLES.find((r) => r.id === id);
  if (!role) throw new Error(`unknown role ${id}`);
  return role;
}

export function sourceDef(id: Source): SourceDef {
  const source = SOURCES.find((s) => s.id === id);
  if (!source) throw new Error(`unknown source ${id}`);
  return source;
}

export const FIRST_NAMES = [
  t('Алексей'), t('Мария'), t('Иван'), t('Екатерина'), t('Дмитрий'), t('Анна'), t('Сергей'), t('Ольга'), t('Никита'), t('Юлия'),
  t('Павел'), t('Ксения'), t('Артём'), t('Софья'), t('Михаил'), t('Дарья'), t('Тимур'), t('Алина'), t('Олег'), t('Виктория'),
  'Lukas', 'Sofia', 'Mateo', 'Emma', 'Noah', 'Mia', 'Leo', 'Chloe', 'Arjun', 'Yuki',
];
