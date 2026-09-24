# Judge Jev

Judge Jev is a TypeScript research project testing Jev's Choice, Score, and Noul primitives as relevance judges.

## LLMJudge

The first experiment compares Jev with human labels and released LLMJudge submissions on the TREC Deep Learning 2023 passage task. It uses the public 25-query development set (7,263 pairs) for threshold selection and the public 25-query test set (4,423 pairs) for reporting.

**This is not a blind challenge submission.** The test labels and benchmark results were public before this experiment. We expect Jev to have seen the public LLMJudge results during training, although we cannot verify its training data. Treat these scores as a retrospective comparison that may reflect benchmark exposure, not evidence of performance on unseen test data.

### Results website

The static website in [`site/`](site/) is the main presentation of the LLMJudge results, including Jev variants alongside the paper's best submissions, methodological limits, and downloadable raw responses. The complete numeric record remains in [the report](results/report.md).

Its structure follows the widely used [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template) convention for research pages. The implementation is original Astro/Tailwind code with selected components from the locally available, licensed [Tailwind Catalyst UI kit](https://catalyst.tailwindui.com/docs). No source code from the academic template was copied.

```sh
npm run site:dev      # local preview
npm run site:build    # static output in site/dist
```

The site renders values directly from `results/report.json`. The build copies the report, raw Jev responses, calibration, and source manifest into downloadable static files. Netlify uses [`netlify.toml`](netlify.toml) to run `npm run site:build` and publish `site/dist`; no API key or live inference is needed to build it. Future experiments can have their own pages under `site/src/pages/`.

### Setup

Requires Node.js 24+, `gh` authenticated to GitHub, and `trec_eval` on `PATH`.

```sh
npm ci
npm run check
npm test
npm run prepare:data
```

`prepare:data` downloads the pinned LLMJudge queries, passages, labels, 33 published judge score files, the full human TREC qrels, and 35 TREC passage runs using **`gh api`**. It verifies their Git blob hashes and writes SHA-256 hashes and source revisions to `data/manifest.json`. Downloaded files are ignored by Git.

Create a local `.env` with `TYPESAFE_API_KEY=...` (or export that variable). The file is ignored by Git. The CLI also accepts `--env-file PATH`. No key is needed for data preparation, type checking, or tests.

```sh
# Technical pilot: five development pairs per grade, all five questions per pair.
npm run infer -- --split dev --pilot 20

# Full inference. Both commands resume cached responses after interruption.
npm run infer -- --split dev
npm run calibrate
npm run infer -- --split test
npm run evaluate
```

All five questions use the same `{query, passage}` state in one Jev `jev-1.13.0` request per pair. The question wording is frozen in `src/config.ts`; `src/calibrate.ts` selects Score and Noul conversion thresholds on the development split only. The evaluator requires complete development and test coverage. It reports native and calibrated Jev grades, human agreement, comparisons with all released judge score files, nDCG@10 system ordering, query-cluster bootstrap intervals, token usage, cost, and latency.

Raw Jev responses are checkpointed in ignored `data/cache/*.jsonl` and exported to `results/jev-dev-raw.jsonl` and `results/jev-test-raw.jsonl` for version control. The generated report is `results/report.md` with full numeric detail in `results/report.json`; `results/calibration.json` records development-only thresholds. The source manifest identifies the exact public inputs. To inspect progress without a key, run `npm run status`.

The benchmark contains a small number of passages longer than Jev's input limit. The runner keeps the beginning and end of these passages under a 60,000-character cap, retrying at smaller fixed caps only if the API still rejects the request. Every affected pair records its cap and submitted length; the report counts them.

### Provenance

- [LLMJudge challenge data](https://github.com/llm4eval/LLMJudge)
- [Published judge labels and public human test labels](https://github.com/llm4eval/LLMJudge-benchmark)
- [TREC 2023 passage run archive](https://github.com/rahmanidashti/SyntheticTestCollections)
- [Jev typed primitive documentation](https://docs.typesafe.ai/introduction)
- [LLMJudge paper](https://arxiv.org/pdf/2502.13908)

The paper reports 42 judges, while the inspected benchmark repository releases 33 score files. This experiment scores those 33 files directly and checks selected published system-order values before claiming comparability with the paper table.
