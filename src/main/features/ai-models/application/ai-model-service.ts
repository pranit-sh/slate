import type {
  AiConnectionStatus,
  AiSettings,
  SaveAiModelInput,
} from "../../../../shared/electron-api"
import type {
  AiConnectionTester,
  AiCredentials,
  AiModelRepository,
} from "./ai-model-ports"

export class AiModelService {
  constructor(
    private readonly repository: AiModelRepository,
    private readonly testConnection: AiConnectionTester,
    private readonly onChanged: () => Promise<void>,
  ) {}

  get(): Promise<AiSettings> {
    return this.repository.get()
  }

  async save(input: SaveAiModelInput): Promise<AiSettings> {
    const settings = await this.repository.save(input)
    await this.onChanged()
    return settings
  }

  async delete(id: string): Promise<AiSettings> {
    const settings = await this.repository.delete(id)
    await this.onChanged()
    return settings
  }

  async setActive(id: string): Promise<AiSettings> {
    const settings = await this.repository.setActive(id)
    await this.onChanged()
    return settings
  }

  getActiveCredentials(): Promise<AiCredentials> {
    return this.repository.getActiveCredentials()
  }

  async testModelConnection(id: string): Promise<AiConnectionStatus> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    try {
      const credentials = await this.repository.getCredentials(id)
      await this.testConnection(credentials, controller.signal)
      return { state: "connected" }
    } catch (error) {
      const message = controller.signal.aborted
        ? "Connection timed out."
        : error instanceof Error
          ? error.message
          : "Connection failed."
      return { state: "error", message }
    } finally {
      clearTimeout(timeout)
    }
  }
}