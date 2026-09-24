# Jev on LLMJudge (TREC DL 2023 passages)

Retrospective comparison: human test labels and published LLM-judge outputs are public.

Model: `jev-1.13.0`; question SHA-256: `223511a5c5fc61351caab8ae01b0091ef16ed90bfc4083371cd501b41ffdde40`.
Development pairs: 7263; test pairs: 4423; TREC passage runs: 35.
Calibration: Score 1.4, 2.1, 2.25; Noul 0.8, 0.9, 0.5 (selected only on development labels).

## Main observations

Native Choice κ 0.2617 and native Noul κ 0.2589 on four grades; native Score κ 0.2249. The highest κ among released judges is 0.2863.
Development-selected cutoffs did not improve test κ: Score 0.2249 → 0.2118, Noul 0.2589 → 0.2451.

## Label agreement and system order

| Judge | κ | Nominal α | κ ≥1 | κ ≥2 | κ ≥3 | τ vs 25q | τ vs full 82q | Spearman ρ vs 25q | Mean grade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| h2oloo-fewself | 0.2774 | 0.2689 | 0.4172 | 0.4280 | 0.3048 | 0.9218 | 0.9050 | 0.9870 | 0.8677 |
| h2oloo-zeroshot1 | 0.2817 | 0.2792 | 0.4094 | 0.3901 | 0.3084 | 0.9351 | 0.8981 | 0.9884 | 0.7151 |
| h2oloo-zeroshot2 | 0.2589 | 0.2408 | 0.3691 | 0.3278 | 0.2789 | 0.8704 | 0.8468 | 0.9725 | 0.5648 |
| jev-choice-native | 0.2617 | 0.2541 | 0.3798 | 0.4180 | 0.3308 | 0.9284 | 0.9115 | 0.9891 | 1.1329 |
| jev-noul-calibrated | 0.2451 | 0.2368 | 0.3847 | 0.3402 | 0.3103 | 0.9226 | 0.8990 | 0.9874 | 0.6765 |
| jev-noul-native | 0.2589 | 0.2508 | 0.4149 | 0.3981 | 0.3103 | 0.9428 | 0.9192 | 0.9922 | 1.1433 |
| jev-score-calibrated | 0.2118 | 0.1969 | 0.3592 | 0.3656 | 0.2907 | 0.9024 | 0.8855 | 0.9835 | 0.7628 |
| jev-score-native | 0.2249 | 0.2109 | 0.3367 | 0.4059 | 0.3099 | 0.9351 | 0.9115 | 0.9915 | 1.2060 |
| NISTRetrieval-instruct0 | 0.1877 | 0.1598 | 0.3116 | 0.3021 | 0.0000 | 0.9461 | 0.9091 | 0.9924 | 1.0228 |
| NISTRetrieval-instruct1 | 0.1874 | 0.1594 | 0.3106 | 0.3021 | 0.0000 | 0.9495 | 0.9125 | 0.9930 | 1.0228 |
| NISTRetrieval-instruct2 | 0.1880 | 0.1602 | 0.3126 | 0.3013 | 0.0000 | 0.9495 | 0.9125 | 0.9930 | 1.0228 |
| NISTRetrieval-reason0 | 0.1844 | 0.1599 | 0.2911 | 0.3390 | 0.0097 | 0.9192 | 0.8822 | 0.9863 | 1.0418 |
| NISTRetrieval-reason1 | 0.1845 | 0.1599 | 0.2906 | 0.3394 | 0.0097 | 0.9192 | 0.8822 | 0.9863 | 1.0418 |
| NISTRetrieval-reason2 | 0.1838 | 0.1593 | 0.2902 | 0.3397 | 0.0097 | 0.9192 | 0.8822 | 0.9863 | 1.0421 |
| Olz-exp | 0.2519 | 0.2473 | 0.3997 | 0.3577 | 0.2936 | 0.9158 | 0.8990 | 0.9868 | 0.6982 |
| Olz-gpt4o | 0.2625 | 0.2603 | 0.4228 | 0.3657 | 0.3066 | 0.9024 | 0.8923 | 0.9829 | 0.7784 |
| Olz-halfbin | 0.2064 | 0.2006 | 0.4008 | 0.2587 | 0.2449 | 0.9218 | 0.8982 | 0.9873 | 0.8537 |
| Olz-multiprompt | 0.2445 | 0.2397 | 0.3764 | 0.3934 | 0.2150 | 0.9327 | 0.9024 | 0.9894 | 1.1155 |
| Olz-somebin | 0.2109 | 0.2026 | 0.3854 | 0.3883 | 0.1137 | 0.9158 | 0.8923 | 0.9866 | 1.0782 |
| prophet-setting1 | 0.1823 | 0.1759 | 0.3502 | 0.2903 | 0.1677 | 0.9184 | 0.8881 | 0.9873 | 0.7579 |
| prophet-setting2 | 0.1757 | 0.1567 | 0.3102 | 0.2382 | 0.0284 | 0.9588 | 0.9285 | 0.9938 | 0.4985 |
| prophet-setting4 | 0.1471 | 0.0997 | 0.2375 | 0.1409 | 0.0371 | 0.8814 | 0.8511 | 0.9719 | 0.3131 |
| RMITIR-GPT4o | 0.2388 | 0.2083 | 0.3499 | 0.3961 | 0.2580 | 0.9091 | 0.9057 | 0.9849 | 0.6043 |
| RMITIR-llama38b | 0.2006 | 0.1877 | 0.3280 | 0.3194 | 0.1344 | 0.9057 | 0.8687 | 0.9826 | 0.7359 |
| RMITIR-llama70B | 0.2655 | 0.2431 | 0.4166 | 0.3916 | 0.2843 | 0.9394 | 0.9091 | 0.9908 | 1.0726 |
| TREMA-4prompts | 0.1829 | 0.1363 | 0.3022 | 0.2697 | 0.1664 | 0.9529 | 0.9226 | 0.9938 | 1.4635 |
| TREMA-all | 0.1471 | 0.1369 | 0.3244 | 0.2978 | 0.0717 | 0.9226 | 0.8990 | 0.9896 | 0.9283 |
| TREMA-CoT | 0.1961 | 0.1950 | 0.3181 | 0.3208 | 0.1836 | 0.9141 | 0.8838 | 0.9859 | 1.0432 |
| TREMA-direct | 0.1742 | 0.1240 | 0.3205 | 0.3462 | 0.1763 | 0.9192 | 0.9024 | 0.9871 | 1.2528 |
| TREMA-naiveBdecompose | 0.1741 | 0.1584 | 0.3085 | 0.2916 | 0.0153 | 0.9285 | 0.8915 | 0.9884 | 0.6740 |
| TREMA-nuggets | 0.0604 | 0.0572 | 0.1505 | 0.0992 | -0.0077 | 0.8788 | 0.8889 | 0.9779 | 0.9175 |
| TREMA-other | 0.1408 | 0.1071 | 0.2740 | 0.2015 | 0.1411 | 0.8620 | 0.8249 | 0.9613 | 1.2921 |
| TREMA-questions | 0.1137 | 0.0884 | 0.2636 | 0.2876 | 0.0441 | 0.9226 | 0.8990 | 0.9882 | 1.0504 |
| TREMA-rubric0 | 0.0779 | 0.0375 | 0.1714 | 0.0308 | 0.0369 | 0.8552 | 0.8451 | 0.9669 | 0.3348 |
| TREMA-sumdecompose | 0.2088 | 0.1884 | 0.3228 | 0.3512 | 0.2047 | 0.9386 | 0.9016 | 0.9904 | 0.9401 |
| willia-umbrela1 | 0.2863 | 0.2840 | 0.4161 | 0.3985 | 0.3145 | 0.9192 | 0.8956 | 0.9860 | 0.7221 |
| willia-umbrela2 | 0.2688 | 0.2578 | 0.4109 | 0.3421 | 0.3194 | 0.9050 | 0.8747 | 0.9834 | 0.6208 |
| willia-umbrela3 | 0.2741 | 0.2640 | 0.4114 | 0.3447 | 0.3215 | 0.8956 | 0.8653 | 0.9809 | 0.5903 |

The primary answer-bearing boundary is grades 0–1 versus 2–3. System order uses mean `trec_eval` nDCG@10 across the 25 test queries; the full-human column uses all 82 TREC queries as a sensitivity check. Two released judges have out-of-rubric values: RMITIR-llama70B has two grade-5 labels and h2oloo-zeroshot2 has one grade-10 label. These are retained as separate categories in their κ and α, and appear in their grade distributions.

## Grade distributions

| Labels | Grade 0 | Grade 1 | Grade 2 | Grade 3 |
| --- | ---: | ---: | ---: | ---: |
| Human | 2005 | 1233 | 808 | 377 |
| jev-choice-native | 1372 | 1521 | 1100 | 430 |
| jev-noul-calibrated | 2513 | 1237 | 264 | 409 |
| jev-noul-native | 1610 | 978 | 1426 | 409 |
| jev-score-calibrated | 2629 | 900 | 208 | 686 |
| jev-score-native | 1180 | 1557 | 1281 | 405 |

Released-judge grade distributions, including out-of-rubric values, are in `report.json`.

Paper-table κ/τ checks: **not reproduced**. Reference values and differences are in `report.json`. Treat the displayed correlations as independently recomputed, not paper-table values. Nominal α is reported separately because the paper does not specify its α distance convention.

## Jev uncertainty and usage

| Variant | 4-grade κ 95% query bootstrap | Answer-bearing κ 95% query bootstrap | Kendall τ 95% query bootstrap |
| --- | ---: | ---: | ---: |
| jev-choice-native | 0.1707–0.3360 | 0.3194–0.4995 | 0.8013–0.9461 |
| jev-noul-calibrated | 0.1421–0.3398 | 0.2549–0.4264 | 0.7946–0.9394 |
| jev-noul-native | 0.1803–0.3267 | 0.3105–0.4708 | 0.8147–0.9529 |
| jev-score-calibrated | 0.1285–0.2952 | 0.2876–0.4441 | 0.8006–0.9352 |
| jev-score-native | 0.1365–0.2953 | 0.3043–0.4858 | 0.8080–0.9495 |

Total Jev input tokens: 11,484,579; output tokens: 1,250,402.
Estimated API cost at $0.042/million input tokens: $0.4824.
Per-pair latency: p50 0.23s, p95 0.28s.
Passage context limit: 44 pairs had middle text omitted; caps and lengths are stored per response.

The test labels are public, no new LLM judge was run, and passage middle text was omitted on the recorded overlength pairs.
Full confusion matrices, grade distributions, per-system scores, provenance, and raw Jev responses are in the neighboring JSON/JSONL files.
