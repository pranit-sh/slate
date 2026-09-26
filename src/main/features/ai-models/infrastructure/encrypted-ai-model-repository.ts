import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import { safeStorage } from "electron"
import type { AiModel, AiProvider, AiSettings, SaveAiModelInput } from "../../../../shared/electron-api"
import type { AiCredentials, AiModelRepository } from "../application/ai-model-ports"

interface StoredAiModel extends Omit<AiModel, "hasApiKey" | "endpoint"> {
  endpoint?: string
  encryptedApiKey: string
}

interface StoredAiSettings {
  activeModelId: string | null
  models: StoredAiModel[]
}

const EMPTY_SETTINGS: StoredAiSettings = { activeModelId: null, models: [] }
const PROVIDERS = new Set<AiProvider>(["openai", "anthropic", "gemini"])

export class EncryptedAiModelRepository implements AiModelRepository {
  private settings = EMPTY_SETTINGS
  private readonly loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(private readonly filePath: string) {
    this.loaded = this.load()
  }

  async get(): Promise<AiSettings> {
    await this.loaded
    return this.toPublicSettings()
  }

  async save(input: SaveAiModelInput): Promise<AiSettings> {
    await this.loaded
    const name = input.name.trim()
    const model = input.model.trim()
    const endpoint = normalizeEndpoint(input.endpoint)
    const apiKey = input.apiKey?.trim()
    if (!name || !model || !PROVIDERS.has(input.provider)) {
      throw new Error("Name, provider, and model are required.")
    }

    const existingIndex = input.id
      ? this.settings.models.findIndex((item) => item.id === input.id)
      : -1
    const existing = existingIndex >= 0 ? this.settings.models[existingIndex] : undefined
    if (!existing && !apiKey) throw new Error("An API key is required for a new model.")

    const savedModel: StoredAiModel = {
      id: existing?.id ?? randomUUID(),
      name,
      provider: input.provider,
      model,
      endpoint,
      encryptedApiKey: apiKey ? encryptApiKey(apiKey) : existing!.encryptedApiKey,
    }
    const models = [...this.settings.models]
    if (existingIndex >= 0) models[existingIndex] = savedModel
    else models.push(savedModel)

    this.settings = {
      activeModelId: this.settings.activeModelId ?? savedModel.id,
      models,
    }
    await this.queueSave()
    return this.toPublicSettings()
  }

  async delete(id: string): Promise<AiSettings> {
    await this.loaded
    const models = this.settings.models.filter((model) => model.id !== id)
    this.settings = {
      activeModelId: this.settings.activeModelId === id
        ? (models[0]?.id ?? null)
        : this.settings.activeModelId,
      models,
    }
    await this.queueSave()
    return this.toPublicSettings()
  }

  async setActive(id: string): Promise<AiSettings> {
    await this.loaded
    if (!this.settings.models.some((model) => model.id === id)) {
      throw new Error("The selected AI model does not exist.")
    }
    this.settings = { ...this.settings, activeModelId: id }
    await this.queueSave()
    return this.toPublicSettings()
  }

  async getActiveCredentials(): Promise<AiCredentials> {
    await this.loaded
    const activeModel = this.settings.models.find(
      (model) => model.id === this.settings.activeModelId,
    )
    if (!activeModel) throw new Error("Add and select an AI model in Settings first.")
    return {
      provider: activeModel.provider,
      model: activeModel.model,
      endpoint: activeModel.endpoint ?? "",
      apiKey: decryptApiKey(activeModel.encryptedApiKey),
    }
  }

  async getCredentials(id: string): Promise<AiCredentials> {
    await this.loaded
    const target = this.settings.models.find((model) => model.id === id)
    if (!target) throw new Error("The selected AI model does not exist.")
    return {
      provider: target.provider,
      model: target.model,
      endpoint: target.endpoint ?? "",
      apiKey: decryptApiKey(target.encryptedApiKey),
    }
  }

  private async load(): Promise<void> {
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, "utf8")) as Partial<StoredAiSettings>
      const models = Array.isArray(stored.models)
        ? stored.models.filter(isStoredAiModel)
        : []
      this.settings = {
        models,
        activeModelId: models.some((model) => model.id === stored.activeModelId)
          ? stored.activeModelId!
          : (models[0]?.id ?? null),
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load AI model settings", error)
      }
    }
  }

  private async queueSave(): Promise<void> {
    this.saveQueue = this.saveQueue.catch(() => undefined).then(() => this.write())
    await this.saveQueue
  }

  private async write(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(temporaryPath, JSON.stringify(this.settings), "utf8")
    await fs.rename(temporaryPath, this.filePath)
  }

  private toPublicSettings(): AiSettings {
    return {
      activeModelId: this.settings.activeModelId,
      models: this.settings.models.map(({ encryptedApiKey: _encryptedApiKey, ...model }) => ({
        ...model,
        endpoint: model.endpoint ?? "",
        hasApiKey: true,
      })),
    }
  }
}

function encryptApiKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure credential storage is not available on this device.")
  }
  return safeStorage.encryptString(apiKey).toString("base64")
}

function decryptApiKey(encryptedApiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure credential storage is not available on this device.")
  }
  return safeStorage.decryptString(Buffer.from(encryptedApiKey, "base64"))
}

function isStoredAiModel(value: unknown): value is StoredAiModel {
  if (!value || typeof value !== "object") return false
  const model = value as Partial<StoredAiModel>
  return typeof model.id === "string"
    && typeof model.name === "string"
    && typeof model.model === "string"
    && typeof model.encryptedApiKey === "string"
    && PROVIDERS.has(model.provider as AiProvider)
}

function normalizeEndpoint(value: string | undefined): string {
  const endpoint = value?.trim() ?? ""
  if (!endpoint) return ""

  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error("Enter a valid endpoint URL.")
  }

  const isLoopback = url.hostname === "localhost"
    || url.hostname === "127.0.0.1"
    || url.hostname === "[::1]"
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error("Endpoints must use HTTPS. HTTP is allowed only for localhost.")
  }
  if (url.username || url.password || url.hash) {
    throw new Error("Endpoint URLs cannot contain credentials or fragments.")
  }
  return endpoint.replace(/\/$/, "")
}