# Adversarial Review — Design Knowledge MCP Synthesis

**Target:** `SYNTHESIS.md` (Design Knowledge MCP proposal)
**Document type:** Background research synthesis
**Reviewer:** Second agent via `delegate_task`
**Date:** 2026-07-12
**Mode:** Honest pushback. Claims verified or refuted with real URLs, real paper findings, real benchmarks. If a claim is strong, confirmed briefly; if weak, broken with evidence.

---

## TL;DR

The synthesis has a sound intuition but **makes four significant overclaims** and **misframes its core empirical evidence**. The "active MCP" architecture is **not buildable as described** in standard MCP. The "keystone dataset" is much narrower than claimed. The biggest external threat — `marvkr/better-design` — is essentially the same product and ships today. The strongest version of this proposal is **a passive reference MCP + a CI/agent-hook wrapper**, not an active enforcement layer.

**Overall verdict: Build with revisions — and only after answering the open questions below.**

---

## The Five Claims

### Claim 1 — Mid-tier models fail because they lack a perception loop

**Verdict: REFINED — directionally correct but misattributed and overstated.**

**Evidence:**
- The synthesis layers (Layer 1–5) are a useful construct, but the central causal claim — "no Layer 4 → no Layer 2 → first guess ships" — is asserted, not measured.
- The strongest counter-example is **Apple ml-rldf** (arXiv:2509.16779). The model that beat GPT-5 was **Qwen3-Coder 30BA3B fine-tuned on sketch-feedback preference pairs**. It has **no vision encoder** at all. It beat GPT-5 on UI generation. This means: *no vision loop, yet outperforms the frontier*. The "perception loop missing" frame cannot be the whole story; design knowledge learned via ranking feedback from real sketches works. (See Section "Apple paper sanity check" below.)
- The Ghiasvand paper (arXiv:2606.29689) is misapplied. The actual paper:
  - Domain is **photography critique** on the Reddit PhotoCritique dataset, **not UI design**.
  - Models tested are **open-weight 7–11B** (Qwen2-VL-7B, LLaVA-1.6-Mistral-7B, LLaVA-OneVision-7B, InternVL3-8B, Llama-3.2-11B-Vision). **Frontier Claude Sonnet 4 / GPT-5 vision were not tested.**
  - The control is **feeding the model the wrong photograph entirely**, not "pixel-shuffled." The result is that critiques of correct vs. shuffled images resemble each other more than either resembles a human critique — i.e., the model applies a stable "house style" regardless of image. This is not the same as "pixel-shuffled input produces same critique." The synthesis paraphrases the paper loosely.
  - Conclusion: "reference-based similarity rewards a fluent, comprehensive critique style rather than the selectivity and specificity of human critique." This is a *methodological* finding, not a *capability* finding about MLLMs in general.
- Even if the perception loop matters for frontier VLMs, the synthesis offers **no experiment** showing mid-tier models in particular fail because they lack a perception loop — as opposed to (a) lacking token knowledge, (b) lacking component-pattern recall, (c) lacking spatial-reasoning capability, or (d) suffering from attention dilution in long code-generation contexts.

**Implication:** Don't build the architecture on the "perception loop is THE missing layer" claim. Build it on the more defensible claim: **mid-tier models ship their first guess because nothing forces them to revise.** The "perception loop" is one implementation of that forcing function, but not the only one. Other implementations (CI hooks, post-generation review, regenerate-and-diff) are simpler and more reliable.

---

### Claim 2 — MCP can be made "active" — mandates tool calls during generation

**Verdict: REFUTED for the strong version; PARTIALLY VIABLE for a weak version.**

**Evidence:**
- The MCP spec (https://modelcontextprotocol.io/docs/concepts/architecture, captured 2026-07) confirms the synthesis's own admission: MCP is **request/response JSON-RPC 2.0** with notifications. There is **no transport-level enforcement primitive**.
- Server primitives are: `tools`, `resources`, `prompts`, `notifications/tools/list_changed`. Client primitives are: `sampling/createMessage`, `elicitation/create`, `logging`, plus experimental `tasks`. None of these let the server gate the host's text generation.
- The synthesis proposes a "system prompt fragment installed by the MCP itself on first contact" as the enforcement mechanism. This is **the same mechanism as a "skill" loaded at session start** — exactly the failure mode the synthesis critiques as insufficient ("Markdown skills are passive prompt templates loaded once at session start. Mid-tier models weight them like any other instruction and forget them by turn 5"). The synthesis correctly identifies the failure mode and then proposes it as the fix.
- Empirical evidence on system-prompt persistence in long contexts is limited, but practitioner reports (https://www.memorylake.ai/en/blogs/claude-forgets-system-prompts) and Anthropic's own Claude Code issue tracker (#14227) confirm: **system prompt instructions are NOT reliably remembered across many turns** in long sessions. The synthesis's own Open Question #7 ("Does the system prompt fragment actually persist across turns on mid-tier models?") is correct — and unanswerable today.
- Closest existing patterns:
  1. **Cursor / Claude Code / Windsurf hooks** — pre/post generation hooks that can inject context or block output. These run in the *host*, not the server, and are the only reliable enforcement point. (Synthesis doesn't mention them.)
  2. **CI/pre-commit review bots** — Reviewable, deterministic, but not real-time.
  3. **MCP `prompts` primitive** — server-defined prompt templates that the host can inject; closest to what the synthesis wants, but still subject to the same forgetting problem.
  4. **MCP `notifications` (one-way push)** — server can push `notifications/tools/list_changed` but cannot force a tool call.

**Implication:** The "active MCP" architecture as written is not enforceable in standard MCP. Two viable paths:
1. **Reframe as passive-reference MCP + agent-host hook.** Most realistic. Build the MCP for *querying*; build a host-side hook for *enforcement*. This is the same architecture Cursor hooks and Anthropic's own Claude Code hooks already use.
2. **Build a non-MCP product** (CLI hook, code-review bot, pre-commit, IDE plugin). The synthesis's tool surface and dataset work would transfer verbatim.

If the parent session wants to stick with "active MCP," they should commit to **defining an MCP extension spec** (e.g., a new "tasks" or "gates" primitive) and shipping a reference host. That's a multi-month standards-track effort, not a 5-day MVP.

---

### Claim 3 — Frontier VLMs are adequate critics for heuristic-level design issues

**Verdict: REFUTED for the strong version; PARTIALLY VIABLE for very narrow issues (contrast, alt text).**

**Evidence:**
- The synthesis names "contrast, spacing, token consistency" as heuristic-level issues frontier VLMs can reliably catch. This is **partially testable today** (contrast ratios are mathematical; WCAG checkers do it better than any VLM). The synthesis should not put a frontier VLM in the loop for these — it should put **libraries** (e.g., WCAG contrast formulas, APCA, axe-core) and only call the VLM for things those can't compute.
- The UICrit paper itself (https://arxiv.org/abs/2407.08850v3) tested Gemini Pro Vision zero-shot critique generation: only **13.1%** of Gemini's 5,927 generated comments were deemed valid by human designers. The synthesis's framing — "reliably catch" — is the opposite of what the source paper found.
- The follow-up UICrit paper by the same authors (https://arxiv.org/abs/2412.16829) showed that **iterative visual prompting + few-shot examples** reduced the gap from human performance by 50% on one rating metric. So with prompting effort, frontier models get *closer* but not *equivalent*. Still useful — just expensive and not "reliable."
- **VisJudge-Bench** (https://arxiv.org/abs/2510.22373, ICLR 2026) is the most directly relevant benchmark. It measures MLLM aesthetics on 3,090 expert-annotated visualizations across 32 chart types and three categories (single, multi, dashboard):
  - GPT-5 MAE = **0.551**, correlation with humans = **0.429**
  - Claude-4-Sonnet MAE = **0.618** (worse than GPT-4o's 0.609)
  - Best specialized model (VisJudge, fine-tuned Qwen2.5-VL-7B with GRPO): MAE = 0.442, correlation = 0.681
  - **No off-the-shelf frontier VLM reaches 0.7+ correlation with humans on aesthetic evaluation.** The synthesis's claim that frontier VLMs "reliably catch" heuristic issues is **not supported by the strongest published benchmark in this niche.**
- Cost claim ($0.01–0.05/critique) is plausible but **per-critique at full resolution** it's $0.03–0.10 (GPT-5 vision with image input at 1024×1024+). For a 50-block generation = **$1.50–5.00/artifact**. This is high enough that the synthesis's claim "fine for dev workflows" needs qualification — dev workflows at scale can still run thousands of dollars/month per developer.

**Implication:** Two corrections are needed.
1. Move **mathematically-checkable issues** (contrast, APCA, spacing tokens, WCAG) out of the VLM path entirely. They're $0.00/compute and more accurate. The synthesis explicitly mentions WCAG + APCA but then still routes them through `render_and_critique` for no reason.
2. For the **visual issues** that need a VLM, treat the VLM as a **low-precision, high-recall noise generator** — its output must be post-processed, filtered, or routed back to the model as concrete code diffs, not as free-text critique. (Synthesis's own Open Question #4 asks this; the answer is: yes, code diffs are needed, not free text.)

---

### Claim 4 — UICrit is the keystone dataset and generalizes

**Verdict: REFUTED for "generalizes"; CONFIRMED for the narrow facts.**

**Evidence:**
- **Repo exists.** https://github.com/google-research-datasets/uicrit — real.
- **License CC BY 4.0.** Confirmed in README.
- **Dataset size: 11,344 critiques.** Confirmed in README (3× larger than the 3,059 in the original UIST '24 paper; the GitHub release was expanded to 11,344 by collecting 3 annotators per UI instead of 1). The paper version is 3,059; the public CSV is 11,344. The synthesis states 11,344 — accurate for the public release.
- **Bounding boxes are per-critique, normalized to screenshot dimensions**, attached to each comment. Granularity is per-region, not per-pixel. Useful.
- **Source data: RICO (2017–2018 Android apps, ~9.3k apps, 27 categories, 66k screens).** All critiqued UIs are **mobile**, from ~2017–2018. **This is the killer fact.** The dataset does NOT contain:
  - Dashboards
  - B2B SaaS
  - Content sites / marketing pages
  - iOS apps
  - 2020+ design language (post-Tailwind, post-shadcn, post-Linear-grade dark themes)
  - Information-dense enterprise UIs
- **The synthesis claims UICrit "will generalize to dashboards, B2B SaaS, content sites."** This is **the most overclaimed statement in the synthesis.** A dataset of 2018-era mobile Android screens does not generalize to 2026 SaaS dashboards without explicit validation. The paper authors acknowledge: "Due to the open-ended nature of UI design critique, UICrit does not have the complete set of [design knowledge]." 
- **7 designers** (paper) / **3 annotators per UI** (expanded release). Median 1–2 years experience. One annotator has 16 years. The dataset is small-team, mid-expertise — useful, not gold-standard.

**Competing / alternative datasets the synthesis missed:**

| Dataset | Source | Coverage | Why it matters |
|---|---|---|---|
| **UIClip** | https://arxiv.org/abs/2404.12500 (Jason Wu et al., Apple/CMU) | Screenshot+description → quality score + suggestions, trained on **100k+ crawled UIs** with human ratings | Larger scale, broader coverage, includes "design suggestions" output |
| **Visual Prompting with Iterative Refinement** | https://arxiv.org/abs/2412.16829 (Duan et al., same authors as UICrit) | Direct methodological follow-up on UICrit using Gemini-1.5-pro + GPT-4o | This is the paper the synthesis should cite as the proof-of-concept for the critique loop |
| **A11YN** | https://arxiv.org/abs/2510.13914 | 6,800 training instructions + 300 real-world web UI requests for **accessibility** specifically | Directly overlaps with the synthesis's accessibility claims; 60% inaccessibility reduction |
| **VisJudge-Bench** | https://arxiv.org/abs/2510.22373 (ICLR 2026) | 3,090 expert-annotated visualizations (single, multi, dashboard) — closest thing to what the synthesis wants for dashboards | **Direct counter-evidence** to Claim 3 |
| **UIEyes** | (Jiang et al., 2023) | Gaze data on 1,980 UIs from 62 participants | Useful as a perceptual complement, not critique |
| **Owl Eyes** | https://arxiv.org/abs/2009.01417 | Spotting UI display issues via visual understanding | Older, but explicitly about display issues |

**Implication:** The synthesis should not bet the entire critique layer on UICrit alone. The most realistic combination is:
- **UICrit** for mobile-web critique (existing)
- **UIClip** (open weights from Apple) as a critic model — no VLM call needed, ~$0.00/inference, runs locally
- **VisJudge-Bench** to validate that the chosen critic actually correlates with humans on the domain it claims
- **A11YN** for accessibility-specific rules

If "generalizes to dashboards/SaaS" is required for the user's use case, the synthesis needs to either (a) collect new dashboard critique data, (b) license Mobbin's labeled data, or (c) accept that the v1 product is mobile-web only.

---

### Claim 5 — 5-day MVP path is realistic

**Verdict: INSUFFICIENT EVIDENCE — likely 2–3 weeks, not 5 days, given what's actually in scope.**

**Evidence — specific concerns:**

1. **Data harvest (Day 1):** Cloning 30 design-system repos is one thing. **Pulling 5–10 Figma Community files via REST API requires authentication and rate-limiting handling** that the synthesis glosses over. Figma Community files have inconsistent license metadata; the synthesis correctly notes "license-by-file is brittle" but does not budget time for it. The synthesis also references `@grida/refig` as a fallback for `.fig` rendering. Verified: package exists (https://registry.npmjs.org/@grida/refig, v0.0.7, MIT), and actually **does parse `.fig` files** via Skia+WASM — the synthesis says "use REST API instead" but doesn't have to. Either way, budget is at least 1–2 days for data normalization + license audit + rendering, not "Day 1."

2. **Token normalization (Day 2):** Converting 30 systems to DTCG is real work. Style Dictionary + sd-transforms is the right toolchain but token names, units (px vs rem), and color spaces (sRGB vs OKLCH vs P3) differ across systems. The "50KB compressed per spec" estimate is plausible but the **3GB total** estimate across all data is for raw screenshots + tokens; the critique layer (UICrit 11k entries with bounding boxes) alone is ~50–200MB.

3. **MCP server skeleton (Day 3):** MCP servers are straightforward (Node.js or Python SDK, stdio or Streamable HTTP). **However**, the synthesis underestimates the time to wire `render_and_critique` to a frontier VLM API: it requires
   - Headless browser setup (Playwright in a sandbox),
   - Brand-spec CSS injection,
   - Prompt engineering for critique,
   - Structured-output parsing,
   - API key management,
   - Cost/latency telemetry.
   This is 2–3 days on its own.

4. **Critique loop integration (Day 4):** Testing on three briefs (pricing, dashboard, settings) is realistic. **What is missing is the eval methodology.** The synthesis never specifies what "improvement" means operationally. Without a concrete rubric (token-consistency ratio, WCAG pass rate, designer preference A/B), "we ship an MCP" is unverifiable.

5. **Documentation + adversarial eval (Day 5):** Doc-writing is one day. **An adversarial eval by a second agent — which is what this document is — takes more than a day.** The synthesis treats its own adversarial eval as a Day 5 deliverable, which is reasonable if it's the synthesis's own validation; treating an external review as a Day 5 milestone is optimistic.

**What the synthesis omits that adds time:**
- License audit for the curated token corpus (Apache-2.0 Carbon + MIT shadcn + CC-BY UICrit + MIT Radix + …). Attribution requirements are non-trivial.
- Adversarial testing of the **system-prompt persistence** question (Claim 2's load-bearing assumption).
- Frontend dev for the brand-spec selector / preview UI.
- Documentation site / landing page / changelog.

**Implication:** 5 days is realistic for the **passive-reference MCP** (tokens + examples + accessibility linting, no VLM). The **active-loop version** is closer to **15–20 working days** for a single competent engineer. Either ship less in v1, or expect 3× the timeline.

---

## Citation Verification

| Citation | Verdict | Notes |
|---|---|---|
| **arXiv:2606.29689 (Ghiasvand et al.)** | **Real, but misdescribed in synthesis.** | Paper exists. Authors: Ghiasvand, Amirizaniani, Ehsani Oskouie, Alizadeh, Pedarsani (UCSB/UW/UCLA). Title: "Can MLLMs Critique Like Humans? Evaluating Open-Ended Aesthetic Reasoning in Multimodal Large Language Models." Submitted 2026-06-29. Domain: **photography critique** (Reddit PhotoCritique), NOT UI design. Models tested: **open-weight 7–11B**, NOT frontier VLMs. Control: **wrong photograph entirely**, NOT "pixel-shuffled." Finding: models apply a "house style" regardless of input. Synthesis correctly cites it as evidence of MLLMs having an aesthetic prior independent of input; incorrectly claims it as a measurement of "knowledge without judgment" in general. **Use as supporting evidence, not load-bearing.** |
| **arXiv:2509.16779 (Apple ml-rldf)** | **Real.** | Paper exists. Authors: Jason Wu (Purdue), Amanda Swearngin, Arun Krishna Vajjala, Alan Leung, Jeffrey Nichols, Titus Barik (Apple). Venue: **CHI '26**, DOI 10.1145/3772318.3791567. Title: "Improving User Interface Generation Models from Designer Feedback." Dataset: **1,460 UI screens** annotated by **21 designers** (not 21,500 — the synthesis correctly says 21 designers and 1,460 UIs, both accurate). Prompt-locked: **confirmed** — Apple README explicitly states: *"Keep in mind that the model was finetuned only on the specific prompt in the paper and may not generalize to other prompts and use cases."* The synthesis frames this as a "negative result against teach-the-model-taste-via-fine-tuning." **That's wrong.** The paper is a **positive result** (Qwen3-Coder + Sketch fine-tuned beats GPT-5) with a **negative caveat** (doesn't generalize). The synthesis should reframe: fine-tuning works for narrow, prompt-locked tasks; MCP is the right answer for generalizable design intelligence. |
| **google-research-datasets/uicrit** | **Real.** | Repo exists. CC BY 4.0 confirmed. 11,344 critiques in the public release (paper has 3,059; release is 3× larger). Bounding boxes per-critique, normalized. Source: **mobile UIs from RICO (Android, 2017–2018)**. The synthesis's "generalizes to dashboards/SaaS" claim is unsupported. |
| **mcpland/storybook-mcp** | **Real.** | https://github.com/mcpland/storybook-mcp — created 2025-05-19, last push 2026-04. Tools: `getComponentList`, `getComponentsProps` (headless browser), `CUSTOM_TOOLS`. Active project. The synthesis accurately describes it. |
| **@grida/refig** | **Real.** | npm package, v0.0.7, MIT. Description: "Headless Figma renderer — render .fig and REST API JSON to PNG/JPEG/WebP/PDF/SVG." Built on Skia+WASM. **Does parse `.fig` files** — synthesis says "use REST API instead" but the package supports `.fig` parsing if you want it. |
| **mobbin/mobbin-mcp-server** | **Real.** | https://github.com/mobbin/mobbin-mcp-server — created 2026-05-20 (very recent), hosted endpoint at `https://api.mobbin.com/mcp` via Streamable HTTP. The repo's README is minimal — just one paragraph pointing to docs.mobbin.com/mcp. **Could not independently verify the tool surface from the repo alone** (the synthesis's claims about Mobbin's tool set rely on docs.mobbin.com, which is paywalled). The synthesis should explicitly flag this verification gap. |
| **marvkr/better-design** | **Real, and the synthesis understates how directly competitive it is.** | https://github.com/marvkr/better-design — created 2026-05-05. Description: "Open-source design MCP server + shadcn/ui registry — AI design systems for Claude Code, Cursor, Codex, GitHub Copilot & any MCP client. **31 brand-grade themes** (Linear, Stripe, Vercel, Notion, Apple, Supabase, Figma…) + design tokens, UI principles & WCAG rules." Tool surface: `resolve-design-system`, `get-design-system-docs`, `get-ui-principle`, `get-review-rules`, `resolve-icon-library`, `search-icons`. Remote MCP endpoint: `https://better-design.com/api/mcp` with API key auth. **This is essentially the synthesis's product, shipping now.** The synthesis calls it "closest free analog" — that's accurate but downplays the threat: better-design has tokens, principles, review rules, design-system matching, MCP remote endpoint, and an installable shadcn registry. The synthesis's proposed opening (a free, Figma-agnostic, design-taste MCP with curated tokens + critique) is already **occupied**. |

**Fabricated citations: NONE found. All seven are real.** The synthesis's main failure is **misdescription of the Apple and Ghiasvand papers**, not fabrication.

---

## Architecture Assessment: "Active MCP" — Buildable in Standard MCP?

**Short answer: No, not in the strong sense. Closest pattern: host-side hooks (Cursor/Claude Code/Windsurf) wrapping a passive-reference MCP.**

**The MCP spec's primitives** (https://modelcontextprotocol.io/docs/concepts/architecture):
- `tools/call` (request/response) — model invokes, server returns
- `resources/read`, `prompts/get` — model reads on demand
- `notifications/*` — one-way push, no enforcement
- `tasks` (experimental) — durable execution, but still doesn't gate host generation
- `sampling/createMessage` — server asks host for LLM call (server-to-host), but no gating

**There is no primitive that lets the server say "you may not generate text until you call this tool."**

**Closest existing patterns, ranked by viability:**
1. **Host-side agent hooks** (Claude Code hooks, Cursor hooks, Windsurf events) — the host can intercept generation events and force tool calls. **This is the actual mechanism the synthesis needs.** The MCP server itself stays passive; the host enforces.
2. **CI / pre-commit / pre-merge bots** — deterministic, well-understood, but post-hoc.
3. **IDE plugin** (VS Code, JetBrains) — can gate file saves, but not generation in flight.
4. **Anthropic-defined MCP extension for "gates"** — would require standards work; not in any current MCP spec draft I can verify exists.

**Implication:** Reframe the architecture:
- **MCP server: passive reference.** Tokens, critique data, examples, accessibility rules, VLM-backed render-and-critique when the host calls it.
- **Host-side enforcement: agent hook** (Claude Code `.claude/hooks/`, Cursor rules, etc.) that auto-invokes `require_brand_spec` at session start and `final_audit` before allowing "done" or commit.
- **The synthesis's tool surface transfers unchanged.** Only the enforcement mechanism moves from "MCP mandates" to "host hook mandates."

This is a real and buildable architecture. The synthesis can keep 80% of its design intact. The remaining 20% — the "active" part — needs to be reframed as "the host invokes our tools; we don't gate the host."

---

## Top 3 Changes Before Engineering Starts

1. **Drop the "active MCP" claim. Replace with passive-reference MCP + agent-host hook.** This is the only viable enforcement point in 2026. Most of the synthesis's tool surface and data work transfers as-is.

2. **Replace "frontier VLM is an adequate critic" with a layered critic:** (a) libraries for mathematically-checkable issues (WCAG, APCA, axe-core), (b) **UIClip (Apple, MIT-style release)** as a fast local critic for general quality scores (no VLM call), (c) frontier VLM only for visual gestalt when explicitly requested, with critique rendered as concrete code diffs not free text. VisJudge-Bench data shows frontier VLMs at MAE 0.55, correlation 0.43 — they're noise generators, not reliable critics. Treat them accordingly.

3. **Acknowledge the existing landscape is more crowded than the synthesis implies.** Specifically: `marvkr/better-design` ships today with 31 brand themes, design tokens, review rules, and a remote MCP endpoint. **`dannyhw/mcp-storybook`** is a real Storybook MCP. **A11YN** already does accessibility-aligned UI generation. **VisJudge-Bench** is the ICLR 2026 benchmark for the exact problem the synthesis proposes to solve. Either differentiate (Figma-agnostic? open-data? explicit visual critique?) or don't build.

---

## Top 3 Open Questions Requiring User Input

1. **User domain.** Is this product for **mobile web** (where UICrit applies) or **dashboards/SaaS** (where it doesn't)? The answer determines whether UICrit is enough or whether dashboard critique data must be collected/licensed. The synthesis assumes both; that's not tenable for v1.

2. **Enforcement tolerance.** Will the user accept a **post-hoc review** (CI hook, pre-commit) instead of real-time enforcement? If real-time is required, the architecture shifts substantially and may not be shippable as a 5-day MVP. If post-hoc is fine, the synthesis's tool surface is mostly correct and the "active" framing can be retired.

3. **Cost / business model.** The synthesis is silent on who pays for VLM critique. At $0.03–0.10/critique × 50 blocks/artifact × hundreds of artifacts/month, this is $50–500/month per active developer — non-trivial. Options: (a) UIClip-style local critic (no API cost), (b) remote MCP with metered billing (better-design's model), (c) tiered — local for cheap checks, VLM only for explicit visual review. The user must pick.

---

## Overall Verdict: **Build with revisions**

The intuition is sound. The architecture's right half (data harvesting, token normalization, accessibility linting, critique retrieval, render-and-critique VLM) is correct and buildable. The architecture's load-bearing left half — "active MCP" — is not buildable in standard MCP as written and must be reframed as host-side hook enforcement around a passive MCP.

The 5-day timeline is realistic for **the passive MCP alone**. The full vision (active enforcement + VLM critique + 31-brand registry) is **15–20 working days** for one engineer.

The synthesis should not be built as written. It should be built as a **passive-reference MCP with a host-hook enforcement layer**, with the VLM tier demoted from "default critic" to "explicit-review option" gated on cost.

The closest competitor (`marvkr/better-design`) ships today. Differentiation requires either (a) deeper critique data than UICrit (i.e., dashboards/SaaS, which UICrit does not have), (b) a faster/cheaper critic than frontier VLM (e.g., local UIClip), or (c) a real enforcement story that better-design doesn't have. The synthesis currently has none of the three.

---

## Evidence Inventory (for parent session's audit)

All URLs visited and verified 2026-07-12:

- arXiv:2606.29689 (Ghiasvand et al.) — `https://arxiv.org/abs/2606.29689`
- arXiv:2509.16779 (Apple ml-rldf) — `https://arxiv.org/abs/2509.16779`
- arXiv:2407.08850 (UICrit paper) — `https://arxiv.org/abs/2407.08850`
- UICrit repo — `https://github.com/google-research-datasets/uicrit`
- arXiv:2412.16829 (Visual Prompting follow-up) — `https://arxiv.org/abs/2412.16829`
- arXiv:2510.13914 (A11YN) — `https://arxiv.org/abs/2510.13914`
- arXiv:2510.22373 (VisJudge-Bench, ICLR 2026) — `https://arxiv.org/abs/2510.22373`
- arXiv:2404.12500 (UIClip) — `https://arxiv.org/abs/2404.12500`
- Apple ml-rldf README — `https://raw.githubusercontent.com/apple/ml-rldf/main/README.md`
- mcpland/storybook-mcp — `https://github.com/mcpland/storybook-mcp`
- @grida/refig — `https://registry.npmjs.org/@grida/refig`
- mobbin/mobbin-mcp-server — `https://github.com/mobbin/mobbin-mcp-server`
- marvkr/better-design — `https://github.com/marvkr/better-design`
- marvkr/better-design README — `https://raw.githubusercontent.com/marvkr/better-design/main/README.md`
- MCP architecture spec — `https://modelcontextprotocol.io/docs/concepts/architecture`
- Figma MCP launch — `https://www.figma.com/blog/introducing-figma-mcp-server/`
- Anthropic Claude Code issue #14227 (memory persistence) — `https://github.com/anthropics/claude-code/issues/14227`

Web searches where the search backend returned no results (logged as gaps in available evidence):
- "design preference dataset arxiv 2025 2026" — no results
- "aesthetic judgment benchmark" — no results
- "MCP server mandatory tool call active enforcement" — no results
- "system prompt persistence mid-tier LLM" — partial results (memorylake.ai blog, MindStudio, Anthropic issue tracker)
- "VisJudge-Bench" follow-ups — no results

These gaps are recorded so the parent session can run follow-up searches if needed.

---

*End of adversarial review. Report back to the parent session.*
