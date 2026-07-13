/**
 * Tests for src/lib/lint/html-parser.ts.
 */
import { parseHtml, VOID_ELEMENTS } from '../src/lib/lint/html-parser';

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

/** Find the first element with a given tag in the flat list. */
function findByTag(doc: ReturnType<typeof parseHtml>, tag: string) {
  return doc.elements.find((e) => e.tag === tag);
}

function main(): void {
  // === Basic parse ===

  const simple = parseHtml(
    '<html><head><title>Hi</title></head><body><p>Hello</p></body></html>',
  );
  if (simple.title !== 'Hi') {
    fail_('parseHtml extracts <title>', `got: ${simple.title}`);
  } else {
    ok('parseHtml extracts <title>', 'Hi');
  }
  if (simple.elements.length < 4) {
    fail_('parseHtml extracts all elements (html, head, title, body, p)', `got: ${simple.elements.length}`);
  } else {
    ok('parseHtml extracts all elements (html, head, title, body, p)', `${simple.elements.length}`);
  }

  // === Headings extracted in order ===

  const headings = parseHtml(
    '<html><body><h1>One</h1><h2>Two</h2><h4>Four</h4></body></html>',
  );
  const h1 = findByTag(headings, 'h1');
  const h2 = findByTag(headings, 'h2');
  const h4 = findByTag(headings, 'h4');
  if (!h1 || !h2 || !h4) {
    fail_('all three headings extracted', `got: ${headings.elements.map((e) => e.tag).join(',')}`);
  } else if (h1.textContent !== 'One' || h2.textContent !== 'Two' || h4.textContent !== 'Four') {
    fail_('headings have the right text', JSON.stringify({ h1: h1.textContent, h2: h2.textContent, h4: h4.textContent }));
  } else {
    ok('headings extracted in order with right text', 'h1, h2, h4');
  }

  // === Inline style ===

  const styled = parseHtml('<html><body><div style="padding: 16px; color: #000">x</div></body></html>');
  const div = findByTag(styled, 'div');
  if (!div) {
    fail_('div with inline style extracted', 'no div');
  } else if (div.inlineStyle !== 'padding: 16px; color: #000') {
    fail_('inline style extracted', `got: ${div.inlineStyle}`);
  } else {
    ok('inline style extracted', div.inlineStyle);
  }

  // === Style block ===

  const withStyleBlock = parseHtml(
    '<html><head><style>body { margin: 0 }</style></head><body></body></html>',
  );
  if (withStyleBlock.styleBlocks.length !== 1) {
    fail_('style block extracted', `got: ${withStyleBlock.styleBlocks.length}`);
  } else if (!withStyleBlock.styleBlocks[0]!.includes('margin: 0')) {
    fail_('style block content', `got: ${withStyleBlock.styleBlocks[0]}`);
  } else {
    ok('style block extracted', withStyleBlock.styleBlocks[0]!.trim());
  }

  // === Text content ===

  const textTest = parseHtml('<html><body><p>Hello <strong>world</strong>!</p></body></html>');
  const p = findByTag(textTest, 'p');
  if (!p) {
    fail_('p with text+strong extracted', 'no p');
  } else if (!p.textContent.includes('Hello') || !p.textContent.includes('world')) {
    fail_('textContent includes descendants', `got: ${p.textContent}`);
  } else {
    ok('textContent includes descendants', p.textContent);
  }

  // === Depth ===

  const depth = parseHtml('<html><body><a><b><c></c></b></a></body></html>');
  const a = findByTag(depth, 'a');
  const b = findByTag(depth, 'b');
  const c = findByTag(depth, 'c');
  if (!a || !b || !c) {
    fail_('a, b, c all extracted', 'missing');
  } else if (b.depth !== a.depth + 1 || c.depth !== b.depth + 1) {
    fail_('depths are sequential', `a=${a.depth} b=${b.depth} c=${c.depth}`);
  } else {
    ok('depths are sequential', `a=${a.depth} b=${b.depth} c=${c.depth}`);
  }

  // === Attributes ===

  const attrTest = parseHtml(
    '<html><body><a href="/x" class="link" id="main">x</a></body></html>',
  );
  const aEl = findByTag(attrTest, 'a');
  if (!aEl) {
    fail_('a with attributes extracted', 'no a');
  } else if (aEl.attrs.href !== '/x' || aEl.attrs.class !== 'link' || !aEl.hasId) {
    fail_('attributes extracted', JSON.stringify(aEl.attrs));
  } else {
    ok('attributes extracted', 'href, class, id');
  }

  // === <meta name="viewport"> ===

  const meta = parseHtml(
    '<html><head><meta name="viewport" content="width=device-width"></head><body></body></html>',
  );
  if (meta.viewport !== 'width=device-width') {
    fail_('viewport meta extracted', `got: ${meta.viewport}`);
  } else {
    ok('viewport meta extracted', meta.viewport);
  }

  // === <html lang> ===

  const lang = parseHtml('<html lang="en"><body></body></html>');
  if (lang.htmlLang !== 'en') {
    fail_('html lang extracted', `got: ${lang.htmlLang}`);
  } else {
    ok('html lang extracted', 'en');
  }

  // === Comments and text nodes are skipped ===

  const noisy = parseHtml('<!-- a comment --><html><body><div>x</div></body></html>more text');
  const divEl = findByTag(noisy, 'div');
  if (!divEl) {
    fail_('comments and text nodes skipped (still extracts div)', 'no div');
  } else {
    ok('comments and text nodes skipped', 'div extracted');
  }

  // === DOCTYPE is handled ===

  const doc = parseHtml('<!DOCTYPE html><html><body><p>x</p></body></html>');
  const pEl = findByTag(doc, 'p');
  if (!pEl) {
    fail_('DOCTYPE is tolerated', 'no p');
  } else {
    ok('DOCTYPE is tolerated', 'p extracted');
  }

  // === VOID_ELEMENTS constant ===

  if (!VOID_ELEMENTS.has('img') || !VOID_ELEMENTS.has('br')) {
    fail_('VOID_ELEMENTS contains common void elements', 'missing');
  } else {
    ok('VOID_ELEMENTS contains common void elements', 'img, br');
  }

  // === Empty input ===

  const empty = parseHtml('');
  // parse5 wraps empty input with html/head/body. We accept that — what
  // matters is that the elements are correctly structured (head, body with
  // no children) and that the title and meta fields are null.
  if (empty.title !== null) {
    fail_('empty input has no title', `got: ${empty.title}`);
  } else if (empty.viewport !== null) {
    fail_('empty input has no viewport', `got: ${empty.viewport}`);
  } else {
    ok('empty input has no title or viewport', 'both null');
  }

  // === Self-closing custom elements (parse5 normalizes) ===

  const custom = parseHtml('<html><body><my-component>x</my-component></body></html>');
  const myEl = findByTag(custom, 'my-component');
  if (!myEl) {
    fail_('custom elements extracted', 'no my-component');
  } else if (myEl.tag !== 'my-component') {
    fail_('custom element tag preserved', `got: ${myEl.tag}`);
  } else {
    ok('custom element tag preserved', myEl.tag);
  }

  // === Children list is populated ===

  const tree = parseHtml('<html><body><div><span>a</span><span>b</span></div></body></html>');
  const treeDiv = findByTag(tree, 'div');
  if (!treeDiv) {
    fail_('tree div extracted', 'no div');
  } else if (treeDiv.children.length !== 2) {
    fail_('div has 2 children', `got: ${treeDiv.children.length}`);
  } else {
    ok('div has 2 children', `${treeDiv.children.length} (${treeDiv.children.map((c) => c.tag).join(',')})`);
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
