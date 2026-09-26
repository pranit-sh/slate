import type {
  BrowserSettingsReader,
  SearchSuggestionProvider,
} from "./search-suggestion-ports"

export class SearchSuggestionService {
  constructor(
    private readonly settings: BrowserSettingsReader,
    private readonly provider: SearchSuggestionProvider,
  ) {}

  async getSuggestions(query: string): Promise<string[]> {
    const input = query.trim()
    if (!input) return []

    const { searchEngine } = await this.settings.get()
    return this.provider.getSuggestions(input, searchEngine)
  }
}