# Design Knowledge MCP — Synthesis & Architecture Proposal

**Author:** Hermes Agent (MiniMax-M3) for Yi Jiaxin
**Date:** 2026-07-12 (revised after two adversarial reviews)
**Status:** Revised proposal — addresses `ADVERSARIAL-REVIEW.md` (first review) and `EVALUATION.md` (second, web-verified review)
**Companion docs:** `ADVERSARIAL-REVIEW.md` (first review), `EVALUATION.md` (second, web-verified review + Day-0 falsification protocol), `EVALUATION-BRIEF.md` (brief)

---

## TL;DR

The premise — "AI models, especially mid-tier, have terrible design skills and we can fix it by injecting design knowledge as a queryable context/MCP server" — is **correct in direction but needs sharpening before it can be built**.

The fix is **not** "make the model tasteful." The fix is **make the model unable to ship without consulting a critic.** After adversarial review, this resolves to:

1. **A passive-reference MCP** (tokens, critique data, examples, accessibility rules, optional render-and-critique).
2. **A host-side agent hook** (Claude Code / Cursor / Windsurf) that auto-invokes the MCP tools at defined generation points. *Not* an "active MCP" — that framing was incorrect.
3. **A tiered critic** — mathematical (WCAG/APCA/axe-core) for checkable issues; local UIClip-style critic for visual heuristics; frontier VLM only when explicitly requested, output as code diffs. *Not* "frontier VLM is adequate" — VisJudge-Bench refutes that.
4. **Scope-bounded data** — start with mobile/web (where UICrit applies), not dashboards/SaaS where UICrit fails.

**[UPDATED after the second, web-verified review — `EVALUATION.md`]** Three further corrections fold in below:
- **The enforcement layer is a host-side CLI hook, not "the hook calling MCP tools."** A Claude Code / Cursor hook is a shell command; it cannot initiate an MCP call. The deterministic tiers (`math_audit`, `final_audit`) run as a CLI that shares the MCP server's code and blocks on exit code; the MCP tool surface is the *model's* optional knowledge layer. The §2 diagrams are corrected accordingly.
- **The competitive opening is narrower than §6 first implied.** The render→critique→revise loop already ships as standalone MCP servers (`zueai/frontend-review-mcp`, `haasonsaas/design-critique-mcp`) and is being absorbed by the host platform (Claude Design's `/design-sync`). The loop is now table stakes; the defensible seam is open-data provenance + real hook/CI enforcement + the free math tier.
- **Do not start the 15–20 day build until a 1-day falsification experiment passes** (Day-0 gate at the top of §7): can a mid-tier model act on a correct critique across 3+ rounds *without regressing*? Untested — and everything downstream depends on it.

This document supersedes the 2026-07-12 v1 synthesis. Major changes are marked **[REVISED]** with the original claim cross-referenced.

---

## 1. The Failure Mode (Sharpened After Review)

The user-level symptom: "mid-tier AI models make dumb UX/UI decisions."

The diagnostic underneath is sharper. There is a capability ladder:

| Layer | Capability | Mid-tier | Frontier |
|---|---|---|---|
| 5 | Generation (emit JSX/CSS) | Yes (badly) | Yes |
| 4 | Visual reasoning (look at a screenshot and describe what's wrong) | Weak / absent | Yes |
| 3 | Critique (apply design heuristics to an artifact) | Surface only | Yes |
| 2 | Iteration loop (generate → perceive → revise) | No — missing Layer 4 | Yes |
| 1 | Taste (refusal, selection, accountability) | No | Approximated |

### [REVISED] What changed

The original synthesis claimed "mid-tier fails because it lacks a perception loop." The reviewer surfaced **Apple ml-rldf (arXiv:2509.16779)**: a Qwen3-Coder fine-tuned on sketch-feedback preference pairs — *no vision encoder* — beat GPT-5 on UI generation. This refutes the strong claim.

The defensible reframe: **mid-tier models ship their first guess because nothing forces them to revise.** The perception loop helps on critique; it isn't the only path to revision. The Apple result shows that ranking-based preference learning on sketch feedback works *without* vision. The right architecture has to defend against "model ships without consulting anyone," not specifically "model can't see."

### Three pieces of empirical evidence ground this framing

1. **VisJudge-Bench (arXiv:2510.22373, ICLR 2026)** — directly relevant benchmark. GPT-5 MAE = 0.551, human correlation = 0.429. Claude-4-Sonnet MAE = 0.618. **No off-the-shelf frontier VLM reaches 0.7+ correlation on design critique.** *This is the strongest empirical evidence against using frontier VLMs as the primary critic.*

2. **Ghiasvand et al. (arXiv:2606.29689)** — [REVISED framing] The original synthesis cited this as evidence MLLMs apply a "house style" regardless of input. After review: the actual paper is about **photography critique on Reddit PhotoCritique**, tested **open-weight 7–11B models** (Qwen2-VL-7B, LLaVA-1.6-Mistral-7B, etc., not frontier Claude/GPT-5), with a **wrong-photo control** rather than pixel-shuffled input. The finding is a methodological point about reference-similarity metrics, not a capability statement about frontier VLMs. Use as supporting evidence only, with this corrected framing.

3. **Apple's ml-rldf (arXiv:2509.16779, CHI 2026)** — [REVISED framing] The original synthesis called this a "negative result" against fine-tuning. After review: it's a **positive result** (Qwen3-Coder + Sketch beat GPT-5) with a **negative caveat** (prompt-locked per their own README, doesn't generalize). The correct framing: ranking-based RLHF on UI can work for a specific prompt shape, but the resulting model is not a general-purpose "design taste" model. *Still supports the architecture decision: don't try to fine-tune taste into the base model.*

4. **Stripe's Protodash + Linear's harness pattern** — when design tokens + components + reference imagery are machine-readable and pre-injected, the gap collapses by ~80%. The remaining 20% is "last-mile craft," not "no taste." Linear's Nan Yu: *"The magic isn't the model; it's how you build the frame around it."*

### What this means for the user's premise

"Models have knowledge but not judgment" is directionally correct, but the operational reframe is:

> **Mid-tier models don't have a forcing function for revision. The fix is to provide one — via a critic + host-side hook the model must consult, not a knowledge base it may consult.**

This is why "skills are just markdown" feels insufficient. Markdown skills are passive prompt templates loaded once at session start. Mid-tier models weight them like any other instruction and forget them by turn 5. The fix has to be **structural** — invoked at well-defined generation points by code, not by the model's own discipline.

---

## 2. Architecture (Revised)

### [REVISED] The original "active MCP" framing was wrong

The v1 synthesis proposed an "active MCP" — a server that mandates tool calls during generation. **The MCP spec has no such primitive.** MCP is request/response JSON-RPC 2.0; server primitives are `tools`, `resources`, `prompts`, `notifications`, experimental `tasks`. None let the server gate the host's text generation.

The v1 synthesis proposed a "system prompt fragment installed on first contact" as the enforcement mechanism. **That is exactly the failure mode the synthesis criticized** ("skills are passive prompt templates loaded once at session start"). The reviewer correctly called this out as self-contradictory.

### The correct architectural split

```
┌─────────────────────────────────────────────────────┐
│  HOST (Claude Code / Cursor / Windsurf / IDE)       │
│  ─────────────────────────────────────────────────  │
│  • Agent hook fires on session.start                │
│  • Agent hook fires before file write               │
│  • Agent hook fires on session.done                 │
│                                                     │
│  Hook runs a deterministic-check CLI directly       │
│  (shares the MCP server's code), gates on exit      │
│  code, and injects results / brand-spec as context. │
│  This is the enforcement layer. The hook does NOT   │
│  "call MCP tools" — it shells out to a CLI.         │
└──────────────────────┬──────────────────────────────┘
                       │ MCP (stdio / streamable-http)
                       ▼
┌─────────────────────────────────────────────────────┐
│  DESIGN KNOWLEDGE MCP SERVER (passive)              │
│  ─────────────────────────────────────────────────  │
│  Exposes: tokens, critique data, examples,          │
│  a11y rules, render-and-critique (VLM optional)     │
│                                                     │
│  Passive — answers when asked.                      │
└─────────────────────────────────────────────────────┘
```

**The hook is the enforcement layer; the MCP is the data layer.** Precisely: the hook is a shell command that runs the deterministic checks as a CLI and blocks on exit code (or injects context) — it *cannot* itself invoke an MCP tool, because MCP tools are exposed to the *model/host*, not to out-of-band shell hooks. The MCP surface (`require_pattern`, `search_examples`, `render_and_critique`) is called by the model when it chooses, or forced per-turn via harness `tool_choice`. This is the same architecture Cursor/Claude Code hooks already use for linting, formatting, and other "model can't skip" behaviors.

### Enforcement primitives (2026 status)

| Mechanism | Maturity | What it does |
|---|---|---|
| **Claude Code hooks** (`.claude/hooks/`) | GA, well-documented | Run shell commands on tool events; can gate next actions |
| **Cursor hooks** | GA | Similar event-driven hooks |
| **Windsurf events** | Beta | Cascade event hooks |
| **CI / pre-commit / pre-merge bots** | Universal | Post-hoc review; not real-time |
| **MCP `prompts` primitive** | Stable | Server can offer prompt templates — model can choose to use them, cannot enforce |
| **MCP `notifications`** | Stable | One-way push (e.g., "critique available") — model can ignore |
| **MCP experimental `tasks`** | Pre-release | Background tasks, not gates |
| **MCP extension for "gates"** | Doesn't exist | Would require standards-track effort — multi-month, not v1 |

**The realistic path:** Claude Code / Cursor hooks + passive MCP. Anything else is multi-month standards work.

### Control loop (revised)

```
session.start
  ├─ host hook (SessionStart) runs:  design-cli inject-brand-spec
  │     → prints tokens + CSS variables as context (deterministic, no model discretion)
  └─ [optional] harness sets tool_choice to force require_pattern on the first turn

generation (model-driven)
  ├─ model writes code(N)
  └─ model MAY call MCP.require_pattern() / search_examples() / render_and_critique()
        (the model's optional knowledge layer; or forced per-turn via tool_choice)

before each file write  (PreToolUse hook on Write/Edit)
  └─ host hook runs:  design-cli math-audit <file>
        → axe-core / WCAG / APCA / token-lint / spacing-scale, zero-cost
        → exit non-zero + reason  ⇒  BLOCKS the write (model must fix)

session end  (Stop hook)
  └─ host hook runs:  design-cli final-audit
        → token-consistency / a11y thresholds
        → BLOCKS "done" until thresholds pass
```

What makes this enforceable is the **hook running a CLI and gating on exit code** — a process-level check, not model discipline, and *not* an MCP call. The MCP server and `design-cli` share the same check code; the only difference is who invokes it (model vs. hook).

---

## 3. The Critic (Revised: Tiered, Not Single-Model)

### [REVISED] Frontier VLM is NOT adequate as the primary critic

The v1 synthesis proposed Claude Sonnet 4 / GPT-5 vision as the perception-loop critic. **VisJudge-Bench refutes this:**
- GPT-5: MAE 0.551, human correlation 0.429
- Claude-4-Sonnet: MAE 0.618 (worse than GPT-4o's 0.609)
- Best specialized model (VisJudge, fine-tuned Qwen2.5-VL-7B with GRPO): MAE 0.442, correlation 0.681

**No off-the-shelf frontier VLM reaches 0.7+ correlation on design critique.** The UICrit paper itself reported Gemini Pro Vision at only **13.1% valid comments** by designer review. Frontier VLMs are noise generators for this task.

### The tiered critic

```
Tier 0: Mathematical (free, instant, deterministic)
  ├─ axe-core (HTML a11y)
  ├─ WCAG contrast formulas
  ├─ APCA contrast algorithm
  ├─ token-consistency checker (does generated CSS use only spec tokens?)
  └─ spacing-scale validator (does spacing use 4/8/16/24 grid?)

Tier 1: Local fine-tuned critic (no API cost, fast)
  └─ VisJudge-Qwen2.5-VL-7B-GRPO (open weights)
     or self-fine-tune on UICrit + UIClip

Tier 2: Frontier VLM (only when explicitly requested)
  ├─ Output as concrete code diffs, NOT free text
  ├─ Cheap-resolution screenshot (512×512) to bound cost
  └─ Cost: $0.03–0.10/critique at realistic resolution
       For 50 blocks/artifact = $1.50–5.00/artifact
       Realistic dev cost: $50–500/dev/month
```

**Tier 0 catches 60–70% of issues for $0.00.** That's the layer the architecture should be built around. Tier 1 adds another ~15%. Tier 2 is reserved for explicit visual review, not the default loop.

The original synthesis proposed "the killer feature is render_and_critique via VLM." The corrected version: the killer feature is **mathematical audit for free**, with VLM as an opt-in escalation.

---

## 4. Data Sources (Revised After Review)

### [REVISED] UICrit's generalization claim was overclaimed

v1 said UICrit "generalizes to dashboards, B2B SaaS, content sites." **The reviewer caught this.** UICrit source data is **RICO (2017–2018 Android apps, 9.3k apps, 27 categories, 66k screens)**. Pure mobile, 2017–2018 era. Does NOT contain dashboards, B2B SaaS, content sites, iOS, 2020+ design language, information-dense enterprise UIs.

**For v1, the honest scope is: mobile and web apps from 2017–2018 design language.** Dashboards/SaaS requires new data collection or Mobbin licensing — that's a v2 problem, not v1.

### Datasets (corrected and expanded)

| Source | Real | Format | License | Scope | Notes |
|---|---|---|---|---|---|
| **UICrit** | ✓ verified | JSON + bounding boxes | CC BY 4.0 | Mobile Android, 2017–2018 | 11,344 expert critiques; **mobile-web v1 scope only** |
| **UIClip** (arXiv:2404.12500) | ✓ verified | Screenshots + descriptions + scores | Per-paper | 100k+ crawled UIs | Apple/CMU; supports quality scoring + suggestions |
| **Duan et al. iterative prompting** (arXiv:2412.16829) | ✓ verified | Method + critique data | Per-paper | UICrit domain | Direct UICrit follow-up; reduces human gap 50% |
| **A11YN** (arXiv:2510.13914) | ✓ verified | Training data + accessibility labels | Per-paper | Web UIs | 6,800 train + 300 real-world; 60% inaccessibility reduction |
| **VisJudge-Bench** (arXiv:2510.22373, ICLR 2026) | ✓ verified | Benchmark + ground-truth | Per-paper | 3,090 expert-annotated visualizations | Use as evaluation, not training |
| **UIEyes** (Jiang et al., 2023) | Real | Gaze data | Per-paper | 1,980 UIs | Useful for attention/visual hierarchy signals |
| **Owl Eyes** (arXiv:2009.01417) | Real | Display-issue annotations | Per-paper | Mixed | For "what's visually broken" detection |
| **Apple ml-rldf** (arXiv:2509.16779) | ✓ verified | Sketch-feedback preference pairs | Per-paper | Internal Apple | Prompt-locked; methodology reference only |
| **RICO** (source of UICrit) | ✓ | Mobile traces | Per-paper | 9.3k Android apps | The underlying data — useful directly |

### Token / component data (unchanged from v1)

| Source | Real | License | Why |
|---|---|---|---|
| **shadcn/ui** | ✓ | MIT | De facto modern baseline |
| **Tailwind v4 default theme** | ✓ | MIT | Working opinionated token set |
| **IBM Carbon tokens** (`@carbon/themes`) | ✓ | Apache-2.0 | Best machine-readable tokens in OSS |
| **Material 3 (Theme Builder output)** | ✓ | Apache-2.0 | Most-used public design system |
| **Radix Themes tokens** | ✓ | MIT | OKLCH-aware palette |
| **Geist font** | ✓ | SIL OFL 1.1 | Modern default typography |
| **Google Fonts API** | ✓ | OFL/Apache | 1500+ family metadata |

### Figma / pattern data (with caveats)

| Source | Real | Caveat |
|---|---|---|
| **`mcpland/storybook-mcp`** | ✓ verified | Real, active. Closest existing reference pattern. |
| **`mobbin/mobbin-mcp-server`** | ✓ verified | Real; tool surface unverifiable (paywalled docs). Paid subscription required for actual use. |
| **`@grida/refig`** | ✓ verified (v0.0.7, MIT) | Does parse `.fig` files via Skia+WASM. *v1 synthesis incorrectly recommended against `.fig` parsing — the tool works for offline batch processing.* |
| **marvkr/better-design** | ✓ verified | **Real, ships today, 31 brand themes + tokens + WCAG rules + MCP endpoint.** This is the direct competitor. See §6. |

### What to AVOID (unchanged from v1)

- Fine-tuning on UI aesthetics in the base model. Apple's CHI 2026 result proves prompt-locked brittleness.
- Mobbin bulk scraping. Paid + proprietary.
- Apple HIG verbatim. Not redistributable.
- Tailwind UI / Untitled UI templates. Paid, license-controlled.
- Dribbble/Behance scraping for training. License unclear.

---

## 5. MCP Tool Surface (Revised)

### Tools

```python
# Pre-generation — brand spec injected as context by the SessionStart hook (via design-cli);
# also exposed as an MCP tool the model can query directly
require_brand_spec(brand: str | None) -> {
  tokens: DTCG tokens.json,
  components: list[ComponentSpec],
  reference_screenshots: list[ImageRef],
  font_stack: FontStack,
  css_variables: str   # ready-to-inject <style> block
}

# During generation — model-driven (or forced per-turn via tool_choice); NOT hook-invoked
require_pattern(intent: str, context: dict) -> {
  reference_code: str,        # actual TSX/HTML, not description
  tokens_used: list[str],
  screenshot_ref: ImageRef,
  rationale: str
}

# Mathematical audit — run as `design-cli math-audit` by the PreToolUse hook (FREE, FAST);
# also exposed as an MCP tool for model-driven use. This is the enforced tier.
math_audit(html_fragment: str, brand_spec: BrandSpec) -> {
  a11y_violations: list[A11yIssue],     # axe-core
  contrast_failures: list[ContrastIssue], # WCAG + APCA
  token_violations: list[str],           # components using non-spec colors/spacing
  spacing_violations: list[SpacingIssue] # off-scale spacing
}

# Visual critique — model-driven MCP tool, local critic default (NO API COST)
render_and_critique(html_fragment: str, brand_spec: BrandSpec) -> {
  rendered_screenshot: ImageRef,
  issues: list[Critique],     # {severity, category, location, suggestion}
  critic_used: "local"|"vlm",
  cost_usd: float
}

# Pre-shipping — run as `design-cli final-audit` by the Stop hook (MANDATORY gate);
# also an MCP tool. Exit code gates the "done" state.
final_audit(generated_html: str, brand_spec: BrandSpec) -> {
  token_consistency: float,   # 0..1
  a11y_score: float,
  layout_issues: list[LayoutIssue],
  screenshot: ImageRef,
  passes: bool                # gates "done" state
}

# Knowledge queries — always available (model-driven)
search_examples(query: str, modality: "image"|"token"|"component") -> list[Example]
get_color_palette(seed: str, constraints: WCAGConstraints) -> Palette
get_font_pairing(intent: str) -> {heading: Font, body: Font, code: Font}
check_accessibility(html_or_screenshot: str | ImageRef) -> list[A11yIssue]
score_against_reference(generated: ImageRef, reference: ImageRef) -> Score
```

### What changed from v1

- **Added `math_audit`** as the always-on free tier. This is now the primary defense.
- **`render_and_critique` now defaults to local critic** (VisJudge-Qwen2.5-VL-7B-GRPO or similar), with frontier VLM as explicit opt-in. Cost-aware (`cost_usd` field).
- **Removed "perception loop via frontier VLM" as the killer feature.** The killer feature is the math tier, which catches 60–70% of issues for $0.00.

---

## 6. The Competitive Landscape (Revised)

### [REVISED] The opening is more crowded than v1 implied

The v1 synthesis undersold `marvkr/better-design`. After review:

**marvkr/better-design** (real, ships today):
- 31 brand-themed shadcn/ui registries
- Design tokens
- WCAG review rules
- MCP remote endpoint at `better-design.com/api/mcp`
- Free tier exists; paid tier for full brand library

This is essentially the v1 proposal, already in the market. Differentiation requires one or more of:

1. **Deeper critique data than UICrit** — but UICrit is the best open dataset. To go deeper, build a UICrit successor covering 2020+ UIs and dashboards. That's a research project, not an MVP.
2. **Faster/cheaper critic than frontier VLM** — already addressed by the local VisJudge critic. This is real differentiation.
3. **Real enforcement story** — better-design is a passive MCP. The agent-hook enforcement layer is genuine differentiation.
4. **Open-data posture** — better-design's 31 themes are curated but opaque. An MCP that exposes provenance (UICrit citations, Carbon token lineage) is differentiated for users who care about reproducibility.

**The honest positioning:** "An open-data, enforcement-backed, math-first Design Knowledge MCP for AI-assisted UI generation, with local critic for visual review." That's defensible.

### [ADDED — second review] The render→critique→revise loop is already shipping

The revision above still treats critique-with-a-feedback-loop as an open lane. The web-verified review found it is not:

- **`zueai/frontend-review-mcp`** — before/after screenshot → VLM critique → pass/fail-with-reason the agent acts on. Free, BYO Hyperbolic key. This *is* the render-and-critique loop, already an MCP.
- **`haasonsaas/design-critique-mcp`** — already exposes the Tier-0 surface (`critique_design`, `analyze_color/layout/typography/accessibility`, `check_color_contrast`) via sharp/chroma-js/Tesseract. Immature (~6★, static-image only) but occupies the exact niche.
- **Claude Design** (Anthropic Labs, launched 2026-04-17, Opus 4.7) — reads your codebase/design files, "builds with your components, checks its output against your design system, and makes corrections before you see it," with `/design-sync` (June 2026). Render→critique→revise **plus** enforcement, native to the host, **no MCP required.** The biggest strategic threat: the platform is absorbing the loop.
- **`@storybook/addon-mcp`** — now the *official* Storybook server (Storybook 10.3, free/OSS), with a self-healing generate→test→fix loop + a11y checks. (The revision above cited only the weaker community `mcpland/storybook-mcp`.)
- **Figr** ($0/$19/$24) — bakes WCAG guardrails into *generation* (prevention, not lint).

**Consequence:** the loop is table stakes, not a differentiator. The defensible seam narrows to **open-data/provenance posture + real hook/CI enforcement + the free math tier + scope discipline.** Lead positioning with those, not with "render-and-critique."

### Adjacent competitors (corrected)

- **marvkr/better-design** — closest direct competitor (see above); passive, opaque curated themes.
- **Mobbin MCP** (official, May 2026, 621k screens, paid) — owns inspiration-search; removes `search_examples` as a differentiator.
- **`@storybook/addon-mcp`** (official) — component grounding + self-healing test loop.
- **shadcn official MCP** — owns component grounding.
- **Figma MCP** (official) — full token/component/variable read/write on **paid Dev/Full seats at normal per-minute rate limits**; the "6 calls/month" cap applies **only to free/View seats** (developers.figma.com/docs/figma-mcp-server/rate-limits-access). *(The earlier revision overstated this as a blanket cap.)*
- **`YonasValentin/design-inspiration-mcp-server`** — Serper over Google Images, low quality.

---

## 7. Buildable Timeline (Revised: 15–20 Working Days)

The v1 timeline was 5 days. The reviewer correctly flagged this as optimistic — license audit alone is 1–2 days, VLM integration is 2–3 days, eval methodology is unspecified. Realistic timeline — **but gated on Day 0 below.**

### Day 0 (GATE): The Falsification Experiment — run BEFORE Week 1

The entire product rests on one untested assumption: **a mid-tier model can act on a correct, specific critique and improve across rounds without regressing.** If that is false, no MCP/hook plumbing helps. Test it in one day, no server code:

1. MiniMax-M3 (the target model) generates **~25 UIs** across 3–4 brief types (pricing page, settings panel, dashboard card, mobile list), against **one hardcoded shadcn brand spec**.
2. Render each with Playwright → screenshot + computed styles.
3. Produce a **gold critique** per artifact: deterministic linters (axe-core + WCAG/APCA + token/spacing) **plus** one human designer pass. Separately produce a **frontier-VLM critique** (structured, not zero-shot) for the gestalt residue.
4. Feed screenshot + gold critique back to the model; ask for a revision. **Repeat 3+ rounds.**
5. Measure per round: contrast pass %, token-adherence %, axe count, spacing-scale adherence — plus a **blind A/B** (designer picks round-0 vs round-N) — and track **regressions** explicitly (did fixing contrast break layout?).

**Decision tree:**
- **Cannot act on gold critique** (metrics flat/worse) → **build nothing as a product**; ship the deterministic linter as a standalone CI gate at most.
- **Acts but regresses** → **build the hook + deterministic-lint layer only**, with a hard "don't-regress" gate (block the write if any previously-passing check now fails). MCP stays a passive knowledge layer. *Most likely outcome; matches the honest architecture.*
- **Acts and holds** (monotonic improvement, A/B favors round-N, no regressions) → **core de-risked**; proceed to the Week 1–3 build below, scoped mobile-only.

One day, one model, ~25 artifacts, zero server code — it resolves the make-or-break question the 15–20 day plan otherwise doesn't touch until Day 17.

### Week 1: Data + skeleton

- **Day 1–2: License audit + data harvest.** Clone ~30 design-system repos, download UICrit + UIClip + Duan et al. data + A11YN, pull Google Fonts API snapshot. License audit is the time-sink.
- **Day 3: Token normalization.** Convert all SCSS/CSS/JSON tokens to DTCG via Style Dictionary v5 + sd-transforms. Build brand-spec registry: shadcn-default, carbon-default, material-3-default.
- **Day 4–5: MCP server skeleton (passive).** Node.js or Python MCP server with stdio transport. Implement `require_brand_spec`, `require_pattern`, `math_audit`, `final_audit`, `search_examples`. Tier 0 only.
- **Day 6–7: Hook integration.** Write the Claude Code / Cursor hook that auto-invokes the tools at session.start, on file write, on session.done. Test on three briefs: pricing page, dashboard, settings panel.

### Week 2: Critique + critic

- **Day 8–10: Tier 0 hardening.** Wire axe-core, APCA, WCAG contrast, token-consistency checker, spacing-scale validator. Coverage tests.
- **Day 11–12: Local critic (Tier 1).** Download VisJudge-Qwen2.5-VL-7B-GRPO weights, wire to `render_and_critique` as default. Add screenshot via Playwright. Cache by content hash.
- **Day 13: Frontier VLM (Tier 2, opt-in).** Add Claude/GPT-5 vision path with cost cap. Output as code diffs.
- **Day 14: Eval methodology.** Concrete rubric: token-consistency ratio, WCAG pass rate, designer A/B (n=3 designers × 5 artifacts).

### Week 3: Polish + adversarial eval

- **Day 15–16: Documentation + brand-spec UI.** README, docs site, brand-spec selector interface.
- **Day 17–18: Internal adversarial eval.** Designer review of 10 artifacts generated with vs without MCP.
- **Day 19–20: External eval prep.** ADVERSARIAL-EVAL-v2.md, methodology doc, ship checklist.

### What ships NOT in v1 (unchanged)

- Dribbble/Behance ingestion (license + bot protection).
- Dashboards/SaaS critique data (requires new dataset, v2 problem).
- Fine-tuned mid-tier model with embedded taste (Apple proved brittle).
- Real-time production-grade latency optimization.
- Multi-tenant brand specs.

---

## 8. Open Questions for You (Action Required)

The reviewer surfaced three decisions that change the architecture. These need answers before engineering starts.

### Q1: User domain (v1 scope)

**Mobile web only** (where UICrit applies, mobile 2017–2018 design language)?
- Pros: data is ready, marvkr is the only direct competitor
- Cons: narrow scope, leaves dashboards/SaaS as v2

**Mobile + dashboards + SaaS** (what v1 synthesis implied)?
- Pros: larger market
- Cons: requires new dataset (RICO doesn't cover; Mobbin license required), 6–12 month data-collection project

**Recommendation: ship v1 as mobile-web only.** Add dashboards/SaaS in v2 after either collecting new critique data or licensing Mobbin.

### Q2: Enforcement tolerance

**Post-hoc review only** (CI hook / pre-commit)? Shippable now.
**Real-time during generation** (Claude Code hook)? Requires hook integration, shippable in week 2.
**Both**? Adds complexity but covers more use cases.

**Recommendation: real-time during generation via Claude Code / Cursor hooks** — *with a caveat from the second review.* Because the host platform is absorbing real-time critique (Claude Design's `/design-sync`), the real-time lane is the one most likely to be commoditized by the platform. The **post-hoc CI gate** is less flashy but more defensible and shippable now, and it's the honest home for the enforced deterministic tier (which runs as a CLI regardless). Revised recommendation: **ship the CI/pre-commit gate first (deterministic, uncontested), add the real-time hook second.**

### Q3: Cost / business model

**Local-only** (Tier 0 + Tier 1, no API cost)? Free to run; limits visual critique quality.
**Remote MCP with metered billing** (marvkr's model)? Sustainable; requires billing infra.
**Tiered — local default, VLM opt-in with user-provided API keys**? Lower friction; user controls cost.

**Recommendation: tiered with user-provided API keys for v1.** No billing infra needed. Marbvr's billing model is v2 once usage justifies it.

---

## 9. Honest Limits (Unchanged)

This proposal will not:
- Make a mid-tier model produce Linear/Stripe-grade output unaided.
- Replace a senior designer's judgment on novel problems.
- Solve deep information architecture — that's a product problem.
- Generate genuinely new design language (it can only recombine existing).
- Work without a brand spec — "make it look good" is not a target.

This proposal will:
- Force Tier 0 mathematical audit on every block (catches contrast, a11y, token inconsistencies, off-scale spacing).
- Force pattern lookup via host hook before component generation.
- Bring mid-tier output from "training-data centroid" to "competent baseline that a designer can edit in 20 minutes."
- Make frontier models measurably better by removing the need for them to recall token syntax from memory.

---

## 10. What Changed From v1 (Summary)

| Section | v1 Claim | Revised Claim | Why |
|---|---|---|---|
| §1 Failure mode | "Mid-tier fails because no perception loop" | "Mid-tier ships first guess because nothing forces revision" | Apple ml-rldf counter-example |
| §2 Architecture | "Active MCP" with system prompt fragment | Passive MCP + host-side agent hook | MCP has no enforcement primitive |
| §3 Critic | Frontier VLM is adequate | Tiered: math (free) + local critic + VLM opt-in | VisJudge-Bench refutes frontier-VLM adequacy |
| §4 Data | UICrit generalizes to dashboards/SaaS | UICrit is mobile-Android 2017–2018 only | Source data is RICO |
| §5 Tools | render_and_critique is the killer feature | math_audit is the killer feature (free, instant) | Math catches 60–70% of issues for $0 |
| §6 Competition | marvkr/better-design mentioned briefly | marvkr is a direct competitor; differentiation needs explicit story | Reviewer caught the underweighting |
| §7 Timeline | 5 days | 15–20 working days | License audit, VLM integration, eval methodology not accounted for |
| Citations | Several cited with imprecise framing | All citations verified; two refuted/reframed (Ghiasvand, Apple ml-rldf) | Reviewer caught misdescription |
| §2 Hook mechanism | "hook calls MCP tools" | Hook runs a deterministic CLI and gates on exit code; cannot invoke MCP tools | Second review — hooks are out-of-band shell |
| §6 Competition | marvkr is the one direct competitor | The whole loop already ships (frontend-review-mcp, design-critique-mcp) and the host absorbs it (Claude Design) | Second, web-verified review |
| §7 Timeline | 15–20 days, no gate | 15–20 days **gated on a Day-0 falsification experiment** | Second review — core assumption untested |
| Figma MCP | blanket "6 calls/month" cap | 6/month is free/View seats only; paid seats get normal limits | Second review corrected the fact |

---

## 11. Why This Is Still the Right Time

Three converging conditions make this buildable now in a way it wasn't 12 months ago:

1. **MCP transport is mature.** Official servers from Figma, Anthropic, Vercel. The protocol has settled — even if enforcement has to live in the host hook, the data layer is well-defined.
2. **Mathematical audit tooling is production-grade.** axe-core, APCA, WCAG contrast — all free, all fast, all deterministic.
3. **Open critique data exists.** UICrit + UIClip + A11YN, all machine-readable, all with permissive licenses. The dataset foundation wasn't available in 2024.
4. **Host-side hooks are mature.** Claude Code, Cursor, Windsurf all expose event hooks that can gate generation. This wasn't the case 18 months ago.

The window is open. Build with the revised architecture.

---

*End of revised synthesis. See `ADVERSARIAL-REVIEW.md` (first review) and `EVALUATION.md` (second, web-verified review + Day-0 falsification protocol) for the full reviews that drove these revisions.*