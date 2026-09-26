import { useEffect, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import type { BrowserSettings, SearchEngine } from "../../../../../shared/electron-api"

const DEFAULT_SETTINGS: BrowserSettings = {
  reopenTabsOnStartup: false,
  searchEngine: "google",
}

const SEARCH_ENGINES: Array<{
  value: SearchEngine
  label: string
  faviconUrl: string
}> = [
  { value: "google", label: "Google", faviconUrl: "https://www.google.com/favicon.ico" },
  { value: "bing", label: "Bing", faviconUrl: "https://www.bing.com/favicon.ico" },
  { value: "duckduckgo", label: "DuckDuckGo", faviconUrl: "https://duckduckgo.com/favicon.ico" },
  { value: "brave", label: "Brave Search", faviconUrl: "https://brave.com/favicon.ico" },
]

function SearchEngineOption({ engine }: { engine: (typeof SEARCH_ENGINES)[number] }) {
  return (
    <span className="flex items-center gap-2">
      <img src={engine.faviconUrl} alt="" className="size-4 rounded-sm object-contain" />
      <span>{engine.label}</span>
    </span>
  )
}

export function BrowsingSettingsSection() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    void window.electron.browser.getSettings().then((storedSettings) => {
      setSettings(storedSettings)
      setIsLoaded(true)
    })
  }, [])

  function updateSettings(nextSettings: BrowserSettings): void {
    setSettings(nextSettings)
    void window.electron.browser.updateSettings(nextSettings).then(setSettings)
  }

  return (
    <section aria-labelledby="browsing-settings">
      <h2 id="browsing-settings" className="mb-3 text-sm font-normal text-muted-foreground">
        Browsing
      </h2>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex min-h-16 items-center justify-between gap-6 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-normal">Reopen tabs on startup</div>
            <div className="text-xs text-muted-foreground">Continue where you left off.</div>
          </div>
          <Switch
            checked={settings.reopenTabsOnStartup}
            disabled={!isLoaded}
            onCheckedChange={(reopenTabsOnStartup) => {
              updateSettings({ ...settings, reopenTabsOnStartup })
            }}
            aria-label="Reopen tabs on startup"
          />
        </div>

        <Separator />

        <div className="flex min-h-16 items-center justify-between gap-6 px-4 py-3">
          <div>
            <div className="text-sm font-normal">Search engine</div>
            <div className="text-xs text-muted-foreground">Used for searches from the address bar.</div>
          </div>
          <Select
            value={settings.searchEngine}
            disabled={!isLoaded}
            onValueChange={(searchEngine) => {
              updateSettings({ ...settings, searchEngine: searchEngine as SearchEngine })
            }}
          >
            <SelectTrigger aria-label="Search engine">
              <SearchEngineOption
                engine={SEARCH_ENGINES.find((engine) => engine.value === settings.searchEngine)!}
              />
            </SelectTrigger>
            <SelectContent>
              {SEARCH_ENGINES.map((engine) => (
                <SelectItem key={engine.value} value={engine.value}>
                  <SearchEngineOption engine={engine} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}