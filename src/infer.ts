import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, truncateSync } from 'node:fs';
import { join } from 'node:path';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { MODEL, NOUL_NATIVE, QUESTION_HASH, QUESTIONS, type Pair, type Split } from './config.ts';
import { ROOT, type BenchmarkData } from './data.ts';

export const CACHE = join(ROOT, 'data', 'cache');
export type RawResponse = {
  split: Split;
  qid: string;
  pid: string;
  model: string;
  questionHash: string;
  requestHash: string;
  answers: {
    choice: { choice: string; probabilities: Record<string, number>; confidence: number };
    score: { score: number; probabilities: Record<string, number>; confidence: number };
    noul: { related: number; answers: number; exact: number };
  };
  inputTokens: number;
  outputTokens: number;
  latencySeconds: number;
  passageCap?: number; // 0 means full text; absent on early full-text pilot records
  originalPassageChars?: number;
  submittedPassageChars?: number;
};

export const cachePath = (split: Split) => join(CACHE, `${split}.jsonl`);

const OMITTED = '\n[Middle of passage omitted to fit Jev context limit]\n';
export function submittedPassage(passage: string, cap = 0): string {
  if (!cap || passage.length <= cap) return passage;
  const head = Math.floor((cap - OMITTED.length) / 2);
  const tail = cap - OMITTED.length - head;
  return passage.slice(0, head) + OMITTED + passage.slice(-tail);
}

export function requestHash(query: string, passage: string, cap = 0): string {
  const body = { model: MODEL, state: { query, passage: submittedPassage(passage, cap) }, questions: QUESTIONS };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function readCache(split: Split): Map<Pair, RawResponse> {
  const path = cachePath(split);
  const rows = new Map<Pair, RawResponse>();
  if (!existsSync(path)) return rows;
  const text = readFileSync(path, 'utf8');
  const lastNewline = text.lastIndexOf('\n');
  if (lastNewline < text.length - 1) {
    // Only a final interrupted append can be incomplete; remove it before resuming.
    truncateSync(path, Buffer.byteLength(text.slice(0, lastNewline + 1)));
  }
  for (const line of text.slice(0, lastNewline + 1).split('\n')) {
    if (!line) continue;
    const row = JSON.parse(line) as RawResponse;
    if (row.split !== split || row.model !== MODEL || row.questionHash !== QUESTION_HASH) throw new Error('Stale inference cache');
    const key: Pair = `${row.qid}\t${row.pid}`;
    const prior = rows.get(key);
    if (prior && prior.requestHash !== row.requestHash) throw new Error(`Conflicting cache rows: ${key}`);
    rows.set(key, row);
  }
  return rows;
}

export function loadResponses(data: BenchmarkData, split: Split): Map<Pair, RawResponse> {
  const rows = readCache(split);
  const expected = data[split];
  if (rows.size !== expected.size) throw new Error(`Incomplete ${split} responses: ${rows.size}/${expected.size}`);
  for (const [key, row] of rows) {
    if (!expected.has(key)) throw new Error(`Unexpected ${split} response: ${key}`);
    const q = data.queries.get(row.qid)!;
    const d = data.passages.get(row.pid)!;
    if (requestHash(q, d, row.passageCap ?? 0) !== row.requestHash) throw new Error(`Stale response for ${key}`);
  }
  return rows;
}

export function selectPairs(data: BenchmarkData, split: Split, pilot?: number): Pair[] {
  const pairs = [...data[split].keys()].sort();
  if (pilot === undefined) return pairs;
  if (split !== 'dev' || pilot < 4 || pilot % 4 !== 0) throw new Error('Pilot must be a multiple of four on development data');
  const byGrade = [[], [], [], []] as Pair[][];
  for (const pair of pairs) byGrade[data.dev.get(pair)!].push(pair);
  return byGrade.flatMap(rows => rows.slice(0, pilot / 4)).sort();
}

function apiKey(envFile: string): string {
  if (existsSync(envFile)) {
    // Node's built-in .env loader does not log or persist the credential.
    process.loadEnvFile(envFile);
  }
  const key = process.env.TYPESAFE_API_KEY || process.env.typesafe_api_key;
  if (!key) throw new Error(`TYPESAFE_API_KEY is required in the environment or ${envFile}`);
  return key;
}

export async function infer(data: BenchmarkData, split: Split, options: {
  pilot?: number; concurrency?: number; envFile?: string;
} = {}): Promise<void> {
  const concurrency = options.concurrency ?? 8;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Concurrency must be 1–32');
  const selected = selectPairs(data, split, options.pilot);
  const cached = readCache(split);
  const pending = selected.filter(pair => {
    const [qid, pid] = pair.split('\t');
    const hash = requestHash(data.queries.get(qid)!, data.passages.get(pid)!, rowCap(cached.get(pair)));
    const row = cached.get(pair);
    if (row && row.requestHash !== hash) throw new Error(`Stale cached request: ${pair}`);
    return !row;
  });
  console.log(`${split}: ${selected.length} selected, ${pending.length} API calls pending`);
  if (!pending.length) return;
  const client = new TypeSafeClient({ apiKey: apiKey(options.envFile ?? join(ROOT, '.env')), timeout: 120_000 });
  mkdirSync(CACHE, { recursive: true });
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const pair = pending[cursor++];
      const [qid, pid] = pair.split('\t');
      const query = data.queries.get(qid)!;
      const passage = data.passages.get(pid)!;
      const started = performance.now();
      const caps = (passage.length > 60_000 ? [60_000, 30_000, 15_000, 7_500, 4_000] : [0, 30_000, 15_000, 7_500, 4_000])
        .filter(cap => cap === 0 || cap < passage.length);
      const call = (cap: number) => client.systemOne({ model: MODEL, state: { query, passage: submittedPassage(passage, cap) }, questions: QUESTIONS });
      let response: Awaited<ReturnType<typeof call>> | undefined;
      let usedCap = 0;
      for (const cap of caps) {
        try {
          response = await call(cap);
          usedCap = cap;
          break;
        } catch (error) {
          if (!String(error).includes('max_tokens_exceeded') || cap === caps.at(-1)) throw error;
          console.error(`Context limit for ${split}/${qid}/${pid}; retrying with shorter passage`);
        }
      }
      if (!response) throw new Error(`No Jev response for ${pair}`);
      if (response.model !== MODEL) throw new Error(`Unexpected model ${response.model} for ${pair}`);
      const row: RawResponse = {
        split, qid, pid, model: response.model, questionHash: QUESTION_HASH,
        requestHash: requestHash(query, passage, usedCap),
        answers: {
          choice: {
            choice: response.answers.choice.choice,
            probabilities: { ...response.answers.choice.probabilities },
            confidence: response.answers.choice.confidence,
          },
          score: {
            score: response.answers.score.score,
            probabilities: { ...response.answers.score.probabilities },
            confidence: response.answers.score.confidence,
          },
          noul: {
            related: response.answers.related.noul,
            answers: response.answers.answers.noul,
            exact: response.answers.exact.noul,
          },
        },
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencySeconds: (performance.now() - started) / 1000,
        passageCap: usedCap,
        originalPassageChars: passage.length,
        submittedPassageChars: submittedPassage(passage, usedCap).length,
      };
      validateResponse(row);
      appendFileSync(cachePath(split), `${JSON.stringify(row)}\n`);
      completed++;
      if (completed % 100 === 0 || completed === pending.length) console.log(`${split}: saved ${completed}/${pending.length}`);
    }
  };
  const workers = await Promise.allSettled(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  const failure = workers.find(item => item.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}

const rowCap = (row: RawResponse | undefined) => row?.passageCap ?? 0;

export function validateResponse(row: RawResponse): void {
  const choice = Number(row.answers.choice.choice);
  const probabilities = row.answers.choice.probabilities;
  const score = row.answers.score.score;
  if (!Number.isInteger(choice) || choice < 0 || choice > 3 ||
      !Number.isFinite(score) || score < 0 || score > 3 ||
      Object.keys(probabilities).length !== 4 ||
      Math.abs(Object.values(probabilities).reduce((a, b) => a + b, 0) - 1) > 0.02 ||
      !Number.isInteger(row.inputTokens) || row.inputTokens < 0) {
    throw new Error(`Invalid Jev response for ${row.qid}/${row.pid}`);
  }
  for (const p of Object.values(row.answers.noul)) {
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error(`Invalid Noul probability for ${row.qid}/${row.pid}`);
  }
}

export function gradeNoul(row: RawResponse, thresholds: readonly number[] = NOUL_NATIVE): number {
  const { related, answers, exact } = row.answers.noul;
  return exact >= thresholds[2] ? 3 : answers >= thresholds[1] ? 2 : related >= thresholds[0] ? 1 : 0;
}
