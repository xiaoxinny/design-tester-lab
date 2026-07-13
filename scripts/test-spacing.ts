/**
 * Tests for src/lib/lint/spacing.ts.
 */
import { parseHtml } from '../src/lib/lint/html-parser';
import { runSpacing, parseSpacingValue, isOnGrid } from '../src/lib/lint/spacing';

let pass = 0;
let fail = 0;

function ok(label: string, detail: string): void {
  console.log(`OK:   ${label} -- ${detail}`);
  pass++;
}

function fail_(label: string, detail: string): void {
  console.log(`FAIL: ${label} -- ${detail}`);
  fail++;
}

function issues(html: string) {
  return runSpacing(parseHtml(html));
}

function main(): void {
  // === isOnGrid unit cases ===

  const onGridCases: Array<[number, boolean]> = [
    [0, true],
    [8, true],
    [16, true],
    [24, true],
    [7, false],
    [13, false],
    [11, false],
    [1, false],
  ];
  for (const [px, expected] of onGridCases) {
    const actual = isOnGrid(px);
    if (actual !== expected) {
      fail_(`isOnGrid(${px})`, `expected ${expected}, got ${actual}`);
    } else {
      ok(`isOnGrid(${px})`, expected ? 'on grid' : 'off grid');
    }
  }

  // === parseSpacingValue unit cases ===

  const px = parseSpacingValue('16px');
  if (px.length !== 1 || px[0] !== 16) {
    fail_('parseSpacingValue("16px")', `got: ${JSON.stringify(px)}`);
  } else {
    ok('parseSpacingValue("16px")', '[16]');
  }

  const rem = parseSpacingValue('1rem');
  if (rem.length !== 1 || rem[0] !== 16) {
    fail_('parseSpacingValue("1rem") -> 16px (assuming 16px root)', `got: ${JSON.stringify(rem)}`);
  } else {
    ok('parseSpacingValue("1rem") -> 16px (assuming 16px root)', '[16]');
  }

  const pt = parseSpacingValue('12pt');
  if (pt.length !== 1 || Math.abs(pt[0]! - 16) > 0.01) {
    fail_('parseSpacingValue("12pt") -> 16px', `got: ${JSON.stringify(pt)}`);
  } else {
    ok('parseSpacingValue("12pt") -> 16px (12 * 4/3)', '[16]');
  }

  const four = parseSpacingValue('16 32 16 32');
  if (four.length !== 4 || four[0] !== 16 || four[1] !== 32 || four[2] !== 16 || four[3] !== 32) {
    fail_('parseSpacingValue("16 32 16 32")', `got: ${JSON.stringify(four)}`);
  } else {
    ok('parseSpacingValue("16 32 16 32")', '[16, 32, 16, 32]');
  }

  const auto = parseSpacingValue('auto');
  if (auto.length !== 1 || auto[0] !== null) {
    fail_('parseSpacingValue("auto") -> [null]', `got: ${JSON.stringify(auto)}`);
  } else {
    ok('parseSpacingValue("auto") -> [null] (skip)', '[null]');
  }

  // === runSpacing: 8-pt grid enforcement ===

  const onGrid = issues(
    '<html><body><div style="padding: 16px; margin: 8px">x</div></body></html>',
  );
  if (onGrid.length > 0) {
    fail_('on-grid padding/margin does not flag', onGrid.map((i) => i.rule).join(','));
  } else {
    ok('on-grid padding/margin does not flag', '0 issues');
  }

  const offGrid = issues(
    '<html><body><div style="padding: 13px">x</div></body></html>',
  );
  const off = offGrid.find((i) => i.rule === 'spacing.off-grid');
  if (!off) {
    fail_('off-grid padding 13px flags', 'no issue');
  } else {
    ok('off-grid padding 13px flags', off.message);
  }

  // === 0 is on grid (collapse) ===

  const zero = issues(
    '<html><body><div style="margin: 0; padding: 0">x</div></body></html>',
  );
  if (zero.length > 0) {
    fail_('margin: 0 does not flag', zero.map((i) => i.message).join('; '));
  } else {
    ok('margin: 0 does not flag (0 is on-grid)', '0 issues');
  }

  // === sub-8px is off-grid (not hairline) ===

  const sub8 = issues(
    '<html><body><div style="padding: 5px">x</div></body></html>',
  );
  if (!sub8.find((i) => i.rule === 'spacing.off-grid')) {
    fail_('padding 5px flags (sub-8px is off-grid for spacing)', 'no issue');
  } else {
    ok('padding 5px flags (sub-8px is off-grid for spacing)', 'flagged');
  }

  // === auto / inherit are skipped (not flagged) ===

  const autoMargin = issues(
    '<html><body><div style="margin: auto">x</div></body></html>',
  );
  if (autoMargin.length > 0) {
    fail_('margin: auto is skipped', autoMargin.map((i) => i.message).join('; '));
  } else {
    ok('margin: auto is skipped (token can be auto)', '0 issues');
  }

  // === multiple decls in one style ===

  const multi = issues(
    '<html><body><div style="padding: 16px; margin: 13px; gap: 8px">x</div></body></html>',
  );
  if (multi.length !== 1) {
    fail_('multi-decl flags only off-grid ones', `got: ${multi.length}`);
  } else {
    ok('multi-decl flags only off-grid ones', '1');
  }

  // === gap rule ===

  const gap = issues(
    '<html><body><div style="gap: 11px">x</div></body></html>',
  );
  if (!gap.find((i) => i.rule === 'spacing.off-grid')) {
    fail_('gap: 11px flags', 'no issue');
  } else {
    ok('gap: 11px flags', 'flagged');
  }

  // === Multi-value spacing with mixed on/off grid ===

  const mixed = issues(
    '<html><body><div style="padding: 8px 13px 16px 24px">x</div></body></html>',
  );
  // 8 (ok) + 13 (off) + 16 (ok) + 24 (ok) = 1 issue
  if (mixed.length !== 1) {
    fail_('multi-value flags only the off-grid sides', `got: ${mixed.length}`);
  } else if (!mixed[0]!.message.includes('right')) {
    fail_('multi-value names the off-grid side', mixed[0]!.message);
  } else {
    ok('multi-value flags only the off-grid side', mixed[0]!.message);
  }

  // === em / rem conversion (best-effort) ===

  const em = issues(
    '<html><body><div style="padding: 1em">x</div></body></html>',
  );
  // 1em = 16px, on grid
  if (em.length > 0) {
    fail_('1em (= 16px) does not flag', em.map((i) => i.message).join('; '));
  } else {
    ok('1em (= 16px) does not flag', '0 issues');
  }

  // === Issue evidence is the source element ===

  const evidence = issues('<html><body><div style="padding: 7px">x</div></body></html>')[0];
  if (!evidence || !evidence.evidence.includes('padding')) {
    fail_('issue evidence includes the source', `got: ${evidence?.evidence}`);
  } else {
    ok('issue evidence includes the source', evidence.evidence);
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
