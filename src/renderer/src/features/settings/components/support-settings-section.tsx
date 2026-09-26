import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SupportSettingsSection() {
  return (
    <section aria-labelledby="support-settings" className="mt-8">
      <h2 id="support-settings" className="mb-3 text-sm font-normal text-muted-foreground">
        Support
      </h2>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex min-h-16 items-center justify-between gap-6 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-normal">Report a bug</div>
            <div className="text-xs text-muted-foreground">
              Tell us what went wrong by opening an issue on GitHub.
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void window.electron.support.reportBug()}
          >
            Open GitHub
            <ExternalLink />
          </Button>
        </div>
      </div>
    </section>
  )
}