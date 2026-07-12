# Research corpus

Background research that informed the design of `design-tester-lab`. None of this is required reading for users of the tool — it's the evidence base for the architecture decisions in `../README.md` and `../BUILD-PLAN.md`.

## Index

| # | File | Topic | Size |
|---|---|---|---|
| 01 | `01-design-constitution-research.md` | Four-tier Design Constitution schema (hard rules / soft rules / aesthetic dispositions / brand-specific) for AI design agents | 38KB |
| 02 | `02-design-deliverable-taxonomy.md` | The 22-artifact deliverable bundle a senior designer produces vs the 1 artifact AI tools emit | 34KB |
| 03 | `03-codified-design-principles.md` | 21 sources of codified design principles (WCAG, MD3, HIG, Carbon, Polaris, Geist, etc.) with MC:Y/P/N taxonomy and Top-20 ranking | 57KB |
| 04 | `04-design-quality-rubric.md` | Survey of 13 academic benchmarks (AesBench, VisJudge-Bench, UICrit, etc.) + composite DQS formula with 10 sub-scores | 28KB |
| 05 | `05-ai-design-tools-gap-report.md` | Tool-by-tool gap analysis (v0, Bolt, Lovable, Claude Design, Figma Make, etc.) + structured comparison-matrix.json | 24KB + 14KB |
| 06 | `06-research-synthesis.md` | Consolidated research synthesis — 22-artifact taxonomy + Constitution + DQS + AI tool gap | 39KB |
| 07 | `07-synthesis-architecture-proposal.md` | Original v1 design-knowledge-mcp synthesis (superseded by the design-tester-lab proposal in `../README.md` and `../BUILD-PLAN.md`) | 35KB |
| 08 | `08-adversarial-review-v1.md` | First adversarial review of the v1 design-knowledge-mcp synthesis | 30KB |
| 09 | `09-adversarial-review-v2.md` | Second, web-verified adversarial review — refuted 5 load-bearing claims, surfaced 3 concrete bugs in docs, proposed Day-0 falsification experiment | 26KB |
| 10 | `10-evaluation-brief.md` | The brief given to the adversarial reviewers | 8KB |
| – | `REVIEW-glm-5.2-2026-07-13.md` | Single-model GLM-5.2 architectural review of the design-tester-lab Day 1 docs | 13KB |

## Reading order

If you're new to the project and want to understand *why* the architecture looks the way it does, read in this order:

1. **`../README.md`** — what the tool is and how to use it
2. **`06-research-synthesis.md`** — the full research picture in one document
3. **`09-adversarial-review-v2.md`** — what the previous design got wrong, and why we pivoted
4. **`REVIEW-glm-5.2-2026-07-13.md`** — the most recent architectural review (covers the Day 1 docs)
5. The other files are supporting material — read them when you need a specific topic