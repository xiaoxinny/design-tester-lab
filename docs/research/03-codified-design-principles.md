# Codified Design Principles for a Principle-Adherent Design MCP

**Research date:** 2026-07-12  
**Purpose:** Rules and review prompts that a design/code agent can apply reliably, especially when the generating model has weak visual judgment.

## How to read this catalogue

Machine-checkability is tagged as:

- **`MC:Y`** — deterministic from DOM/CSS/tokens/assets or an instrumented runtime.
- **`MC:P`** — some prerequisites or proxies are deterministic, but meaning, task context, or visual review remains human/VLM work.
- **`MC:N`** — fundamentally a judgment/research principle.
- **`NORM`** — normative standard/conformance requirement.
- **`SYSTEM`** — codified by a design system; binding only when that system is selected.
- **`HEUR`** — useful heuristic, not a universal pass/fail law.

A principle-adherent MCP should never present a house rule (for example, an 8-point grid) as WCAG. It should return the rule's provenance, applicability, exceptions, measured evidence, and confidence.

---

# 1. Accessibility: WCAG 2.2 exact rules

WCAG 2.2 is a W3C Recommendation. It is technology-neutral: it generally does **not** require a particular HTML element, but it does require semantics, relationships, names, roles, values, and sequences to be programmatically determinable. Prefer native HTML because it satisfies these requirements more robustly than recreated ARIA widgets.

## 1.1 Perceivable

| ID | Codified principle | Check | Existing enforcement |
|---|---|---:|---|
| 1.1.1 | Every meaningful non-text item has an equivalent text alternative; decorative images use `alt=""`/are hidden from AT. | `MC:P NORM` | axe-core `image-alt`, Lighthouse, Pa11y; meaning requires review. |
| 1.2.x | Prerecorded audio/video needs captions and alternatives at A/AA as applicable; live synchronized media needs captions at AA. | `MC:P NORM` | Media metadata/transcript presence linter; caption accuracy needs review. |
| 1.3.1 | Information, structure, and relationships conveyed visually are programmatically determinable or available in text. | `MC:P NORM` | axe-core table/list/label/landmark rules, Accessibility Insights; visual-to-semantic equivalence requires VLM/human. |
| 1.3.2 | DOM/reading order preserves meaning. CSS rearrangement must not create a contradictory reading order. | `MC:P NORM` | Playwright focus/read-order audit; axe detects some `aria-*` issues; human screen-reader check. |
| 1.3.3 | Instructions do not rely only on shape, color, size, visual location, orientation, or sound. | `MC:P NORM` | Content/VLM rule; no reliable generic linter. |
| 1.3.4 | Content works in portrait and landscape except where one orientation is essential. | `MC:Y NORM` | Playwright viewport matrix; inspect orientation locks. |
| 1.3.5 | Common input purposes expose autocomplete semantics (for inputs collecting user data). | `MC:Y NORM` | axe-core `autocomplete-valid`; HTML linter. |
| 1.4.1 | Color is not the only visual means of conveying information/action/state. For links in text, a persistent non-color cue is safest. W3C sufficient technique G183 permits color-only default differentiation when link text is at least **3:1** against surrounding text and gains an additional non-color cue on hover **and keyboard focus**; this 3:1 pattern is a sufficient technique, not the literal wording of the success criterion. | `MC:P NORM` | axe-core `link-in-text-block`, VLM/state comparison, color-blind simulation. |
| 1.4.3 AA | Text contrast is at least **4.5:1**; large text at least **3:1**. “Large” is at least **18 pt** regular or **14 pt bold** (roughly 24 CSS px / 18.67 CSS px at 96 dpi). Logos, incidental text, and inactive controls are exempt. Ratios are not rounded: 4.499 fails. | `MC:Y NORM` | axe-core `color-contrast`, Lighthouse, WebAIM Contrast Checker, `color-contrast-checker`. |
| 1.4.6 AAA | Enhanced text contrast is **7:1** normal and **4.5:1** large. | `MC:Y NORM` | Same tools with AAA policy. |
| 1.4.11 AA | Visual information needed to identify UI components/states and meaningful graphical objects has at least **3:1** contrast against adjacent colors. | `MC:P NORM` | axe-core catches a subset; screenshot segmentation/VLM needed for boundaries and meaning. |
| 1.4.4 AA | Text can resize to **200%** without loss of content/functionality (captions and images of text excepted). | `MC:Y NORM` | Playwright at text zoom; Accessibility Insights; screenshot overflow/diff checks. |
| 1.4.10 AA | At **400% zoom**, content reflows without two-dimensional scrolling at a viewport equivalent to **320 CSS px wide** (vertical content) or **256 CSS px high** (horizontal content), except genuinely two-dimensional content such as maps/data tables. | `MC:P NORM` | Playwright 320px viewport + overflow detector; exceptions need classification. |
| 1.4.12 AA | No content/function loss when users set line height to **1.5× font size**, paragraph spacing to **2×**, letter spacing to **0.12×**, and word spacing to **0.16×**. | `MC:Y NORM` | Inject W3C text-spacing bookmarklet CSS in Playwright and detect clipping/overlap. |
| 1.4.13 AA | Hover/focus content is dismissible without moving pointer/focus (unless error/essential), hoverable, and persistent until dismissed, trigger removed, or no longer valid. | `MC:P NORM` | Browser interaction tests; semantic exception review. |

### Contrast formula (WCAG 2.x)

```js
// sRGB channel c in [0,1]
const linear = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const L = ([r,g,b]) => 0.2126*linear(r) + 0.7152*linear(g) + 0.0722*linear(b);
const ratio = (a,b) => (Math.max(L(a),L(b)) + 0.05) / (Math.min(L(a),L(b)) + 0.05);
```

The CSS Color/WCAG erratum uses `0.04045` (older text used `0.03928`; practical effect is negligible for 8-bit colors). Composite alpha foregrounds over their actual background before calculating.

## 1.2 Operable

| ID | Codified principle | Check | Existing enforcement |
|---|---|---:|---|
| 2.1.1/2.1.2 | All functionality works by keyboard; no keyboard trap. | `MC:P NORM` | axe-core catches some focusability defects; Playwright tab/Enter/Space/Escape graph; manual complex-widget test. |
| 2.4.1 | Repeated blocks can be bypassed (skip link, landmarks, headings). | `MC:P NORM` | axe-core `bypass`, landmark rules. |
| 2.4.2 | Every page has a descriptive title. | `MC:P NORM` | axe-core `document-title`; descriptiveness requires NLP/review. |
| 2.4.3 | Focus order preserves meaning and operability. Positive `tabindex` is a strong lint error; visual and DOM order should agree. | `MC:P NORM` | axe-core `tabindex`; Playwright focus-order overlay; VLM comparison. |
| 2.4.4/2.4.6 | Link purpose is determinable in context; headings and labels describe topic/purpose. | `MC:P NORM` | axe `link-name`, `label`; NLP flags “click here”, duplicates, ambiguity. |
| 2.4.7 | Keyboard focus has a visible indicator. | `MC:P NORM` | axe-core `focus-visible` support is limited; screenshot focused/unfocused pixel diff. |
| 2.4.11 AA | A focused component is **not entirely hidden** by author-created content. Partial obscuring can still pass AA. | `MC:Y NORM` | Playwright tab sequence + bounding-box/intersection/occlusion checks. |
| 2.4.12 AAA | Focused component is not obscured at all. | `MC:Y NORM` | Same occlusion checker. |
| 2.4.13 AAA | Focus indicator area is at least the area of a **2 CSS-pixel-thick perimeter** around the unfocused component, and changed pixels have at least **3:1** contrast between focused/unfocused states. | `MC:P NORM` | Focus screenshot pixel mask + contrast calculator; complex shapes need care. |
| 2.5.1 | Multipoint/path gestures have a single-pointer alternative unless essential. | `MC:P NORM` | Event-handler/static analysis + task review. |
| 2.5.2 | Pointer actions can be cancelled/aborted or undone; avoid irreversible `down` events. | `MC:P NORM` | Event-handler tests; behavior review. |
| 2.5.3 | Accessible name contains the visible label text (“Label in Name”). | `MC:Y NORM` | axe-core `label-content-name-mismatch`. |
| 2.5.4 | Motion-triggered functions also have UI alternatives and accidental activation can be disabled. | `MC:P NORM` | Sensor API lint + review. |
| 2.5.7 AA | Any dragging action has a single-pointer, non-drag alternative unless dragging is essential. | `MC:P NORM` | Detect draggable/pointermove handlers and require buttons/menu alternative. |
| 2.5.8 AA | Pointer targets are at least **24×24 CSS px**, or meet spacing/equivalent/inline/UA/essential exceptions. Spacing exception: a **24 CSS-px diameter circle** centered on each undersized target must not intersect another target or its circle. | `MC:P NORM` | Playwright geometry audit; classify inline and essential exceptions. |
| 2.5.5 AAA | Enhanced target size is **44×44 CSS px**, with exceptions. | `MC:P NORM` | Geometry audit. |

## 1.3 Understandable and robust semantics

| ID | Codified principle | Check | Existing enforcement |
|---|---|---:|---|
| 3.1.1 | Default human language is programmatically identified (`<html lang>`). | `MC:Y NORM` | axe-core `html-has-lang`, `html-lang-valid`. |
| 3.2.x | Focus/input does not unexpectedly change context; repeated navigation and component identification are consistent. | `MC:P NORM` | Interaction tests and cross-page component/label diff. |
| 3.3.1/3.3.2 | Errors are identified in text; fields have labels/instructions. | `MC:P NORM` | axe form rules + submit-invalid tests; quality of explanation needs review. |
| 3.3.3/3.3.4 | Offer correction suggestions where known; prevent/confirm/review reversible legal, financial, data-deleting, or test-submission actions. | `MC:P NORM` | Flow model and destructive-action test; risk classification is contextual. |
| 3.3.7 AA | Previously entered information in the same process is auto-populated or selectable unless re-entry is essential/security-related. | `MC:P NORM` | End-to-end form-flow test. |
| 3.3.8 AA | Authentication cannot require a cognitive function test unless an alternative/assistance mechanism applies; password managers and paste must work. | `MC:P NORM` | Flag blocked paste/password managers, puzzles; exception review. |
| 4.1.2 | Every UI component exposes correct name, role, state/value; changes are available to AT. | `MC:P NORM` | axe-core `aria-*`, Testing Library role queries, browser accessibility tree snapshots. |
| 4.1.3 | Status messages are exposed without moving focus (`role=status`, `alert`, live regions as appropriate). | `MC:P NORM` | DOM mutation + accessibility-tree test. |

### Semantic HTML policy for the MCP

**`MC:Y/P SYSTEM`** Prefer `button` for actions, `a[href]` for navigation, associated `label` for controls, `fieldset/legend` for grouped choices, real `ul/ol/dl`, real tables for tabular data, and `header/nav/main/aside/footer` landmarks. Require one primary `main`; label repeated `nav` landmarks distinctly. Heading levels should represent hierarchy and normally not skip levels. These are robust implementation policies derived from 1.3.1, 2.4.x, and 4.1.2, but “exactly one `h1`” and “never skip a heading level” are best practices, **not literal WCAG AA success criteria**.

### Time, flashing, and motion limits

- **`MC:P NORM` 2.2.2:** moving/blinking/scrolling content that starts automatically, lasts **more than 5 seconds**, and runs alongside other content must be pausable/stoppable/hideable; auto-updating content must be controllable unless essential.
- **`MC:Y NORM` 2.3.1:** no content flashes more than **3 times in any 1-second period**, unless below the general/red flash thresholds. Use the Photosensitive Epilepsy Analysis Tool (PEAT) for video.
- **`MC:P NORM` 2.3.3 AAA:** interaction-triggered motion animation can be disabled unless essential.
- **House policy:** every nonessential transform/parallax/large-area animation gets a `prefers-reduced-motion: reduce` static or near-instant alternative.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Do not blindly use this snippet when a state transition would disappear; preserve state feedback without spatial movement.

**Primary sources:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [WCAG Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/), [Understanding contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [focus appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html).

---

# 2. WCAG 3 (“Silver”) and APCA

## 2.1 What is actually in the draft

WCAG 3.0 remains a **Working Draft**, not a conformance standard and not a replacement for WCAG 2. It broadens scope beyond web pages to apps, immersive media, authoring tools, and emerging technology. The draft organizes guidance around user needs and outcomes, with:

- **Core requirements**, **supplemental requirements**, and **assertions** (claims about process/testing that cannot always be directly measured);
- technology-specific **methods** and tests under outcomes;
- maturity labels such as placeholder/exploratory/developing/refining/mature;
- a conformance model still under development.

**MCP rule — `MC:Y NORM`:** report WCAG 2.2 conformance today. Expose WCAG 3 checks only as `experimental`, include draft date/status, and never claim “WCAG 3 compliant.” Source: [current WCAG 3 draft](https://www.w3.org/TR/wcag-3.0/).

## 2.2 APCA exact working guidance

APCA produces signed **Lc** lightness contrast: positive generally means dark text on a light background; negative means light text on dark. Use absolute magnitude for threshold lookup but retain polarity because APCA is polarity-sensitive. It is not a WCAG 2 legal substitute and, despite its history as a WCAG 3 candidate, should be described as independent/draft guidance until W3C normatively adopts a method.

| `|Lc|` | APCA guidance (reference font roughly Arial/Helvetica, x-height ≈0.52) | Check |
|---:|---|---:|
| 90 | Preferred fluent body text; supports about 14px/400 body, 12px/400 non-body, 18px/300. | `MC:Y EXP` |
| 75 | Minimum body columns: about 18px/400, 16px/500, 14px/700; 15px/400 non-body. | `MC:Y EXP` |
| 60 | Minimum readable non-body content: about 24px/400, 21px/500, 18px/600, 16px/700. Add Lc 15 for body text. | `MC:Y EXP` |
| 45 | Large/heavy headlines and fine-detail icons: about 36px regular or 24px bold. | `MC:Y EXP` |
| 30 | Absolute minimum spot-readable ancillary text/placeholder/disabled; solid icons at least ~5.5px in smallest dimension. Not body content. | `MC:P EXP` |
| 15 | Absolute minimum for non-semantic dividers/thick focus outlines at least ~5px thick. Below this can be invisible to many users. | `MC:P EXP` |

For an approximate AAA-like reserve, APCA documentation suggests adding **Lc 15** to a minimum. Never infer sizes for an arbitrary font solely from CSS `font-weight`: x-height and actual stroke width matter. Times New Roman (x-height ≈0.45), for example, needs roughly 16% more size than the reference.

```js
import { calcAPCA } from 'apca-w3';
const lc = calcAPCA('#222222', '#ffffff'); // foreground, background
if (Math.abs(lc) < 75) report('Below APCA body-text minimum');
```

Tools: [APCA calculator](https://apcacontrast.com/), npm [`apca-w3`](https://www.npmjs.com/package/apca-w3), [APCA easy introduction](https://git.apcacontrast.com/documentation/APCAeasyIntro.html), [APCA in a Nutshell](https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html). Run WCAG 2.x ratio and APCA side-by-side, labeled separately.

---

# 3. Foundation rules: typography, color, layout, motion, density, IA

These are the default policies the MCP can enforce when no product design system supplies stricter tokens.

## 3.1 Typography

| Principle | Check | Enforcement/tool |
|---|---:|---|
| Use semantic roles (`display`, `heading`, `body`, `label`, `code`) rather than arbitrary per-component sizes. | `MC:Y SYSTEM` | Token schema + Style Dictionary; Carbon token Stylelint plugin. |
| Limit a screen to a small, named hierarchy; repeated semantic roles use identical font/size/weight/leading. | `MC:Y/P` | CSS computed-style clustering; flag one-off styles; VLM checks role correctness. |
| Use a deliberate scale, not mathematically mandatory ratios. A practical UI scale is `12,14,16,20,24,28,32,40,48,57`; choose and tokenize it. Modular ratios (1.125, 1.2, 1.25) are options, not laws. | `MC:Y HEUR` | Disallow values outside typography tokens. |
| Body text defaults to at least 16 CSS px for reading contexts; smaller text must remain legible and pass contrast. This is a house rule, not WCAG. | `MC:Y HEUR` | Stylelint custom rule. |
| Reading measure should generally be **45–75 characters**; Smashing's broader guidance is **40–80 including spaces**. UI labels/tables are exceptions. | `MC:P HEUR` | Render and estimate characters per line (`ch`/canvas); classify content type. |
| Body leading typically 1.4–1.6; never prevent WCAG's 1.5 text-spacing override. Headings can be tighter. | `MC:Y/P HEUR` | computed `line-height/font-size`; injected WCAG test. |
| Avoid all caps for sentences; reserve for short labels and add tracking as needed. Avoid justified web body text where it creates rivers. | `MC:P HEUR` | NLP/CSS lint + VLM. |
| Align type to a shared baseline/edge; use spacing tokens for paragraph rhythm. Do not fake headings with bold `div`s. | `MC:P` | DOM role audit + baseline screenshot overlay. |
| Support font loading fallback and prevent layout shift; use `font-display`, compatible fallback metrics, and test zoom/localization. | `MC:Y/P` | Lighthouse CLS, font-face lint, pseudo-localization. |

**Thinking with Type (Ellen Lupton):** hierarchy is created through controlled contrast of size, weight, position, space, and typeface; alignment and rhythm turn text into navigable structure; line length, leading, tracking, and word spacing must be judged together. `MC:P`; enforce tokens and measures, review hierarchy visually. [Book/site references](https://thinkingwithtype.com/).

**Vercel Geist:** typography utilities pre-compose font size, line height, tracking, and weight; this is exactly the token bundle an MCP should return rather than four unrelated guesses. Geist Sans is for UI/prose and Geist Mono for code/data. The current exact scale should be read from the selected Geist package/docs, not copied from an old unofficial Geist UI project. Source: [Vercel Geist typography](https://vercel.com/geist/typography), [Geist font](https://github.com/vercel/geist-font).

## 3.2 Color and OKLCH palettes

| Principle | Check | Enforcement/tool |
|---|---:|---|
| Separate **primitive palette** values from **semantic tokens** (`text.primary`, `surface.raised`, `border.danger`, `action.brand.hover`). Components may consume semantic tokens only. | `MC:Y SYSTEM` | Style Dictionary/Tokens Studio schema; Stylelint declaration-property-value allowlist. |
| Generate ramps in a perceptual space (OKLCH or Material HCT), then gamut-map and test actual rendered sRGB/P3 values. Equal OKLCH steps are more perceptually regular than HSL, but not automatically accessible. | `MC:Y/P` | Culori or Color.js; CSS `oklch()`; gamut test; contrast test. |
| For a single-hue OKLCH ramp, define monotonically changing `L`, manage `C` to avoid clipping (usually lower chroma near very light/dark ends), and keep hue stable unless intentional hue correction is documented. | `MC:Y SYSTEM` | Token script checks monotonic L, hue drift, in-gamut status. |
| Build neutral plus brand/action and semantic success/warning/danger/info families, each with foreground/background/border/state roles. Never use hue alone for status. | `MC:P` | Token completeness and state matrix; VLM/NLP semantic review. |
| Every foreground/background pair is tested in every theme and state (default, hover, active, focus, selected, disabled); alpha colors are composited first. | `MC:Y/P` | theme matrix renderer + axe/APCA; screenshot state crawler. |
| Dark theme is not an inversion. Reassign semantic roles, reduce large-area chroma, and use lighter surfaces or borders for elevation. | `MC:P` | token invariants + visual review. |
| Palette generation is not color harmony judgment. Analogous/complementary/triadic hue relations can propose candidates, but hierarchy, proportion, culture, brand, and accessibility decide use. | `MC:N` | Human/VLM palette review; CVD simulators. |

```js
import { converter, displayable } from 'culori';
const toRgb = converter('rgb');
const ramp = [0.97,0.90,0.80,0.70,0.60,0.50,0.40,0.30].map((l,i) => ({
  mode:'oklch', l, c: Math.min(0.16, 0.04 + i*0.02), h: 260
}));
for (const color of ramp) if (!displayable(color)) report('gamut-map token', color);
```

Useful tools: [OKLCH picker](https://oklch.com/), [Culori](https://culorijs.org/), [Color.js](https://colorjs.io/), Leonardo, Material Theme Builder, Tokens Studio, axe-core, APCA, Stark, and Color Oracle. `oklch.com` is a tool, not a universal palette algorithm.

## 3.3 Layout, grids, responsiveness, and density

| Principle | Check | Enforcement/tool |
|---|---:|---|
| Use a named spacing scale. Default: 4px micro-unit with major spacing on 8px (`2,4,8,12,16,24,32,40,48,64,80,96`). Optical 1–2px corrections require a documented exception token. | `MC:Y HEUR` | Stylelint custom-unit/token rule; design-token lint. |
| Align container edges, repeated controls, and typography to grid lines. Related items use smaller gaps than unrelated groups (Gestalt proximity). | `MC:P` | DOM geometry clustering and screenshot/VLM alignment review. |
| Use columns, gutters, and margins as tokens per breakpoint; do not assume 12 columns. Carbon uses 4/8/16; other systems may use 12. | `MC:Y SYSTEM` | viewport geometry tests. |
| Do not encode desktop coordinates. Components must reflow, wrap, collapse, or scroll intentionally at all supported widths and at 400% zoom. | `MC:P` | Playwright breakpoint/zoom matrix, overflow and overlap detection. |
| Constrain long-form measure rather than stretching prose across available columns. | `MC:P HEUR` | rendered characters-per-line. |
| Preserve safe areas and system UI insets on native platforms; use `safeAreaLayoutGuide` / SwiftUI safe-area APIs or CSS `env(safe-area-inset-*)`. There is no one universal numeric safe-area inset. | `MC:Y SYSTEM` | native constraint test/device screenshots; CSS lint. |
| Density may reduce visible padding, row height, and information whitespace, but must preserve target geometry, focus, readability, and error tolerance. | `MC:Y/P` | token mode diff + target/contrast checks. |
| Default touchscreen targets: Material **48×48dp** (~9mm), Apple **44×44pt**, web WCAG AA **24×24 CSS px** minimum. Keep the stricter selected-system value; icons may be smaller inside the hit box. | `MC:Y/P` | runtime bounding-box/hit-region audit. |

**Grid Systems in Graphic Design (Müller-Brockmann):** define page format, margins, columns, gutters, baseline rows/modules, then place text/images as rational multiples to create consistent alignment and rhythm. A modular grid is a means, not the goal; number of columns follows content. `MC:P`; geometry is checkable, whether the grid serves content is judgment.

## 3.4 Motion

| Principle | Check | Enforcement/tool |
|---|---:|---|
| Motion must explain causality, continuity, hierarchy, state, or feedback; ornamental motion is optional and sparse. | `MC:N/P` | Require a declared motion purpose; VLM/human review. |
| Entrance generally decelerates; exit accelerates; on-screen transformations use standard/symmetric easing. Avoid linear UI movement, bounce, and overshoot unless the selected system calls for it. | `MC:Y/P HEUR` | CSS AST validates easing token by transition role. |
| Duration scales with travel distance/area and importance. Microfeedback is fastest; large scene transitions slower. | `MC:P` | duration/distance ratio bounds + review. |
| Use only motion tokens, not per-component arbitrary cubic Béziers/durations. | `MC:Y SYSTEM` | Stylelint allowlist; AST scan JS animation calls. |
| Respond visually within **400ms** (Doherty threshold); immediate state feedback should not wait for a long animation. | `MC:Y HEUR` | performance marks and interaction tests. |
| Animate compositor-friendly `transform` and `opacity` where possible; avoid layout-thrashing animation. | `MC:Y` | Lighthouse, Chrome performance trace, Stylelint. |
| Provide reduced-motion behavior and test that state remains understandable. | `MC:P NORM/HOUSE` | emulate media feature in Playwright and screenshot/interaction diff. |

### A useful cross-system token set

Material 3 duration tokens: short **50/100/150/200ms**, medium **250/300/350/400ms**, long **450/500/550/600ms**, extra-long **700/800/900/1000ms**. Common M3 curves include emphasized-decelerate `cubic-bezier(0.05,0.7,0.1,1)`, emphasized-accelerate `cubic-bezier(0.3,0,0.8,0.15)`, standard `cubic-bezier(0.2,0,0,1)`, standard-decelerate `cubic-bezier(0,0,0,1)`, and standard-accelerate `cubic-bezier(0.3,0,1,1)`. Use the versioned M3 token package as authority.

Carbon is even more explicit: `70,110,150,240,400,700ms`; productive curves standard `(0.2,0,0.38,0.9)`, entrance `(0,0,0.38,0.9)`, exit `(0.2,0,1,0.9)`; expressive standard `(0.4,0.14,0.3,1)`, entrance `(0,0,0.3,1)`, exit `(0.4,0.14,1,1)`. Carbon recommends microinteractions around **90–120ms** and reserves expressive motion for important moments. Source: [Carbon motion](https://carbondesignsystem.com/elements/motion/overview/), [M3 easing and duration](https://m3.material.io/styles/motion/easing-and-duration).

Apple HIG does **not** publish a single mandatory duration/curve table for all app animation. Use platform transitions/springs, maintain continuity, avoid gratuitous motion, and honor Reduce Motion. `Animation.timingCurve` having a default 0.35s is API behavior, not a universal HIG law.

## 3.5 Information architecture and content density

| Principle | Check | Enforcement/tool |
|---|---:|---|
| Navigation labels use user language, are specific, mutually distinguishable, and stable across screens. | `MC:P` | duplicate/ambiguity/readability NLP; tree test required for validation. |
| Every screen exposes location, available paths, and a recovery/back route where appropriate. | `MC:P` | route graph checks breadcrumbs/current-item/escape; task review. |
| Group by user task/domain, not internal organization. | `MC:N` | card sorting, interviews, analytics. |
| Use progressive disclosure for advanced/infrequent detail without hiding primary tasks. | `MC:P` | DOM visibility/task model; usability test. |
| Reduce simultaneous choices when decision speed matters (Hick), but do not hide necessary comparison choices. There is no universal maximum menu count. | `MC:P HEUR` | count choices as a warning; task/context review. |
| Chunk related content and use clear headings. “7±2” is not a navigation-item cap; modern working-memory evidence is context-dependent. | `MC:P HEUR` | section/list-length warning; human review. |
| Search/filter/sort become more important as breadth and item count grow. | `MC:P HEUR` | content-volume thresholds plus product rules. |
| Measure IA with first-click testing, card sorting, and tree testing: task success, directness, time, and backtracking—not visual preference alone. | `MC:N` | Optimal Workshop, Maze, UserZoom, analytics. |
| Keep primary task information above secondary metadata; dense enterprise views may be compact but need scan alignment, stable columns, and user-selected density. | `MC:P` | visual hierarchy/geometry checks + usability test. |

---

# 4. What major systems actually codify

## 4.1 Material Design 3: Foundation versus Expression

**Foundation (tokens/components, mostly `MC:Y SYSTEM`):** semantic color roles generated from HCT tonal palettes (tone 0–100); five typography roles—display, headline, title, body, label—each large/medium/small; shape, spacing/layout, state layers, elevation levels 0 through +5 (commonly 0,1,3,6,8,12dp), motion tokens, 48dp targets, adaptive navigation/components, and themed components. The canonical tonal stops commonly include `0,10,20,30,40,50,60,70,80,90,95,99,100`. Test generated role pairs rather than assuming tonal generation guarantees contrast.

**Expression (`MC:P/N SYSTEM`):** M3 Expressive combines color, shape, size, motion, and containment to direct attention and create emotion. Google's 46 studies/18,000+ participants found key UI up to 4× faster to spot in examples, but explicitly warns that expressive novelty must not break familiar interaction paradigms, remove useful labels, or compromise clarity. Expression is contextual—not a license for random blobs, gradients, or spring animation. Machine-check the use of approved expressive components/tokens and salience budget; judge appropriateness with user context/VLM.

**Tone of voice:** M3 itself is more strongly codified visually/behaviorally than as a universal editorial voice. Product content guidance should be a separate token/policy layer; do not invent “Material voice” requirements.

Sources: [M3](https://m3.material.io/), [M3 typography](https://m3.material.io/styles/typography/overview), [color system](https://m3.material.io/styles/color/system/how-the-system-works), [expressive research](https://design.google/library/expressive-material-design-google-research).

## 4.2 Apple Human Interface Guidelines

- **`MC:Y SYSTEM`** Interactive controls should have a hit target of at least **44×44 points**; visual glyph can be smaller.
- **`MC:Y/P SYSTEM`** Keep essential content/controls within platform safe areas; derive insets from APIs, not hardcoded notch/home-indicator numbers.
- **`MC:Y SYSTEM`** Use semantic/dynamic colors (`label`, `secondaryLabel`, `systemBackground`, `secondarySystemBackground`, `separator`, tint) so appearance, contrast, vibrancy, and increased-contrast settings adapt. Do not treat their current RGB values as fixed brand tokens.
- **`MC:Y/P SYSTEM`** Use semantic text styles and Dynamic Type. Default iOS reference sizes include Large Title 34pt, Title 1 28, Title 2 22, Title 3 20, Headline/Body 17, Callout 16, Subheadline 15, Footnote 13, Caption 1 12, Caption 2 11; use `UIFont.preferredFont`/SwiftUI semantic styles rather than freezing these values. Test all accessibility categories and wrapping.
- **`MC:P SYSTEM`** Respect Bold Text, Increase Contrast, Differentiate Without Color, Reduce Transparency, and Reduce Motion. Avoid autoplaying/repetitive or large spatial motion for reduced-motion users.
- **`MC:P/N SYSTEM`** Follow platform navigation and control conventions; clarity, deference, and depth are guidance, not pixel-lint rules.

Sources: [Apple HIG typography](https://developer.apple.com/design/human-interface-guidelines/typography), [layout](https://developer.apple.com/design/human-interface-guidelines/layout), [color](https://developer.apple.com/design/human-interface-guidelines/color), [motion](https://developer.apple.com/design/human-interface-guidelines/motion), [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## 4.3 IBM Carbon / IBM Design Language

- **`MC:Y SYSTEM`** 2x Grid mini-unit is **8px**; default breakpoints: 320px/4 columns, 672/8, 1056/16, 1312/16, 1584/16. Standard padding is 16px; box-margin/padding can yield 32px gutters. Carbon spacing also includes smaller 2/4px increments.
- **`MC:Y SYSTEM`** Use role tokens, never palette hex directly. Four themes: White `#fff`, Gray 10 `#f4f4f4`, Gray 90 `#262626`, Gray 100 `#161616`. Light layers alternate White/Gray 10; dark layers get progressively lighter.
- **`MC:Y SYSTEM`** Carbon's motion values/curves are listed in §3.4; use productive for task flow and expressive only for significant moments.
- **`MC:Y/P SYSTEM`** Color token hierarchy separates background/layer/text/icon/border/support/focus and interaction states; theme matrix must pass contrast.
- **`MC:N`** IBM principles: **carefully considered, uniquely unified, expertly executed, positively progressive**. Their review questions—essential, no gratuitous content, recognizable/reusable, no overlooked detail, remove friction—are VLM/human rubric dimensions.

Tools: Carbon Grid/React packages, `@carbon/themes`, `@carbon/type`, `@carbon/motion`, [`stylelint-plugin-carbon-tokens`](https://github.com/carbon-design-system/stylelint-plugin-carbon-tokens). Sources: [2x Grid](https://carbondesignsystem.com/elements/2x-grid/overview/), [color](https://carbondesignsystem.com/elements/color/overview/), [IBM principles](https://www.ibm.com/design/language/philosophy/principles).

## 4.4 Atlassian Design System

- **`MC:Y SYSTEM`** Base spacing is 8px (`space.100`); complete common scale is 0,2,4,6,8,12,16,20,24,32,40,48,64,80px. Consume tokens, not raw px/rem.
- **`MC:Y SYSTEM`** Token hierarchy is semantic: `color.[property].[role].[emphasis].[state]`, e.g. `color.background.danger.bold.hovered`; roles include neutral, brand, information, success, warning, danger, discovery, accent, inverse, input.
- **`MC:Y/P SYSTEM`** Elevations: sunken, default, raised, overlay, overflow. Raised/overlay surface tokens must pair with corresponding shadows; dark mode also changes surfaces. Reserve overlay for UI over UI and raised primarily for movable cards.
- **`MC:Y SYSTEM`** Typography roles bundle size/line height. Current heading tokens run 12/16 through 32/36; body small 12/16, default 14/20, large 16/24. Use rem and semantic headings.
- **`MC:P`** Voice/tone sequence: inform to build trust, empower action, encourage progress, motivate through possibility, satisfy through success. NLP can test directness/reading level, not trust or encouragement.

Sources: [spacing](https://atlassian.design/foundations/spacing), [color](https://atlassian.design/foundations/color), [typography](https://atlassian.design/foundations/typography), [elevation](https://atlassian.design/foundations/elevation), [voice and tone](https://atlassian.design/content/voice-tone).

## 4.5 Shopify Polaris

Content is treated as interface design:

- **`MC:P SYSTEM`** Include only words necessary for clarity; remove repetition and unneeded subcopy/punctuation.
- **`MC:P SYSTEM`** Use plain merchant language and contractions; aim around a **7th-grade reading level** while retaining necessary domain terms.
- **`MC:P SYSTEM`** Put the next action first, begin instructions with verbs, be direct, and progressively disclose multi-part tasks.
- **`MC:P/N SYSTEM`** Write like merchants talk; content should be actionable, useful, and human—not generic brand cheer.
- **`MC:Y SYSTEM`** Use Polaris tokens/components rather than reproducing historical palette/spacing values. Shopify has moved from Polaris React toward Polaris web components; bind the MCP to a versioned source.

Tools: textstat/Readability, Vale, alex, inclusive-language linters, component prop validators. Source: [Polaris content fundamentals](https://polaris.shopify.com/content/fundamentals), [Shopify app design guidance](https://shopify.dev/docs/apps/design-guidelines).

## 4.6 Vercel Geist

Geist codifies a precise monochrome, typography-led product language through components and tokens. The enforceable lesson is not “make everything black and white”; it is to consume the real Geist typography, color, radius, spacing, material, and interaction tokens and preserve keyboard behavior. Examples include arrow-key navigation in single-select groups and Space toggling multi-select; color cannot be the sole selection signal. `MC:Y/P SYSTEM`. Source: [Geist](https://vercel.com/geist), [typography](https://vercel.com/geist/typography), [materials](https://vercel.com/geist/materials), [AI prototyping with design systems](https://vercel.com/blog/ai-powered-prototyping-with-design-systems).

There is no authoritative public evidence that Vercel Geist's palette is generated by a single published `oklch.com`/Culori algorithm. Do not invent one. If an OKLCH-derived Geist-like theme is desired, label it a new system and publish its ramp function, gamut mapping, and contrast tests.

## 4.7 Linear

The explicit **Linear Method** principles concern product process more than a reusable visual specification: set product direction and useful goals, prioritize enablers/blockers, scope projects down, build with momentum, write issues rather than ritualized user stories, build with users, launch repeatedly, and build in public. `MC:N/P`; project metadata can show scope/cycles, but quality and momentum need team judgment.

The visual principles often inferred from Linear—dark polished surfaces, restrained color, keyboard-first flows, dense data, fast transitions—are observations, not public universal Linear rules. Encode only verified components/tokens if authorized; do not style-clone from screenshots. Sources: [Linear Method](https://linear.app/method), [Linear design](https://linear.app/design).

## 4.8 Stripe, Atlas/Press, and “blurple slop”

Stripe's public design discourse emphasizes usability, craft, beauty, and interfaces as product architecture; Stripe Press is a publishing imprint, not a general UI design standard. The useful MCP principle is **`MC:Y/P` design-system grounding**: retrieve actual product components/tokens/content patterns before generation, prevent hallucinated components, and compare output to product-specific exemplars.

Owen Williams's 2026 “blurple slop” phrase describes generic AI prototypes that ignore a company's system and converge on purple gradients/generic components. The corrective pattern reported for Stripe's internal Protodash is context-rich, in-house prototyping on the real system—not a new aesthetic rule. Treat current reporting as practitioner evidence, not a formal Stripe standard. Sources: [Stripe craft and beauty session](https://stripe.com/sessions/2024/craft-and-beauty-the-business-value-of-form-in-function), [Stripe Press](https://press.stripe.com/).

---

# 5. Canonical books, laws, and craft sources

## 5.1 Refactoring UI — practical rules

- Start from feature/task and hierarchy, not decorative shell. `MC:N`
- Create hierarchy with weight, color, and spacing before increasing size; de-emphasize secondary content rather than emphasizing everything. `MC:P` VLM.
- Use predefined spacing/sizing scales; start with generous whitespace and tighten deliberately. `MC:Y/P` token lint.
- Do not make every layout fluid; constrain widths and let children be narrower than parents. `MC:Y/P` geometry lint.
- Build a palette with multiple usable shades per color, including very light backgrounds and dark text shades; define semantic roles and test contrast. `MC:Y/P` token/contrast lint.
- Create depth from small controlled shadows, overlap, and lighter/darker surfaces; don't add borders everywhere. `MC:P` token/VLM.
- Line length around 45–75 characters; align text deliberately; avoid centering long text. `MC:P` render lint.
- Emphasize dangerous/destructive behavior semantically, not by making all actions loud. `MC:P` state review.

The book advocates a constrained scale but does not establish one mandatory universal sequence. A common implementation (`4,8,12,16,24,32,48,64,96`) is a house scale, not a verbatim universal mandate. Source: [Refactoring UI](https://refactoringui.com/), [palette preview](https://refactoringui.com/previews/building-your-color-palette).

## 5.2 Laws of UX — 19 high-value principles

| Law/principle | One-line application | Check |
|---|---|---:|
| Aesthetic-usability effect | Polished systems are perceived easier, but beauty can mask defects. | `MC:N` |
| Doherty threshold | Feedback within **400ms** maintains flow. | `MC:Y HEUR` |
| Fitts's law | Acquisition time rises with distance and falls with target size; enlarge and place frequent targets near work. | `MC:Y/P HEUR` |
| Hick's law | Decision time increases with number and complexity of choices. | `MC:P HEUR` |
| Jakob's law | Follow conventions and users' existing mental models unless evidence supports change. | `MC:N/P` |
| Law of common region | A visible boundary makes items appear grouped. | `MC:P` |
| Law of proximity | Near items are perceived as related. | `MC:P` |
| Law of Prägnanz | People interpret ambiguity as the simplest stable form. | `MC:N` |
| Law of similarity | Similar-looking elements are perceived as related; keep semantic consistency. | `MC:P` |
| Law of uniform connectedness | Connected elements appear more related than unconnected ones. | `MC:P` |
| Miller's law/chunking | Chunk information; do not turn “7±2” into a hard item cap. | `MC:P` |
| Occam's razor | Prefer the simplest design that fully solves requirements. | `MC:N/P` |
| Parkinson's law | Tasks expand to available time; defaults/constraints can shorten flows. | `MC:N/P` |
| Peak-end rule | Users disproportionately remember emotional peak and ending. | `MC:N` |
| Postel's law | Accept varied input carefully, but produce predictable output; security limits permissiveness. | `MC:P` |
| Serial-position effect | First/last items are recalled best; place critical actions deliberately. | `MC:P` |
| Tesler's law | Complexity cannot all disappear; place unavoidable complexity where it is best handled. | `MC:N` |
| Von Restorff effect | One distinctive item is remembered; reserve visual uniqueness for the priority. | `MC:P` |
| Zeigarnik effect | Incomplete tasks remain salient; use progress indicators without coercion. | `MC:P` |

Source: [Laws of UX](https://lawsofux.com/). Tools can measure targets, counts, latency, similarity, and geometry; laws predict tendencies, not compliance thresholds.

## 5.3 Don't Make Me Think — Steve Krug

Make each page self-evident or at least self-explanatory; use conventions; create clear visual hierarchy; break pages into clearly defined areas; make clickable things obvious; eliminate needless words; provide persistent, obvious navigation with site identity, sections, utilities, page name, local navigation, and search where appropriate; show “you are here”; make the home page communicate purpose; and test early with a few users. Mostly `MC:P/N`; NLP can flag verbosity/generic links, DOM can check navigation/location, only usability testing establishes self-evidence. Source: [Steve Krug](https://sensible.com/dont-make-me-think/).

## 5.4 The Design of Everyday Things — Don Norman

Affordances define possible action; **signifiers** communicate where/how to act; mappings make controls correspond naturally to effects; constraints prevent invalid action; feedback promptly reveals result/state; and a coherent conceptual model lets users predict the system. Design for human error with undo, confirmation where cost is high, and reversible operations. `MC:P/N`; event/state/undo coverage is checkable, perceived affordance/model is VLM/user research. Source: [Don Norman book page](https://jnd.org/books/the-design-of-everyday-things-revised-and-expanded-edition/).

## 5.5 Universal Principles of Design

The earlier widely cited edition catalogs 125 principles; the current third edition expands to 200, so “the 125” is edition-specific. High-value UI entries include accessibility, affordance, alignment, chunking, consistency, constraints, confirmation, control, error, hierarchy, hierarchy of needs, legibility, mapping, mental model, modularity, performance load, progressive disclosure, readability, signal-to-noise ratio, similarity, and visibility. `MC:Y` candidates are alignment, dimensions, contrast, response time, consistency/token use, and some error/state coverage; `MC:P` includes hierarchy, chunking, progressive disclosure, mapping, signal/noise; persuasion, beauty, and mental models are `MC:N`. Source: [publisher listing](https://www.rockportpublishers.com/9780760375167/universal-principles-of-design-updated-and-expanded-third-edition-by-william-lidwell-kritina-holden-jill-butler/).

## 5.6 ISO 9241

- **9241-11:** usability is effectiveness, efficiency, and satisfaction in a specified context of use. `MC:P/N`; requires task metrics and participant/context definition.
- **9241-110:2020:** suitability for users' tasks, self-descriptiveness, conformity with user expectations, learnability, controllability, use-error robustness, and user engagement. `MC:P/N`; behavior coverage plus usability evaluation.
- **9241-210:2019:** base design on explicit understanding of users/tasks/environments; involve users throughout; drive/refine by user-centered evaluation; iterate; address whole user experience; use multidisciplinary skills/perspectives. `MC:P/N`; process evidence/assertion audit.

ISO text is copyrighted; link/cite rather than embedding the standard. Sources: [ISO 9241-110](https://www.iso.org/standard/75258.html), [ISO 9241-210](https://www.iso.org/standard/77520.html), [ISO 9241-11](https://www.iso.org/standard/63500.html).

## 5.7 Dieter Rams

Good design is innovative, useful, aesthetic, understandable, unobtrusive, honest, long-lasting, thorough to the last detail, environmentally friendly, and **as little design as possible (“less, but better”)**. Mostly `MC:N`; proxies can flag dark patterns, excess unique styles/assets, performance/resource weight, and missing states, but cannot certify honesty, beauty, or longevity. Primary source: [Vitsœ, Good design](https://www.vitsoe.com/us/about/good-design).

## 5.8 Craft, taste, and restraint

- **Frank Chimero:** ask both “How?” (craft) and “Why?” (purpose); constraints give work shape; consistent voice matters more than identical style; design creates relationships and should be honest. `MC:N/P`. [The Shape of Design](https://shapeofdesignbook.com/), [Ten Principles](https://frankchimero.com/blog/2009/ten-principles/).
- **Tobias van Schneider:** principles teach harmony, but mature judgment asks whether work *feels* right; avoid trend-following and the aesthetic trap where style loses meaning. `MC:N`. [Does it feel right?](https://vanschneider.com/blog/young-designers/does-it-feel-right/), [aesthetic trap](https://vanschneider.com/blog/edition-262/).
- **Robin Rendle:** typography is a service to readers rather than self-expression; text is read before it is admired, and web type is fragile across content/devices. `MC:P/N`; test reading conditions, fallback, zoom, and content stress. [Typography is a service](https://robinrendle.com/notes/typography-is-a-service-not-an-art/), [Reading Design](https://robinrendle.com/notes/reading-design/).

These sources should seed VLM critique prompts, not deterministic style imitation.

## 5.9 Smashing Magazine, A List Apart, and NN/g

- Smashing: practical typography measure **40–80 characters**, responsive type, inclusive motion, meaningful hierarchy, and accessibility stress testing. `MC:P`. [Typography tips](https://www.smashingmagazine.com/2009/04/8-simple-ways-to-improve-typography-in-your-designs/).
- A List Apart: standards-based semantic/responsive design, content-first thinking, progressive enhancement, and resilient web typography. `MC:P`. [A List Apart](https://alistapart.com/).
- NN/g's ten heuristics: visibility of system status; match real world; user control/freedom; consistency/standards; error prevention; recognition over recall; flexibility/efficiency; aesthetic/minimalist design; useful error recovery; help/documentation. `MC:P/N`. [Ten heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/).
- NN/g response thresholds: roughly **0.1s** feels instantaneous, **1s** preserves flow with noticeable delay, **10s** is about the attention limit without stronger progress feedback. Treat as performance heuristics, not WCAG. `MC:Y HEUR`. [Response-time limits](https://www.nngroup.com/articles/response-times-3-important-limits/).

---

# 6. Machine-checkable principles subset

## 6.1 Recommended lint/runtime rule IDs

| Rule ID | Deterministic policy | Suggested implementation |
|---|---|---|
| `a11y.text-contrast-aa` | 4.5:1 normal, 3:1 large; no rounding. | axe-core + custom compositor. |
| `a11y.nontext-contrast` | 3:1 essential controls, states, graphics. | state screenshots + segmentation. |
| `a11y.apca-advisory` | Report Lc by font size/weight/use; never replace WCAG2 result. | `apca-w3`. |
| `a11y.target-size` | WCAG 24px; system profile 44pt Apple or 48dp Material. | Playwright/native hit-region geometry. |
| `a11y.focus-visible` | Focus changes visible pixels; WCAG AAA geometry/3:1 when selected. | focused/unfocused screenshot diff. |
| `a11y.focus-not-obscured` | no full occlusion at AA, no occlusion at AAA. | stacking/elementFromPoint sampling. |
| `a11y.focus-order` | no positive tabindex; focus graph agrees with task/visual order. | ESLint + Playwright overlay/VLM. |
| `a11y.keyboard` | all interactive paths operable; no trap. | state-model E2E keyboard crawler. |
| `a11y.name-role-value` | valid accessible name, role, states; visible label in name. | axe-core + accessibility snapshots. |
| `a11y.document-structure` | lang/title/main/landmarks/labels/list/table semantics. | axe, html-validate, eslint-plugin-jsx-a11y. |
| `a11y.zoom-reflow` | no unacceptable 2D overflow at 320px/400%; text 200%. | Playwright viewport/zoom matrix. |
| `a11y.text-spacing` | survives 1.5/2/.12/.16 overrides. | injected CSS + overlap detector. |
| `a11y.reduced-motion` | media-query variant exists and remains functional. | CSS AST + emulated-media E2E. |
| `tokens.no-raw-values` | component styles use semantic color/type/space/motion/elevation tokens. | Stylelint/ESLint allowlists. |
| `tokens.complete-states` | each interactive semantic role has hover/active/focus/disabled/selected as relevant. | JSON Schema/token graph. |
| `color.ramp-integrity` | OKLCH L monotonic, controlled hue/chroma, gamut mapped, all role pairs tested. | Culori/Color.js script. |
| `type.scale-only` | font sizes/weights/leading/tracking come from named bundles. | Stylelint + computed-style census. |
| `type.measure` | prose line width warning outside 45–75ch (configurable 40–80). | runtime text-line estimator. |
| `space.scale-only` | spacing/sizes use approved tokens; optical exceptions named. | Stylelint custom rule. |
| `layout.grid-alignment` | repeated edges align within tolerance; breakpoint columns/margins match profile. | bounding-box clustering. |
| `layout.overflow-overlap` | no clipped/overlapping content across viewport, zoom, locale, text scale. | Playwright + image/DOM geometry. |
| `motion.tokens-only` | durations/easings are approved; role-specific entrance/exit curves. | CSS/JS AST lint. |
| `motion.performance` | no avoidable layout animation; feedback under configured threshold. | Chrome trace + performance marks. |
| `content.readability` | reading level, sentence/label length, banned jargon, duplicate copy. | Vale, textstat, custom NLP. |
| `content.action-label` | action labels start with meaningful verbs; generic “click here/submit” warning. | NLP with component context. |
| `ia.route-integrity` | no orphan routes, broken links, duplicate route labels; current location/escape available. | route graph crawler. |
| `perf.feedback-threshold` | visual acknowledgement within 100–400ms; progress for long operations. | RUM/E2E marks. |

### Minimal CI stack

```js
// Playwright + axe example
import AxeBuilder from '@axe-core/playwright';
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
  .analyze();
expect(results.violations).toEqual([]);
```

Use: axe-core, Accessibility Insights, Pa11y, Lighthouse CI, html-validate, eslint-plugin-jsx-a11y, Testing Library, Playwright, Storybook test runner, Chromatic/Percy, Stylelint, `stylelint-plugin-carbon-tokens`, Style Dictionary, Tokens Studio, JSON Schema, Culori/Color.js, `apca-w3`, PEAT, Vale, alex, textstat, and bundle/performance budgets. Automated accessibility catches only a subset; do not report “accessible” from a clean axe run.

## 6.2 What a VLM/human must judge

1. Whether visual hierarchy matches task importance rather than merely having different sizes.
2. Whether labels, alt text, headings, errors, and status copy communicate the intended meaning.
3. Whether the information architecture matches user mental models; validate with card sorting/tree testing.
4. Whether progressive disclosure hides needed comparison/context.
5. Whether motion clarifies causality or is gratuitous/distracting.
6. Whether density supports the domain and expertise level.
7. Whether color proportion/harmony fits brand, culture, content, and emotion.
8. Whether affordances/signifiers and mappings are perceived without instruction.
9. Whether the product is honest, non-manipulative, useful, and “less, but better.”
10. Whether craft is coherent: optical alignment, icon weight, edge cases, empty/loading/error states, real content, localization.
11. Whether expressive tactics are appropriate for a banking, health, productivity, media, or youth context.
12. Whether exceptions marked “essential” really are essential.

The MCP should return these as structured review questions with screenshots and evidence, never fake a deterministic pass.

---

# 7. Ranked top 20 principles to encode first

1. **Semantic, native, keyboard-operable interaction** — correct name/role/value, labels, DOM order, no traps (`MC:P`, axe + E2E).
2. **WCAG 2.2 AA text contrast** — 4.5:1 normal, 3:1 large, actual composited state colors (`MC:Y`).
3. **Visible, ordered, unobscured focus** — test every state and sticky overlay (`MC:P`).
4. **Responsive reflow and text resilience** — 320 CSS px/400%, 200% text, exact text-spacing overrides (`MC:Y/P`).
5. **Target geometry** — at least WCAG 24px; 44pt Apple/48dp Material profiles (`MC:Y/P`).
6. **Never rely on color alone; 3:1 essential non-text contrast** (`MC:P`).
7. **Semantic tokens only** — primitive → semantic → component hierarchy for color/type/space/motion/elevation (`MC:Y`).
8. **Complete state and theme matrix** — default/hover/active/focus/selected/disabled across light/dark/high contrast (`MC:Y/P`).
9. **Clear task-driven visual hierarchy** — one obvious primary next action; de-emphasize secondary content (`MC:P`).
10. **Consistent typography bundles and readable measure** — role scale, leading, 45–75ch prose, Dynamic Type/zoom (`MC:Y/P`).
11. **Named spacing/grid system with responsive columns** — no arbitrary values; proximity conveys grouping (`MC:Y/P`).
12. **Error prevention and recovery** — constraints, clear inline errors, preservation, undo/confirm destructive work (`MC:P`).
13. **Immediate feedback and visible system status** — acknowledge under 400ms; show progress beyond flow thresholds (`MC:Y/P`).
14. **Purposeful tokenized motion with reduced-motion equivalent** (`MC:P`).
15. **User-language IA and content** — specific labels, stable navigation, current location, card/tree tested (`MC:P/N`).
16. **Progressive disclosure without hiding the primary task** (`MC:P`).
17. **Perceptual palette generation plus gamut/contrast validation** — OKLCH/HCT is a means, not a pass (`MC:Y/P`).
18. **Platform convention and safe-area adaptation** — don't recreate Apple/Material behavior from memory (`MC:Y/P`).
19. **Real-content stress testing** — long translations, empty/loading/error/offline, large data, narrow/wide screens (`MC:Y/P`).
20. **Restraint, honesty, and craft review** — remove gratuitous elements, reject generic “blurple slop,” inspect every detail (`MC:N/P`).

---

# 8. MCP response contract recommendation

Every generated design should emit a compact machine-readable report alongside code:

```json
{
  "profile": "web-wcag22-aa+house-v1",
  "tokensVersion": "product-ds@3.4.1",
  "checks": [
    {"id":"a11y.text-contrast-aa","status":"pass","evidence":{"minRatio":4.73}},
    {"id":"a11y.target-size","status":"fail","selector":".icon-delete","actual":"20x20 CSS px","required":"24x24 CSS px"},
    {"id":"type.measure","status":"warning","actual":"82ch","range":"45–75ch","provenance":"HEUR"},
    {"id":"hierarchy.primary-action","status":"needs-review","reason":"task importance cannot be inferred from pixels alone"}
  ],
  "exceptions": [],
  "untested": ["screen-reader announcement accuracy", "tree-test task success"]
}
```

A mid-tier model should not be asked to remember these rules. The MCP should retrieve a versioned profile, constrain token choices before generation, run deterministic checks after generation, and route only contextual questions to a VLM/human. Hard failures, advisory heuristics, and judgment prompts must remain separate.
