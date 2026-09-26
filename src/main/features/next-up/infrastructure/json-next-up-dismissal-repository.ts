import { promises as fs } from "node:fs"
import { dirname } from "node:path"
import type { NextUpDismissalRepository } from "../application/next-up-ports"

const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000

interface StoredDismissal {
  id: string
  dismissedAt: string
}

export class JsonNextUpDismissalRepository implements NextUpDismissalRepository {
  private dismissals: StoredDismissal[] = []
  private readonly loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(private readonly filePath: string) {
    this.loaded = this.load()
  }

  async list(now = new Date()): Promise<string[]> {
    await this.loaded
    return this.dismissals
      .filter((dismissal) => this.isActive(dismissal, now))
      .map((dismissal) => dismissal.id)
  }

  async dismiss(id: string): Promise<void> {
    await this.loaded
    const dismissedAt = new Date().toISOString()
    this.dismissals = [
      ...this.dismissals.filter((dismissal) => dismissal.id !== id),
      { id, dismissedAt },
    ].filter((dismissal) => this.isActive(dismissal, new Date()))
    await this.enqueueSave()
  }

  async clear(): Promise<void> {
    await this.loaded
    if (this.dismissals.length === 0) return
    this.dismissals = []
    await this.enqueueSave()
  }

  private isActive(dismissal: StoredDismissal, now: Date): boolean {
    const dismissedAt = new Date(dismissal.dismissedAt).getTime()
    return Number.isFinite(dismissedAt) && now.getTime() - dismissedAt < DISMISSAL_DURATION_MS
  }

  private async load(): Promise<void> {
    try {
      const stored = JSON.parse(await fs.readFile(this.filePath, "utf8")) as StoredDismissal[]
      const now = new Date()
      this.dismissals = stored.filter((dismissal) =>
        typeof dismissal.id === "string"
        && typeof dismissal.dismissedAt === "string"
        && this.isActive(dismissal, now),
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load Next up dismissals", error)
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
    await fs.writeFile(temporaryPath, JSON.stringify(this.dismissals), "utf8")
    await fs.rename(temporaryPath, this.filePath)
  }
}