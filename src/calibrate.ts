import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MODEL, NOUL_NATIVE, QUESTION_HASH, SCORE_NATIVE, type Pair } from './config.ts';
import { ROOT, type BenchmarkData } from './data.ts';
import { gradeNoul, type RawResponse } from './infer.ts';
import { kappa, kappaFromConfusion } from './metrics.ts';

export type Thresholds = [number, number, number];
export type Calibration = { model: string; questionHash: string; objective: string; gridStep: number;
  devPairs: number; score: Thresholds; noul: Thresholds; devKappa: { score: number; noul: number } };
export const CALIBRATION_PATH = join(ROOT, 'results', 'calibration.json');

export function gradeScore(value: number, thresholds: readonly number[] = SCORE_NATIVE): number {
  return value >= thresholds[2] ? 3 : value >= thresholds[1] ? 2 : value >= thresholds[0] ? 1 : 0;
}

const distance = (a: readonly number[], b: readonly number[]) => a.reduce((sum, x, i) => sum + (x - b[i]) ** 2, 0);
const better = (value: number, thresholds: Thresholds, bestValue: number, best: Thresholds, native: readonly number[]) =>
  value > bestValue + 1e-12 || (Math.abs(value - bestValue) <= 1e-12 &&
    (distance(thresholds, native) < distance(best, native) - 1e-12 ||
      (Math.abs(distance(thresholds, native) - distance(best, native)) <= 1e-12 &&
        thresholds.join(',') < best.join(','))));

export function tuneScore(truth: readonly number[], scores: readonly number[]): { thresholds: Thresholds; kappa: number } {
  if (truth.length !== scores.length || !truth.length) throw new Error('Invalid Score calibration data');
  const grid = Array.from({ length: 59 }, (_, i) => (i + 1) / 20);
  const prefix = grid.map(cut => {
    const count = [0, 0, 0, 0];
    scores.forEach((score, i) => { if (score < cut) count[truth[i]]++; });
    return count;
  });
  const total = [0, 0, 0, 0];
  truth.forEach(grade => total[grade]++);
  let best: Thresholds = [...SCORE_NATIVE], bestValue = -Infinity;
  for (let i = 0; i < grid.length; i++) for (let j = i + 1; j < grid.length; j++) for (let k = j + 1; k < grid.length; k++) {
    const matrix = [0, 1, 2, 3].map(t => [
      prefix[i][t], prefix[j][t] - prefix[i][t],
      prefix[k][t] - prefix[j][t], total[t] - prefix[k][t],
    ]);
    const value = kappaFromConfusion(matrix);
    const candidate: Thresholds = [grid[i], grid[j], grid[k]];
    if (better(value, candidate, bestValue, best, SCORE_NATIVE)) { best = candidate; bestValue = value; }
  }
  return { thresholds: best, kappa: bestValue };
}

export function tuneNoul(truth: readonly number[], rows: readonly RawResponse[]): { thresholds: Thresholds; kappa: number } {
  if (truth.length !== rows.length || !truth.length) throw new Error('Invalid Noul calibration data');
  const grid = Array.from({ length: 19 }, (_, i) => (i + 1) / 20);
  let best: Thresholds = [...NOUL_NATIVE], bestValue = -Infinity;
  for (const related of grid) for (const answers of grid) for (const exact of grid) {
    const candidate: Thresholds = [related, answers, exact];
    const predicted = rows.map(row => gradeNoul(row, candidate));
    const value = kappa(truth, predicted);
    if (better(value, candidate, bestValue, best, NOUL_NATIVE)) { best = candidate; bestValue = value; }
  }
  return { thresholds: best, kappa: bestValue };
}

export function calibrate(data: BenchmarkData, responses: Map<Pair, RawResponse>): Calibration {
  const pairs = [...data.dev.keys()].sort();
  if (responses.size !== pairs.length) throw new Error('Complete development responses required');
  const rows = pairs.map(pair => responses.get(pair)!);
  const truth = pairs.map(pair => data.dev.get(pair)!);
  const score = tuneScore(truth, rows.map(row => row.answers.score.score));
  const noul = tuneNoul(truth, rows);
  const result: Calibration = { model: MODEL, questionHash: QUESTION_HASH,
    objective: 'Maximize unweighted four-grade Cohen kappa on development pairs; ties use closest native thresholds, then lexicographic order',
    gridStep: 0.05, devPairs: pairs.length, score: score.thresholds, noul: noul.thresholds,
    devKappa: { score: score.kappa, noul: noul.kappa } };
  mkdirSync(dirname(CALIBRATION_PATH), { recursive: true });
  writeFileSync(CALIBRATION_PATH, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export function loadCalibration(): Calibration {
  if (!existsSync(CALIBRATION_PATH)) throw new Error('Run calibrate after complete development inference');
  const result = JSON.parse(readFileSync(CALIBRATION_PATH, 'utf8')) as Calibration;
  if (result.model !== MODEL || result.questionHash !== QUESTION_HASH || result.devPairs !== 7263) throw new Error('Stale calibration');
  return result;
}
