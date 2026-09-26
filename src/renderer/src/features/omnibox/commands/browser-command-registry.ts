import { Bookmark, Clock3, Code2, Download, PanelRightOpen, Settings2 } from "lucide-react"
import type { BrowserCommand } from "../types"

const COMMAND_USAGE_STORAGE_KEY = "slate.command-usage"

function getCommandUsage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(COMMAND_USAGE_STORAGE_KEY) ?? "{}") as Record<string, number>
  } catch {
    return {}
  }
}

function recordCommandUsage(commandId: string): void {
  try {
    const usage = getCommandUsage()
    usage[commandId] = Date.now()
    localStorage.setItem(COMMAND_USAGE_STORAGE_KEY, JSON.stringify(usage))
  } catch {
    // Command execution must not depend on usage persistence.
  }
}

export function getBrowserCommands(): BrowserCommand[] {
  const commandKey = window.electron.platform === "darwin" ? "⌘" : "Ctrl+"

  const commands: BrowserCommand[] = [
    {
      id: "open-history",
      label: "History: Browse Visited Pages",
      keywords: ["visits"],
      icon: Clock3,
      shortcut: [commandKey, "Y"],
      execute: window.electron.browser.openVisits,
    },
    {
      id: "open-bookmarks",
      label: "Bookmarks: Browse Saved Sites",
      keywords: ["saved"],
      icon: Bookmark,
      shortcut: [commandKey, "B"],
      execute: window.electron.browser.openSaved,
    },
    {
      id: "open-downloads",
      label: "Downloads: Browse Downloaded Files",
      keywords: ["files"],
      icon: Download,
      shortcut: [commandKey, "J"],
      execute: window.electron.browser.openDownloads,
    },
    {
      id: "open-settings",
      label: "Settings: Configure Browser",
      keywords: ["preferences"],
      icon: Settings2,
      shortcut: [commandKey, ","],
      execute: window.electron.browser.openSettings,
    },
    {
      id: "toggle-assistant-sidebar",
      label: "Assistant: Toggle Sidebar",
      keywords: ["ai", "chat", "panel"],
      icon: PanelRightOpen,
      shortcut: [commandKey, "⇧", "I"],
      execute: window.electron.browser.toggleAssistantSidebar,
    },
    {
      id: "toggle-dev-tools",
      label: "Developer: Toggle DevTools",
      keywords: ["inspect", "console"],
      icon: Code2,
      shortcut: ["F12"],
      execute: window.electron.browser.toggleActiveTabDevTools,
    },
  ]

  const usage = getCommandUsage()
  return commands
    .map((command, index) => ({ command, index }))
    .sort((left, right) =>
      (usage[right.command.id] ?? 0) - (usage[left.command.id] ?? 0)
      || left.index - right.index
    )
    .map(({ command }) => ({
      ...command,
      execute: () => {
        recordCommandUsage(command.id)
        command.execute()
      },
    }))
}