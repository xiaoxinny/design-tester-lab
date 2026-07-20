'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Trash2, Key } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from '@/lib/use-toast';

type Provider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'ollama'
  | 'custom';

interface CredentialMeta {
  id: string;
  userId: string;
  provider: Provider;
  label: string;
  baseUrl: string | null;
  keyVersion: number;
  lastUsedAt: number | null;
  createdAt: number;
}

const PROVIDERS: Provider[] = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
  'ollama',
  'custom',
];

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  custom: 'Custom',
};

const providerColors: Record<Provider, string> = {
  anthropic: 'bg-amber-500/10 text-amber-500',
  openai: 'bg-emerald-500/10 text-emerald-500',
  google: 'bg-blue-500/10 text-blue-500',
  openrouter: 'bg-purple-500/10 text-purple-500',
  ollama: 'bg-cyan-500/10 text-cyan-500',
  custom: 'bg-text-muted/10 text-text-muted',
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString();
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<CredentialMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CredentialMeta | null>(null);

  // Form state for add dialog
  const [provider, setProvider] = useState<Provider>('openai');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/credentials', { method: 'GET' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      const list = Array.isArray(data.credentials) ? data.credentials : [];
      setCredentials(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load credentials';
      toast({ title: 'Error', description: message, variant: 'error' });
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Stagger animate credential cards when the list changes
  useGSAP(
    () => {
      if (!gridRef.current) return;
      const cards = gridRef.current.querySelectorAll('[data-credential-card]');
      if (cards.length === 0) return;
      gsap.from(cards, {
        opacity: 0,
        y: 8,
        duration: 0.3,
        stagger: 0.05,
        ease: 'power2.out',
      });
    },
    { dependencies: [credentials], revertOnUpdate: true },
  );

  const resetAddForm = () => {
    setProvider('openai');
    setLabel('');
    setKey('');
    setBaseUrl('');
  };

  const handleAddDialogChange = (open: boolean) => {
    setAddDialogOpen(open);
    if (!open) resetAddForm();
  };

  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedBaseUrl = baseUrl.trim();
    const payload: {
      provider: Provider;
      label: string;
      key: string;
      baseUrl?: string;
    } = {
      provider,
      label: label.trim(),
      key,
    };
    if (trimmedBaseUrl) payload.baseUrl = trimmedBaseUrl;

    setSubmitting(true);
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }
      setAddDialogOpen(false);
      resetAddForm();
      toast({
        title: 'Credential added',
        description: `${PROVIDER_LABELS[provider]} • ${label.trim()}`,
        variant: 'success',
      });
      await fetchCredentials();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add credential';
      toast({ title: 'Error', description: message, variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    try {
      const res = await fetch(`/api/credentials/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }
      setCredentials((prev) => prev.filter((c) => c.id !== target.id));
      setDeleteTarget(null);
      toast({
        title: 'Credential deleted',
        description: target.label,
        variant: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete credential';
      toast({ title: 'Error', description: message, variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-semibold">Credentials</h1>
        <Button
          variant="primary"
          onClick={() => setAddDialogOpen(true)}
          data-testid="add-credential"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add credential
        </Button>
      </div>

      {loading ? (
        <Card className="p-6">
          <p className="text-sm text-text-muted">Loading credentials…</p>
        </Card>
      ) : credentials.length === 0 ? (
        <Card className="p-10">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
              <Key className="h-5 w-5 text-text-muted" />
            </div>
            <h2 className="font-medium text-text-primary">No credentials yet</h2>
            <p className="max-w-sm text-sm text-text-muted">
              Add an API key to start using this provider. Keys are encrypted at
              rest and never displayed in full again.
            </p>
            <Button
              variant="secondary"
              onClick={() => setAddDialogOpen(true)}
              data-testid="add-credential-empty"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add your first credential
            </Button>
          </div>
        </Card>
      ) : (
        <div
          ref={gridRef}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {credentials.map((cred) => (
            <Card
              key={cred.id}
              data-credential-card
              className="space-y-3 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-mono text-xs uppercase',
                      providerColors[cred.provider],
                    )}
                  >
                    {PROVIDER_LABELS[cred.provider]}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete credential"
                  data-testid="delete-credential"
                  onClick={() => setDeleteTarget(cred)}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">
                  {cred.label}
                </p>
                {cred.baseUrl ? (
                  <p className="truncate text-xs text-text-muted">
                    {cred.baseUrl}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                <span>Created {formatDate(cred.createdAt)}</span>
                <span>
                  Last used:{' '}
                  {cred.lastUsedAt ? formatDate(cred.lastUsedAt) : 'Never used'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add credential dialog */}
      <Dialog.Root open={addDialogOpen} onOpenChange={handleAddDialogChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6"
            data-testid="add-credential-dialog"
          >
            <div className="mb-4 flex items-center justify-between">
              <Dialog.Title className="font-mono text-lg font-semibold">
                Add credential
              </Dialog.Title>
              <Dialog.Close
                asChild
                aria-label="Close"
                className="absolute top-4 right-4 text-text-muted hover:text-text-primary"
              >
                <button type="button">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="provider">Provider</Label>
                <select
                  id="provider"
                  name="provider"
                  required
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-base"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  name="label"
                  required
                  placeholder="e.g. My OpenAI Key"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="key">API Key</Label>
                <Input
                  id="key"
                  name="key"
                  type="password"
                  required
                  placeholder="sk-..."
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="baseUrl">
                  Base URL <span className="text-text-muted">(optional)</span>
                </Label>
                <Input
                  id="baseUrl"
                  name="baseUrl"
                  placeholder="https://api.example.com/v1 (optional)"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="secondary" disabled={submitting}>
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                  data-testid="submit-add-credential"
                >
                  {submitting ? 'Adding…' : 'Add'}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6"
            data-testid="delete-credential-dialog"
          >
            <Dialog.Title className="font-mono text-lg font-semibold">
              Delete credential
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-text-muted">
              Are you sure you want to delete this credential?
              {deleteTarget ? (
                <>
                  {' '}
                  <span className="font-medium text-text-primary">
                    {deleteTarget.label}
                  </span>{' '}
                  ({PROVIDER_LABELS[deleteTarget.provider]}) will be removed and
                  cannot be recovered.
                </>
              ) : null}
            </Dialog.Description>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteConfirm}
                data-testid="confirm-delete-credential"
              >
                Delete
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
