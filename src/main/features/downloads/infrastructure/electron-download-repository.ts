import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, promises as fs } from "node:fs"
import { basename, dirname, extname, join } from "node:path"
import { clipboard, shell, type DownloadItem } from "electron"
import type { DownloadRecord, DownloadState } from "../../../../shared/electron-api"
import type { DownloadRepository } from "../application/download-ports"

type DownloadsChanged = (downloads: DownloadRecord[]) => void

export class ElectronDownloadRepository implements DownloadRepository {
  private downloads: DownloadRecord[] = []
  private readonly activeItems = new Map<string, DownloadItem>()
  private readonly reservedSavePaths = new Set<string>()
  private readonly loaded: Promise<void>
  private saveQueue = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly downloadsDirectory: string,
    private readonly onChanged: DownloadsChanged,
  ) {
    this.loaded = this.load()
  }

  async list(): Promise<DownloadRecord[]> {
    await this.loaded
    for (const download of this.downloads) {
      download.fileExists = Boolean(download.savePath && existsSync(download.savePath))
    }
    return this.sortedDownloads()
  }

  track(item: DownloadItem): void {
    const now = new Date().toISOString()
    const savePath = this.getAvailableSavePath(item.getFilename())
    item.setSavePath(savePath)
    this.reservedSavePaths.add(savePath)
    const download: DownloadRecord = {
      id: randomUUID(),
      filename: item.getFilename(),
      url: item.getURL(),
      savePath,
      state: "progressing",
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      startedAt: now,
      updatedAt: now,
      completedAt: null,
      fileExists: false,
    }
    this.activeItems.set(download.id, item)

    void this.loaded.then(() => {
      this.downloads.push(download)
      return this.changed()
    })

    item.on("updated", (_event, state) => {
      download.state = state
      this.updateProgress(download, item)
    })
    item.once("done", (_event, state) => {
      download.state = state as DownloadState
      download.completedAt = state === "completed" ? new Date().toISOString() : null
      this.updateProgress(download, item, true)
      this.activeItems.delete(download.id)
      this.reservedSavePaths.delete(download.savePath)
    })
  }

  async open(id: string): Promise<string> {
    const download = await this.find(id)
    if (!download || download.state !== "completed" || !download.savePath) {
      return "Download is not available"
    }
    return shell.openPath(download.savePath)
  }

  async showInFolder(id: string): Promise<void> {
    const download = await this.find(id)
    if (!download?.savePath) return
    if (existsSync(download.savePath)) shell.showItemInFolder(download.savePath)
    else await shell.openPath(dirname(download.savePath))
  }

  async copyLink(id: string): Promise<void> {
    const download = await this.find(id)
    if (download) clipboard.writeText(download.url)
  }

  async cancel(id: string): Promise<void> {
    this.activeItems.get(id)?.cancel()
  }

  async remove(id: string): Promise<void> {
    await this.loaded
    const nextDownloads = this.downloads.filter((download) => download.id !== id)
    if (nextDownloads.length === this.downloads.length) return
    this.downloads = nextDownloads
    await this.changed()
  }

  async clear(): Promise<void> {
    await this.loaded
    const activeDownloads = this.downloads.filter((download) => download.state === "progressing")
    if (activeDownloads.length === this.downloads.length) return
    this.downloads = activeDownloads
    await this.changed()
  }

  private updateProgress(download: DownloadRecord, item: DownloadItem, persist = false): void {
    download.filename = item.getFilename()
    download.savePath = item.getSavePath()
    download.receivedBytes = item.getReceivedBytes()
    download.totalBytes = item.getTotalBytes()
    download.updatedAt = new Date().toISOString()
    download.fileExists = download.state === "completed" && existsSync(download.savePath)
    void this.loaded.then(() => persist ? this.changed() : this.notify())
  }

  private async find(id: string): Promise<DownloadRecord | undefined> {
    await this.loaded
    return this.downloads.find((download) => download.id === id)
  }

  private sortedDownloads(): DownloadRecord[] {
    return [...this.downloads].sort((left, right) => right.startedAt.localeCompare(left.startedAt))
  }

  private async changed(): Promise<void> {
    this.notify()
    this.saveQueue = this.saveQueue.catch(() => undefined).then(() => this.save())
    await this.saveQueue
  }

  private notify(): void {
    this.onChanged(this.sortedDownloads())
  }

  private async load(): Promise<void> {
    try {
      const storedDownloads = JSON.parse(await fs.readFile(this.filePath, "utf8")) as DownloadRecord[]
      this.downloads = storedDownloads.map((download) => ({
        ...download,
        state: download.state === "progressing" ? "interrupted" : download.state,
        completedAt: download.completedAt
          ?? (download.state === "completed" ? download.updatedAt : null),
        fileExists: Boolean(download.savePath && existsSync(download.savePath)),
      }))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("Failed to load downloads", error)
      }
    }
  }

  private async save(): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`
    await fs.mkdir(dirname(this.filePath), { recursive: true })
    await fs.writeFile(temporaryPath, JSON.stringify(this.downloads), "utf8")
    await fs.rename(temporaryPath, this.filePath)
  }

  private getAvailableSavePath(filename: string): string {
    mkdirSync(this.downloadsDirectory, { recursive: true })
    const safeFilename = basename(filename) || "download"
    const extension = extname(safeFilename)
    const name = basename(safeFilename, extension)
    let savePath = join(this.downloadsDirectory, safeFilename)
    let suffix = 1

    while (
      existsSync(savePath)
      || this.reservedSavePaths.has(savePath)
      || this.downloads.some((download) => download.savePath === savePath)
    ) {
      savePath = join(this.downloadsDirectory, `${name} (${suffix})${extension}`)
      suffix += 1
    }
    return savePath
  }
}