import { Bookmark, Clock3, Code2, Download, Ghost, Plus, Settings2 } from "lucide-react"
import type { BrowserCommand } from "../types"

export function getBrowserCommands(): BrowserCommand[] {
  const commandKey = window.electron.platform === "darwin" ? "⌘" : "Ctrl+"

  return [
    {
      id: "new-tab",
      label: "Tab: Open New Tab",
      keywords: ["create"],
      icon: Plus,
      shortcut: [commandKey, "T"],
      execute: window.electron.browser.newTab,
    },
    {
      id: "new-ghost-tab",
      label: "Ghost: Open Private Tab",
      keywords: ["private", "incognito"],
      icon: Ghost,
      shortcut: [commandKey, "⇧", "T"],
      execute: window.electron.browser.newGhostTab,
    },
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
      id: "open-dev-tools",
      label: "Developer: Inspect Current Page",
      keywords: ["devtools", "debug"],
      icon: Code2,
      shortcut: ["F12"],
      execute: window.electron.browser.openDevTools,
    },
    {
      id: "open-settings",
      label: "Settings: Configure Browser",
      keywords: ["preferences"],
      icon: Settings2,
      shortcut: [commandKey, ","],
      execute: window.electron.browser.openSettings,
    },
  ]
}