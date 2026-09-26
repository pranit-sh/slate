import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import type { TabSession } from "../../../../shared/electron-api"
import type { TabSessionRepository } from "../application/tab-session-repository"

export class JsonTabSessionRepository implements TabSessionRepository {
  private session: TabSession = { urls: [], activeIndex: 0 }
  private readonly loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(private readonly filePath: string) {
    this.loaded = this.load()
  }

  async get(): Promise<TabSession> {
    await this.loaded
    return { urls: [...this.session.urls], activeIndex: this.session.activeIndex }
  }

  async update(session: TabSession): Promise<void> {
    await this.loaded
    this.session = { urls: [...session.urls], activeIndex: session.activeIndex }
    this.saveQueue = this.saveQueue.catch(() => undefined).then(() => this.save())
    await this.saveQueue
  }

  private async load(): Promise<void> {
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, "utf8")) as Partial<TabSession>
      const urls = Array.isArray(stored.urls)
        ? stored.urls.filter((url): url is string => typeof url === "string")
        : []
      const activeIndex = typeof stored.activeIndex === "number" ? stored.activeIndex : 0
      this.session = { urls, activeIndex }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load tab session", error)
      }
    }
  }

  private async save(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(temporaryPath, JSON.stringify(this.session), "utf8")
    await fs.rename(temporaryPath, this.filePath)
  }
}