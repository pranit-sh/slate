import type { BrowserSettings } from "../../../../shared/electron-api"
import type { BrowserSettingsRepository } from "./browser-settings-ports"

export class BrowserSettingsService {
  constructor(private readonly repository: BrowserSettingsRepository) {}

  get(): Promise<BrowserSettings> {
    return this.repository.get()
  }

  update(settings: BrowserSettings): Promise<BrowserSettings> {
    return this.repository.update(settings)
  }
}