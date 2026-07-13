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
 * Always returns a report, even if the input is unparseable or the rules
 * throw on pathological input. Internal errors are converted to a single
 * `lint-internal-error` issue with severity=error, so the generation runner
 * can still save a report row and the user gets a useful diagnostic.
 */
export function runLint(html: string, options: LintOptions = {}): LintReport {
  const baseReport = (issue?: LintIssue): LintReport => {
    const issues = issue ? [issue] : [];
    const byRule: Record<string, number> = {};
    if (issue) byRule[issue.rule] = 1;
    return {
      totalIssues: issues.length,
      bySeverity: { error: issue?.severity === 'error' ? 1 : 0, warning: issue?.severity === 'warning' ? 1 : 0 },
      byRule,
      issues,
      ranAt: Date.now(),
      inputBytes: html.length,
    };
  };
  try {
    return runLintImpl(html, options);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[lint] runLint threw:', e);
    return baseReport({
      rule: 'lint-internal-error',
      severity: 'error',
      message: `Lint engine threw: ${e instanceof Error ? e.message : String(e)}`,
      evidence: html.length > 200 ? html.slice(0, 200) + '...' : html,
      tag: '',
    });
  }
}

function runLintImpl(html: string, options: LintOptions): LintReport {
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
