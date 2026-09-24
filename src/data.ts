import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { finished } from 'node:stream/promises';
import { EXPECTED, pairKey, SOURCES, type Pair, type SourceRepo, type Split } from './config.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const RAW = join(ROOT, 'data', 'raw');
export const MANIFEST = join(ROOT, 'data', 'manifest.json');
const CHALLENGE: SourceRepo = 'llm4eval/LLMJudge';
const BENCHMARK: SourceRepo = 'llm4eval/LLMJudge-benchmark';
const RUNS: SourceRepo = 'rahmanidashti/SyntheticTestCollections';
export const sourcePath = (repo: SourceRepo, path: string) => join(RAW, repo, path);

type FileSpec = { repo: SourceRepo; path: string; blob: string };
type DataManifest = {
  sources: typeof SOURCES;
  files: Record<string, { sha256: string; gitBlobSha: string; bytes: number }>;
};
const sourceKey = (spec: Pick<FileSpec, 'repo' | 'path'>) => `${spec.repo}/${spec.path}`;
const sha256 = (body: Buffer) => createHash('sha256').update(body).digest('hex');
const gitBlobSha = (body: Buffer) => createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');

function ghJson<T>(endpoint: string): T {
  return JSON.parse(execFileSync('gh', ['api', endpoint], { encoding: 'utf8', maxBuffer: 20_000_000 })) as T;
}

async function download(spec: FileSpec): Promise<[string, DataManifest['files'][string]]> {
  const destination = sourcePath(spec.repo, spec.path);
  mkdirSync(dirname(destination), { recursive: true });
  const validExisting = existsSync(destination) && statSync(destination).size > 0 &&
    gitBlobSha(readFileSync(destination)) === spec.blob;
  if (!validExisting) {
    const temporary = `${destination}.part`;
    // The contents endpoint can alter escaped control bytes in large JSONL files.
    // The immutable Git blob endpoint preserves the exact checked-in bytes.
    const endpoint = `repos/${spec.repo}/git/blobs/${spec.blob}`;
    const child = spawn('gh', ['api', endpoint, '-H', 'Accept: application/vnd.github.raw+json'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const output = createWriteStream(temporary);
    child.stdout.pipe(output);
    let error = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { error += chunk; });
    const exit = new Promise<number>((accept, reject) => {
      child.on('error', reject);
      child.on('close', code => accept(code ?? 1));
    });
    const [code] = await Promise.all([exit, finished(output)]);
    if (code !== 0) {
      rmSync(temporary, { force: true });
      throw new Error(`gh api failed for ${sourceKey(spec)}: ${error}`);
    }
    renameSync(temporary, destination);
  }
  const body = readFileSync(destination);
  if (gitBlobSha(body) !== spec.blob) throw new Error(`Git blob mismatch: ${sourceKey(spec)}`);
  return [sourceKey(spec), { sha256: sha256(body), gitBlobSha: spec.blob, bytes: body.length }];
}

export async function prepareData(): Promise<void> {
  type Tree = { tree: { path: string; type: string; sha: string }[]; truncated?: boolean };
  const trees = new Map<SourceRepo, Tree>();
  for (const repo of Object.keys(SOURCES) as SourceRepo[]) {
    const tree = ghJson<Tree>(`repos/${repo}/git/trees/${SOURCES[repo]}?recursive=1`);
    if (tree.truncated) throw new Error(`Truncated Git tree for ${repo}`);
    trees.set(repo, tree);
  }
  const required = [
    'data/llm4eval_document_2024.jsonl', 'data/llm4eval_query_2024.txt',
    'data/llm4eval_dev_qrel_2024.txt', 'data/llm4eval_test_qrel_2024.txt',
    'data/ids-mapping-files/docid_to_docidx.txt', 'data/ids-mapping-files/qid_to_qidx.txt',
  ];
  const wanted = new Map<SourceRepo, string[]>([
    [CHALLENGE, required],
    [BENCHMARK, ['llmjudge/qrels/llmjudge_test_qrel_idx.txt', 'llmjudge/qrels/llmjudge_test_qrel_ids.txt']],
    [RUNS, ['2023.qrels.pass.withDupes.txt']],
  ]);
  const scores = trees.get(BENCHMARK)!.tree.filter(row => row.type === 'blob' && row.path.startsWith('submissions/scores/'));
  const runs = trees.get(RUNS)!.tree.filter(row => row.type === 'blob' && row.path.startsWith('dl-2023-runs/'));
  if (scores.length !== 33 || runs.length !== 35) throw new Error(`Unexpected source inventory: ${scores.length} judges, ${runs.length} runs`);
  wanted.get(BENCHMARK)!.push(...scores.map(row => row.path));
  wanted.get(RUNS)!.push(...runs.map(row => row.path));
  const files: FileSpec[] = [];
  for (const [repo, paths] of wanted) {
    const blobs = new Map(trees.get(repo)!.tree.map(row => [row.path, row]));
    for (const path of paths) {
      const blob = blobs.get(path);
      if (!blob || blob.type !== 'blob') throw new Error(`Missing upstream file ${repo}/${path}`);
      files.push({ repo, path, blob: blob.sha });
    }
  }
  const entries: [string, DataManifest['files'][string]][] = [];
  // Four concurrent downloads keep the 35 large run files manageable.
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < files.length) {
      const spec = files[next++];
      entries.push(await download(spec));
      if (entries.length % 10 === 0 || entries.length === files.length) console.error(`Verified ${entries.length}/${files.length} files`);
    }
  }));
  mkdirSync(dirname(MANIFEST), { recursive: true });
  const manifest: DataManifest = { sources: SOURCES, files: Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  loadData();
}

export function verifyManifest(): void {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as DataManifest;
  if (JSON.stringify(manifest.sources) !== JSON.stringify(SOURCES)) throw new Error('Source revisions differ from frozen config');
  for (const [key, expected] of Object.entries(manifest.files)) {
    const path = join(RAW, key);
    const body = readFileSync(path);
    if (sha256(body) !== expected.sha256 || gitBlobSha(body) !== expected.gitBlobSha || body.length !== expected.bytes) {
      throw new Error(`Source hash mismatch: ${key}`);
    }
  }
}

export function readQrels(path: string, labeled = true, maxGrade = 3): Map<Pair, number> {
  const rows = new Map<Pair, number>();
  for (const line of readFileSync(path, 'utf8').trimEnd().split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== (labeled ? 4 : 3) || parts[1] !== '0') throw new Error(`Invalid qrel row in ${path}: ${line}`);
    const key = pairKey(parts[0], parts[2]);
    if (rows.has(key)) throw new Error(`Duplicate qrel ${key}`);
    const grade = labeled ? Number(parts[3]) : -1;
    if (labeled && (!Number.isInteger(grade) || grade < 0 || grade > maxGrade)) throw new Error(`Invalid grade: ${line}`);
    rows.set(key, grade);
  }
  return rows;
}

function readMapping(path: string): Map<string, string> {
  const mapping = new Map<string, string>();
  for (const line of readFileSync(path, 'utf8').trimEnd().split(/\r?\n/)) {
    const [original, short, extra] = line.split('\t');
    if (!original || !short || extra !== undefined || mapping.has(original)) throw new Error(`Invalid mapping in ${path}`);
    mapping.set(original, short);
  }
  if (new Set(mapping.values()).size !== mapping.size) throw new Error(`Duplicate mapped ID in ${path}`);
  return mapping;
}

export type BenchmarkData = {
  queries: Map<string, string>;
  passages: Map<string, string>;
  dev: Map<Pair, number>;
  test: Map<Pair, number>;
  qidMap: Map<string, string>;
  docidMap: Map<string, string>;
};

export function loadData(): BenchmarkData {
  verifyManifest();
  const queries = new Map<string, string>();
  for (const line of readFileSync(sourcePath(CHALLENGE, 'data/llm4eval_query_2024.txt'), 'utf8').trimEnd().split(/\r?\n/)) {
    const tab = line.indexOf('\t');
    const [qid, text] = [line.slice(0, tab), line.slice(tab + 1)];
    if (tab < 1 || !text.trim() || queries.has(qid)) throw new Error('Duplicate/empty query');
    queries.set(qid, text);
  }
  const passages = new Map<string, string>();
  for (const line of readFileSync(sourcePath(CHALLENGE, 'data/llm4eval_document_2024.jsonl'), 'utf8').trimEnd().split(/\r?\n/)) {
    const row = JSON.parse(line) as { docid: string; doc: string };
    if (!row.docid || !row.doc?.trim() || passages.has(row.docid)) throw new Error('Duplicate/empty passage');
    passages.set(row.docid, row.doc);
  }
  const dev = readQrels(sourcePath(CHALLENGE, 'data/llm4eval_dev_qrel_2024.txt'));
  const test = readQrels(sourcePath(BENCHMARK, 'llmjudge/qrels/llmjudge_test_qrel_idx.txt'));
  const requested = readQrels(sourcePath(CHALLENGE, 'data/llm4eval_test_qrel_2024.txt'), false);
  if (test.size !== requested.size || [...test.keys()].some(key => !requested.has(key))) throw new Error('Test labels differ from challenge request pairs');
  const qidMap = readMapping(sourcePath(CHALLENGE, 'data/ids-mapping-files/qid_to_qidx.txt'));
  const docidMap = readMapping(sourcePath(CHALLENGE, 'data/ids-mapping-files/docid_to_docidx.txt'));
  const original = readQrels(sourcePath(BENCHMARK, 'llmjudge/qrels/llmjudge_test_qrel_ids.txt'));
  if (original.size !== test.size) throw new Error('Original/short test qrel sizes differ');
  for (const [pair, grade] of original) {
    const [q, d] = pair.split('\t');
    if (test.get(pairKey(qidMap.get(q) ?? '', docidMap.get(d) ?? '')) !== grade) throw new Error('Original/short test qrels disagree');
  }
  for (const split of ['dev', 'test'] as Split[]) {
    const rows = split === 'dev' ? dev : test;
    if (rows.size !== EXPECTED[split].pairs || new Set([...rows.keys()].map(key => key.split('\t')[0])).size !== EXPECTED[split].queries) {
      throw new Error(`Unexpected ${split} size`);
    }
    for (const pair of rows.keys()) {
      const [q, d] = pair.split('\t');
      if (!queries.has(q) || !passages.has(d)) throw new Error(`Missing text for ${split}/${pair}`);
    }
  }
  const testQids = new Set([...test.keys()].map(key => key.split('\t')[0]));
  if ([...dev.keys()].some(key => testQids.has(key.split('\t')[0]))) {
    throw new Error('Development/test queries overlap');
  }
  return { queries, passages, dev, test, qidMap, docidMap };
}

export function publishedScoreFiles(): string[] {
  return readdirSync(sourcePath(BENCHMARK, 'submissions/scores')).filter(name => name.endsWith('.txt')).sort();
}

export function passageRunFiles(): string[] {
  return readdirSync(sourcePath(RUNS, 'dl-2023-runs')).sort();
}

export const publishedScorePath = (name: string) => sourcePath(BENCHMARK, `submissions/scores/${name}`);
export const passageRunPath = (name: string) => sourcePath(RUNS, `dl-2023-runs/${name}`);
export const originalTestQrels = () => sourcePath(BENCHMARK, 'llmjudge/qrels/llmjudge_test_qrel_ids.txt');
export const fullTrecQrels = () => sourcePath(RUNS, '2023.qrels.pass.withDupes.txt');
