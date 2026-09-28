import {
  BrowserWindow,
  WebContentsView,
  type Event,
  type FoundInPageResult,
  type WebContents,
} from "electron"
import {
  BROWSER_CONTENT_CHANNELS,
  IPC_CHANNELS,
  type AddressBarBounds,
  type AddressBarFeedback,
  type BrowserTab,
  type BrowserNavigationState,
  type BrowserTabsState,
  type DownloadRecord,
  type NextUpRecommendation,
  type PinnedSite,
  type PinnedSiteInput,
  type RecentlyClosedPage,
  type SavedSiteInput,
  type SearchEngine,
  type TabSession,
} from "../../../../shared/electron-api"
import type { TabSessionRepository } from "../application/tab-session-repository"
import type { RecentlyClosedPageInput } from "../../recently-closed"
import type { VisitHistoryService } from "../../visits"

const HOME_URL = "about:blank"
const VISITS_URL = "slate://visits"
const SAVED_URL = "slate://bookmarks"
const DOWNLOADS_URL = "slate://downloads"
const SETTINGS_URL = "slate://settings"
export const GHOST_PARTITION = "ghost"
const DEV_TOOLS_WIDTH_RATIO = 0.35
const MIN_DEV_TOOLS_WIDTH = 320
const MAX_DEV_TOOLS_WIDTH = 560

interface TabRecord extends BrowserTab {
  view: WebContentsView
  microphoneFrameIds: Set<number>
}

export interface ActivePageContent {
  tabId: string
  title: string
  url: string
  selectedText: string
  text: string
  links: Array<{ text: string; url: string }>
  truncated: boolean
}

const MAX_PAGE_TEXT_LENGTH = 50_000

function getNavigationUrl(value: string, searchEngine: SearchEngine): string | null {
  const input = value.trim()
  if (!input) return null

  if (/^https?:\/\//i.test(input)) return input
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(input)) {
    return `http://${input}`
  }
  if (!input.includes(" ") && input.includes(".")) return `https://${input}`

  const searchUrls: Record<SearchEngine, string> = {
    google: "https://www.google.com/search?q=",
    bing: "https://www.bing.com/search?q=",
    duckduckgo: "https://duckduckgo.com/?q=",
    brave: "https://search.brave.com/search?q=",
  }
  return `${searchUrls[searchEngine]}${encodeURIComponent(input)}`
}

function normalizeHttpUrl(value: string, base?: string): string {
  const url = new URL(value, base)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed.")
  }
  return url.toString()
}

function isPageLink(value: unknown): value is { text: string; url: string } {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as { text?: unknown }).text === "string"
    && typeof (value as { url?: unknown }).url === "string"
}

async function loadUrl(webContents: WebContents, url: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw signal.reason
  const handleAbort = (): void => webContents.stop()
  signal?.addEventListener("abort", handleAbort, { once: true })
  try {
    await webContents.loadURL(url)
    if (signal?.aborted) throw signal.reason
  } finally {
    signal?.removeEventListener("abort", handleAbort)
  }
}

export class BrowserTabs {
  private readonly tabs = new Map<string, TabRecord>()
  private readonly pickerView: WebContentsView
  private readonly siteSettingsView: WebContentsView
  private readonly visitsView: WebContentsView
  private readonly savedView: WebContentsView
  private readonly downloadsView: WebContentsView
  private readonly settingsView: WebContentsView
  private activeTabId: string | null = null
  private nextTabId = 1
  private isPickerAttached = false
  private isPickerRequested = false
  private isPickerVisible = false
  private isSiteSettingsAttached = false
  private isSiteSettingsVisible = false
  private siteSettingsSize = { width: 128, height: 50 }
  private pickerQuery = ""
  private isSearchVisible = false
  private searchSuggestionCount = 0
  private pickerCommandCount = 0
  private addressBarBounds: AddressBarBounds | null = null
  private internalPageTransitionId = 0
  private isVisitsAttached = false
  private isVisitsVisible = false
  private visitsLoad: Promise<boolean> | null = null
  private isSavedAttached = false
  private isSavedVisible = false
  private savedLoad: Promise<boolean> | null = null
  private isDownloadsAttached = false
  private isDownloadsVisible = false
  private downloadsLoad: Promise<boolean> | null = null
  private isSettingsAttached = false
  private isSettingsVisible = false
  private settingsLoad: Promise<boolean> | null = null
  private contentRightInset = 0
  private devToolsView: WebContentsView | null = null
  private devToolsTarget: WebContents | null = null

  constructor(
    private readonly window: BrowserWindow,
    private readonly toolbarHeight: number,
    pickerUrl: string,
    private readonly preloadPath: string,
    private readonly rendererUrl: string,
    private readonly visitHistory: VisitHistoryService,
    private readonly tabSessionRepository: TabSessionRepository,
    private readonly recordRecentlyClosed: (page: RecentlyClosedPageInput) => Promise<void>,
    private readonly addBookmark: (site: SavedSiteInput) => Promise<void>,
    private readonly addPinnedSite: (site: PinnedSiteInput) => Promise<void>,
    private readonly onRecommendationContextChanged: () => void,
    private searchEngine: SearchEngine,
  ) {
    this.window.webContents.on("focus", () => {
      if (this.isPickerRequested || this.isPickerVisible) this.hideTabPicker()
    })

    this.pickerView = new WebContentsView({
      webPreferences: {
        preload: preloadPath,
        sandbox: true,
        contextIsolation: true,
      },
    })
    this.pickerView.setBackgroundColor("#00000000")
    this.pickerView.setBorderRadius(10)
    this.pickerView.setVisible(false)
    void this.pickerView.webContents.loadURL(pickerUrl)

    this.siteSettingsView = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
      },
    })
    this.siteSettingsView.setBackgroundColor("#00000000")
    this.siteSettingsView.setBorderRadius(10)
    this.siteSettingsView.setVisible(false)
    this.siteSettingsView.webContents.on("blur", () => this.setSiteSettingsVisible(false))
    void this.siteSettingsView.webContents.loadURL(`${this.rendererUrl}#site-settings`)

    this.visitsView = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
      },
    })
    this.visitsView.setVisible(false)
    this.visitsView.webContents.on("focus", () => {
      this.setTabPickerVisible(false)
      this.sendToToolbar(IPC_CHANNELS.focus)
    })

    this.savedView = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
      },
    })
    this.savedView.setVisible(false)
    this.savedView.webContents.on("focus", () => {
      this.setTabPickerVisible(false)
      this.sendToToolbar(IPC_CHANNELS.focus)
    })

    this.downloadsView = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
      },
    })
    this.downloadsView.setVisible(false)
    this.downloadsView.webContents.on("focus", () => {
      this.setTabPickerVisible(false)
      this.sendToToolbar(IPC_CHANNELS.focus)
    })

    this.settingsView = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        sandbox: true,
        contextIsolation: true,
      },
    })
    this.settingsView.setVisible(false)
    this.settingsView.webContents.on("focus", () => {
      this.setTabPickerVisible(false)
      this.sendToToolbar(IPC_CHANNELS.focus)
    })

    for (const webContents of [
      this.window.webContents,
      this.pickerView.webContents,
      this.siteSettingsView.webContents,
      this.visitsView.webContents,
      this.savedView.webContents,
      this.downloadsView.webContents,
      this.settingsView.webContents,
    ]) {
      this.registerShortcuts(webContents)
    }
  }

  createTab(url = HOME_URL, isGhost = false, active = true): string {
    const shouldActivate = active || this.activeTabId === null
    if (shouldActivate) this.internalPageTransitionId += 1
    const wasVisitsVisible = this.isVisitsVisible
    const wasSavedVisible = this.isSavedVisible
    const wasDownloadsVisible = this.isDownloadsVisible
    const wasSettingsVisible = this.isSettingsVisible
    if (shouldActivate) {
      this.hideVisits()
      this.hideSaved()
      this.hideDownloads()
      this.hideSettings()
    }
    if (url === HOME_URL) {
      const existingBlankTab = [...this.tabs.values()].find(
        (tab) => !tab.url && tab.isGhost === isGhost,
      )
      if (existingBlankTab) {
        if (shouldActivate && existingBlankTab.id !== this.activeTabId) {
          this.activeTab?.view.setVisible(false)
          this.activeTabId = existingBlankTab.id
          existingBlankTab.view.setVisible(false)
          this.resize()
          this.sendUrl("")
          this.sendState()
        } else if (shouldActivate && (wasVisitsVisible || wasSavedVisible || wasDownloadsVisible || wasSettingsVisible)) {
          existingBlankTab.view.setVisible(false)
          this.resize()
          this.sendUrl("")
          this.sendNavigationState()
        }
        return existingBlankTab.id
      }
    }

    const id = String(this.nextTabId++)
    const view = new WebContentsView({
      webPreferences: {
        preload: this.preloadPath,
        additionalArguments: ["--slate-browser-content"],
        nodeIntegrationInSubFrames: true,
        sandbox: true,
        contextIsolation: true,
        ...(isGhost ? { partition: GHOST_PARTITION } : {}),
      },
    })

    if (shouldActivate) this.activeTab?.view.setVisible(false)
    const tab: TabRecord = {
      id,
      title: "New Tab",
      url: this.displayUrl(url),
      faviconUrl: "",
      isGhost,
      isLoading: false,
      isAudible: false,
      isMuted: false,
      isUsingMicrophone: false,
      isMicrophoneMuted: false,
      view,
      microphoneFrameIds: new Set(),
    }
    this.tabs.set(id, tab)
    if (shouldActivate) this.activeTabId = id
    this.window.contentView.addChildView(view)
    this.registerShortcuts(view.webContents)
    view.setVisible(shouldActivate && url !== HOME_URL)
    if (this.isPickerRequested) this.updatePickerVisibility()

    view.webContents.on("focus", () => {
      if (id === this.activeTabId) {
        this.setTabPickerVisible(false)
        this.sendToToolbar(IPC_CHANNELS.focus)
      }
    })
    view.webContents.on(
      "did-start-navigation",
      (_event, nextUrl, _isInPlace, isMainFrame) => {
        if (isMainFrame) {
          this.setMicrophoneState(tab, false)
          this.updateTabUrl(tab, nextUrl)
        }
      },
    )
    view.webContents.on("did-navigate-in-page", (_event, nextUrl, isMainFrame) => {
      if (isMainFrame) {
        this.updateTabUrl(tab, nextUrl)
        this.sendNavigationState()
      }
    })
    view.webContents.on("did-navigate", () => this.sendNavigationState())
    view.webContents.on("did-start-loading", () => {
      tab.isLoading = true
      this.sendState()
    })
    view.webContents.on("did-stop-loading", () => {
      tab.isLoading = false
      this.sendState()
    })
    view.webContents.on("audio-state-changed", ({ audible }) => {
      tab.isAudible = audible
      this.sendState()
    })
    view.webContents.ipc.on(
      BROWSER_CONTENT_CHANNELS.microphoneStateChanged,
      (event, active: unknown) => {
        if (typeof active !== "boolean") return
        const frameId = event.senderFrame?.frameTreeNodeId
        if (frameId === undefined) return
        if (active) tab.microphoneFrameIds.add(frameId)
        else tab.microphoneFrameIds.delete(frameId)
        this.setMicrophoneState(tab, tab.microphoneFrameIds.size > 0)
      },
    )
    view.webContents.on("did-finish-load", () => {
      if (tab.isGhost) return
      void this.visitHistory
        .record(view.webContents.getURL(), view.webContents.getTitle(), tab.faviconUrl)
        .catch((error) => console.error("Failed to record visit", error))
    })
    view.webContents.on("page-title-updated", (_event, title) => {
      tab.title = title || (tab.isGhost ? "Ghost Tab" : "New Tab")
      this.sendState()
    })
    view.webContents.on("page-favicon-updated", (_event, favicons) => {
      tab.faviconUrl = favicons[0] ?? ""
      this.sendState()
      if (tab.isGhost) return
      void this.visitHistory
        .updateFavicon(tab.url, tab.faviconUrl)
        .catch((error) => console.error("Failed to update visit favicon", error))
    })
    view.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
      this.createTab(popupUrl, tab.isGhost)
      return { action: "deny" }
    })

    if (shouldActivate) {
      this.resize()
      this.sendUrl(url)
      this.sendNavigationState()
    }
    this.sendState()
    void view.webContents.loadURL(url)
    if (!tab.isGhost) this.persistSession()
    return id
  }

  createGhostTab(): void {
    this.hideTabPicker()
    this.createTab(HOME_URL, true)
  }

  openVisits(): void {
    const transitionId = ++this.internalPageTransitionId
    this.setTabPickerVisible(false)
    if (!this.isVisitsAttached) {
      this.window.contentView.addChildView(this.visitsView)
      this.isVisitsAttached = true
    }
    const isInitialLoad = this.visitsLoad === null
    this.visitsLoad ??= this.loadInternalPage(this.visitsView, "visits")
    void this.visitsLoad.then((loaded) => {
      if (!loaded) this.visitsLoad = null
      if (!loaded || transitionId !== this.internalPageTransitionId) return
      this.isVisitsVisible = true
      this.resize()
      this.visitsView.setVisible(true)
      this.hideSaved()
      this.hideDownloads()
      this.hideSettings()
      this.activeTab?.view.setVisible(false)
      this.sendUrl(VISITS_URL)
      this.sendNavigationState()
      if (!isInitialLoad) {
        this.visitsView.webContents.send(IPC_CHANNELS.visitsRefreshRequested)
      }
      this.visitsView.webContents.focus()
    })
  }

  openSaved(): void {
    const transitionId = ++this.internalPageTransitionId
    this.setTabPickerVisible(false)
    if (!this.isSavedAttached) {
      this.window.contentView.addChildView(this.savedView)
      this.isSavedAttached = true
    }
    const isInitialLoad = this.savedLoad === null
    this.savedLoad ??= this.loadInternalPage(this.savedView, "saved")
    void this.savedLoad.then((loaded) => {
      if (!loaded) this.savedLoad = null
      if (!loaded || transitionId !== this.internalPageTransitionId) return
      this.isSavedVisible = true
      this.resize()
      this.savedView.setVisible(true)
      this.hideVisits()
      this.hideDownloads()
      this.hideSettings()
      this.activeTab?.view.setVisible(false)
      this.sendUrl(SAVED_URL)
      this.sendNavigationState()
      if (!isInitialLoad) {
        this.savedView.webContents.send(IPC_CHANNELS.savedSitesRefreshRequested)
      }
      this.savedView.webContents.focus()
    })
  }

  openDownloads(): void {
    const transitionId = ++this.internalPageTransitionId
    this.setTabPickerVisible(false)
    if (!this.isDownloadsAttached) {
      this.window.contentView.addChildView(this.downloadsView)
      this.isDownloadsAttached = true
    }
    this.downloadsLoad ??= this.loadInternalPage(this.downloadsView, "downloads")
    void this.downloadsLoad.then((loaded) => {
      if (!loaded) this.downloadsLoad = null
      if (!loaded || transitionId !== this.internalPageTransitionId) return
      this.isDownloadsVisible = true
      this.resize()
      this.downloadsView.setVisible(true)
      this.hideVisits()
      this.hideSaved()
      this.hideSettings()
      this.activeTab?.view.setVisible(false)
      this.sendUrl(DOWNLOADS_URL)
      this.sendNavigationState()
      this.downloadsView.webContents.focus()
    })
  }

  toggleAssistantSidebar(): void {
    this.hideTabPicker()
    this.window.webContents.focus()
    this.sendToToolbar(IPC_CHANNELS.assistantSidebarToggleRequested)
  }

  openSettings(): void {
    const transitionId = ++this.internalPageTransitionId
    this.setTabPickerVisible(false)
    if (!this.isSettingsAttached) {
      this.window.contentView.addChildView(this.settingsView)
      this.isSettingsAttached = true
    }
    this.settingsLoad ??= this.loadInternalPage(this.settingsView, "settings")
    void this.settingsLoad.then((loaded) => {
      if (!loaded) this.settingsLoad = null
      if (!loaded || transitionId !== this.internalPageTransitionId) return
      this.isSettingsVisible = true
      this.resize()
      this.settingsView.setVisible(true)
      this.hideVisits()
      this.hideSaved()
      this.hideDownloads()
      this.activeTab?.view.setVisible(false)
      this.sendUrl(SETTINGS_URL)
      this.sendNavigationState()
      this.settingsView.webContents.focus()
    })
  }

  toggleActiveTabDevTools(): void {
    this.setTabPickerVisible(false)
    const webContents = this.isVisitsVisible
      ? this.visitsView.webContents
      : this.isSavedVisible
        ? this.savedView.webContents
        : this.isDownloadsVisible
          ? this.downloadsView.webContents
          : this.isSettingsVisible
            ? this.settingsView.webContents
            : this.activeTab?.url
              ? this.activeTab.view.webContents
              : this.window.webContents
    if (webContents.isDestroyed()) return
    if (this.devToolsTarget === webContents && webContents.isDevToolsOpened()) {
      webContents.closeDevTools()
      return
    }

    this.closeDevTools()
    const devToolsView = new WebContentsView()
    this.devToolsView = devToolsView
    this.devToolsTarget = webContents
    this.window.contentView.addChildView(devToolsView)
    this.registerShortcuts(devToolsView.webContents)
    webContents.setDevToolsWebContents(devToolsView.webContents)
    webContents.once("devtools-closed", () => {
      if (this.devToolsTarget === webContents) this.closeDevTools(false)
    })
    this.resize()
    webContents.openDevTools({ mode: "detach" })
  }

  setSearchEngine(searchEngine: SearchEngine): void {
    this.searchEngine = searchEngine
  }

  restoreSession(session: TabSession): void {
    const urls = session.urls.length > 0 ? session.urls : [HOME_URL]
    for (const url of urls) this.createTab(url)
    const tab = [...this.tabs.values()][Math.min(Math.max(session.activeIndex, 0), this.tabs.size - 1)]
    if (tab) this.activateTab(tab.id)
  }

  getState(): BrowserTabsState {
    return {
      activeTabId: this.activeTabId,
      isActiveTabGhost: this.activeTab?.isGhost ?? false,
      isActiveTabLoading: this.activeTab?.isLoading ?? false,
      tabs: this.selectableTabs.map(({ id, title, url, faviconUrl, isGhost, isLoading, isAudible, isMuted, isUsingMicrophone, isMicrophoneMuted }) => ({
        id,
        title,
        url,
        faviconUrl,
        isGhost,
        isLoading,
        isAudible,
        isMuted,
        isUsingMicrophone,
        isMicrophoneMuted,
      })),
    }
  }

  getNavigationState(): BrowserNavigationState {
    const isInternalPageVisible = this.isVisitsVisible || this.isSavedVisible || this.isDownloadsVisible || this.isSettingsVisible
    const history = this.activeTab?.view.webContents.navigationHistory
    return {
      canGoBack: isInternalPageVisible || Boolean(history?.canGoBack()),
      canGoForward: !isInternalPageVisible && Boolean(history?.canGoForward()),
    }
  }

  async readActivePage(): Promise<ActivePageContent> {
    const tab = this.activeTab
    if (!tab) throw new Error("Open a webpage before asking the assistant about it.")
    return this.readPage(tab.id)
  }

  async readPage(tabId: string): Promise<ActivePageContent> {
    const tab = this.requireTab(tabId)
    if (!/^https?:\/\//i.test(tab.url)) throw new Error("Only web pages can be read.")

    const pageText = await tab.view.webContents.executeJavaScript(`(() => {
      if (!document.body) return { selectedText: "", text: "", links: [] }
      const blockedSelector = [
        "script",
        "style",
        "noscript",
        "template",
        "input",
        "textarea",
        "select",
        "[contenteditable='true']",
        "[aria-hidden='true']"
      ].join(",")
      const chunks = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        const parent = node.parentElement
        const value = node.textContent?.replace(/\\s+/g, " ").trim()
        if (!parent || !value || parent.closest(blockedSelector)) continue
        const style = getComputedStyle(parent)
        if (style.display === "none" || style.visibility === "hidden") continue
        chunks.push(value)
      }
      return {
        selectedText: window.getSelection()?.toString().replace(/\\s+/g, " ").trim() ?? "",
        text: chunks.join("\\n"),
        links: Array.from(document.querySelectorAll("a[href]"))
          .filter((link) => {
            const style = getComputedStyle(link)
            return style.display !== "none" && style.visibility !== "hidden"
          })
          .slice(0, 200)
          .map((link) => ({
            text: link.textContent?.replace(/\\s+/g, " ").trim().slice(0, 200) ?? "",
            url: link.href
          }))
          .filter((link) => link.text && /^https?:\\/\\//i.test(link.url))
      }
    })()`, true) as unknown

    if (!pageText || typeof pageText !== "object") {
      throw new Error("The page did not return readable content.")
    }
    const { selectedText, text, links } = pageText as {
      selectedText?: unknown
      text?: unknown
      links?: unknown
    }
    if (typeof selectedText !== "string" || typeof text !== "string" || !Array.isArray(links)) {
      throw new Error("The page did not return readable content.")
    }
    return {
      tabId: tab.id,
      title: tab.view.webContents.getTitle() || tab.title,
      url: tab.view.webContents.getURL(),
      selectedText: selectedText.slice(0, MAX_PAGE_TEXT_LENGTH),
      text: text.slice(0, MAX_PAGE_TEXT_LENGTH),
      links: links.filter(isPageLink),
      truncated: selectedText.length > MAX_PAGE_TEXT_LENGTH || text.length > MAX_PAGE_TEXT_LENGTH,
    }
  }

  getAgentTabs(): BrowserTab[] {
    return this.getState().tabs
  }

  getActiveAgentTab(): BrowserTab | null {
    const state = this.getState()
    return state.tabs.find((tab) => tab.id === state.activeTabId) ?? null
  }

  openAgentTab(value: string, active = true): BrowserTab {
    const tabId = this.openTab(normalizeHttpUrl(value), active)
    return this.toPublicTab(this.requireTab(tabId))
  }

  openTab(url: string, active = true): string {
    const tabId = this.createTab(url, false, active)
    if (!active) this.sendAddressBarFeedback("tab-opened-background")
    return tabId
  }

  searchWeb(query: string): BrowserTab {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) throw new Error("A search query is required.")
    const searchUrls: Record<SearchEngine, string> = {
      google: "https://www.google.com/search?q=",
      bing: "https://www.bing.com/search?q=",
      duckduckgo: "https://duckduckgo.com/?q=",
      brave: "https://search.brave.com/search?q=",
    }
    return this.openAgentTab(`${searchUrls[this.searchEngine]}${encodeURIComponent(normalizedQuery)}`)
  }

  activateAgentTab(tabId: string): BrowserTab {
    this.requireTab(tabId)
    this.activateTab(tabId)
    return this.toPublicTab(this.requireTab(tabId))
  }

  async navigateAgentTab(
    tabId: string,
    destination: string,
    signal?: AbortSignal,
  ): Promise<BrowserTab> {
    const tab = this.requireTab(tabId)
    const history = tab.view.webContents.navigationHistory
    if (destination === "back") {
      if (!history.canGoBack()) throw new Error("This tab cannot navigate back.")
      history.goBack()
    } else if (destination === "forward") {
      if (!history.canGoForward()) throw new Error("This tab cannot navigate forward.")
      history.goForward()
    } else {
      await loadUrl(tab.view.webContents, normalizeHttpUrl(destination, tab.url), signal)
    }
    return this.toPublicTab(tab)
  }

  async findInPage(tabId: string, query: string, signal?: AbortSignal): Promise<number> {
    const tab = this.requireTab(tabId)
    const normalizedQuery = query.trim()
    if (!normalizedQuery) throw new Error("A find query is required.")
    return new Promise<number>((resolve, reject) => {
      const requestId = tab.view.webContents.findInPage(normalizedQuery)
      const cleanup = (): void => {
        signal?.removeEventListener("abort", handleAbort)
        tab.view.webContents.removeListener("found-in-page", handleResult)
      }
      const handleAbort = (): void => {
        cleanup()
        tab.view.webContents.stopFindInPage("clearSelection")
        reject(signal?.reason ?? new DOMException("The request was cancelled.", "AbortError"))
      }
      const handleResult = (_event: Event, result: FoundInPageResult): void => {
        if (result.requestId !== requestId || !result.finalUpdate) return
        cleanup()
        resolve(result.matches)
      }
      tab.view.webContents.on("found-in-page", handleResult)
      signal?.addEventListener("abort", handleAbort, { once: true })
      if (signal?.aborted) handleAbort()
    })
  }

  closeAgentTab(tabId: string): BrowserTab {
    const tab = this.toPublicTab(this.requireTab(tabId))
    this.closeTab(tabId)
    return tab
  }

  async saveAgentTab(tabId: string): Promise<BrowserTab> {
    const tab = this.requireTab(tabId)
    if (tab.isGhost || !/^https?:\/\//i.test(tab.url)) {
      throw new Error("Only regular web pages can be saved.")
    }
    await this.addBookmark({ title: tab.title, url: tab.url })
    this.sendAddressBarFeedback("bookmark-saved")
    return this.toPublicTab(tab)
  }

  async pinAgentTab(tabId: string): Promise<BrowserTab> {
    const tab = this.requireTab(tabId)
    if (tab.isGhost || !/^https?:\/\//i.test(tab.url)) {
      throw new Error("Only regular web pages can be pinned.")
    }
    await this.addPinnedSite({
      title: tab.title,
      url: tab.url,
      faviconUrl: tab.faviconUrl,
    })
    this.sendAddressBarFeedback("site-pinned")
    return this.toPublicTab(tab)
  }

  downloadFromTab(tabId: string, value: string): BrowserTab {
    const tab = this.requireTab(tabId)
    const url = normalizeHttpUrl(value, tab.url)
    tab.view.webContents.downloadURL(url)
    return this.toPublicTab(tab)
  }

  ownsWebContents(webContents: WebContents): boolean {
    return webContents === this.window.webContents
      || webContents === this.pickerView.webContents
      || webContents === this.siteSettingsView.webContents
      || webContents === this.visitsView.webContents
      || webContents === this.savedView.webContents
      || webContents === this.downloadsView.webContents
      || [...this.tabs.values()].some((tab) => tab.view.webContents === webContents)
  }

  handleDownloadStarted(webContents: WebContents, downloadUrl: string): void {
    const tab = [...this.tabs.values()].find((item) => item.view.webContents === webContents)
    if (!tab || tab.url !== this.displayUrl(downloadUrl)) return

    tab.url = ""
    tab.title = tab.isGhost ? "Ghost Tab" : "New Tab"
    tab.faviconUrl = ""
    tab.view.setVisible(false)
    if (tab.id === this.activeTabId) {
      this.sendUrl("")
      this.sendNavigationState()
    }
    this.sendState()
    if (!tab.isGhost) this.persistSession()
    this.onRecommendationContextChanged()
  }

  activateTab(tabId: string): void {
    const nextTab = this.tabs.get(tabId)
    if (!nextTab) return

    this.internalPageTransitionId += 1
    this.setTabPickerVisible(false)
    this.sendToToolbar(IPC_CHANNELS.focus)
    if (tabId === this.activeTabId && !this.isVisitsVisible && !this.isSavedVisible && !this.isDownloadsVisible && !this.isSettingsVisible) return

    const previousView = this.activeTab?.view
    this.activeTabId = tabId
    this.resize()
    nextTab.view.setVisible(Boolean(nextTab.url))
    this.hideVisits()
    this.hideSaved()
    this.hideDownloads()
    this.hideSettings()
    if (previousView !== nextTab.view) previousView?.setVisible(false)
    this.sendUrl(nextTab.view.webContents.getURL())
    this.sendState()
    this.sendNavigationState()
    nextTab.view.webContents.focus()
    this.persistSession()
  }

  cycleTab(direction: 1 | -1): void {
    const tabs = this.selectableTabs
    if (tabs.length < 2) return

    const currentIndex = tabs.findIndex((tab) => tab.id === this.activeTabId)
    const nextIndex = currentIndex === -1
      ? direction === 1 ? 0 : tabs.length - 1
      : (currentIndex + direction + tabs.length) % tabs.length
    this.activateTab(tabs[nextIndex].id)
  }

  setTabMuted(tabId: string, muted: boolean): void {
    const tab = this.tabs.get(tabId)
    if (!tab || tab.isMuted === muted) return

    tab.isMuted = muted
    tab.view.webContents.setAudioMuted(muted)
    this.sendState()
  }

  setTabMicrophoneMuted(tabId: string, muted: boolean): void {
    const tab = this.tabs.get(tabId)
    if (!tab || !tab.isUsingMicrophone || tab.isMicrophoneMuted === muted) return

    tab.isMicrophoneMuted = muted
    for (const frame of tab.view.webContents.mainFrame.framesInSubtree) {
      if (!frame.detached) frame.send(BROWSER_CONTENT_CHANNELS.setMicrophoneMuted, muted)
    }
    this.sendState()
  }

  closeTab(tabId: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return

    this.internalPageTransitionId += 1
    if (!tab.isGhost && tab.url) {
      void this.recordRecentlyClosed(tab).catch((error) => {
        console.error("Failed to record recently closed page", error)
      })
    }

    const wasActive = tabId === this.activeTabId
    this.window.contentView.removeChildView(tab.view)
    tab.view.webContents.close()
    this.tabs.delete(tabId)

    if (wasActive) {
      const nextTab = this.tabs.values().next().value as TabRecord | undefined
      this.activeTabId = nextTab?.id ?? null
      nextTab?.view.setVisible(Boolean(nextTab.url) && !this.isVisitsVisible && !this.isSavedVisible && !this.isDownloadsVisible && !this.isSettingsVisible)
      if (nextTab) {
        this.sendUrl(nextTab.view.webContents.getURL())
        this.sendNavigationState()
      }
    }

    if (this.tabs.size === 0) this.createTab()
    else this.sendState()
    this.updatePickerVisibility()
    this.persistSession()
    this.onRecommendationContextChanged()
  }

  setTabPickerVisible(visible: boolean): void {
    if (visible) this.setSiteSettingsVisible(false)
    this.isPickerRequested = visible
    this.updatePickerVisibility()
  }

  setAddressBarBounds(bounds: AddressBarBounds): void {
    if (
      !bounds
      || !Number.isFinite(bounds.x)
      || !Number.isFinite(bounds.y)
      || !Number.isFinite(bounds.width)
      || !Number.isFinite(bounds.height)
      || bounds.width <= 0
      || bounds.height <= 0
    ) return
    this.addressBarBounds = {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    }
    if (this.isPickerVisible) this.resizePicker()
    if (this.isSiteSettingsVisible) this.resizeSiteSettings()
  }

  setSiteSettingsVisible(visible: boolean): void {
    if (visible) {
      this.isPickerRequested = false
      this.updatePickerVisibility()
      if (this.isSiteSettingsAttached) {
        this.window.contentView.removeChildView(this.siteSettingsView)
      }
      this.window.contentView.addChildView(this.siteSettingsView)
      this.isSiteSettingsAttached = true
      this.resizeSiteSettings()
      this.siteSettingsView.webContents.send(IPC_CHANNELS.siteSettingsOpened)
      this.siteSettingsView.webContents.focus()
    }

    this.isSiteSettingsVisible = visible
    this.siteSettingsView.setVisible(visible)
    this.sendToToolbar(IPC_CHANNELS.siteSettingsVisibilityChanged, visible)
  }

  setSiteSettingsSize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return
    this.siteSettingsSize = {
      width: Math.max(1, Math.min(320, Math.ceil(width))),
      height: Math.max(1, Math.min(200, Math.ceil(height))),
    }
    if (this.isSiteSettingsVisible) this.resizeSiteSettings()
  }

  dismissTabPicker(): void {
    this.setTabPickerVisible(false)
    this.activeTab?.view.webContents.focus()
  }

  hideTabPicker(): void {
    this.setTabPickerVisible(false)
    this.sendToToolbar(IPC_CHANNELS.focus)
  }

  setTabPickerQuery(query: string, showSearch: boolean): void {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    this.searchSuggestionCount = 0
    this.pickerQuery = normalizedQuery
    this.isSearchVisible = showSearch
    this.pickerView.webContents.send(IPC_CHANNELS.tabPickerQueryChanged, query)
    if (this.isPickerVisible) this.resizePicker()
    if (this.isSiteSettingsVisible) this.resizeSiteSettings()
  }

  setSearchSuggestionCount(query: string, count: number): void {
    if (!this.isSearchVisible || query.trim().toLocaleLowerCase() !== this.pickerQuery) return

    this.searchSuggestionCount = count
    if (this.isPickerVisible) this.resizePicker()
  }

  setTabPickerCommandCount(count: number): void {
    if (!Number.isFinite(count)) return
    this.pickerCommandCount = Math.max(0, Math.floor(count))
    if (this.isPickerVisible && this.pickerQuery.startsWith(">")) this.resizePicker()
  }

  resize(): void {
    const activeView = this.activeTab?.view
    const [width, height] = this.window.getContentSize()
    const devToolsWidth = this.getDevToolsWidth(width)
    const contentBounds = {
      x: 0,
      y: this.toolbarHeight,
      width: Math.max(0, width - this.contentRightInset - devToolsWidth),
      height: Math.max(0, height - this.toolbarHeight),
    }
    activeView?.setBounds(contentBounds)
    if (this.isVisitsVisible) this.visitsView.setBounds(contentBounds)
    if (this.isSavedVisible) this.savedView.setBounds(contentBounds)
    if (this.isDownloadsVisible) this.downloadsView.setBounds(contentBounds)
    if (this.isSettingsVisible) this.settingsView.setBounds(contentBounds)
    this.devToolsView?.setBounds({
      x: width - devToolsWidth,
      y: this.toolbarHeight,
      width: devToolsWidth,
      height: Math.max(0, height - this.toolbarHeight),
    })
    this.sendToToolbar(IPC_CHANNELS.devToolsWidthChanged, devToolsWidth)
    if (this.isPickerVisible) this.resizePicker()
  }

  setContentRightInset(width: number): void {
    if (!Number.isFinite(width)) return
    this.contentRightInset = Math.max(0, Math.round(width))
    this.resize()
  }

  navigate(value: string): void {
    const url = getNavigationUrl(value, this.searchEngine)
    if (!url) return

    this.internalPageTransitionId += 1
    this.dismissTabPicker()
    if (this.isVisitsVisible || this.isSavedVisible || this.isDownloadsVisible || this.isSettingsVisible) this.createTab(url)
    else {
      this.activeTab?.view.setVisible(true)
      void this.activeTab?.view.webContents.loadURL(url)
    }
  }

  back(): void {
    this.internalPageTransitionId += 1
    if (this.isVisitsVisible) {
      this.hideVisits()
      this.activeTab?.view.setVisible(true)
      this.resize()
      this.sendUrl(this.activeTab?.url ?? "")
      this.sendNavigationState()
      this.activeTab?.view.webContents.focus()
      return
    }
    if (this.isSavedVisible) {
      this.hideSaved()
      this.activeTab?.view.setVisible(true)
      this.resize()
      this.sendUrl(this.activeTab?.url ?? "")
      this.sendNavigationState()
      this.activeTab?.view.webContents.focus()
      return
    }
    if (this.isDownloadsVisible) {
      this.hideDownloads()
      this.activeTab?.view.setVisible(true)
      this.resize()
      this.sendUrl(this.activeTab?.url ?? "")
      this.sendNavigationState()
      this.activeTab?.view.webContents.focus()
      return
    }
    if (this.isSettingsVisible) {
      this.hideSettings()
      this.activeTab?.view.setVisible(true)
      this.resize()
      this.sendUrl(this.activeTab?.url ?? "")
      this.sendNavigationState()
      this.activeTab?.view.webContents.focus()
      return
    }
    const history = this.activeTab?.view.webContents.navigationHistory
    if (history?.canGoBack()) history.goBack()
  }

  forward(): void {
    const history = this.activeTab?.view.webContents.navigationHistory
    if (history?.canGoForward()) history.goForward()
  }

  reload(): void {
    if (this.isVisitsVisible) {
      this.visitsView.webContents.reload()
      return
    }
    if (this.isSavedVisible) {
      this.savedView.webContents.reload()
      return
    }
    if (this.isDownloadsVisible) {
      this.downloadsView.webContents.reload()
      return
    }
    if (this.isSettingsVisible) {
      this.settingsView.webContents.reload()
      return
    }
    const webContents = this.activeTab?.view.webContents
    if (!webContents) return
    this.sendUrl(webContents.getURL())
    webContents.reload()
  }

  stop(): void {
    this.activeTab?.view.webContents.stop()
  }

  dispose(): void {
    this.closeDevTools()
    if (!this.pickerView.webContents.isDestroyed()) this.pickerView.webContents.close()
    if (!this.siteSettingsView.webContents.isDestroyed()) this.siteSettingsView.webContents.close()
    if (!this.visitsView.webContents.isDestroyed()) this.visitsView.webContents.close()
    if (!this.savedView.webContents.isDestroyed()) this.savedView.webContents.close()
    if (!this.downloadsView.webContents.isDestroyed()) this.downloadsView.webContents.close()
    if (!this.settingsView.webContents.isDestroyed()) this.settingsView.webContents.close()
    for (const { view } of this.tabs.values()) {
      if (!view.webContents.isDestroyed()) view.webContents.close()
    }
    this.tabs.clear()
    this.activeTabId = null
  }

  private getDevToolsWidth(windowWidth: number): number {
    if (!this.devToolsView) return 0
    return Math.min(
      MAX_DEV_TOOLS_WIDTH,
      Math.max(MIN_DEV_TOOLS_WIDTH, Math.round(windowWidth * DEV_TOOLS_WIDTH_RATIO)),
    )
  }

  private closeDevTools(closeTarget = true): void {
    const target = this.devToolsTarget
    const view = this.devToolsView
    this.devToolsTarget = null
    this.devToolsView = null
    if (closeTarget && target && !target.isDestroyed() && target.isDevToolsOpened()) {
      target.closeDevTools()
    }
    if (view) {
      this.window.contentView.removeChildView(view)
      if (!view.webContents.isDestroyed()) view.webContents.close()
    }
    this.resize()
  }

  private get activeTab(): TabRecord | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined
  }

  private requireTab(tabId: string): TabRecord {
    const tab = this.tabs.get(tabId)
    if (!tab) throw new Error(`Tab ${tabId} does not exist.`)
    return tab
  }

  private toPublicTab(tab: TabRecord): BrowserTab {
    const { id, title, url, faviconUrl, isGhost, isLoading, isAudible, isMuted, isUsingMicrophone, isMicrophoneMuted } = tab
    return { id, title, url, faviconUrl, isGhost, isLoading, isAudible, isMuted, isUsingMicrophone, isMicrophoneMuted }
  }

  private setMicrophoneState(tab: TabRecord, active: boolean): void {
    const changed = tab.isUsingMicrophone !== active || (!active && tab.isMicrophoneMuted)
    if (!active) {
      tab.microphoneFrameIds.clear()
      tab.isMicrophoneMuted = false
    }
    if (!changed) return
    tab.isUsingMicrophone = active
    this.sendState()
  }

  private registerShortcuts(webContents: WebContents): void {
    webContents.on("before-input-event", (event, input) => {
      const key = input.key.toLocaleLowerCase()
      if (input.type !== "keyDown") return

      const commandOrControl = process.platform === "darwin" ? input.meta : input.control
      const hasNoModifiers = !input.meta && !input.control && !input.alt && !input.shift
      const isCommand = commandOrControl
        && !input.alt
        && (process.platform === "darwin" ? !input.control : !input.meta)

      if (hasNoModifiers && key === "f12") {
        event.preventDefault()
        this.toggleActiveTabDevTools()
        return
      }

      if (input.control && !input.meta && !input.alt && key === "tab") {
        event.preventDefault()
        this.cycleTab(input.shift ? -1 : 1)
        return
      }

      if (!isCommand) return

      const action = input.shift
        ? {
            i: () => this.toggleAssistantSidebar(),
            p: () => this.openTabPicker("> "),
            t: () => this.createGhostTab(),
          }[key]
        : {
            y: () => this.openVisits(),
            b: () => this.openSaved(),
            d: () => this.bookmarkActiveTab(),
            j: () => this.openDownloads(),
            ",": () => this.openSettings(),
            p: () => this.openTabPicker(),
            t: () => this.createTab(),
            w: () => {
              if (this.activeTabId) this.closeTab(this.activeTabId)
            },
          }[key]

      if (!action) return
      event.preventDefault()
      action()
    })
  }

  private openTabPicker(query = ""): void {
    this.setTabPickerQuery(query, Boolean(query))
    this.setTabPickerVisible(true)
  }

  private async loadInternalPage(view: WebContentsView, hash: string): Promise<boolean> {
    try {
      await view.webContents.loadURL(`${this.rendererUrl}#${hash}`)
      return true
    } catch (error) {
      console.error(`Failed to load internal page ${hash}`, error)
      return false
    }
  }

  private bookmarkActiveTab(): void {
    const tab = this.activeTab
    if (!tab || tab.isGhost || !/^https?:\/\//i.test(tab.url)) return

    void this.addBookmark({ title: tab.title, url: tab.url })
      .then(() => this.sendAddressBarFeedback("bookmark-saved"))
      .catch((error) => {
        console.error("Failed to bookmark active tab", error)
      })
  }

  private hideVisits(): void {
    if (!this.isVisitsVisible) return
    this.isVisitsVisible = false
    this.visitsView.setVisible(false)
  }

  private hideSaved(): void {
    if (!this.isSavedVisible) return
    this.isSavedVisible = false
    this.savedView.setVisible(false)
  }

  private hideDownloads(): void {
    if (!this.isDownloadsVisible) return
    this.isDownloadsVisible = false
    this.downloadsView.setVisible(false)
  }

  sendDownloadsChanged(downloads: DownloadRecord[]): void {
    if (this.isDownloadsAttached && !this.downloadsView.webContents.isDestroyed()) {
      this.downloadsView.webContents.send(IPC_CHANNELS.downloadsChanged, downloads)
    }
  }

  sendPinnedSitesChanged(sites: PinnedSite[]): void {
    this.sendToToolbar(IPC_CHANNELS.pinnedSitesChanged, sites)
  }

  sendRecentlyClosedChanged(pages: RecentlyClosedPage[]): void {
    this.sendToToolbar(IPC_CHANNELS.recentlyClosedChanged, pages)
  }

  sendNextUpRecommendationsChanged(items: NextUpRecommendation[]): void {
    this.sendToToolbar(IPC_CHANNELS.nextUpRecommendationsChanged, items)
  }

  sendAddressBarFeedback(feedback: AddressBarFeedback): void {
    this.sendToToolbar(IPC_CHANNELS.addressBarFeedback, feedback)
  }

  private hideSettings(): void {
    if (!this.isSettingsVisible) return
    this.isSettingsVisible = false
    this.settingsView.setVisible(false)
  }

  private persistSession(): void {
    const tabs = [...this.tabs.values()].filter((tab) => !tab.isGhost)
    const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === this.activeTabId))
    void this.tabSessionRepository.update({
      urls: tabs.map((tab) => tab.url || HOME_URL),
      activeIndex,
    }).catch((error) => console.error("Failed to save tab session", error))
  }

  private resizePicker(): void {
    const [windowWidth, windowHeight] = this.window.getContentSize()
    const fallbackWidth = Math.min(640, Math.max(240, windowWidth - 408))
    const pickerBounds = this.addressBarBounds ?? {
      x: Math.round((windowWidth - fallbackWidth) / 2),
      y: 6,
      width: fallbackWidth,
      height: 32,
    }
    const isCommandMode = this.pickerQuery.startsWith(">")
    const hasSearchGroup = !isCommandMode && this.isSearchVisible && Boolean(this.pickerQuery)
    const searchItemCount = this.searchSuggestionCount + (hasSearchGroup ? 1 : 0)
    const commandGroupHeight = this.pickerCommandCount > 0
      ? 36 + this.pickerCommandCount * 32
      : 0
    const searchGroupHeight = isCommandMode
      ? commandGroupHeight
      : hasSearchGroup ? 36 + searchItemCount * 32 : 0
    const tabsGroupHeight = !isCommandMode && this.matchingTabCount > 0 ? 36 + this.matchingTabCount * 40 : 0
    const separatorHeight = hasSearchGroup && this.matchingTabCount > 0 ? 1 : 0
    const contentHeight = 46 + searchGroupHeight + separatorHeight + tabsGroupHeight
    const height = Math.min(520, windowHeight - 12, Math.max(120, contentHeight))
    this.pickerView.setBounds({
      x: pickerBounds.x,
      y: pickerBounds.y,
      width: pickerBounds.width,
      height,
    })
  }

  private resizeSiteSettings(): void {
    const [windowWidth] = this.window.getContentSize()
    const centerColumnWidth = Math.min(640, Math.max(240, windowWidth - 408))
    const addressRight = this.addressBarBounds
      ? this.addressBarBounds.x + this.addressBarBounds.width
      : (windowWidth + centerColumnWidth) / 2
    this.siteSettingsView.setBounds({
      x: Math.round(addressRight - this.siteSettingsSize.width),
      y: this.toolbarHeight - 4,
      ...this.siteSettingsSize,
    })
  }

  private updatePickerVisibility(): void {
    const visible = this.isPickerRequested
    const isOpening = visible && !this.isPickerVisible
    if (visible) {
      if (this.isPickerAttached) this.window.contentView.removeChildView(this.pickerView)
      this.window.contentView.addChildView(this.pickerView)
      this.isPickerAttached = true
      this.resizePicker()
      if (isOpening) {
        this.pickerView.webContents.focus()
        this.pickerView.webContents.send(IPC_CHANNELS.tabPickerOpened)
      }
    }

    this.isPickerVisible = visible
    this.pickerView.setVisible(visible)
  }

  private get matchingTabCount(): number {
    if (this.pickerQuery.startsWith(">")) return 0
    const otherTabs = this.selectableTabs.filter((tab) => tab.id !== this.activeTabId)
    if (!this.isSearchVisible || !this.pickerQuery) return otherTabs.length
    return otherTabs.filter((tab) =>
      `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(this.pickerQuery),
    ).length
  }

  private get selectableTabs(): TabRecord[] {
    return [...this.tabs.values()].filter((tab) => Boolean(tab.url) && tab.title !== "New Tab")
  }

  private updateTabUrl(tab: TabRecord, url: string): void {
    tab.url = this.displayUrl(url)
    if (tab.id === this.activeTabId) {
      const isInternalPageVisible = this.isVisitsVisible
        || this.isSavedVisible
        || this.isDownloadsVisible
        || this.isSettingsVisible
      tab.view.setVisible(Boolean(tab.url) && !isInternalPageVisible)
    }
    if (tab.id === this.activeTabId) this.sendUrl(url)
    this.sendState()
    if (!tab.isGhost) this.persistSession()
    this.onRecommendationContextChanged()
  }

  private displayUrl(url: string): string {
    return url === HOME_URL ? "" : url
  }

  private sendUrl(url: string): void {
    this.sendToToolbar(IPC_CHANNELS.urlChanged, this.displayUrl(url))
  }

  private sendState(): void {
    const state = this.getState()
    this.sendToToolbar(IPC_CHANNELS.tabsChanged, state)
    if (!this.pickerView.webContents.isDestroyed()) {
      this.pickerView.webContents.send(IPC_CHANNELS.tabsChanged, state)
    }
  }

  private sendNavigationState(): void {
    this.sendToToolbar(IPC_CHANNELS.navigationStateChanged, this.getNavigationState())
  }

  private sendToToolbar(channel: string, ...args: unknown[]): void {
    if (!this.window.isDestroyed()) this.window.webContents.send(channel, ...args)
  }
}