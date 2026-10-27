// Seeded pseudo-random generator (mulberry32). The generator state is a single
// uint32 so it can be stored inside the serializable game state.

export interface Rng {
  next(): number;
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state() {
      return a;
    },
  };
}

export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next();
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(uniform(rng, min, max + 1));
}

export function chance(rng: Rng, p: number): boolean {
  return rng.next() < p;
}

export function normal(rng: Rng, mean = 0, sd = 1): number {
  const u = Math.max(rng.next(), 1e-12);
  const v = rng.next();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Multiplicative noise around 1 that never goes negative.
export function noiseMult(rng: Rng, sd: number): number {
  return Math.exp(normal(rng, 0, sd) - (sd * sd) / 2);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng.next() * items.length)];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T | undefined {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (total <= 0) return undefined;
  let r = rng.next() * total;
  for (const item of items) {
    r -= Math.max(0, weight(item));
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

// Number of successes in n Bernoulli(p) trials. Exact for small n,
// normal approximation for large n (accurate enough for the simulation).
export function binomial(rng: Rng, n: number, p: number): number {
  const trials = Math.max(0, Math.round(n));
  const prob = Math.min(1, Math.max(0, p));
  if (trials <= 60) {
    let k = 0;
    for (let i = 0; i < trials; i++) if (rng.next() < prob) k++;
    return k;
  }
  const mean = trials * prob;
  const sd = Math.sqrt(trials * prob * (1 - prob));
  return Math.min(trials, Math.max(0, Math.round(normal(rng, mean, sd))));
}
