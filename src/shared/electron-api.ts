export const IPC_CHANNELS = {
  toggleMaximize: "window:toggle-maximize",
  newTab: "browser:new-tab",
  newGhostTab: "browser:new-ghost-tab",
  openUrl: "browser:open-url",
  getTabs: "browser:get-tabs",
  getNavigationState: "browser:get-navigation-state",
  getVisits: "browser:get-visits",
  visitsRefreshRequested: "browser:visits-refresh-requested",
  deleteVisit: "browser:delete-visit",
  clearVisits: "browser:clear-visits",
  getSavedSites: "browser:get-saved-sites",
  savedSitesRefreshRequested: "browser:saved-sites-refresh-requested",
  createSavedSite: "browser:create-saved-site",
  updateSavedSite: "browser:update-saved-site",
  deleteSavedSite: "browser:delete-saved-site",
  markSavedSiteOpened: "browser:mark-saved-site-opened",
  getPinnedSites: "browser:get-pinned-sites",
  createPinnedSite: "browser:create-pinned-site",
  deletePinnedSite: "browser:delete-pinned-site",
  getRecentlyClosed: "browser:get-recently-closed",
  reopenRecentlyClosed: "browser:reopen-recently-closed",
  getNextUpRecommendations: "browser:get-next-up-recommendations",
  dismissNextUpRecommendation: "browser:dismiss-next-up-recommendation",
  getDownloads: "browser:get-downloads",
  openDownload: "browser:open-download",
  showDownloadInFolder: "browser:show-download-in-folder",
  copyDownloadLink: "browser:copy-download-link",
  cancelDownload: "browser:cancel-download",
  removeDownload: "browser:remove-download",
  clearDownloads: "browser:clear-downloads",
  getSettings: "browser:get-settings",
  updateSettings: "browser:update-settings",
  getAiSettings: "ai:get-settings",
  saveAiModel: "ai:save-model",
  deleteAiModel: "ai:delete-model",
  setActiveAiModel: "ai:set-active-model",
  testAiModelConnection: "ai:test-model-connection",
  startAiMessage: "ai:start-message",
  cancelAiMessage: "ai:cancel-message",
  aiMessageEvent: "ai:message-event",
  aiSettingsChanged: "ai:settings-changed",
  getSearchSuggestions: "browser:get-search-suggestions",
  openVisits: "browser:open-visits",
  openSaved: "browser:open-saved",
  openDownloads: "browser:open-downloads",
  openSettings: "browser:open-settings",
  openDevTools: "browser:open-dev-tools",
  activateTab: "browser:activate-tab",
  closeTab: "browser:close-tab",
  setTabMuted: "browser:set-tab-muted",
  setTabMicrophoneMuted: "browser:set-tab-microphone-muted",
  setTabPickerVisible: "browser:set-tab-picker-visible",
  setSiteSettingsVisible: "browser:set-site-settings-visible",
  setSiteSettingsSize: "browser:set-site-settings-size",
  setContentRightInset: "browser:set-content-right-inset",
  dismissTabPicker: "browser:dismiss-tab-picker",
  setTabPickerQuery: "browser:set-tab-picker-query",
  setTabPickerCommandCount: "browser:set-tab-picker-command-count",
  tabPickerOpened: "browser:tab-picker-opened",
  siteSettingsOpened: "browser:site-settings-opened",
  tabPickerQueryChanged: "browser:tab-picker-query-changed",
  siteSettingsVisibilityChanged: "browser:site-settings-visibility-changed",
  navigate: "browser:navigate",
  back: "browser:back",
  forward: "browser:forward",
  reload: "browser:reload",
  stop: "browser:stop",
  focus: "browser:focus",
  urlChanged: "browser:url-changed",
  tabsChanged: "browser:tabs-changed",
  downloadsChanged: "browser:downloads-changed",
  pinnedSitesChanged: "browser:pinned-sites-changed",
  recentlyClosedChanged: "browser:recently-closed-changed",
  nextUpRecommendationsChanged: "browser:next-up-recommendations-changed",
  navigationStateChanged: "browser:navigation-state-changed",
} as const

export const BROWSER_CONTENT_CHANNELS = {
  microphoneStateChanged: "browser-content:microphone-state-changed",
  setMicrophoneMuted: "browser-content:set-microphone-muted",
} as const

type RemoveListener = () => void
type Platform =
  | "aix"
  | "android"
  | "cygwin"
  | "darwin"
  | "freebsd"
  | "haiku"
  | "linux"
  | "netbsd"
  | "openbsd"
  | "sunos"
  | "win32"

export interface BrowserTab {
  id: string
  title: string
  url: string
  faviconUrl: string
  isGhost: boolean
  isLoading: boolean
  isAudible: boolean
  isMuted: boolean
  isUsingMicrophone: boolean
  isMicrophoneMuted: boolean
}

export interface BrowserTabsState {
  activeTabId: string | null
  isActiveTabGhost: boolean
  isActiveTabLoading: boolean
  tabs: BrowserTab[]
}

export interface BrowserNavigationState {
  canGoBack: boolean
  canGoForward: boolean
}

export type SearchEngine = "google" | "bing" | "duckduckgo" | "brave"

export interface BrowserSettings {
  reopenTabsOnStartup: boolean
  searchEngine: SearchEngine
}

export type AiProvider = "openai" | "anthropic" | "gemini"

export interface AiModel {
  id: string
  name: string
  provider: AiProvider
  model: string
  endpoint: string
  hasApiKey: boolean
}

export interface AiSettings {
  activeModelId: string | null
  models: AiModel[]
}

export interface SaveAiModelInput {
  id?: string
  name: string
  provider: AiProvider
  model: string
  endpoint?: string
  apiKey?: string
}

export type AiConnectionStatus =
  | { state: "connected" }
  | { state: "error"; message: string }

export interface AiChatMessage {
  role: "assistant" | "user"
  content: string
}

export interface AiAgentActivity {
  id?: string
  state:
    | "understanding"
    | "searching"
    | "opening"
    | "navigating"
    | "reading"
    | "finding"
    | "organizing"
    | "waiting"
    | "composing"
  label: string
  detail?: string
  affectedTabIds?: string[]
  status: "active" | "complete" | "failed" | "cancelled"
}

export type AiMessageEvent =
  | { requestId: string; type: "chunk"; content: string }
  | { requestId: string; type: "activity"; activity: AiAgentActivity }
  | { requestId: string; type: "done" }
  | { requestId: string; type: "error"; message: string }

export interface TabSession {
  urls: string[]
  activeIndex: number
}

export interface Visit {
  day: string
  url: string
  title: string
  faviconUrl: string
  count: number
  lastVisitedAt: string
  visitTimes: string[]
}

export interface SavedSite {
  id: string
  title: string
  url: string
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
}

export interface SavedSiteInput {
  title: string
  url: string
}

export interface PinnedSite {
  id: string
  title: string
  url: string
  faviconUrl: string
  pinnedAt: string
}

export interface PinnedSiteInput {
  title: string
  url: string
  faviconUrl: string
}

export interface RecentlyClosedPage {
  id: string
  title: string
  url: string
  faviconUrl: string
  closedAt: string
}

export type NextUpReason = "usual-time" | "usual-day" | "frequent"

export interface NextUpRecommendation {
  id: string
  title: string
  url: string
  faviconUrl: string
  reason: NextUpReason
  confidence: number
}

export type DownloadState = "progressing" | "completed" | "cancelled" | "interrupted"

export interface DownloadRecord {
  id: string
  filename: string
  url: string
  savePath: string
  state: DownloadState
  receivedBytes: number
  totalBytes: number
  startedAt: string
  updatedAt: string
  completedAt: string | null
  fileExists: boolean
}

export interface ElectronApi {
  platform: Platform
  window: {
    toggleMaximize: () => void
  }
  browser: {
    newTab: () => void
    newGhostTab: () => void
    openUrl: (url: string) => void
    getTabs: () => Promise<BrowserTabsState>
    getNavigationState: () => Promise<BrowserNavigationState>
    getVisits: () => Promise<Visit[]>
    onVisitsRefreshRequested: (callback: () => void) => RemoveListener
    deleteVisit: (day: string, url: string) => Promise<void>
    clearVisits: () => Promise<void>
    getSavedSites: () => Promise<SavedSite[]>
    onSavedSitesRefreshRequested: (callback: () => void) => RemoveListener
    createSavedSite: (site: SavedSiteInput) => Promise<SavedSite>
    updateSavedSite: (id: string, site: SavedSiteInput) => Promise<SavedSite | null>
    deleteSavedSite: (id: string) => Promise<void>
    markSavedSiteOpened: (id: string) => Promise<SavedSite | null>
    getPinnedSites: () => Promise<PinnedSite[]>
    createPinnedSite: (site: PinnedSiteInput) => Promise<PinnedSite>
    deletePinnedSite: (id: string) => Promise<void>
    getRecentlyClosed: () => Promise<RecentlyClosedPage[]>
    reopenRecentlyClosed: (id: string) => void
    getNextUpRecommendations: () => Promise<NextUpRecommendation[]>
    dismissNextUpRecommendation: (id: string) => Promise<void>
    getDownloads: () => Promise<DownloadRecord[]>
    openDownload: (id: string) => Promise<string>
    showDownloadInFolder: (id: string) => Promise<void>
    copyDownloadLink: (id: string) => Promise<void>
    cancelDownload: (id: string) => Promise<void>
    removeDownload: (id: string) => Promise<void>
    clearDownloads: () => Promise<void>
    getSettings: () => Promise<BrowserSettings>
    updateSettings: (settings: BrowserSettings) => Promise<BrowserSettings>
    getAiSettings: () => Promise<AiSettings>
    saveAiModel: (model: SaveAiModelInput) => Promise<AiSettings>
    deleteAiModel: (id: string) => Promise<AiSettings>
    setActiveAiModel: (id: string) => Promise<AiSettings>
    testAiModelConnection: (id: string) => Promise<AiConnectionStatus>
    startAiMessage: (requestId: string, messages: AiChatMessage[]) => void
    cancelAiMessage: (requestId: string) => void
    onAiMessageEvent: (callback: (event: AiMessageEvent) => void) => RemoveListener
    onAiSettingsChanged: (callback: (settings: AiSettings) => void) => RemoveListener
    getSearchSuggestions: (query: string) => Promise<string[]>
    openVisits: () => void
    openSaved: () => void
    openDownloads: () => void
    openSettings: () => void
    openDevTools: () => void
    activateTab: (tabId: string) => void
    closeTab: (tabId: string) => void
    setTabMuted: (tabId: string, muted: boolean) => void
    setTabMicrophoneMuted: (tabId: string, muted: boolean) => void
    setTabPickerVisible: (visible: boolean) => void
    setSiteSettingsVisible: (visible: boolean) => void
    setSiteSettingsSize: (width: number, height: number) => void
    setContentRightInset: (width: number) => void
    dismissTabPicker: () => void
    setTabPickerQuery: (query: string, showSearch: boolean) => void
    setTabPickerCommandCount: (count: number) => void
    navigate: (value: string) => void
    back: () => void
    forward: () => void
    reload: () => void
    stop: () => void
    onFocus: (callback: () => void) => RemoveListener
    onUrlChanged: (callback: (url: string) => void) => RemoveListener
    onTabsChanged: (callback: (state: BrowserTabsState) => void) => RemoveListener
    onDownloadsChanged: (callback: (downloads: DownloadRecord[]) => void) => RemoveListener
    onPinnedSitesChanged: (callback: (sites: PinnedSite[]) => void) => RemoveListener
    onRecentlyClosedChanged: (callback: (pages: RecentlyClosedPage[]) => void) => RemoveListener
    onNextUpRecommendationsChanged: (callback: (items: NextUpRecommendation[]) => void) => RemoveListener
    onNavigationStateChanged: (callback: (state: BrowserNavigationState) => void) => RemoveListener
    onTabPickerOpened: (callback: () => void) => RemoveListener
    onSiteSettingsOpened: (callback: () => void) => RemoveListener
    onTabPickerQueryChanged: (callback: (query: string) => void) => RemoveListener
    onSiteSettingsVisibilityChanged: (callback: (visible: boolean) => void) => RemoveListener
  }
}