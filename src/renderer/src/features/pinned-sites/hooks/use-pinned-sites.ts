import { useEffect, useState } from "react"
import type { BrowserTab, BrowserTabsState, PinnedSite } from "../../../../../shared/electron-api"

function canPin(tab: BrowserTab): boolean {
  try {
    const url = new URL(tab.url)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function usePinnedSites() {
  const [sites, setSites] = useState<PinnedSite[]>([])
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(new Set())
  const [tabsState, setTabsState] = useState<BrowserTabsState>({
    activeTabId: null,
    isActiveTabGhost: false,
    isActiveTabLoading: false,
    tabs: [],
  })
  const [isPinning, setIsPinning] = useState(false)

  useEffect(() => {
    let isSubscribed = true
    const removePinnedSitesListener = window.electron.browser.onPinnedSitesChanged(setSites)
    const removeTabsListener = window.electron.browser.onTabsChanged(setTabsState)

    void Promise.all([
      window.electron.browser.getPinnedSites(),
      window.electron.browser.getSavedSites(),
      window.electron.browser.getTabs(),
    ]).then(([items, savedSites, state]) => {
      if (!isSubscribed) return
      setSites(items)
      setBookmarkedUrls(new Set(savedSites.map((site) => site.url)))
      setTabsState(state)
    }).catch((error) => console.error("Failed to load pinned sites", error))

    return () => {
      isSubscribed = false
      removePinnedSitesListener()
      removeTabsListener()
    }
  }, [])

  async function pin(tab: BrowserTab): Promise<boolean> {
    if (isPinning) return false

    setIsPinning(true)
    try {
      const site = await window.electron.browser.createPinnedSite({
        title: tab.title,
        url: tab.url,
        faviconUrl: tab.faviconUrl,
      })
      setSites((items) => items.some((item) => item.id === site.id) ? items : [...items, site])
      return true
    } catch (error) {
      console.error("Failed to pin site", error)
      return false
    } finally {
      setIsPinning(false)
    }
  }

  async function unpin(id: string): Promise<void> {
    const previousSites = sites
    setSites((items) => items.filter((site) => site.id !== id))
    try {
      await window.electron.browser.deletePinnedSite(id)
    } catch (error) {
      setSites(previousSites)
      console.error("Failed to unpin site", error)
    }
  }

  async function bookmark(site: PinnedSite): Promise<void> {
    if (bookmarkedUrls.has(site.url)) return

    try {
      const savedSite = await window.electron.browser.createSavedSite({
        title: site.title,
        url: site.url,
      })
      setBookmarkedUrls((urls) => new Set(urls).add(savedSite.url))
    } catch (error) {
      console.error("Failed to bookmark pinned site", error)
    }
  }

  async function refreshBookmarks(): Promise<void> {
    try {
      const savedSites = await window.electron.browser.getSavedSites()
      setBookmarkedUrls(new Set(savedSites.map((site) => site.url)))
    } catch (error) {
      console.error("Failed to refresh bookmarks", error)
    }
  }

  const pinnedUrls = new Set(sites.map((site) => site.url))
  const availableTabs = tabsState.tabs.filter((tab) => canPin(tab) && !pinnedUrls.has(tab.url))

  return { availableTabs, bookmark, bookmarkedUrls, isPinning, pin, refreshBookmarks, sites, unpin }
}