/**
 * LLM client with pluggable backends.
 *
 * Priority order:
 *   1. Groq (GROQ_API_KEY)       — fastest, free tier
 *   2. Anthropic (ANTHROPIC_API_KEY)
 *   3. OpenAI (OPENAI_API_KEY)
 *   4. Ollama local (OLLAMA_HOST, default http://localhost:11434)
 *
 * Whichever key is set takes priority. Falls through to Ollama for offline/dev.
 */

export type LLMRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
}

export interface LLMBackendInfo {
  provider: "groq" | "anthropic" | "openai" | "ollama";
  model: string;
}

function resolveBackend(): LLMBackendInfo {
  if (process.env.GROQ_API_KEY) {
    return { provider: "groq", model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile" };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001" };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: "openai", model: process.env.OPENAI_MODEL || "gpt-4o-mini" };
  }
  return { provider: "ollama", model: process.env.OLLAMA_MODEL || "llama3.1:8b" };
}

export function getBackendInfo(): LLMBackendInfo {
  return resolveBackend();
}

// ============================================================================
// Streaming completion — returns an async generator of delta chunks.
// Backends that support streaming use SSE; others emit one chunk at end.
// ============================================================================

export async function* streamCompletion(
  opts: LLMCompletionOptions
): AsyncGenerator<LLMStreamChunk> {
  const backend = resolveBackend();

  switch (backend.provider) {
    case "groq":
      yield* streamGroq(backend.model, opts);
      return;
    case "anthropic":
      yield* streamAnthropic(backend.model, opts);
      return;
    case "openai":
      yield* streamOpenAI(backend.model, opts);
      return;
    case "ollama":
      yield* streamOllama(backend.model, opts);
      return;
  }
}

// ============================================================================
// One-shot completion for non-streaming callers (parser fallback, explainer).
// ============================================================================

export async function complete(opts: LLMCompletionOptions): Promise<string> {
  let buf = "";
  for await (const chunk of streamCompletion(opts)) {
    buf += chunk.delta;
  }
  return buf;
}

// ============================================================================
// Groq (OpenAI-compatible API, free tier) — recommended default
// ============================================================================

async function* streamGroq(
  model: string,
  opts: LLMCompletionOptions
): AsyncGenerator<LLMStreamChunk> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
  }

  yield* parseOpenAISSE(res.body);
}

// ============================================================================
// Anthropic (if key is set)
// ============================================================================

async function* streamAnthropic(
  model: string,
  opts: LLMCompletionOptions
): AsyncGenerator<LLMStreamChunk> {
  // Anthropic puts system prompt separately
  const systemMessages = opts.messages.filter((m) => m.role === "system");
  const otherMessages = opts.messages.filter((m) => m.role !== "system");
  const system = systemMessages.map((m) => m.content).join("\n\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
    },
    body: JSON.stringify({
      model,
      system: system || undefined,
      messages: otherMessages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.5,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.type === "content_block_delta" && obj.delta?.text) {
          yield { delta: obj.delta.text, done: false };
        }
      } catch {}
    }
  }

  yield { delta: "", done: true };
}

// ============================================================================
// OpenAI (if key is set)
// ============================================================================

async function* streamOpenAI(
  model: string,
  opts: LLMCompletionOptions
): AsyncGenerator<LLMStreamChunk> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
  }

  yield* parseOpenAISSE(res.body);
}

// ============================================================================
// Ollama local (offline fallback)
// ============================================================================

async function* streamOllama(
  model: string,
  opts: LLMCompletionOptions
): AsyncGenerator<LLMStreamChunk> {
  const host = process.env.OLLAMA_HOST || "http://localhost:11434";

  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      stream: true,
      options: {
        temperature: opts.temperature ?? 0.5,
        num_predict: opts.maxTokens ?? 1024,
      },
      format: opts.jsonMode ? "json" : undefined,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama ${res.status}: ${text.slice(0, 200)}. Is Ollama running at ${host}?`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.message?.content) {
          yield { delta: obj.message.content, done: false };
        }
        if (obj.done) {
          yield { delta: "", done: true };
          return;
        }
      } catch {}
    }
  }

  yield { delta: "", done: true };
}

// ============================================================================
// Shared SSE parser for OpenAI-compatible APIs (Groq, OpenAI)
// ============================================================================

async function* parseOpenAISSE(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<LLMStreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        const delta = obj.choices?.[0]?.delta?.content;
        if (delta) yield { delta, done: false };
      } catch {}
    }
  }

  yield { delta: "", done: true };
}
