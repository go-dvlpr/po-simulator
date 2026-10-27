// Incoming feedback: store reviews, support tickets, sales requests and CEO forwards.
// It is a biased sample: loud users ask for hyped features, not for what keeps customers.

import { featureDef, scenarioOf } from './catalog.ts';
import { nextId } from './effects.ts';
import { funnelRates, productContext } from './product.ts';
import type { Rng } from './rng.ts';
import { chance, intBetween, pick, weightedPick } from './rng.ts';
import type { FeedbackTopic, GameState, InboxItem } from './types.ts';
import { t } from '../i18n/index.ts';

export const INBOX_TOPICS: Record<string, string> = {
  bugs: t('Баги и сбои'),
  price: t('Цена'),
  onboarding: t('Не разобрались с началом'),
  praise: t('Благодарности'),
  feature: t('Запросы функций'),
};


interface Topic {
  topic: string;
  weight: number;
  featureId?: string;
}

function makeItem(s: GameState, rng: Rng, topic: Topic): InboxItem {
  const sc = scenarioOf(s);
  const base = { id: nextId(s, 'in'), week: s.week, topic: topic.topic };
  if (topic.topic === 'feature' && topic.featureId) {
    const name = featureDef(sc, topic.featureId).name;
    if (chance(rng, 0.12)) return { ...base, featureId: topic.featureId, source: 'ceo', text: t('{0} переслал письмо знакомого: «Очень не хватает функции „{1}“. Когда сделаете?»', [sc.ceoName, name]) };
    if (sc.kind === 'b2b' && chance(rng, 0.4)) return { ...base, featureId: topic.featureId, source: 'sales', text: t('Крупный клиент из воронки готов купить, если сделаем «{0}». Просят назвать срок.', [name]) };
    const texts = [t('Добавьте «{0}» — без этого неудобно.', [name]), t('Когда будет «{0}»? У конкурентов есть.', [name]), t('Поставлю пять звёзд, если появится «{0}».', [name])];
    return { ...base, featureId: topic.featureId, source: sc.kind === 'b2c' ? 'review' : 'support', text: pick(rng, texts), stars: sc.kind === 'b2c' ? intBetween(rng, 3, 4) : undefined };
  }
  const key = topic.topic as FeedbackTopic;
  const text = pick(rng, sc.flavor.feedback[key]);
  const stars = key === 'praise' ? 5 : key === 'bugs' ? intBetween(rng, 1, 2) : intBetween(rng, 2, 3);
  if (sc.kind === 'b2b') return { ...base, source: key === 'price' ? 'sales' : 'support', text };
  return { ...base, source: key === 'onboarding' || (key === 'bugs' && chance(rng, 0.4)) ? 'support' : 'review', text, stars };
}

// Adds this month's messages and returns how many arrived.
export function generateInbox(s: GameState, rng: Rng): number {
  const sc = scenarioOf(s);
  const ctx = productContext(s);
  const rates = funnelRates(s, ctx);
  const topics: Topic[] = [
    { topic: 'bugs', weight: s.product.bugs / 18 },
    { topic: 'price', weight: Math.max(0, s.pricing.price / ctx.wtpEff - 0.85) * 3 },
    { topic: 'onboarding', weight: Math.max(0, 1.12 - ctx.ux) * 5 + (rates.activation < 0.35 ? 0.6 : 0.1) },
    { topic: 'praise', weight: Math.max(0, ctx.value - 0.7) * 2.5 },
  ];
  for (const f of sc.features) {
    if (s.product.features[f.id]?.shipped || f.kano === 'must' || f.tags?.includes('cms')) continue;
    // Requests follow hype more than real value: that is what makes the inbox misleading.
    const value = s.world.featureValue[f.id][ctx.segmentId] ?? 0;
    topics.push({ topic: 'feature', featureId: f.id, weight: 0.05 + 0.2 * (f.hype ?? 0.5) + 0.08 * value });
  }
  const count = intBetween(rng, 3, 5);
  for (let i = 0; i < count; i++) {
    const topic = weightedPick(rng, topics, (x) => x.weight);
    if (topic) s.inbox.push(makeItem(s, rng, topic));
  }
  s.inbox = s.inbox.slice(-60);
  return count;
}
