import type { AiProvider } from "../../../../shared/electron-api"

interface AiCredentials {
  provider: AiProvider
  model: string
  endpoint: string
  apiKey: string
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