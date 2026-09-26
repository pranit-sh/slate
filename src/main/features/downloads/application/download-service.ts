import type { DownloadRecord } from "../../../../shared/electron-api"
import type { DownloadRepository } from "./download-ports"

export class DownloadService {
  constructor(private readonly repository: DownloadRepository) {}

  list(): Promise<DownloadRecord[]> {
    return this.repository.list()
  }

  open(id: string): Promise<string> {
    return this.repository.open(id)
  }

  showInFolder(id: string): Promise<void> {
    return this.repository.showInFolder(id)
  }

  copyLink(id: string): Promise<void> {
    return this.repository.copyLink(id)
  }

  cancel(id: string): Promise<void> {
    return this.repository.cancel(id)
  }

  remove(id: string): Promise<void> {
    return this.repository.remove(id)
  }

  clear(): Promise<void> {
    return this.repository.clear()
  }
}