'use client';

import { cn } from '@/lib/cn';

type Severity = 'error' | 'warning';

interface LintIssue {
  rule: string;
  severity: Severity;
  message: string;
  evidence: string;
  tag: string;
}

interface LintReport {
  totalIssues: number;
  bySeverity: { error: number; warning: number };
  byRule: Record<string, number>;
  issues: LintIssue[];
  ranAt: number;
  inputBytes: number;
}

interface ReportViewerProps {
  report: LintReport | null;
  className?: string;
}

const badgeClass = 'rounded-full px-2 py-1 text-xs font-medium';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ReportViewer({ report, className }: ReportViewerProps) {
  if (!report) return null;

  if (report.totalIssues === 0) {
    return (
      <section className={cn('rounded-lg border border-border bg-surface p-4', className)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={cn(badgeClass, 'bg-accent-muted text-accent')}>All checks pass</span>
          <span className="text-sm text-text-muted">Input size: {formatBytes(report.inputBytes)}</span>
        </div>
      </section>
    );
  }

  const issuesByRule = report.issues.reduce<Record<string, LintIssue[]>>((groups, issue) => {
    (groups[issue.rule] ??= []).push(issue);
    return groups;
  }, {});

  return (
    <section className={cn('rounded-lg border border-border bg-surface p-4', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <h2 className="text-lg font-semibold text-text-primary">
          {report.totalIssues} {report.totalIssues === 1 ? 'issue' : 'issues'} found
        </h2>
        <div className="flex items-center gap-2">
          {report.bySeverity.error > 0 && (
            <span className={cn(badgeClass, 'bg-danger-muted text-danger')}>
              {report.bySeverity.error} {report.bySeverity.error === 1 ? 'error' : 'errors'}
            </span>
          )}
          {report.bySeverity.warning > 0 && (
            <span className={cn(badgeClass, 'bg-warning-muted text-warning')}>
              {report.bySeverity.warning} {report.bySeverity.warning === 1 ? 'warning' : 'warnings'}
            </span>
          )}
        </div>
      </header>

      <div className="mt-4 space-y-3">
        {Object.entries(report.byRule).map(([rule, count]) => {
          const issues = issuesByRule[rule] ?? [];
          return (
            <details key={rule} className="rounded-md border border-border-subtle bg-surface-raised" open>
              <summary className="cursor-pointer px-3 py-2 text-text-primary">
                <span className="font-mono text-sm font-medium">{rule}</span>
                <span className="ml-2 text-xs text-text-muted">{count}</span>
              </summary>
              <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                {issues.map((issue, index) => (
                  <li key={`${issue.rule}-${index}`} className="min-w-0 space-y-2 px-3 py-3">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className={cn(
                          badgeClass,
                          'shrink-0',
                          issue.severity === 'error'
                            ? 'bg-danger-muted text-danger'
                            : 'bg-warning-muted text-warning'
                        )}
                      >
                        {issue.severity}
                      </span>
                      <p className="min-w-0 text-sm text-text-primary">{issue.message}</p>
                    </div>
                    <p className="truncate font-mono text-xs text-text-muted" title={issue.evidence}>
                      {issue.evidence}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
