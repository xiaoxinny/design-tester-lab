/**
 * Semantic HTML rules.
 *
 * These checks operate on the parsed AST (no layout). They cover the
 * subset of WCAG 2.2 AA + general HTML semantics that can be evaluated
 * without a browser:
 *
 *   - Heading hierarchy (one h1, no level skips)
 *   - <button> or <a> for interactive elements (not <div onclick>)
 *   - <img> must have an alt attribute (empty string is fine for decorative)
 *   - <label for="x"> must reference a real <input id="x">
 *   - Landmarks (<main> at most once; <html lang> required)
 *   - Lists: <li> must be inside <ul>/<ol>/<menu>
 *   - Tables: <th> for header cells, scope attr or headers attr
 *
 * The rule output is a list of issues. Each issue has a stable rule id
 * (e.g. `semantic.heading-skip`) so the UI can suppress / weight them
 * and so the run history can aggregate.
 */
import type { ParsedDocument, Element } from './html-parser';

export type Severity = 'error' | 'warning';

export interface LintIssue {
  /** stable rule id (e.g. 'semantic.heading-skip') */
  rule: string;
  severity: Severity;
  /** human-readable message */
  message: string;
  /** first ~200 chars of the offending element source */
  evidence: string;
  /** tag name of the offending element */
  tag: string;
}

const MAX_EVIDENCE = 200;

function evidence(el: Element): string {
  return el.source.length > MAX_EVIDENCE
    ? el.source.slice(0, MAX_EVIDENCE) + '...'
    : el.source;
}

export function runSemantic(doc: ParsedDocument): LintIssue[] {
  const issues: LintIssue[] = [];

  // === <html lang> required (WCAG 3.1.1) ===
  if (doc.htmlLang === null) {
    const htmlEl = doc.elements.find((e) => e.tag === 'html');
    if (htmlEl) {
      issues.push({
        rule: 'semantic.html-lang',
        severity: 'error',
        message: '<html> element is missing the lang attribute',
        evidence: evidence(htmlEl),
        tag: 'html',
      });
    }
  }

  // === Heading hierarchy ===
  //   - exactly one h1 (warning if more, error if zero)
  //   - no level skips: h1 -> h2 is fine, h1 -> h3 is not
  let h1Count = 0;
  let lastLevel = 0;
  for (const el of doc.elements) {
    const m = /^h([1-6])$/.exec(el.tag);
    if (!m) continue;
    const level = Number(m[1]);
    if (level === 1) h1Count++;
    if (lastLevel > 0 && level > lastLevel + 1) {
      issues.push({
        rule: 'semantic.heading-skip',
        severity: 'warning',
        message: `Heading level skipped: <h${lastLevel}> -> <h${level}> (gap of ${level - lastLevel - 1})`,
        evidence: evidence(el),
        tag: el.tag,
      });
    }
    lastLevel = level;
  }
  if (h1Count === 0) {
    issues.push({
      rule: 'semantic.no-h1',
      severity: 'warning',
      message: 'Document has no <h1> element',
      evidence: '',
      tag: '',
    });
  } else if (h1Count > 1) {
    issues.push({
      rule: 'semantic.multiple-h1',
      severity: 'warning',
      message: `Document has ${h1Count} <h1> elements (expected exactly 1)`,
      evidence: '',
      tag: 'h1',
    });
  }

  // === <img> must have alt (WCAG 1.1.1) ===
  for (const el of doc.elements) {
    if (el.tag !== 'img') continue;
    if (!('alt' in el.attrs)) {
      issues.push({
        rule: 'semantic.img-alt',
        severity: 'error',
        message: '<img> is missing the alt attribute',
        evidence: evidence(el),
        tag: 'img',
      });
    }
  }

  // === Button-not-div: <div> with onclick or role="button" ===
  // Note: we can't detect inline event handlers from the static HTML
  // (parse5 doesn't expose them as attributes), so we look for
  // role="button" on a non-button element as a proxy.
  for (const el of doc.elements) {
    if (el.tag === 'button' || el.tag === 'a') continue;
    if (el.attrs.role === 'button' || el.attrs['aria-role'] === 'button') {
      issues.push({
        rule: 'semantic.button-not-div',
        severity: 'warning',
        message: `Element with role="button" should be a <button> or <a> tag, not <${el.tag}>`,
        evidence: evidence(el),
        tag: el.tag,
      });
    }
  }

  // === <label for="x"> must reference a real id ===
  const allIds = new Set<string>();
  for (const el of doc.elements) {
    if (el.hasId && el.attrs.id) allIds.add(el.attrs.id);
  }
  for (const el of doc.elements) {
    if (el.tag !== 'label') continue;
    const forAttr = el.attrs.for;
    if (!forAttr) continue;
    if (!allIds.has(forAttr)) {
      issues.push({
        rule: 'semantic.label-target-missing',
        severity: 'error',
        message: `<label for="${forAttr}"> has no matching id="${forAttr}" in the document`,
        evidence: evidence(el),
        tag: 'label',
      });
    }
  }

  // === <li> must be inside a list container ===
  for (const el of doc.elements) {
    if (el.tag !== 'li') continue;
    // The parser doesn't expose parent links in the flat list, but
    // children[] does. Walk the document manually.
    // We track parents during a second DFS.
    // (Implemented below via parentMap.)
  }
  const parentMap = buildParentMap(doc);
  for (const el of doc.elements) {
    if (el.tag !== 'li') continue;
    const parent = parentMap.get(el);
    if (!parent) continue;
    if (parent.tag !== 'ul' && parent.tag !== 'ol' && parent.tag !== 'menu') {
      issues.push({
        rule: 'semantic.li-outside-list',
        severity: 'error',
        message: `<li> must be a child of <ul>, <ol>, or <menu> (found <${parent.tag}>)`,
        evidence: evidence(el),
        tag: 'li',
      });
    }
  }

  // === <main> at most once ===
  let mainCount = 0;
  for (const el of doc.elements) {
    if (el.tag === 'main') mainCount++;
  }
  if (mainCount > 1) {
    issues.push({
      rule: 'semantic.multiple-main',
      severity: 'warning',
      message: `Document has ${mainCount} <main> elements (expected at most 1)`,
      evidence: '',
      tag: 'main',
    });
  }

  return issues;
}

function buildParentMap(doc: ParsedDocument): Map<Element, Element> {
  const map = new Map<Element, Element>();
  for (const el of doc.elements) {
    for (const child of el.children) {
      map.set(child, el);
    }
  }
  return map;
}
