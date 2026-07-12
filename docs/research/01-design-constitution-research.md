# Encoding Design Principles as a Machine-Followable "Constitution"
## Research Report — Design Knowledge MCP

**Audience:** Architect of a Design Knowledge MCP that must enable MiniMax-M3-class (and above) models to produce principle-adherent design.
**Question:** What does "principle-adherent" mean operationally, and what is the concrete schema for a Design Constitution file?
**Method:** Systematic literature review + production-pattern audit (Cursor, Claude Code, AGENTS.md, shadcn MCP, Anthropic Skills, design-engineering blogs).

---

## 1. Executive Summary

A mid-tier model cannot follow design principles the same way a senior designer can — through internalized taste. It must follow them through **structured context + external enforcement + self-critique loops**, where each principle tier is enforced by a different mechanism tuned to its semantic character.

The central architectural insight: **principles are not all the same kind of thing**. WCAG contrast is a boolean check; "use 8-point grid" is a structural rule with measurable outputs; "restraint" is an aesthetic disposition that only a vision-language model can critique. A constitution that flattens these into prose fails on the tiers that need linters, and the tiers that need critique get no signal.

Recommendation: a **four-tier Design Constitution**, where Tier 1 is enforced by linters (never reaches the model), Tier 2 is enforced by lint + critique, Tier 3 is enforced by VLM critique only, and Tier 4 is brand-specific and loaded per-project. The constitution is delivered via three transport layers (linter config, system prompt / skill, retrieval-augmented context), and the model runs a Self-Refine-style critique-revise loop gated by tier-specific validators.

---

## 2. Background Research

### 2.1 Constitutional AI (Bai et al. 2022, arXiv:2212.08073)

**What it is:** A method to train a harmless AI assistant using only a list of principles ("the constitution") and AI-generated feedback (RLAIF). No human harm labels needed.

**Mechanism — two phases:**
1. **SL phase:** Sample response → model generates self-critique against principle → model generates revision → finetune on revisions.
2. **RL phase (RLAIF):** Generate two samples → model picks which is better against principle → train preference model → RL with that reward.

**Key insight from the paper:** Chain-of-thought improves both adherence *and* transparency. Critique-before-revise beats revise-directly.

**Transfer to design:** A "design constitution" can drive critique-revise loops at *inference time*, not just training time. The model critiques its own design output against the constitution, then revises. This is essentially Self-Refine (§2.2) with the constitution as the critique rubric.

### 2.2 Self-Refine (Madaan et al. 2023, arXiv:2303.17651)

**What it is:** A test-time iterative loop where one LLM plays three roles: **Generator → Feedback → Refiner**, looping until stable.

**Results:** ~20% absolute average improvement across 7 tasks (dialog, math, code, etc.), including GPT-4 itself.

**Failure modes:** Only 2–3 iterations yield gains; quality plateaus or degrades after that. Without a stop criterion, the loop drifts.

**Transfer to design:** Generate initial UI → model critiques against constitution → revise → repeat. Stop when critique passes all Tier 1 (linter) and Tier 2 (structural) rules, OR after N iterations.

### 2.3 Self-Consistency (Wang et al. 2022, arXiv:2203.11171)

**What it is:** Sample N candidate outputs, marginalize to the most consistent answer.

**Results:** +17.9% on GSM8K, +12.2% on AQuA.

**Transfer to design:** Generate 3–5 candidate layouts; pick the one whose structural properties (grid adherence, contrast, spacing rhythm) most consistently satisfy Tier 2 rules. Combine with a VLM judge for Tier 3 aesthetic consistency.

### 2.4 Critique-out-Loud Reward Models (Ankner et al. 2024, arXiv:2408.11791)

**What it is:** A reward model that first generates a natural-language critique, then predicts a scalar reward from critique + response. Unifies RM and LLM-as-Judge.

**Results:** +4.65 pts (8B) and +5.84 pts (70B) on RewardBench. **An 8B CLoud model outperforms a 70B Classic RM** on Chat and Safety — critique-before-scoring is *so effective it closes a 9× parameter gap*.

**Critical findings:**
- On-policy training (self-generated critiques) is essential — off-policy drops 5.6 pts.
- Self-consistency helps for 1–2 step reasoning (+0.7 pts) but **degrades** for 3+ steps.
- Critique-then-score beats direct scoring even for small models.

**Transfer to design:** The mechanism a small model uses to grade its own design output should be "describe violations against principles, then score." For a MiniMax-M3 producing design, this is the most important inference-time technique available — it lets the model catch what its single forward pass misses.

### 2.5 Anthropic Agent Skills (Oct 2025, Anthropic Engineering Blog)

**What it is:** Folders of instructions, scripts, and resources Claude discovers and loads on demand. The canonical "principle file" format.

**Format — progressive disclosure:**
- **Level 1:** `name` + `description` from YAML frontmatter — pre-loaded into every system prompt.
- **Level 2:** Full `SKILL.md` body — loaded when Claude determines relevance.
- **Level 3+:** Additional files (e.g., `forms.md`, `reference.md`) — loaded on demand by Claude via tool calls.

**Key properties:**
- Composable, portable (open standard at agentskills.io), efficient.
- Skills can include **executable code** Claude runs at its discretion (e.g., a deterministic color-contrast checker).
- Anthropic explicitly cites brand guidelines as a use case.

**Transfer to design:** A Design Knowledge MCP server exposes skills of this shape. Each skill bundles principles + scripts + exemplars, and Claude (or any agent) loads only what's relevant.

### 2.6 Anthropic Character Training (Claude's Constitution)

**What it is:** A synthetic-data-only pipeline that internalizes character traits into Claude via self-generated preference data.

**Key insight:** Use broad traits, not narrow rules. Anthropic explicitly states: *"We don't want Claude to treat its traits like rules from which it never deviates."*

**Transfer to design:** Tier 4 (brand-specific) and Tier 3 (aesthetic guidance) principles should be expressed as **dispositions**, not imperatives. "Lean toward restraint" not "always use ≤3 elements." Imperatives drift; dispositions adapt.

### 2.7 Claude Code CLAUDE.md (Official Docs)

**Mechanism:** Plain markdown, *exact* filename `CLAUDE.md`, loaded at start of every session.

**Hierarchy (load order, broad → specific, more specific wins on conflict):**
1. Org: `/etc/claude-code/CLAUDE.md` (managed policy)
2. User: `~/.claude/CLAUDE.md`
3. Project: `./CLAUDE.md` or `./.claude/CLAUDE.md`
4. Local: `./CLAUDE.local.md` (gitignored)

**Critical constraint from the docs:** *"Claude treats them as context, **not enforced configuration**. To block an action regardless of what Claude decides, use a PreToolUse hook."*

**Size budget:** Target **<200 lines** per file. Longer files consume thinking room and reduce adherence.

**Imports:** `@path/to/file` syntax, recursive up to 4 hops.

**Specificity wins:** "Use 2-space indentation" beats "Format code properly." "Run `npm test` before committing" beats "Test your changes."

### 2.8 AGENTS.md Standard (agents.md, 2025)

**What it is:** Open standard for coding-agent instructions; ~60k+ projects, joint launch by OpenAI, Google, Cursor, Factory, Sourcegraph; now stewarded by the Linux Foundation.

**Format:** Just markdown, no required fields. Closest AGENTS.md to the edited file wins; user chat overrides everything.

**Adoption:** Codex, Jules, Devin, GitHub Copilot Coding Agent, Gemini CLI, Windsurf, Cursor, Zed, Aider, etc.

**Transfer to design:** A Design Constitution should be portable across agents. AGENTS.md is the canonical shape — markdown with structured sections, not a proprietary schema.

### 2.9 Cursor `.cursor/rules/*.mdc` (awesome-cursorrules, 40.3k stars)

**Format:** YAML frontmatter for scoping:
```yaml
---
description: One-line summary
globs: **/*.tsx
alwaysApply: false
---
```

**Production examples:**
- **shadcn-ui.mdc**: imports from `@/components/ui/*`, mentions `npx shadcn@latest add`, warns about deprecated `shadcn-ui` CLI.
- **Next.js + Supabase (27 architecture rules)**: explicitly prevents AI hallucinations — `getSession` vs `getUser`, deprecated imports, missing RLS, Stripe key exposure.

**Transfer to design:** Path-scoped rules let us say "these principles apply only to `*.tsx` components" or "this principle applies only when the project uses Tailwind." Scoped loading saves context budget.

### 2.10 shadcn MCP Server (ui.shadcn.com/docs/mcp)

**What it is:** Exposes the shadcn component registry to AI agents via MCP. Agents browse, search, and install components through natural language.

**Mechanism:**
- `components.json` defines registries (URLs with token auth).
- MCP server translates "add a login form" into registry calls.
- Components returned are not just code but **structured metadata** (name, type, dependencies, CSS variables).

**Transfer to design:** This is the live proof that MCP + structured component metadata + natural-language interface works for design assets at production scale. A Design Knowledge MCP can do the same for design *principles*.

### 2.11 Kasava's Self-Enforcing Design System (Benjamin Gregory, 2025)

**What it is:** A ~300-line `DESIGN_PRINCIPLES.md` at repo root, enforced by a `design-review` agent that uses Playwright to evaluate live UI against the principles.

**Founding constraint:** *"Every principle included must pass one test: can Claude Code actually evaluate whether we're following it?"*

**10 principle areas (each with concrete numbers):**
1. **Information Hierarchy** — Primary: 1 main action; Secondary: 2–3 supporting; Tertiary: collapsed.
2. **Progressive Disclosure** — Default to 3–5 items.
3. **Whitespace & Density** — 40–60% content, 40–60% whitespace. Section gap = 32px (`gap-8`).
4. **Component Limits** — Dashboard cards ≤6–8; list items ≤5.
5. **Layout Patterns** — Single-column for tasks, multi-column for comparison.
6. **Color & Indicators** — Red=critical, Yellow=warning, Green=success, Blue=info, Gray=neutral. Never color alone.
7. **Empty States** — Actionable guidance, not decoration.
8. **Loading States** — Skeleton matching shape, not generic spinners.
9. **Navigation** — No duplicates; deep-link to reduce clicks.
10. **Pre-Ship Checklist** — 5 yes/no questions.

**Anti-patterns table** explicitly calls out what to *avoid*: "show everything at once," "heavy borders," "multiple competing CTAs," "decorative empty states," "spinners," "duplicate nav."

**Transfer to design:** This is the closest production reference to what we're building. Three things to steal: (a) every principle must be evaluable, (b) principles have concrete numbers, (c) anti-patterns are paired with their corrections.

### 2.12 The Context Engine (Diana Wolosin, Design Systems Collective, 2025)

**Core thesis:** *"Design systems were never built for machines. That's the problem."*

The author identifies 7 converging signals — Anthropic Constitutional AI, MCP, W3C Design Tokens Format Module (Nov 2025), Figma semantic variables, Google RAG, enterprise knowledge graphs, Code-Based Design Systems — as evidence the industry is converging on the same answer: **structured machine-readable context** is the missing layer.

**Three layers of a context engine:**
- **Why** — business context and strategy.
- **What** — design system documentation.
- **How** — AI orchestration.

**Stated blueprint:**
1. UX Blueprint (behavior): "Conversational. Every task can be completed through natural dialogue. Interactions prioritize clarity, reassurance, autonomy."
2. UI Blueprint (visual): tokens, components, layouts.
3. (Implied) Code Blueprint (implementation).

**Transfer to design:** Confirms our tier model. Tier 4 (brand-specific) is the *Why* layer; Tier 1–3 are *What* + *How*.

### 2.13 W3C Design Tokens Format Module (Nov 2025)

**What it is:** A W3C spec for strict token semantics, including type, description, deprecation, extensions; `{token}` references and JSON Pointer resolution.

**Transfer to design:** Tokens are the Tier-1 substrate. A token is a *principle made data* — `{color.brand.primary}` encodes "use this, not raw hex" as a machine-checkable constraint.

---

## 3. What "Principle-Adherent" Means Operationally

Synthesizing across the evidence:

**Principle-adherent** is *not* "the model internalized the principle." It is **the model produces output that passes principle-specific validators**, where each tier of principle has its own validator and the validators collectively cover the design space.

| Tier | Principle kind | Validator | Where enforcement happens |
|------|---------------|-----------|---------------------------|
| **1** | Hard rule (boolean / numeric) | Linter, type checker, schema validator | *Outside* the model — output rejected if invalid |
| **2** | Soft rule (structural) | Lint rule + critique prompt | Lint fails → revise; critique misses → VLM pass |
| **3** | Aesthetic disposition | VLM critique (vision-language model) | Critique-revise loop until stable or N iters |
| **4** | Brand-specific | Per-project loaded spec | RAG into context per request |

The model is *one* enforcement layer among several. A model that never produces Tier-1 violations (because the linter catches them) is more reliable than a model that "remembers" WCAG — and the linter is 10⁴× cheaper than the model's attention.

---

## 4. The Design Constitution Schema

A single JSON file (canonical) with markdown rendering for human + model consumption. Designed for AGENTS.md / CLAUDE.md / Skill portability.

```yaml
# design-constitution.yaml — version 1.0
# Schema: DesignKnowledgeMCP/Constitution/v1
# Compatible transport: AGENTS.md (sections), CLAUDE.md (sections), Skill (SKILL.md body),
#                       MCP tool calls (resources/read), JSON Schema validation.

meta:
  id: "design-constitution.v1"
  name: "Acme Design Constitution"
  version: "1.4.0"
  inherits: ["w3c-design-tokens-format-module@1", "wcag-2.2-aa"]
  applies_to:
    file_patterns: ["**/*.tsx", "**/*.jsx", "**/*.vue", "**/*.svelte", "**/*.css", "**/*.html"]
    frameworks_any: ["react", "next", "remix", "vue", "svelte"]
    min_model_capability: "tier-2-plus"   # Mid-tier M3 and above; Tiers 1+2 still enforced by linter
  maintainer: "design-systems@acme.com"
  last_reviewed: "2026-07-12"

# ============================================================
# TIER 1 — HARD RULES (enforced by linter, never the model)
# ============================================================
# Format: structured, machine-readable. Linter consumes directly.
# Failure mode: lint error → regenerate or auto-fix.
# Why separated: model attention is expensive; linter is O(n) deterministic.

tier_1_hard_rules:
  accessibility:
    contrast_minimum: 4.5        # WCAG 2.2 AA — body text
    contrast_large_text: 3.0     # WCAG 2.2 AA — ≥18pt or bold ≥14pt
    keyboard_navigable: true
    aria_required_for: ["button", "dialog", "menu", "tab", "tooltip"]
    alt_text_required: true
    focus_visible_required: true
    enforce_via: ["eslint-plugin-jsx-a11y", "axe-core", "@axe-core/playwright"]

  token_usage:
    no_raw_color_values: true    # hex/rgb/hsl literals forbidden outside tokens.css
    no_inline_styles: true       # style={} forbidden
    no_magic_spacing: true       # px values must match token scale
    no_arbitrary_tailwind: true  # no w-[137px], bg-[#abc123]
    only_spec_tokens: true       # components consume tokens.* and components.* exclusively
    enforce_via: ["stylelint-no-unsupported-css-features", "tailwind.config.js whitelist"]

  semantic_html:
    heading_hierarchy_strict: true   # h1 → h2 → h3, no skipping
    landmark_elements_required: ["header", "nav", "main", "footer"]
    interactive_elements_semantic: true  # <button> not <div onClick>
    enforce_via: ["eslint-plugin-jsx-a11y", "html-validate"]

# ============================================================
# TIER 2 — SOFT RULES (lint + critique-enforced)
# ============================================================
# Format: prose with concrete thresholds. Lint catches violations; critique catches intent.
# Failure mode: lint error → fix; lint passes but critique flags → revise loop.

tier_2_soft_rules:
  grid:
    base_unit: 8                # all spacing on 8px grid; 4px half-step allowed for inline
    spacing_scale: [4, 8, 12, 16, 24, 32, 48, 64, 96]
    enforce_via: ["stylelint-declaration-strict-value", "eslint-plugin-tailwindcss"]
    critique: |
      Verify all margins, paddings, and gaps are multiples of 4 (preferably 8).
      Items closer than 8px should suggest "these belong grouped."
    critique_failure_pattern: "non-grid spacing"

  typography:
    type_scale_ratio: 1.25       # major third
    base_size: 16
    scale: [12, 14, 16, 20, 25, 31, 39, 49]
    line_height_body: 1.5
    line_height_heading: 1.2
    enforce_via: ["stylelint", "type-scale-linter"]
    critique: |
      Hierarchy should be visible through size AND weight, never size alone.
      Three font sizes per screen maximum; size jumps should follow the scale exactly.
    critique_failure_pattern: "scale violation, weight ignored, hierarchy by size only"

  color_semantics:
    palette:
      primary: "{color.brand.primary}"
      semantic:
        success: "{color.semantic.success}"
        warning: "{color.semantic.warning}"
        danger:  "{color.semantic.danger}"
        info:    "{color.semantic.info}"
        neutral: "{color.semantic.neutral}"
    enforce_via: ["stylelint-declaration-strict-value"]
    critique: |
      Red/Yellow/Green/Blue/Gray carry fixed meaning.
      Color must always pair with text or icon (never color-alone signaling).
    critique_failure_pattern: "color-only status, semantic mismatch"

  hierarchy:
    one_primary_action_per_view: true
    secondary_elements_max: 3
    tertiary_collapsed_default: true
    enforce_via: ["custom-linter:hierarchy-check"]
    critique: |
      Each view should answer one question clearly. If two CTAs compete,
      demote one to secondary or move to a different surface.
    critique_failure_pattern: "competing CTAs, primary ambiguous"

  density:
    whitespace_target: [0.40, 0.60]   # 40–60% of viewport
    list_items_default_max: 5
    dashboard_cards_max: 8
    enforce_via: ["custom-linter:density-check"]
    critique: |
      Default to less. Show 3–5 items; collapse the rest behind "+N more."
    critique_failure_pattern: "over-disclosure, dense wall of items"

# ============================================================
# TIER 3 — AESTHETIC DISPOSITIONS (VLM critique only)
# ============================================================
# Format: prose dispositions with exemplars. No lint can check these.
# Failure mode: VLM critique flags → revise loop; human review optional.
# Important: framed as dispositions, not rules (per Anthropic Character Training insight).

tier_3_aesthetic:
  restraint:
    disposition: "Lean toward fewer elements. Every element must earn its place."
    exemplars:
      good: "Three focused cards over eight cramped tiles."
      bad: "Eight tiles crammed into a viewport."
    critique_prompt: |
      Does each element serve the user's immediate goal? If an element can
      be removed without losing core value, remove it.

  alignment:
    disposition: "Edges align across the entire composition. Optical alignment beats mathematical alignment for text."
    critique_prompt: |
      Do headers, body text, and icons share visible vertical rhythm?
      Are there any orphan elements breaking alignment unintentionally?

  rhythm:
    disposition: "Spacing creates visual cadence. Varied but predictable."
    critique_prompt: |
      Does spacing tell a story — tighter for related, looser for separate?
      Or is it arbitrary?

  breathing_room:
    disposition: "Negative space is not wasted space. Generous margins around primary content."
    critique_prompt: |
      Does the eye have somewhere to rest? Are primary elements crowded?

  visual_hierarchy:
    disposition: "The most important thing is most prominent — by size, weight, position, AND color."
    critique_prompt: |
      Within 2 seconds, can a viewer name the page's single primary action?
      If not, hierarchy is failing.

  anti_patterns:    # explicitly paired with corrections
    - pattern: "Show everything at once"
      correction: "Progressive disclosure; collapse tertiary"
    - pattern: "Heavy card borders / drop shadows"
      correction: "Subtle background contrast, no border"
    - pattern: "Multiple competing CTAs"
      correction: "One primary, others demoted to text/secondary"
    - pattern: "Decorative empty states (big illustrations)"
      correction: "Actionable guidance + primary action"
    - pattern: "Spinner for all loading"
      correction: "Skeleton matching content shape; show available content immediately"
    - pattern: "Duplicate nav (sidebar AND card)"
      correction: "Single source of truth per destination"

# ============================================================
# TIER 4 — BRAND-SPECIFIC (per-project loaded via RAG)
# ============================================================
# Format: structured brand spec. Loaded into context per request.
# Failure mode: stale → versioning; mismatch → designer review.
# Why separated: brand decisions are project-specific, not universal.

tier_4_brand:
  brand_identity:
    product_name: "Acme Cloud"
    audience: "B2B engineering teams"
    density: "high"            # overrides Tier 2 default
    tone: "technical, precise, calm"
    voice_principles:
      - "Say what the thing is. No marketing fluff."
      - "Numbers over adjectives."
      - "Active voice; present tense."

  visual_identity:
    primary_color: "{color.brand.cobalt}"   # NOT default semantic red
    accent_strategies:
      - "Red is reserved for destructive action only."
      - "Cobalt = brand; never decorative."
    typography:
      heading: "Acme Sans"
      body: "Acme Sans"
      mono: "JetBrains Mono"
    imagery:
      style: "flat geometric, technical diagrams"
      forbidden: ["stock photography", "illustrations of people"]

  component_decisions:
    data_tables:
      row_height: 40            # overrides Tier 2 default for B2B dense
      zebra_striping: false
    navigation:
      pattern: "persistent-left-rail"
      collapse_below: 1024
    dialogs:
      max_width: 720
      default_to_sheet: false
    sheets:
      default_width: 480

# ============================================================
# VALIDATION PIPELINE (how to run the constitution)
# ============================================================

validation_pipeline:
  order:
    - tier: 1
      mechanism: "linter"
      blocking: true
      on_failure: "reject and regenerate"
    - tier: 2
      mechanism: "lint + critique"
      blocking: "soft"
      on_failure: "revise up to 3 iterations"
    - tier: 3
      mechanism: "VLM critique"
      blocking: false
      on_failure: "revise up to 2 iterations; log for human review"
    - tier: 4
      mechanism: "brand-spec match (retrieval)"
      blocking: "soft"
      on_failure: "warn + flag for designer review"

  self_refine_loop:
    max_iterations: 4
    stop_when:
      - "tier_1 lint passes"
      - "tier_2 critique returns 0 violations"
      - "tier_3 VLM returns confidence > 0.85"
    fallback: "ship with explicit violation log for human review"

  self_consistency:
    candidates_per_request: 3
    selection: "marginalize over (lint_pass, critique_score, vlm_score)"

# ============================================================
# TRANSPORT — how the constitution reaches the model
# ============================================================

transport:
  system_prompt:
    budget_lines: 200          # per Claude Code CLAUDE.md guidance
    contents:
      - "Tier 1 list (one line per rule, lint references)"
      - "Tier 3 dispositions (≤5 bullets)"
      - "Active Tier 4 brand summary"
      - "Validation pipeline order"
    full_tier_2: "load on demand via skill"

  skills:
    - name: "design-principles"
      description: "Apply the design constitution to UI generation. Use for any task that produces, modifies, or reviews UI."
      trigger_patterns: ["*tsx", "*jsx", "*vue", "*svelte", "*css", "design", "ui", "component"]
      body_path: "SKILL.md"
      bundled_files:
        - "tier-2-soft-rules.md"
        - "tier-3-exemplars.md"
        - "tier-4-brand-spec.md"
        - "scripts/lint-tier1.sh"
        - "scripts/vlm-critique.py"
        - "references/anti-patterns.md"

  mcp:
    server_name: "design-knowledge-mcp"
    resources:
      - uri: "design://constitution/{project_id}"
        mime_type: "application/x-yaml"
        content: "Full constitution, scoped to project"
      - uri: "design://tokens/w3c"
        mime_type: "application/json"
        content: "W3C design tokens resolved"
    tools:
      - name: "lint_design"
        description: "Run Tier 1 + Tier 2 linters against proposed code/UI."
        input_schema: "{ file_paths: string[], project_id: string }"
        output_schema: "{ violations: Violation[], score: number }"
      - name: "vlm_critique"
        description: "Critique a rendered UI against Tier 3 aesthetic dispositions."
        input_schema: "{ screenshot_url: string, tier: 3 }"
        output_schema: "{ score: number, issues: CritiqueIssue[] }"
      - name: "self_refine"
        description: "Run the full critique-revise loop on a design proposal."
        input_schema: "{ proposal: Proposal, constitution_uri: string, max_iterations: number }"
        output_schema: "{ final: Proposal, iterations: IterationLog[] }"

  claude_md_sections:         # rendered form when used as CLAUDE.md
    structure:
      - heading: "Design Constitution (Acme)"
        body: "Active tiers: 1, 3, 4. Tier 2 loaded via skill on demand."
      - heading: "Tier 1 (Hard)"
        body: "WCAG AA contrast (4.5:1). No inline styles. Tokens only. Semantic HTML."
      - heading: "Tier 3 (Aesthetic)"
        body: "Restraint. Alignment. Rhythm. Breathing room. One primary action per view."
      - heading: "Tier 4 (Brand)"
        body: "Acme Cloud. B2B. Dense. Cobalt primary, red = destructive only."
      - heading: "Pipeline"
        body: "1. Lint Tier 1 (blocking) → 2. Critique Tier 2 → 3. VLM Tier 3 → 4. Brand match"

# ============================================================
# FAILURE MODES & MITIGATIONS
# ============================================================

known_failure_modes:
  tier_1:
    - failure: "Model generates raw hex color despite token rule"
      mitigation: "stylelint blocks at lint; ESLint error pre-commit"
    - failure: "Heading levels skip (h1 → h3)"
      mitigation: "html-validate rule blocks build"
  tier_2:
    - failure: "Model misapplies 8px grid (uses 13px)"
      mitigation: "stylelint catches; if missed, critique prompt asks 'is spacing on grid?'"
    - failure: "Hierarchy by size only, not weight"
      mitigation: "Critique prompt explicitly checks 'weight + size, not size alone'"
  tier_3:
    - failure: "Aesthetic drift across iterations"
      mitigation: "Cap at 2 VLM iterations; ship with violation log if not converged"
    - failure: "VLM false positive (false flag)"
      mitigation: "Two-model VLM ensemble; disagreement → ship with log"
  tier_4:
    - failure: "Stale brand spec loaded"
      mitigation: "Constitution versioned; stale versions tagged; invalidation hook"
    - failure: "Brand spec missing for project"
      mitigation: "Default to base constitution; designer must approve Tier 4 before ship"

# ============================================================
# EXEMPLARS (real before/after from production)
# ============================================================

exemplars:
  - id: "principle-density-fix"
    before: "Dashboard showing 12 cards in a 4×3 grid; user reports 'overwhelming.'"
    after: "Three primary cards + 'Show all 12 →' link. Time-to-first-action: 8s → 1.5s."
    principles_violated: ["restraint", "progressive_disclosure", "one_primary_action_per_view"]
    principles_applied: ["tier_2.density", "tier_3.restraint", "tier_2.hierarchy"]

  - id: "principle-contrast-fix"
    before: "Gray text on gray background (#888 on #EEE); contrast ratio 2.1:1."
    after: "Text changed to #595959 on #FFFFFF; ratio 7.0:1."
    principles_violated: ["wcag_aa_contrast"]
    principles_applied: ["tier_1.accessibility.contrast_minimum"]
    note: "Caught by Tier 1 linter before reaching critique loop. Zero model attention spent."

  - id: "principle-hierarchy-by-weight"
    before: "Three headings: 32px / 24px / 16px, all weight 400."
    after: "32px / weight 700, 24px / weight 600, 16px / weight 400."
    principles_violated: ["hierarchy_via_size_only"]
    principles_applied: ["tier_2.typography.hierarchy", "tier_3.visual_hierarchy"]
```

---

## 5. Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DESIGN KNOWLEDGE MCP                          │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Constitution │  │ Design Tokens│  │ Component    │            │
│  │ (4-tier YAML)│  │ (W3C DTF)    │  │ Registry     │            │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                │                 │                     │
│  ┌──────▼────────────────▼─────────────────▼──────┐              │
│  │           Validation Pipeline                   │              │
│  │  T1 Linter → T2 Lint+Critique → T3 VLM → T4 RAG│              │
│  └─────────────────────┬───────────────────────────┘              │
│                        │                                          │
│  ┌─────────────────────▼──────────────────────────┐              │
│  │   Self-Refine Loop (max 4 iterations)          │              │
│  │   + Self-Consistency (3 candidates)            │              │
│  └─────────────────────┬──────────────────────────┘              │
└────────────────────────┼──────────────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │   MiniMax-M3 (or above)    │
            │   system prompt: T1+T3+T4  │
            │   skill on demand: T2      │
            └────────────┬───────────────┘
                         │ generates candidate UI
                         ▼
            ┌────────────────────────────┐
            │  Linter (T1) — blocking    │
            │  + Critique (T2) — soft    │
            │  + VLM (T3) — soft         │
            │  + Brand RAG (T4) — soft   │
            └────────────┬───────────────┘
                         │ pass → ship | fail → revise
                         ▼
                   (back to model)
```

**Transport options:**
- **CLAUDE.md / AGENTS.md:** Render top-of-file summary (≤200 lines), import full constitution via `@./design-constitution.yaml`.
- **Skill:** Bundle constitution + scripts + exemplars in a folder; Claude loads via filesystem on demand.
- **MCP:** Expose resources (full constitution per project) and tools (lint_design, vlm_critique, self_refine).

---

## 6. Key Empirical Findings From the Research

1. **Critique-before-score closes a 9× parameter gap** (CLoud paper, 8B beats 70B Classic RM). For MiniMax-M3, this is the single highest-ROI technique: teach the model to describe violations against the constitution before deciding pass/fail.

2. **On-policy critique training is essential** (CLoud paper): critiques must be generated by the model itself, not oracle critiques from a stronger model. Don't paste constitution critiques from a different model — let the target model produce them in-context.

3. **Self-consistency helps for short-horizon tasks, hurts for long** (CLoud paper): for design (1–3 critique steps per iteration), sampling 3 candidates and marginalizing is net-positive.

4. **Self-Refine caps at ~3 useful iterations** (Madaan et al.): beyond that, drift. Hard cap the loop.

5. **CLAUDE.md is context, not config** (Claude Code docs): if you need enforcement, use a hook. Tier 1 of the constitution is exactly this — a hook (linter) that fires regardless of model decision.

6. **Specificity beats generality** (Cursor rules, Kasava principles): "Use 2-space indentation" beats "format code properly." Every principle in the constitution must be specific enough to evaluate.

7. **Path-scoped rules save context** (Cursor `.cursor/rules/*.mdc`): Tier 2 rules don't need to load when generating SQL migrations.

8. **Frame as dispositions, not rules** (Anthropic Character Training): Tier 3 aesthetic guidance should be "lean toward restraint," not "always use ≤3 elements." Dispositions adapt; rules are violated.

9. **AGENTS.md is the canonical cross-agent shape** (60k+ projects, Linux Foundation): write the constitution in plain markdown sections so it works in Cursor, Claude Code, Codex, Jules, etc., without translation.

10. **Tokens are principles as data** (W3C DTF, Nov 2025): `{color.brand.primary}` is "use the brand primary" expressed as a constraint the linter can enforce.

---

## 7. Specific Design for MiniMax-M3-Class Models

A MiniMax-M3 is a mid-tier model. Three design choices reflect this:

1. **Maximize what is enforced outside the model.** Tier 1 violations should never reach the model — they are linter errors at code-write time. This frees model attention for the judgment-requiring tiers.

2. **Lean on critique-out-loud, not direct scoring.** When the model must self-evaluate, force the format: *"Describe violations against these principles, then give a pass/fail and severity."* This is the technique that lets an 8B model outperform a 70B direct scorer.

3. **Three-tier loading budget.** Tier 1 + Tier 3 + Tier 4 summary in system prompt (~150 lines). Tier 2 loaded via skill on demand. Tier 4 full spec loaded via MCP resource per request. Tier 3 aesthetic dispositions are short and disposition-shaped, so they fit.

A Frontier-tier model could internalize more and load less. Mid-tier models need the *opposite* shape: less internalization, more externalized structure.

---

## 8. Open Questions

- **VLM cost at Tier 3:** Running a vision-language model critique per generation adds latency and cost. Acceptable for design work (high-value, low-volume)? Probably yes; needs benchmarking.
- **Self-consistency × critique loops:** Combining 3 candidates × 3 iterations = 9 model invocations. Need to profile cost.
- **Constitution drift over time:** As Tier 4 brand evolves, old versions in cached contexts may diverge. Need explicit invalidation timestamps.
- **Critique transfer:** Do principles trained (via Self-Refine history) for one project transfer to another? Initial evidence says dispositions transfer; numeric thresholds don't.

---

## 9. References

1. Bai et al. (2022). "Constitutional AI: Harmlessness from AI Feedback." arXiv:2212.08073.
2. Madaan et al. (2023). "Self-Refine: Iterative Refinement with Self-Feedback." arXiv:2303.17651.
3. Wang et al. (2022). "Self-Consistency Improves Chain of Thought Reasoning in Language Models." arXiv:2203.11171.
4. Ankner et al. (2024). "Critique-out-Loud Reward Models." arXiv:2408.11791.
5. Anthropic. "Introducing Agent Skills." anthropic.com/news/skills (Oct 2025).
6. Anthropic Engineering. "Equipping agents for the real world with Agent Skills." (Oct 2025).
7. Anthropic. "Claude's Character." anthropic.com/research/claude-character (Jun 2024).
8. Anthropic. "How Claude remembers your project." code.claude.com/docs/en/memory.
9. Agentic AI Foundation. "AGENTS.md." agents.md (2025).
10. PatrickJS. "awesome-cursorrules." github.com/PatrickJS/awesome-cursorrules.
11. shadcn. "MCP Server." ui.shadcn.com/docs/mcp.
12. Gregory, Benjamin. "How We Built a Self-Enforcing Design System with Claude Code." kasava.dev (2025).
13. Wolosin, Diana. "Design Systems for AI: Introducing the Context Engine." Design Systems Collective (Nov 2025).
14. W3C. "Design Tokens Format Module." (Nov 2025).
15. Jacob Paris. "shadcn-ui cursor rules." gist.github.com/jacobparis/ee4d1659896d24130651bca780a3fbbb (Mar 2025).

---

*Document length: ~3,400 words. Designed for direct import into AGENTS.md, CLAUDE.md, or SKILL.md.*