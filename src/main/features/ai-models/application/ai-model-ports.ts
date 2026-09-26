import type { AiModel, AiProvider, AiSettings, SaveAiModelInput } from "../../../../shared/electron-api"

export interface AiCredentials {
  provider: AiProvider
  model: string
  endpoint: string
  apiKey: string
}

export interface AiModelRepository {
  get(): Promise<AiSettings>
  save(input: SaveAiModelInput): Promise<AiSettings>
  delete(id: string): Promise<AiSettings>
  setActive(id: string): Promise<AiSettings>
  getActiveCredentials(): Promise<AiCredentials>
  getCredentials(id: string): Promise<AiCredentials>
}

export type AiConnectionTester = (
  credentials: AiCredentials,
  signal: AbortSignal,
) => Promise<void>

export type AiModelSummary = AiModel