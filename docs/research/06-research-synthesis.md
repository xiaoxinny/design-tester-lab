# Design Knowledge MCP — Comprehensive Research

**Document type:** Background research synthesis
**Date:** 2026-07-12
**Status:** Research document — synthesizes 5 parallel research streams
**Companion docs:** `SYNTHESIS.md` (architecture proposal), `ADVERSARIAL-REVIEW.md` (adversarial review)

---

## TL;DR

This document is the full research foundation for a Design Knowledge MCP that produces **principle-adherent design deliverables** — not just code, but the complete artifact bundle a senior designer would produce. It synthesizes five parallel research streams:

1. **The complete artifact taxonomy** — what a senior designer actually delivers for one product surface (22 artifact types across 5 layers).
2. **Codified design principles** — exact WCAG numbers, type scales, grid systems, color theory, motion tokens, density rules. With machine-checkability tags.
3. **The Design Constitution schema** — a four-tier YAML structure (hard rules, soft rules, aesthetic dispositions, brand-specific) that mid-tier models like MiniMax-M3 can actually follow.
4. **Evaluation rubrics** — 13 academic benchmarks surveyed; a composite **Design Quality Score (DQS)** formula with 10 machine-checkable sub-scores.
5. **The AI design tool gap** — v0, Bolt, Lovable, Galileo, Figma Make, Claude Design all produce *one artifact type* (HTML/JSX). The deliverable bundle is what they skip.

The opening: **a Design Knowledge MCP that emits the whole 22-artifact bundle, gated by the four-tier Constitution, scored by DQS, and consumable by MiniMax-M3-and-above models via Critique-out-Loud loops.**

---

## Part 1 — The Complete Design Deliverable Taxonomy

### 1.1 The Gap

Today's AI tools (v0, Claude Design, Figma Make, Galileo, Lovable, Bolt) emit **HTML/JSX**. That's *one* artifact. A real design deliverable is a **bundle of ~22 artifact types** spanning tokens, components, motion, prototype, content, accessibility, IA, and machine-readable schemas.

| Dimension | AI tools (v0/Claude Design/Figma Make) | Senior designer / design system team |
|---|---|---|
| **Output format** | Single React/HTML file | 22+ distinct artifact files |
| **Tokens** | Inline Tailwind/CSS values; no exportable token layer | W3C DTCG `.tokens.json`, multi-platform export via Style Dictionary |
| **Components** | One ad-hoc JSX per surface | Reusable library with **all variants × all states** + Storybook CSF stories |
| **States** | Static default only | State matrix: default, hover, focus, active, disabled, loading, error, success, empty, selected, indeterminate, read-only |
| **Theming** | Hardcoded light | Light + dark via semantic token aliases |
| **Motion** | None, or hardcoded `transition` strings | Motion spec: durations + easing curves + named effects + per-component animation |
| **Accessibility** | Best-effort markup | WCAG 2.2 AA annotations: contrast matrix, focus rings, target size, keyboard flow, ARIA map |
| **Documentation** | Code comments | spec.md, anatomy diagram, MDX in Storybook, Zeroheight |
| **Prototype** | The HTML itself runs | Interactive prototype with triggers, transitions, animations, variable-driven states |
| **IA / Flow** | None | Sitemap, user flow, edge-case flow, error flow |
| **Voice & Tone** | Lorem-style filler | Voice & tone guide, microcopy library, content guidelines per component |

**The point:** AI tools emit the *body*. A design deliverable is the body **plus the operating manual** — the system that lets other designers and engineers reproduce, extend, theme, test, and trust it.

### 1.2 The 22-Artifact Bundle (5 Layers)

**Layer A — Foundations (8):** Color, Typography, Spacing, Elevation, Radius, Motion, Iconography, Breakpoints — all as **W3C DTCG tokens** that compile to every platform via Style Dictionary.

**Layer B — Components (4):** Library, State matrix, Anatomy diagram, Component specification ("spec.md") — with Storybook CSF 3 stories as the live, testable form.

**Layer C — Surface (4):** Wireframes, High-fi mockups (every state × every breakpoint), Interactive prototype (Figma + Storybook), Exported assets.

**Layer D — Systems (3):** Information architecture (sitemap + user flow), Voice & tone / microcopy, Accessibility annotations (WCAG 2.2 AA + a11y test report).

**Layer E — Governance (3):** Contribution model, Changelog, Adoption metrics.

### 1.3 Schemas (canonical references)

| Artifact | Canonical spec | URL |
|---|---|---|
| Design tokens | W3C DTCG Format Module (2025.10 draft) | https://www.designtokens.org/tr/drafts/format/ |
| Component stories | Storybook CSF 3 / CSF Next | https://storybook.js.org/docs/api/csf |
| Component docs | Storybook MDX | https://storybook.js.org/docs/writing-docs/mdx |
| shadcn component | `components.json` + `registry-item.json` | https://ui.shadcn.com/docs/components-json |
| Accessibility | WCAG 2.2 (W3C Recommendation) | https://www.w3.org/TR/WCAG22/ |
| Component specification | Nathan Curtis / EightShapes pattern | https://medium.com/eightshapes-llc/component-specifications-1492ca4c94c |
| Token build | Style Dictionary v4/v5 / Terrazzo | https://styledictionary.com · https://terrazzo.app |
| Prototyping | Figma prototyping + Smart Animate | https://help.figma.com/hc/en-us/articles/360040314193 |

### 1.4 Priority stack for what an MCP should generate

| Priority | Artifact | Why |
|---|---|---|
| **P0** | A1 Color tokens, A3 Spacing tokens, A6 Motion tokens | Without tokens nothing is themeable or portable |
| **P0** | A2 Typography system | Type drives layout |
| **P0** | B1 Component library, B2 State matrix, B4 spec.md | Surfaces are compositions; without states the surface is untestable |
| **P1** | A4 Elevation, A5 Radius, A7 Icons, A8 Breakpoints | Visual system coherence |
| **P1** | C1 Wireframes, C2 High-fi mockups, C3 Prototype | IA validation, visual artifact, testable prototype |
| **P1** | D1 IA, D2 Voice & tone, D3 A11y annotations | Non-negotiable for production |
| **P2** | D4 Multi-platform token export | Web + iOS + Android + Tailwind |
| **P3** | E1–E3 Governance | Required when >2 teams consume |

---

## Part 2 — Codified Design Principles (the machine-checkable subset)

Full catalogue at `/home/xiaoxin/design-principles-research/CODIFIED_DESIGN_PRINCIPLES.md` — 519 lines, ~7,200 words, 184 explicit machine-checkability tags. The catalogue uses a standardized taxonomy for every rule:

- **`MC:Y`** — deterministic from DOM/CSS/tokens/assets or instrumented runtime (linter can check)
- **`MC:P`** — some prerequisites or proxies are deterministic; meaning/context requires review (lint + critique)
- **`MC:N`** — fundamentally a judgment/research principle (VLM or human only)
- **`NORM`** — normative standard / conformance requirement
- **`SYSTEM`** — codified by a design system; binding only when that system is selected
- **`HEUR`** — useful heuristic, not a universal pass/fail law

A principle-adherent MCP should never present a house rule (e.g., an 8-point grid) as WCAG. It should return the rule's provenance, applicability, exceptions, measured evidence, and confidence. Summary below.

### 2.1 Sources surveyed (21)

WAI / WCAG 2.2 (Rec. 12 Dec 2024, 87 success criteria, 9 new in 2.2) · WCAG 3 / W3C Silver draft + APCA · Material Design 3 (foundation + expression) · Apple HIG · IBM Carbon · Atlassian DS · Shopify Polaris · Vercel Geist · Linear Method (Saarinen, Yu) · Stripe Press / Owen Williams · Refactoring UI (Wathan, Schoger) · Rendle / van Schneider / Chimero (judgment essays) · Laws of UX (Yablonski) · Krug · Norman · Lupton · Müller-Brockmann · Universal Principles of Design (125) · ISO 9241 (touchscreen: 12–14mm min, 20–24mm recommended) · Dieter Rams' 10 · NN/g 10 heuristics.

### 2.2 The codified numbers (extracted)

**WCAG 2.2 AA hard floor:**
- Text contrast ≥ **4.5:1** (1.4.3) · large text ≥ 3:1
- Non-text / UI contrast ≥ **3:1** (1.4.11)
- Focus indicator ≥ **2 CSS-pixel-thick perimeter** AND ≥ **3:1** contrast (2.4.13)
- Touch target ≥ **24×24 CSS px** with spacing exception (2.5.8)
- Reflow at **320 CSS px** width (1.4.10) · resize to 200% (1.4.4)

**APCA (WCAG 3 candidate):**
- Body text: Lc 75 (use), 60 (fluent), 45 (spot)
- Content: Lc 60 (use), 45 (min)
- Non-text: Lc 45 (spot), 30 (thin)

**Apple HIG:** 44×44 pt tap target · 60 pt content margin · 11pt min legible · 0.35s default SwiftUI animation · semantic colors (systemBackground, label, etc.) · `accessibilityReduceMotion` honored

**Material 3:** 4dp baseline grid · 48×48 dp tap · 6 elevation levels (0/1/3/6/8/12) · **30 type styles** (Display/Headline/Title/Body/Label × L/M/S) · 8 motion durations (Short1 50ms → ExtraLong2 600ms) · 6 motion easings · banned-words list

**IBM Carbon:** 2× mini-unit grid · 6 motion durations (70/110/150/240/400/700 ms) · 4 easings · 10-step neutral ramp · IBM Plex type scale (12→96 in 2px steps)

**Atlassian DS:** 8-pt base (`space.100` = 8px) · 13 spacing tokens (.025→.1000) · 4 layout rules (similarity, proximity, hierarchy, rhythm) · 7 elevation levels (0/2/4/8/12/16/24) · 3 density modes

**Polaris:** 8-pt scale · microcopy ruleset (sentence case, banned words, error template, ≤8th-grade reading) · 3 depth modes (Flat/Raised/Floating) · icon stroke 1.5px

**Geist:** 4-px base · OKLCH 12-step color ramps · **single 150ms motion curve** (cubic-bezier(0.16, 1, 0.3, 1)) · 7 type sizes (12/13/14/16/18/24/40)

**Refactoring UI:** 5–7 spacing sizes · 2 typefaces max · 4–5 type sizes · 45–75 char line length · no pure black/white (tinted neutrals) · two-tone shadow (positive + negative) · opacity not gray for disabled

**ISO 9241-161:** target **12–14mm min / 20–24mm recommended**

### 2.3 The ~70–80 machine-checkable rules (by category)

| Category | Count | Examples |
|---|---:|---|
| **MC-A11Y** (Accessibility) | 20 | contrast, target size, focus, reflow, semantic HTML, alt text, lang, skip-nav, autocomplete, reduced-motion, focus-not-obscured |
| **MC-TOK** (Design tokens) | 10 | spacing scale, color palette, font scale, typefaces ≤ 2, radius, elevation, motion duration/easing, border widths, z-index |
| **MC-TYP** (Typography) | 6 | line length 45–75 chars, line-height ≥ 1.4×, min body 14px, scale ratio 1.2–1.618, baseline grid |
| **MC-LAY** (Layout) | 9 | grid snap, 1 primary CTA, safe area, 8dp spacing, hierarchy depth, proximity, responsive breakpoints, density modes |
| **MC-CLR** (Color) | 8 | tinted neutrals, dark-mode hue-tint, ≤ 2 accents, no color-only state, OKLCH preferred, ≥ 2 indicators per state |
| **MC-MOT** (Motion) | 8 | ≤ 4 durations, ≤ 3 easings, ease-out entrance, prefers-reduced-motion, Doherty 400ms, Norman 100ms feedback, no motion > 500ms |
| **MC-CON** (Content) | 14 | sentence case, no terminal period, banned words, Flesch-Kincaid ≤ 8, error template (what + why + how-to-fix), second person |
| **MC-IA** (Information architecture) | 7 | nav consistency, icon consistency, depth ≤ 3, chunks ≤ 7, options ≤ 7, Fitts reach |
| **MC-CMP** (Components) | 5 | 1 primary button, labeled inputs, confirm+undo destructive, icons ≥ 16px with labels, disabled vs hidden |
| **Total** | **~87** | |

### 2.4 Judgment principles (cite, don't lint)

Aesthetic-Usability Effect · Rams #3 (aesthetic) / #5 (unobtrusive) / #7 (long-lasting) · "make the important obvious" · Saarinen #7 (functional clarity) / #8 (formgiving) / #10 (proportionality) · Chimero's "the grass" · van Schneider's "magazine" · density optimization · brand consistency · tone calibration · every-visual-choice-has-a-reason.

### 2.5 Existing tools mapped to rules

| Tool | Coverage |
|---|---|
| **axe-core** | ~90 WCAG rules |
| **eslint-plugin-jsx-a11y** | A11y + semantic HTML |
| **stylelint-a11y** | CSS a11y |
| **stylelint-declaration-strict-value** | Token enforcement |
| **colorable / apca-w3 / bridge-pca** | Contrast + APCA |
| **@axe-core/playwright** | A11y in Playwright |
| **storybook-addon-a11y** | A11y in Storybook |
| **vale.sh** | Microcopy + banned words |
| **Polypane / Stark** | A11y preview |

### 2.6 Top 20 Most-Impactful Principles (ranked)

1. Text contrast ≥ 4.5:1 (WCAG 1.4.3) — legal floor
2. Non-text contrast ≥ 3:1 (WCAG 1.4.11)
3. Touch target ≥ 24×24 / 44×44 / 48×48 (WCAG 2.5.8, HIG, MD3)
4. Focus appearance ≥ 2-CSS-px + 3:1 (WCAG 2.4.13)
5. Spacing scale from tokens (Carbon / Atlassian / MD3)
6. Semantic HTML (WCAG 1.3.1, 4.1.2)
7. One primary CTA per section (Refactoring UI, HIG)
8. Line length 45–75 chars (Refactoring UI, Lupton)
9. ≤ 2 typefaces, ≤ 5 sizes, ratio 1.2–1.618 (Refactoring UI, Geist, Lupton)
10. Tinted neutrals; ≤ 2 accents; ≥ 2 indicators (Refactoring UI, WCAG 1.4.1)
11. ≤ 4 motion durations, ≤ 3 easings, reduced-motion (MD3, HIG)
12. Proximity: related closer than unrelated (Gestalt)
13. Group by similarity (Gestalt, Atomic Design)
14. Miller's 7±2 / Hick's Law (decision points per screen)
15. Semantic colors + dark-mode strategy (HIG, MD3, Geist)
16. Hierarchy: 3 emphasis levels (Refactoring UI, Gestalt)
17. Error message: what + why + how-to-fix (Polaris, WCAG 3.3.1)
18. Sentence case + banned words + no terminal period (Polaris, Stripe)
19. prefers-reduced-motion + 400ms Doherty + 100ms feedback (a11y, Doherty, Norman)
20. Reflow at 320 CSS-px + resize to 200% (WCAG 1.4.10, 1.4.4)

### 2.7 Machine-checkable vs judgment principle split

| Type | Example | Validator |
|---|---|---|
| Boolean / numeric | WCAG 4.5:1 contrast | axe-core, APCA, stylelint |
| Structural | 8-pt grid adherence | stylelint-declaration-strict-value |
| Token rule | No raw hex values | custom linter |
| Semantic HTML | h1 → h2 → h3 no skip | html-validate |
| Cognitive load | ≤ 7 choices per screen (Hick) | DOM count |
| Aesthetic | Restraint, breathing room | VLM critique |
| Brand voice | "Use cobalt, not red, for primary" | RAG-loaded brand spec |
| Taste | "This feels off" | Human review |

### 2.8 Schema sketch (YAML)

The canonical schema uses the six-tag taxonomy (`MC:Y`/`MC:P`/`MC:N`/`NORM`/`SYSTEM`/`HEUR`) so the model and the MCP share a vocabulary for what's deterministic vs judgment:

```yaml
- id: MC-A11Y-01
  title: "Text contrast >= 4.5:1"
  category: accessibility
  severity: critical
  sources: ["WCAG 1.4.3", "axe-core color-contrast"]
  checkability: MC:Y    # MC:Y | MC:P | MC:N | NORM | SYSTEM | HEUR
  provenance: NORM       # normative standard, not a house rule
  rule:
    type: contrast         # contrast | token-in-set | count | range | pattern | semantic
    value: 4.5
    unit: ratio
  exceptions:
    - "Large text (>= 18pt regular or >= 14pt bold): 3:1"
  enforcement:
    tools: ["axe-core", "stylelint-a11y", "APCA"]
    auto_fix: false
    judgment_required: false
  tier: 1                 # 1=hard linter, 2=lint+critique, 3=VLM, 4=brand
  examples:
    pass: "Body text #1F2937 on #FFFFFF = 16.1:1"
    fail: "Body text #9CA3AF on #FFFFFF = 2.85:1"

- id: MC-MOT-01
  title: "Motion durations limited to <= 4"
  category: motion
  severity: moderate
  sources: ["Material 3 motion tokens", "Apple HIG"]
  checkability: MC:Y
  provenance: SYSTEM      # binding when MD3 or HIG is the chosen system
  rule:
    type: count
    value: 4
  enforcement:
    tools: ["stylelint-declaration-strict-value"]
  tier: 2

- id: MC-AES-01
  title: "Restraint: every element earns its place"
  category: aesthetic
  severity: minor
  sources: ["Rams #10", "Refactoring UI"]
  checkability: MC:N      # judgment-only
  provenance: HEUR
  rule:
    type: semantic
    value: "audit element list per view; remove if non-essential"
  enforcement:
    tools: ["vlm-critique"]
    judgment_required: true
  tier: 3
```

The compliance-report contract that should accompany every audit:

```json
{
  "rule_id": "MC-A11Y-01",
  "checkability": "MC:Y",
  "result": "pass" | "fail" | "inapplicable" | "needs-review",
  "evidence": { "selector": ".btn-secondary", "computed": "color: #9CA3AF on #FFFFFF = 2.85:1" },
  "exception_applied": null,
  "confidence": 0.99,
  "provenance": "NORM",
  "fix_suggestion": "Change to #595959 (7.0:1)"
}
```

---

## Part 3 — The Design Constitution Schema

### 3.1 The four-tier model

Principles are not all the same kind of thing. A single flattened "constitution" of prose fails on every tier that needs deterministic checking, and gives no signal to the tiers that need critique.

| Tier | Principle kind | Validator | Enforcement |
|---|---|---|---|
| **1** | Hard rule (boolean / numeric) | Linter, type checker, schema validator | *Outside* the model — output rejected if invalid |
| **2** | Soft rule (structural) | Lint rule + critique prompt | Lint fails → revise; critique misses → VLM pass |
| **3** | Aesthetic disposition | VLM critique (vision-language model) | Critique-revise loop until stable or N iters |
| **4** | Brand-specific | Per-project loaded spec | RAG into context per request |

The model is *one* enforcement layer among several. A model that never produces Tier-1 violations (because the linter catches them) is more reliable than a model that "remembers" WCAG — and the linter is 10⁴× cheaper than the model's attention.

### 3.2 The Constitution YAML schema

```yaml
meta:
  id: "design-constitution.v1"
  name: "Acme Design Constitution"
  version: "1.4.0"
  inherits: ["w3c-design-tokens-format-module@1", "wcag-2.2-aa"]
  applies_to:
    file_patterns: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.css", "**/*.html"]
    frameworks_any: ["react", "next", "remix", "vue", "svelte"]
    min_model_capability: "tier-2-plus"
  maintainer: "design-systems@acme.com"

tier_1_hard_rules:
  accessibility:
    contrast_minimum: 4.5
    contrast_large_text: 3.0
    keyboard_navigable: true
    aria_required_for: ["button", "dialog", "menu", "tab", "tooltip"]
    alt_text_required: true
    focus_visible_required: true
    enforce_via: ["eslint-plugin-jsx-a11y", "axe-core", "@axe-core/playwright"]
  token_usage:
    no_raw_color_values: true
    no_inline_styles: true
    no_magic_spacing: true
    no_arbitrary_tailwind: true
    only_spec_tokens: true
    enforce_via: ["stylelint", "tailwind.config.js whitelist"]
  semantic_html:
    heading_hierarchy_strict: true
    landmark_elements_required: ["header", "nav", "main", "footer"]
    interactive_elements_semantic: true
    enforce_via: ["eslint-plugin-jsx-a11y", "html-validate"]

tier_2_soft_rules:
  grid:
    base_unit: 8
    spacing_scale: [4, 8, 12, 16, 24, 32, 48, 64, 96]
    enforce_via: ["stylelint-declaration-strict-value", "eslint-plugin-tailwindcss"]
    critique: |
      Verify all margins, paddings, and gaps are multiples of 4 (preferably 8).
      Items closer than 8px should suggest "these belong grouped."
    critique_failure_pattern: "non-grid spacing"
  typography:
    type_scale_ratio: 1.25
    base_size: 16
    scale: [12, 14, 16, 20, 25, 31, 39, 49]
    line_height_body: 1.5
    line_height_heading: 1.2
    critique: |
      Hierarchy should be visible through size AND weight, never size alone.
      Three font sizes per screen maximum; size jumps should follow the scale exactly.
  hierarchy:
    one_primary_action_per_view: true
    secondary_elements_max: 3
    tertiary_collapsed_default: true
  density:
    whitespace_target: [0.40, 0.60]
    list_items_default_max: 5
    dashboard_cards_max: 8

tier_3_aesthetic:
  restraint:
    disposition: "Lean toward fewer elements. Every element must earn its place."
    critique_prompt: |
      Does each element serve the user's immediate goal? If an element can
      be removed without losing core value, remove it.
  alignment:
    disposition: "Edges align across the entire composition. Optical alignment beats mathematical alignment for text."
  rhythm:
    disposition: "Spacing creates visual cadence. Varied but predictable."
  breathing_room:
    disposition: "Negative space is not wasted space. Generous margins around primary content."
  visual_hierarchy:
    disposition: "The most important thing is most prominent — by size, weight, position, AND color."
  anti_patterns:
    - { pattern: "Show everything at once", correction: "Progressive disclosure; collapse tertiary" }
    - { pattern: "Heavy card borders / drop shadows", correction: "Subtle background contrast, no border" }
    - { pattern: "Multiple competing CTAs", correction: "One primary, others demoted to text/secondary" }
    - { pattern: "Decorative empty states (big illustrations)", correction: "Actionable guidance + primary action" }
    - { pattern: "Spinner for all loading", correction: "Skeleton matching content shape" }
    - { pattern: "Duplicate nav (sidebar AND card)", correction: "Single source of truth per destination" }

tier_4_brand:
  brand_identity:
    product_name: "Acme Cloud"
    audience: "B2B engineering teams"
    density: "high"
    tone: "technical, precise, calm"
    voice_principles:
      - "Say what the thing is. No marketing fluff."
      - "Numbers over adjectives."
      - "Active voice; present tense."
  visual_identity:
    primary_color: "{color.brand.cobalt}"
    accent_strategies:
      - "Red is reserved for destructive action only."
      - "Cobalt = brand; never decorative."
    typography: { heading: "Acme Sans", body: "Acme Sans", mono: "JetBrains Mono" }
  component_decisions:
    data_tables: { row_height: 40, zebra_striping: false }
    navigation: { pattern: "persistent-left-rail", collapse_below: 1024 }
    dialogs: { max_width: 720, default_to_sheet: false }

validation_pipeline:
  order:
    - { tier: 1, mechanism: "linter", blocking: true, on_failure: "reject and regenerate" }
    - { tier: 2, mechanism: "lint + critique", blocking: "soft", on_failure: "revise up to 3 iterations" }
    - { tier: 3, mechanism: "VLM critique", blocking: false, on_failure: "revise up to 2 iterations; log for human review" }
    - { tier: 4, mechanism: "brand-spec match (retrieval)", blocking: "soft", on_failure: "warn + flag for designer review" }
  self_refine_loop: { max_iterations: 4 }
  self_consistency: { candidates_per_request: 3 }

transport:
  system_prompt:
    budget_lines: 200
    contents: ["Tier 1 list (one line per rule)", "Tier 3 dispositions (≤5 bullets)", "Active Tier 4 brand summary"]
  skills:
    - name: "design-principles"
      description: "Apply the design constitution to UI generation."
      trigger_patterns: ["*tsx", "*jsx", "*vue", "*css", "design", "ui", "component"]
  mcp:
    server_name: "design-knowledge-mcp"
    resources: ["design://constitution/{project_id}", "design://tokens/w3c"]
    tools: ["lint_design", "vlm_critique", "self_refine"]
```

### 3.3 The validation pipeline

```
session.start
  └─ MCP.require_brand_spec()                  ← inject tokens as CSS variables

generation.block(N)
  ├─ model writes code(N)
  ├─ if component start: MCP.require_pattern()  ← reference code
  ├─ MCP.math_audit(code(N))                   ← TIER 1 linter, blocking
  ├─ MCP.structural_critique(code(N))          ← TIER 2 critique
  └─ (optional) MCP.vlm_critique(code(N))      ← TIER 3 VLM

generation.complete
  └─ MCP.final_audit()                         ← brand match + DQS score
```

### 3.4 Specific design choices for MiniMax-M3

A mid-tier model class is the target. Three design choices reflect this:

1. **Maximize what is enforced outside the model.** Tier 1 violations should never reach the model — linter errors at code-write time. This frees model attention for judgment-requiring tiers.
2. **Lean on Critique-out-Loud, not direct scoring.** When the model must self-evaluate, force the format: *"Describe violations against these principles, then give a pass/fail and severity."* This technique lets an 8B model outperform a 70B direct scorer (Ankner et al., arXiv:2408.11791).
3. **Three-tier loading budget.** Tier 1 + Tier 3 + Tier 4 summary in system prompt (~150 lines). Tier 2 loaded via skill on demand. Tier 4 full spec loaded via MCP resource per request.

A Frontier-tier model could internalize more and load less. Mid-tier models need the *opposite* shape: less internalization, more externalized structure.

### 3.5 Empirical findings that shape the design

1. **Critique-before-score closes a 9× parameter gap** (CLoud paper). For MiniMax-M3, this is the single highest-ROI technique.
2. **On-policy critique training is essential.** Don't paste constitution critiques from a different model — let the target model produce them in-context.
3. **Self-consistency helps for short-horizon tasks, hurts for long** — for design (1–3 critique steps), sampling 3 candidates and marginalizing is net-positive.
4. **Self-Refine caps at ~3 useful iterations** (Madaan et al.) — hard cap the loop.
5. **CLAUDE.md is context, not config** — Tier 1 must use hooks/linters, not model discipline.
6. **Specificity beats generality** — every principle must be specific enough to evaluate.
7. **Path-scoped rules save context** — Tier 2 rules don't need to load when generating SQL migrations.
8. **Frame as dispositions, not rules** — Tier 3 aesthetic guidance should be "lean toward restraint," not "always use ≤3 elements."
9. **AGENTS.md is the canonical cross-agent shape** — write the constitution in plain markdown sections.
10. **Tokens are principles as data** — `{color.brand.primary}` is "use the brand primary" expressed as a constraint the linter can enforce.

---

## Part 4 — Evaluation Rubrics (Design Quality Score)

### 4.1 Survey of 13 benchmarks

| Benchmark | What it evaluates | Rubric | Human-validated | Tool |
|---|---|---|---|---|
| **AesBench** (arXiv:2401.08276) | Image aesthetic (4 dimensions: perception, empathy, assessment, interpretation) | Yes, dimension-level | Yes (experts) | AesExpert models + repo |
| **MM-StyleBench** (arXiv:2501.09012) | Artistic style fidelity + content preservation | Yes, Bradley-Terry | Yes (12 annotators) | ArtCoT prompting |
| **VisJudge-Bench** (arXiv:2510.22373) | Visualization aesthetics (6 sub-dimensions, 1–5 scale) | Yes | Yes (3 raters + adjudication) | VisJudge Qwen2.5-VL-7B-GRPO |
| **UICrit** (arXiv:2407.08850) | Mobile UI quality (5 critique clusters: layout, color contrast, text readability, button usability, learnability) | Yes (Sadler framework: expected standard/gap/fix) | Yes (7 designers) | Public CSV with bbox |
| **UIClip** (UIST 2024) | Continuous UI design quality (CRAP: Contrast, Repetition, Alignment, Proximity) | Single composite score | Yes | CLIP fine-tune, 151M params |
| **MLLM-as-UI-Judge** (arXiv:2510.08783) | 9 dimensions across cognitive/perceptual/emotional | Yes | Yes | Open repo |
| **SlideAudit** (arXiv:2508.03630) | 27 flaw categories across 5 dimensions | Yes | Yes | SlideAudit LLM |
| **PHASE** | Image aesthetic prediction | Distribution-based | Trained on AVA | Pretrained CNN |
| **NIMA** (arXiv:1709.05424) | Image quality (technical + aesthetic) | Mean over 1–10 | Yes (AVA) | Pretrained model |
| **LAION-Aesthetics V1/V2** | CLIP-based aesthetic scoring | Continuous | Yes | Pretrained predictor |
| **Google SQRG** | Page Quality (E-E-A-T, YMYL, PQ scale) | Yes (~16k raters worldwide) | Yes | Internal Google |
| **NN/g 10 Heuristics** | Nielsen usability heuristics | Yes | Yes | Manual checklist |
| **Laws of UX** | Hick, Fitts, Miller, Gestalt, Jakob, Von Restorff | Formal math | Decades of psychology | Manual + count-based metrics |

**Key finding:** All academic benchmarks reviewed have explicit human-validated rubrics (1–5, 1–7, or 1–10 scales with trained annotators). Most have Western/US-annotator bias; subjective ratings have Krippendorff α ≈ 0.37 in BetterApp — design quality is fundamentally multi-rater.

### 4.2 The composite Design Quality Score (DQS) formula

```
DQS = Σ wᵢ · normalize(Sᵢ)        where Σ wᵢ = 1.0
```

| # | Sub-score | Dimension | Machine-checkable metric | Source |
|---|-----------|-----------|--------------------------|--------|
| S1 | **Accessibility** | WCAG 2.2 AA + APCA Lc | `1 - (axe_violations / axe_total_rules)` AND `mean(apca_lc ≥ 75)` | WCAG, axe-core, APCA |
| S2 | **Token consistency** | Brand spec adherence | Fraction of computed styles matching tokens manifest | Tokens Studio / Style Dictionary |
| S3 | **Type scale** | Modular scale (1.125 / 1.2 / 1.25 / 1.333 / 1.5 / 1.618) | `1 - mean(\|actual_ratio − target_ratio\| / target_ratio)` | Tim Brown's "More Meaningful Typography" |
| S4 | **Spacing scale** | 4/8 grid | Fraction of padding/margin/gap that are multiples of base unit | Material / Carbon |
| S5 | **Hierarchy** | Heading order, weight contrast | DOM monotonicity + weight contrast + size monotonicity | UICrit "Layout" cluster |
| S6 | **Density** | Whitespace ratio | `whitespace_pixels / total_pixels` per viewport | NN/g |
| S7 | **Cognitive load** | Decision points per screen (Hick) | `count(distinct_clickable_choices)` target ≤ 7 | Hick's Law |
| S8 | **Motion** | Easing/duration tokens | Fraction of CSS transitions using `--ease-*`, `--dur-*` | Material Motion spec |
| S9 | **Color coherence** | Color theory rules | HSL hue-distance vs target scheme (complementary 180°, triadic 120°, analogous 30°) | Color theory |
| S10 | **Reusability** | No one-off components | Jaccard similarity > 0.8 on duplicate DOM subtrees | Atomic Design |

**Recommended weights (v1):**

| Sub-score | Weight | Rationale |
|---|---:|---|
| S1 Accessibility | **0.20** | Legal floor (ADA/EAA), broadest impact |
| S2 Token consistency | **0.15** | Brand integrity; cheap to detect |
| S3 Type scale | **0.10** | Hierarchy/perceived quality driver |
| S4 Spacing scale | **0.05** | Coarse check; cheap |
| S5 Hierarchy | **0.10** | Compresses WCAG + typography + layout |
| S6 Density | **0.05** | Coarse aesthetic signal |
| S7 Cognitive load | **0.10** | Hick's Law; high predictive validity |
| S8 Motion | **0.05** | Lower weight — many artifacts are static |
| S9 Color coherence | **0.10** | Aesthetic valence + brand cohesion |
| S10 Reusability | **0.10** | Design-system hygiene; predicts maintainability |

### 4.3 Augmented formula (with learned scorers)

```
DQS_full = 0.6 · DQS_rules + 0.4 · mean(S11..S14)

S11 = nima_score(image)              # distribution-based, [0,1]
S12 = laion_aesthetic(image)         # CLIP-based, [0,1]
S13 = uiclip_score(screenshot, caption)  # UI-specific, [0,1]
S14 = visjudge_score(chart)          # 6-dim mean, [0,1]
```

### 4.4 MCP tool output schema

```json
{
  "design_quality_score": 0.83,
  "sub_scores": {
    "S1_accessibility": 0.95, "S2_token_consist": 0.88,
    "S3_type_scale": 0.72, "S4_spacing_scale": 1.00,
    "S5_hierarchy": 0.85, "S6_density": 0.78,
    "S7_cognitive_load": 0.92, "S8_motion": 0.60,
    "S9_color": 0.74, "S10_reusability": 0.81
  },
  "learned_scores": { "nima": 0.71, "laion_aesthetic": 0.68, "uiclip": 0.79 },
  "violations": [
    {"rule": "color-contrast", "element": ".btn-secondary", "severity": "serious"},
    {"rule": "spacing-not-on-grid", "value": "13px", "expected": "12px or 16px"}
  ],
  "weights_version": "v1.0"
}
```

---

## Part 5 — The AI Design Tool Gap

### 5.1 Tool-by-tool output matrix

| Tool | Output | Tokens | Components | States | Prototype | Motion specs | A11y | Content guide | Rationale |
|---|---|---|---|---|---|---|---|---|---|
| **v0** | React + Tailwind JSX | ❌ inline only | ⚠️ shadcn subset | ❌ default | ✅ live preview | ❌ | ⚠️ markup-only | ❌ | ❌ |
| **Bolt.new** | Full-stack React | ❌ | ⚠️ | ❌ | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| **Lovable** | Full-stack React | ❌ | ⚠️ | ❌ | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| **Replit Agent** | Full-stack | ❌ | ⚠️ | ❌ | ✅ | ❌ | ⚠️ | ❌ | ❌ |
| **Claude Design** | React JSX + Figma export | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Figma Make** | Figma frames + variables | ⚠️ manual extract | ✅ | ✅ | ✅ | ⚠️ | ❌ | ❌ | ❌ |
| **Galileo AI / Stitch** | UI mockup images | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Uizard** | Figma-style mockups | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| **Relume** | Sitemap + wireframes + section library | ⚠️ partial | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| **Magician** | Figma plugin output | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Builder.io** | React/Vue/Svelte/Angular/HTML + Tailwind | ✅ CSS vars + tokens | ✅ codebase-mapped | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Anima** | React/Vue/HTML from Figma | ❌ | ✅ auto-detect | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ |
| **Locofy / LocoAI** | React/Next.js/HTML/CSS via "Large Design Models" | ❌ | ✅ | ⚠️ | ❌ | ❌ | ⚠️ via Locofy MCP | ❌ | ❌ |

### 5.2 The systemic gap

Every tool in the current landscape picks a **single slice** of the design deliverable. There is **no tool** that outputs tokens + components + interactive prototype + accessibility annotations + motion specs + content guidelines + design rationale together.

**The most-missing artifacts:**

1. **Design rationale / intent documentation** — the "why" behind decisions
2. **Motion / interaction specifications** — timing, easing, choreography
3. **Accessibility annotations & contrast reports** — auto-generated a11y audits
4. **Content guidelines** — voice, tone, copy patterns, microcopy rules
5. **Cross-system coherence rules** — what keeps the system from drifting as agents produce many screens

The closest to "full bundle" is **Figma Make + Figma Design Agent + Code Layers + Motion + MCP** (Figma's emerging 2026 stack), but it still leaves the semantic metadata (rationale, motion specs, a11y annotations, content voice) to humans.

### 5.3 What prototyping means in 2026

Three coexisting definitions:

1. **Figma-style static-link prototype** — frames connected by triggers, animated with Smart Animate (scale, position, opacity, rotation, fill only). Variables + conditional logic enable state-driven prototypes.
2. **Code-based interactive prototype** — Storybook stories (CSF), v0 playgrounds, shadcn examples. State-driven, runnable in browser, testable (play functions).
3. **Animation-faithful prototype** — Rive (interactive vector animations, state machines), Lottie, Framer Motion. Used for motion design, complex micro-interactions.

**Best practice (2026):** ship BOTH a Figma prototype (for review/buy-in) AND a Storybook playground (for engineering). The two stay in sync via the design tokens.

---

## Part 6 — Synthesis: The Path Forward

### 6.1 What the research validates

1. **The bundle is real and worth emitting.** A senior designer produces ~22 artifact types for one surface. AI tools emit 1. The MCP should emit the bundle.
2. **The Constitution can be machine-readable.** The four-tier YAML schema (Tier 1 linter / Tier 2 lint+critique / Tier 3 VLM / Tier 4 brand RAG) maps cleanly to enforcement mechanisms that already exist.
3. **Quality can be measured.** DQS with 10 sub-scores + 4 learned scorers is fully machine-computable and grounded in 13 human-validated benchmarks.
4. **Mid-tier models can follow the Constitution** if Tier 1 is enforced by linter (not model discipline) and Tier 3 is shaped as dispositions (not rules). Critique-out-Loud is the key technique.

### 6.2 What the research challenges

1. **Don't build a Claude Design competitor.** The bundle is the differentiator, not the editor. Build a data + enforcement layer.
2. **Don't claim frontier VLM is the primary critic.** VisJudge-Bench shows MAE 0.55, correlation 0.43. Use math (axe-core, APCA, token-consistency) as the primary defense; VLM as opt-in escalation.
3. **Don't fine-tune taste into the base model.** Apple's ml-rldf proves prompt-locked brittleness. The Constitution is the rule; the model follows it via structured context.

### 6.3 Concrete next steps (when you're ready to commit)

1. **Adopt the Constitution schema** as the data model. Render top-of-file summary to CLAUDE.md / AGENTS.md (~150 lines). Full YAML loaded via MCP resource per project.
2. **Implement Tier 1 as host-side hooks** (Claude Code / Cursor). axe-core, stylelint, eslint-plugin-jsx-a11y, token-consistency linter. Blocking.
3. **Implement Tier 2 as lint + critique prompts.** Stylelint + a critique pass against the Constitution. Soft blocking (up to 3 revisions).
4. **Implement Tier 3 as VLM critique** with opt-in escalation. Default to local VisJudge-Qwen2.5-VL-7B-GRPO; frontier VLM when user provides API key. Output as code diffs.
5. **Implement Tier 4 as MCP resource per project.** `design://constitution/{project_id}` returns the full brand spec; loaded into context per request.
6. **Compute DQS on every shipped artifact.** Sub-scores stored per artifact; aggregate over project to track design system drift.
7. **Generate the 22-artifact bundle.** For a single surface, emit: tokens (color/type/spacing/elevation/radius/motion/icons/breakpoints) + component library + state matrix + spec.md + wireframes + hi-fi mockups + Storybook stories + sitemap + microcopy + a11y annotations.

### 6.4 What this looks like for a user

A mid-tier model, given a brief ("design a pricing page for Acme Cloud, B2B engineering teams, dense"), invokes the Design Knowledge MCP and receives:

1. Brand spec injected as CSS variables (Tier 4)
2. Reference component code (shadcn Button, Card, Toggle, Dialog, Badge)
3. Tokens (color, type, spacing, motion, elevation, radius, breakpoints)
4. Constitution summary in system prompt (Tier 1 hard rules + Tier 3 dispositions)
5. Validation pipeline config (lint → critique → VLM)

It generates the artifact bundle. Each block is linted (axe-core catches contrast, stylelint catches magic spacing). Each component is critiqued against Tier 2 rules. The output is rendered, screenshotted, and critiqued against Tier 3 dispositions. The final score is a DQS value that the user can inspect per artifact.

The result: principle-adherent design, not "blurple rounded-xl shadow-md Inter."

---

## References

Full URLs in each section above. Key papers:

- Anthropic. "Introducing Agent Skills." Oct 2025.
- Bai et al. "Constitutional AI." arXiv:2212.08073.
- Madaan et al. "Self-Refine." arXiv:2303.17651.
- Wang et al. "Self-Consistency." arXiv:2203.11171.
- Ankner et al. "Critique-out-Loud Reward Models." arXiv:2408.11791.
- Gregory, B. "How We Built a Self-Enforcing Design System with Claude Code." kasava.dev 2025.
- W3C. "Design Tokens Format Module." Nov 2025.
- Duan et al. "UICrit." arXiv:2407.08850. UIST 2024.
- Wu et al. "UIClip." UIST 2024.
- Xie et al. "VisJudge-Bench." arXiv:2510.22373. ICLR 2026.
- Huang et al. "AesBench." arXiv:2401.08276.
- Jiang & Chen. "MM-StyleBench." arXiv:2501.09012.
- Apple ml-rldf. arXiv:2509.16779. CHI 2026.
- Agentic AI Foundation. "AGENTS.md." 2025.
- Wolosin, D. "Design Systems for AI: Introducing the Context Engine." 2025.

---

*End of research document. See `SYNTHESIS.md` for the architecture proposal and `ADVERSARIAL-REVIEW.md` for the adversarial review.*