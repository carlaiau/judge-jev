import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeScore, tuneScore } from '../src/calibrate.ts';
import { gradeNoul, requestHash, selectPairs, submittedPassage, type RawResponse } from '../src/infer.ts';
import { binaryKappas, confusion, kappa, kendallTauB, nominalAlpha, spearman } from '../src/metrics.ts';
import type { BenchmarkData } from '../src/data.ts';
import { pairKey } from '../src/config.ts';

test('native grade boundaries and answer-bearing split', () => {
  assert.deepEqual([0, 0.5, 1.5, 2.5, 3].map(value => gradeScore(value)), [0, 1, 2, 3, 3]);
  const truth = [0, 1, 2, 3];
  assert.equal(binaryKappas(truth, truth)['01|23'], 1);
  assert.deepEqual(confusion(truth, truth), [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]);
});

test('four-grade agreement and system-order statistics handle ties', () => {
  const truth = [0, 1, 2, 3, 1, 2];
  assert.equal(kappa(truth, truth), 1);
  assert.equal(nominalAlpha(truth, truth), 1);
  assert.equal(kendallTauB([1, 2, 3], [3, 2, 1]), -1);
  assert.equal(spearman([1, 2, 3], [1, 2, 3]), 1);
  assert.ok(Number.isFinite(kendallTauB([1, 1, 3], [2, 3, 3])));
});

test('Score calibration selects ordered thresholds using development labels', () => {
  const truth = [0, 0, 1, 1, 2, 2, 3, 3];
  const scores = [0.05, 0.1, 0.4, 0.6, 1.1, 1.3, 1.7, 1.9];
  const result = tuneScore(truth, scores);
  assert.equal(result.kappa, 1);
  assert.deepEqual(scores.map(score => gradeScore(score, result.thresholds)), truth);
  assert.ok(result.thresholds[0] < result.thresholds[1] && result.thresholds[1] < result.thresholds[2]);
});

test('Noul grade uses the highest satisfied cumulative proposition', () => {
  const row = { answers: { noul: { related: 0.1, answers: 0.3, exact: 0.9 } } } as RawResponse;
  assert.equal(gradeNoul(row), 3);
  assert.equal(gradeNoul(row, [0.5, 0.5, 0.95]), 0);
});

test('technical pilot is balanced across development grades', () => {
  const dev = new Map(Array.from({ length: 16 }, (_, i) => [pairKey(`q${i}`, `p${i}`), i % 4] as const));
  const data = { dev } as BenchmarkData;
  const selected = selectPairs(data, 'dev', 8);
  assert.deepEqual([0, 1, 2, 3].map(grade => selected.filter(pair => dev.get(pair) === grade).length), [2, 2, 2, 2]);
});

test('overlength passages preserve both ends and change the request identity', () => {
  const original = 'begin'.padEnd(50_000, 'x') + 'end'.padStart(50_000, 'y');
  const submitted = submittedPassage(original, 60_000);
  assert.equal(submitted.length, 60_000);
  assert.ok(submitted.startsWith('begin'));
  assert.ok(submitted.endsWith('end'));
  assert.ok(submitted.includes('[Middle of passage omitted to fit Jev context limit]'));
  assert.notEqual(requestHash('query', original), requestHash('query', original, 60_000));
});
