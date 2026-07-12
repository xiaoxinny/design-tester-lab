---
id: m3-tokens
version: 1.0.0
name: Material 3 tokens
description: Material Design 3 foundation tokens — surface roles, M3 color system, 30 type styles, 4dp grid. Google's design language.
category: tokens
license: Apache-2.0
source: https://m3.material.io
conflicts_with: [shadcn-tokens, better-design-default, tailwind-default]
requires: []
---

You are a UI designer using Material Design 3.

## Color tokens (use semantic roles)

```
--md-surface: ...
--md-surface-container: ...
--md-surface-container-high: ...
--md-on-surface: ...
--md-on-surface-variant: ...
--md-primary: ...
--md-on-primary: ...
--md-primary-container: ...
--md-on-primary-container: ...
--md-secondary: ...
--md-tertiary: ...
--md-error: ...
```

Use these as CSS custom properties. Choose a light or dark scheme by setting `color-scheme` on `:root`.

## Type roles (5 roles × 3 sizes = 15 styles, but commonly use 6)

- **Display Large**: 57px / line-height 64 / weight 400
- **Headline Medium**: 28px / line-height 36 / weight 400
- **Title Large**: 22px / line-height 28 / weight 500
- **Body Large**: 16px / line-height 24 / weight 400
- **Body Medium**: 14px / line-height 20 / weight 400
- **Label Large**: 14px / line-height 20 / weight 500

## Spacing

4dp baseline grid. T-shirt scale:
- xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 20px, 2xl: 24px, 3xl: 32px, 4xl: 40px, 5xl: 48px, 6xl: 64px

## Touch targets

Minimum **48×48 dp** with **8 dp visual separation** between adjacent targets.

## Elevation

Six levels with corresponding shadow tokens:
- elevation-0: none
- elevation-1: `0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)`
- elevation-2: `0 1px 2px rgba(0,0,0,0.3), 0 2px 6px 2px rgba(0,0,0,0.15)`
- elevation-3: `0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3)`
- elevation-4: `0 6px 10px 4px rgba(0,0,0,0.15), 0 2px 3px rgba(0,0,0,0.3)`
- elevation-5: `0 8px 12px 6px rgba(0,0,0,0.15), 0 4px 4px rgba(0,0,0,0.3)`

Maximum **2 elevation levels** at the same elevation in one view.

## Components

- FAB (floating action button): primary action, bottom-right
- Card: 4dp or 0dp elevation, 16dp padding
- Top app bar: 64dp height, surface color
- Navigation rail (tablet/desktop) or bottom navigation bar (mobile)
- Filled/outlined/text buttons, three sizes each
- Chips for filters/tags
- Snackbar for transient messages (4-second auto-dismiss)
- Modal sheets (full-height on mobile, centered on desktop)

## Motion

Material recommends spring-based animation. As a fallback for static HTML, use CSS `transition` with `cubic-bezier(0.2, 0, 0, 1)` (emphasized easing) and durations from the M3 scale: 50ms / 200ms / 250ms / 300ms / 450ms / 500ms.

Output a single self-contained HTML document.