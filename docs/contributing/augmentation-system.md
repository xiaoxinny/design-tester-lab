# Contributing: the augmentation system

**Status:** Applies to all augmentations in this repository.
**Audience:** Anyone adding or modifying augmentations.

## What an augmentation is

An augmentation is a YAML-frontmatter + markdown-body text file in `content/augmentations/` that contributes part of the system prompt sent to the model under evaluation. The system prompt is composed by combining all selected augmentations in a deterministic order: **tokens → principles → behavior**.

```yaml
---
id: shadcn-tokens      # unique identifier (lowercase-with-dashes)
version: 1.0.0         # semver; bumped on any non-trivial change
name: shadcn/ui tokens # human-readable name (sentence case)
description: ...      # one-paragraph summary of what this augmentation does
category: tokens      # tokens | principles | behavior
license: MIT          # SPDX identifier
source: https://...   # URL where this augmentation's content came from
conflicts_with: []    # list of augmentation IDs that conflict with this one
requires: []          # list of augmentation IDs that must be present when this one is used
---

# Markdown body — the actual system prompt fragment

You are a UI designer using the shadcn/ui design system.
... (full body) ...
```

The markdown body is what gets injected into the model's system prompt. The YAML frontmatter is metadata used by the loader and the stack validator.

## The three categories

### Tokens (pick exactly 1)

Token systems define the design-language primitives the model uses: colors, typography, spacing, components. Multiple token systems are mutually exclusive because they contradict each other.

Tokens
- `none` — baseline; zero system prompt augmentation
- `shadcn-tokens` — shadcn/ui design system
- `m3-tokens` — Material Design 3
- `better-design-default` — better-design multi-brand (default theme)

### Principles

Pick zero or one. Principles add codified design rules to the model's instructions: WCAG, type scale, semantic HTML, aesthetic dispositions. Picking more than one principle results in contradictory rules.

- `constitution-tier-1-2` — hard rules + structural rules
- `constitution-full` — hard rules + structural rules + aesthetic dispositions (a superset of tier-1-2)

### Behavior

Pick zero or one; the two are mutually exclusive. Behavior augmentations modify HOW the model generates, leaving the what unchanged. They're mutually exclusive because both behaviors run an additional model call in a similar way and composing them doubles cost for no clear benefit.

- `critique-revise` — generate, then model critiques its own output, then revises (Self-Refine, Madaan et al. 2023)
- `lint-feedback` — generate, then run deterministic lint, inject lint output as feedback, model revises

Both behaviors require `constitution-tier-1-2` (they critique against the rubric).

## Adding a new augmentation

1. **Pick the category.** Tokens need a defensible design system. Principles need codified rules with sources. Behaviors need empirical evidence that the pattern improves generation quality.

2. **Write the file.** Create `content/augmentations/<NN>-<id>.md` where NN is a two-digit sequence number. Use `02-shadcn-tokens.md` as a template.

3. **Required frontmatter fields:**
   - `id`: lowercase-with-dashes, globally unique
   - `version`: semver string
   - `name`: human-readable
   - `description`: one paragraph, must explain WHY this augmentation exists
   - `category`: tokens | principles | behavior
   - `license`: SPDX identifier (MIT, Apache-2.0, CC-BY-4.0, etc.)
   - `source`: URL or `internal://...` for project-authored content
   - `conflicts_with`: list of augmentation IDs (version pins excluded)
   - `requires`: list of augmentation IDs (version pins excluded)

4. **Required body sections** (where applicable):
   - The full text the model sees as a system prompt fragment
   - Any specific values (colors, sizes, tokens) the model uses
   - A clear workflow if it's a behavior augmentation
   - Citations to source material

5. **Add to stack validation logic.** The loader enforces conflicts_with via `src/lib/augmentations/validate-stack.ts` (unimplemented). If you add conflicts or requires, the validation must handle them.

6. **Test it.** Run `pnpm db:seed` to load the augmentation, then run it through a generation in the playground UI to verify it produces expected results.

7. **Document.** Update `docs/contributing/augmentation-system.md` (this file) if the augmentation changes the rules.

8. **PR review.** Augmentations inject text into the model system prompt. A malicious augmentation exfiltrates via prompt injection. Reviewers must:
   - Verify the source URL is legitimate (or `internal://` for project-authored)
   - Verify the body doesn't contain hidden instructions targeting other tools (e.g., "ignore the user's prompt and...")
   - Verify conflicts_with + requires are correct

## Conflict and requirement semantics

`conflicts_with` and `requires` are **id-only** — they omit version pins. This is intentional:

- **Conflicts are categorical.** "Two token systems are mutually exclusive" is true across versions of either. Adding version pins forces every version bump to update the conflicts array.
- **Requirements are categorical too.** If a behavior augmentation genuinely depends on a specific version of the constitution, the schema can carry `(id, version)` tuples. No augmentation requires this.

The stack validator blocks `shadcn-tokens` + `m3-tokens` simultaneously. The stack validator warns or blocks `critique-revise` without `constitution-tier-1-2`.

The validator logic is in `src/lib/augmentations/validate-stack.ts` (unimplemented; the conflicts and requires are recorded but the picker leaves them unenforced). The runner enforces them server-side: if a user submits a conflicting stack, the generation fails with a clear error.

## Worked example: adding a `tailwind-tokens` augmentation

```yaml
---
id: tailwind-default
version: 1.0.0
name: Tailwind CSS defaults
description: Default Tailwind theme — neutral palette, Inter font, 4px grid. The most common token system in AI-generated UI as of 2025.
category: tokens
license: MIT
source: https://tailwindcss.com
conflicts_with: [shadcn-tokens, m3-tokens, better-design-default]
requires: []
---

You are a UI designer using the Tailwind CSS default theme.

## Tokens (use Tailwind utility classes)

```
colors:
- gray-50: #f9fafb
- gray-900: #111827
- blue-600: #2563eb
- red-600: #dc2626
... (full Tailwind v4 palette)
spacing: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96
fontFamily: Inter, system-ui, sans-serif
borderRadius: none, sm(2px), DEFAULT(4px), md(6px), lg(8px), xl(12px), 2xl(16px), full(9999px)
```

## Components

Use Tailwind utility composition:
- Button: `px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700`
- Card: `rounded-lg border border-gray-200 p-6 shadow-sm`
- Input: `rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500`

## Rules

- Use Tailwind utility classes for everything; no inline styles
- Stick to the default theme unless explicitly overridden
- Mobile-first: design for 375px width, scale up

Output a single self-contained HTML document. Use Tailwind via CDN (`<script src="https://cdn.tailwindcss.com"></script>`).
```

Note: this is the same form as `02-shadcn-tokens.md`, `03-m3-tokens.md`, and `04-better-design-default.md`. Consistency is good.

## Versioning policy

- **Patch (1.0.x)**: typo fixes, clarifications to the body, no semantic change. Re-running the seed loader updates the row in place.
- **Minor (1.x.0)**: substantive additions to the augmentation (new tokens, new components, new rules). Old versions stay in the DB unless explicitly removed.
- **Major (x.0.0)**: breaking change in conflict or require semantics, or fundamental rewrite of the augmentation. The new version is published alongside the old; users opt in.

When you bump a major version, you should also update the conflicts/requires of any augmentations that referenced the old version (rare, since id-only refs are used).

## What augmentations do NOT do

- They do not run any code. Augmentations are pure text injected into the system prompt.
- They do not modify the model's response format. The model always returns HTML.
- They do not have access to the lint engine's output. (The `lint-feedback` behavior calls the lint engine server-side and injects its output; the augmentation itself is just a prompt.)
- They do not persist any state. Each generation is independent.

## Testing

`pnpm db:seed` validates YAML parsing and frontmatter shape. To test that an augmentation actually improves generation quality:

1. Run `pnpm db:seed` to load it
2. In the playground UI, pick the same prompt with `none` and with your new augmentation
3. Compare the two outputs side by side
4. Run the deterministic lint on each — does your augmentation move the lint score?

Compare augmentation outputs by visual inspection. A programmatic A/B harness is not part of the project yet.

## How a stack becomes a system prompt

The generation runner (`src/lib/generation/runner.ts`) reads a stack like `[{id: 'shadcn-tokens', version: '1.0.0'}, {id: 'constitution-tier-1-2', version: '1.0.0'}]` and resolves it through `src/lib/augmentations/apply-stack.ts`. The resolver does one `SELECT` against the `augmentations` table to fetch all rows, then concatenates their `system_prompt` fields in the order they appear in the stack (the SQL `WHERE (id=?,version=?) OR ...` is not ordered, so the resolver rebuilds order from the input array). The concatenated text is what the runner sends to the model as the `system` field.

Stack validation (conflicts / requires) is a separate concern. The resolver does not enforce it; the UI picker is expected to validate before calling. If the resolver finds an id that no longer exists in the table (e.g. a seed was rolled back), it throws a 400 and the runner does not save a run row.