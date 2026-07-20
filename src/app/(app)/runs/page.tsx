'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

interface Run {
  id: string;
  prompt_body: string;
  model_id: string;
  augmentationStack: Array<{ id: string; version: string }>;
  generated_html: string | null;
  lintReport: { totalIssues: number; bySeverity: { error: number; warning: number } } | null;
  user_rating: number | null;
  user_notes: string | null;
  duration_ms: number | null;
  generated_tokens_used: number | null;
  isPublic: boolean;
  share_slug: string | null;
  created_at: number;
}

interface RunsResponse {
  runs: Run[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE_SIZE = 20;

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/runs?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const data = (await response.json()) as RunsResponse;
      setRuns(Array.isArray(data.runs) ? data.runs : []);
      setTotal(data.total);
      setLimit(data.limit);
    } catch (cause) {
      setRuns([]);
      setError(cause instanceof Error ? cause.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  useGSAP(
    () => {
      if (loading || !listRef.current) return;
      gsap.from(listRef.current.querySelectorAll('[data-run-card]'), {
        opacity: 0,
        y: 8,
        duration: 0.3,
        stagger: 0.05,
        ease: 'power2.out',
      });
    },
    { scope: listRef, dependencies: [runs, loading], revertOnUpdate: true },
  );

  return (
    <div className="space-y-6">
      <h1 className="font-mono text-xl font-semibold">Runs</h1>

      {loading ? (
        <Card><p className="text-sm text-text-muted">Loading runs…</p></Card>
      ) : error ? (
        <Card className="border-danger/40">
          <p className="text-sm text-danger">Unable to load runs: {error}</p>
        </Card>
      ) : runs.length === 0 ? (
        <Card className="p-10 text-center">
          <h2 className="font-medium text-text-primary">No runs yet</h2>
          <p className="mt-2 text-sm text-text-muted">Generated runs will appear here.</p>
        </Card>
      ) : (
        <div ref={listRef} className="space-y-3">
          {runs.map((run) => (
            <Link key={run.id} href={`/runs/${run.id}`} className="block cursor-pointer">
              <Card
                data-run-card
                className="flex flex-col gap-4 transition-colors hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <span className="inline-flex rounded-full bg-accent-muted px-2 py-0.5 font-mono text-xs text-accent">
                    {run.model_id}
                  </span>
                  <p className="truncate text-sm text-text-primary">
                    {run.prompt_body.slice(0, 80)}{run.prompt_body.length > 80 ? '…' : ''}
                  </p>
                  <p className="text-xs text-text-muted">
                    {new Date(run.created_at).toLocaleDateString()} · {run.augmentationStack.length} augmentations
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-text-muted sm:justify-end">
                  <span>{formatDuration(run.duration_ms)}</span>
                  <span>{run.generated_tokens_used?.toLocaleString() ?? '—'} tokens</span>
                  {run.lintReport && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 font-medium',
                        run.lintReport.totalIssues === 0
                          ? 'bg-success/10 text-success'
                          : run.lintReport.bySeverity.error > 0
                            ? 'bg-danger-muted text-danger'
                            : 'bg-warning-muted text-warning',
                      )}
                    >
                      {run.lintReport.totalIssues} issues
                    </span>
                  )}
                  <span aria-label={run.user_rating ? `${run.user_rating} of 5 stars` : 'Not rated'}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <span
                        key={index}
                        aria-hidden="true"
                        className={cn(index < (run.user_rating ?? 0) ? 'text-warning' : 'text-border')}
                      >
                        ★
                      </span>
                    ))}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && total > 0 && (
        <nav className="flex items-center justify-between" aria-label="Run history pagination">
          <Button
            variant="secondary"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset((current) => Math.max(0, current - limit))}
          >
            Previous
          </Button>
          <span className="text-xs text-text-muted">
            {offset + 1}–{Math.min(offset + runs.length, total)} of {total}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset + limit >= total}
            onClick={() => setOffset((current) => current + limit)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
