/**
 * Tests for src/lib/providers/openai-compatible.ts (callProvider).
 *
 * Mocks the global fetch so no network calls happen. Tests cover auth
 * headers, request body shapes, response normalization, error mapping,
 * SSRF defense on baseUrl, and timeout abort.
 */
import { callProvider, ProviderError } from '../src/lib/providers/openai-compatible';

let pass = 0;
let fail = 0;

function ok(label: string, detail: string): void {
  console.log(`OK:   ${label} -- ${detail}`);
  pass++;
}

function fail_(label: string, detail: string): void {
  console.log(`FAIL: ${label} -- ${detail}`);
  fail++;
}

interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

// In-memory fetch stub
type FetchResponse = {
  status: number;
  body: unknown;
};
let captured: CapturedCall[] = [];
let nextResponse: FetchResponse | Error = { status: 200, body: {} };

function installFetchStub(): void {
  captured = [];
  (globalThis as unknown as { fetch: (url: string, opts: RequestInit) => Promise<Response> }).fetch =
    async (url: string, opts: RequestInit) => {
      const headers: Record<string, string> = {};
      if (opts.headers) {
        for (const [k, v] of Object.entries(opts.headers)) {
          headers[k.toLowerCase()] = String(v);
        }
      }
      let body: unknown;
      if (typeof opts.body === 'string') {
        try {
          body = JSON.parse(opts.body);
        } catch {
          body = opts.body;
        }
      }
      captured.push({ url, method: opts.method ?? 'GET', headers, body });
      if (nextResponse instanceof Error) throw nextResponse;
      return new Response(JSON.stringify(nextResponse.body), {
        status: nextResponse.status,
        headers: { 'content-type': 'application/json' },
      });
    };
}

function restoreFetch(): void {
  // The original fetch in this Node version is globalThis.fetch. We don't
  // replace it permanently in any test; installFetchStub is called per-test.
  // The tests don't restore the original — they run sequentially within
  // one process and the last test's stub is what remains. That's fine; the
  // tests don't share network state.
}

async function main(): Promise<void> {
  installFetchStub();

  // === Anthropic happy path ===

  nextResponse = {
    status: 200,
    body: {
      id: 'msg_abc123',
      content: [{ type: 'text', text: 'Hello back' }],
      usage: { input_tokens: 10, output_tokens: 4 },
    },
  };
  const anthropicRes = await callProvider({
    provider: 'anthropic',
    apiKey: 'sk-ant-test',
    modelId: 'claude-sonnet-4-5',
    systemPrompt: 'be helpful',
    userPrompt: 'hello',
  });
  if (anthropicRes.text !== 'Hello back') {
    fail_('Anthropic extracts text from response.content[0].text', `got: ${anthropicRes.text}`);
  } else {
    ok('Anthropic extracts text from response.content[0].text', 'Hello back');
  }
  if (anthropicRes.usage.inputTokens !== 10 || anthropicRes.usage.outputTokens !== 4) {
    fail_('Anthropic extracts usage tokens', JSON.stringify(anthropicRes.usage));
  } else {
    ok('Anthropic extracts usage tokens', 'in=10 out=4');
  }
  if (anthropicRes.providerResponseId !== 'msg_abc123') {
    fail_('Anthropic returns provider response id', `got: ${anthropicRes.providerResponseId}`);
  } else {
    ok('Anthropic returns provider response id', 'msg_abc123');
  }

  // Verify Anthropic request: URL + auth header + body shape
  const anthropicReq = captured[0]!;
  if (anthropicReq.url !== 'https://api.anthropic.com/v1/messages') {
    fail_('Anthropic URL is /v1/messages on api.anthropic.com', `got: ${anthropicReq.url}`);
  } else {
    ok('Anthropic URL is /v1/messages on api.anthropic.com', anthropicReq.url);
  }
  if (anthropicReq.headers['x-api-key'] !== 'sk-ant-test') {
    fail_('Anthropic auth header is x-api-key', `got: ${anthropicReq.headers['x-api-key']}`);
  } else {
    ok('Anthropic auth header is x-api-key', 'sk-ant-test');
  }
  if (anthropicReq.headers['anthropic-version'] !== '2023-06-01') {
    fail_('Anthropic auth includes anthropic-version header', 'missing');
  } else {
    ok('Anthropic auth includes anthropic-version header', '2023-06-01');
  }
  if (anthropicReq.headers['authorization']) {
    fail_('Anthropic does NOT use Authorization header', `got: ${anthropicReq.headers['authorization']}`);
  } else {
    ok('Anthropic does NOT use Authorization header', 'absent');
  }
  const anthropicBody = anthropicReq.body as Record<string, unknown>;
  if (anthropicBody.model !== 'claude-sonnet-4-5') {
    fail_('Anthropic body has model', `got: ${anthropicBody.model}`);
  } else {
    ok('Anthropic body has model', 'claude-sonnet-4-5');
  }
  if (anthropicBody.system !== 'be helpful') {
    fail_('Anthropic body has system as top-level field', `got: ${anthropicBody.system}`);
  } else {
    ok('Anthropic body has system as top-level field', 'be helpful');
  }
  if (!Array.isArray(anthropicBody.messages) || (anthropicBody.messages as unknown[]).length !== 1) {
    fail_('Anthropic body has 1 message', 'wrong count');
  } else {
    ok('Anthropic body has 1 message', '1');
  }

  // === OpenAI happy path ===

  captured = [];
  nextResponse = {
    status: 200,
    body: {
      id: 'chatcmpl-xyz',
      choices: [{ message: { content: 'hi from openai' } }],
      usage: { prompt_tokens: 8, completion_tokens: 2 },
    },
  };
  const openaiRes = await callProvider({
    provider: 'openai',
    apiKey: 'sk-openai-test',
    modelId: 'gpt-4o-mini',
    systemPrompt: 'be terse',
    userPrompt: 'say hi',
  });
  if (openaiRes.text !== 'hi from openai') {
    fail_('OpenAI extracts text from choices[0].message.content', `got: ${openaiRes.text}`);
  } else {
    ok('OpenAI extracts text from choices[0].message.content', 'hi from openai');
  }
  const openaiReq = captured[0]!;
  if (openaiReq.url !== 'https://api.openai.com/v1/chat/completions') {
    fail_('OpenAI URL is /v1/chat/completions on api.openai.com', `got: ${openaiReq.url}`);
  } else {
    ok('OpenAI URL is /v1/chat/completions on api.openai.com', openaiReq.url);
  }
  if (openaiReq.headers['authorization'] !== ('Bearer ' + 'sk-openai-test')) {
    fail_('OpenAI auth header is Bearer', `got: ${openaiReq.headers['authorization']}`);
  } else {
    ok('OpenAI auth header is Bearer', 'Bearer  ' + '***');
  }
  const openaiBody = openaiReq.body as Record<string, unknown>;
  if (!Array.isArray(openaiBody.messages) || (openaiBody.messages as unknown[]).length !== 2) {
    fail_('OpenAI body has 2 messages (system + user)', 'wrong count');
  } else {
    ok('OpenAI body has 2 messages (system + user)', '2');
  }
  const openaiMessages = openaiBody.messages as Array<{ role: string; content: string }>;
  if (openaiMessages[0]?.role !== 'system' || openaiMessages[0]?.content !== 'be terse') {
    fail_('OpenAI first message is system', JSON.stringify(openaiMessages[0]));
  } else {
    ok('OpenAI first message is system', 'be terse');
  }
  if (openaiMessages[1]?.role !== 'user' || openaiMessages[1]?.content !== 'say hi') {
    fail_('OpenAI second message is user', JSON.stringify(openaiMessages[1]));
  } else {
    ok('OpenAI second message is user', 'say hi');
  }

  // === Other OpenAI-compat providers ===

  for (const [provider, defaultUrl] of [
    ['google', 'https://generativelanguage.googleapis.com'],
    ['openrouter', 'https://openrouter.ai/api'],
    ['ollama', 'http://localhost:11434'],
  ] as Array<[string, string]>) {
    captured = [];
    nextResponse = {
      status: 200,
      body: {
        id: `${provider}-id`,
        choices: [{ message: { content: `hi from ${provider}` } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      },
    };
    const r = await callProvider({
      provider: provider as 'google' | 'openrouter' | 'ollama',
      apiKey: 'k',
      modelId: 'm',
      systemPrompt: '',
      userPrompt: 'hi',
    });
    if (r.text !== `hi from ${provider}`) {
      fail_(`${provider} extracts text via OpenAI-compat path`, `got: ${r.text}`);
    } else {
      ok(`${provider} extracts text via OpenAI-compat path`, `hi from ${provider}`);
    }
    const reqUrl = captured[0]!.url;
    const expectedUrl = `${defaultUrl}/v1/chat/completions`;
    if (reqUrl !== expectedUrl) {
      fail_(`${provider} hits ${expectedUrl}`, `got: ${reqUrl}`);
    } else {
      ok(`${provider} hits ${expectedUrl}`, 'match');
    }
  }

  // === Custom provider ===

  captured = [];
  nextResponse = {
    status: 200,
    body: {
      id: 'custom-id',
      choices: [{ message: { content: 'hi from custom' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    },
  };
  const customRes = await callProvider({
    provider: 'custom',
    apiKey: 'k',
    modelId: 'm',
    systemPrompt: '',
    userPrompt: 'hi',
    baseUrl: 'https://my-llm.example.com',
  });
  if (customRes.text !== 'hi from custom') {
    fail_('custom provider uses /v1/chat/completions', `got: ${customRes.text}`);
  } else {
    ok('custom provider uses /v1/chat/completions', 'hi from custom');
  }
  if (captured[0]!.url !== 'https://my-llm.example.com/v1/chat/completions') {
    fail_('custom provider uses supplied baseUrl', captured[0]!.url);
  } else {
    ok('custom provider uses supplied baseUrl', captured[0]!.url);
  }

  // === baseUrl SSRF defense ===

  let threw = false;
  try {
    await callProvider({
      provider: 'custom',
      apiKey: 'k',
      modelId: 'm',
      systemPrompt: '',
      userPrompt: 'hi',
      baseUrl: 'file:///etc/passwd',
    });
  } catch (e) {
    threw = e instanceof ProviderError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('file:// baseUrl rejected', 'no-throw');
  } else {
    ok('file:// baseUrl rejected', '400');
  }

  threw = false;
  try {
    await callProvider({
      provider: 'custom',
      apiKey: 'k',
      modelId: 'm',
      systemPrompt: '',
      userPrompt: 'hi',
      baseUrl: 'gopher://example.com',
    });
  } catch (e) {
    threw = e instanceof ProviderError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('gopher:// baseUrl rejected', 'no-throw');
  } else {
    ok('gopher:// baseUrl rejected', '400');
  }

  // baseUrl not allowed for non-ollama/non-custom
  threw = false;
  try {
    await callProvider({
      provider: 'anthropic',
      apiKey: 'k',
      modelId: 'm',
      systemPrompt: '',
      userPrompt: 'hi',
      baseUrl: 'https://evil.example.com',
    });
  } catch (e) {
    threw = e instanceof ProviderError && e.statusCode === 400;
  }
  if (!threw) {
    fail_('baseUrl rejected for anthropic', 'no-throw');
  } else {
    ok('baseUrl rejected for anthropic', '400');
  }

  // === Error handling ===

  captured = [];
  nextResponse = { status: 401, body: { error: 'bad key' } };
  threw = false;
  try {
    await callProvider({
      provider: 'openai',
      apiKey: 'bad',
      modelId: 'm',
      systemPrompt: '',
      userPrompt: 'hi',
    });
  } catch (e) {
    if (e instanceof ProviderError) {
      threw = true;
      if (e.statusCode !== 502) {
        fail_('upstream 401 maps to 502 (hide upstream auth reason)', `got: ${e.statusCode}`);
        threw = false;
      }
    }
  }
  if (!threw) {
    fail_('upstream 401 throws ProviderError', 'no-throw');
  } else {
    ok('upstream 401 throws ProviderError (mapped to 502)', '502');
  }

  captured = [];
  nextResponse = { status: 429, body: { error: 'rate limited' } };
  threw = false;
  try {
    await callProvider({
      provider: 'openai',
      apiKey: 'k',
      modelId: 'm',
      systemPrompt: '',
      userPrompt: 'hi',
    });
  } catch (e) {
    threw = e instanceof ProviderError && e.statusCode === 429;
  }
  if (!threw) {
    fail_('upstream 429 maps to 429', 'no-throw');
  } else {
    ok('upstream 429 maps to 429', '429');
  }

  captured = [];
  nextResponse = { status: 500, body: 'internal error' };
  threw = false;
  try {
    await callProvider({
      provider: 'openai',
      apiKey: 'k',
      modelId: 'm',
      systemPrompt: '',
      userPrompt: 'hi',
    });
  } catch (e) {
    threw = e instanceof ProviderError && e.statusCode === 502;
  }
  if (!threw) {
    fail_('upstream 500 maps to 502', 'no-throw');
  } else {
    ok('upstream 500 maps to 502', '502');
  }

  // === Input validation ===

  for (const [label, input] of [
    ['empty apiKey', { provider: 'openai' as const, apiKey: '', modelId: 'm', systemPrompt: '', userPrompt: 'hi' }],
    ['empty modelId', { provider: 'openai' as const, apiKey: 'k', modelId: '', systemPrompt: '', userPrompt: 'hi' }],
    ['empty userPrompt', { provider: 'openai' as const, apiKey: 'k', modelId: 'm', systemPrompt: '', userPrompt: '' }],
  ] as Array<[string, Parameters<typeof callProvider>[0]]>) {
    threw = false;
    try {
      await callProvider(input);
    } catch (e) {
      threw = e instanceof ProviderError && e.statusCode === 500;
    }
    if (!threw) {
      fail_(`${label} throws 500`, 'no-throw');
    } else {
      ok(`${label} throws 500`, '500');
    }
  }

  // === Timeout ===

  captured = [];
  // Mock fetch that never resolves until aborted
  (globalThis as unknown as { fetch: (url: string, opts: RequestInit) => Promise<Response> }).fetch =
    async (_url: string, opts: RequestInit) =>
      new Promise<Response>((_, reject) => {
        opts.signal?.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      });
  threw = false;
  let timeoutErr: ProviderError | null = null;
  try {
    await callProvider({
      provider: 'openai',
      apiKey: 'k',
      modelId: 'm',
      systemPrompt: '',
      userPrompt: 'hi',
      timeoutMs: 50,
    });
  } catch (e) {
    threw = e instanceof ProviderError;
    if (e instanceof ProviderError) timeoutErr = e;
  }
  if (!threw) {
    fail_('aborted call throws ProviderError', 'no-throw');
  } else if (timeoutErr?.statusCode !== 504) {
    fail_('aborted call maps to 504', `got: ${timeoutErr?.statusCode}`);
  } else {
    ok('aborted call maps to 504', '504');
  }

  console.log('');
  console.log(`Results: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('UNEXPECTED:', e);
  process.exit(1);
});