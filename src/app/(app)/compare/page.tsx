'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/cn';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from '@/lib/use-toast';

interface Run {
  id: string;
  prompt_body: string;
  model_id: string;
  generated_html: string | null;
  lintReport: { totalIssues: number; bySeverity: { error: number; warning: number } } | null;
  user_rating: number | null;
  created_at: number;
}

type Winner = 'a' | 'tie' | 'b';
const WINNERS: Winner[] = ['a', 'tie', 'b'];
const WINNER_LABEL: Record<Winner, string> = { a: 'A wins', tie: 'Tie', b: 'B wins' };
const FIELD = 'block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

function runLabel(run: Run): string {
  const r = run.user_rating ? `★${run.user_rating}` : 'unrated';
  const d = new Date(run.created_at).toISOString().slice(0, 16).replace('T', ' ');
  return `${run.model_id} · ${r} · ${d}`;
}

function Lint({ run }: { run: Run }) {
  if (!run.lintReport) return <p className="text-sm text-text-secondary">No lint report</p>;
  const { totalIssues: t, bySeverity: s } = run.lintReport;
  return (
    <ul className="text-sm text-text-secondary space-y-0.5">
      <li>Issues: <span className="text-text-primary">{t}</span></li>
      <li>Errors: <span className="text-danger">{s.error}</span></li>
      <li>Warnings: <span className="text-warning">{s.warning}</span></li>
    </ul>
  );
}

function RunPanel({ title, run }: { title: string; run: Run }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-1">
        <h3 className="font-medium text-text-primary">{title}</h3>
        <p className="text-xs text-text-secondary font-mono break-all">{run.id}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-border overflow-hidden bg-white">
          {run.generated_html ? (
            <iframe title={`${title} preview`} srcDoc={run.generated_html} sandbox="allow-same-origin" className="w-full h-72 border-0" />
          ) : (
            <div className="h-72 flex items-center justify-center text-sm text-text-secondary">No preview available</div>
          )}
        </div>
        <Lint run={run} />
        <details className="text-sm">
          <summary className="cursor-pointer text-text-secondary">Prompt</summary>
          <p className="mt-1 text-text-secondary whitespace-pre-wrap line-clamp-4">{run.prompt_body}</p>
        </details>
      </CardContent>
    </Card>
  );
}

function SelectOne({ label, value, onChange, runs, disabled }: { label: string; value: string; onChange: (v: string) => void; runs: Run[]; disabled: boolean }) {
  return (
    <label className="space-y-1">
      <span className="text-sm text-text-secondary">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={FIELD}>
        <option value="">{disabled ? 'Loading…' : 'Select a run'}</option>
        {runs.map((run) => <option key={run.id} value={run.id}>{runLabel(run)}</option>)}
      </select>
    </label>
  );
}

export default function ComparePage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [winner, setWinner] = useState<Winner | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/runs?limit=100');
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { runs: Run[] };
        if (!cancelled) setRuns(Array.isArray(data.runs) ? data.runs : []);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load runs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const runA = useMemo(() => runs.find((r) => r.id === a), [runs, a]);
  const runB = useMemo(() => runs.find((r) => r.id === b), [runs, b]);
  const ready = Boolean(runA && runB && winner);

  const submit = useCallback(async () => {
    if (!ready || !runA || !runB || !winner) return;
    setSaving(true);
    try {
      const res = await fetch('/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runAId: runA.id, runBId: runB.id, winner, notes }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      toast({ variant: 'success', title: 'Comparison saved' });
      setA(''); setB(''); setWinner(null); setNotes('');
    } catch (cause) {
      toast({ variant: 'error', title: 'Failed to save comparison', description: cause instanceof Error ? cause.message : 'Unknown error' });
    } finally {
      setSaving(false);
    }
  }, [notes, ready, runA, runB, winner]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Compare runs</h1>
        <p className="text-sm text-text-secondary">Pick two runs and record which came out ahead.</p>
      </header>

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <SelectOne label="Run A" value={a} onChange={setA} runs={runs} disabled={loading} />
          <SelectOne label="Run B" value={b} onChange={setB} runs={runs} disabled={loading} />
          <div className="space-y-2">
            <span className="text-sm text-text-secondary">Winner</span>
            <div className="flex gap-2">
              {WINNERS.map((w) => (
                <button key={w} type="button" onClick={() => setWinner(w)} aria-pressed={winner === w}
                  className={cn(buttonVariants({ variant: winner === w ? 'primary' : 'secondary', size: 'sm' }), 'flex-1')}>
                  {WINNER_LABEL[w]}
                </button>
              ))}
            </div>
          </div>
          <label className="md:col-span-3 space-y-1">
            <span className="text-sm text-text-secondary">Notes (optional)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${FIELD} resize-y`} placeholder="Why did this one win?" />
          </label>
          {error && <p className="md:col-span-3 text-sm text-danger">{error}</p>}
        </CardContent>
      </Card>

      {runA && runB ? (
        <div className="grid gap-4 md:grid-cols-2">
          <RunPanel title="Run A" run={runA} />
          <RunPanel title="Run B" run={runB} />
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-text-secondary">
            Select both runs to view side-by-side previews.
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!ready || saving}>{saving ? 'Saving…' : 'Save comparison'}</Button>
      </div>
    </div>
  );
}
