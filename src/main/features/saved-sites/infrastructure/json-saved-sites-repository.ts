import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import type { SavedSite, SavedSiteInput } from "../../../../shared/electron-api"
import type { SavedSitesRepository } from "../application/saved-sites-ports"

function normalizeUrl(value: string): string {
  const input = value.trim()
  if (!input) throw new Error("A URL is required")

  const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs can be saved")
  }
  return url.toString()
}

export class JsonSavedSitesRepository implements SavedSitesRepository {
  private sites: SavedSite[] = []
  private loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(private readonly filePath: string) {
    this.loaded = this.load()
  }

  async list(): Promise<SavedSite[]> {
    await this.loaded
    return [...this.sites].sort((left, right) => {
      const openedComparison = (right.lastOpenedAt ?? "").localeCompare(left.lastOpenedAt ?? "")
      return openedComparison || right.updatedAt.localeCompare(left.updatedAt)
    })
  }

  async create(input: SavedSiteInput): Promise<SavedSite> {
    await this.loaded
    const now = new Date().toISOString()
    const site: SavedSite = {
      id: randomUUID(),
      title: input.title.trim() || normalizeUrl(input.url),
      url: normalizeUrl(input.url),
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
    }
    this.sites.push(site)
    await this.enqueueSave()
    return site
  }

  async update(id: string, input: SavedSiteInput): Promise<SavedSite | null> {
    await this.loaded
    const site = this.sites.find((item) => item.id === id)
    if (!site) return null

    site.url = normalizeUrl(input.url)
    site.title = input.title.trim() || site.url
    site.updatedAt = new Date().toISOString()
    await this.enqueueSave()
    return site
  }

  async delete(id: string): Promise<void> {
    await this.loaded
    const nextSites = this.sites.filter((site) => site.id !== id)
    if (nextSites.length === this.sites.length) return

    this.sites = nextSites
    await this.enqueueSave()
  }

  async markOpened(id: string): Promise<SavedSite | null> {
    await this.loaded
    const site = this.sites.find((item) => item.id === id)
    if (!site) return null

    site.lastOpenedAt = new Date().toISOString()
    await this.enqueueSave()
    return site
  }

  private async load(): Promise<void> {
    try {
      const storedSites = JSON.parse(await fs.readFile(this.filePath, "utf8")) as Array<
        Omit<SavedSite, "lastOpenedAt"> & { lastOpenedAt?: string | null }
      >
      this.sites = storedSites.map((site) => ({
        ...site,
        lastOpenedAt: site.lastOpenedAt ?? null,
      }))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load saved sites", error)
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
    await fs.writeFile(temporaryPath, JSON.stringify(this.sites), "utf8")
    await fs.rename(temporaryPath, this.filePath)
  }
}