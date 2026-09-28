import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { BrowserTab } from "../../../../../../shared/electron-api"
import { Favicon } from "@/components/favicon"

interface AssistantMessageContentProps {
  content: string
  tabs: BrowserTab[]
}

function findOpenTab(tabs: BrowserTab[], href: string): BrowserTab | undefined {
  try {
    const referencedUrl = new URL(href)
    referencedUrl.hash = ""
    return tabs.find((tab) => {
      try {
        const tabUrl = new URL(tab.url)
        tabUrl.hash = ""
        return tabUrl.href === referencedUrl.href
      } catch {
        return false
      }
    })
  } catch {
    return undefined
  }
}

export function AssistantMessageContent({ content, tabs }: AssistantMessageContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children, ...props }) => {
          const openTab = href ? findOpenTab(tabs, href) : undefined
          if (openTab) {
            return (
              <button
                type="button"
                className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 px-1.5 py-0.5 align-baseline text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Switch to open tab: ${openTab.title || openTab.url}`}
                title={openTab.url}
                onClick={() => window.electron.browser.activateTab(openTab.id)}
              >
                <Favicon src={openTab.faviconUrl} className="size-3.5 shrink-0" />
                <span className="max-w-64 truncate">{openTab.title || children}</span>
              </button>
            )
          }
          return (
            <a
              {...props}
              href={href}
              className="font-medium text-foreground underline decoration-foreground/35 underline-offset-3 hover:decoration-foreground"
              onClick={(event) => {
                event.preventDefault()
                if (href) window.electron.browser.openUrl(href)
              }}
            >
              {children}
            </a>
          )
        },
        blockquote: (props) => (
          <blockquote {...props} className="border-l-2 border-border pl-3 text-muted-foreground" />
        ),
        code: (props) => (
          <code {...props} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]" />
        ),
        h1: (props) => <h1 {...props} className="mt-4 text-base font-semibold first:mt-0" />,
        h2: (props) => <h2 {...props} className="mt-4 text-sm font-semibold first:mt-0" />,
        h3: (props) => <h3 {...props} className="mt-3 text-sm font-medium first:mt-0" />,
        ol: (props) => <ol {...props} className="ml-5 list-decimal space-y-1" />,
        p: (props) => <p {...props} className="my-2 first:mt-0 last:mb-0" />,
        pre: (props) => (
          <pre {...props} className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-xs" />
        ),
        ul: (props) => <ul {...props} className="ml-5 list-disc space-y-1" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}