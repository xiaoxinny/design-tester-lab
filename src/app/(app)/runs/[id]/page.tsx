'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Card } from '@/components/ui/card';
import { toast } from '@/lib/use-toast';
import { ReportViewer } from '@/components/lint/report-viewer';

interface Run {
  id: string;
  prompt_body: string;
  model_id: string;
  augmentationStack: Array<{ id: string; version: string }>;
  generated_html: string | null;
  lintReport: any | null;
  user_rating: number | null;
  user_notes: string | null;
  duration_ms: number | null;
  generated_tokens_used: number | null;
  isPublic: boolean;
  created_at: number;
}

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch(`/api/runs/${params.id}`)
      .then((r) => {
        if (r.status === 401) { window.location.href = '/login'; return null; }
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setRun(data.run);
        setNotes(data.run?.user_notes || '');
      })
      .catch(() => toast({ variant: 'error', title: 'Failed to load run' }))
      .finally(() => setLoading(false));
  }, [params.id]);

  const setRating = useCallback(
    async (rating: number) => {
      if (!run) return;
      try {
        const res = await fetch(`/api/runs/${run.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userRating: rating }),
        });
        if (res.ok) {
          setRun((prev) => (prev ? { ...prev, user_rating: rating } : prev));
          toast({ variant: 'success', title: 'Rating saved' });
        } else {
          toast({ variant: 'error', title: 'Failed to save rating' });
        }
      } catch {
        toast({ variant: 'error', title: 'Failed to save rating' });
      }
    },
    [run],
  );

  const saveNotes = useCallback(async () => {
    if (!run || notes === (run.user_notes || '')) return;
    try {
      const res = await fetch(`/api/runs/${run.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userNotes: notes }),
      });
      if (!res.ok) toast({ variant: 'error', title: 'Failed to save notes' });
    } catch {
      toast({ variant: 'error', title: 'Failed to save notes' });
    }
  }, [run, notes]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-surface-raised" />
        <div className="h-[400px] rounded bg-surface-raised" />
      </div>
    );
  }

  if (!run) {
    return (
      <div>
        <Link href="/runs" className="text-sm text-accent hover:underline">
          ← Back to runs
        </Link>
        <p className="mt-4 text-text-secondary">Run not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/runs" className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary transition-colors">
        <ArrowLeft className="h-3 w-3" /> Back to runs
      </Link>

      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="font-mono text-xl font-semibold">{run.model_id}</h1>
        <span className="text-xs text-text-muted">{new Date(run.created_at).toLocaleString()}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {run.generated_html && (
            <Card className="p-4">
              <h2 className="mb-3 font-mono text-sm font-semibold">Preview</h2>
              <div className="rounded-md border border-border overflow-hidden bg-white">
                <iframe srcDoc={run.generated_html} sandbox="allow-scripts" className="w-full h-[500px] border-0" title="Generated UI preview" />
              </div>
            </Card>
          )}
          <ReportViewer report={run.lintReport} />
          <Card className="p-4">
            <h2 className="mb-2 font-mono text-sm font-semibold">Prompt</h2>
            <pre className="whitespace-pre-wrap text-sm text-text-secondary font-mono">{run.prompt_body}</pre>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-3">
            <h2 className="font-mono text-sm font-semibold">Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-text-muted">Duration</span><span className="font-mono">{run.duration_ms ?? '—'}ms</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Tokens</span><span className="font-mono">{run.generated_tokens_used ?? '—'}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Augmentations</span><span className="font-mono">{run.augmentationStack.length}</span></div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 font-mono text-sm font-semibold">Rating</h2>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} type="button" onClick={() => setRating(v)} className="p-1 transition-colors" aria-label={`Rate ${v} stars`}>
                  <Star className={cn('h-5 w-5', v <= (run.user_rating ?? 0) ? 'fill-accent text-accent' : 'text-text-muted')} />
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 font-mono text-sm font-semibold">Notes</h2>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Add notes about this run..." className="w-full min-h-[80px] rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus:outline-none focus:border-border-focus resize-y" />
          </Card>
        </div>
      </div>
    </div>
  );
}
