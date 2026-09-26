import { ArrowRight, Search } from "lucide-react"
import { CommandGroup, CommandItem } from "@/components/ui/command"

interface SearchResultsProps {
  query: string
  suggestions: string[]
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
          key={suggestion}
          value={`search ${suggestion}`}
          onSelect={() => window.electron.browser.navigate(suggestion)}
        >
          <Search />
          <span className="truncate">{suggestion}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  )
}