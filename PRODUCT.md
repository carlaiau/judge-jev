# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro static output, Tailwind CSS, React components from the locally available Tailwind Catalyst kit, deployed on Netlify. Astro is an implementation choice inferred from the request for a static results website and Catalyst's React requirement; Netlify was confirmed by the user.

## Users

Readers of research results about Jev's judging behavior. The primary audience is inferred from the request to share academic experiment results.

## Product Purpose

Publish reproducible, accessible experiment results in a form that is easier to read and share than the repository README. The first experiment is LLMJudge; the site must allow later experiments to be added.

## Capabilities and Constraints

- The initial site reports the completed LLMJudge experiment and links to its methods, sources, and full data.
- It must make clear that the LLMJudge result is retrospective, not a blind challenge submission, and that Jev may have seen public benchmark results during training.
- Use a recognizable academic project-page structure and include Tailwind Catalyst UI components.
- Produce static output for Netlify.
- Do not present unreproduced system-order correlations as directly comparable to the paper's table.

## Brand Commitments

Name: Judge Jev. Repository description: “Reproducible experiments evaluating Jev as an automated judge across benchmarks and tasks.”

## Evidence on Hand

- `results/report.json` and `results/report.md`: complete LLMJudge experiment results.
- `results/calibration.json`: development-only threshold selection.
- `data/manifest.json`: pinned source revisions and file hashes.
- `README.md`: experiment setup and comparison with the LLMJudge paper.

## Product Principles

- Show the result and its limitations together.
- Keep published benchmark numbers distinct from independently recomputed numbers.
- Link every displayed result to methods and source material.
- Give each future experiment its own section or page.
