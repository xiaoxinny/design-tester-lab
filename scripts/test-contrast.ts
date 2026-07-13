/**
 * Tests for src/lib/lint/contrast.ts.
 */
import { parseHtml } from '../src/lib/lint/html-parser';
import { runContrast, contrastRatio } from '../src/lib/lint/contrast';

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
  return runContrast(parseHtml(html));
}

function main(): void {
  // === contrastRatio reference values (well-known pairs) ===

  const whiteOnBlack = contrastRatio([255, 255, 255], [0, 0, 0]);
  if (Math.abs(whiteOnBlack - 21) > 0.1) {
    fail_('white on black is 21:1', `got: ${whiteOnBlack.toFixed(2)}`);
  } else {
    ok('white on black is 21:1', whiteOnBlack.toFixed(2));
  }

  const blackOnWhite = contrastRatio([0, 0, 0], [255, 255, 255]);
  if (Math.abs(blackOnWhite - 21) > 0.1) {
    fail_('black on white is 21:1', `got: ${blackOnWhite.toFixed(2)}`);
  } else {
    ok('black on white is 21:1', blackOnWhite.toFixed(2));
  }

  const sameColor = contrastRatio([128, 128, 128], [128, 128, 128]);
  if (Math.abs(sameColor - 1) > 0.01) {
    fail_('same color is 1:1', `got: ${sameColor.toFixed(2)}`);
  } else {
    ok('same color is 1:1', sameColor.toFixed(2));
  }

  // === High contrast does not flag ===

  const highContrast = issues(
    '<html><body><p style="color: #000; background-color: #fff">x</p></body></html>',
  );
  if (highContrast.length > 0) {
    fail_('black on white does not flag', highContrast.map((i) => i.rule).join(','));
  } else {
    ok('black on white does not flag', '0 issues');
  }

  // === Low contrast flags ===

  const lowContrast = issues(
    '<html><body><p style="color: #999; background-color: #fff">x</p></body></html>',
  );
  const low = lowContrast.find((i) => i.rule === 'contrast.low-ratio');
  if (!low) {
    fail_('light gray on white flags', `got: ${lowContrast.map((i) => i.rule).join(',') || '(none)'}`);
  } else if (low.severity !== 'error') {
    fail_('light gray on white is severity=error (normal text)', `got: ${low.severity}`);
  } else {
    ok('light gray on white flags as error', low.message);
  }

  // === Large text threshold is lower ===

  // 14px gray on white — would fail AA normal (4.5) but is at the boundary.
  // 18px gray on white should pass AA large (3.0).
  const eighteenPx = issues(
    '<html><body><p style="color: #707070; background-color: #fff; font-size: 18px">x</p></body></html>',
  );
  if (eighteenPx.find((i) => i.rule === 'contrast.low-ratio')) {
    fail_('18px gray on white does not flag (AA large)', eighteenPx.map((i) => i.message).join('; '));
  } else {
    ok('18px gray on white does not flag (AA large)', '0 issues');
  }

  // 12px gray on white. #707070 is 4.57:1 against white — above AA normal (4.5).
  // It should NOT flag. The test guards against regression where the
  // threshold is set too high.
  const twelvePx = issues(
    '<html><body><p style="color: #707070; background-color: #fff; font-size: 12px">x</p></body></html>',
  );
  if (twelvePx.find((i) => i.rule === 'contrast.low-ratio')) {
    fail_('12px #707070 on white does not flag (4.57:1 > 4.5)', twelvePx.map((i) => i.message).join('; '));
  } else {
    ok('12px #707070 on white does not flag (4.57:1 > 4.5)', '0 issues');
  }

  // === Named colors parse ===

  const named = issues(
    '<html><body><p style="color: white; background-color: #888">x</p></body></html>',
  );
  if (!named.find((i) => i.rule === 'contrast.low-ratio')) {
    fail_('named color "white" parses', 'no issue');
  } else {
    ok('named color "white" parses', 'flagged');
  }

  // === rgb() parsing ===

  const rgb = issues(
    '<html><body><p style="color: rgb(200, 200, 200); background-color: #fff">x</p></body></html>',
  );
  if (!rgb.find((i) => i.rule === 'contrast.low-ratio')) {
    fail_('rgb() color parses', 'no issue');
  } else {
    ok('rgb() color parses', 'flagged');
  }

  // === Only fg or only bg does not flag (cannot compute without both) ===

  const onlyFg = issues('<html><body><p style="color: #999">x</p></body></html>');
  if (onlyFg.length > 0) {
    fail_('only fg does not flag', onlyFg.map((i) => i.rule).join(','));
  } else {
    ok('only fg does not flag', '0 issues');
  }

  const onlyBg = issues('<html><body><p style="background-color: #999">x</p></body></html>');
  if (onlyBg.length > 0) {
    fail_('only bg does not flag', onlyBg.map((i) => i.rule).join(','));
  } else {
    ok('only bg does not flag', '0 issues');
  }

  // === Hex shorthand ===

  const shorthand = issues(
    '<html><body><p style="color: #f00; background-color: #fff">x</p></body></html>',
  );
  // red on white is 4:1 — at AA large threshold, below AA normal. Should flag.
  if (!shorthand.find((i) => i.rule === 'contrast.low-ratio')) {
    fail_('hex shorthand #f00 parses', 'no issue');
  } else {
    ok('hex shorthand #f00 parses', 'flagged');
  }

  // === Unparseable color format does not flag (silent skip) ===

  const weird = issues(
    '<html><body><p style="color: currentColor; background-color: #fff">x</p></body></html>',
  );
  if (weird.length > 0) {
    fail_('unparseable color does not flag', weird.map((i) => i.rule).join(','));
  } else {
    ok('unparseable color does not flag (silent skip)', '0 issues');
  }

  // === Issue structure is well-formed ===

  const sample = issues('<html><body><p style="color: #aaa; background-color: #fff">x</p></body></html>')[0];
  if (!sample) {
    fail_('low contrast produces an issue', 'no issue');
  } else {
    if (sample.tag !== 'p') {
      fail_('issue carries the right tag', `got: ${sample.tag}`);
    } else if (!sample.evidence.includes('p')) {
      fail_('issue carries evidence', `got: ${sample.evidence}`);
    } else {
      ok('issue carries tag and evidence', sample.tag);
    }
  }

  // === Multiple decls in one style ===

  const multi = issues(
    '<html><body><p style="color: #aaa; margin: 0; background-color: #fff; padding: 0">x</p></body></html>',
  );
  if (multi.length !== 1) {
    fail_('only one issue per element even with multiple decls', `got: ${multi.length}`);
  } else {
    ok('only one issue per element even with multiple decls', '1');
  }

  // === red on white is at AA large (4.0) — not flagged for 18px text ===

  const redLargeText = issues(
    '<html><body><p style="color: #ff0000; background-color: #ffffff; font-size: 18px">x</p></body></html>',
  );
  if (redLargeText.find((i) => i.rule === 'contrast.low-ratio')) {
    fail_('red on white at 18px does not flag (4:1 = AA large)', 'flagged');
  } else {
    ok('red on white at 18px does not flag (4:1 = AA large)', '0 issues');
  }

  // === red on white at 14px flags as warning (large threshold is 3, but normal is 4.5) ===

  // 14px is NOT considered large; AA normal 4.5 applies; red/white is 4:1 — flag.
  const redSmallText = issues(
    '<html><body><p style="color: #ff0000; background-color: #ffffff; font-size: 14px">x</p></body></html>',
  );
  if (!redSmallText.find((i) => i.rule === 'contrast.low-ratio')) {
    fail_('red on white at 14px flags (AA normal is 4.5)', 'no flag');
  } else {
    ok('red on white at 14px flags (AA normal is 4.5)', 'flagged');
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
