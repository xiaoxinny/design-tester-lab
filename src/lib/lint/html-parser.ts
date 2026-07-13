/**
 * HTML parsing for the lint engine.
 *
 * Wraps parse5 to:
 *   - Parse the raw generated HTML into an AST.
 *   - Flatten the AST into a list of elements (depth-first).
 *   - Extract inline `style="..."` attributes and `<style>` blocks for the
 *     tokens and spacing rules.
 *
 * The parser is intentionally lightweight. There is no layout engine, no
 * computed-style resolution, and no JS execution. The lint rules operate on
 * what is *in the source* (inline styles, element types, attributes) — not on
 * what a browser would render. This is a deliberate trade-off: less
 * fidelity, much simpler test surface, no jsdom/happy-dom dependency.
 */
import { parse, type DefaultTreeAdapterTypes } from 'parse5';

type P5Document = DefaultTreeAdapterTypes.Document;
type P5Element = DefaultTreeAdapterTypes.Element;
type P5ChildNode = DefaultTreeAdapterTypes.ChildNode;
type P5TextNode = DefaultTreeAdapterTypes.TextNode;
type P5CommentNode = DefaultTreeAdapterTypes.CommentNode;

export interface Element {
  /** tag name lowercased (e.g. 'div', 'button', 'h1') */
  tag: string;
  /** all attributes as a map */
  attrs: Record<string, string>;
  /** the source HTML of the element (serialized from the AST) */
  source: string;
  /** the inline `style="..."` value, if any */
  inlineStyle: string | null;
  /** the depth in the document tree (0 for body children, 1 for nested, etc.) */
  depth: number;
  /** true if the element has an `id` attribute */
  hasId: boolean;
  /** text content (concatenation of all descendant text nodes) */
  textContent: string;
  /** children (same Element type) */
  children: Element[];
}

export interface ParsedDocument {
  /** raw html input (untouched) */
  raw: string;
  /** flattened list of all elements, depth-first */
  elements: Element[];
  /** all `<style>` block contents */
  styleBlocks: string[];
  /** the document title (from <title> or null) */
  title: string | null;
  /** the document's <html> lang attribute (or null) */
  htmlLang: string | null;
  /** the document's <meta name="viewport" content="..."> value (or null) */
  viewport: string | null;
  /** the document's <meta name="description" content="..."> value (or null) */
  description: string | null;
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'source', 'track', 'wbr',
]);

/**
 * Parse an HTML string into a structured document.
 *
 * Throws nothing — invalid HTML is parsed as-is and produces a partial AST.
 */
export function parseHtml(rawHtml: string): ParsedDocument {
  const raw = rawHtml;
  // parse5 returns a Document; childNodes is the list of top-level children.
  const ast = parse(raw, { sourceCodeLocationInfo: false });

  const elements: Element[] = [];
  const styleBlocks: string[] = [];
  let title: string | null = null;
  let htmlLang: string | null = null;
  let viewport: string | null = null;
  let description: string | null = null;
  // Walk the AST. Root is the document; we recurse into the <html> child.
  // Title and meta are inside <head>, which is at depth 1+, so the per-node
  // callback runs on every element (not just depth 0).
  for (const top of ast.childNodes) {
    if (!('tagName' in top)) continue;
    const topEl = top as P5Element;
    if (topEl.tagName === 'html') {
      htmlLang = getAttr(topEl, 'lang');
    }
    walk(topEl, 0, elements, styleBlocks, (node) => {
      if (node.tagName === 'title') {
        title = collectText(node);
      } else if (node.tagName === 'meta') {
        const name = getAttr(node, 'name');
        const content = getAttr(node, 'content');
        if (name === 'viewport' && content !== null) viewport = content;
        if (name === 'description' && content !== null) description = content;
      }
    });
  }

  return {
    raw,
    elements,
    styleBlocks,
    title,
    htmlLang,
    viewport,
    description,
  };
}

function walk(
  node: P5Element,
  depth: number,
  out: Element[],
  styleBlocks: string[],
  metaCallback: (node: P5Element) => void,
): void {
  if (node.tagName === 'style') {
    const text = collectText(node);
    if (text.trim().length > 0) styleBlocks.push(text);
    return;
  }

  const attrs: Record<string, string> = {};
  for (const a of node.attrs) attrs[a.name] = a.value;
  const inlineStyle = attrs.style ?? null;
  const textContent = collectText(node);

  // The starting index in `out` marks where this element's children begin.
  // After recursion, anything appended is a descendant.
  const startIdx = out.length;
  out.push({
    tag: node.tagName,
    attrs,
    source: serializeNode(node),
    inlineStyle,
    depth,
    hasId: Object.prototype.hasOwnProperty.call(attrs, 'id'),
    textContent,
    children: [],
  });

  for (const child of node.childNodes) {
    if (!('tagName' in child)) continue;
    const childEl = child as P5Element;
    if (childEl.tagName === 'style') {
      const text = collectText(childEl);
      if (text.trim().length > 0) styleBlocks.push(text);
      continue;
    }
    walk(childEl, depth + 1, out, styleBlocks, metaCallback);
  }

  // Populate the children list for this element.
  out[startIdx]!.children = out.slice(startIdx + 1);

  metaCallback(node);
}

function isText(node: P5ChildNode): node is P5TextNode {
  return node.nodeName === '#text';
}

function isComment(node: P5ChildNode): node is P5CommentNode {
  return node.nodeName === '#comment';
}

function getAttr(node: P5Element, name: string): string | null {
  for (const a of node.attrs) {
    if (a.name === name) return a.value;
  }
  return null;
}

function collectText(node: P5Element): string {
  let out = '';
  for (const c of node.childNodes) {
    if (isText(c)) {
      out += c.value;
    } else if (!isComment(c)) {
      out += collectText(c as P5Element);
    }
  }
  return out;
}

function serializeNode(node: P5Element): string {
  // We want the source HTML for evidence. parse5's `serialize` operates on
  // a full document; for a sub-element it doesn't render the wrapping tag
  // by default. Hand-build a minimal string from the attrs and tag.
  let out = `<${node.tagName}`;
  for (const a of node.attrs) {
    // Quote value with double quotes, escape any inner " or &.
    out += ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
  }
  out += '>';
  // Text content (best-effort; truncated for very long).
  const text = collectText(node);
  if (text.length > 0) {
    out += text.length > 80 ? text.slice(0, 80) + '...' : text;
  }
  if (!isVoidElement(node.tagName)) {
    out += `</${node.tagName}>`;
  }
  return out;
}

function isVoidElement(tag: string): boolean {
  return tag === 'area' || tag === 'base' || tag === 'br' || tag === 'col' ||
    tag === 'embed' || tag === 'hr' || tag === 'img' || tag === 'input' ||
    tag === 'link' || tag === 'meta' || tag === 'source' || tag === 'track' ||
    tag === 'wbr';
}

export { VOID_ELEMENTS };
