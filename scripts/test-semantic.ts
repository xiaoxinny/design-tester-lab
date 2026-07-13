/**
 * Tests for src/lib/lint/semantic.ts.
 */
import { parseHtml } from '../src/lib/lint/html-parser';
import { runSemantic } from '../src/lib/lint/semantic';

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

function runRules(html: string) {
  return runSemantic(parseHtml(html));
}

function expectNoIssue(label: string, html: string, rule: string): void {
  const issues = runRules(html);
  if (issues.find((i) => i.rule === rule)) {
    fail_(label, `expected no ${rule} but got: ${issues.find((i) => i.rule === rule)!.message}`);
  } else {
    ok(label, 'no ' + rule);
  }
}

function expectIssue(label: string, html: string, rule: string): void {
  const issues = runRules(html);
  const found = issues.find((i) => i.rule === rule);
  if (!found) {
    fail_(label, `expected ${rule} but got: ${issues.map((i) => i.rule).join(',') || '(none)'}`);
  } else {
    ok(label, found.message);
  }
}

function main(): void {
  // === <html lang> required ===

  expectIssue('html without lang flags semantic.html-lang', '<html><body></body></html>', 'semantic.html-lang');
  expectNoIssue('html with lang does not flag', '<html lang="en"><body></body></html>', 'semantic.html-lang');

  // === Heading hierarchy ===

  expectIssue('h1 -> h3 skip flags semantic.heading-skip', '<html><body><h1>a</h1><h3>skip</h3></body></html>', 'semantic.heading-skip');
  expectNoIssue('h1 -> h2 is fine', '<html><body><h1>a</h1><h2>b</h2></body></html>', 'semantic.heading-skip');
  expectIssue('h2 -> h4 skip flags', '<html><body><h2>a</h2><h4>skip</h4></body></html>', 'semantic.heading-skip');

  expectIssue('no h1 flags semantic.no-h1', '<html><body><h2>a</h2></body></html>', 'semantic.no-h1');
  expectNoIssue('one h1 does not flag no-h1', '<html><body><h1>a</h1></body></html>', 'semantic.no-h1');

  expectIssue('multiple h1 flags', '<html><body><h1>a</h1><h1>b</h1></body></html>', 'semantic.multiple-h1');
  expectNoIssue('single h1 does not flag', '<html><body><h1>a</h1></body></html>', 'semantic.multiple-h1');

  // === <img alt> ===

  expectIssue('img without alt flags', '<html><body><img src="x.png"></body></html>', 'semantic.img-alt');
  expectNoIssue('img with alt="" (decorative) does not flag', '<html><body><img src="x.png" alt=""></body></html>', 'semantic.img-alt');
  expectNoIssue('img with alt="text" does not flag', '<html><body><img src="x.png" alt="A picture"></body></html>', 'semantic.img-alt');

  // === role="button" on non-button ===

  expectIssue('div with role=button flags', '<html><body><div role="button">x</div></body></html>', 'semantic.button-not-div');
  expectNoIssue('button tag does not flag', '<html><body><button>x</button></body></html>', 'semantic.button-not-div');
  expectNoIssue('a tag with role=button does not flag', '<html><body><a role="button" href="#">x</a></body></html>', 'semantic.button-not-div');

  // === <label for> ===

  expectIssue('label for missing id flags', '<html><body><label for="missing">x</label></body></html>', 'semantic.label-target-missing');
  expectNoIssue('label for matching id does not flag', '<html><body><label for="x">x</label><input id="x"></body></html>', 'semantic.label-target-missing');

  // === <li> outside list ===

  expectIssue('li outside list flags', '<html><body><div><li>oops</li></div></body></html>', 'semantic.li-outside-list');
  expectNoIssue('li in ul does not flag', '<html><body><ul><li>ok</li></ul></body></html>', 'semantic.li-outside-list');
  expectNoIssue('li in ol does not flag', '<html><body><ol><li>ok</li></ol></body></html>', 'semantic.li-outside-list');

  // === multiple <main> ===

  expectIssue('two mains flag', '<html><body><main>a</main><main>b</main></body></html>', 'semantic.multiple-main');
  expectNoIssue('one main does not flag', '<html><body><main>a</main></body></html>', 'semantic.multiple-main');

  // === Severity levels are correct ===

  const htmlLangIssues = runRules('<html><body></body></html>');
  const htmlLangIssue = htmlLangIssues.find((i) => i.rule === 'semantic.html-lang');
  if (htmlLangIssue?.severity !== 'error') {
    fail_('semantic.html-lang is severity=error', `got: ${htmlLangIssue?.severity}`);
  } else {
    ok('semantic.html-lang is severity=error', 'error');
  }

  const headingSkipIssues = runRules('<html><body><h1>a</h1><h3>skip</h3></body></html>');
  const headingSkipIssue = headingSkipIssues.find((i) => i.rule === 'semantic.heading-skip');
  if (headingSkipIssue?.severity !== 'warning') {
    fail_('semantic.heading-skip is severity=warning', `got: ${headingSkipIssue?.severity}`);
  } else {
    ok('semantic.heading-skip is severity=warning', 'warning');
  }

  // === Rule ids are stable ===

  const allRules = new Set<string>();
  for (const html of [
    '<html><body></body></html>',
    '<html><body><img src="x"></body></html>',
    '<html><body><h1></h1><h3></h3></body></html>',
    '<html><body><h1></h1><h1></h1></body></html>',
    '<html><body><div role="button">x</div></body></html>',
  ]) {
    for (const issue of runRules(html)) allRules.add(issue.rule);
  }
  if (allRules.size < 5) {
    fail_('multiple rules fire across test inputs', `got: ${[...allRules].join(',')}`);
  } else {
    ok('multiple rules fire across test inputs', `${allRules.size} unique rules`);
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
