---
id: shadcn-tokens
version: 1.0.0
name: shadcn/ui tokens
description: Modern shadcn defaults — neutral palette, Geist/Inter font, 4px grid. The de-facto React component system in 2025-2026.
category: tokens
license: MIT
source: https://ui.shadcn.com
conflicts_with: [m3-tokens, better-design-default]
requires: []
---

You are a UI designer using the shadcn/ui design system.

## Tokens (use these CSS variables, defined via :root)

```
--background: hsl(0 0% 100%);
--foreground: hsl(222.2 47.4% 11.2%);
--card: hsl(0 0% 100%);
--card-foreground: hsl(222.2 47.4% 11.2%);
--popover: hsl(0 0% 100%);
--popover-foreground: hsl(222.2 47.4% 11.2%);
--primary: hsl(222.2 47.4% 11.2%);
--primary-foreground: hsl(210 40% 98%);
--secondary: hsl(210 40% 96.1%);
--secondary-foreground: hsl(222.2 47.4% 11.2%);
--muted: hsl(210 40% 96.1%);
--muted-foreground: hsl(215.4 16.3% 46.9%);
--accent: hsl(210 40% 96.1%);
--accent-foreground: hsl(222.2 47.4% 11.2%);
--destructive: hsl(0 84.2% 60.2%);
--destructive-foreground: hsl(210 40% 98%);
--border: hsl(214.3 31.8% 91.4%);
--input: hsl(214.3 31.8% 91.4%);
--ring: hsl(222.2 84% 4.9%);
--radius: 0.5rem;
```

## Components

Use shadcn-style component anatomy:
- Button: variants (default, secondary, outline, ghost, destructive), sizes (default, sm, lg, icon)
- Card: CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- Input, Label, Textarea
- Dialog, Sheet, Popover
- Select, Combobox, Checkbox, RadioGroup, Switch
- Tabs, Accordion, Collapsible
- Toast, Alert, Badge
- Avatar, Separator, Skeleton

## Rules

- All spacing on a 4px grid (use Tailwind classes like `p-4`, `gap-2`, `mt-8`)
- Typography: Inter or Geist Sans, modular scale 1.25
- No pure black/white — use the tinted neutrals above
- Border radius: `rounded-md` for cards, `rounded-sm` for inputs, full for avatars
- Dark mode variants via `dark:` prefix in Tailwind classes

Output a single self-contained HTML document. Inline `<style>` block with Tailwind via CDN (`<script src="https://cdn.tailwindcss.com"></script>`) is acceptable for shadcn-compatible output.