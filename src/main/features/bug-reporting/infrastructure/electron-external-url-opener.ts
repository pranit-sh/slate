import { shell } from "electron"
import type { ExternalUrlOpener } from "../application/bug-report-ports"

export class ElectronExternalUrlOpener implements ExternalUrlOpener {
  open(url: string): Promise<void> {
    return shell.openExternal(url)
  }
}