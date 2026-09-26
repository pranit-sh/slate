import { AiModelSettings } from "./ai-model-settings"
import { BrowsingSettingsSection } from "./browsing-settings-section"

export function SettingsPage() {
  return (
    <main className="h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <BrowsingSettingsSection />
        <AiModelSettings />
      </div>
    </main>
  )
}