# Research corpus

> **Background research, not user-facing documentation.** This directory contains the design research that informed the project's architecture. It is not required reading for users of the tool. It is included in the public repository so the design decisions in the main docs are auditable and traceable.

## Index

| # | File | Topic | Size |
|---|---|---|---|
| 01 | `01-design-constitution-research.md` | Four-tier Design Constitution schema (hard rules, soft rules, aesthetic dispositions, brand-specific) | 38KB |
| 02 | `02-design-deliverable-taxonomy.md` | The 22-artifact deliverable bundle a senior designer produces vs the 1 artifact AI tools emit | 34KB |
| 03 | `03-codified-design-principles.md` | 21 sources of codified design principles (WCAG, MD3, HIG, Carbon, Polaris, Geist, etc.) with MC:Y/P/N taxonomy and Top-20 ranking | 57KB |
| 04 | `04-design-quality-rubric.md` | Survey of 13 academic benchmarks (AesBench, VisJudge-Bench, UICrit, etc.) plus composite DQS formula with 10 sub-scores | 28KB |
| 05 | `05-ai-design-tools-gap-report.md` | Tool-by-tool gap analysis (v0, Bolt, Lovable, Claude Design, Figma Make, etc.) plus structured `comparison-matrix.json` | 24KB + 14KB |
| 06 | `06-research-synthesis.md` | Consolidated research synthesis — 22-artifact taxonomy plus Constitution plus DQS plus AI tool gap | 39KB |
| 07 | `07-synthesis-architecture-proposal.md` | Original v1 design synthesis, now superseded by the implementation in `src/` and the deployment guide in [`../operations/deployment.md`](../operations/deployment.md) | 35KB |
| 08 | `08-adversarial-review-v1.md` | First adversarial review of the v1 synthesis | 30KB |
| 09 | `09-adversarial-review-v2.md` | Second, web-verified adversarial review — refuted 5 load-bearing claims, surfaced 3 concrete bugs, proposed Day-0 falsification experiment | 26KB |
| 10 | `10-evaluation-brief.md` | The brief given to the adversarial reviewers | 8KB |
| – | [`../REVIEW-glm-5.2-2026-07-13.md`](../REVIEW-glm-5.2-2026-07-13.md) | Single-model GLM-5.2 architectural review of the original docs | 13KB |
| – | [`../REVIEW-glm-code-2026-07-13.md`](../REVIEW-glm-code-2026-07-13.md) | Single-model GLM-5.2 architectural review of the implementation code | 12KB |

## Reading order

If you are new to the project and want to understand *why* the architecture looks the way it does, read in this order:

1. [`../README.md`](../README.md) — what the tool is and how to use it
2. [`../operations/deployment.md`](../operations/deployment.md) — the production deployment shape
3. [`../adr/0001-byok-key-handling.md`](../adr/0001-byok-key-handling.md) — the BYOK contract that shapes the data model
4. `06-research-synthesis.md` — the full research picture in one document
5. `09-adversarial-review-v2.md` — what the previous design got wrong, and why we pivoted

The other files are supporting material — read them when you need a specific topic.