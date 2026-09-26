import type { Visit } from "../../../../shared/electron-api"
import type { VisitHistoryRepository } from "./visit-history-ports"

export class VisitHistoryService {
  constructor(private readonly repository: VisitHistoryRepository) {}

  list(): Promise<Visit[]> {
    return this.repository.list()
  }

  record(url: string, title: string, faviconUrl: string): Promise<void> {
    return this.repository.record(url, title, faviconUrl)
  }

  updateFavicon(url: string, faviconUrl: string): Promise<void> {
    return this.repository.updateFavicon(url, faviconUrl)
  }

  delete(day: string, url: string): Promise<void> {
    return this.repository.delete(day, url)
  }

  clear(): Promise<void> {
    return this.repository.clear()
  }
}