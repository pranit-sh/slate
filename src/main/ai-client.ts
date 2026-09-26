import type { AiChatMessage, AiProvider } from "../shared/electron-api"

interface AiCredentials {
  provider: AiProvider
  model: string
  endpoint: string
  apiKey: string
}

/**
 * Headers that keep server-sent events flowing incrementally. `identity`
 * encoding avoids undici buffering a compressed body before decoding, and the
 * SSE/no-cache hints discourage intermediate proxies from buffering the stream.
 */
const STREAM_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "text/event-stream",
  "Accept-Encoding": "identity",
  "Cache-Control": "no-cache",
}

export async function testAiConnection(credentials: AiCredentials, signal?: AbortSignal): Promise<void> {
  const request = buildModelsRequest(credentials)
  const response = await fetch(request.url, { method: "GET", signal, headers: request.headers })
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(data.error?.message || `Connection failed (${response.status}).`)
  }
  const payload = (await response.json().catch(() => null)) as unknown
  const availableModels = request.extractModelIds(payload)
  if (availableModels.length > 0 && !modelIsAvailable(credentials, availableModels)) {
    throw new Error(`Model "${credentials.model}" is not available on this endpoint.`)
  }
}

interface ModelsRequest {
  url: string
  headers: Record<string, string>
  extractModelIds: (payload: unknown) => string[]
}

function buildModelsRequest(credentials: AiCredentials): ModelsRequest {
  if (credentials.provider === "openai") {
    return {
      url: resolveBaseUrl(credentials, "https://api.openai.com/v1") + "/models",
      headers: { Authorization: `Bearer ${credentials.apiKey}` },
      extractModelIds: (payload) => {
        const data = (payload as { data?: Array<{ id?: string }> })?.data
        return Array.isArray(data) ? data.map((item) => item.id ?? "").filter(Boolean) : []
      },
    }
  }
  if (credentials.provider === "anthropic") {
    return {
      url: resolveBaseUrl(credentials, "https://api.anthropic.com/v1") + "/models",
      headers: { "x-api-key": credentials.apiKey, "anthropic-version": "2023-06-01" },
      extractModelIds: (payload) => {
        const data = (payload as { data?: Array<{ id?: string }> })?.data
        return Array.isArray(data) ? data.map((item) => item.id ?? "").filter(Boolean) : []
      },
    }
  }
  return {
    url: resolveBaseUrl(credentials, "https://generativelanguage.googleapis.com/v1beta") + "/models",
    headers: { "x-goog-api-key": credentials.apiKey },
    extractModelIds: (payload) => {
      const models = (payload as { models?: Array<{ name?: string }> })?.models
      return Array.isArray(models) ? models.map((item) => item.name ?? "").filter(Boolean) : []
    },
  }
}

function resolveBaseUrl(credentials: AiCredentials, officialBaseUrl: string): string {
  if (!credentials.endpoint) return officialBaseUrl
  const url = validateEndpoint(credentials.endpoint)
  const pathname = url.pathname.replace(/\/(chat\/completions|messages)$/, "").replace(/\/$/, "")
  url.pathname = pathname
  return url.toString().replace(/\/$/, "")
}

function modelIsAvailable(credentials: AiCredentials, availableModels: string[]): boolean {
  if (credentials.provider === "gemini") {
    const target = credentials.model.replace(/^models\//, "")
    return availableModels.some((name) => name.replace(/^models\//, "") === target)
  }
  return availableModels.includes(credentials.model)
}

export async function streamAiMessage(
  credentials: AiCredentials,
  messages: AiChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const normalizedMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({ ...message, content: message.content.trim() }))
    .filter((message) => message.content.length > 0)
    .slice(-40)
  if (normalizedMessages.length === 0) throw new Error("A message is required.")

  switch (credentials.provider) {
    case "openai":
      return streamOpenAi(credentials, normalizedMessages, onChunk, signal)
    case "anthropic":
      return streamAnthropic(credentials, normalizedMessages, onChunk, signal)
    case "gemini":
      return streamGemini(credentials, normalizedMessages, onChunk, signal)
  }
}

async function streamOpenAi(
  credentials: AiCredentials,
  messages: AiChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(resolveEndpoint(credentials), {
    method: "POST",
    signal,
    headers: {
      ...STREAM_HEADERS,
      Authorization: `Bearer ${credentials.apiKey}`,
    },
    body: JSON.stringify({ model: credentials.model, messages, stream: true }),
  })
  await parseEventStream(response, (data) => {
    if (data === "[DONE]") return false
    const event = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
    const chunk = event.choices?.[0]?.delta?.content ?? ""
    onChunk(chunk)
    return chunk.length > 0
  })
}

async function streamAnthropic(
  credentials: AiCredentials,
  messages: AiChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(resolveEndpoint(credentials), {
    method: "POST",
    signal,
    headers: {
      ...STREAM_HEADERS,
      "x-api-key": credentials.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: credentials.model, max_tokens: 4096, messages, stream: true }),
  })
  await parseEventStream(response, (data) => {
    const event = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } }
    if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
      const chunk = event.delta.text ?? ""
      onChunk(chunk)
      return chunk.length > 0
    }
    return false
  })
}

async function streamGemini(
  credentials: AiCredentials,
  messages: AiChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(
    resolveEndpoint(credentials),
    {
      method: "POST",
      signal,
      headers: {
        ...STREAM_HEADERS,
        "x-goog-api-key": credentials.apiKey,
      },
      body: JSON.stringify({
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
      }),
    },
  )
  await parseEventStream(response, (data) => {
    const event = JSON.parse(data) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const chunk = event.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? ""
    onChunk(chunk)
    return chunk.length > 0
  })
}

async function parseEventStream(
  response: Response,
  onData: (data: string) => boolean,
): Promise<void> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(data.error?.message || `AI provider request failed (${response.status}).`)
  }
  if (!response.body) throw new Error("The AI provider returned an empty response.")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let receivedText = false

  const processEvent = (event: string): void => {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
    if (data) receivedText = onData(data) || receivedText
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replaceAll("\r\n", "\n")
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""
    for (const event of events) processEvent(event)
    if (done) break
  }
  if (buffer.trim()) processEvent(buffer)

  if (!receivedText) throw new Error("The AI provider returned an empty response.")
}

function resolveEndpoint(credentials: AiCredentials): string {
  const configuredEndpoint = credentials.endpoint ? validateEndpoint(credentials.endpoint) : undefined
  if (credentials.provider === "openai") {
    return appendProviderPath(configuredEndpoint ?? new URL("https://api.openai.com/v1"), "/chat/completions")
  }
  if (credentials.provider === "anthropic") {
    return appendProviderPath(configuredEndpoint ?? new URL("https://api.anthropic.com/v1"), "/messages")
  }

  const url = configuredEndpoint ?? new URL("https://generativelanguage.googleapis.com/v1beta")
  if (!url.pathname.endsWith(":streamGenerateContent")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/models/${encodeURIComponent(credentials.model)}:streamGenerateContent`
  }
  url.searchParams.set("alt", "sse")
  return url.toString()
}

function appendProviderPath(url: URL, providerPath: string): string {
  if (!url.pathname.endsWith(providerPath)) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}${providerPath}`
  }
  return url.toString()
}

function validateEndpoint(endpoint: string): URL {
  const url = new URL(endpoint)
  const isLoopback = url.hostname === "localhost"
    || url.hostname === "127.0.0.1"
    || url.hostname === "[::1]"
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error("Endpoints must use HTTPS. HTTP is allowed only for localhost.")
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Endpoint URLs cannot contain credentials or fragments.")
  }
  return url
}