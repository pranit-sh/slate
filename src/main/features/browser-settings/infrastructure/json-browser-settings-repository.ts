import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import type { BrowserSettings } from "../../../../shared/electron-api"
import type { BrowserSettingsRepository } from "../application/browser-settings-ports"

const DEFAULT_SETTINGS: BrowserSettings = {
  reopenTabsOnStartup: false,
  searchEngine: "google",
}

function normalizeSettings(settings: Partial<BrowserSettings>): BrowserSettings {
  return {
    reopenTabsOnStartup: settings.reopenTabsOnStartup === true,
    searchEngine: settings.searchEngine === "bing"
      || settings.searchEngine === "duckduckgo"
      || settings.searchEngine === "brave"
      ? settings.searchEngine
      : "google",
  }
}

export class JsonBrowserSettingsRepository implements BrowserSettingsRepository {
  private settings = DEFAULT_SETTINGS
  private readonly loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(private readonly filePath: string) {
    this.loaded = this.load()
  }

  async get(): Promise<BrowserSettings> {
    await this.loaded
    return { ...this.settings }
  }

  async update(settings: BrowserSettings): Promise<BrowserSettings> {
    await this.loaded
    this.settings = normalizeSettings(settings)
    this.saveQueue = this.saveQueue.catch(() => undefined).then(() => this.save())
    await this.saveQueue
    return this.get()
  }

  private async load(): Promise<void> {
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, "utf8")) as Partial<BrowserSettings>
      this.settings = normalizeSettings(stored)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load browser settings", error)
      }
    }
  }

  private async save(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(temporaryPath, JSON.stringify(this.settings), "utf8")
    await fs.rename(temporaryPath, this.filePath)
  }
}