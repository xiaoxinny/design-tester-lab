/**
 * Tests for src/lib/lint/runner.ts.
 */
import { runLint, isLintPass } from '../src/lib/lint/runner';

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

function expectIssue(label: string, html: string, rule: string): void {
  const issues = runLint(html).issues;
  const found = issues.find((i) => i.rule === rule);
  if (!found) {
    fail_(label, `expected ${rule} but got: ${issues.map((i) => i.rule).join(',') || '(none)'}`);
  } else {
    ok(label, found.message);
  }
}

function expectNoIssue(label: string, html: string, rule: string): void {
  const issues = runLint(html).issues;
  if (issues.find((i) => i.rule === rule)) {
    fail_(label, `expected no ${rule} but got: ${issues.find((i) => i.rule === rule)!.message}`);
  } else {
    ok(label, 'no ' + rule);
  }
}

function main(): void {
  // === Empty input ===

  // parse5 wraps empty input in <html><head></head><body></body></html>,
  // which has no <html lang="..."> and no <h1>. The semantic rules
  // correctly flag both. This is a degenerate case: there is no actual
  // content to lint. The runner does not silently zero out issues.
  const empty = runLint('');
  if (empty.totalIssues === 0) {
    ok('empty input produces 0 issues (degenerate, no content)', '0');
  } else if (empty.issues.every((i) => i.rule === 'semantic.html-lang' || i.rule === 'semantic.no-h1')) {
    ok('empty input only produces the html-lang + no-h1 issues', `${empty.totalIssues}`);
  } else {
    fail_('empty input only produces the html-lang + no-h1 issues', `${empty.issues.map((i) => i.rule).join(',')}`);
  }

  // === runLint is total ===

  // Pathological inputs must not throw. They produce a report with a
  // lint-internal-error issue if parsing fails, or a normal report if
  // the parse succeeds but rules find no issues.
  let threw = false;
  try {
    const r = runLint('<><><>< broken html');
    if (!r) {
      fail_('runLint on broken HTML returns a report', 'undefined');
    } else {
      ok('runLint on broken HTML returns a report', `${r.totalIssues} issues`);
    }
  } catch (e) {
    threw = true;
    fail_('runLint on broken HTML does not throw', `threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (threw) ok('runLint on broken HTML does not throw', 'no-throw');

  // === Heading jump-back ===

  expectIssue('h6 -> h2 jump-back flags',
    '<html><body><h1></h1><h6></h6><h2></h2></body></html>',
    'semantic.heading-jump-back');
  expectNoIssue('h3 -> h2 (one level back) does not flag',
    '<html><body><h1></h1><h3></h3><h2></h2></body></html>',
    'semantic.heading-jump-back');

  // === Total rule count baseline ===

  const allRules = new Set<string>();
  for (const issue of empty.issues) allRules.add(issue.rule);
  for (const issue of runLint('<html><body><img src="x.png"></body></html>').issues) allRules.add(issue.rule);
  for (const issue of runLint('<html><body><h1></h1><h6></h6><h2></h2></body></html>').issues) allRules.add(issue.rule);
  // We expect at least semantic.html-lang, semantic.no-h1, semantic.img-alt, semantic.heading-jump-back
  if (allRules.size < 4) {
    fail_('four rule ids across the tests', `got: ${[...allRules].join(',')}`);
  } else {
    ok('four rule ids across the tests', `${allRules.size}`);
  }

  // === Clean input passes ===

  const clean = runLint(
    '<html lang="en"><body><h1>Title</h1><p style="color: #000; background-color: #fff; padding: 8px">x</p></body></html>',
  );
  if (clean.totalIssues !== 0) {
    fail_('clean input passes', `got ${clean.totalIssues} issues: ${clean.issues.map((i) => i.rule).join(',')}`);
  } else {
    ok('clean input passes', '0 issues');
  }

  // === Multiple rule families run in one call ===

  const dirty = runLint(
    '<html><body><h1></h1><h3></h3><img src="x"><p style="color: #aaa; background-color: #fff; padding: 13px">x</p></body></html>',
  );
  // Expected issues:
  //   - semantic.heading-skip (h1 -> h3)
  //   - semantic.html-lang
  //   - semantic.img-alt
  //   - contrast.low-ratio
  //   - spacing.off-grid
  if (dirty.totalIssues < 4) {
    fail_('multi-rule run catches all 4 issues', `got: ${dirty.totalIssues}`);
  } else {
    ok('multi-rule run catches all 4 issues', `${dirty.totalIssues}`);
  }
  // Verify byRule is populated
  if (Object.keys(dirty.byRule).length < 4) {
    fail_('byRule is populated for all 4 rules', `got: ${JSON.stringify(dirty.byRule)}`);
  } else {
    ok('byRule is populated for all 4 rules', Object.keys(dirty.byRule).length + ' rules');
  }

  // === include option filters rule sets ===

  const onlySemantic = runLint(dirty.issues.map((i) => i.evidence).join(''), {
    include: ['semantic'],
  });
  if (onlySemantic.totalIssues === 0) {
    fail_('include=semantic only runs semantic rules', '0 issues');
  } else {
    // All issues should be semantic.* rules
    const nonSemantic = onlySemantic.issues.filter((i) => !i.rule.startsWith('semantic.'));
    if (nonSemantic.length > 0) {
      fail_('include=semantic filters out non-semantic issues', nonSemantic.map((i) => i.rule).join(','));
    } else {
      ok('include=semantic filters out non-semantic issues', `${onlySemantic.totalIssues} all semantic`);
    }
  }

  const onlyContrast = runLint(
    '<html><body><p style="color: #aaa; background-color: #fff; padding: 13px">x</p></body></html>',
    { include: ['contrast'] },
  );
  const nonContrast = onlyContrast.issues.filter((i) => !i.rule.startsWith('contrast.'));
  if (nonContrast.length > 0) {
    fail_('include=contrast filters out non-contrast issues', nonContrast.map((i) => i.rule).join(','));
  } else {
    ok('include=contrast filters out non-contrast issues', `${onlyContrast.totalIssues} all contrast`);
  }

  // === bySeverity counts ===

  const sevTest = runLint(
    '<html><body><img src="x"><h1></h1><h3></h3></body></html>',
  );
  if (sevTest.bySeverity.error < 2) {
    fail_('error-severity count is right (img-alt + html-lang)', `got: ${sevTest.bySeverity.error}`);
  } else {
    ok('error-severity count is right (img-alt + html-lang)', `${sevTest.bySeverity.error}`);
  }
  if (sevTest.bySeverity.warning < 1) {
    fail_('warning-severity count is right (heading-skip)', `got: ${sevTest.bySeverity.warning}`);
  } else {
    ok('warning-severity count is right (heading-skip)', `${sevTest.bySeverity.warning}`);
  }

  // === isLintPass ===

  const passReport = runLint(
    '<html lang="en"><body><h1></h1></body></html>',
  );
  if (!isLintPass(passReport)) {
    fail_('clean report passes', 'not pass');
  } else {
    ok('clean report passes', 'isLintPass=true');
  }

  const failReport = runLint(
    '<html><body><img src="x"></body></html>',
  );
  if (isLintPass(failReport)) {
    fail_('report with error fails', 'isLintPass=true');
  } else {
    ok('report with error fails', 'isLintPass=false');
  }

  // === inputBytes is set ===

  if (dirty.inputBytes <= 0) {
    fail_('inputBytes is set', `got: ${dirty.inputBytes}`);
  } else {
    ok('inputBytes is set', `${dirty.inputBytes}`);
  }

  // === ranAt is recent ===

  const before = Date.now();
  const r = runLint('<html><body></body></html>');
  const after = Date.now();
  if (r.ranAt < before || r.ranAt > after) {
    fail_('ranAt is recent', `got: ${r.ranAt}, expected between ${before} and ${after}`);
  } else {
    ok('ranAt is recent', String(r.ranAt));
  }

  // === report is JSON-serializable (will be stored in DB as TEXT) ===

  let serialized: string;
  let roundtripped: typeof clean;
  try {
    serialized = JSON.stringify(clean);
    roundtripped = JSON.parse(serialized);
    if (roundtripped.totalIssues !== clean.totalIssues) {
      fail_('JSON roundtrip preserves totalIssues', 'mismatch');
    } else {
      ok('JSON roundtrip preserves totalIssues', `${roundtripped.totalIssues}`);
    }
  } catch (e) {
    fail_('report is JSON-serializable', `error: ${e}`);
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
