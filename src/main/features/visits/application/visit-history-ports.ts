import type { Visit } from "../../../../shared/electron-api"

export interface VisitHistoryRepository {
  list(): Promise<Visit[]>
  record(url: string, title: string, faviconUrl: string): Promise<void>
  updateFavicon(url: string, faviconUrl: string): Promise<void>
  delete(day: string, url: string): Promise<void>
  clear(): Promise<void>
}