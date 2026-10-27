import { t } from '../i18n/index.ts';
// Random conditions that make every game different on top of the scenario:
// the market climate and the CEO's management style.

export interface MarketCondition {
  id: string;
  title: string;
  text: string;
  // Multipliers on ad prices, demand, willingness to pay and churn.
  cpm: number;
  demand: number;
  wtp: number;
  churn: number;
}

export interface CeoStyle {
  id: string;
  title: string;
  text: string;
  // Multipliers on trust gains and losses.
  trustGain: number;
  trustLoss: number;
  // Weight of CEO-initiated events (pet features, pressure).
  ceoEvents: number;
  // Discovery weeks before the CEO starts losing patience.
  patienceWeeks: number;
}

export const MARKET_CONDITIONS: MarketCondition[] = [
  { id: 'normal', title: t('Спокойный рынок'), text: t('Без сюрпризов: спрос и стоимость рекламы обычные.'), cpm: 1, demand: 1, wtp: 1, churn: 1 },
  { id: 'hot_ads', title: t('Перегретая реклама'), text: t('Крупные игроки скупают рекламу: показы дороже на 20%. Органика, удержание и сарафан ценнее обычного.'), cpm: 1.2, demand: 1.05, wtp: 1, churn: 1 },
  { id: 'downturn', title: t('Экономический спад'), text: t('Люди и компании экономят: готовность платить ниже, отток выше. Зато реклама дешевле.'), cpm: 0.85, demand: 0.95, wtp: 0.88, churn: 1.1 },
  { id: 'boom', title: t('Растущий рынок'), text: t('Тема на подъёме: спрос выше и готовность платить чуть выше, но конкуренты активнее и реклама дороже.'), cpm: 1.1, demand: 1.15, wtp: 1.03, churn: 1 },
  { id: 'cheap_ads', title: t('Дешёвый трафик'), text: t('Рекламные платформы ищут рекламодателей: показы дешевле на 15%. Но дешёвый трафик хуже удерживается.'), cpm: 0.85, demand: 1, wtp: 0.97, churn: 1.04 },
];

export const CEO_STYLES: CeoStyle[] = [
  { id: 'balanced', title: t('Партнёр'), text: t('Спокойно обсуждает решения и доверяет данным. Реагирует на успехи и провалы умеренно.'), trustGain: 1, trustLoss: 1, ceoEvents: 1, patienceWeeks: 10 },
  { id: 'visionary', title: t('Визионер'), text: t('Горит большими идеями и часто приносит «срочные» функции. Радуется смелым шагам, быстро теряет интерес к долгим исследованиям.'), trustGain: 1.2, trustLoss: 1, ceoEvents: 1.8, patienceWeeks: 7 },
  { id: 'numbers', title: t('Человек цифр'), text: t('Верит только метрикам и выполненным обещаниям. Сорванные сроки и проваленные цели бьют по доверию сильнее.'), trustGain: 1, trustLoss: 1.35, ceoEvents: 0.7, patienceWeeks: 12 },
  { id: 'patient', title: t('Терпеливый основатель'), text: t('Даёт время разобраться в рынке, но ждёт честности. Хвалит редко.'), trustGain: 0.85, trustLoss: 0.85, ceoEvents: 0.8, patienceWeeks: 16 },
];

export function marketCondition(id: string | undefined): MarketCondition {
  return MARKET_CONDITIONS.find((c) => c.id === id) ?? MARKET_CONDITIONS[0];
}

export function ceoStyle(id: string | undefined): CeoStyle {
  return CEO_STYLES.find((c) => c.id === id) ?? CEO_STYLES[0];
}
