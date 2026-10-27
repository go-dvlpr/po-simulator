// Monthly market simulation after launch: acquisition, funnel, cohorts,
// revenue, costs and the metrics the player observes.

import { fixed } from '../format.ts';
import {
  analyticsNoise,
  calendarMonth,
  capabilities,
  channelAvailable,
  hasCohorts,
  hasRole,
  monthlyPayroll,
  scenarioOf,
  segmentDef,
  storeFee,
  techSum,
} from './catalog.ts';
import { marketCondition } from '../data/context.ts';
import { modifierMult } from './effects.ts';
import { competitivePressure, expansionLive, missingCompliance, pressureEffects } from './market.ts';
import { relationEffect } from './stakeholders.ts';
import type { ProductContext } from './product.ts';
import { funnelRates, lastMau, pmfScore, productContext } from './product.ts';
import type { Rng } from './rng.ts';
import { noiseMult, normal } from './rng.ts';
import { clamp } from './stats.ts';
import type { Cohort, Costs, FeatureUsage, GameState, Metrics, MonthRecord, MonthSettings, NorthStarMetric, ReportLine, RoleId } from './types.ts';
import { t } from '../i18n/index.ts';

export const ORGANIC = 'organic';

export function retentionCurve(floor: number, tau: number, age: number): number {
  return floor + (1 - floor) * Math.exp(-age / tau);
}

function emptyMetrics(): Metrics {
  return {
    acquired: null,
    registered: null,
    activated: null,
    newPaying: null,
    churned: null,
    paying: null,
    mau: null,
    registrationRate: null,
    activationRate: null,
    conversionRate: null,
    retentionM1: null,
    churnRate: null,
    arppu: null,
    cacBlended: null,
    cacPaid: null,
    ltv: null,
    ltvCac: null,
    payback: null,
    nps: null,
    nrr: null,
    northStar: null,
  };
}

const safeDiv = (a: number, b: number): number | null => (b > 0 ? a / b : null);

// Weekly payroll over the next `weeks` weeks (hires join mid-month).
export function payrollFor(s: GameState, weeks: number): number {
  let total = 0;
  for (let w = s.week; w < s.week + weeks; w++) total += monthlyPayroll(s, w) / 4;
  return total;
}

// Server and per-user service costs that grow with the audience (cost of revenue).
export function variableInfraCost(s: GameState, mau: number): number {
  const sc = scenarioOf(s);
  const usersPerAccount = sc.kind === 'b2b' ? 15 : 1;
  let perUser = techSum(s, 'infraPerUser');
  for (const f of sc.features) {
    if (s.product.features[f.id]?.shipped && f.perUserCost) perUser += f.perUserCost / usersPerAccount;
  }
  const cost = perUser * mau * usersPerAccount;
  return hasRole(s, 'devops') ? cost * 0.85 : cost;
}

export function infraCost(s: GameState, mau: number): number {
  const fixed = techSum(s, 'infraFixed') * (hasRole(s, 'devops') ? 0.85 : 1);
  return fixed + variableInfraCost(s, mau);
}

export function toolsCost(s: GameState, mau: number): number {
  const sc = scenarioOf(s);
  const freeLimit = sc.kind === 'b2b' ? 2000 : 20000;
  const overage = s.tech.analytics === 'product' && mau > freeLimit ? 1000 : 0;
  return techSum(s, 'monthly') + overage + (s.flags.vendorTax ?? 0);
}

export function contentCost(s: GameState): number {
  return scenarioOf(s).features.reduce(
    (sum, f) => sum + (s.product.features[f.id]?.shipped && f.monthlyCost ? f.monthlyCost : 0),
    0,
  );
}

// Expected monthly burn with the current setup (used for runway estimates).
export function estimatedBurn(s: GameState): number {
  const mau = lastMau(s);
  const marketing = Object.values(s.marketing.budgets).reduce((a, b) => a + b, 0) + s.marketing.crm;
  const revenue = s.history.length > 0 ? s.history[s.history.length - 1].revenue : 0;
  const spend = payrollFor(s, 4) + infraCost(s, mau) + toolsCost(s, mau) + contentCost(s) + (s.phase === 'growth' ? marketing : 0);
  return spend - revenue;
}

// Burn once everyone already hired is on payroll: a fairer runway before launch.
export function plannedBurn(s: GameState): number {
  const mau = lastMau(s);
  const marketing = Object.values(s.marketing.budgets).reduce((a, b) => a + b, 0) + s.marketing.crm;
  const revenue = s.history.length > 0 ? s.history[s.history.length - 1].revenue : 0;
  const spend = monthlyPayroll(s, s.week + 52) + infraCost(s, mau) + toolsCost(s, mau) + contentCost(s) + (s.phase === 'growth' ? marketing : 0);
  return spend - revenue;
}

export function northStarValue(
  metric: NorthStarMetric,
  v: { mau: number; acquired: number; registered: number; mrr: number; shipped: number },
  ctx: ProductContext,
  b2b: boolean,
): number {
  switch (metric) {
    case 'engaged':
      return v.mau * clamp((b2b ? 0.3 : 0.15) + 0.45 * ctx.value * ctx.quality, 0.08, 0.9);
    case 'acquired':
      return v.acquired;
    case 'registered':
      return v.registered;
    case 'mrr':
      return v.mrr;
    case 'usage':
      // Raw usage grows with audience and content, and with friction too: it says little about value.
      return b2b ? v.mau * 15 * 9 * (1 + 0.4 * (1 - ctx.quality)) : v.mau * 45 * (1 + 0.06 * v.shipped);
  }
}

// Tickets grow with users and bugs; founders answer some, support staff the rest.
export function supportLoad(s: GameState, mau: number): { tickets: number; capacity: number; csat: number } {
  const sc = scenarioOf(s);
  const staff = s.team.filter((m) => m.role === 'support' && m.joinWeek <= s.week).length;
  const tickets = mau * (sc.kind === 'b2c' ? 0.015 : 0.4) * (1 + s.product.bugs / 40);
  const capacity = 150 + staff * (sc.kind === 'b2c' ? 900 : 300);
  const csat = clamp(0.92 - 0.35 * Math.max(0, tickets / capacity - 1), 0.4, 0.95);
  return { tickets, capacity, csat };
}

function cohortUnit(c: Cohort, arppu: number, price: number): number {
  return arppu * (c.price / price) * c.seatMult;
}

function monthSettings(s: GameState): MonthSettings {
  const team: Partial<Record<RoleId, number>> = {};
  for (const m of s.team) if (m.joinWeek <= s.week) team[m.role] = (team[m.role] ?? 0) + 1;
  return {
    budgets: { ...s.marketing.budgets },
    price: s.pricing.price,
    model: s.pricing.model,
    annual: s.pricing.annual,
    proTier: s.pricing.proTier,
    crm: s.marketing.crm,
    allocation: { ...s.allocation },
    team,
    analytics: s.tech.analytics,
  };
}

// Deals per month the team can close when buyers need a demo.
export function dealCapacity(s: GameState, needsSales: boolean, demoModel: boolean): number {
  if (!needsSales && !demoModel) return Infinity;
  const reps = s.team.filter((m) => m.role === 'sales' && m.joinWeek <= s.week).length;
  return needsSales ? 2 + reps * 6 : 4 + reps * 15;
}

export function salesSalaries(s: GameState): number {
  return s.team.filter((m) => m.role === 'sales' && m.joinWeek <= s.week).reduce((sum, m) => sum + m.salary, 0);
}

export function simulateMonth(s: GameState, rng: Rng): MonthRecord {
  const sc = scenarioOf(s);
  const month = s.history.length;
  const cal = calendarMonth(s.week);
  const market = marketCondition(s.world.market);
  const demand = sc.seasonality.demand[cal] * market.demand;
  const cpm = sc.seasonality.cpm[cal] * market.cpm;
  const ctx = productContext(s);
  const rates = funnelRates(s, ctx);
  const segDef = segmentDef(sc, ctx.segmentId);
  const model = sc.pricingModels.find((m) => m.id === s.pricing.model) ?? sc.pricingModels[0];
  const prevMau = lastMau(s);
  const notes: ReportLine[] = [];
  const note = (text: string, tone: ReportLine['tone'] = 'info', link?: ReportLine['link']) => notes.push(link ? { text, tone, link } : { text, tone });
  const soft = s.launch?.strategy === 'soft' && month < 2;

  // ---------- Acquisition ----------
  const spend: Record<string, number> = {};
  const acquiredBy: Record<string, number> = {};
  const reportedBy: Record<string, number> = {};
  const intentBy: Record<string, number> = {};
  const activePaid = sc.channels.filter((c) => c.kind === 'paid' && s.marketing.budgets[c.id] > 0 && channelAvailable(s, c).ok).length;
  const crowded = activePaid > 2 && !hasRole(s, 'marketer');
  if (crowded) note(t('Без маркетолога вы ведёте больше двух платных каналов — эффективность каждого просела.'), 'bad', 'marketing');
  const pressure = competitivePressure(s);
  const expanded = expansionLive(s);
  const costMult =
    (hasRole(s, 'marketer') ? 0.88 : 1) *
    (soft ? 0.8 : 1) *
    modifierMult(s, 'cpi') *
    pressureEffects(pressure).cpi *
    relationEffect(s, 'marketing', 1.08, 0.96) *
    (expanded ? 1.06 : 1);
  // Small segments saturate channels faster; a new market adds room.
  const refSize = sc.segments.reduce((sum, x) => sum + x.size, 0) / sc.segments.length;
  const sizeMult = clamp(Math.sqrt(ctx.seg.size / refSize), 0.3, 1.5) * (expanded ? 1.4 : 1);
  // Consent banners: some people opt out of tracking, so ad consoles see fewer conversions.
  const consent = s.compliance.includes('gdpr') ? 0.9 : 1;
  // Ads reach people outside the target segment too; better-fitting channels bring more of the right people.
  const maxAffinity: Record<string, number> = {};
  for (const ch of sc.channels) maxAffinity[ch.id] = Math.max(...sc.segments.map((x) => x.affinity[ch.id] ?? 1));
  const targetShareBy: Record<string, number> = {};

  for (const ch of sc.channels) {
    const available = channelAvailable(s, ch).ok;
    const budget = available ? Math.max(0, s.marketing.budgets[ch.id] ?? 0) : 0;
    const affinity = segDef.affinity[ch.id] ?? 1;
    let users = 0;
    if (ch.kind === 'paid') {
      if (budget > 0) {
        const cost = s.world.channelCost[ch.id] * cpm * costMult;
        const eff = affinity * ctx.vpMatch * s.marketing.creative[ch.id] * (crowded ? 0.75 : 1);
        users = (budget / (cost / eff) / (1 + budget / (ch.saturation * sizeMult))) * noiseMult(rng, ch.volatility);
        if (ch.fatigue) {
          s.marketing.creative[ch.id] = Math.max(0.55, s.marketing.creative[ch.id] * (hasRole(s, 'marketer') ? 0.95 : 0.92));
        }
      }
    } else {
      const asset = s.marketing.assets[ch.id] * 0.88 + (budget / s.world.channelCost[ch.id]) * 0.3;
      s.marketing.assets[ch.id] = asset;
      users = (asset / (1 + asset / (ch.saturation * sizeMult))) * affinity * demand * noiseMult(rng, ch.volatility);
    }
    spend[ch.id] = budget;
    acquiredBy[ch.id] = users;
    reportedBy[ch.id] = users * (ch.kind === 'paid' ? ch.attribution * consent : 1);
    intentBy[ch.id] = ch.intent;
    targetShareBy[ch.id] = clamp(0.4 + 0.5 * (affinity / maxAffinity[ch.id]) * (0.85 + 0.15 * ctx.vpMatch) + (hasRole(s, 'marketer') ? 0.05 : 0), 0.35, 0.95);
  }

  const storePresence = capabilities(s).has('appStore') ? 1 : 0.5;
  const ratingFactor = (s.product.rating / 4.5) ** 2;
  let organic = sc.funnel.organicBase * demand * storePresence * ratingFactor * (expanded ? 1.25 : 1);
  organic += prevMau * sc.funnel.viral * ctx.value * ctx.lifts.virality * model.viralMult * ratingFactor;
  const spike = s.flags.spike ?? 0;
  if (spike > 0) {
    organic += spike;
    s.flags.spike = 0;
  }
  organic *= modifierMult(s, 'acquisition') * noiseMult(rng, 0.08);
  acquiredBy[ORGANIC] = organic;
  intentBy[ORGANIC] = 1.1;
  // Word of mouth mostly brings people like your current users.
  targetShareBy[ORGANIC] = 0.85;

  // ---------- Funnel (per source, intent matters) ----------
  let acquired = 0;
  let registered = 0;
  let activated = 0;
  let newPaying = 0;
  let paidSpend = 0;
  let paidNewPaying = 0;
  const payingBy: Record<string, number> = {};
  const softConv = soft ? 0.9 : 1;
  let targetActivated = 0;
  for (const [source, users] of Object.entries(acquiredBy)) {
    const intent = intentBy[source] ?? 1;
    // People outside the target segment get less value from the product.
    const share = targetShareBy[source] ?? 1;
    const fit = share + (1 - share) * 0.75;
    const reg = users * clamp(rates.registration * intent ** 0.35 * demand ** 0.2, 0, 0.92);
    const act = reg * clamp(rates.activation * intent ** 0.25 * fit, 0, sc.funnel.actMax);
    const pay = act * clamp(rates.conversion * intent ** 0.2 * demand ** 0.5 * softConv * fit, 0, sc.funnel.payMax * 1.4);
    acquired += users;
    registered += reg;
    activated += act;
    targetActivated += act * share;
    newPaying += pay;
    payingBy[source] = pay;
    if (source !== ORGANIC && sc.channels.find((c) => c.id === source)?.kind === 'paid') {
      paidSpend += spend[source] ?? 0;
      paidNewPaying += pay;
    }
  }

  // Conversion is measured on accounts that decided to buy this month, before the pipeline delay.
  const qualified = newPaying;
  // B2B deals take time: qualified accounts wait in the pipeline, some go cold,
  // and sales-led deals are limited by how many demos the team can run.
  let pipeline = 0;
  if (sc.kind === 'b2b') {
    const prev = s.history.length > 0 ? (s.history[s.history.length - 1].pipeline ?? 0) : 0;
    const salesLed = segDef.needsSales === true || model.needsRole === 'sales';
    const open = prev * 0.92 + newPaying;
    // Security reviews block big deals without an audit; a discount helps close.
    const audit = salesLed && missingCompliance(s).includes('soc2') ? 0.6 : 1;
    const closeRate = clamp((salesLed ? 0.45 : 0.7) * audit * relationEffect(s, 'sales', 0.85, 1.05) * (1 + 1.2 * s.pricing.dealDiscount), 0.1, 0.9);
    let closing = open * closeRate;
    const salesCap = dealCapacity(s, segDef.needsSales === true, model.needsRole === 'sales');
    if (closing > salesCap) {
      closing = salesCap;
      note(t('Продажи не успевают: лимит ~{0} сделок в месяц. Остальные ждут в воронке и остывают — нужен ещё менеджер по продажам.', [Math.round(salesCap)]), 'bad', 'team');
    }
    pipeline = open - closing;
    if (newPaying > 0) {
      const k = closing / newPaying;
      for (const key of Object.keys(payingBy)) payingBy[key] *= k;
      paidNewPaying *= k;
    } else {
      payingBy[ORGANIC] = closing;
    }
    newPaying = closing;
  }

  // ---------- Cohorts ----------
  const tau = sc.funnel.retentionTau;
  const payingStart = s.history.length > 0 ? (s.history[s.history.length - 1].truth.paying ?? 0) : 0;
  // Healthy B2B accounts add locations over time; a buggy product makes them cut back.
  const expansion = sc.kind === 'b2b' ? clamp(0.002 + 0.015 * (ctx.value - 0.6) * ctx.quality, -0.01, 0.012) : 0;
  let mau = 0;
  let churned = 0;
  let involuntary = 0;
  // Revenue from customers who already paid last month: late conversions are new customers, not retention.
  let retainedMrr = 0;
  // Cards expire and payments fail; retries and reminders (dunning) win most of them back.
  const failRate = sc.kind === 'b2c' ? 0.025 : 0.01;
  const recovered = s.pricing.dunning ? 0.65 : 0.1;
  for (const cohort of s.cohorts) {
    const age = month - cohort.month;
    if (expansion !== 0) cohort.seatMult = Math.max(0.5, cohort.seatMult * (1 + expansion * noiseMult(rng, 0.3)));
    const active = cohort.activated * retentionCurve(rates.retentionFloor * (0.75 + 0.25 * cohort.quality), tau, age);
    // About a third of churn (life changes, closed businesses) the product cannot influence.
    const churnRate = clamp(ctx.seg.churn * (0.35 + 0.65 * rates.churnMult) * (1 + 0.6 * Math.exp(-(age - 1) / 1.5)) * (1 + 0.35 * (1 - cohort.quality)), 0.005, 0.6);
    const failed = cohort.paying * failRate * (1 - recovered);
    involuntary += failed;
    const lost = cohort.paying * churnRate + failed;
    const late = ctx.revenueEnabled ? active * model.lateConversion * rates.acceptance * 2 : 0;
    const retained = Math.max(0, cohort.paying - lost);
    retainedMrr += retained * cohortUnit(cohort, rates.arppu, s.pricing.price);
    cohort.paying = retained + late;
    cohort.active.push(active);
    cohort.payingHistory.push(cohort.paying);
    mau += active;
    churned += lost;
  }
  const prevMrr = s.history.length > 0 ? s.history[s.history.length - 1].mrr : 0;
  s.cohorts.push({
    month,
    week: s.week,
    activated,
    newPaying,
    paying: newPaying,
    active: [activated * 0.9],
    payingHistory: [newPaying],
    price: s.pricing.price * (1 - s.pricing.dealDiscount),
    seatMult: 1,
    quality: activated > 0 ? targetActivated / activated : 1,
  });
  mau += activated * 0.9 + (registered - activated) * 0.25;
  const paying = s.cohorts.reduce((sum, c) => sum + c.paying, 0);

  // ---------- Money ----------
  // Cohorts may pay an older price, and B2B accounts grow or shrink in seats.
  const mrr = s.cohorts.reduce((sum, c) => sum + c.paying * cohortUnit(c, rates.arppu, s.pricing.price), 0);
  const arppu = paying > 0 ? mrr / paying : rates.arppu;
  const fee = storeFee(s) + techSum(s, 'revenueFee');
  // Some new customers ask for their first payment back; tricks and overpricing make it worse.
  const refundRate = 0.02 + 0.03 * (s.flags.darkPatterns ?? 0) + (s.pricing.price > ctx.wtpEff ? 0.02 : 0) + (s.pricing.model === 'hard' ? 0.02 : 0);
  const refunds = newPaying * arppu * refundRate;
  const revenue = mrr * (1 - fee) - refunds;
  const marketing = Object.values(spend).reduce((a, b) => a + b, 0) + s.marketing.refreshCosts + s.marketing.crm;
  const costs: Costs = {
    salaries: payrollFor(s, 4),
    marketing,
    infra: infraCost(s, mau),
    tools: toolsCost(s, mau),
    content: contentCost(s),
    other: (s.flags.pendingCosts ?? 0) + (s.expandedWeek !== null ? 2000 : 0),
  };
  s.marketing.refreshCosts = 0;
  s.flags.pendingCosts = 0;
  const totalCosts = Object.values(costs).reduce((a, b) => a + b, 0);
  s.cash += revenue - totalCosts;

  // ---------- Metrics ----------
  const churnRateNow = payingStart > 0 ? churned / payingStart : null;
  const recentChurn = [...s.history.slice(-2).map((h) => h.truth.churnRate), churnRateNow].filter((x): x is number => x !== null);
  const churnAvg = recentChurn.length > 0 ? recentChurn.reduce((a, b) => a + b, 0) / recentChurn.length : ctx.seg.churn * rates.churnMult;
  // Gross margin per customer: store fees and costs that grow with users. Fixed costs are not part of LTV.
  const grossMargin = mrr > 0 ? clamp((revenue - variableInfraCost(s, mau)) / mrr, -1, 1) : 0;
  // Customer acquisition cost includes the sales team (S&M spend).
  // CRM keeps existing users; it is a retention cost, not acquisition.
  const cacBlended = safeDiv(marketing - s.marketing.crm + salesSalaries(s), newPaying);
  // Conservative LTV: gross churn only. Expansion shows up in ARPPU and NRR.
  const ltv = (arppu * Math.max(grossMargin, 0)) / Math.max(churnAvg, 0.01);
  const nsDef = sc.northStars.find((n) => n.id === s.strategy?.northStarId);
  const shipped = Object.values(s.product.features).filter((f) => f.shipped).length;
  const northStar = nsDef ? northStarValue(nsDef.metric, { mau, acquired, registered, mrr, shipped }, ctx, sc.kind === 'b2b') : null;
  const nps = clamp(-30 + 90 * (ctx.value - 0.35) * ctx.quality + (hasRole(s, 'support') ? 5 : 0) + normal(rng, 0, 3), -60, 80);
  const truth: Metrics = {
    acquired,
    registered,
    activated,
    newPaying,
    churned,
    paying,
    mau,
    registrationRate: safeDiv(registered, acquired),
    activationRate: safeDiv(activated, registered),
    conversionRate: safeDiv(qualified, activated),
    retentionM1: retentionCurve(rates.retentionFloor, tau, 1),
    churnRate: churnRateNow,
    arppu,
    cacBlended,
    cacPaid: safeDiv(paidSpend, paidNewPaying),
    ltv,
    ltvCac: cacBlended ? ltv / cacBlended : null,
    payback: cacBlended && arppu * grossMargin > 0 ? cacBlended / (arppu * grossMargin) : null,
    nps,
    nrr: sc.kind === 'b2b' && prevMrr > 0 ? retainedMrr / prevMrr : null,
    northStar,
  };

  let reportedPaidPaying = 0;
  for (const ch of sc.channels) {
    if (ch.kind === 'paid') reportedPaidPaying += (payingBy[ch.id] ?? 0) * ch.attribution;
  }
  const obs = observe(s, rng, truth, safeDiv(paidSpend, reportedPaidPaying), nsDef?.metric);
  const featureUsage = observeFeatureUsage(s, rng, ctx, truth.retentionM1 ?? 0);

  // Store rating follows quality with some inertia.
  const ratingTarget = clamp(3.1 + 1.7 * ctx.quality * Math.min(1, ctx.value) - 0.3 * (s.flags.darkPatterns ?? 0), 1.5, 4.9);
  s.product.rating = s.product.rating + (ratingTarget - s.product.rating) * 0.35;

  if (demand >= 1.2) note(t('Сезонный пик спроса: органика и конверсия выше обычного (×{0}).', [fixed(demand, 2)]), 'good');
  if (demand <= 0.8) note(t('Сезонный спад: спрос ниже обычного (×{0}).', [fixed(demand, 2)]), 'bad');
  if (cpm >= 1.2) note(t('Реклама подорожала из-за сезона (CPM ×{0}).', [fixed(cpm, 2)]), 'bad', 'marketing');
  if (!ctx.revenueEnabled) note(t('Платёжная функция не выпущена — продукт не может зарабатывать.'), 'bad', 'product');

  return {
    month,
    week: s.week,
    spend,
    acquiredBy,
    reportedBy,
    payingBy,
    organic,
    mrr,
    revenue,
    costs,
    cash: s.cash,
    pmf: pmfScore(ctx),
    truth,
    obs,
    notes,
    grossMargin,
    pipeline,
    targetShareBy,
    involuntary,
    refunds,
    support: supportLoad(s, mau),
    pressure,
    settings: monthSettings(s),
    featureUsage,
  };
}

// Share of active users who use each shipped feature and how they retain.
// Feature users always look more loyal: engaged people try more features (selection bias).
function observeFeatureUsage(s: GameState, rng: Rng, ctx: ProductContext, retention: number): Record<string, FeatureUsage> | undefined {
  const noise = analyticsNoise(s);
  if (noise === null) return undefined;
  const sc = scenarioOf(s);
  const cohorts = hasCohorts(s);
  const out: Record<string, FeatureUsage> = {};
  for (const f of sc.features) {
    if (!s.product.features[f.id]?.shipped || f.kano === 'must' || f.enablesRevenue || f.tags?.some((t) => t === 'cms' || t === 'auth')) continue;
    const v = s.world.featureValue[f.id][ctx.segmentId] ?? 0;
    const adoption = clamp((0.1 + (0.55 * v) / (v + 0.5)) * noiseMult(rng, noise), 0.03, 0.85);
    const withF = Math.min(0.95, retention * (1.1 + 0.12 * v) * noiseMult(rng, noise));
    const without = clamp((retention - adoption * withF) / (1 - adoption), 0.02, 0.95);
    out[f.id] = { adoption, retentionWith: cohorts ? withF : null, retentionWithout: cohorts ? without : null };
  }
  return out;
}

// What the player can see, given the analytics setup.
function observe(s: GameState, rng: Rng, truth: Metrics, reportedCacPaid: number | null, northStar?: NorthStarMetric): Metrics {
  const noise = analyticsNoise(s);
  const obs = emptyMetrics();
  const fuzz = (v: number | null) => (v === null || noise === null ? null : v * noiseMult(rng, noise));
  // Billing and store/ad consoles are always available.
  obs.acquired = truth.acquired;
  obs.newPaying = truth.newPaying;
  obs.paying = truth.paying;
  obs.churned = truth.churned;
  obs.churnRate = truth.churnRate;
  obs.arppu = truth.arppu;
  obs.cacBlended = truth.cacBlended;
  obs.ltv = truth.ltv;
  obs.ltvCac = truth.ltvCac;
  obs.payback = truth.payback;
  obs.nrr = truth.nrr;
  // Revenue and ad-console volumes are always known; engagement needs product analytics.
  const nsVisible = northStar === 'acquired' || northStar === 'registered' || northStar === 'mrr';
  if (nsVisible) obs.northStar = truth.northStar;
  else if (noise !== null) obs.northStar = fuzz(truth.northStar);
  // Ad platforms see only attributed conversions, so their CAC looks worse.
  obs.cacPaid = reportedCacPaid;
  if (noise !== null) {
    obs.registered = fuzz(truth.registered);
    obs.activated = fuzz(truth.activated);
    obs.mau = fuzz(truth.mau);
    obs.registrationRate = fuzz(truth.registrationRate);
    obs.activationRate = fuzz(truth.activationRate);
    obs.conversionRate = fuzz(truth.conversionRate);
    if (hasCohorts(s)) obs.retentionM1 = fuzz(truth.retentionM1);
  }
  return obs;
}
