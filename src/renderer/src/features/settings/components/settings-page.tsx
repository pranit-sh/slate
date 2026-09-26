import { AiModelSettings } from "./ai-model-settings"
import { BrowsingSettingsSection } from "./browsing-settings-section"
import { SupportSettingsSection } from "./support-settings-section"

export function SettingsPage() {
  return (
    <main className="h-screen overflow-y-auto bg-background font-normal text-foreground [&_button]:font-normal">
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <BrowsingSettingsSection />
        <AiModelSettings />
        <SupportSettingsSection />
      </div>
    </main>
  )
}