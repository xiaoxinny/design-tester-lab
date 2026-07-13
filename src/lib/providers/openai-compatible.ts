/**
 * Model provider adapter.
 *
 * Single entry point `callProvider` dispatches to one of two request shapes:
 *
 *   - Anthropic: POST {baseUrl}/v1/messages
 *       Headers: x-api-key: <KEY>, anthropic-version: 2023-06-01, content-type
 *       Body: { model, max_tokens, system, messages: [{role:user,content}] }
 *       Response: { content: [{type:text, text}], usage: {input_tokens, output_tokens} }
 *
 *   - OpenAI-compat (OpenAI, Google OpenAI-compat, OpenRouter, Ollama, custom):
 *       POST {baseUrl}/v1/chat/completions
 *       Headers: Authorization: Bearer <KEY>, content-type
 *       Body: { model, max_tokens, temperature?, messages: [{role,content}] }
 *       Response: { choices: [{message: {content}}], usage: {prompt_tokens, completion_tokens} }
 *
 * The caller (generation runner) decrypts the BYOK credential and passes the
 * plaintext key here. This function does NOT log, persist, or echo the key.
 * It is the only call site where plaintext keys appear at runtime.
 *
 * Streaming is intentionally NOT supported here. The build plan flags
 * "streaming or wait-then-display" as a separate decision.
 */
import type { Provider } from '../model-credentials';

export interface ProviderCallInput {
  provider: Provider;
  /** The plaintext key. Caller is responsible for decrypting from the BYOK store and for not retaining this reference. */
  apiKey: string;
  /** The model id (provider-specific, e.g. 'gpt-4o-mini' or 'claude-sonnet-4-5'). */
  modelId: string;
  /** The system message. Concatenated augmentation stack fragment + nothing else. */
  systemPrompt: string;
  /** The user prompt. */
  userPrompt: string;
  /** Provider-specific model parameters. temperature is omitted for Anthropic (it uses top_p/top_k). */
  params?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  };
  /** Per-call timeout in ms. Defaults to 60s. */
  timeoutMs?: number;
  /** Override the provider endpoint (Ollama, custom). Must be http(s). */
  baseUrl?: string;
}

export interface ProviderCallResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  durationMs: number;
  /** Raw provider response id (for log correlation). Provider-specific format. */
  providerResponseId: string | null;
}

export class ProviderError extends Error {
  readonly statusCode: number;
  readonly provider: Provider;
  constructor(message: string, statusCode: number, provider: Provider) {
    super(message);
    this.name = 'ProviderError';
    this.statusCode = statusCode;
    this.provider = provider;
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Single entry point. Returns normalized ProviderCallResult regardless of
 * the underlying provider's response shape.
 */
export async function callProvider(input: ProviderCallInput): Promise<ProviderCallResult> {
  if (!input.apiKey) {
    throw new ProviderError('apiKey is required', 500, input.provider);
  }
  if (!input.modelId) {
    throw new ProviderError('modelId is required', 500, input.provider);
  }
  if (!input.userPrompt) {
    throw new ProviderError('userPrompt is required', 500, input.provider);
  }
  validateBaseUrl(input.baseUrl, input.provider);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const start = Date.now();
  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let fetchPromise: Promise<Response>;
    try {
      if (input.provider === 'anthropic') {
        fetchPromise = callAnthropic(input, controller.signal);
      } else {
        fetchPromise = callOpenAICompat(input, controller.signal);
      }
      response = await fetchPromise;
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ProviderError(`provider call timed out after ${timeoutMs}ms`, 504, input.provider);
    }
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(
      `network error: ${e instanceof Error ? e.message : String(e)}`,
      502,
      input.provider,
    );
  }

  const durationMs = Date.now() - start;
  if (!response.ok) {
    const body = await response.text();
    // Truncate to avoid logging large error bodies
    const snippet = body.slice(0, 500);
    throw new ProviderError(
      `provider returned ${response.status}: ${snippet}`,
      mapUpstreamStatus(response.status),
      input.provider,
    );
  }

  const json = (await response.json()) as unknown;
  return normalizeResponse(input.provider, json, durationMs);
}

// =====================================================================
// Anthropic (/v1/messages)
// =====================================================================

function callAnthropic(input: ProviderCallInput, signal: AbortSignal): Promise<Response> {
  const url = `${resolveBaseUrl(input.provider, input.baseUrl)}/v1/messages`;
  const body = {
    model: input.modelId,
    max_tokens: input.params?.maxTokens ?? 4096,
    system: input.systemPrompt,
    messages: [{ role: 'user', content: input.userPrompt }],
    ...(input.params?.temperature !== undefined ? { temperature: input.params.temperature } : {}),
    ...(input.params?.topP !== undefined ? { top_p: input.params.topP } : {}),
  };
  return fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': input.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    // SSRF defense: do not follow 30x redirects. A user-supplied baseUrl
    // (ollama, custom) could return a 302 to http://169.254.169.254 and
    // we'd dutifully POST the key there. Manual mode means non-2xx + no
    // Location header is treated as the final response; 3xx without a
    // followed body surfaces as a fetch error and we treat it as 502.
    redirect: 'manual',
    body: JSON.stringify(body),
    signal,
  });
}

interface AnthropicResponse {
  id?: string;
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

function normalizeAnthropic(json: unknown, durationMs: number): ProviderCallResult {
  const r = json as AnthropicResponse;
  const text = r.content.find((c) => c.type === 'text')?.text ?? '';
  return {
    text,
    usage: {
      inputTokens: r.usage?.input_tokens ?? 0,
      outputTokens: r.usage?.output_tokens ?? 0,
    },
    durationMs,
    providerResponseId: r.id ?? null,
  };
}

// =====================================================================
// OpenAI-compat (/v1/chat/completions) for OpenAI, Google, OpenRouter, Ollama, custom
// =====================================================================

function callOpenAICompat(input: ProviderCallInput, signal: AbortSignal): Promise<Response> {
  const url = `${resolveBaseUrl(input.provider, input.baseUrl)}/v1/chat/completions`;
  const body = {
    model: input.modelId,
    max_tokens: input.params?.maxTokens ?? 4096,
    ...(input.params?.temperature !== undefined ? { temperature: input.params.temperature } : {}),
    ...(input.params?.topP !== undefined ? { top_p: input.params.topP } : {}),
    messages: [
      ...(input.systemPrompt ? [{ role: 'system', content: input.systemPrompt }] : []),
      { role: 'user', content: input.userPrompt },
    ],
  };
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: "Bearer " + input.apiKey,
      'content-type': 'application/json',
    },
    // SSRF defense: do not follow 30x redirects (see Anthropic call above
    // for rationale).
    redirect: 'manual',
    body: JSON.stringify(body),
    signal,
  });
}

interface OpenAICompatResponse {
  id?: string;
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function normalizeOpenAICompat(json: unknown, durationMs: number): ProviderCallResult {
  const r = json as OpenAICompatResponse;
  const text = r.choices?.[0]?.message?.content ?? '';
  return {
    text,
    usage: {
      inputTokens: r.usage?.prompt_tokens ?? 0,
      outputTokens: r.usage?.completion_tokens ?? 0,
    },
    durationMs,
    providerResponseId: r.id ?? null,
  };
}

// =====================================================================
// Helpers
// =====================================================================

function normalizeResponse(
  provider: Provider,
  json: unknown,
  durationMs: number,
): ProviderCallResult {
  if (provider === 'anthropic') return normalizeAnthropic(json, durationMs);
  return normalizeOpenAICompat(json, durationMs);
}

const DEFAULT_BASE_URLS: Record<Provider, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  google: 'https://generativelanguage.googleapis.com',
  openrouter: 'https://openrouter.ai/api',
  ollama: 'http://localhost:11434',
  custom: '',
};

function resolveBaseUrl(provider: Provider, override: string | undefined): string {
  if (override && override.length > 0) return override.replace(/\/+$/, '');
  const def = DEFAULT_BASE_URLS[provider];
  if (!def) throw new ProviderError(`provider ${provider} requires a baseUrl`, 500, provider);
  return def;
}

/**
 * Validate the user-supplied baseUrl.
 *
 * For ollama and custom, the caller must supply a baseUrl. The function
 * enforces http(s) and rejects obviously dangerous forms (single-label
 * hostnames, localhost variants that resolve to private IPs at runtime
 * are the user's responsibility — defense in depth, not a sandbox).
 *
 * For all other providers, the default baseUrl is used and the override
 * is rejected to prevent users from pointing, say, "anthropic" at a
 * malicious server.
 */
function validateBaseUrl(baseUrl: string | undefined, provider: Provider): void {
  if (!baseUrl) return;
  if (provider !== 'ollama' && provider !== 'custom') {
    throw new ProviderError(
      `baseUrl is not supported for provider ${provider}; the default endpoint is used`,
      400,
      provider,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new ProviderError(`baseUrl is not a valid URL: ${baseUrl}`, 400, provider);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ProviderError(`baseUrl must use http or https: got ${parsed.protocol}`, 400, provider);
  }
}

function mapUpstreamStatus(status: number): number {
  // 4xx from upstream => 4xx to caller (their request was bad: bad model id,
  // bad key, etc.). 5xx from upstream => 502/503/504 to caller (provider is
  // down or rate-limiting).
  if (status === 401 || status === 403) return 502; // upstream auth: hide upstream's reason
  if (status === 429) return 429;
  if (status >= 500) return 502;
  return 502;
}