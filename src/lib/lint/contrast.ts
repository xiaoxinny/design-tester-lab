/**
 * Color contrast rule.
 *
 * Extracts foreground and background color pairs from inline `style`
 * attributes (color: ...; background-color: ...;) and computes the
 * WCAG 2.2 contrast ratio. The minimum thresholds are AA (4.5 for body
 * text, 3.0 for large text >= 18px or >= 14px bold).
 *
 * This rule does NOT do computed-style resolution. It only sees the
 * colors that are explicitly declared on each element. CSS rules in
 * `<style>` blocks are out of scope for this rule (token rule handles
 * them in the future).
 *
 * What it catches:
 *   - white-on-white (impossible to read)
 *   - light gray on white (insufficient contrast)
 *   - dark text on dark background
 *
 * What it does NOT catch:
 *   - background images with foreground text overlay
 *   - CSS class-based color rules
 *   - inherited colors
 */
import type { ParsedDocument, Element } from './html-parser';
import type { LintIssue, Severity } from './semantic';

const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;
const LARGE_PX = 18; // WCAG considers text "large" at >= 18px or >= 14px bold

export function runContrast(doc: ParsedDocument): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const el of doc.elements) {
    if (!el.inlineStyle) continue;
    const parsed = parseStyleBlock(el.inlineStyle);
    if (!parsed.fg || !parsed.bg) continue; // need both colors
    const fgRgb = parseColor(parsed.fg);
    const bgRgb = parseColor(parsed.bg);
    if (!fgRgb || !bgRgb) continue; // unknown color format
    const ratio = contrastRatio(fgRgb, bgRgb);
    const fontSize = parseFontSizePx(parsed.fontSize);
    const isLarge = fontSize !== null && fontSize >= LARGE_PX;
    const threshold = isLarge ? AA_LARGE : AA_NORMAL;
    // No tolerance. WCAG's formula is exact: (L1 + 0.05) / (L2 + 0.05). The
    // 0.05 in the formula is a luminance offset, not a pass/fail tolerance.
    // A borderline ratio like 4.49 must fail. Allowing a tolerance would
    // produce false AA passes.
    if (ratio < threshold) {
      issues.push({
        rule: 'contrast.low-ratio',
        severity: isLarge ? 'warning' : 'error',
        message: `Contrast ratio ${ratio.toFixed(2)}:1 (${parsed.fg} on ${parsed.bg}) is below ${threshold}:1 (${isLarge ? 'large' : 'normal'} text, WCAG AA)`,
        evidence: evidenceOf(el),
        tag: el.tag,
      });
    }
  }
  return issues;
}

// =====================================================================
// Inline style parsing
// =====================================================================

interface ParsedStyle {
  fg: string | null;
  bg: string | null;
  fontSize: string | null;
}

function parseStyleBlock(style: string): ParsedStyle {
  const out: ParsedStyle = { fg: null, bg: null, fontSize: null };
  // Split on `;`, trim, look for `key: value` pairs.
  for (const decl of style.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const key = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).trim();
    if (key === 'color') out.fg = value;
    else if (key === 'background-color' || key === 'background') out.bg = value;
    else if (key === 'font-size') out.fontSize = value;
  }
  return out;
}

// =====================================================================
// Color parsing (hex, rgb, named)
// =====================================================================

type RGB = readonly [number, number, number];

const NAMED_COLORS: Record<string, RGB> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  maroon: [128, 0, 0],
  olive: [128, 128, 0],
  purple: [128, 0, 128],
  teal: [0, 128, 128],
  navy: [0, 0, 128],
  orange: [255, 165, 0],
  pink: [255, 192, 203],
  brown: [165, 42, 42],
  transparent: [0, 0, 0], // treated as black for contrast (best-case)
};

function parseColor(value: string): RGB | null {
  const v = value.trim().toLowerCase();
  if (v in NAMED_COLORS) return NAMED_COLORS[v]!;

  // Hex: #rgb, #rrggbb, #rgba, #rrggbbaa
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return [r, g, b];
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((n) => Number.isNaN(n))) return null;
      return [r, g, b];
    }
    return null;
  }

  // rgb() / rgba()
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (m) {
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    if (r > 255 || g > 255 || b > 255) return null;
    return [r, g, b];
  }
  return null;
}

// =====================================================================
// WCAG 2.x relative luminance + contrast ratio
// =====================================================================

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: RGB): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

export function contrastRatio(fg: RGB, bg: RGB): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lo, hi] = l1 < l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// =====================================================================
// Font size parsing (px, em, rem, pt)
// =====================================================================

function parseFontSizePx(value: string | null): number | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  const m = /^(-?\d*\.?\d+)\s*(px|pt|rem|em)?$/.exec(v);
  if (!m) return null;
  const num = Number(m[1]);
  if (Number.isNaN(num)) return null;
  const unit = m[2] ?? 'px';
  if (unit === 'px') return num;
  if (unit === 'pt') return num * (4 / 3); // 1pt = 1.333px
  if (unit === 'em' || unit === 'rem') return num * 16; // assume root 16px
  return null;
}

// =====================================================================
// Helpers
// =====================================================================

const MAX_EVIDENCE = 200;
function evidenceOf(el: Element): string {
  return el.source.length > MAX_EVIDENCE
    ? el.source.slice(0, MAX_EVIDENCE) + '...'
    : el.source;
}
