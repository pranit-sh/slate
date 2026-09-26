import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import type { RecentlyClosedPage } from "../../../../shared/electron-api"
import type {
  RecentlyClosedPageInput,
  RecentlyClosedRepository,
} from "../application/recently-closed-ports"

const MAX_RECENTLY_CLOSED_PAGES = 5

export class JsonRecentlyClosedRepository implements RecentlyClosedRepository {
  private pages: RecentlyClosedPage[] = []
  private readonly loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(private readonly filePath: string) {
    this.loaded = this.load()
  }

  async list(): Promise<RecentlyClosedPage[]> {
    await this.loaded
    return [...this.pages]
  }

  async add(page: RecentlyClosedPageInput): Promise<void> {
    await this.loaded
    this.pages = [
      {
        id: randomUUID(),
        title: page.title.trim() || new URL(page.url).hostname,
        url: page.url,
        faviconUrl: page.faviconUrl,
        closedAt: new Date().toISOString(),
      },
      ...this.pages,
    ].slice(0, MAX_RECENTLY_CLOSED_PAGES)
    await this.enqueueSave()
  }

  async take(id: string): Promise<RecentlyClosedPage | null> {
    await this.loaded
    const page = this.pages.find((item) => item.id === id) ?? null
    if (!page) return null

    this.pages = this.pages.filter((item) => item.id !== id)
    await this.enqueueSave()
    return page
  }

  private async load(): Promise<void> {
    try {
      const storedPages = JSON.parse(await fs.readFile(this.filePath, "utf8")) as RecentlyClosedPage[]
      this.pages = storedPages
        .filter((page) => /^https?:\/\//i.test(page.url))
        .slice(0, MAX_RECENTLY_CLOSED_PAGES)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load recently closed pages", error)
      }
    }
  }

  private async enqueueSave(): Promise<void> {
    this.saveQueue = this.saveQueue.catch(() => undefined).then(() => this.save())
    await this.saveQueue
  }

  private async save(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(temporaryPath, JSON.stringify(this.pages), "utf8")
    await fs.rename(temporaryPath, this.filePath)
  }
}