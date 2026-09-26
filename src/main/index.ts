import { join } from "node:path"
import { release } from "node:os"
import { pathToFileURL } from "node:url"
import { app, BrowserWindow, ipcMain, session, type DownloadItem, type WebContents } from "electron"
import { IPC_CHANNELS, type NextUpRecommendation } from "../shared/electron-api"
import {
  BrowserTabs,
  GHOST_PARTITION,
  JsonTabSessionRepository,
  type TabSessionRepository,
} from "./features/browser-tabs"
import {
  JsonPinnedSitesRepository,
  PinnedSitesService,
  registerPinnedSitesIpc,
} from "./features/pinned-sites"
import {
  JsonRecentlyClosedRepository,
  RecentlyClosedService,
  registerRecentlyClosedIpc,
} from "./features/recently-closed"
import {
  JsonNextUpDismissalRepository,
  NextUpService,
  registerNextUpIpc,
} from "./features/next-up"
import {
  HttpSearchSuggestionProvider,
  SearchSuggestionService,
  registerSearchSuggestionIpc,
} from "./features/search-suggestions"
import {
  JsonVisitHistoryRepository,
  VisitHistoryService,
  registerVisitsIpc,
} from "./features/visits"
import {
  JsonSavedSitesRepository,
  SavedSitesService,
  registerSavedSitesIpc,
} from "./features/saved-sites"
import {
  DownloadService,
  ElectronDownloadRepository,
  registerDownloadsIpc,
} from "./features/downloads"
import {
  BrowserSettingsService,
  JsonBrowserSettingsRepository,
  registerBrowserSettingsIpc,
} from "./features/browser-settings"
import {
  AiModelService,
  EncryptedAiModelRepository,
  registerAiModelIpc,
} from "./features/ai-models"
import {
  BugReportService,
  ElectronExternalUrlOpener,
  registerBugReportIpc,
} from "./features/bug-reporting"
import { testAiConnection } from "./ai-client"
import { runAiAgent } from "./ai-agent"
import type { AiChatMessage, AiMessageEvent } from "../shared/electron-api"

const TOOLBAR_HEIGHT = 44
const tabsByWindow = new Map<number, BrowserTabs>()
const aiRequests = new Map<string, AbortController>()
let visitHistory: VisitHistoryService
let browserSettings: BrowserSettingsService
let tabSession: TabSessionRepository
let savedSites: SavedSitesService
let pinnedSitesService: PinnedSitesService
let recentlyClosedService: RecentlyClosedService
let nextUpService: NextUpService
let searchSuggestionService: SearchSuggestionService
let downloadRepository: ElectronDownloadRepository
let downloadService: DownloadService
let aiModels: AiModelService

async function getNextUpForTabs(tabs?: BrowserTabs): Promise<NextUpRecommendation[]> {
  const openUrls = tabs?.getState().tabs.map((tab) => tab.url) ?? []
  return nextUpService.getRecommendations({ openUrls })
}

async function sendNextUpRecommendationsChanged(): Promise<void> {
  for (const tabs of tabsByWindow.values()) {
    tabs.sendNextUpRecommendationsChanged(await getNextUpForTabs(tabs))
  }
}

async function sendPinnedSitesChanged(): Promise<void> {
  const sites = await pinnedSitesService.list()
  for (const tabs of tabsByWindow.values()) tabs.sendPinnedSitesChanged(sites)
  await sendNextUpRecommendationsChanged()
}

async function sendRecentlyClosedChanged(): Promise<void> {
  const pages = await recentlyClosedService.list()
  for (const tabs of tabsByWindow.values()) tabs.sendRecentlyClosedChanged(pages)
  await sendNextUpRecommendationsChanged()
}

async function sendAiSettingsChanged(): Promise<void> {
  const settings = await aiModels.get()
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.aiSettingsChanged, settings)
  }
}

function getTabs(event: { sender: WebContents }): BrowserTabs | undefined {
  const window = BrowserWindow.fromWebContents(event.sender)
  const windowTabs = window ? tabsByWindow.get(window.id) : undefined
  return windowTabs ?? [...tabsByWindow.values()].find((tabs) => tabs.ownsWebContents(event.sender))
}

function trackDownload(item: DownloadItem, webContents: WebContents): void {
  downloadRepository.track(item)
  getTabs({ sender: webContents })?.handleDownloadStarted(webContents, item.getURL())
}

async function createWindow(): Promise<void> {
  const preloadPath = join(__dirname, "preload.js")
  const rendererFile = join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
  const rendererUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? pathToFileURL(rendererFile).toString()
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 15 },
    backgroundColor: "#f5f5f4",
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
      contextIsolation: true,
    },
  })

  const tabs = new BrowserTabs(
    window,
    TOOLBAR_HEIGHT,
    `${rendererUrl}#tab-picker`,
    preloadPath,
    rendererUrl,
    visitHistory,
    tabSession,
    async (page) => {
      await recentlyClosedService.record(page)
      await sendRecentlyClosedChanged()
    },
    async (site) => {
      const normalizedUrl = new URL(site.url).toString()
      const existingSite = (await savedSites.list()).find((savedSite) =>
        savedSite.url === normalizedUrl,
      )
      if (!existingSite) await savedSites.create(site)
    },
    async (site) => {
      await pinnedSitesService.create(site)
      await sendPinnedSitesChanged()
    },
    () => void sendNextUpRecommendationsChanged(),
    (await browserSettings.get()).searchEngine,
  )
  tabsByWindow.set(window.id, tabs)
  const settings = await browserSettings.get()
  if (settings.reopenTabsOnStartup) {
    const [storedSession, downloads] = await Promise.all([
      tabSession.get(),
      downloadRepository.list(),
    ])
    const downloadUrls = new Set(downloads.map((download) => download.url))
    tabs.restoreSession({
      ...storedSession,
      urls: storedSession.urls.filter((url) => !downloadUrls.has(url)),
    })
  } else tabs.createTab()
  window.on("resize", () => tabs.resize())
  window.on("blur", () => tabs.hideTabPicker())

  window.once("ready-to-show", () => window.show())

  void window.loadURL(rendererUrl)

  window.on("closed", () => {
    tabs.dispose()
    tabsByWindow.delete(window.id)
  })
}

app.whenReady().then(async () => {
  visitHistory = new VisitHistoryService(
    new JsonVisitHistoryRepository(
      join(app.getPath("userData"), "visits.json"),
      () => void sendNextUpRecommendationsChanged(),
    ),
  )
  browserSettings = new BrowserSettingsService(
    new JsonBrowserSettingsRepository(join(app.getPath("userData"), "settings.json")),
  )
  searchSuggestionService = new SearchSuggestionService(
    browserSettings,
    new HttpSearchSuggestionProvider(),
    visitHistory,
  )
  aiModels = new AiModelService(
    new EncryptedAiModelRepository(join(app.getPath("userData"), "ai-models.json")),
    testAiConnection,
    sendAiSettingsChanged,
  )
  tabSession = new JsonTabSessionRepository(join(app.getPath("userData"), "tab-session.json"))
  savedSites = new SavedSitesService(
    new JsonSavedSitesRepository(join(app.getPath("userData"), "saved-sites.json")),
  )
  pinnedSitesService = new PinnedSitesService(
    new JsonPinnedSitesRepository(join(app.getPath("userData"), "pinned-sites.json")),
  )
  recentlyClosedService = new RecentlyClosedService(
    new JsonRecentlyClosedRepository(join(app.getPath("userData"), "recently-closed.json")),
  )
  nextUpService = new NextUpService({
    visits: visitHistory,
    pinnedSites: pinnedSitesService,
    recentlyClosed: recentlyClosedService,
    dismissals: new JsonNextUpDismissalRepository(
      join(app.getPath("userData"), "next-up-dismissals.json"),
    ),
  })
  downloadRepository = new ElectronDownloadRepository(
    join(app.getPath("userData"), "downloads.json"),
    app.getPath("downloads"),
    (downloads) => {
      for (const tabs of tabsByWindow.values()) tabs.sendDownloadsChanged(downloads)
    },
  )
  downloadService = new DownloadService(downloadRepository)
  await downloadService.list()
  session.defaultSession.on("will-download", (_event, item, webContents) =>
    trackDownload(item, webContents),
  )
  session.fromPartition(GHOST_PARTITION).on("will-download", (_event, item, webContents) =>
    trackDownload(item, webContents),
  )
  ipcMain.on(IPC_CHANNELS.toggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.on(IPC_CHANNELS.newTab, (event) => getTabs(event)?.createTab())
  ipcMain.on(IPC_CHANNELS.newGhostTab, (event) => getTabs(event)?.createGhostTab())
  ipcMain.on(IPC_CHANNELS.toggleActiveTabDevTools, (event) => {
    getTabs(event)?.toggleActiveTabDevTools()
  })
  ipcMain.on(IPC_CHANNELS.toggleAssistantSidebar, (event) => {
    getTabs(event)?.toggleAssistantSidebar()
  })
  ipcMain.on(IPC_CHANNELS.openUrl, (event, value: unknown) => {
    if (typeof value !== "string" || value.length > 2_000) return
    try {
      const url = new URL(value)
      if (url.protocol === "http:" || url.protocol === "https:") {
        getTabs(event)?.createTab(url.toString())
      }
    } catch {
      return
    }
  })
  ipcMain.handle(
    IPC_CHANNELS.getTabs,
    (event) => getTabs(event)?.getState() ?? {
      activeTabId: null,
      isActiveTabGhost: false,
      isActiveTabLoading: false,
      tabs: [],
    },
  )
  ipcMain.handle(
    IPC_CHANNELS.getNavigationState,
    (event) => getTabs(event)?.getNavigationState() ?? { canGoBack: false, canGoForward: false },
  )
  registerVisitsIpc({
    service: visitHistory,
    clearDismissals: () => nextUpService.clearDismissals(),
    openPage: (event) => getTabs(event)?.openVisits(),
  })
  registerSavedSitesIpc({
    service: savedSites,
    openPage: (event) => getTabs(event)?.openSaved(),
    onChanged: (event, feedback) => getTabs(event)?.sendBookmarkFeedback(feedback),
  })
  registerPinnedSitesIpc({
    service: pinnedSitesService,
    onPinnedSitesChanged: sendPinnedSitesChanged,
  })
  registerRecentlyClosedIpc({
    service: recentlyClosedService,
    openPage: (event, url) => getTabs(event)?.createTab(url),
    onRecentlyClosedChanged: sendRecentlyClosedChanged,
  })
  registerNextUpIpc({
    service: nextUpService,
    getOpenUrls: (event) => getTabs(event)?.getState().tabs.map((tab) => tab.url) ?? [],
    onRecommendationsChanged: sendNextUpRecommendationsChanged,
  })
  registerDownloadsIpc({
    service: downloadService,
    openPage: (event) => getTabs(event)?.openDownloads(),
  })
  registerBrowserSettingsIpc({
    service: browserSettings,
    onUpdated: (event, settings) => getTabs(event)?.setSearchEngine(settings.searchEngine),
    openPage: (event) => getTabs(event)?.openSettings(),
  })
  registerAiModelIpc(aiModels)
  registerBugReportIpc(new BugReportService({
    appVersion: app.getVersion(),
    operatingSystem: `${process.platform} ${release()}`,
    externalUrlOpener: new ElectronExternalUrlOpener(),
  }))
  ipcMain.on(IPC_CHANNELS.startAiMessage, (
    event,
    requestId: string,
    messages: AiChatMessage[],
    contextTabIds: string[],
  ) => {
    if (typeof requestId !== "string" || requestId.length > 100) return
    if (
      !Array.isArray(contextTabIds)
      || contextTabIds.length > 100
      || contextTabIds.some((tabId) => typeof tabId !== "string" || tabId.length > 100)
    ) return
    const requestKey = `${event.sender.id}:${requestId}`
    aiRequests.get(requestKey)?.abort()
    const controller = new AbortController()
    aiRequests.set(requestKey, controller)

    const sendEvent = (messageEvent: AiMessageEvent): void => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.aiMessageEvent, messageEvent)
      }
    }

    void (async () => {
      try {
        if (!Array.isArray(messages) || messages.length > 40) {
          throw new Error("The conversation is too long.")
        }
        const tabs = getTabs(event)
        if (!tabs) throw new Error("The browser context is unavailable.")
        const credentials = await aiModels.getActiveCredentials()
        await runAiAgent(
          credentials,
          messages,
          tabs,
          contextTabIds,
          {
            onActivity: (activity) => {
              if (!controller.signal.aborted) {
                sendEvent({ requestId, type: "activity", activity })
              }
            },
            onChunk: (content) => {
              if (content && !controller.signal.aborted) {
                sendEvent({ requestId, type: "chunk", content })
              }
            },
          },
          controller.signal,
        )
        if (!controller.signal.aborted) sendEvent({ requestId, type: "done" })
      } catch (error) {
        if (!controller.signal.aborted) {
          sendEvent({
            requestId,
            type: "error",
            message: error instanceof Error ? error.message : "The AI request failed.",
          })
        }
      } finally {
        if (aiRequests.get(requestKey) === controller) aiRequests.delete(requestKey)
      }
    })()
  })
  ipcMain.on(IPC_CHANNELS.cancelAiMessage, (event, requestId: string) => {
    if (typeof requestId !== "string") return
    aiRequests.get(`${event.sender.id}:${requestId}`)?.abort()
  })
  registerSearchSuggestionIpc({
    service: searchSuggestionService,
    getContext: getTabs,
  })
  ipcMain.on(IPC_CHANNELS.activateTab, (event, tabId: string) => {
    getTabs(event)?.activateTab(tabId)
  })
  ipcMain.on(IPC_CHANNELS.closeTab, (event, tabId: string) => {
    getTabs(event)?.closeTab(tabId)
  })
  ipcMain.on(IPC_CHANNELS.setTabMuted, (event, tabId: string, muted: boolean) => {
    if (typeof tabId !== "string" || typeof muted !== "boolean") return
    getTabs(event)?.setTabMuted(tabId, muted)
  })
  ipcMain.on(IPC_CHANNELS.setTabMicrophoneMuted, (event, tabId: string, muted: boolean) => {
    if (typeof tabId !== "string" || typeof muted !== "boolean") return
    getTabs(event)?.setTabMicrophoneMuted(tabId, muted)
  })
  ipcMain.on(IPC_CHANNELS.setTabPickerVisible, (event, visible: boolean) => {
    getTabs(event)?.setTabPickerVisible(visible)
  })
  ipcMain.on(IPC_CHANNELS.setSiteSettingsVisible, (event, visible: boolean) => {
    getTabs(event)?.setSiteSettingsVisible(visible)
  })
  ipcMain.on(IPC_CHANNELS.setSiteSettingsSize, (event, width: number, height: number) => {
    getTabs(event)?.setSiteSettingsSize(width, height)
  })
  ipcMain.on(IPC_CHANNELS.setContentRightInset, (event, width: number) => {
    getTabs(event)?.setContentRightInset(width)
  })
  ipcMain.on(IPC_CHANNELS.dismissTabPicker, (event) => {
    getTabs(event)?.dismissTabPicker()
  })
  ipcMain.on(IPC_CHANNELS.setTabPickerQuery, (event, query: string, showSearch: boolean) => {
    getTabs(event)?.setTabPickerQuery(query, showSearch)
  })
  ipcMain.on(IPC_CHANNELS.setTabPickerCommandCount, (event, count: number) => {
    getTabs(event)?.setTabPickerCommandCount(count)
  })
  ipcMain.on(IPC_CHANNELS.navigate, (event, value: string) => getTabs(event)?.navigate(value))
  ipcMain.on(IPC_CHANNELS.back, (event) => getTabs(event)?.back())
  ipcMain.on(IPC_CHANNELS.forward, (event) => getTabs(event)?.forward())
  ipcMain.on(IPC_CHANNELS.reload, (event) => getTabs(event)?.reload())
  ipcMain.on(IPC_CHANNELS.stop, (event) => getTabs(event)?.stop())

  void createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})