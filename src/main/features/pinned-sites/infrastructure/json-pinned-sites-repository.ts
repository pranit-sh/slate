import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import type { PinnedSite, PinnedSiteInput } from "../../../../shared/electron-api"
import type { PinnedSitesRepository } from "../application/pinned-sites-ports"

function normalizeUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS pages can be pinned")
  }
  return url.toString()
}

export class JsonPinnedSitesRepository implements PinnedSitesRepository {
  private sites: PinnedSite[] = []
  private loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(private readonly filePath: string) {
    this.loaded = this.load()
  }

  async list(): Promise<PinnedSite[]> {
    await this.loaded
    return [...this.sites]
  }

  async create(input: PinnedSiteInput): Promise<PinnedSite> {
    await this.loaded
    const url = normalizeUrl(input.url)
    const existingSite = this.sites.find((site) => site.url === url)
    if (existingSite) return existingSite

    const site: PinnedSite = {
      id: randomUUID(),
      title: input.title.trim() || new URL(url).hostname,
      url,
      faviconUrl: input.faviconUrl,
      pinnedAt: new Date().toISOString(),
    }
    this.sites.push(site)
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

  private async load(): Promise<void> {
    try {
      const storedSites = JSON.parse(await fs.readFile(this.filePath, "utf8")) as PinnedSite[]
      this.sites = storedSites
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load pinned sites", error)
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