import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import type { Visit } from "../../../../shared/electron-api"
import type { VisitHistoryRepository } from "../application/visit-history-ports"

export class JsonVisitHistoryRepository implements VisitHistoryRepository {
  private visits: Visit[] = []
  private loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly onChanged: () => void = () => undefined,
  ) {
    this.loaded = this.load()
  }

  async list(): Promise<Visit[]> {
    await this.loaded
    return [...this.visits].sort((left, right) => right.lastVisitedAt.localeCompare(left.lastVisitedAt))
  }

  async record(url: string, title: string, faviconUrl: string): Promise<void> {
    if (!/^https?:\/\//i.test(url)) return

    await this.loaded
    const now = new Date()
    const visitedAt = now.toISOString()
    const day = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    const existing = this.visits.find((visit) => visit.day === day && visit.url === url)

    if (existing) {
      existing.title = title || existing.title
      existing.faviconUrl = faviconUrl || existing.faviconUrl
      existing.count += 1
      existing.lastVisitedAt = visitedAt
      existing.visitTimes.push(visitedAt)
    } else {
      this.visits.push({
        day,
        url,
        title: title || url,
        faviconUrl,
        count: 1,
        lastVisitedAt: visitedAt,
        visitTimes: [visitedAt],
      })
    }

    await this.enqueueSave()
    this.onChanged()
  }

  async updateFavicon(url: string, faviconUrl: string): Promise<void> {
    if (!faviconUrl) return

    await this.loaded
    const visit = [...this.visits].reverse().find((entry) => entry.url === url)
    if (!visit || visit.faviconUrl === faviconUrl) return

    visit.faviconUrl = faviconUrl
    await this.enqueueSave()
    this.onChanged()
  }

  async delete(day: string, url: string): Promise<void> {
    await this.loaded
    const nextVisits = this.visits.filter((visit) => visit.day !== day || visit.url !== url)
    if (nextVisits.length === this.visits.length) return

    this.visits = nextVisits
    await this.enqueueSave()
    this.onChanged()
  }

  async clear(): Promise<void> {
    await this.loaded
    if (this.visits.length === 0) return

    this.visits = []
    await this.enqueueSave()
    this.onChanged()
  }

  private async load(): Promise<void> {
    try {
      const storedVisits = JSON.parse(await fs.readFile(this.filePath, "utf8")) as Array<
        Omit<Visit, "visitTimes"> & { visitTimes?: string[] }
      >
      this.visits = storedVisits.map((visit) => ({
        ...visit,
        visitTimes: visit.visitTimes ?? [visit.lastVisitedAt],
      }))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("Failed to load visits", error)
    }
  }

  private async enqueueSave(): Promise<void> {
    this.saveQueue = this.saveQueue.catch(() => undefined).then(() => this.save())
    await this.saveQueue
  }

  private async save(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(temporaryPath, JSON.stringify(this.visits), "utf8")
    await fs.rename(temporaryPath, this.filePath)
  }
}