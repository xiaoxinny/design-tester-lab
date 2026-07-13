/**
 * Spacing rule.
 *
 * Extracts margin / padding / gap values from inline `style` attributes
 * and checks 8-pt grid adherence. The 8-pt grid is the design convention
 * the constitution augmentation enforces.
 *
 * What it catches:
 *   - margin: 13px (off-grid)
 *   - padding: 7px (off-grid)
 *   - gap: 11px (off-grid)
 *
 * What it does NOT check:
 *   - 1px hairlines (border, outline) -- those are exempt from the grid
 *   - em / rem / % values -- converted to px assuming 16px root
 *   - calc() / var() / clamp() -- the value is opaque
 *   - values inside <style> blocks -- out of scope (token rule's job)
 */
import type { ParsedDocument, Element } from './html-parser';
import type { LintIssue } from './semantic';

const GRID_PX = 8;
const TOLERANCE_PX = 0.5; // floating-point tolerance for parsed values

const SPACING_PROPS = ['margin', 'padding', 'gap', 'row-gap', 'column-gap'] as const;
type SpacingProp = typeof SPACING_PROPS[number];

const PROPS_ALLOWING_TOP_RIGHT_BOTTOM_LEFT: SpacingProp[] = ['margin', 'padding'];
const GAP_LIKE: SpacingProp[] = ['gap', 'row-gap', 'column-gap'];

export function runSpacing(doc: ParsedDocument): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const el of doc.elements) {
    if (!el.inlineStyle) continue;
    const parsed = parseStyleBlock(el.inlineStyle);
    for (const prop of SPACING_PROPS) {
      const value = parsed[prop];
      if (value === null) continue;
      const values = parseSpacingValue(value);
      for (let i = 0; i < values.length; i++) {
        const px = values[i]!;
        if (px === null) continue; // unparseable token (e.g. 'auto', 'inherit')
        if (!isOnGrid(px)) {
          const side = PROPS_ALLOWING_TOP_RIGHT_BOTTOM_LEFT.includes(prop)
            ? sideNameForIndex(prop as 'margin' | 'padding', values.length, i)
            : '';
          const descriptor = side ? `${prop}-${side}: ${value}` : `${prop}: ${value}`;
          issues.push({
            rule: 'spacing.off-grid',
            severity: 'warning',
            message: `${descriptor} (${px}px) is not on the 8-pt grid`,
            evidence: evidenceOf(el),
            tag: el.tag,
          });
        }
      }
    }
  }
  return issues;
}

// =====================================================================
// Style parsing
// =====================================================================

interface ParsedStyle {
  margin: string | null;
  padding: string | null;
  gap: string | null;
  'row-gap': string | null;
  'column-gap': string | null;
}

function parseStyleBlock(style: string): ParsedStyle {
  const out: ParsedStyle = {
    margin: null,
    padding: null,
    gap: null,
    'row-gap': null,
    'column-gap': null,
  };
  for (const decl of style.split(';')) {
    const colon = decl.indexOf(':');
    if (colon < 0) continue;
    const key = decl.slice(0, colon).trim().toLowerCase();
    const value = decl.slice(colon + 1).trim();
    if (key === 'margin') out.margin = value;
    else if (key === 'padding') out.padding = value;
    else if (key === 'gap') out.gap = value;
    else if (key === 'row-gap') out['row-gap'] = value;
    else if (key === 'column-gap') out['column-gap'] = value;
  }
  return out;
}

/**
 * Parse a CSS spacing value into a list of px values.
 *
 * - '16px' -> [16]
 * - '1rem'  -> [16]  (assumes 16px root)
 * - '12pt'  -> [16]  (1pt = 1.333px)
 * - '16 32' -> [16, 32]
 * - '16 32 16 32' -> [16, 32, 16, 32]
 * - 'auto' -> [null] (skip)
 * - 'inherit' -> [null] (skip)
 */
export function parseSpacingValue(value: string): (number | null)[] {
  return value
    .trim()
    .split(/\s+/)
    .map((tok) => parseSingleLength(tok));
}

function parseSingleLength(tok: string): number | null {
  const t = tok.trim().toLowerCase();
  if (t === '' || t === 'auto' || t === 'inherit' || t === 'initial' || t === 'unset') {
    return null;
  }
  const m = /^(-?\d*\.?\d+)(px|pt|rem|em)?$/.exec(t);
  if (!m) return null;
  const num = Number(m[1]);
  if (Number.isNaN(num)) return null;
  const unit = m[2] ?? 'px';
  if (unit === 'px') return num;
  if (unit === 'pt') return num * (4 / 3);
  if (unit === 'rem') return num * 16;
  if (unit === 'em') return num * 16; // best-effort
  return null;
}

export function isOnGrid(px: number): boolean {
  // 0 is a special value (collapse) — always on grid.
  if (px === 0) return true;
  // Allow 1px for hairlines (border, outline). Spacing should be >= 8.
  if (px < GRID_PX) return false;
  const remainder = Math.abs(Math.round(px) - px);
  if (remainder > TOLERANCE_PX) return false; // not an integer
  return Math.round(px) % GRID_PX === 0;
}

function sideNameForIndex(prop: 'margin' | 'padding', count: number, i: number): string {
  if (count === 1) return '';
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  return sides[i] ?? '';
}

const MAX_EVIDENCE = 200;
function evidenceOf(el: Element): string {
  return el.source.length > MAX_EVIDENCE
    ? el.source.slice(0, MAX_EVIDENCE) + '...'
    : el.source;
}
