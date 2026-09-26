import type { BrowserTab } from "../../../../../shared/electron-api"

const GROUPING_THRESHOLD = 6

export interface OpenTabGroup {
  key: string
  label: string
  tabs: BrowserTab[]
}

function getSite(url: string): { key: string; label: string } {
  try {
    const hostname = new URL(url).hostname.toLocaleLowerCase()
    const normalizedHostname = hostname.replace(/^www\./, "")
    return {
      key: normalizedHostname,
      label: normalizedHostname,
    }
  } catch {
    return { key: url, label: "Other" }
  }
}

export function groupOpenTabs(tabs: BrowserTab[]): OpenTabGroup[] {
  if (tabs.length < GROUPING_THRESHOLD) {
    return [{ key: "open-tabs", label: "Open tabs", tabs }]
  }

  const tabsBySite = new Map<string, { label: string; tabs: BrowserTab[] }>()
  for (const tab of tabs) {
    const site = getSite(tab.url)
    const existing = tabsBySite.get(site.key)
    if (existing) existing.tabs.push(tab)
    else tabsBySite.set(site.key, { label: site.label, tabs: [tab] })
  }

  if ([...tabsBySite.values()].every((site) => site.tabs.length === 1)) {
    return [{ key: "open-tabs", label: "Open tabs", tabs }]
  }

  const groups: OpenTabGroup[] = []
  const otherTabs: BrowserTab[] = []
  let otherGroupIndex = -1

  for (const [key, site] of tabsBySite) {
    if (site.tabs.length === 1) {
      if (otherGroupIndex === -1) otherGroupIndex = groups.length
      otherTabs.push(site.tabs[0])
      continue
    }

    groups.push({ key, label: site.label, tabs: site.tabs })
  }

  if (otherTabs.length > 0) {
    groups.splice(otherGroupIndex, 0, {
      key: "other-tabs",
      label: "Other tabs",
      tabs: otherTabs,
    })
  }

  return groups
}