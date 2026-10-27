// Statistics helpers for A/B tests and pricing models.

// Standard normal CDF (Zelen & Severo approximation, |error| < 7.5e-8).
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

// Inverse standard normal CDF (Acklam's algorithm).
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export interface ProportionTest {
  rateA: number;
  rateB: number;
  uplift: number;
  ciLow: number;
  ciHigh: number;
  z: number;
  pValue: number;
}

// Two-sided z-test for the difference of two proportions. The confidence
// interval is for the relative uplift (B vs A), using the delta method.
export function proportionTest(cA: number, nA: number, cB: number, nB: number): ProportionTest {
  const rateA = nA > 0 ? cA / nA : 0;
  const rateB = nB > 0 ? cB / nB : 0;
  const pooled = nA + nB > 0 ? (cA + cB) / (nA + nB) : 0;
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / Math.max(nA, 1) + 1 / Math.max(nB, 1)));
  const z = sePooled > 0 ? (rateB - rateA) / sePooled : 0;
  const pValue = 2 * (1 - normCdf(Math.abs(z)));
  const uplift = rateA > 0 ? rateB / rateA - 1 : 0;
  const seDiff = Math.sqrt((rateA * (1 - rateA)) / Math.max(nA, 1) + (rateB * (1 - rateB)) / Math.max(nB, 1));
  const half = rateA > 0 ? (1.96 * seDiff) / rateA : 0;
  return { rateA, rateB, uplift, ciLow: uplift - half, ciHigh: uplift + half, z, pValue };
}

// Users needed in EACH group to detect a relative change `mde` from `baseline`.
export function sampleSizePerGroup(baseline: number, mde: number, alpha = 0.05, power = 0.8): number {
  const p1 = baseline;
  const p2 = Math.min(0.999, baseline * (1 + mde));
  const zA = normInv(1 - alpha / 2);
  const zB = normInv(power);
  const pBar = (p1 + p2) / 2;
  const num = zA * Math.sqrt(2 * pBar * (1 - pBar)) + zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  const diff = p2 - p1;
  if (diff === 0) return Infinity;
  return Math.ceil((num * num) / (diff * diff));
}

// Sample ratio mismatch check (chi-square with 1 df for a 50/50 split).
export function srmPValue(nA: number, nB: number): number {
  const total = nA + nB;
  if (total === 0) return 1;
  const expected = total / 2;
  const chi = ((nA - expected) ** 2 + (nB - expected) ** 2) / expected;
  return 2 * (1 - normCdf(Math.sqrt(chi)));
}

// Share of people whose willingness to pay is at least `price`, assuming a
// log-normal WTP distribution with the given median.
export function priceAcceptance(price: number, medianWtp: number, sigma = 0.55): number {
  if (price <= 0) return 1;
  if (medianWtp <= 0) return 0;
  return 1 - normCdf((Math.log(price) - Math.log(medianWtp)) / sigma);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
