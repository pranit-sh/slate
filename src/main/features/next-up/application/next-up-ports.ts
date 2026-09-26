import type { Visit } from "../../../../shared/electron-api"

export interface VisitReader {
  list(): Promise<Visit[]>
}

export interface UrlReader {
  list(): Promise<Array<{ url: string }>>
}

export interface NextUpDismissalRepository {
  list(now?: Date): Promise<string[]>
  dismiss(id: string): Promise<void>
  clear(): Promise<void>
}