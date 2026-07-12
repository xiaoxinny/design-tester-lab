# The Gap Between Current AI Design Tools and a Complete Design Deliverable

**Research date:** 12 July 2026
**Scope:** What AI design tools actually output today vs. what a "complete design deliverable" should contain. Identify the missing artifacts.

---

## TL;DR

Every tool in the current landscape picks a **single slice** of the design deliverable. There is **no tool** that outputs tokens + components + interactive prototype + accessibility annotations + motion specs + content guidelines + design rationale together. The most-missing artifacts are:

1. **Design rationale / intent documentation** — the "why" behind decisions
2. **Motion / interaction specifications** — timing, easing, choreography
3. **Accessibility annotations & contrast reports** — auto-generated a11y audits
4. **Content guidelines** — voice, tone, copy patterns, microcopy rules
5. **Cross-system coherence rules** — what keeps the system from drifting as agents produce many screens

The big architectural pattern emerging in 2026 is the **Figma-native design workspace** (Figma Agent + Figma Make + Code Layers + Motion + MCP), which gets closest to a full deliverable set — but still leaves the semantic metadata (rationale, motion specs, a11y annotations, content voice) to humans.

---

## 1. What is a "Complete Design Deliverable"?

Synthesizing from current design practice (Figma's design-system model, UXTigers' "Artifact → Intent" framing, Replit's design-system skill spec, Builder.io's tokens model, the shadcn registry spec, Figma MCP guidelines):

A complete design deliverable is a **workspace**, not a file. It is a versioned bundle of:

| # | Artifact | Purpose | Typical format |
|---|----------|---------|----------------|
| 1 | **Design tokens** | Colors, type scale, spacing, radii, shadows, motion easings as machine-readable values | `tokens.json` / CSS variables / Figma Variables |
| 2 | **Component library** | Reusable atoms → organisms with variants, props, states | React/Vue components or Figma components w/ variants |
| 3 | **Sitemap / IA** | Page-level navigation, user-flow maps | Mermaid, graph XML, Figma frames |
| 4 | **Wireframes** | Low-fi layouts per screen | Figma frames, often unstyled |
| 5 | **High-fidelity mockups** | Per-screen polished visuals | Figma frames |
| 6 | **Interactive prototype** | Clickable flows, transitions, conditional states | Figma prototype links, code prototype |
| 7 | **Motion specifications** | Timing curves, durations, choreography | Lottie JSON, CSS, Figma Motion timeline |
| 8 | **Accessibility annotations** | WCAG checks, contrast tokens, focus order, ARIA roles, alt text | PDF annotations, code comments, a11y audits |
| 9 | **Content / copy guidelines** | Voice, tone, microcopy patterns, terminology | Markdown style guide |
| 10 | **Design rationale** | Why decisions were made, tradeoffs, research basis | Markdown / Notion / PRD-lite |
| 11 | **Design-to-code mapping** | Which component code each design maps to (Code Connect / registry) | `registry-item.json` |
| 12 | **Production code** | Generated or hand-written components implementing everything above | React/Vue/HTML/JSX |
| 13 | **Asset library** | Icons, illustrations, photography, logos | SVG, PNG, WebP |
| 14 | **Documentation** | Component API docs, usage examples | Markdown / MDX |

**Key insight (UX Tigers, May 2026):** "The old unit of design work was the artifact. The new unit is the workspace — a live environment containing code, components, prompt instructions, PRDs, research context, analytics, brand rules, agent roles, critique history." Almost no AI tool ships this bundle today.

---

## 2. Tool-by-Tool: What They Actually Output

### Code-Generating Design Tools (a.k.a. Design → Code)

| Tool | Output | Tokens | Components | States/Variants | Prototype (interactive) | Motion specs | A11y annotations | Content guidelines | Rationale / intent | Assets |
|------|--------|--------|-----------|----|----|----|----|----|----|----|
| **Builder.io / Visual Copilot** | React/Vue/Svelte/Angular/Qwik/Solid/HTML + Tailwind/CSS-in-JS | ✅ (CSS variables / Builder tokens) | ✅ (mapped to your codebase) | ⚠️ via component mapping | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Anima** | React/Vue/HTML/Tailwind from Figma | ❌ (only if user maps them) | ✅ (auto-detects) | ⚠️ | ⚠️ (interactive prototype) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Locofy / LocoAI** | React/Next.js/HTML/CSS via "Large Design Models" | ❌ | ✅ (component-based) | ⚠️ | ❌ | ❌ | ⚠️ via Locofy MCP (a11y as post-process step) | ❌ | ❌ | ❌ |
| **TeleportHQ** | UIDL (intermediate) → HTML/React/Vue/Angular; visual builder | ❌ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Zeplin** (legacy) | CSS/Swift/Kotlin/XML snippets (handoff only, not generation) | ✅ via Styleguide export | ✅ via Components panel | ✅ | ❌ | ❌ | ⚠️ manual annotations | ❌ | ❌ | ✅ |
| **Figma Dev Mode / Code Connect** | Code snippets, not generation | ⚠️ indirect | ✅ via Code Connect | ✅ | ❌ | ❌ | ⚠️ manual | ❌ | ❌ | ❌ |

### Design-Generating Code Tools (a.k.a. Prompt → Code)

| Tool | Output | Tokens | Components | Prototype | Motion | A11y annotations | Content guidelines | Rationale | Assets |
|------|--------|--------|-----------|----|----|----|----|----|----|
| **v0 (Vercel)** | JSX/React/Next.js multi-file code (App Router, Server Components, Server Actions) + Tailwind + shadcn/ui | ⚠️ reads tokens from shadcn theme/CSS vars but **does not generate a `tokens.json` artifact** | ✅ shadcn/ui components from registry | ⚠️ live preview, **not** Figma-grade prototype | ❌ | ⚠️ mentions WCAG in prompt but no annotation export | ❌ | ❌ | ❌ |
| **Bolt.new (StackBlitz)** | Full-stack web app code in WebContainers (Node, npm, deploy) | ❌ | ⚠️ whatever the model picks | ⚠️ live running app | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Lovable** | Multi-file code, plus scripted artifacts (PDF, PPTX, CSV, Mermaid) | ⚠️ can write tokens but typically inline | ⚠️ ad-hoc | ⚠️ live app | ❌ | ❌ | ❌ | ❌ | ⚠️ icons via SVG generation |
| **Replit Agent 4** | App code via pnpm monorepo; reads design system from custom skill (`SKILL.md` + component docs) | ✅ if system provides them | ✅ if system provides them | ⚠️ live preview | ❌ | ⚠️ guardrails file is a doc, not auto-audited | ❌ | ❌ | ✅ if assets folder provided |
| **Claude Design (Anthropic Labs, April 2026)** | Live HTML/CSS/JS/React/SVG in Artifacts panel + Claude Code handoff bundle | ⚠️ reads from codebase / docs during onboarding | ⚠️ reuse components from codebase | ✅ interactive prototypes, voice, video, 3D, shaders, 2 prompts to recreate complex pages (per Brilliant testimonial) | ⚠️ code-driven, motion via CSS/React | ❌ | ❌ | ❌ | ✅ web-capture of brand site |
| **Magic Patterns** | React/Tailwind/Vue production code; design-system upload | ⚠️ upload DS | ⚠️ DS upload | ⚠️ live preview | ❌ | ❌ | ❌ | ❌ | ⚠️ Chrome capture |
| **Motiff** | React/HTML with built-in DS (Material, Ant, Shadcn) + AI Consistency Checker | ✅ built-in | ✅ built-in | ❌ | ❌ | ⚠️ Consistency Checker | ❌ | ❌ | ❌ |

### Design-Generating Design Tools

| Tool | Output | Tokens | Components | States/Variants | Prototype | Motion | A11y | Content | Rationale | Assets |
|------|--------|--------|-----------|----|----|----|----|----|----|----|
| **Figma Design Agent (May 2026)** | Figma frames directly on canvas — explore, parallel prompts, design-system-aware via tokens/components, **can document components with all states, variants, and contextual examples** in one prompt | ✅ (Figma Variables — reads & writes) | ✅ (Figma components) | ✅ | ✅ | ❌ (separate Figma Motion skill at Config 2026) | ❌ | ❌ | ⚠️ "convert screenshot to dark mode" / "pressure-test design" — design-feedback framing, not rationale doc | ❌ |
| **Figma Make (Feb 2026, exited beta Q4 FY25)** | Code-backed prototypes from prompts/Figma frames; code layers can be visually edited; **canvas-to-code loop** | ⚠️ styles bundled from linked Figma library (Styles file with variables) | ⚠️ via Code Connect / import | ⚠️ | ✅ (interactive code prototypes) | ⚠️ via Figma Motion export CSS/JSON/React | ⚠️ Figma plugin ecosystem (not auto-generated) | ❌ | ❌ | ⚠️ via shaders (Config 2026) |
| **Figma Motion (Config 2026, June 2026)** | Timeline + keyframes in Figma, exports CSS/JSON/React/MP4/WebM/SVG/GIF | ⚠️ via Variables | ⚠️ | ⚠️ | ✅ animates layers | ✅ | ❌ | ❌ | ❌ | ⚠️ (shader fills via prompt) |
| **Figma Code Layers (Config 2026)** | Convert any design layer to interactive code with one click (early access July 2026) | ⚠️ | ⚠️ | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Google Stitch (was Galileo AI; acquired May 2025, now free)** | Standard mode: Figma frames OR HTML/CSS (Gemini 2.5 Flash); Experimental mode (Gemini 2.5 Pro): HTML/CSS only | ❌ | ⚠️ their library only | ❌ | ❌ | ❌ | ❌ (known weak: contrast, touch targets) | ❌ | ❌ | ⚠️ |
| **Uizard (Autodesigner 2.0)** | Text/screenshot/sketch → editable Figma-like mockups + React/CSS export | ❌ | ⚠️ limited library | ❌ | ⚠️ multi-screen click-through | ❌ | ❌ | ❌ | ❌ | ⚌ |
| **Relume** | **Sitemap → Wireframe → Style Guide → Export** to Figma/Webflow/React/Claude Design | ✅ style guide output | ✅ 1000+ components each on Figma/Webflow/React | ⚠️ | ⚠️ wireframes are essentially prototypes | ❌ | ❌ | ⚠️ AI-generated copy in wireframes | ❌ | ✅ |
| **UX Pilot** | Multi-screen flows from prompt + Figma export + HTML/CSS | ⚠️ train on DS | ⚠️ your DS | ⚠️ | ✅ flow prototypes | ❌ | ❌ predictive heatmaps (NOT a11y) | ❌ | ❌ | ⚠️ |
| **Visily** | Templates + screenshot-to-wireframe + collab, no code export | ❌ | ⚠️ templates | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Legacy / Superseded

| Tool | Status | Output |
|------|--------|--------|
| **Magician for Figma (Diagram\*)** | Acquired by Figma in June 2022; functionality largely superseded by Figma's native AI (Agents, Make, Shaders, Generative Plugins) | Text generation, icons, text-to-image inside Figma |

---

## 3. Architecture Patterns

### Pattern A — Figma-Native Design Workspace (new, dominant)
**Anchors:** Figma Agent (May 2026) + Figma Make (Feb 2026, GA) + Figma Motion (Config 2026) + Code Layers (Config 2026) + MCP server + Code Connect.

- **Agent lives inside the canvas**, fine-tuned on Figma files; deep context on components, variables, standards.
- **MCP server** is the bidirectional bridge — pull code from a codebase into Figma, push Figma frames back out as live prototypes or PRs.
- Workflow: Prompt → Design frames (Agent) → Code prototype (Make) → Canvas-to-code loop → Production via GitHub PR.
- **Closest thing to a full deliverable set**, but the metadata layer (a11y, motion specs, content voice, rationale) still lives in `Guidelines.md` as a static document, not as structured, machine-checked artifacts.
- Famous quote: "Designers need purpose-built tools that serve the essentials: exploration, experimentation, collaboration, and precision… You shouldn't have to choose. Speed or precision? AI generation or direct manipulation?" — Figma blog, May 20 2026.

### Pattern B — Code-Generating Design Tools (Design → Code)
**Anchors:** Builder.io Visual Copilot, Anima, Locofy, TeleportHQ, Figma Dev Mode.

- Pipeline: Figma frames → specialized model (LDM, Visual Copilot's 2M-data-point model) → Mitosis IR → framework-specific code → component-mapped codebase.
- **Tightest when DS already exists in both Figma and code**; weak otherwise. Output is code; no design rationale, no motion, no a11y in the artifact set.
- Builder's differentiator: it actually **emits a tokens file** (CSS variables) and maps Figma components to your code components — closer to deliverable #1 and #11 above, but still no rationalization artifacts.

### Pattern C — Design-Generating Code Tools (Prompt → Code)
**Anchors:** v0, Bolt.new, Lovable, Replit Agent 4, Claude Design, Magic Patterns, Motiff.

- Free-form or component-constrained code generation. The model picks the components.
- v0's leaked system prompt (Mar 2025 gist) makes the framing explicit: it's a React/Next.js + shadcn/ui + Tailwind code generator. It mentions **WCAG** and ARIA and contrast but does **not produce tokens.json, motion specs, or any artifact other than code**.
- Claude Design and Replit both have **onboarding** that reads your codebase/docs and bundles them into a system context — essentially "the workspace becomes context" — but the output is still mostly code, not the workspace's other artifacts.
- Lovable uniquely outputs non-design files too: PDF, PPTX, CSV, Mermaid diagrams — but not design system artifacts.

### Pattern D — Design Tools With Native AI
**Anchors:** Figma AI (above), Sketch AI, Adobe Firefly Design, Magician (legacy), **Figma AI** has subsumed most.

- Output stays in the design tool's native format (Figma file). Most reach parity with Pattern C output, minus live code.

### Pattern E — Sitemap + Wireframe-First Design Tools
**Anchors:** Relume (most prominent), UX Pilot (flows).

- **Starts with IA, not screens.** Generates sitemap from prompt → wireframes → style guide → exports to Figma, Webflow, React, or directly into Claude Design.
- Best at deliverable **#3 (sitemap/IA)**, **#4 (wireframes)**, and **#5 (mockups via Style Guide Builder)**. Weakest at code, motion, a11y.
- Relume has a **Claude Design direct export** of full DS (color, type, spacing, components) — closest cross-tool handoff in the industry.

### Pattern F — Code-Native Design Systems (emerging)
**Anchors:** shadcn/ui Registry, Replit Skill, Figma MCP, Vercel Geist.

- The design system itself is a **code-first artifact** (`registry-item.json`, `SKILL.md`, `tokens.css`). Models consume this directly.
- This is the glue the other patterns lack. A complete deliverable likely needs to be expressed in this registry format so any agent can re-emit it.

---

## 4. The Big Question: Does any tool produce tokens + components + prototype + a11y + content guidelines together?

**No.** Not one tool today produces the full set. Even Figma — the only vendor with access to all the underlying primitives — leaves rationale, motion specs, content voice, and accessibility audits to humans. Relume comes closest on the *design system* side (sitemap + wireframe + style guide + multi-target export), but can't generate production code, motion, or accessibility annotations. Claude Design is the most "prototype-rich" tool, but emits no tokens artifact and no rationale documentation.

The closest combination would be a workflow stitching:
**Relume (sitemap+wireframes+style guide) → Figma (Design Agent + Variables + components) → Figma Make (interactive prototype) → Figma Motion (choreography) → Claude Code or Replit (production code via Skills/MCP)** — but this is a hand-stitched multi-tool pipeline, not one product.

---

## 5. Where the Gap Is Most Painful

Ranked by what's most-missing AND most-blocked-by-current-AI:

### #1 Design rationale / design intent documentation
Every tool produces screens. Almost none produces the *reasoning* for the screens.
- UXTigers: "A prompt is not intent. Real intent includes the desired outcome, the unstated tradeoffs, the user's tolerance for risk, the context in which the result will be used, the standards by which success will be judged, and the failure modes the user would find unacceptable."
- Figma's Design Agent comes closest with its "pressure-test design" feature — but produces one-off critiques, not durable doc.
- **No tool currently emits a `RATIONALE.md` or `DECISIONS.md` as a first-class artifact.**

### #2 Motion / interaction specifications
- Figma Motion (Config 2026) shipped as a separate tool — motion isn't first-class in any AI generator.
- v0, Bolt, Lovable, Claude Design all produce interactive UI but **none emit Lottie JSON, motion timings, or a spec doc**.
- **Animation timing is buried in the code as CSS transitions** — invisible to the design system.

### #3 Accessibility annotations & contrast reports
- v0's prompt mentions WCAG AA / 4.5:1 contrast and ARIA — but doesn't output an a11y annotation layer.
- Google Stitch has *known weak accessibility* per third-party reviews — output often fails contrast and touch targets.
- Locofy mentions "accessibility as a post-process step via MCP" — closest to an a11y-audit artifact, but it's still opt-in and user-driven.
- **No tool auto-generates an a11y report, focus-order doc, or contrast audit alongside the design.**

### #4 Content guidelines / voice
- Relume auto-fills wireframes with AI copy — but no voice/tone doc.
- Claude Design has customizable tone — but no exported content style guide.
- **No tool emits a `VOICE.md` or `CONTENT.md` artifact.**

### #5 Real prototyping outside Figma
- Figma's prototype is the closest thing to a *universal* interactive prototype, but it's still Figma-locked.
- Claude Design's prototypes are code-rendered in the Artifacts panel — shareable as links, can be exported as standalone HTML/PPTX/PDF.
- v0/Bolt/Lovable all produce *live running apps* — these are arguably the most advanced prototypes available, but they look like code, not like deliverable-grade design prototypes.

### #6 Design-system coherence under swarm production
- UXTigers: "AI will produce many *adequate* screens that all seem defensible in isolation and incoherent in aggregate. Mediocrity will arrive well-dressed."
- **No tool today validates that a new generated screen is consistent with the existing system** in tokens, components, voice, and motion patterns — except Motiff's "AI Consistency Checker" (spacing/colors/components) and Replit's `guardrails.md` (rules a human writes, not auto-checked).

---

## 6. Root Cause: Why Current Tools Produce Code, Not Artifacts

Five structural reasons:

1. **The model is a code-generating LLM.** Most tools (v0, Bolt, Lovable, Claude, Replit) wrap a chat model that emits files. Files of code are the path of least resistance.
2. **No shared artifact specification.** The design industry doesn't have a `deliverable.json` equivalent of the shadcn `registry-item.json`. Each tool invents its own.
3. **Tokens, motion, a11y, content are *separate domains* the model has to be specifically prompted/expertized in.** Vendors pick one. Figma is the only vendor that touches the canvas primitives natively.
4. **The "complete deliverable" is multi-file, multi-format, and versioned.** Most tools are single-conversation; they don't ship a workspace.
5. **The reasoning layer is hard to extract.** LLMs reason internally; emitting the reasoning (rationale doc) is a UX problem nobody has solved well. Pressure-testing a design is a prompt; embedding the result in a durable artifact is not the default.

---

## 7. Comparison Matrix — Empty Cells Are the Gap

| Tool | Tokens (`tokens.json` / CSS vars) | Components library | States/variants | Interactive prototype | Motion specs | A11y annotations | Content/voice guidelines | Design rationale doc | Asset library |
|------|---|---|---|---|---|---|---|---|---|
| **v0** | ⚠️ (read, not written) | ✅ | ⚠️ | ⚠️ (live) | ❌ | ⚠️ (in code only) | ❌ | ❌ | ❌ |
| **Bolt.new** | ❌ | ⚠️ | ⚠️ | ⚠️ (live) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Lovable** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| **Replit Agent 4** | ✅ (via skill) | ✅ (via skill) | ✅ (via skill) | ⚠️ | ❌ | ⚠️ (via `guardrails.md`) | ❌ | ❌ | ✅ |
| **Claude Design** | ⚠️ | ⚠️ | ⚠️ | ✅ | ⚠️ (code-driven) | ❌ | ❌ | ❌ | ✅ |
| **Figma Design Agent** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ (critique, not doc) | ❌ |
| **Figma Make** | ⚠️ (Styles file) | ⚠️ | ⚠️ | ✅ | ⚠️ via Motion | ❌ | ❌ | ❌ | ❌ |
| **Figma Motion** | ⚠️ | ⚠️ | ⚠️ | ✅ | ✅ | ❌ | ❌ | ❌ | ⚠️ (shaders) |
| **Google Stitch / Galileo** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Relume** | ✅ (style guide) | ✅ (1000+) | ⚠️ | ⚠️ (wireframe) | ❌ | ❌ | ⚠️ (AI copy, no voice doc) | ❌ | ✅ |
| **Builder.io Visual Copilot** | ✅ | ✅ | ⚠️ via mapping | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Anima** | ❌ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Locofy** | ❌ | ✅ | ⚠️ | ❌ | ❌ | ⚠️ via MCP | ❌ | ❌ | ❌ |
| **TeleportHQ** | ❌ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Uizard** | ❌ | ⚠️ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Magician (legacy)** | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| **Motiff** | ✅ (built-in) | ✅ (built-in) | ⚠️ | ❌ | ❌ | ⚠️ (Consistency Checker) | ❌ | ❌ | ❌ |
| **UX Pilot** | ⚠️ | ⚠️ | ⚠️ | ✅ (flows) | ❌ | ❌ | ❌ | ❌ | ❌ |

Empty cells = the gap.

---

## 8. Implications for Building a "Complete Deliverable" Tool

A tool that produces the *full set* would need:

1. **Multi-artifact emission** — code + tokens.json + Figma file + Lottie JSON + Markdown rationale + a11y report + content style guide in one prompt.
2. **An artifact manifest** — `deliverable.json` (analogous to `registry-item.json`) that lists every artifact and lets tools/clients selectively consume them.
3. **A reasoning/trace export** — every choice the agent made, with rationale, persisted as a `DECISIONS.md` or RL-style trace.
4. **Built-in audit passes** — auto a11y audit (axe-core or Stark-style), contrast check, motion-spec emission, voice consistency check.
5. **Versioned workspace semantics** — treat the deliverable as a workspace (code, components, instructions, PRDs, research, brand rules, agent roles, critique history) — not a file.
6. **Cross-tool handoff primitives** — Relume↔Claude Design (color/type/spacing/components) is the only one shipping today. Figma MCP + Code Connect is another. Need more, especially for motion and rationale.
7. **Coherence-under-swarms guardrails** — when an agent emits 50 screens, none should drift from tokens, voice, components, or motion. Motiff's Consistency Checker is the closest existing primitive.

---

## Sources (used in this report)

- Figma blog, "The Figma Design Agent is Here" (May 20 2026)
- Figma blog, "The Figma canvas is now open to agents"
- Figma blog, "The TL;DR on MCP"
- Figma Make product page, https://www.figma.com/make/
- Figma AI catalog, https://www.figma.com/ai/
- Figma MCP guidelines, https://www.inthepocket.design/guidelines/figma-mcp/prototypes
- CMSWire, "Figma Launches Code Layers & Motion at Config 2026" (June 24 2026)
- Anthropic, "Introducing Claude Design by Anthropic Labs" (April 17 2026)
- Vercel, "AI-powered prototyping with design systems"
- StackBlitz, https://github.com/stackblitz/bolt.new
- Lovable docs, "Generate files and analyze data"
- Replit docs, "Setting up a Design System"
- Replit blog, "Implementing RUI, Replit's Design System"
- Relume, https://www.relume.io/ and "Relume Library MCP"
- Builder.io, "Introducing Visual Copilot" + design-to-code + design tokens docs
- Locofy docs and product page, https://www.locofy.ai/convert/figma-to-react
- Anima Figma plugin listing (Figma Community)
- Google Stitch review (LogRocket, Sept 2025)
- UX Pilot vs Galileo comparison
- MindStudio, "What Is Claude Design?"
- Jason Kneen, "v0 System Prompt" gist (March 2025)
- UXTigers, "Design Changing from Artifact-Production to Intent-Shaping" (May 21 2026)
- AIDesigner, "8 Best Figma to Code Tools (2026)" and "Best Uizard Alternatives (2026)"
- Puck, "Top 5 AI Tools for UI Generation in 2026" (April 17 2026)
- shadcn/ui Registry docs
- Vercel geist design system

