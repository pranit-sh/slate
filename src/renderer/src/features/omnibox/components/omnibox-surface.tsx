import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useOmnibox } from "../hooks/use-omnibox"
import { CommandResults } from "./command-results"
import { OpenTabResults } from "./open-tab-results"
import { SearchResults } from "./search-results"

export function OmniboxSurface() {
  const omnibox = useOmnibox()
  const showSearch = !omnibox.isCommandMode && omnibox.isQueryEdited && Boolean(omnibox.query.trim())

  return (
    <main className="h-screen overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg">
      <Command
        shouldFilter={false}
        value={omnibox.selectedValue}
        onValueChange={omnibox.setSelectedValue}
        className="rounded-lg!"
        onKeyDown={(event) => {
          if (event.key === "Escape") window.electron.browser.dismissTabPicker()
        }}
      >
        <CommandInput
          ref={omnibox.inputRef}
          value={omnibox.query}
          onValueChange={omnibox.updateQuery}
          placeholder="Search open tabs or enter address"
          aria-label="Search open tabs or enter address"
        />
        <CommandList className="max-h-none flex-1 [&_[cmdk-list-sizer]]:h-full">
          <CommandEmpty className="flex h-full items-center justify-center py-0">
            {omnibox.isCommandMode ? "No matching commands" : "No open tabs"}
          </CommandEmpty>
          {omnibox.isCommandMode && <CommandResults commands={omnibox.commands} />}
          {showSearch && (
            <SearchResults query={omnibox.query} suggestions={omnibox.suggestions} />
          )}
          {showSearch && omnibox.tabs.length > 0 && <CommandSeparator />}
          <OpenTabResults activeTabId={omnibox.activeTabId} tabs={omnibox.tabs} />
        </CommandList>
      </Command>
    </main>
  )
}