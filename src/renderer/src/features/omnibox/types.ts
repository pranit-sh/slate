import type { LucideIcon } from "lucide-react"

export interface BrowserCommand {
  id: string
  label: string
  keywords: string[]
  icon: LucideIcon
  shortcut: string[]
  execute(): void
}