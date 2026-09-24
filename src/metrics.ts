import type { Pair } from './config.ts';

export function confusion(truth: readonly number[], predicted: readonly number[], classes = 4): number[][] {
  if (truth.length !== predicted.length || !truth.length) throw new Error('Mismatched/empty labels');
  const matrix = Array.from({ length: classes }, () => Array<number>(classes).fill(0));
  for (let i = 0; i < truth.length; i++) {
    const t = truth[i], p = predicted[i];
    if (!Number.isInteger(t) || !Number.isInteger(p) || t < 0 || p < 0 || t >= classes || p >= classes) throw new Error('Invalid label');
    matrix[t][p]++;
  }
  return matrix;
}

export function kappaFromConfusion(matrix: readonly (readonly number[])[]): number {
  const classes = matrix.length;
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  if (!total) throw new Error('Empty confusion matrix');
  const observed = matrix.reduce((sum, row, i) => sum + row[i], 0) / total;
  let expected = 0;
  for (let c = 0; c < classes; c++) {
    const truth = matrix[c].reduce((a, b) => a + b, 0);
    const pred = matrix.reduce((a, row) => a + row[c], 0);
    expected += truth * pred / (total * total);
  }
  return expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
}

export const kappa = (truth: readonly number[], predicted: readonly number[], classes = 4) =>
  kappaFromConfusion(confusion(truth, predicted, classes));

// Krippendorff nominal alpha for two complete raters, using pair coincidences.
export function nominalAlpha(truth: readonly number[], predicted: readonly number[], classes = 4): number {
  const matrix = confusion(truth, predicted, classes);
  const n = truth.length;
  const disagreement = 1 - matrix.reduce((sum, row, i) => sum + row[i], 0) / n;
  const counts = Array<number>(classes).fill(0);
  for (let c = 0; c < classes; c++) counts[c] = matrix[c].reduce((a, b) => a + b, 0) + matrix.reduce((a, row) => a + row[c], 0);
  const m = 2 * n;
  const expected = 1 - counts.reduce((sum, count) => sum + count * (count - 1), 0) / (m * (m - 1));
  return expected === 0 ? (disagreement === 0 ? 1 : 0) : 1 - disagreement / expected;
}

export function gradeDistribution(predicted: readonly number[], classes = 4): number[] {
  return Array.from({ length: classes }, (_, grade) => predicted.filter(value => value === grade).length);
}

export function binaryKappas(truth: readonly number[], predicted: readonly number[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const cut of [1, 2, 3]) {
    result[cut === 1 ? '0|123' : cut === 2 ? '01|23' : '012|3'] = kappa(
      truth.map(x => Number(x >= cut)), predicted.map(x => Number(x >= cut)), 2,
    );
  }
  return result;
}

export function pearson(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length || x.length < 2) throw new Error('Invalid vectors');
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let numerator = 0, xx = 0, yy = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx, b = y[i] - my;
    numerator += a * b; xx += a * a; yy += b * b;
  }
  return xx === 0 || yy === 0 ? NaN : numerator / Math.sqrt(xx * yy);
}

export function ranks(values: readonly number[]): number[] {
  const sorted = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = Array<number>(values.length);
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].value === sorted[start].value) end++;
    const rank = (start + end - 1) / 2 + 1;
    for (let i = start; i < end; i++) result[sorted[i].index] = rank;
    start = end;
  }
  return result;
}

export const spearman = (x: readonly number[], y: readonly number[]) => pearson(ranks(x), ranks(y));

export function kendallTauB(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length || x.length < 2) throw new Error('Invalid vectors');
  let concordant = 0, discordant = 0, xTie = 0, yTie = 0;
  for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) {
    const dx = Math.sign(x[i] - x[j]), dy = Math.sign(y[i] - y[j]);
    if (dx === 0 && dy === 0) continue;
    if (dx === 0) xTie++;
    else if (dy === 0) yTie++;
    else if (dx === dy) concordant++;
    else discordant++;
  }
  const denominator = Math.sqrt((concordant + discordant + xTie) * (concordant + discordant + yTie));
  return denominator ? (concordant - discordant) / denominator : NaN;
}

export function percentile(sorted: readonly number[], p: number): number {
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index), high = Math.ceil(index);
  return sorted[low] * (high - index) + sorted[high] * (index - low) || sorted[low];
}

export function bootstrapByQuery(
  pairs: readonly Pair[], truth: readonly number[], predicted: readonly number[],
  iterations = 1000, seed = 20260924,
): { kappa: [number, number]; binaryAnswerKappa: [number, number] } {
  const groups = new Map<string, number[]>();
  pairs.forEach((pair, index) => {
    const qid = pair.split('\t')[0];
    if (!groups.has(qid)) groups.set(qid, []);
    groups.get(qid)!.push(index);
  });
  const byQuery = [...groups.values()];
  let state = seed >>> 0;
  const random = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 2 ** 32;
  };
  const ks: number[] = [], bs: number[] = [];
  for (let repeat = 0; repeat < iterations; repeat++) {
    const t: number[] = [], p: number[] = [];
    for (let q = 0; q < byQuery.length; q++) {
      for (const index of byQuery[Math.floor(random() * byQuery.length)]) {
        t.push(truth[index]); p.push(predicted[index]);
      }
    }
    ks.push(kappa(t, p));
    bs.push(kappa(t.map(x => Number(x >= 2)), p.map(x => Number(x >= 2)), 2));
  }
  ks.sort((a, b) => a - b); bs.sort((a, b) => a - b);
  return { kappa: [percentile(ks, 0.025), percentile(ks, 0.975)],
    binaryAnswerKappa: [percentile(bs, 0.025), percentile(bs, 0.975)] };
}
