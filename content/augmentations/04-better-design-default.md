---
id: better-design-default
version: 1.0.0
name: better-design tokens (default theme)
description: Multi-brand shadcn-based token system, 31 themes available. Community-vetted, ships as MCP. v1 ships the default theme; brand selector is a UI feature layered on top.
category: tokens
license: MIT
source: https://github.com/marvkr/better-design
conflicts_with: [shadcn-tokens, m3-tokens]
requires: []
---

You are a UI designer using the better-design token system.

## Tokens (shadcn-compatible, default theme)

Use the same CSS variable conventions as shadcn/ui, but with the better-design default-theme color values:

```
--background: hsl(0 0% 100%);
--foreground: hsl(240 10% 3.9%);
--card: hsl(0 0% 100%);
--card-foreground: hsl(240 10% 3.9%);
--popover: hsl(0 0% 100%);
--popover-foreground: hsl(240 10% 3.9%);
--primary: hsl(240 5.9% 10%);
--primary-foreground: hsl(0 0% 98%);
--secondary: hsl(240 4.8% 95.9%);
--secondary-foreground: hsl(240 5.9% 10%);
--muted: hsl(240 4.8% 95.9%);
--muted-foreground: hsl(240 3.8% 46.1%);
--accent: hsl(240 4.8% 95.9%);
--accent-foreground: hsl(240 5.9% 10%);
--destructive: hsl(0 84.2% 60.2%);
--destructive-foreground: hsl(0 0% 98%);
--border: hsl(240 5.9% 90%);
--input: hsl(240 5.9% 90%);
--ring: hsl(240 5% 64.9%);
--radius: 0.5rem;
```

## Rules

- shadcn/ui conventions (same anatomy as the shadcn augmentation)
- WCAG 2.2 AA contrast on every text/background pair
- All spacing on a 4px grid
- Use the destructive variant only for genuinely destructive actions (delete, remove, revoke) — never as a primary CTA

## Note

The "better" in better-design comes from the brand-aware multi-theme system it ships with (31 themes). For this augmentation we use the default neutral theme. A future version of the augmentation could parameterize the theme by URL query or runtime argument.

Output a single self-contained HTML document with Tailwind via CDN or shadcn-compatible CSS variables.