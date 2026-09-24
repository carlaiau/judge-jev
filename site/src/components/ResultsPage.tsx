import report from '../../../results/report.json'
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/16/solid'
import { Badge } from './catalyst/badge'
import { Button } from './catalyst/button'
import { Divider } from './catalyst/divider'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './catalyst/table'

const paper = 'https://arxiv.org/pdf/2502.13908'
const repo = 'https://github.com/carlaiau/judge-jev'
const best = { four: 0.2863, related: 0.4228, answer: 0.4280, exact: 0.3215, tau: 0.9516, rho: 0.9919 }

const variants = [
  { key: 'jev-choice-native', name: 'Choice', mode: 'Native' },
  { key: 'jev-score-native', name: 'Score', mode: 'Native' },
  { key: 'jev-score-calibrated', name: 'Score', mode: 'Calibrated' },
  { key: 'jev-noul-native', name: 'Noul', mode: 'Native' },
  { key: 'jev-noul-calibrated', name: 'Noul', mode: 'Calibrated' },
] as const

type MethodKey = keyof typeof report.methods
const metric = (key: MethodKey) => report.methods[key]
const four = (key: MethodKey) => metric(key).labels.kappa
const answer = (key: MethodKey) => metric(key).labels.binaryKappa['01|23']
const fmt = (value: number) => value.toFixed(4)

function AgreementBars({ kind }: { kind: 'four' | 'answer' }) {
  const getValue = kind === 'four' ? four : answer
  const benchmark = kind === 'four' ? best.four : best.answer
  const chartRows = [
    ...variants.filter((variant) => variant.mode === 'Native').map((variant) => ({
      label: variant.name,
      value: getValue(variant.key),
      kind: 'jev' as const,
    })),
    { label: 'Paper best', value: benchmark, kind: 'paper' as const },
  ]

  return (
    <div className="comparison-chart">
      <h3>{kind === 'four' ? 'Four-grade agreement' : 'Answer-bearing decision'}</h3>
      <p>{kind === 'four' ? 'Cohen’s κ against human grades 0–3' : 'Cohen’s κ for grades 0–1 versus 2–3'}</p>
      <ol>
        {chartRows.map((row) => (
          <li key={row.label}>
            <span className="bar-name">{row.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span className={`bar-fill ${row.kind}`} style={{ width: `${(row.value / 0.5) * 100}%` }} />
            </span>
            <span className="bar-value">{fmt(row.value)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="wordmark" href="#top" aria-label="Judge Jev, back to top">
          <span className="wordmark-mark" aria-hidden="true">J<span>.</span></span>
          <span>Judge Jev</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#findings">Findings</a>
          <a href="#method">Method</a>
          <a href="#resources">Resources</a>
        </nav>
        <a className="header-source" href={repo} target="_blank" rel="noreferrer">
          Source code <ArrowTopRightOnSquareIcon aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}

export default function ResultsPage() {
  const usage = report.usage

  return (
    <div id="top" className="page-shell">
      <Header />
      <main>
        <section className="hero page-container" aria-labelledby="page-title">
          <div className="hero-main">
            <h1 id="page-title">Can Jev judge passage relevance?</h1>
            <p className="hero-deck">
              An evaluation of Jev’s Choice, Score, and Noul primitives on the LLMJudge benchmark,
              with human labels and published LLM judges as reference points.
            </p>
            <div className="hero-actions">
              <Button color="teal" href="#findings">Explore the results</Button>
              <Button outline href={paper} target="_blank" rel="noreferrer">
                Read the benchmark paper <ArrowTopRightOnSquareIcon data-slot="icon" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <aside className="hero-aside" aria-label="Experiment abstract">
            <div className="aside-title">LLMJudge · TREC DL 2023 passages</div>
            <p>
              We judged every query–passage pair in the benchmark using five independent questions
              in one Jev request. Development labels selected two calibrated variants; all results
              shown here are from the test set.
            </p>
            <dl>
              <div><dt>Development</dt><dd>{report.developmentPairs.toLocaleString()} pairs</dd></div>
              <div><dt>Test</dt><dd>{report.testPairs.toLocaleString()} pairs</dd></div>
              <div><dt>Retrieval runs</dt><dd>{report.passageRuns}</dd></div>
              <div><dt>Jev model</dt><dd>{report.model}</dd></div>
            </dl>
          </aside>
        </section>

        <div className="page-container">
          <div className="exposure-note" role="note">
            <div className="note-label"><Badge color="amber">Study limitation</Badge></div>
            <p>
              <strong>This is not a blind challenge submission.</strong> Test labels and benchmark results
              were public before this experiment. We expect Jev to have seen the public LLMJudge
              results during training, although its training data is unverified. These scores may
              reflect benchmark exposure.
            </p>
          </div>
        </div>

        <section id="findings" className="section page-container" aria-labelledby="findings-title">
          <div className="section-heading">
            <h2 id="findings-title">What the labels say</h2>
            <p>
              Native Choice comes closest to the paper’s best four-grade judge. At the primary
              answer-bearing boundary, it reaches κ {fmt(answer('jev-choice-native'))} against a
              published best of {fmt(best.answer)}. Development-tuned Score and Noul thresholds
              both reduce test agreement.
            </p>
          </div>
          <div className="chart-pair" aria-label="Native Jev and published best agreement comparison">
            <AgreementBars kind="four" />
            <AgreementBars kind="answer" />
          </div>
          <p className="chart-caption">
            Each paper-best bar is the strongest of the paper’s 42 submitted judges for that metric;
            the winning submission differs by column. Bars start at zero and share a 0.5 κ scale.
          </p>

          <div className="table-intro">
            <h3>All judgment boundaries</h3>
            <p>The 0–1 versus 2–3 split is the primary test of whether a passage provides an answer.</p>
          </div>
          <div className="table-frame">
            <Table dense className="results-table" aria-label="Cohen kappa by Jev primitive and judgment boundary">
              <TableHead><TableRow>
                <TableHeader scope="col">Judge</TableHeader>
                <TableHeader scope="col">Four grades</TableHeader>
                <TableHeader scope="col">0 | 1–3</TableHeader>
                <TableHeader scope="col" className="primary-column">0–1 | 2–3</TableHeader>
                <TableHeader scope="col">0–2 | 3</TableHeader>
              </TableRow></TableHead>
              <TableBody>
                {variants.map((variant) => {
                  const labels = metric(variant.key).labels
                  return <TableRow key={variant.key} className={variant.key === 'jev-choice-native' ? 'featured-row' : ''}>
                    <TableCell><span className="judge-name">Jev {variant.name}</span><span className="judge-mode">{variant.mode}</span></TableCell>
                    <TableCell>{fmt(labels.kappa)}</TableCell>
                    <TableCell>{fmt(labels.binaryKappa['0|123'])}</TableCell>
                    <TableCell className="primary-column">{fmt(labels.binaryKappa['01|23'])}</TableCell>
                    <TableCell>{fmt(labels.binaryKappa['012|3'])}</TableCell>
                  </TableRow>
                })}
                <TableRow className="benchmark-row">
                  <TableCell>Paper best <span className="judge-mode">per column</span></TableCell>
                  <TableCell>{fmt(best.four)}</TableCell>
                  <TableCell>{fmt(best.related)}</TableCell>
                  <TableCell className="primary-column">{fmt(best.answer)}</TableCell>
                  <TableCell>{fmt(best.exact)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="table-note">
            Paper winners: <strong>willia-umbrela1</strong> (four grades), <strong>Olz-gpt4o</strong> (0 | 1–3),
            <strong> h2oloo-fewself</strong> (0–1 | 2–3), and <strong>willia-umbrela3</strong> (0–2 | 3).
            Jev Choice exceeds the paper’s best only on the 0–2 | 3 boundary: 0.3308 versus 0.3215.
          </p>
        </section>

        <section className="section section-tinted" aria-labelledby="system-title">
          <div className="page-container system-layout">
            <div className="section-heading">
              <h2 id="system-title">Do the labels preserve system order?</h2>
              <p>
                We scored the same 35 passage retrieval runs with human and Jev labels using
                <code> trec_eval</code> nDCG@10, then compared their rankings.
              </p>
              <div className="convention-note">
                <strong>Read these side by side, not as a leaderboard.</strong> Our calculation does not
                reproduce the paper’s published τ and ρ for released submissions. The Jev values
                are independently computed under the convention described in the report.
              </div>
            </div>
            <div className="system-table-wrap">
              <Table dense className="results-table" aria-label="System ordering correlations">
                <TableHead><TableRow>
                  <TableHeader scope="col">Judge</TableHeader>
                  <TableHeader scope="col">Kendall τ</TableHeader>
                  <TableHeader scope="col">Spearman ρ</TableHeader>
                </TableRow></TableHead>
                <TableBody>
                  {variants.map((variant) => <TableRow key={variant.key}>
                    <TableCell><span className="judge-name">Jev {variant.name}</span><span className="judge-mode">{variant.mode}</span></TableCell>
                    <TableCell>{fmt(metric(variant.key).ranking.kendallTau)}</TableCell>
                    <TableCell>{fmt(metric(variant.key).ranking.spearmanRho)}</TableCell>
                  </TableRow>)}
                  <TableRow className="benchmark-row">
                    <TableCell>Paper best <span className="judge-mode">per column</span></TableCell>
                    <TableCell>{fmt(best.tau)}</TableCell>
                    <TableCell>{fmt(best.rho)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="table-note">Paper winners: prophet-setting2 for τ and TREMA-4prompts for ρ.</p>
            </div>
          </div>
        </section>

        <section id="method" className="section page-container method-section" aria-labelledby="method-title">
          <div className="section-heading">
            <h2 id="method-title">How the experiment works</h2>
            <p>
              The benchmark provides graded human judgments for 25 development and 25 test queries.
              The three primitives saw identical query and passage text, with frozen question wording.
            </p>
          </div>
          <div className="method-grid">
            <div className="method-questions">
              <h3>Five questions, one request</h3>
              <ul>
                <li><strong>Choice</strong><span>Selects one of the four benchmark grade definitions.</span></li>
                <li><strong>Score</strong><span>Places the passage on an ordered four-level scale.</span></li>
                <li><strong>Noul × 3</strong><span>Tests relatedness, a partial answer, and a dedicated exact answer independently.</span></li>
              </ul>
            </div>
            <div className="method-calibration">
              <h3>Native and calibrated labels</h3>
              <p>
                Native Score uses cutoffs 0.5 / 1.5 / 2.5; native Noul uses 0.5 on each answer.
                Calibration searched 0.05 steps to maximize four-grade κ on development data only.
                The selected Score cutoffs were {report.calibration.score.join(' / ')} and Noul cutoffs
                were {report.calibration.noul.join(' / ')}. They were applied once to test.
              </p>
            </div>
          </div>
          <Divider className="method-rule" />
          <div className="method-notes">
            <div><strong>Evaluation</strong><p>Four-grade and binary κ, nominal α, confusion matrices, grade distributions, and 95% query-cluster bootstrap intervals.</p></div>
            <div><strong>Coverage</strong><p>All {report.testPairs.toLocaleString()} test pairs have Jev responses. The report also compares 33 released LLM judges and 35 passage runs.</p></div>
            <div><strong>Limitations</strong><p>Jev saw shortened head-and-tail text for {usage.truncatedPairs} overlength passages. Test labels are public, and α conventions differ from the paper.</p></div>
          </div>
        </section>

        <section id="resources" className="section resources-section" aria-labelledby="resources-title">
          <div className="page-container resources-layout">
            <div>
              <h2 id="resources-title">Read the full record</h2>
              <p>
                The site summarizes one experiment. The complete numeric report, raw Jev answers,
                threshold configuration, and source hashes are available for inspection.
              </p>
              <div className="resource-actions">
                <Button color="teal" href="/downloads/llmjudge-report.json">
                  <ArrowDownTrayIcon data-slot="icon" aria-hidden="true" /> Download full report
                </Button>
                <Button color="light" href={repo} target="_blank" rel="noreferrer">
                  Browse the code <ArrowTopRightOnSquareIcon data-slot="icon" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <ul className="resource-list">
              <li><a href="/downloads/jev-test-raw.jsonl">Raw Jev test responses <span>JSONL ↓</span></a></li>
              <li><a href="/downloads/jev-dev-raw.jsonl">Raw Jev development responses <span>JSONL ↓</span></a></li>
              <li><a href="/downloads/llmjudge-calibration.json">Selected thresholds <span>JSON ↓</span></a></li>
              <li><a href="/downloads/source-manifest.json">Pinned source manifest <span>JSON ↓</span></a></li>
              <li><a href={paper} target="_blank" rel="noreferrer">LLMJudge benchmark paper <span>PDF ↗</span></a></li>
            </ul>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="page-container footer-inner">
          <div><strong>Judge Jev</strong><span>Research experiments evaluating Jev as an automated judge.</span></div>
          <div>LLMJudge is the first study. More experiments can be added to this site.</div>
        </div>
      </footer>
    </div>
  )
}
