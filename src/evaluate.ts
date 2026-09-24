import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { MODEL, PRICE_USD_PER_M_INPUT_TOKENS, QUESTION_HASH, SOURCES, type Pair } from './config.ts';
import { gradeScore, loadCalibration } from './calibrate.ts';
import { ROOT, fullTrecQrels, originalTestQrels, passageRunFiles, passageRunPath, publishedScoreFiles, publishedScorePath,
  readQrels, type BenchmarkData } from './data.ts';
import { gradeNoul, loadResponses, type RawResponse } from './infer.ts';
import { binaryKappas, bootstrapByQuery, confusion, gradeDistribution, kappa, kendallTauB,
  nominalAlpha, percentile, spearman } from './metrics.ts';

const OUTPUT = join(ROOT, 'results');
const execFileAsync = promisify(execFile);
const PAPER_REFERENCE: Record<string, { kappa: number; tau: number }> = {
  'Olz-gpt4o': { kappa: 0.2625, tau: 0.8793 },
  'TREMA-4prompts': { kappa: 0.1829, tau: 0.9483 },
  'prophet-setting2': { kappa: 0.1757, tau: 0.9516 },
  'willia-umbrela1': { kappa: 0.2863, tau: 0.9009 },
};

type LabelMetrics = {
  kappa: number;
  nominalAlpha: number;
  binaryKappa: Record<string, number>;
  confusion: number[][];
  gradeDistribution: number[];
  labelsOutside0to3: number;
  averageGrade: number;
  bootstrap95?: ReturnType<typeof bootstrapByQuery>;
};
type RunMetrics = { ndcg10: number; perQuery: Record<string, number> };

function readPublished(path: string, pairs: readonly Pair[]): Map<Pair, number> {
  const isRmit = path.endsWith('/RMITIR-llama70B.txt');
  const isH2o = path.endsWith('/h2oloo-zeroshot2.txt');
  const labels = readQrels(path, true, isH2o ? 10 : isRmit ? 5 : 3);
  if (labels.size !== pairs.length || pairs.some(pair => !labels.has(pair))) throw new Error(`Published labels have incomplete/mismatched pairs: ${path}`);
  if (isRmit && [...labels.values()].filter(grade => grade === 5).length !== 2) throw new Error('Unexpected nonstandard labels in RMITIR-llama70B');
  if (isH2o && [...labels.values()].filter(grade => grade === 10).length !== 1) throw new Error('Unexpected nonstandard labels in h2oloo-zeroshot2');
  return labels;
}

export function originalQrels(data: BenchmarkData, labels: Map<Pair, number>, destination: string): void {
  const qid = new Map([...data.qidMap].map(([long, short]) => [short, long]));
  const pid = new Map([...data.docidMap].map(([long, short]) => [short, long]));
  const lines = [...labels].sort(([a], [b]) => a.localeCompare(b)).map(([key, grade]) => {
    const [q, d] = key.split('\t');
    const originalQ = qid.get(q), originalD = pid.get(d);
    if (!originalQ || !originalD) throw new Error(`Missing ID mapping for ${key}`);
    return `${originalQ} 0 ${originalD} ${grade}`;
  });
  writeFileSync(destination, `${lines.join('\n')}\n`);
}

export async function trecEval(qrels: string, run: string, queryIds: readonly string[]): Promise<RunMetrics> {
  const { stdout: text } = await execFileAsync('trec_eval', ['-q', '-m', 'ndcg_cut.10', qrels, run], { encoding: 'utf8', maxBuffer: 5_000_000 });
  const perQuery: Record<string, number> = {};
  let all: number | undefined;
  for (const line of text.trim().split('\n')) {
    const [measure, query, scoreText] = line.trim().split(/\s+/);
    if (measure !== 'ndcg_cut_10') continue;
    if (query === 'all') all = Number(scoreText);
    else perQuery[query] = Number(scoreText);
  }
  if (all === undefined || queryIds.some(q => !Number.isFinite(perQuery[q])) || Object.keys(perQuery).length !== queryIds.length) {
    throw new Error(`Unexpected trec_eval output for ${run}`);
  }
  return { ndcg10: all, perQuery };
}

function bootstrapRank(human: Map<string, RunMetrics>, candidate: Map<string, RunMetrics>,
                       queryIds: readonly string[], runNames: readonly string[], iterations = 1000): [number, number] {
  let state = 20260924;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const values: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sample = Array.from({ length: queryIds.length }, () => queryIds[Math.floor(random() * queryIds.length)]);
    const h = runNames.map(run => sample.reduce((sum, q) => sum + human.get(run)!.perQuery[q], 0) / sample.length);
    const c = runNames.map(run => sample.reduce((sum, q) => sum + candidate.get(run)!.perQuery[q], 0) / sample.length);
    const tau = kendallTauB(h, c);
    if (Number.isFinite(tau)) values.push(tau);
  }
  values.sort((a, b) => a - b);
  return [percentile(values, 0.025), percentile(values, 0.975)];
}

function reportMarkdown(report: Report): string {
  const rows = Object.entries(report.methods).sort(([a], [b]) => a.localeCompare(b));
  const format = (number: number) => Number.isFinite(number) ? number.toFixed(4) : 'n/a';
  const lines = [
    '# Jev on LLMJudge (TREC DL 2023 passages)', '',
    'Retrospective comparison: human test labels and published LLM-judge outputs are public.', '',
    `Model: \`${MODEL}\`; question SHA-256: \`${QUESTION_HASH}\`.`,
    `Development pairs: ${report.developmentPairs}; test pairs: ${report.testPairs}; TREC passage runs: ${report.passageRuns}.`,
    `Calibration: Score ${report.calibration.score.join(', ')}; Noul ${report.calibration.noul.join(', ')} (selected only on development labels).`, '',
    '## Main observations', '',
    `Native Choice κ ${format(report.methods['jev-choice-native'].labels.kappa)} and native Noul κ ${format(report.methods['jev-noul-native'].labels.kappa)} on four grades; native Score κ ${format(report.methods['jev-score-native'].labels.kappa)}. The highest κ among released judges is ${format(Math.max(...Object.entries(report.methods).filter(([name]) => !name.startsWith('jev-')).map(([, value]) => value.labels.kappa)))}.`,
    `Development-selected cutoffs did not improve test κ: Score ${format(report.methods['jev-score-native'].labels.kappa)} → ${format(report.methods['jev-score-calibrated'].labels.kappa)}, Noul ${format(report.methods['jev-noul-native'].labels.kappa)} → ${format(report.methods['jev-noul-calibrated'].labels.kappa)}.`, '',
    '## Label agreement and system order', '',
    '| Judge | κ | Nominal α | κ ≥1 | κ ≥2 | κ ≥3 | τ vs 25q | τ vs full 82q | Spearman ρ vs 25q | Mean grade |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const [name, entry] of rows) {
    lines.push(`| ${name} | ${format(entry.labels.kappa)} | ${format(entry.labels.nominalAlpha)} | ${format(entry.labels.binaryKappa['0|123'])} | ${format(entry.labels.binaryKappa['01|23'])} | ${format(entry.labels.binaryKappa['012|3'])} | ${format(entry.ranking.kendallTau)} | ${format(entry.ranking.fullTrecKendallTau)} | ${format(entry.ranking.spearmanRho)} | ${format(entry.labels.averageGrade)} |`);
  }
  lines.push('', 'The primary answer-bearing boundary is grades 0–1 versus 2–3. System order uses mean `trec_eval` nDCG@10 across the 25 test queries; the full-human column uses all 82 TREC queries as a sensitivity check. Two released judges have out-of-rubric values: RMITIR-llama70B has two grade-5 labels and h2oloo-zeroshot2 has one grade-10 label. These are retained as separate categories in their κ and α, and appear in their grade distributions.', '');
  lines.push('## Grade distributions', '',
    '| Labels | Grade 0 | Grade 1 | Grade 2 | Grade 3 |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| Human | ${report.humanGradeDistribution.join(' | ')} |`);
  for (const [name, entry] of rows.filter(([name]) => name.startsWith('jev-'))) {
    lines.push(`| ${name} | ${entry.labels.gradeDistribution.join(' | ')} |`);
  }
  lines.push('', 'Released-judge grade distributions, including out-of-rubric values, are in `report.json`.', '');
  lines.push(`Paper-table κ/τ checks: **${report.paperComparison.comparable ? 'reproduced' : 'not reproduced'}**. Reference values and differences are in \`report.json\`. ${report.paperComparison.comparable ? 'The displayed κ/τ use the same observed convention.' : 'Treat the displayed correlations as independently recomputed, not paper-table values.'} Nominal α is reported separately because the paper does not specify its α distance convention.`, '');
  lines.push('## Jev uncertainty and usage', '',
    '| Variant | 4-grade κ 95% query bootstrap | Answer-bearing κ 95% query bootstrap | Kendall τ 95% query bootstrap |',
    '| --- | ---: | ---: | ---: |');
  for (const [name, entry] of rows.filter(([name]) => name.startsWith('jev-'))) {
    const ci = entry.labels.bootstrap95!;
    lines.push(`| ${name} | ${ci.kappa.map(format).join('–')} | ${ci.binaryAnswerKappa.map(format).join('–')} | ${entry.ranking.bootstrap95!.map(format).join('–')} |`);
  }
  lines.push('', `Total Jev input tokens: ${report.usage.inputTokens.toLocaleString()}; output tokens: ${report.usage.outputTokens.toLocaleString()}.`,
    `Estimated API cost at $${PRICE_USD_PER_M_INPUT_TOKENS}/million input tokens: $${report.usage.estimatedUsd.toFixed(4)}.`,
    `Per-pair latency: p50 ${report.usage.latencyP50Seconds.toFixed(2)}s, p95 ${report.usage.latencyP95Seconds.toFixed(2)}s.`,
    `Passage context limit: ${report.usage.truncatedPairs} pairs had middle text omitted; caps and lengths are stored per response.`, '',
    'The test labels are public, no new LLM judge was run, and passage middle text was omitted on the recorded overlength pairs.',
    'Full confusion matrices, grade distributions, per-system scores, provenance, and raw Jev responses are in the neighboring JSON/JSONL files.', '');
  return lines.join('\n');
}

type Report = {
  model: string; questionHash: string; sources: typeof SOURCES; developmentPairs: number; testPairs: number;
  passageRuns: number; humanGradeDistribution: number[]; calibration: ReturnType<typeof loadCalibration>;
  paperComparison: { comparable: boolean; references: Record<string, { paperKappa: number; recomputedKappa: number; kappaDelta: number;
    paperTau: number; recomputedTau: number; tauDelta: number; fullTrecTau: number; fullTrecTauDelta: number }> };
  methods: Record<string, { labels: LabelMetrics; ranking: { kendallTau: number; spearmanRho: number;
    fullTrecKendallTau: number; fullTrecSpearmanRho: number; bootstrap95?: [number, number] }; systemScores: Record<string, number> }>;
  usage: { inputTokens: number; outputTokens: number; estimatedUsd: number; latencyP50Seconds: number; latencyP95Seconds: number;
    truncatedPairs: number; passageCaps: Record<string, number> };
};

export async function evaluate(data: BenchmarkData): Promise<Report> {
  const devRows = loadResponses(data, 'dev');
  const testRows = loadResponses(data, 'test');
  const calibration = loadCalibration();
  const pairs = [...data.test.keys()].sort();
  const truth = pairs.map(pair => data.test.get(pair)!);
  const judgeLabels = new Map<string, Map<Pair, number>>();
  const jev = (name: string, grade: (row: RawResponse) => number) => {
    judgeLabels.set(name, new Map(pairs.map(pair => [pair, grade(testRows.get(pair)!)])));
  };
  jev('jev-choice-native', row => Number(row.answers.choice.choice));
  jev('jev-score-native', row => gradeScore(row.answers.score.score));
  jev('jev-noul-native', row => gradeNoul(row));
  jev('jev-score-calibrated', row => gradeScore(row.answers.score.score, calibration.score));
  jev('jev-noul-calibrated', row => gradeNoul(row, calibration.noul));
  for (const filename of publishedScoreFiles()) judgeLabels.set(filename.slice(0, -4), readPublished(publishedScorePath(filename), pairs));
  mkdirSync(join(OUTPUT, 'qrels'), { recursive: true });
  for (const [split, responses] of [['dev', devRows], ['test', testRows]] as const) {
    const raw = [...responses.values()].sort((a, b) => `${a.qid}\t${a.pid}`.localeCompare(`${b.qid}\t${b.pid}`));
    writeFileSync(join(OUTPUT, `jev-${split}-raw.jsonl`), `${raw.map(row => JSON.stringify(row)).join('\n')}\n`);
  }
  const runNames = passageRunFiles();
  const originalQid = new Map([...data.qidMap].map(([long, short]) => [short, long]));
  const queryIds = [...new Set(pairs.map(pair => originalQid.get(pair.split('\t')[0])!))].sort();
  const systemMetrics = new Map<string, Map<string, RunMetrics>>();
  const allLabels = new Map<string, Map<Pair, number>>([
    ['human', data.test], ['Olz-gpt4o', judgeLabels.get('Olz-gpt4o')!],
    ...[...judgeLabels].filter(([name]) => name !== 'Olz-gpt4o'),
  ]);
  const evaluateRuns = async (qrels: string, ids: readonly string[]): Promise<Map<string, RunMetrics>> => {
    const runMetrics = new Map<string, RunMetrics>();
    let cursor = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (cursor < runNames.length) {
        const run = runNames[cursor++];
        runMetrics.set(run, await trecEval(qrels, passageRunPath(run), ids));
      }
    }));
    return runMetrics;
  };
  for (const [name, labels] of allLabels) {
    const qrels = name === 'human' ? originalTestQrels() : join(OUTPUT, 'qrels', `${name}.txt`);
    if (name !== 'human') originalQrels(data, labels, qrels);
    const runMetrics = await evaluateRuns(qrels, queryIds);
    systemMetrics.set(name, runMetrics);
    console.log(`Evaluated ${name} on ${runNames.length} passage runs`);
  }
  const fullQueryIds = [...new Set([...readQrels(fullTrecQrels()).keys()].map(pair => pair.split('\t')[0]))].sort();
  if (fullQueryIds.length !== 82) throw new Error('Unexpected full human TREC topic count');
  const fullHuman = await evaluateRuns(fullTrecQrels(), fullQueryIds);
  const humanScores = runNames.map(run => systemMetrics.get('human')!.get(run)!.ndcg10);
  const fullHumanScores = runNames.map(run => fullHuman.get(run)!.ndcg10);
  const methods: Report['methods'] = {};
  for (const [name, labels] of judgeLabels) {
    const predicted = pairs.map(pair => labels.get(pair)!);
    const classes = Math.max(4, ...predicted.map(grade => grade + 1));
    const runScores = systemMetrics.get(name)!;
    const ranking = {
      kendallTau: kendallTauB(humanScores, runNames.map(run => runScores.get(run)!.ndcg10)),
      spearmanRho: spearman(humanScores, runNames.map(run => runScores.get(run)!.ndcg10)),
      fullTrecKendallTau: kendallTauB(fullHumanScores, runNames.map(run => runScores.get(run)!.ndcg10)),
      fullTrecSpearmanRho: spearman(fullHumanScores, runNames.map(run => runScores.get(run)!.ndcg10)),
      ...(name.startsWith('jev-') ? { bootstrap95: bootstrapRank(systemMetrics.get('human')!, runScores, queryIds, runNames) } : {}),
    };
    methods[name] = {
      labels: {
        kappa: kappa(truth, predicted, classes), nominalAlpha: nominalAlpha(truth, predicted, classes),
        binaryKappa: binaryKappas(truth, predicted), confusion: confusion(truth, predicted, classes),
        gradeDistribution: gradeDistribution(predicted, classes), labelsOutside0to3: predicted.filter(grade => grade > 3).length,
        averageGrade: predicted.reduce((a, b) => a + b, 0) / predicted.length,
        ...(name.startsWith('jev-') ? { bootstrap95: bootstrapByQuery(pairs, truth, predicted) } : {}),
      }, ranking, systemScores: Object.fromEntries(runNames.map(run => [run, runScores.get(run)!.ndcg10])),
    };
  }
  const references = Object.fromEntries(Object.entries(PAPER_REFERENCE).map(([name, paper]) => [name, {
    paperKappa: paper.kappa, recomputedKappa: methods[name].labels.kappa,
    kappaDelta: methods[name].labels.kappa - paper.kappa,
    paperTau: paper.tau, recomputedTau: methods[name].ranking.kendallTau,
    tauDelta: methods[name].ranking.kendallTau - paper.tau,
    fullTrecTau: methods[name].ranking.fullTrecKendallTau,
    fullTrecTauDelta: methods[name].ranking.fullTrecKendallTau - paper.tau,
  }]));
  const comparable = Object.values(references).every(item => Math.abs(item.kappaDelta) <= 0.0001 && Math.abs(item.fullTrecTauDelta) <= 0.005);
  const allResponses = [...devRows.values(), ...testRows.values()];
  const latencies = allResponses.map(row => row.latencySeconds).sort((a, b) => a - b);
  const inputTokens = allResponses.reduce((sum, row) => sum + row.inputTokens, 0);
  const passageCaps = Object.fromEntries([...new Set(allResponses.map(row => row.passageCap ?? 0))].sort((a, b) => a - b)
    .map(cap => [String(cap), allResponses.filter(row => (row.passageCap ?? 0) === cap).length]));
  const report: Report = {
    model: MODEL, questionHash: QUESTION_HASH, sources: SOURCES,
    developmentPairs: devRows.size, testPairs: testRows.size, passageRuns: runNames.length,
    humanGradeDistribution: gradeDistribution(truth, 4),
    calibration, paperComparison: { comparable, references }, methods,
    usage: {
      inputTokens, outputTokens: allResponses.reduce((sum, row) => sum + row.outputTokens, 0),
      estimatedUsd: inputTokens / 1_000_000 * PRICE_USD_PER_M_INPUT_TOKENS,
      latencyP50Seconds: percentile(latencies, 0.5), latencyP95Seconds: percentile(latencies, 0.95),
      truncatedPairs: allResponses.filter(row => (row.passageCap ?? 0) > 0).length,
      passageCaps,
    },
  };
  writeFileSync(join(OUTPUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(OUTPUT, 'report.md'), reportMarkdown(report));
  return report;
}
