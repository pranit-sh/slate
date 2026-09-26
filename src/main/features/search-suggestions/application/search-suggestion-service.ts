import type { SearchSuggestion } from "../../../../shared/electron-api"
import type {
  BrowserSettingsReader,
  SearchSuggestionProvider,
  VisitHistoryReader,
} from "./search-suggestion-ports"

const MAX_HISTORY_SUGGESTIONS = 3

export class SearchSuggestionService {
  constructor(
    private readonly settings: BrowserSettingsReader,
    private readonly provider: SearchSuggestionProvider,
    private readonly history: VisitHistoryReader,
  ) {}

  async getSuggestions(query: string): Promise<SearchSuggestion[]> {
    const input = query.trim()
    if (!input) return []

    const [{ searchEngine }, visits] = await Promise.all([
      this.settings.get(),
      this.history.list(),
    ])
    const searchSuggestions = await this.provider.getSuggestions(input, searchEngine)
    const normalizedInput = input.toLocaleLowerCase()
    const seenHistoryUrls = new Set<string>()
    const historySuggestions: SearchSuggestion[] = []

    for (const visit of visits) {
      if (historySuggestions.length >= MAX_HISTORY_SUGGESTIONS) break
      if (seenHistoryUrls.has(visit.url)) continue
      if (!`${visit.title} ${visit.url}`.toLocaleLowerCase().includes(normalizedInput)) continue

      seenHistoryUrls.add(visit.url)
      historySuggestions.push({
        label: visit.title || visit.url,
        value: visit.url,
        source: "history",
      })
    }

    return [
      ...historySuggestions,
      ...searchSuggestions
        .filter((suggestion) => !seenHistoryUrls.has(suggestion))
        .map((suggestion) => ({
          label: suggestion,
          value: suggestion,
          source: "search" as const,
        })),
    ]
  }
}