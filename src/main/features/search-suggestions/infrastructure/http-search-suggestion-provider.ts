import type { SearchEngine } from "../../../../shared/electron-api"
import type { SearchSuggestionProvider } from "../application/search-suggestion-ports"

const MAX_SUGGESTIONS = 3

export class HttpSearchSuggestionProvider implements SearchSuggestionProvider {
  async getSuggestions(query: string, searchEngine: SearchEngine): Promise<string[]> {
    try {
      const response = await fetch(this.getUrl(query, searchEngine), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3_000),
      })
      if (!response.ok) return []

      return this.parse(await response.json(), searchEngine)
    } catch {
      return []
    }
  }

  private getUrl(query: string, searchEngine: SearchEngine): URL {
    if (searchEngine === "brave") {
      const url = new URL("https://search.brave.com/api/suggest")
      url.searchParams.set("q", query)
      url.searchParams.set("rich", "false")
      url.searchParams.set("source", "web")
      return url
    }

    if (searchEngine === "duckduckgo") {
      const url = new URL("https://duckduckgo.com/ac/")
      url.searchParams.set("q", query)
      url.searchParams.set("type", "list")
      return url
    }

    if (searchEngine === "bing") {
      const url = new URL("https://api.bing.com/osjson.aspx")
      url.searchParams.set("query", query)
      return url
    }

    const url = new URL("https://suggestqueries.google.com/complete/search")
    url.searchParams.set("client", "firefox")
    url.searchParams.set("q", query)
    return url
  }

  private parse(payload: unknown, searchEngine: SearchEngine): string[] {
    const suggestions = searchEngine === "duckduckgo"
      ? Array.isArray(payload)
        ? payload.map((item) => (
            typeof item === "object" && item !== null && "phrase" in item ? item.phrase : undefined
          ))
        : []
      : Array.isArray(payload) && Array.isArray(payload[1])
        ? payload[1]
        : []

    return suggestions
      .filter((suggestion): suggestion is string => typeof suggestion === "string")
      .slice(0, MAX_SUGGESTIONS)
  }
}