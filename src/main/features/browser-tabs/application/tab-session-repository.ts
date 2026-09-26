import type { TabSession } from "../../../../shared/electron-api"

export interface TabSessionRepository {
  get(): Promise<TabSession>
  update(session: TabSession): Promise<void>
}