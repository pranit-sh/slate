import type { BrowserSettings } from "../../../../shared/electron-api"

export interface BrowserSettingsRepository {
  get(): Promise<BrowserSettings>
  update(settings: BrowserSettings): Promise<BrowserSettings>
}