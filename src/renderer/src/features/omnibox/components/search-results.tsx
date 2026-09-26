import { ArrowRight, History, Search } from "lucide-react"
import type { SearchSuggestion } from "../../../../../shared/electron-api"
import { CommandGroup, CommandItem } from "@/components/ui/command"

interface SearchResultsProps {
  query: string
  suggestions: SearchSuggestion[]
}

export function SearchResults({ query, suggestions }: SearchResultsProps) {
  return (
    <CommandGroup heading="Search">
      <CommandItem
        value={`navigate ${query}`}
        onSelect={() => window.electron.browser.navigate(query)}
      >
        <ArrowRight />
        <span className="truncate">Go to &quot;{query}&quot;</span>
      </CommandItem>
      {suggestions.map((suggestion) => (
        <CommandItem
          key={`${suggestion.source}:${suggestion.value}`}
          value={`${suggestion.source} ${suggestion.label} ${suggestion.value}`}
          onSelect={() => window.electron.browser.navigate(suggestion.value)}
        >
          {suggestion.source === "history" ? <History /> : <Search />}
          <span className="min-w-0 flex-1 truncate">{suggestion.label}</span>
          {suggestion.source === "history" && suggestion.label !== suggestion.value && (
            <span className="max-w-1/2 shrink-0 truncate text-xs text-muted-foreground">
              {suggestion.value}
            </span>
          )}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}