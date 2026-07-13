# Research corpus

> Background research and design rationale. This directory contains the design research behind the project's architecture. It is included in the public repository so the design decisions in the main docs are auditable and traceable.

## Index

| # | File | Topic | Size |
|---|---|---|---|
| 01 | `01-design-constitution-research.md` | Four-tier Design Constitution schema (hard rules, soft rules, aesthetic dispositions, brand-specific) | 38KB |
| 02 | `02-design-deliverable-taxonomy.md` | The 22-artifact deliverable bundle a senior designer produces vs the 1 artifact AI tools emit | 34KB |
| 03 | `03-codified-design-principles.md` | 21 sources of codified design principles (WCAG, MD3, HIG, Carbon, Polaris, Geist, etc.) with MC:Y/P/N taxonomy and Top-20 ranking | 57KB |
| 04 | `04-design-quality-rubric.md` | Survey of 13 academic benchmarks (AesBench, VisJudge-Bench, UICrit, etc.) plus composite DQS formula with 10 sub-scores | 28KB |
| 05 | `05-ai-design-tools-gap-report.md` | Tool-by-tool gap analysis (v0, Bolt, Lovable, Claude Design, Figma Make, etc.) plus structured `comparison-matrix.json` | 24KB + 14KB |
| 06 | `06-research-synthesis.md` | Consolidated research synthesis — 22-artifact taxonomy plus Constitution plus DQS plus AI tool gap | 39KB |
| 07 | `07-synthesis-architecture-proposal.md` | Synthesis; the implementation in `src/` and the deployment guide in [`../operations/deployment.md`](../operations/deployment.md) are the authoritative version of this proposal | 35KB |
| 08 | `08-adversarial-review-v1.md` | Adversarial review of the synthesis | 30KB |
| 09 | `09-adversarial-review-v2.md` | Web-verified adversarial review — refutes 5 load-bearing claims, surfaces 3 concrete bugs, proposes a falsification experiment | 26KB |
| 10 | `10-evaluation-brief.md` | The brief for the adversarial reviewers | 8KB |

## Reading order

If you want to understand *why* the architecture looks the way it does, read in this order:

1. [`../README.md`](../README.md) — what the tool is and how to use it
2. [`../operations/deployment.md`](../operations/deployment.md) — the production deployment shape
3. [`../adr/0001-byok-key-handling.md`](../adr/0001-byok-key-handling.md) — the BYOK contract that shapes the data model
4. `06-research-synthesis.md` — the full research picture in one document
5. `09-adversarial-review-v2.md` — the design decisions that shape the approach

The other files are supporting material — read them when you need a specific topic.