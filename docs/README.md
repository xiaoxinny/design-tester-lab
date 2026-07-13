# docs/

User-facing documentation for design-tester-lab.

## Scope and contents

This repository is a Next.js 14 application. Source code is in `src/`, augmentation content is in `content/augmentations/`, schemas and migrations are in `src/db/` and `drizzle/`, and build configuration is at the repo root (`package.json`, `Dockerfile`, `tsconfig.json`, and so on).

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
| [`research/`](research/) | Background research and design rationale for the architecture (10 documents, indexed by [`research/README.md`](research/README.md)) | Architects, curious readers |