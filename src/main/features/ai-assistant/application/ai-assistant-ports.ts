import type {
  AiAgentActivity,
  AiChatMessage,
  AiPageAccessStatus,
  AiProvider,
  AiUiBlock,
  BrowserTab,
} from "../../../../shared/electron-api"

export interface AiCredentials {
  provider: AiProvider
  model: string
  endpoint: string
  apiKey: string
}

export interface AiPageContent {
  tabId: string
  title: string
  url: string
  selectedText: string
  text: string
  links: Array<{ text: string; url: string }>
  truncated: boolean
  accessStatus: AiPageAccessStatus
}

export interface AiBrowserContext {
  getAgentTabs(): BrowserTab[]
  readActivePage(): Promise<AiPageContent>
  readPage(tabId: string): Promise<AiPageContent>
  searchWeb(query: string): BrowserTab
  openAgentTab(url: string, active?: boolean): BrowserTab
  activateAgentTab(tabId: string): BrowserTab
  navigateAgentTab(tabId: string, destination: string, signal?: AbortSignal): Promise<BrowserTab>
  findInPage(tabId: string, query: string, signal?: AbortSignal): Promise<number>
  closeAgentTab(tabId: string): BrowserTab
  saveAgentTab(tabId: string): Promise<BrowserTab>
  pinAgentTab(tabId: string): Promise<BrowserTab>
  downloadFromTab(tabId: string, url: string): BrowserTab
}

export interface AiCredentialsProvider {
  getActiveCredentials(): Promise<AiCredentials>
}

export interface AiAgentCallbacks {
  onActivity(activity: AiAgentActivity): void
  onChunk(chunk: string): void
  onUiBlock(block: AiUiBlock): void
}

export type AiAgentRunner = (
  credentials: AiCredentials,
  messages: AiChatMessage[],
  browserContext: AiBrowserContext,
  contextTabIds: string[],
  callbacks: AiAgentCallbacks,
  signal: AbortSignal,
) => Promise<void>
