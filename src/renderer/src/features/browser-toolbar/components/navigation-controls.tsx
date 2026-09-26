import { ArrowLeft, ArrowRight, RotateCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"

interface NavigationControlsProps {
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
}

export function NavigationControls({
  canGoBack,
  canGoForward,
  isLoading,
}: NavigationControlsProps) {
  return (
    <nav
      className="no-drag flex items-center justify-end"
      aria-label="Browser navigation"
    >
      <ButtonGroup className="rounded-lg">
        <Button
          size="icon"
          variant="ghost"
          onClick={window.electron.browser.back}
          disabled={!canGoBack}
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={window.electron.browser.forward}
          disabled={!canGoForward}
          aria-label="Forward"
          title="Forward"
        >
          <ArrowRight />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={isLoading ? window.electron.browser.stop : window.electron.browser.reload}
          aria-label={isLoading ? "Stop loading" : "Reload"}
          title={isLoading ? "Stop loading" : "Reload"}
        >
          {isLoading ? <X /> : <RotateCw />}
        </Button>
      </ButtonGroup>
    </nav>
  )
}