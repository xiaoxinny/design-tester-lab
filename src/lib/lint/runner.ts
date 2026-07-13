/**
 * Lint runner.
 *
 * Orchestrates the rule modules: parses the HTML, runs each rule set,
 * aggregates the issues, and returns a unified report.
 *
 * The report shape is what gets stored in `runs.lint_report` (TEXT column,
 * JSON-encoded). The shape is intentionally stable so the UI can consume
 * it without parsing each rule's idiosyncrasies.
 */
import { parseHtml, type ParsedDocument } from './html-parser';
import { runSemantic, type LintIssue } from './semantic';
import { runContrast } from './contrast';
import { runSpacing } from './spacing';

export interface LintReport {
  /** total issue count across all rules */
  totalIssues: number;
  /** count by severity */
  bySeverity: { error: number; warning: number };
  /** count by rule id */
  byRule: Record<string, number>;
  /** the full list of issues */
  issues: LintIssue[];
  /** when the lint was run (ms epoch) */
  ranAt: number;
  /** the input HTML byte length (for context in the UI) */
  inputBytes: number;
}

export interface LintOptions {
  /** which rule sets to run. default: all */
  include?: Array<'semantic' | 'contrast' | 'spacing'>;
}

/**
 * Run the lint engine on the given HTML and return a structured report.
 *
 * Always returns a report, even if the input is unparseable -- in that
 * case the html-parser may produce a partial AST, and the rules run on
 * what they can find. The function never throws.
 */
export function runLint(html: string, options: LintOptions = {}): LintReport {
  const include = options.include ?? ['semantic', 'contrast', 'spacing'];
  const doc = parseHtml(html);
  const issues: LintIssue[] = [];

  if (include.includes('semantic')) {
    issues.push(...runSemantic(doc));
  }
  if (include.includes('contrast')) {
    issues.push(...runContrast(doc));
  }
  if (include.includes('spacing')) {
    issues.push(...runSpacing(doc));
  }

  const bySeverity = { error: 0, warning: 0 };
  const byRule: Record<string, number> = {};
  for (const issue of issues) {
    bySeverity[issue.severity]++;
    byRule[issue.rule] = (byRule[issue.rule] ?? 0) + 1;
  }

  return {
    totalIssues: issues.length,
    bySeverity,
    byRule,
    issues,
    ranAt: Date.now(),
    inputBytes: html.length,
  };
}

/**
 * Convenience: returns just a yes/no pass.
 *
 * Pass = no error-severity issues. Warnings do not fail. Used by the
 * playground UI to render a green/red badge.
 */
export function isLintPass(report: LintReport): boolean {
  return report.bySeverity.error === 0;
}
