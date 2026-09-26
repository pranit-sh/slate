import { contextBridge, ipcRenderer } from "electron"
import type {
  AiChatMessage,
  AiMessageEvent,
  AiSettings,
  BookmarkFeedback,
  BrowserNavigationState,
  BrowserSettings,
  BrowserTabsState,
  DownloadRecord,
  ElectronApi,
  NextUpRecommendation,
  PinnedSite,
  PinnedSiteInput,
  RecentlyClosedPage,
  SavedSiteInput,
  SaveAiModelInput,
} from "../shared/electron-api"
import { BROWSER_CONTENT_CHANNELS, IPC_CHANNELS } from "../shared/electron-api"

const isBrowserContentPreload = process.argv.includes("--slate-browser-content")

function installMicrophoneTracking(): void {
  contextBridge.executeInMainWorld({
    func: () => {
      const stateKey = "__slateMicrophoneCaptureState"
      const mainWorld = globalThis as typeof globalThis & {
        [stateKey]?: { tracks: Set<MediaStreamTrack> }
      }
      if (mainWorld[stateKey] || !navigator.mediaDevices?.getUserMedia) return

      const state = { tracks: new Set<MediaStreamTrack>() }
      mainWorld[stateKey] = state
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      const report = (): void => {
        window.postMessage({
          source: "slate-browser-content",
          type: "microphone-state-changed",
          active: state.tracks.size > 0,
        }, "*")
      }

      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await originalGetUserMedia(constraints)
        for (const track of stream.getAudioTracks()) {
          if (state.tracks.has(track)) continue
          state.tracks.add(track)
          const removeTrack = (): void => {
            if (!state.tracks.delete(track)) return
            report()
          }
          track.addEventListener("ended", removeTrack, { once: true })
          const originalStop = track.stop.bind(track)
          track.stop = () => {
            originalStop()
            removeTrack()
          }
        }
        report()
        return stream
      }

      window.addEventListener("pagehide", () => {
        state.tracks.clear()
        report()
      }, { once: true })
    },
  })

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    const message = event.data as { source?: unknown; type?: unknown; active?: unknown }
    if (
      message?.source !== "slate-browser-content"
      || message.type !== "microphone-state-changed"
      || typeof message.active !== "boolean"
    ) return
    ipcRenderer.send(BROWSER_CONTENT_CHANNELS.microphoneStateChanged, message.active)
  })

  ipcRenderer.on(BROWSER_CONTENT_CHANNELS.setMicrophoneMuted, (_event, muted: unknown) => {
    if (typeof muted !== "boolean") return
    contextBridge.executeInMainWorld({
      func: (shouldMute: boolean) => {
        const mainWorld = globalThis as typeof globalThis & {
          __slateMicrophoneCaptureState?: { tracks: Set<MediaStreamTrack> }
        }
        for (const track of mainWorld.__slateMicrophoneCaptureState?.tracks ?? []) {
          track.enabled = !shouldMute
        }
      },
      args: [muted],
    })
  })
}

const electronApi: ElectronApi = {
  platform: process.platform,
  window: {
    toggleMaximize: () => ipcRenderer.send(IPC_CHANNELS.toggleMaximize),
  },
  support: {
    reportBug: () => ipcRenderer.invoke(IPC_CHANNELS.reportBug),
  },
  browser: {
    newTab: () => ipcRenderer.send(IPC_CHANNELS.newTab),
    newGhostTab: () => ipcRenderer.send(IPC_CHANNELS.newGhostTab),
    openUrl: (url: string) => ipcRenderer.send(IPC_CHANNELS.openUrl, url),
    getTabs: () => ipcRenderer.invoke(IPC_CHANNELS.getTabs),
    getNavigationState: () => ipcRenderer.invoke(IPC_CHANNELS.getNavigationState),
    getVisits: () => ipcRenderer.invoke(IPC_CHANNELS.getVisits),
    onVisitsRefreshRequested: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.visitsRefreshRequested, callback)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.visitsRefreshRequested, callback)
    },
    deleteVisit: (day: string, url: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.deleteVisit, day, url),
    clearVisits: () => ipcRenderer.invoke(IPC_CHANNELS.clearVisits),
    getSavedSites: () => ipcRenderer.invoke(IPC_CHANNELS.getSavedSites),
    onSavedSitesRefreshRequested: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.savedSitesRefreshRequested, callback)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.savedSitesRefreshRequested, callback)
    },
    createSavedSite: (site: SavedSiteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.createSavedSite, site),
    updateSavedSite: (id: string, site: SavedSiteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.updateSavedSite, id, site),
    deleteSavedSite: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.deleteSavedSite, id),
    markSavedSiteOpened: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.markSavedSiteOpened, id),
    getPinnedSites: () => ipcRenderer.invoke(IPC_CHANNELS.getPinnedSites),
    createPinnedSite: (site: PinnedSiteInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.createPinnedSite, site),
    deletePinnedSite: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.deletePinnedSite, id),
    getRecentlyClosed: () => ipcRenderer.invoke(IPC_CHANNELS.getRecentlyClosed),
    reopenRecentlyClosed: (id: string) => ipcRenderer.send(IPC_CHANNELS.reopenRecentlyClosed, id),
    getNextUpRecommendations: () => ipcRenderer.invoke(IPC_CHANNELS.getNextUpRecommendations),
    dismissNextUpRecommendation: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.dismissNextUpRecommendation, id),
    getDownloads: () => ipcRenderer.invoke(IPC_CHANNELS.getDownloads),
    openDownload: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.openDownload, id),
    showDownloadInFolder: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.showDownloadInFolder, id),
    copyDownloadLink: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.copyDownloadLink, id),
    cancelDownload: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.cancelDownload, id),
    removeDownload: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.removeDownload, id),
    clearDownloads: () => ipcRenderer.invoke(IPC_CHANNELS.clearDownloads),
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
    updateSettings: (settings: BrowserSettings) =>
      ipcRenderer.invoke(IPC_CHANNELS.updateSettings, settings),
    getAiSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getAiSettings),
    saveAiModel: (model: SaveAiModelInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.saveAiModel, model),
    deleteAiModel: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.deleteAiModel, id),
    setActiveAiModel: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.setActiveAiModel, id),
    testAiModelConnection: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.testAiModelConnection, id),
    startAiMessage: (
      requestId: string,
      messages: AiChatMessage[],
      contextTabIds: string[],
    ) => ipcRenderer.send(IPC_CHANNELS.startAiMessage, requestId, messages, contextTabIds),
    cancelAiMessage: (requestId: string) =>
      ipcRenderer.send(IPC_CHANNELS.cancelAiMessage, requestId),
    onAiMessageEvent: (callback: (event: AiMessageEvent) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, messageEvent: AiMessageEvent) =>
        callback(messageEvent)
      ipcRenderer.on(IPC_CHANNELS.aiMessageEvent, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiMessageEvent, listener)
    },
    onAiSettingsChanged: (callback: (settings: AiSettings) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, settings: AiSettings) => callback(settings)
      ipcRenderer.on(IPC_CHANNELS.aiSettingsChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.aiSettingsChanged, listener)
    },
    getSearchSuggestions: (query: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.getSearchSuggestions, query),
    openVisits: () => ipcRenderer.send(IPC_CHANNELS.openVisits),
    openSaved: () => ipcRenderer.send(IPC_CHANNELS.openSaved),
    openDownloads: () => ipcRenderer.send(IPC_CHANNELS.openDownloads),
    openSettings: () => ipcRenderer.send(IPC_CHANNELS.openSettings),
    toggleAssistantSidebar: () => ipcRenderer.send(IPC_CHANNELS.toggleAssistantSidebar),
    toggleActiveTabDevTools: () => ipcRenderer.send(IPC_CHANNELS.toggleActiveTabDevTools),
    activateTab: (tabId: string) => ipcRenderer.send(IPC_CHANNELS.activateTab, tabId),
    closeTab: (tabId: string) => ipcRenderer.send(IPC_CHANNELS.closeTab, tabId),
    setTabMuted: (tabId: string, muted: boolean) =>
      ipcRenderer.send(IPC_CHANNELS.setTabMuted, tabId, muted),
    setTabMicrophoneMuted: (tabId: string, muted: boolean) =>
      ipcRenderer.send(IPC_CHANNELS.setTabMicrophoneMuted, tabId, muted),
    setTabPickerVisible: (visible: boolean) =>
      ipcRenderer.send(IPC_CHANNELS.setTabPickerVisible, visible),
    setSiteSettingsVisible: (visible: boolean) =>
      ipcRenderer.send(IPC_CHANNELS.setSiteSettingsVisible, visible),
    setSiteSettingsSize: (width: number, height: number) =>
      ipcRenderer.send(IPC_CHANNELS.setSiteSettingsSize, width, height),
    setContentRightInset: (width: number) =>
      ipcRenderer.send(IPC_CHANNELS.setContentRightInset, width),
    dismissTabPicker: () => ipcRenderer.send(IPC_CHANNELS.dismissTabPicker),
    setTabPickerQuery: (query: string, showSearch: boolean) =>
      ipcRenderer.send(IPC_CHANNELS.setTabPickerQuery, query, showSearch),
    setTabPickerCommandCount: (count: number) =>
      ipcRenderer.send(IPC_CHANNELS.setTabPickerCommandCount, count),
    onFocus: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on(IPC_CHANNELS.focus, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.focus, listener)
    },
    onUrlChanged: (callback: (url: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, url: string) => callback(url)
      ipcRenderer.on(IPC_CHANNELS.urlChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.urlChanged, listener)
    },
    onTabsChanged: (callback: (state: BrowserTabsState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: BrowserTabsState) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.tabsChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.tabsChanged, listener)
    },
    onDownloadsChanged: (callback: (downloads: DownloadRecord[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, downloads: DownloadRecord[]) =>
        callback(downloads)
      ipcRenderer.on(IPC_CHANNELS.downloadsChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.downloadsChanged, listener)
    },
    onAssistantSidebarToggleRequested: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.assistantSidebarToggleRequested, callback)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.assistantSidebarToggleRequested, callback)
    },
    onPinnedSitesChanged: (callback: (sites: PinnedSite[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, sites: PinnedSite[]) => callback(sites)
      ipcRenderer.on(IPC_CHANNELS.pinnedSitesChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.pinnedSitesChanged, listener)
    },
    onRecentlyClosedChanged: (callback: (pages: RecentlyClosedPage[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, pages: RecentlyClosedPage[]) => callback(pages)
      ipcRenderer.on(IPC_CHANNELS.recentlyClosedChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.recentlyClosedChanged, listener)
    },
    onNextUpRecommendationsChanged: (callback: (items: NextUpRecommendation[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, items: NextUpRecommendation[]) => callback(items)
      ipcRenderer.on(IPC_CHANNELS.nextUpRecommendationsChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.nextUpRecommendationsChanged, listener)
    },
    onNavigationStateChanged: (callback: (state: BrowserNavigationState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: BrowserNavigationState) =>
        callback(state)
      ipcRenderer.on(IPC_CHANNELS.navigationStateChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.navigationStateChanged, listener)
    },
    onBookmarkFeedback: (callback: (feedback: BookmarkFeedback) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, feedback: BookmarkFeedback) =>
        callback(feedback)
      ipcRenderer.on(IPC_CHANNELS.bookmarkFeedback, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.bookmarkFeedback, listener)
    },
    onTabPickerOpened: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on(IPC_CHANNELS.tabPickerOpened, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.tabPickerOpened, listener)
    },
    onSiteSettingsOpened: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on(IPC_CHANNELS.siteSettingsOpened, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.siteSettingsOpened, listener)
    },
    onTabPickerQueryChanged: (callback: (query: string) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, query: string) => callback(query)
      ipcRenderer.on(IPC_CHANNELS.tabPickerQueryChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.tabPickerQueryChanged, listener)
    },
    onSiteSettingsVisibilityChanged: (callback: (visible: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, visible: boolean) => callback(visible)
      ipcRenderer.on(IPC_CHANNELS.siteSettingsVisibilityChanged, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.siteSettingsVisibilityChanged, listener)
    },
    navigate: (value: string) => ipcRenderer.send(IPC_CHANNELS.navigate, value),
    back: () => ipcRenderer.send(IPC_CHANNELS.back),
    forward: () => ipcRenderer.send(IPC_CHANNELS.forward),
    reload: () => ipcRenderer.send(IPC_CHANNELS.reload),
    stop: () => ipcRenderer.send(IPC_CHANNELS.stop),
  },
}

if (isBrowserContentPreload) {
  installMicrophoneTracking()
} else {
  contextBridge.exposeInMainWorld("electron", electronApi)
}