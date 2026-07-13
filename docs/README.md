# docs/

User-facing documentation for design-tester-lab.

## Top-level docs

| File | Purpose |
|---|---|
| [`REVIEW-glm-5.2-2026-07-13.md`](REVIEW-glm-5.2-2026-07-13.md) | GLM-5.2 architectural review of the original documentation |
| [`REVIEW-glm-code-2026-07-13.md`](REVIEW-glm-code-2026-07-13.md) | GLM-5.2 code review of the implementation |

## Subdirectories

| Directory | Purpose | Audience |
|---|---|---|
| [`adr/`](adr/) | Architecture Decision Records (ADRs) — load-bearing design decisions and their rationale | Contributors, future maintainers |
| [`operations/`](operations/) | Deployment runbooks, env var references, disaster recovery | Operators, self-hosters |
| [`security/`](security/) | Threat model, current vulnerability status, security review checklist | Security reviewers, operators |
| [`contributing/`](contributing/) | How the augmentation system works, how to add a new one | Augmentation authors, contributors |
| [`research/`](research/) | Background research that informed the architecture (10 documents + index) | Architects, curious users — not required reading |
| `internal/` | (gitignored) Personal development artifacts; not for users | Repository maintainers only |

## What is not here

- **Source code** lives in `src/`
- **Augmentation files** live in `content/augmentations/`
- **Schemas and migrations** live in `src/db/` and `drizzle/`
- **Build configuration** is at the repo root (`package.json`, `Dockerfile`, `tsconfig.json`, etc.)