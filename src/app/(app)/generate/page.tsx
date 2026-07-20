'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ChevronDown, ChevronUp, Loader2, Play } from 'lucide-react';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/lib/use-toast';

interface Augmentation {
  id: string;
  version: string;
  name: string;
  description: string | null;
  category: 'tokens' | 'principles' | 'behavior';
  conflictsWith: string[];
  requires: string[];
}

interface Credential {
  id: string;
  provider: string;
  label: string;
  baseUrl: string | null;
}

interface GenerateResult {
  runId: string;
  generatedHtml: string | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

const CATEGORY_LABELS: Record<Augmentation['category'], string> = {
  tokens: 'Tokens',
  principles: 'Principles',
  behavior: 'Behavior',
};

const CATEGORY_ORDER: Augmentation['category'][] = ['tokens', 'principles', 'behavior'];

export default function GeneratePage() {
  const [augmentations, setAugmentations] = useState<Augmentation[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [selectedAugs, setSelectedAugs] = useState<Set<string>>(new Set());
  const [disabledAugs, setDisabledAugs] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');
  const [selectedCredentialId, setSelectedCredentialId] = useState('');
  const [modelId, setModelId] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [showParams, setShowParams] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  // Fetch augmentations + credentials on mount
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const [augsRes, credsRes] = await Promise.all([
          fetch('/api/augmentations'),
          fetch('/api/credentials'),
        ]);

        if (!cancelled && augsRes.ok) {
          const data = await augsRes.json();
          setAugmentations(data.augmentations ?? []);
        }

        if (!cancelled && credsRes.ok) {
          const data = await credsRes.json();
          const list: Credential[] = data.credentials ?? [];
          setCredentials(list);
          const first = list[0];
          if (first) {
            setSelectedCredentialId((current) => current || first.id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast({
            variant: 'error',
            title: 'Failed to load options',
            description: err instanceof Error ? err.message : 'Network error',
          });
        }
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  // Recompute disabled augmentations whenever selection changes
  useEffect(() => {
    const newDisabled = new Set<string>();
    for (const augId of selectedAugs) {
      const aug = augmentations.find((a) => a.id === augId);
      if (aug) {
        for (const conflictId of aug.conflictsWith) {
          if (!selectedAugs.has(conflictId)) {
            newDisabled.add(conflictId);
          }
        }
      }
    }
    setDisabledAugs(newDisabled);
  }, [selectedAugs, augmentations]);

  // Animate the preview card in when a new result arrives
  useGSAP(
    () => {
      if (result && previewRef.current) {
        gsap.from(previewRef.current, {
          opacity: 0,
          y: 12,
          duration: 0.4,
          ease: 'power2.out',
        });
      }
    },
    { dependencies: [result?.runId] },
  );

  const toggleAug = useCallback((aug: Augmentation) => {
    setSelectedAugs((prev) => {
      const next = new Set(prev);
      if (next.has(aug.id)) {
        next.delete(aug.id);
      } else {
        next.add(aug.id);
      }
      return next;
    });
  }, []);

  async function handleGenerate() {
    if (!prompt.trim() || !selectedCredentialId || !modelId.trim()) return;
    setGenerating(true);
    setResult(null);
    try {
      const augStack = augmentations
        .filter((a) => selectedAugs.has(a.id))
        .map((a) => ({ id: a.id, version: a.version }));
      const body = {
        promptBody: prompt.trim(),
        modelCredentialId: selectedCredentialId,
        modelId: modelId.trim(),
        augmentationStack: augStack,
        params: { temperature, maxTokens },
      };
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Generation failed');
      }
      const data: GenerateResult = await res.json();
      setResult(data);
      toast({
        variant: 'success',
        title: 'Generation complete',
        description: `${data.durationMs}ms • ${data.inputTokens + data.outputTokens} tokens`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      toast({ variant: 'error', title: 'Generation failed', description: msg });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-mono text-xl font-semibold">Generate</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: prompt + augmentations + preview */}
        <div className="space-y-6 lg:col-span-2">
          {/* Prompt input */}
          <Card className="p-4">
            <Label htmlFor="prompt" className="mb-2 block font-mono text-sm">
              Prompt
            </Label>
            <textarea
              id="prompt"
              name="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the UI you want to generate..."
              className="w-full min-h-[120px] resize-y rounded-md border border-border bg-surface px-3 py-2 font-sans text-base placeholder:text-text-muted focus:border-border-focus focus:shadow-glow focus:outline-none"
              rows={5}
            />
          </Card>

          {/* Augmentation Picker */}
          <Card className="p-4">
            <h2 className="mb-3 font-mono text-sm font-semibold">Augmentations</h2>
            {CATEGORY_ORDER.map((category) => {
              const categoryAugs = augmentations.filter((a) => a.category === category);
              if (categoryAugs.length === 0) return null;
              return (
                <div key={category} className="mb-4 last:mb-0">
                  <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-text-muted">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categoryAugs.map((aug) => {
                      const selected = selectedAugs.has(aug.id);
                      const disabled = disabledAugs.has(aug.id);
                      return (
                        <button
                          key={aug.id}
                          type="button"
                          data-augmentation-id={aug.id}
                          disabled={disabled}
                          onClick={() => toggleAug(aug)}
                          className={cn(
                            'rounded-md border px-3 py-1.5 font-mono text-xs transition-colors',
                            selected
                              ? 'border-accent bg-accent-muted text-accent'
                              : disabled
                                ? 'cursor-not-allowed border-border-subtle bg-surface-raised text-text-muted opacity-50'
                                : 'border-border text-text-secondary hover:border-accent hover:text-accent',
                          )}
                          title={aug.description || aug.name}
                        >
                          {aug.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Result preview */}
          {result && result.generatedHtml && (
            <Card ref={previewRef} className="p-4">
              <h2 className="mb-3 font-mono text-sm font-semibold">Preview</h2>
              <div className="overflow-hidden rounded-md border border-border bg-white">
                <iframe
                  srcDoc={result.generatedHtml}
                  sandbox="allow-scripts"
                  className="h-[400px] w-full border-0"
                  title="Generated UI preview"
                />
              </div>
              <div className="mt-3 flex gap-4 font-mono text-xs text-text-muted">
                <span>{result.durationMs}ms</span>
                <span>{result.inputTokens + result.outputTokens} tokens</span>
                <span>Run: {result.runId.slice(0, 8)}</span>
              </div>
            </Card>
          )}
        </div>

        {/* Right column: model config + generate button */}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 font-mono text-sm font-semibold">Model</h2>

            <Label htmlFor="credential" className="mb-1 block text-xs text-text-secondary">
              Credential
            </Label>
            <select
              id="credential"
              value={selectedCredentialId}
              onChange={(e) => setSelectedCredentialId(e.target.value)}
              className="mb-3 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="">Select a credential...</option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.provider})
                </option>
              ))}
            </select>

            <Label htmlFor="modelId" className="mb-1 block text-xs text-text-secondary">
              Model ID
            </Label>
            <Input
              id="modelId"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. claude-sonnet-4-20250514"
              className="mb-3 text-sm"
            />

            <button
              type="button"
              onClick={() => setShowParams(!showParams)}
              className="mb-2 flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary"
            >
              {showParams ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Parameters
            </button>

            {showParams && (
              <div className="space-y-3 border-t border-border-subtle pt-3">
                <div>
                  <Label htmlFor="temperature" className="mb-1 block text-xs text-text-muted">
                    Temperature: {temperature.toFixed(1)}
                  </Label>
                  <input
                    id="temperature"
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="maxTokens" className="mb-1 block text-xs text-text-muted">
                    Max tokens: {maxTokens}
                  </Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min={256}
                    max={16384}
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 4096)}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </Card>

          <Button
            variant="primary"
            className="w-full"
            disabled={
              generating || !prompt.trim() || !selectedCredentialId || !modelId.trim()
            }
            onClick={handleGenerate}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
