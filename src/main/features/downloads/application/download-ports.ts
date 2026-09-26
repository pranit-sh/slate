import type { DownloadRecord } from "../../../../shared/electron-api"

export interface DownloadRepository {
  list(): Promise<DownloadRecord[]>
  open(id: string): Promise<string>
  showInFolder(id: string): Promise<void>
  copyLink(id: string): Promise<void>
  cancel(id: string): Promise<void>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}