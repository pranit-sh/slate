import { type CSSProperties, useState } from "react"

import { AssistantSidebar } from "@/components/assistant-sidebar"
import { Home } from "@/components/home"
import { SidebarProvider } from "@/components/ui/sidebar"
import { BrowserToolbar } from "@/features/browser-toolbar"

export default function App() {
  const [assistantWidth, setAssistantWidth] = useState(640)
  const [isResizingAssistant, setIsResizingAssistant] = useState(false)

  return (
    <SidebarProvider
      defaultOpen={false}
      data-resizing={isResizingAssistant}
      className="h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground"
      style={{ "--sidebar-width": `${assistantWidth}px` } as CSSProperties}
    >
      <BrowserToolbar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Home />
        </main>
        <AssistantSidebar
          width={assistantWidth}
          onWidthChange={setAssistantWidth}
          onResizeStart={() => setIsResizingAssistant(true)}
          onResizeEnd={() => setIsResizingAssistant(false)}
        />
      </div>
    </SidebarProvider>
  )
}