# Evaluation Brief — Adversarial Review

**Target:** `SYNTHESIS.md` in this directory
**Document type:** Background research
**Reviewer:** TBD — second agent via `delegate_task`
**Date:** 2026-07-12

---

## What This Document Is

`SYNTHESIS.md` makes specific claims about why mid-tier AI models fail at design, and proposes an MCP architecture to fix it. The parent session believes this is correct but wants adversarial review before committing engineering effort.

Your job is **not** to validate the synthesis. Your job is to **break it**.

---

## The Claims to Challenge

The synthesis rests on five load-bearing claims. Each one is potentially wrong. Verify or falsify each.

### Claim 1: Mid-tier models fail because they lack a perception loop.

**The synthesis argues:** Mid-tier models can generate JSX/CSS (Layer 5) but cannot visually evaluate their own output (Layer 4). Without Layer 4, Layer 2 (the iteration loop) doesn't run. Result: they ship their first guess, which is the training-data centroid.

**Challenge questions:**
- Is there evidence that mid-tier models *do* use vision tools when available? Or do they just ignore screenshots?
- Does the perception loop actually help on generation tasks, or only on critique tasks? (Apple's ml-rldf paper uses NO vision and beats GPT-5 — does that refute the loop claim?)
- What if the failure is not "can't perceive" but "can't act on perception"? Maybe mid-tier models can see the issue but don't know how to fix it?

**Concrete test to run:** Take a mid-tier model. Give it a screenshot of its own generation plus a written critique from a frontier VLM. Does it revise correctly? If yes, the loop works and the failure is upstream. If no, the failure is downstream.

### Claim 2: The MCP must be "active," not passive.

**The synthesis argues:** MCP servers today are passive (model calls when it wants). For mid-tier models, the MCP must mandate calls at well-defined generation points.

**Challenge questions:**
- MCP transport is request/response — there is no "mandate" primitive. How is "active" actually enforced?
- The synthesis proposes a "system prompt fragment installed by the MCP on first contact." Will mid-tier models actually honor this fragment across many turns? What's the empirical evidence on system prompt persistence on mid-tier models?
- If enforcement requires a different transport or a different protocol, is MCP the right vehicle at all? Should this be a separate tool (CLI hook, pre-commit, code-review bot) instead of an MCP server?

**Concrete test to run:** Pick a mid-tier model. Inject the proposed system prompt fragment. Run a 20-turn generation task. Count how many turns the fragment is honored. If it drops below 70% by turn 10, the architecture collapses.

### Claim 3: A frontier VLM is an adequate critic for `render_and_critique`.

**The synthesis argues:** Claude Sonnet 4 / GPT-5 vision can reliably catch heuristic-level design issues (contrast, spacing, token consistency). The MCP delegates perception to them.

**Challenge questions:**
- What is the actual precision/recall of frontier VLMs on the heuristic issues named (contrast, spacing, token inconsistency)?
- Are there published benchmarks? (Look for AesBench, MM-StyleBench, anything UI-specific.)
- The Ghiasvand paper (arXiv:2606.29689) showed MLLMs apply a "house style" regardless of input — does this mean frontier VLMs are ALSO bad critics, just less obviously so?
- Cost is $0.01-0.05/critique. For a 50-block generation, that's $0.50-2.50 per artifact. Is that sustainable for the use case?

**Concrete test to run:** Run 100 design artifacts through Claude Sonnet 4 vision with a "critique this UI" prompt. Compare critiques against a human designer's rubric. Report precision/recall on the named heuristic categories.

### Claim 4: UICrit is the keystone dataset and will generalize.

**The synthesis argues:** UICrit (11,344 expert critiques, CC BY 4.0) is the foundation of the critique tool. It will generalize to "dashboards, B2B SaaS, content sites."

**Challenge questions:**
- What is the actual domain distribution of UICrit? (Mobile apps vs web vs other?)
- What is the era? (Critiques from 2018 critique 2018-era UI. Will they transfer to 2026 expectations?)
- Are the bounding boxes per-element, per-region, or per-screen? (Granularity matters for the critique tool.)
- Is there a competing dataset the synthesis missed? (Search arXiv 2025-2026 for "UI critique dataset", "design feedback dataset", "aesthetic judgment dataset".)

**Concrete test to run:** Download UICrit metadata. Report the distribution by domain, era, element type, and critique length. Then find 3 alternative datasets and compare.

### Claim 5: The 5-day MVP path is realistic.

**The synthesis argues:** 5 days is enough to ship a working MCP server with the four critical tools, integrated critique loop, and adversarial eval.

**Challenge questions:**
- Step 1 is "clone 30 design-system repos and pull Figma Community files." Figma Community is bot-protected (per agent #2's report). What's the realistic path here?
- Step 3 is "render-and-critique via headless browser + frontier VLM." This requires API keys for the VLM. Is that documented in the MVP?
- The synthesis doesn't address testing. How do you know the MCP actually improves output quality? What's the eval methodology?
- What's the actual licensing posture for redistributing the curated token corpus? Carbon is Apache-2.0 (OK), but combining with shadcn templates and UICrit critiques may have attribution requirements the synthesis glosses over.

**Concrete test to run:** Try to clone and harvest tokens from the named 30 repos in one day. Report actual time, actual issues, actual license surprises.

---

## What to Look For in Sources

The synthesis cites specific papers, repos, and datasets. Verify these are real and current:

- `arXiv:2606.29689` (Ghiasvand et al.) — does this paper exist? What's its actual finding?
- `arXiv:2509.16779` (Apple ml-rldf) — does this exist? Is it prompt-locked as claimed?
- `google-research-datasets/uicrit` — does this repo exist? What license? What's the actual dataset size?
- `mcpland/storybook-mcp` — real? current? what does it actually expose?
- `@grida/refig` — real? does it actually parse `.fig`?
- `mobbin/mobbin-mcp-server` — real? what's the actual tool surface?
- `marvkr/better-design` — real? what's the actual scope?

If any of these are hallucinated or out of date, the synthesis is weaker than it appears.

---

## What to Look For in Logic

- **The "knowledge vs judgment" framing.** The synthesis sharpens this to "perception loop missing." Is that the right sharpening? Or is the actual failure something else (e.g., insufficient training on modern UI, RLHF penalizing creative choices, attention dilution in long contexts)?
- **The "active MCP" architecture.** Is this actually buildable in MCP, or does it require a different protocol? What's the closest existing pattern (pre-commit hooks? CI review bots? Cursor hooks?)?
- **The "separate the critic from the generator" choice.** This is a significant architectural commitment. What are the alternatives? (Generator critiques itself? Generator + lightweight critic in same model? Fine-tuned critic?)
- **The 5-day MVP scope.** Is it ambitious enough to be useful? Or is it too ambitious to actually finish?

---

## Output Format

Write your evaluation as a structured report. For each of the 5 claims:
- **Verdict:** Confirmed / Refuted / Insufficient evidence / Refined
- **Evidence:** What you actually found (cite real URLs, real benchmarks)
- **Implication:** What this means for the architecture

End with:
- **Top 3 changes** the synthesis needs before engineering should start.
- **Top 3 open questions** that require user input or further research.
- **Overall verdict:** Build it as proposed / Build with revisions / Don't build, do X instead.

---

## Style Guidance

- The parent session values honest pushback over validation. If a claim is weak, say so directly with evidence.
- The target user is technical and design-literate. Avoid over-explaining basics.
- Cite real sources. If you can't verify a claim, say so explicitly.
- Don't pad. If the synthesis is strong on a point, say "strong, confirmed" and move on.

---

*Begin evaluation. Report back with the structured review.*