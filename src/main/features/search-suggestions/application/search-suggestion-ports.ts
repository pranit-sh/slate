import type { BrowserSettings, SearchEngine, Visit } from "../../../../shared/electron-api"

export interface BrowserSettingsReader {
  get(): Promise<BrowserSettings>
}

export interface SearchSuggestionProvider {
  getSuggestions(query: string, searchEngine: SearchEngine): Promise<string[]>
}

export interface VisitHistoryReader {
  list(): Promise<Visit[]>
}