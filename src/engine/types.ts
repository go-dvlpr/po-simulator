// Core types shared by the simulation engine, scenario data and UI.

export type ScenarioId = 'b2c' | 'b2b' | 'edtech' | 'fintech' | 'devtool';
export type ScenarioKind = 'b2c' | 'b2b';
export type FeedbackTopic = 'bugs' | 'price' | 'onboarding' | 'praise';

// Scenario-specific texts and ids the shared engine and events need.
export interface ScenarioFlavor {
  // Hyped feature the CEO brings back from a conference.
  ceoPetFeature: string;
  // Feature that prevents "I just forgot about the product" churn.
  reminderFeature: string;
  defaultPlatform: string;
  // Platform a no-code product gets rewritten to.
  codePlatform: string;
  // Where the product can expand later (e.g. "Германия и Франция").
  expansionMarket: string;
  // A feature for children: shipping it makes child-privacy compliance mandatory.
  kidsFeature?: string;
  // Financial products need a regulatory and bank-partner review.
  regulated?: boolean;
  // Event texts; {rating} and {cost} are replaced with numbers.
  badReviews: string;
  influencer: string;
  platformUpdate: string;
  partnership: string;
  feedback: Record<FeedbackTopic, string[]>;
}
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Phase = 'discovery' | 'strategy' | 'setup' | 'build' | 'launch' | 'growth' | 'end';
export type Lever = 'registration' | 'activation' | 'conversion' | 'retention' | 'virality';
export type Capability = 'appStore' | 'push' | 'health' | 'webPayments';
export type Kano = 'must' | 'performance' | 'delighter' | 'indifferent';
export type FeatureTag = 'auth' | 'payments' | 'integration' | 'content' | 'cms' | 'ai';
export type ScoreCategory =
  | 'discovery'
  | 'strategy'
  | 'delivery'
  | 'growth'
  | 'experiments'
  | 'finance'
  | 'stakeholders';

export type RoleId = 'developer' | 'qa' | 'designer' | 'analyst' | 'devops' | 'marketer' | 'support' | 'sales';
export type Level = 'junior' | 'middle' | 'senior';
export type Source = 'inhouse' | 'outsource' | 'freelance';

export type TechCategory = 'platform' | 'backend' | 'infra' | 'analytics' | 'experiments' | 'payments' | 'auth';
export type PracticeId = 'cicd' | 'autotests' | 'codereview' | 'monitoring' | 'security';
export type ProcessId = 'scrum' | 'kanban' | 'adhoc';

export type ResearchMethod =
  | 'desk'
  | 'competitors'
  | 'interviews'
  | 'survey'
  | 'smoke'
  | 'concierge'
  | 'prototype'
  | 'expert';

export type HypothesisKind = 'problem' | 'wtp' | 'channel' | 'solution';

export type ObservationKey =
  | 'painShare'
  | 'likeShare'
  | 'wouldUseShare'
  | 'surveyPainShare'
  | 'vwAcceptable'
  | 'wouldPayShare'
  | 'smokeCr'
  | 'fakeDoorRate'
  | 'smokeCpl'
  | 'conciergeActive'
  | 'conciergePaid'
  | 'prototypeSuccess'
  | 'channelPresence';

// ---------- Scenario definitions (static content) ----------

export interface SegmentDef {
  id: string;
  name: string;
  short: string;
  persona: string;
  size: number;
  severity: number;
  wtp: number;
  fit: number;
  churn: number;
  stickiness: number;
  seats: number;
  needsSales?: boolean;
  affinity: Record<string, number>;
  quotes: { pain: string[]; noPain: string[] };
  spendHint: string;
}

export interface FeatureDef {
  id: string;
  name: string;
  description: string;
  kano: Kano;
  mustFor?: string[];
  effort: number;
  value: Record<string, number>;
  effects: Partial<Record<Lever, number>>;
  tags?: FeatureTag[];
  requires?: Capability[];
  monthlyCost?: number;
  perUserCost?: number;
  enablesRevenue?: boolean;
  enablesChannel?: string;
  hype?: number;
  // Raises the average check, e.g. a family or multi-location plan (0.08 = +8% at full value).
  arppu?: number;
}

export interface ChannelDef {
  id: string;
  name: string;
  description: string;
  kind: 'paid' | 'organic';
  cost: number;
  saturation: number;
  intent: number;
  attribution: number;
  fatigue: boolean;
  volatility: number;
  requires?: { capability?: Capability; feature?: string; role?: RoleId };
}

export interface ValuePropDef {
  id: string;
  title: string;
  text: string;
  match: Record<string, number>;
}

// What a North Star counts: engaged users, top-of-funnel volume, revenue or raw usage.
export type NorthStarMetric = 'engaged' | 'acquired' | 'registered' | 'mrr' | 'usage';

export interface NorthStarDef {
  id: string;
  title: string;
  quality: 'good' | 'ok' | 'bad';
  metric: NorthStarMetric;
  unit: string;
  lesson: string;
}

export interface PricingModelDef {
  id: string;
  name: string;
  description: string;
  regMult: number;
  payMult: number;
  viralMult: number;
  lateConversion: number;
  needsRole?: RoleId;
}

export interface ExperimentIdeaDef {
  id: string;
  name: string;
  hypothesis: string;
  metric: Exclude<Lever, 'virality'>;
  mean: number;
  sd: number;
  novelty?: number;
  guardrail?: { lever: Lever; effect: number };
  effort: number;
  priceMult?: number;
  requires?: Capability;
  darkPattern?: boolean;
  // Growth research kind that reveals this idea; without it the idea is visible from the start.
  source?: string;
}

export interface CompetitorDef {
  name: string;
  description: string;
  price: string;
  rating: string;
  strengths: string;
  weaknesses: string;
  features: string[];
}

export type BenchmarkKey =
  | 'registrationRate'
  | 'activationRate'
  | 'conversionRate'
  | 'retentionM1'
  | 'churnRate'
  | 'ltvCac'
  | 'payback'
  | 'nps'
  | 'nrr';

// Typical range for a healthy product in this market.
export interface Benchmark {
  low: number;
  high: number;
  better: 'up' | 'down';
}

export interface Targets {
  mrr: number;
  ltvCac: number;
  growth: number;
  pmf: number;
}

export interface ScenarioDef {
  id: ScenarioId;
  kind: ScenarioKind;
  title: string;
  tagline: string;
  productName: string;
  ceoName: string;
  market: string;
  intro: string[];
  labels: {
    acquired: string;
    registered: string;
    activated: string;
    paying: string;
    account: string;
    priceUnit: string;
    aha: string;
  };
  startCash: Record<Difficulty, number>;
  baseMonthlyCost: number;
  baseCostNote: string;
  targets: Record<Difficulty, Targets>;
  funnel: {
    regRate: number;
    actRate: number;
    actMax: number;
    payMax: number;
    retentionTau: number;
    viral: number;
    organicBase: number;
    smokeCpcMult: number;
    smokeBaseCr: number;
  };
  storeFee: number;
  priceOptions: number[];
  defaultPrice: number;
  pricingModels: PricingModelDef[];
  annualDiscount: number;
  launchSpike: number;
  segments: SegmentDef[];
  features: FeatureDef[];
  channels: ChannelDef[];
  valueProps: ValuePropDef[];
  northStars: NorthStarDef[];
  experiments: ExperimentIdeaDef[];
  competitors: CompetitorDef[];
  platformOptions: TechOption[];
  paymentOptions: TechOption[];
  seasonality: { demand: number[]; cpm: number[]; note: string };
  benchmarks: Partial<Record<BenchmarkKey, Benchmark>>;
  channelCplThresholds: number[];
  churnReasons: Record<string, string>;
  deskFacts: string[];
  expertFacts: string[];
  // Three short tags for the scenario card on the start screen.
  facts: string[];
  flavor: ScenarioFlavor;
}

// ---------- Tech ----------

export interface TechMods {
  velocity?: number;
  bugs?: number;
  debt?: number;
  ux?: number;
  registration?: number;
  infraFixed?: number;
  infraPerUser?: number;
  monthly?: number;
  setupPoints?: number;
  scaleLimit?: number;
  outage?: number;
  caps?: Capability[];
  storeFee?: number;
  effort?: Partial<Record<FeatureTag, number>>;
  needsRole?: RoleId;
  noise?: number;
  srm?: number;
  cohorts?: boolean;
  disablesBackend?: boolean;
  revenueFee?: number;
}

export interface TechOption {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  mods: TechMods;
}

export interface PracticeDef {
  id: PracticeId;
  name: string;
  description: string;
  mods: TechMods;
}

export interface ProcessDef {
  id: ProcessId;
  name: string;
  description: string;
  velocity: number;
  estimateNoise: number;
  bugs: number;
}

export interface TechChoices {
  platform: string;
  backend: string;
  infra: string;
  analytics: string;
  experiments: string;
  payments: string;
  auth: string;
  practices: PracticeId[];
  process: ProcessId;
}

// ---------- Team ----------

export interface RoleDef {
  id: RoleId;
  name: string;
  description: string;
  salary: Record<Level, number>;
  levels: Level[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: RoleId;
  level: Level;
  source: Source;
  salary: number;
  skill: number;
  joinWeek: number;
}

// ---------- Discovery ----------

export interface CriterionDef {
  id: string;
  kind: HypothesisKind;
  method: ResearchMethod;
  observation: ObservationKey;
  quality: 'strong' | 'medium' | 'weak' | 'invalid';
  template: string;
  thresholds: number[];
  unit: '%' | '$' | '';
  lowerIsBetter?: boolean;
  lesson: string;
}

export interface Hypothesis {
  id: string;
  kind: HypothesisKind;
  segmentId: string;
  channelId?: string;
  price?: number;
  criterionId: string;
  threshold: number;
  status: 'untested' | 'supported' | 'refuted';
  observed?: number;
  createdWeek: number;
  testedWeek?: number;
}

export interface ResearchParams {
  segmentId?: string;
  channelId?: string;
  count?: number;
  script?: 'open' | 'leading';
  budget?: number;
  price?: number;
}

export interface ActiveResearch {
  id: string;
  method: ResearchMethod;
  params: ResearchParams;
  startWeek: number;
  endWeek: number;
  cost: number;
}

export interface ReportMetric {
  label: string;
  value: string;
}

export interface ResearchReport {
  id: string;
  method: ResearchMethod;
  params: ResearchParams;
  week: number;
  title: string;
  summary: string[];
  metrics: ReportMetric[];
  quotes: string[];
  observations: Partial<Record<ObservationKey, number>>;
}

export interface FeatureSignal {
  sum: number;
  weight: number;
}

export interface Knowledge {
  marketSize: Record<string, number>;
  competitorsKnown: boolean;
  featureSignals: Record<string, Record<string, FeatureSignal>>;
  channelHints: Record<string, Record<string, number>>;
  waitlist: number;
  uxIssuesFound: number;
}

// ---------- World (hidden truth) ----------

export interface SegmentTruth {
  severity: number;
  wtp: number;
  fit: number;
  churn: number;
  stickiness: number;
  size: number;
}

export interface ExperimentTruth {
  effect: number;
  novelty: number;
}

export interface World {
  // Random game context (ids from data/context.ts).
  market: string;
  ceo: string;
  segments: Record<string, SegmentTruth>;
  featureValue: Record<string, Record<string, number>>;
  featureEffortMult: Record<string, number>;
  channelCost: Record<string, number>;
  experiments: Record<string, ExperimentTruth>;
}

// ---------- Product / growth ----------

export interface Strategy {
  segmentId: string;
  valuePropId: string;
  northStarId: string;
}

export interface Pricing {
  price: number;
  model: string;
  annual: boolean;
  proTier: boolean;
  // Retries failed card payments and reminds customers (recovers involuntary churn).
  dunning: boolean;
  // B2B: discount sales may give to close a deal (0, 0.1 or 0.2).
  dealDiscount: number;
}

export interface FeatureProgress {
  done: number;
  completed: boolean;
  shipped: boolean;
  completedWeek?: number;
}

export interface ProductState {
  features: Record<string, FeatureProgress>;
  bugs: number;
  debt: number;
  ux: number;
  leverMods: Record<Lever, number>;
  setupPoints: number;
  lostPoints: number;
  rating: number;
}

export interface Allocation {
  features: number;
  debt: number;
  bugs: number;
}

export interface MarketingState {
  budgets: Record<string, number>;
  creative: Record<string, number>;
  assets: Record<string, number>;
  disabledUntil: Record<string, number>;
  refreshCosts: number;
  // Monthly budget for lifecycle messaging: emails, push and win-back.
  crm: number;
}

export type ExperimentStatus = 'running' | 'done' | 'shipped' | 'rejected';

export interface ExperimentResult {
  nA: number;
  cA: number;
  nB: number;
  cB: number;
  rateA: number;
  rateB: number;
  uplift: number;
  ciLow: number;
  ciHigh: number;
  pValue: number;
  srmP: number;
  stoppedEarlyWeek?: number;
  guardrail?: { lever: Lever; uplift: number; pValue: number };
  revenuePerUserA?: number;
  revenuePerUserB?: number;
  // Results by traffic source; noisy, for hypotheses only.
  subgroups?: { name: string; uplift: number; pValue: number; n: number }[];
}

export interface Experiment {
  id: string;
  ideaId: string;
  metric: Exclude<Lever, 'virality'>;
  startWeek: number;
  durationWeeks: number;
  resultWeek: number;
  allocation: number;
  peeking: boolean;
  guardrails: boolean;
  mde: number;
  status: ExperimentStatus;
  variantPrice?: number;
  trueEffect: number;
  // Shipped with a small holdout group that measures the long-term effect.
  holdout?: boolean;
  holdoutWeek?: number;
  // Another test on the same metric ran at the same time.
  overlapWith?: string;
  result?: ExperimentResult;
  decidedWeek?: number;
  // Set when the test was extended after its first result.
  extended?: boolean;
  firstResult?: ExperimentResult;
  // Set for a feature released behind a feature flag.
  featureId?: string;
}

export interface Cohort {
  month: number;
  week: number;
  activated: number;
  newPaying: number;
  paying: number;
  active: number[];
  payingHistory: number[];
  // Price the cohort pays (kept when a raise applies only to new customers).
  price: number;
  // B2B accounts add or remove seats over time.
  seatMult: number;
  // Share of the cohort from the target segment: other people churn faster.
  quality: number;
}

export interface Metrics {
  acquired: number | null;
  registered: number | null;
  activated: number | null;
  newPaying: number | null;
  churned: number | null;
  paying: number | null;
  mau: number | null;
  registrationRate: number | null;
  activationRate: number | null;
  conversionRate: number | null;
  retentionM1: number | null;
  churnRate: number | null;
  arppu: number | null;
  cacBlended: number | null;
  cacPaid: number | null;
  ltv: number | null;
  ltvCac: number | null;
  payback: number | null;
  nps: number | null;
  nrr: number | null;
  northStar: number | null;
}

export interface Costs {
  salaries: number;
  marketing: number;
  infra: number;
  tools: number;
  content: number;
  other: number;
}

export type ReportLink = 'overview' | 'marketing' | 'product' | 'experiments' | 'analytics' | 'research' | 'inbox' | 'finance' | 'reports' | 'team';

export interface ReportLine {
  text: string;
  tone: 'good' | 'bad' | 'info' | 'action';
  link?: ReportLink;
}

// Player settings in effect during a month, to show what changed.
export interface MonthSettings {
  budgets: Record<string, number>;
  price: number;
  model: string;
  annual: boolean;
  proTier: boolean;
  crm: number;
  allocation: Allocation;
  team: Partial<Record<RoleId, number>>;
  analytics: string;
}

export interface FeatureUsage {
  adoption: number;
  // Null when the analytics tool has no cohorts.
  retentionWith: number | null;
  retentionWithout: number | null;
}

export interface MonthRecord {
  month: number;
  week: number;
  spend: Record<string, number>;
  acquiredBy: Record<string, number>;
  reportedBy: Record<string, number>;
  payingBy: Record<string, number>;
  organic: number;
  mrr: number;
  revenue: number;
  costs: Costs;
  cash: number;
  pmf: number;
  truth: Metrics;
  obs: Metrics;
  notes: ReportLine[];
  // Revenue after store fees and per-user costs, as a share of MRR.
  grossMargin?: number;
  pipeline?: number;
  // Share of target-segment users that each source brought.
  targetShareBy?: Record<string, number>;
  involuntary?: number;
  refunds?: number;
  support?: { tickets: number; capacity: number; csat: number };
  // Competitive pressure from 0 (none) to 1.
  pressure?: number;
  settings?: MonthSettings;
  featureUsage?: Record<string, FeatureUsage>;
}

export interface SprintRecord {
  index: number;
  week: number;
  capacity: number;
  featurePoints: number;
  debtPoints: number;
  bugPoints: number;
  completed: string[];
  bugsAfter: number;
  debtAfter: number;
}

export interface Modifier {
  id: string;
  label: string;
  lever: Lever | 'acquisition' | 'cpi' | 'churn';
  mult: number;
  untilWeek: number;
}

export interface PendingEvent {
  eventId: string;
  week: number;
  data?: Record<string, string | number>;
}

export interface LogEntry {
  week: number;
  title: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'info';
  category?: ScoreCategory;
  points?: number;
}

export interface LaunchState {
  strategy: 'soft' | 'big' | 'quiet';
  checklist: string[];
  beta: boolean;
  week: number;
  bigLaunchDone: boolean;
}

export interface GrowthResearchResult {
  kind: string;
  week: number;
  title: string;
  lines: string[];
  // Measured value, e.g. the PMF share.
  value?: number;
}

export interface Milestone {
  week: number;
  label: string;
  kind: 'launch' | 'price' | 'experiment' | 'feature' | 'pivot' | 'event' | 'marketing';
}

export type OkrMetric = 'mrr' | 'paying' | 'activation' | 'retention' | 'churn' | 'northStar';

export interface OkrGoal {
  metric: OkrMetric;
  base: number;
  target: number;
  actual?: number;
  met?: boolean;
}

export interface Okr {
  setWeek: number;
  dueMonth: number;
  goals: OkrGoal[];
  evaluated: boolean;
}

export interface InboxItem {
  id: string;
  week: number;
  source: 'review' | 'support' | 'sales' | 'ceo';
  topic: string;
  text: string;
  featureId?: string;
  stars?: number;
}

export type StakeholderId = 'cto' | 'sales' | 'marketing' | 'support';

export interface CompetitorState {
  name: string;
  strength: number;
  features: string[];
  priceCutUntil: number;
}


export interface Ending {
  kind: 'seriesA' | 'bridge' | 'stagnation' | 'bankrupt' | 'fired' | 'acquired';
  week: number;
  title: string;
  text: string;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  scenarioId: ScenarioId;
  difficulty: Difficulty;
  week: number;
  phase: Phase;
  cash: number;
  trust: number;
  morale: number;
  world: World;
  hypotheses: Hypothesis[];
  activeResearch: ActiveResearch[];
  reports: ResearchReport[];
  knowledge: Knowledge;
  strategy: Strategy | null;
  pricing: Pricing;
  tech: TechChoices;
  team: TeamMember[];
  mvpScope: string[];
  commitWeeks: number | null;
  buildStartWeek: number | null;
  product: ProductState;
  allocation: Allocation;
  featureQueue: string[];
  overtime: boolean;
  marketing: MarketingState;
  experiments: Experiment[];
  cohorts: Cohort[];
  history: MonthRecord[];
  sprints: SprintRecord[];
  growthResearch: GrowthResearchResult[];
  pendingGrowthResearch: string[];
  modifiers: Modifier[];
  pendingEvents: PendingEvent[];
  firedEvents: string[];
  log: LogEntry[];
  score: Record<ScoreCategory, number>;
  flags: Record<string, number>;
  launch: LaunchState | null;
  lastReport: ReportLine[];
  milestones: Milestone[];
  okrs: Okr[];
  inbox: InboxItem[];
  unlockedIdeas: string[];
  releaseWithAb: boolean;
  // Relationship with each team lead, 0–100.
  stakeholders: Record<StakeholderId, number>;
  // Hours of the product owner's own time left this turn.
  poHours: number;
  competitors: CompetitorState[];
  competitorNews: { week: number; text: string }[];
  // Compliance work that is done (ids from data/compliance.ts).
  compliance: string[];
  expandedWeek: number | null;
  // Share of the company sold in bridge rounds during the game.
  dilution: number;
  ending: Ending | null;
  nextId: number;
}
