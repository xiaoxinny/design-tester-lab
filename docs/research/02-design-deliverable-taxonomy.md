# The Complete Design Deliverable Taxonomy

> **Scope:** What artifacts a senior designer (or a design system team) actually produces for **a single product surface** — e.g. a Pricing page, a Checkout flow, a Dashboard widget — versus what current AI tools (v0, Claude Design, Figma Make, Galileo, Lovable, Bolt) currently output.
>
> **Premise:** Today's AI tools emit **HTML/JSX**. That's one artifact. A real design deliverable is a **bundle of ~22 artifact types** spanning tokens, components, motion, prototype, content, accessibility, IA, and machine-readable schemas.

---

## 1. The Gap — What AI Tools Produce vs What a Designer Delivers

| Dimension | v0 / Claude Design / Figma Make / Galileo / Lovable | Senior designer / design system team |
|---|---|---|
| **Output format** | Single React/HTML file | 22+ distinct artifact files in multiple formats (Figma, JSON, MDX, Storybook, video, MD, SVG) |
| **Tokens** | Inline Tailwind/CSS values; no exportable token layer | W3C DTCG `.tokens.json`, platform exports (CSS, SCSS, iOS Swift, Android XML, Compose) via Style Dictionary |
| **Components** | One ad-hoc JSX per surface | Reusable library — Button, Input, Card, Modal, Nav, Toast — with **all variants × all states** + Storybook CSF stories |
| **States** | Static default only | State matrix: default, hover, focus, active/pressed, disabled, loading, error, success, empty, selected, indeterminate, read-only |
| **Theming** | Hardcoded light | Light + dark (and optional high-contrast) via semantic token aliases |
| **Motion** | None, or hardcoded `transition` strings | Motion spec: principles + duration tokens + easing curves (cubic-bezier) + named effects + per-component animation specs |
| **Accessibility** | Best-effort markup | WCAG 2.2 AA annotations: contrast matrix, focus rings, target size, keyboard flow, ARIA map, screen-reader behavior |
| **Responsive** | One breakpoint | Breakpoint system + per-breakpoint layouts (xs/sm/md/lg/xl/2xl) |
| **Documentation** | Code comments | Component spec ("spec.md"), anatomy diagram, rules & limitations, content guidelines, MDX in Storybook, Zeroheight/Frontify page |
| **Prototype** | The HTML itself runs | Interactive prototype with: triggers, transitions, animations, overlays, variable-driven states, device preview |
| **IA / Flow** | None | Sitemap, user flow diagram, edge-case flow, error flow |
| **Voice & Tone** | Lorem-style filler | Voice & tone guide, microcopy library, content guidelines per component |
| **Handoff** | Drop the file | Inspect-able Figma file + Zeplin/Specify specs + Storybook + dev-mode CSS/Swift/XML code panel |

**The point:** AI tools emit the *body*. A design deliverable is the body **plus** the operating manual — the system that lets other designers and engineers reproduce, extend, theme, test, and trust it.

---

## 2. The Canonical Artifact Set (22 artifacts)

Numbered by layer, from foundation → surface. Each row: **canonical format • machine-readable schema (if any) • producers • consumers**.

### LAYER A — Foundations (tokens, system primitives)

#### A1. Color palette
- **Format:** W3C DTCG `.tokens.json` file (extension `.tokens` or `.tokens.json`); rendered as color swatches in Figma/Zeroheight
- **Schema:** `$value` (object with `colorSpace` + `components` for sRGB / Display P3 / OKLCH), `$type: "color"`, `$description`, optional `$extensions`
- **Tiers:**
  - **Primitive** (`blue.500: #2563eb`) — raw values, never used in product UI
  - **Semantic / alias** (`color.action.primary: { $value: "{blue.500}" }`) — what product UI binds to
  - **Component** (`button.primary.bg: { $value: "{color.action.primary}" }`) — surface-specific overrides
- **Coverage:** Primary brand, secondary, semantic (success / warning / error / info), neutrals (50→950 ramp), light + dark modes
- **Producers:** Figma Variables, Tokens Studio, Supernova, Specify
- **Consumers:** Style Dictionary, StyleX, Panda CSS, Tailwind theme, Tailwind CSS v4 `@theme`, shadcn `components.json`

```jsonc
// tokens/colors.tokens — W3C DTCG excerpt
{
  "color": {
    "$description": "Brand & semantic color tokens",
    "brand": {
      "primary":   { "$value": "#2563eb", "$type": "color", "$description": "Brand primary blue" },
      "secondary": { "$value": "#7c3aed", "$type": "color" }
    },
    "semantic": {
      "success": { "fg":  { "$value": "{color.green.600}", "$type": "color" },
                   "bg":  { "$value": "{color.green.50}",  "$type": "color" } },
      "error":   { "fg":  { "$value": "{color.red.600}",   "$type": "color" },
                   "bg":  { "$value": "{color.red.50}",    "$type": "color" } }
    },
    "$extensions": { "io.specify.app": { /* vendor data */ } }
  }
}
```

#### A2. Typography system
- **Format:** W3C DTCG `$type: "typography"` (composite: `fontFamily`, `fontWeight`, `fontSize`, `lineHeight`, `letterSpacing`); **plus** a fluid-type scale
- **Schema:** DTCG composite type — a typography token's `$value` is an object with the keys above
- **Coverage:** Display, Heading (h1–h6), Body (lg/md/sm/xs), Caption, Overline, Mono; line-heights, letter-spacing, optical sizing
- **Producers:** Figma Variables, Tokens Studio, Google Fonts, Adobe Fonts, Typekit
- **Consumers:** Style Dictionary → CSS `font-*` properties; Tailwind `fontSize` config

```jsonc
{
  "type": {
    "display": { "$type": "typography", "$value": {
      "fontFamily": "Inter", "fontWeight": 700,
      "fontSize": "3.75rem", "lineHeight": 1.1, "letterSpacing": "-0.02em" }},
    "body":    { "$type": "typography", "$value": {
      "fontFamily": "Inter", "fontWeight": 400,
      "fontSize": "1rem", "lineHeight": 1.5, "letterSpacing": "0" }}
  }
}
```

#### A3. Spacing scale
- **Format:** W3C DTCG `$type: "dimension"` (or "spacing"); numeric value + unit
- **Convention:** **4-pt or 8-pt base** — Tailwind's default is `0, 1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128` (×0.25rem); Material 3 uses 4dp grid
- **Also includes:** Sizing tokens (component height min/max), negative space (margins, gaps)
- **Producers:** Tokens Studio, Style Dictionary config
- **Consumers:** Tailwind `spacing`, CSS custom properties, `gap`/`padding`/`margin` everywhere

#### A4. Elevation / shadow system
- **Format:** W3C DTCG `$type: "shadow"` (composite: `color`, `offsetX`, `offsetY`, `blur`, `spread`, optional `inset`)
- **Coverage:** Named levels (`elevation.0` … `elevation.5`), paired with **z-index tokens** (`z.dropdown`, `z.modal`, `z.toast`, `z.tooltip`)
- **Reference:** Material 3 defines 6 levels (0, 1, 3, 6, 8, 12 dp) + tonal elevation; Atlassian defines "raised" and "overlay"
- **Producers:** Tokens Studio, Figma Effects styles
- **Consumers:** Tailwind `boxShadow`, CSS `box-shadow`, iOS `shadowOpacity`

```jsonc
{
  "elevation": {
    "1": { "$type": "shadow", "$value": {
      "color": "#00000020", "offsetX": "0", "offsetY": "1px",
      "blur": "2px", "spread": "0" }},
    "3": { "$type": "shadow", "$value": {
      "color": "#0000001a", "offsetX": "0", "offsetY": "4px",
      "blur": "8px", "spread": "-1px" }}
  }
}
```

#### A5. Border-radius scale
- **Format:** W3C DTCG `$type: "dimension"`
- **Coverage:** `none | xs | sm | md | lg | xl | 2xl | full` (Tailwind defaults: 0, 2px, 4px, 6px, 8px, 12px, 16px, 24px, 9999px)

#### A6. Motion / animation system
- **Format:** W3C DTCG `$type: "duration"` (e.g. `150ms`) + `$type: "cubicBezier"` (e.g. `(0.4, 0, 0.2, 1)`); **plus** named effects as composite tokens
- **Schema:** Two new DTCG types — `duration` and `cubicBezier` — finalized in the 2025.10 spec
- **Coverage:**
  - **Principles** (high-level brand stance: Carbon's "purposeful, intuitive, seamless"; Fluent's "physical, functional, continuous, contextual")
  - **Duration scale** (`instant: 0`, `fast: 150ms`, `base: 250ms`, `slow: 400ms`, `slower: 600ms`)
  - **Easing curves** — minimum three custom: ease-in (exit), ease-out (enter), ease-in-out (move); Material 3 uses `emphasized` (0.2, 0, 0, 1) as the signature
  - **Named effects** (`fade-in`, `slide-up-200`, `press-scale`) — tokenized and reused
- **Producers:** Tokens Studio, Rive/Lottie, Framer Motion presets
- **Consumers:** Framer Motion, GSAP, CSS `transition`, iOS `UIView.animate`, Jetpack Compose `tween`

```jsonc
{
  "motion": {
    "duration": {
      "instant": { "$type": "duration", "$value": "0ms" },
      "fast":    { "$type": "duration", "$value": "150ms" },
      "base":    { "$type": "duration", "$value": "250ms" },
      "slow":    { "$type": "duration", "$value": "400ms" }
    },
    "easing": {
      "standard":      { "$type": "cubicBezier", "$value": [0.2, 0, 0, 1] },
      "decelerate":    { "$type": "cubicBezier", "$value": [0, 0, 0.2, 1] },
      "accelerate":    { "$type": "cubicBezier", "$value": [0.3, 0, 1, 1] }
    }
  }
}
```

#### A7. Iconography system
- **Format:** SVG sprite + individual `.svg` files; canonical set as a single icon library (Lucide, Heroicons, Phosphor, Material Symbols, Tabler, custom)
- **Schema (Specify):** `type: "vector"`, `type: "icon"`; SVG with `<symbol id="icon-name">` references
- **Coverage:** Style guide (stroke width, corner radius, grid — usually 24×24 with 1.5–2 px stroke), naming convention, sizes (16/20/24/32), two-tone support, RTL flipping
- **Producers:** Figma component set, IconJar, SVGO
- **Consumers:** React (lucide-react, heroicons, phosphor-react), inline SVG, icon font (legacy)

#### A8. Breakpoint / responsive scale
- **Format:** W3C DTCG `$type: "dimension"` for min-widths; sometimes custom
- **Standard scale (Material 3):** `compact: 0–600dp`, `medium: 600–840dp`, `expanded: 840–1200dp`, `large: 1200–1600dp`, `extra-large: 1600dp+`
- **Tailwind:** `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`
- **Bootstrap 5:** `xs/sm/md/lg/xl/xxl`
- **Coverage:** Each component specifies behavior at every breakpoint

---

### LAYER B — Components (the library)

#### B1. Component library (master components)
- **Format:** Figma Components (master + instances with auto-layout + variants); **plus** Storybook CSF stories; **plus** React/Vue/Swift/Compose source code
- **Schema (Storybook CSF 3):**
  ```ts
  // Button.stories.ts
  import type { Meta, StoryObj } from '@storybook/react';
  import { Button } from './Button';

  const meta = {
    title: 'Forms/Button',
    component: Button,
    parameters: { layout: 'centered', chromatic: { viewports: [375, 768, 1440] } },
    argTypes: {
      variant: { control: 'select', options: ['primary','secondary','tertiary','plain'] },
      size:    { control: 'inline-radio', options: ['micro','slim','medium','large'] },
      tone:    { control: 'select', options: ['default','success','critical'] },
      state:   { control: 'select', options: ['default','hover','active','focus','disabled','loading'] }
    }
  } satisfies Meta<typeof Button>;
  export default meta;
  type Story = StoryObj<typeof meta>;

  export const Primary: Story = { args: { variant: 'primary', children: 'Add product' } };
  export const Loading: Story = { args: { ...Primary.args, loading: true } };
  ```
- **Coverage:** For every interactive primitive:
  - Button (variants × sizes × tones × states)
  - Input, Textarea, Select, Combobox, Date picker, Checkbox, Radio, Switch, Slider, File upload
  - Card, Modal/Dialog, Drawer, Popover, Tooltip, Toast/Snackbar, Banner
  - Nav (Top bar, Side nav, Tabs, Breadcrumbs, Pagination)
  - Table (with sort/filter/pagination), List, Tree
  - Avatar, Badge, Chip, Tag, Progress, Spinner, Skeleton
- **Producers:** Figma (masters), Storybook (code + stories), shadcn/ui registry, Headless UI, Radix
- **Consumers:** Product engineers; Storybook; Chromatic visual regression; a11y tests

#### B2. Component states (state matrix)
- **Format:** A grid/table showing every component in every state — typically a Figma frame per component with all states side-by-side, mirrored in Storybook stories
- **Standard state set (canonical, used across Material, Polaris, Carbon, Atlassian):**
  - `default` (rest)
  - `hover`
  - `focus` (visible focus ring, WCAG 2.2 SC 2.4.7 + 2.4.11 ≥3:1 contrast)
  - `active` / `pressed`
  - `disabled`
  - `loading` (spinner replaces content)
  - `error` / `invalid` (form fields)
  - `success` / `valid`
  - `empty` (no data)
  - `selected` / `checked` / `indeterminate` (form controls)
  - `read-only`
  - `skeleton` (placeholder while loading)
  - `dragged`, `drop-target` (drag-and-drop surfaces)
- **Producers:** Figma Variants (a `state` property on every component), Storybook stories, Chromatic snapshot tests

#### B3. Component anatomy diagram
- **Format:** Static labeled diagram (Figma frame with redlines; or PNG/SVG export)
- **Coverage:** Names every sub-part — e.g., Button = `[container, leadingIcon, label, trailingIcon, spinner, focusRing]`
- **Schema:** Markdown table inside `spec.md` mapping part-name → token reference
- **Producers:** Figma with measurements panel; Zeroheight embedded image
- **Reference:** Brad Frost's anatomy breakdowns; EightShapes' component specifications

#### B4. Component specification ("spec.md")
- **Format:** Markdown file (or Zeroheight/Storybook MDX page) per component
- **Sections (canonical, per Nathan Curtis / EightShapes + UX Collective pattern):**
  1. **Definition & usage** — what it is, when to use it, when *not* to use it
  2. **Anatomy** — labeled parts, naming convention, pixel/px dimensions
  3. **Variants & properties** — table of props (name, type, default, description)
  4. **States** — list with linked visuals
  5. **Behaviors & interactions** — keyboard, mouse, touch, ARIA
  6. **Rules & limitations** — edge cases (truncation with tooltip), max content length, grouping behavior
  7. **Accessibility** — WCAG criteria touched, keyboard map, ARIA roles
  8. **Content guidelines** — microcopy rules, voice/tone, button verbs
  9. **Animation** — which motion tokens, which duration, which easing, which effect
  10. **Code reference** — link to source, link to Storybook, link to Figma master
  11. **Do / Don't** — visual examples
  12. **Changelog** — version history
- **Producers:** Zeroheight, Frontify, Storybook MDX, Notion
- **Consumers:** Designers, engineers, PMs — the operating manual

---

### LAYER C — Surface (the product itself)

#### C1. Wireframes (low-fidelity)
- **Format:** Figma low-fi frames, paper sketches, or Balsamiq — grayscale boxes & labels
- **Purpose:** Layout, hierarchy, IA — *before* visual commitment
- **Coverage:** Every screen in the flow; one per breakpoint when responsive matters

#### C2. High-fidelity mockups
- **Format:** Figma frames with full visual design applied (tokens, components, imagery)
- **Coverage:** Every screen, every state of every screen (per B2), every breakpoint

#### C3. Interactive prototype
- **Format:**
  - **Figma prototype** with hotspots, triggers (click/hover/drag/keyboard), destinations, transitions (Instant, Dissolve, Smart Animate, Push, Slide, Move), easing, duration
  - **Code prototype:** Storybook stories (runnable in browser), v0 playground, shadcn examples, Framer, Principle, ProtoPie
  - **Video / Lottie** for stakeholder demos
- **Triggers (Figma):** On click, On drag, On hover, While pressing, Mouse enter, Mouse leave, Mouse down, Mouse up, Key/gamepad, After delay, On viewport enter/exit, Repeat
- **Animations supported:** Smart Animate (animates matched layers' scale/position/opacity/rotation/fill across frames; supports texture, noise, blur; does NOT support drop shadow or inner shadow)
- **State of art (2026):** Figma Variables + conditional logic + Lottie/Rive embeds + runnable code in Storybook. **A prototype today is BOTH a Figma flow AND a code prototype.**
- **Producers:** Figma (Prototype mode), Framer, ProtoPie, Rive, Storybook

#### C4. Exported assets
- **Format:** PNG/SVG @1x/2x/3x, PDF, optimized via SVGO/TinyPNG
- **Coverage:** Logos, illustrations, photos (with license), icons (link to A7), favicons, OG images
- **Producers:** Figma export, Specify (auto-export to repo), Anima (asset generation)

---

### LAYER D — Systems (cross-cutting concerns)

#### D1. Information architecture
- **Format:**
  - **Sitemap** — hierarchical tree of pages/sections (Figma frame, Miro, Notion, XML sitemap.xml)
  - **User flow** — directed graph: nodes = screens, edges = actions (Figma with Autoflow, Miro, Whimsical, Mermaid flowchart)
  - **Task flow** — linear sequence for a single task
- **Producers:** Miro, FigJam, Whimsical, Mermaid
- **Consumers:** Engineers (routing), QA (test coverage)

#### D2. Voice & tone / content guidelines
- **Format:** Markdown guide (e.g. Mailchimp Content Style Guide, Shopify Polaris content guidelines); per-component microcopy rules
- **Coverage:**
  - Voice attributes (3–5 adjectives: e.g., "clear, confident, warm, concise, respectful")
  - Tone variations by context (celebratory, neutral, apologetic, urgent)
  - Grammar & mechanics (capitalization, punctuation, dates/numbers)
  - Inclusive language rules
  - **Microcopy patterns:** empty states ("No projects yet — create your first one"), error messages (what + why + how to fix), button labels (verb-led: "Add product" not "Submit"), confirmation patterns
  - Per-component rules — e.g. "Modal titles: sentence case, no period; max 60 chars"
- **Producers:** Content designers, UX writers; published in Zeroheight/Frontify alongside components
- **Reference:** Polaris (Shopify), Material Design content guidance, GOV.UK content design

#### D3. Accessibility annotations
- **Format:** A11y spec doc per component (WCAG 2.2 AA baseline), Figma annotations (Stark plugin, Figma a11y plugins), Storybook a11y addon (axe-core) results
- **Coverage:**
  - **Color contrast matrix** (4.5:1 body text, 3:1 large text/UI components, 3:1 focus ring vs unfocused)
  - **Focus order & tab sequence** (per screen)
  - **Keyboard map** (Tab/Shift+Tab/Enter/Space/Arrow/Esc per component)
  - **ARIA roles & properties** (e.g., `role="button"`, `aria-expanded`, `aria-controls`, `aria-describedby`, `aria-live` for toasts)
  - **Touch target sizes** (WCAG 2.2 SC 2.5.8: ≥24×24 CSS px AA; 44×44 AAA)
  - **Screen reader behavior** (what VoiceOver/NVDA announces)
  - **200% text resize behavior** (no clipping, no broken layouts)
  - **Reduced motion** (`prefers-reduced-motion` honored)
  - **Color-independence** (no color-only state conveyance)
- **Producers:** Stark plugin, A11y Annotation Kit (Figma), Storybook `@storybook/addon-a11y` (powered by axe-core, catches ~57% of WCAG issues automatically)
- **Consumers:** Engineers (implementation), QA (manual audit), Chromatic (CI a11y testing)

#### D4. Design tokens export (machine-readable, multi-platform)
- **Format:** Single source = W3C DTCG `.tokens.json` → Style Dictionary (v4 / v5) compiles to:
  - **Web:** CSS custom properties, SCSS variables, LESS, JS/TS modules, Tailwind theme
  - **iOS:** Swift `UIColor`/`UIFont` extensions, JSON
  - **Android:** XML resources (`colors.xml`, `dimens.xml`), Jetpack Compose `Color`/`Typography` Kotlin
  - **Flutter:** `dart` constants
  - **React Native:** JS objects, StyleSheet
- **Tool chain:** Figma Variables → Tokens Studio → GitHub → Specify CLI → Style Dictionary → multi-platform output
- **Why DTCG matters:** the W3C format (`.tokens` extension, `application/design-tokens+json` MIME) is the vendor-neutral exchange format. Tools that import it: Figma, Sketch, Penpot, Adobe XD, Style Dictionary, Terrazzo, Storybook (via addon), Zeroheight, Supernova

---

### LAYER E — Governance (meta)

#### E1. Governance / contribution model
- **Format:** Markdown doc (CONTRIBUTING.md)
- **Coverage:** Who owns the system, RFC process, version policy (semver), deprecation timeline, breaking-change protocol
- **Producers:** Design ops lead

#### E2. Changelog / version log
- **Format:** `CHANGELOG.md` (Keep a Changelog format), semver tags in git
- **Producers:** Maintainers on every release

#### E3. Adoption / usage metrics
- **Format:** Snowflake-style dashboard; Storybook telemetry; Figma library analytics
- **Coverage:** % of screens using system components, % of screens using latest version, top custom divergences

---

## 3. The Tool-to-Artifact Production Matrix

What each canonical tool actually emits:

| Tool | Emits | Consumes | Used by |
|---|---|---|---|
| **Figma** | Native `.fig` files, Components, Variables (modes/themes), Prototype flows, code panel output (CSS / Swift / XML), asset exports | Tokens via plugins, brand guidelines | Designers |
| **Tokens Studio (Figma plugin)** | DTCG `.tokens.json` (or legacy), per-set, per-theme | Figma styles/variables; JSON | Designers |
| **Style Dictionary** | CSS / SCSS / LESS / iOS Swift / Android XML / Compose / Flutter / JS / Tailwind theme from tokens | `.tokens.json` (DTCG), `.json` (legacy) | Build pipelines |
| **Specify** | Configurable multi-format exports via CLI / REST API / GitHub App; repositories of tokens + assets + components | Figma collection, Tokens Studio | Designers → Engineers (CI) |
| **Supernova** | Tokens + component code + documentation site; export pipelines to GitHub/GitLab/Bitbucket/Azure DevOps | Figma via Variables Sync plugin or Tokens Studio | Design system teams |
| **Storybook** | Live component playground, MDX docs, a11y/visual/interaction tests, Chromatic visual diffs | Source components | Engineers |
| **Chromatic** | Visual regression snapshots, a11y CI, interaction test runs | Storybook stories | Engineers / QA |
| **Zeroheight** | Public/internal design system docs site (styleguide); syncs with Figma + Storybook + Tokens Studio | Figma libraries, Storybook, tokens | Designers + stakeholders |
| **Frontify** | Brand + design system hub; DAM + styleguide | Figma, brand assets | Brand + design ops |
| **Anima** | React/Vue/HTML code from Figma frames; production-ready components | Figma files | Designers → Engineers (handoff) |
| **Zeplin** | Specs (spacing, colors, typography), assets, code snippets (CSS/Swift/XML) per Figma frame | Figma / Sketch / XD | Engineers |
| **Avocode** | (Legacy, sunset in 2023) Inspect + export | Sketch / Figma / XD | Engineers (historical) |
| **DhiWise** | Code generation from Figma/Sketch to multiple frameworks | Figma | Engineers |
| **shadcn/ui registry** | `components.json` config + `registry-item.json` schema for individual components | Tailwind theme + Radix primitives | Engineers |
| **StyleX / Panda CSS** | Atomic CSS from JS-defined tokens | Token objects | Engineers |
| **Lottie / Rive** | Runtime-animated micro-interactions | After Effects / Rive editor | Engineers |

---

## 4. What AI Tools (v0, Claude Design, Figma Make, Galileo) Currently Produce

| Tool | Output | What's missing |
|---|---|---|
| **v0 (Vercel)** | React + Tailwind JSX; shadcn components; live preview | Tokens are inline Tailwind classes; no token export; no Figma source; no Storybook; no motion spec; no a11y audit beyond markup; single light theme |
| **Claude Design** | React JSX preview; can be exported to Figma Make | Same as v0; no state matrix; no doc generation; no a11y annotations |
| **Figma Make** | Figma frames generated from prompt; variables/components | Tokens must be manually extracted; no MDX docs; no Storybook; limited motion |
| **Galileo AI** | UI mockup images / Figma frames | Static images; no code, no tokens, no spec |
| **Lovable / Bolt.new** | Full-stack React + backend | Same token/component gaps as v0 |
| **Visily** | Figma-style mockups from prompt/screenshot | Static designs; no token pipeline |

**The systemic gap:** All five produce *one artifact* (HTML, JSX, or static frames) instead of a *bundle of ~22 artifacts*. None emit a DTCG token file, a state matrix, a spec.md, an a11y annotation, or a motion token table.

---

## 5. What Prototyping Actually Means in 2026

Three coexisting definitions:

1. **Figma-style static-link prototype** — frames connected by triggers, animated with Smart Animate (scale, position, opacity, rotation, fill only; no drop shadow animation). Variables and conditional logic (since 2024) enable state-driven prototypes. Used for stakeholder demos, user testing.

2. **Code-based interactive prototype** — Storybook stories (CSF), v0 playgrounds, shadcn examples, CodeSandbox embeds. **State-driven** (URL state, props), **runnable in browser**, **testable** (Storybook play functions can simulate user interaction and assert DOM). Used for engineering review, visual regression (Chromatic), a11y testing (axe-core).

3. **Animation-faithful prototype** — Rive (interactive vector animations, state machines), Lottie (After Effects → JSON for marketing), Framer Motion / Motion One (code animation). Used for motion design, complex micro-interactions, loading sequences.

**Best practice (2026):** ship BOTH a Figma prototype (for review/buy-in) AND a Storybook playground (for engineering). The two stay in sync via the design tokens.

---

## 6. The Pricing-Page Concrete Example

A senior designer producing a **Pricing page** surface delivers the following artifacts (paths illustrative):

```
/pricing-surface/
├── README.md                          ← what this surface is, scope, owners
│
├── tokens/                            ← LAYER A
│   ├── colors.tokens                  ← A1: W3C DTCG color (primitive + semantic + component)
│   ├── typography.tokens              ← A2
│   ├── spacing.tokens                 ← A3
│   ├── elevation.tokens               ← A4
│   ├── radius.tokens                  ← A5
│   ├── motion.tokens                  ← A6 (durations, easings)
│   ├── breakpoints.tokens             ← A8
│   └── icons/                         ← A7 (SVG sprite + individual files)
│
├── components/                        ← LAYER B (every interactive primitive used on the page)
│   ├── Button/
│   │   ├── Button.tsx                 ← source
│   │   ├── Button.stories.tsx         ← CSF3 stories (Primary, Loading, Disabled, etc.)
│   │   ├── Button.mdx                 ← MDX doc (rendered in Storybook)
│   │   ├── Button.spec.md             ← component spec (12 sections per B4)
│   │   └── Button.figma               ← master + variants
│   ├── Card/
│   ├── Toggle/                        ← Billing period switcher (Monthly/Annual)
│   ├── Tooltip/                       ← For "(?)" help icons
│   ├── Dialog/                        ← Plan details modal
│   ├── Badge/                         ← "Most popular" / "Save 20%"
│   ├── IconButton/
│   └── ... (every primitive used)
│
├── surface/                           ← LAYER C
│   ├── wireframes/
│   │   ├── pricing-wireframe-mobile.figma
│   │   └── pricing-wireframe-desktop.figma
│   ├── hi-fi/
│   │   ├── pricing-hifi-light.figma
│   │   ├── pricing-hifi-dark.figma
│   │   └── pricing-states.figma       ← C2: every state of every element
│   ├── prototype.figma                ← C3: interactive Figma flow (plan toggle, modal, etc.)
│   ├── prototype.storybook.tsx        ← C3: code-based prototype (Storybook story)
│   └── assets/                        ← C4: logos, illustrations, OG image
│
├── ia/                                ← LAYER D
│   ├── sitemap.md                     ← D1
│   ├── user-flow-pricing.svg          ← D1 (user flow diagram, Mermaid/FigJam export)
│   ├── voice-and-tone.md              ← D2
│   ├── microcopy.md                   ← D2 (button labels, empty/loading/error strings)
│   └── a11y/
│       ├── contrast-matrix.csv        ← D3 (every fg/bg pair with ratio)
│       ├── keyboard-map.md            ← D3
│       ├── aria-map.md                ← D3
│       └── storybook-a11y-report.html ← D3 (axe-core output)
│
├── dist/                              ← LAYER D compiled
│   ├── tokens.css                     ← CSS custom properties
│   ├── tokens.scss                    ← SCSS variables
│   ├── tokens.swift                   ← iOS Swift
│   ├── tokens.xml                     ← Android XML
│   ├── tokens.ts                      ← JS/TS module
│   ├── tailwind-theme.cjs             ← Tailwind preset
│   └── icons-sprite.svg               ← SVG sprite
│
└── governance/                        ← LAYER E
    ├── CHANGELOG.md
    └── CONTRIBUTING.md
```

**Total: 22 artifact types × 1 surface.** A v0/Claude Design/Figma Make output covers maybe **3 of these** (Button.tsx, Button.stories.tsx, prototype.tsx) — and even those three lack the state matrix, the spec.md, and the token export.

---

## 7. What a "Design MCP" Should Generate — Priority Stack

If building an MCP that helps generate design deliverables, this is the production order (foundation first; surface last):

| Priority | Artifact | Why this order |
|---|---|---|
| **P0 — required for every surface** | A1 Color tokens, A3 Spacing tokens, A6 Motion tokens | Without tokens nothing else is themeable, scalable, or platform-portable |
| **P0** | A2 Typography system | Type drives layout |
| **P0** | B1 Component library (one component at a time) | Surfaces are compositions of components |
| **P0** | B2 State matrix (per component) | Without states the surface is untestable |
| **P0** | B4 Component spec ("spec.md") | The operating manual |
| **P1 — required for any multi-screen product** | A4 Elevation, A5 Radius, A8 Breakpoints | Visual system coherence |
| **P1** | A7 Iconography | Every surface needs icons |
| **P1** | C1 Wireframes | IA validation before visual commitment |
| **P1** | C2 High-fi mockups (with states) | The visual artifact |
| **P1** | C3 Interactive prototype (Figma + Storybook) | Testable, demoable |
| **P1** | D1 Information architecture | Prevents scope creep |
| **P1** | D2 Voice & tone / microcopy | Without this the surface is visually complete but tonally broken |
| **P1** | D3 Accessibility annotations | Non-negotiable for production |
| **P2 — scale** | D4 Multi-platform token export | Web + iOS + Android + Tailwind |
| **P2** | E1 Governance, E2 Changelog | Required when >2 teams consume |
| **P3 — mature** | E3 Adoption metrics | Required when justifying continued investment |

---

## 8. Source-of-Truth Schemas (canonical references)

| Artifact | Canonical spec | Spec URL |
|---|---|---|
| Design tokens | W3C DTCG Format Module (2025.10 draft) | https://www.designtokens.org/tr/drafts/format/ |
| Design tokens (legacy) | Tokens Studio format | https://docs.tokens.studio/manage-settings/token-format |
| Component stories | Storybook CSF 3 / CSF Next | https://storybook.js.org/docs/api/csf |
| Component docs | Storybook MDX | https://storybook.js.org/docs/writing-docs/mdx |
| shadcn component | `components.json` + `registry-item.json` | https://ui.shadcn.com/docs/components-json |
| Accessibility | WCAG 2.2 (W3C Recommendation) | https://www.w3.org/TR/WCAG22/ |
| Accessibility testing | axe-core (via Storybook addon) | https://storybook.js.org/docs/writing-tests/accessibility-testing |
| Component specification | Nathan Curtis / EightShapes pattern | https://medium.com/eightshapes-llc/component-specifications-1492ca4c94c |
| Design system checklist | Brad Frost / design system community | https://designsystemchecklist.com/ |
| Token build | Style Dictionary v4/v5 | https://styledictionary.com |
| Token build (DTCG-aware) | Terrazzo (Style Dictionary successor) | https://terrazzo.app |
| Component test (interaction) | Storybook play function | https://storybook.js.org/docs/writing-stories/play-function |
| Prototyping | Figma prototyping + Smart Animate | https://help.figma.com/hc/en-us/articles/360040314193 |
| Motion tokens | Material 3 motion, Carbon motion | https://m3.material.io/styles/motion, https://carbondesignsystem.com/elements/motion/overview/ |
| Elevation tokens | Material 3 elevation, Atlassian elevation | https://m3.material.io/styles/elevation/applying-elevation, https://atlassian.design/foundations/elevation |

---

## 9. Summary

A **complete design deliverable** for a single product surface is **~22 artifact types** spanning 5 layers:

1. **Foundations** (8) — color, type, spacing, elevation, radius, motion, icons, breakpoints — all as **W3C DTCG tokens** that compile to every platform via Style Dictionary.
2. **Components** (4) — library + state matrix + anatomy + spec.md, with **Storybook CSF 3 stories** as the live, testable form.
3. **Surface** (4) — wireframes + hi-fi mockups (every state × every breakpoint) + interactive prototype (Figma + Storybook) + exported assets.
4. **Systems** (3) — information architecture (sitemap + user flow), voice & tone / microcopy, accessibility annotations (WCAG 2.2 AA + a11y test report).
5. **Governance** (3) — contribution model, changelog, adoption metrics.

AI tools (v0, Claude Design, Figma Make, Galileo, Lovable) emit **1 artifact type — code or static frames** — and skip the other 21. The next-generation design tool / "design MCP" must produce the **whole bundle**, not the code in isolation, because the code without the operating manual is throwaway.