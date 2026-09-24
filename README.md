# Judge Jev

Judge Jev is a TypeScript research project testing Jev's Choice, Score, and Noul primitives as relevance judges.

## LLMJudge

The first experiment compares Jev with human labels and released LLMJudge submissions on the TREC Deep Learning 2023 passage task. It uses the public 25-query development set (7,263 pairs) for threshold selection and the public 25-query test set (4,423 pairs) for reporting.

**This is not a blind challenge submission.** The test labels and benchmark results were public before this experiment. We expect Jev to have seen the public LLMJudge results during training, although we cannot verify its training data. Treat these scores as a retrospective comparison that may reflect benchmark exposure, not evidence of performance on unseen test data.

### Results against the paper's best judges

All Jev numbers below are from the full test set in [the experiment report](results/report.md). The comparison row gives the **best submission in each column** of the [LLMJudge paper](https://arxiv.org/pdf/2502.13908) (Tables 3 and 4); it does not describe one judge. Higher values mean better agreement with human labels or system ordering.

| Judge | Four-grade κ | κ: 0 \| 1–3 | κ: 0–1 \| 2–3 | κ: 0–2 \| 3 |
| --- | ---: | ---: | ---: | ---: |
| Jev Choice, native | 0.2617 | 0.3798 | 0.4180 | 0.3308 |
| Jev Score, native | 0.2249 | 0.3367 | 0.4059 | 0.3099 |
| Jev Score, calibrated | 0.2118 | 0.3592 | 0.3656 | 0.2907 |
| Jev Noul, native | 0.2589 | 0.4149 | 0.3981 | 0.3103 |
| Jev Noul, calibrated | 0.2451 | 0.3847 | 0.3402 | 0.3103 |
| **Paper best, per column** | **0.2863** | **0.4228** | **0.4280** | **0.3215** |

The paper's winners are `willia-umbrela1` for four-grade κ, `Olz-gpt4o` for 0 \| 1–3, `h2oloo-fewself` for the primary answer-bearing split 0–1 \| 2–3, and `willia-umbrela3` for 0–2 \| 3. Jev Choice exceeds the paper's best 0–2 \| 3 value (0.3308 versus 0.3215), while its four-grade and primary answer-bearing κ remain below the paper's best values. Our recomputed κ for selected released submissions matches the paper to four decimals.

| Judge | Kendall τ | Spearman ρ |
| --- | ---: | ---: |
| Jev Choice, native | 0.9284 | 0.9891 |
| Jev Score, native | 0.9351 | 0.9915 |
| Jev Score, calibrated | 0.9024 | 0.9835 |
| Jev Noul, native | 0.9428 | 0.9922 |
| Jev Noul, calibrated | 0.9226 | 0.9874 |
| **Paper best, per column** | **0.9516** | **0.9919** |

The paper's system-order winners are `prophet-setting2` for τ and `TREMA-4prompts` for ρ. Our τ and ρ use `trec_eval` nDCG@10 over 35 released passage runs and the 25 test queries. The same calculation does **not** reproduce the paper's published ranking correlations for released submissions, so the Jev and paper rows are indicative side-by-side values, not directly comparable scores. We omit Krippendorff's α from this comparison because our nominal α does not reproduce the paper's α convention. Full per-judge results, grade distributions, confusion matrices, and query-cluster bootstrap intervals are in [the report](results/report.md).

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
