import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { AiAgentActivity } from "../../../../shared/electron-api"
import type { AiBrowserContext } from "../application/ai-assistant-ports"
import { fetchPublicWebResource } from "./public-web-resource-fetcher"

interface BrowserToolOptions {
  browserContext: AiBrowserContext
  onActivity: (activity: AiAgentActivity) => void
  signal?: AbortSignal
}

type ActivityDetails = Omit<AiAgentActivity, "id" | "status">

export function createBrowserTools({
  browserContext,
  onActivity,
  signal,
}: BrowserToolOptions) {
  const resourceCache = new Map<string, Awaited<ReturnType<typeof fetchPublicWebResource>>>()
  const searchedQueries = new Set<string>()
  let searchTabId: string | undefined
  let pendingUserAction: { origin: string; accessStatus: string } | undefined
  const getOrigin = (value: string): string | null => {
    try {
      return new URL(value).origin
    } catch {
      return null
    }
  }
  const recordAccessStatus = (page: { url: string; accessStatus: string }): void => {
    if (page.accessStatus === "accessible") return
    const origin = getOrigin(page.url)
    if (origin) pendingUserAction = { origin, accessStatus: page.accessStatus }
  }
  const assertBrowserAvailable = (): void => {
    if (pendingUserAction) {
      throw new Error(`${pendingUserAction.origin} requires user action (${pendingUserAction.accessStatus}). Pause browsing and ask the user to complete the required step in the existing tab.`)
    }
  }
  const report = (activity: AiAgentActivity): void => onActivity(activity)
  const startActivity = (activity: Omit<AiAgentActivity, "id" | "status">) => {
    const id = crypto.randomUUID()
    report({ ...activity, id, status: "active" })
    return (
      completed: Omit<AiAgentActivity, "id" | "status">,
      status: AiAgentActivity["status"] = "complete",
    ): void => report({ ...completed, id, status })
  }
  const runWithActivity = async <Result>(
    activity: ActivityDetails,
    operation: () => Result | Promise<Result>,
    completed: (result: Result) => ActivityDetails,
  ): Promise<Result> => {
    const finishActivity = startActivity(activity)
    try {
      const result = await operation()
      finishActivity(completed(result))
      return result
    } catch (error) {
      const isCancelled = signal?.aborted
        || (error instanceof Error && error.name === "AbortError")
      finishActivity(
        {
          ...activity,
          detail: error instanceof Error ? error.message : undefined,
        },
        isCancelled ? "cancelled" : "failed",
      )
      throw error
    }
  }

  const readCurrentPage = tool(
    async () => {
      const page = await runWithActivity(
        { state: "reading", label: "Reading current page" },
        () => browserContext.readActivePage(),
        (result) => ({
          state: "reading",
          label: "Read page",
          detail: result.title || result.url,
          affectedTabIds: [result.tabId],
        }),
      )
      recordAccessStatus(page)
      return JSON.stringify(page)
    },
    {
      name: "read_current_page",
      description: "Read the title, URL, selected text, visible text, and links of the active page.",
      schema: z.object({}),
    },
  )

  const listTabs = tool(
    async () => {
      const tabs = await runWithActivity(
        { state: "reading", label: "Checking open tabs" },
        () => browserContext.getAgentTabs(),
        (result) => ({
          state: "reading",
          label: `Checked ${result.length} open tab${result.length === 1 ? "" : "s"}`,
        }),
      )
      return JSON.stringify(tabs)
    },
    {
      name: "list_tabs",
      description: "List open browser tabs and their IDs, URLs, and loading states.",
      schema: z.object({}),
    },
  )

  const fetchResource = tool(
    async ({ url }) => {
      const resource = await runWithActivity(
        { state: "reading", label: "Fetching public data", detail: url },
        async () => {
          const normalizedUrl = new URL(url).toString()
          const cachedResource = resourceCache.get(normalizedUrl)
          if (cachedResource) return cachedResource
          const resource = await fetchPublicWebResource(normalizedUrl, signal)
          resourceCache.set(normalizedUrl, resource)
          return resource
        },
        (result) => ({
          state: "reading",
          label: "Fetched public data",
          detail: result.url,
        }),
      )
      return JSON.stringify(resource)
    },
    {
      name: "fetch_resource",
      description: "Fetch a public HTTPS JSON, XML, CSV, or plain-text API/resource without opening a browser tab. This sends no browser cookies or credentials and rejects HTML, private-network addresses, oversized responses, and unsafe redirects. Prefer official APIs and structured endpoints when available.",
      schema: z.object({ url: z.url() }),
    },
  )

  const searchWeb = tool(
    async ({ query }) => {
      const tab = await runWithActivity(
        {
          state: "searching",
          label: `Searching for ${query}`,
          detail: query,
        },
        () => {
          assertBrowserAvailable()
          const normalizedQuery = query.trim().toLocaleLowerCase()
          if (searchedQueries.has(normalizedQuery)) {
            throw new Error("This search was already opened. Reuse its existing results instead of repeating it.")
          }
          searchedQueries.add(normalizedQuery)
          if (searchTabId) {
            try {
              browserContext.closeAgentTab(searchTabId)
            } catch {
              // The user may already have closed the previous search tab.
            }
          }
          const tab = browserContext.searchWeb(query)
          searchTabId = tab.id
          return tab
        },
        (result) => ({
          state: "searching",
          label: "Opened search results",
          detail: query,
          affectedTabIds: [result.id],
        }),
      )
      return JSON.stringify(tab)
    },
    {
      name: "search_web",
      description: "Open the user's configured search engine in a normal background tab. Use only when API/resource retrieval is insufficient or the user should inspect the results. If verification appears, read the page once and ask the user to complete it; do not open another search tab.",
      schema: z.object({ query: z.string().min(1).max(500) }),
    },
  )

  const openTab = tool(
    async ({ url }) => {
      const tab = await runWithActivity(
        {
          state: "opening",
          label: "Opening tab",
          detail: url,
        },
        () => {
          assertBrowserAvailable()
          const normalizedUrl = new URL(url).toString()
          const existingTab = browserContext.getAgentTabs().find((tab) => tab.url === normalizedUrl)
          if (existingTab) return existingTab
          return browserContext.openAgentTab(url, false)
        },
        (result) => ({
          state: "opening",
          label: "Opened tab",
          detail: result.title || result.url,
          affectedTabIds: [result.id],
        }),
      )
      return JSON.stringify(tab)
    },
    {
      name: "open_tab",
      description: "Open an HTTP or HTTPS URL in a normal tab marked as opened by AI. Use for pages the user should inspect, dynamic pages unavailable through fetch_resource, or pages requiring user verification, login, or consent.",
      schema: z.object({ url: z.url() }),
    },
  )

  const activateTab = tool(
    async ({ tabId }) => {
      const tab = await runWithActivity(
        {
          state: "navigating",
          label: "Switching tab",
          affectedTabIds: [tabId],
        },
        () => browserContext.activateAgentTab(tabId),
        (result) => ({
          state: "navigating",
          label: "Switched tab",
          detail: result.title || result.url,
          affectedTabIds: [result.id],
        }),
      )
      return JSON.stringify(tab)
    },
    {
      name: "activate_tab",
      description: "Switch to a specific open tab by ID.",
      schema: z.object({ tabId: z.string().min(1) }),
    },
  )

  const readPage = tool(
    async ({ tabId }) => {
      const page = await runWithActivity(
        {
          state: "reading",
          label: "Reading page",
          affectedTabIds: [tabId],
        },
        () => browserContext.readPage(tabId),
        (result) => ({
          state: "reading",
          label: "Read page",
          detail: result.title || result.url,
          affectedTabIds: [tabId],
        }),
      )
      recordAccessStatus(page)
      return JSON.stringify(page)
    },
    {
      name: "read_page",
      description: "Read a specific open tab by ID without activating it.",
      schema: z.object({ tabId: z.string().min(1) }),
    },
  )

  const findInPage = tool(
    async ({ tabId, query }) => {
      const matches = await runWithActivity(
        {
          state: "finding",
          label: `Finding “${query}”`,
          detail: query,
          affectedTabIds: [tabId],
        },
        () => browserContext.findInPage(tabId, query, signal),
        (result) => ({
          state: "finding",
          label: `Found ${result} match${result === 1 ? "" : "es"}`,
          detail: query,
          affectedTabIds: [tabId],
        }),
      )
      return JSON.stringify({ tabId, query, matches })
    },
    {
      name: "find_in_page",
      description: "Find and highlight text in a specific open tab.",
      schema: z.object({
        tabId: z.string().min(1),
        query: z.string().min(1).max(500),
      }),
    },
  )

  const navigateTab = tool(
    async ({ tabId, destination }) => {
      const tab = await runWithActivity(
        {
          state: "navigating",
          label: destination === "back" || destination === "forward"
            ? `Navigating ${destination}`
            : "Navigating tab",
          detail: destination,
          affectedTabIds: [tabId],
        },
        () => {
          assertBrowserAvailable()
          return browserContext.navigateAgentTab(tabId, destination, signal)
        },
        (result) => ({
          state: "navigating",
          label: "Navigation complete",
          detail: result.title || result.url,
          affectedTabIds: [tabId],
        }),
      )
      return JSON.stringify(tab)
    },
    {
      name: "navigate_tab",
      description: "Navigate a tab to an HTTP(S) URL, or move backward or forward in its history.",
      schema: z.object({
        tabId: z.string().min(1),
        destination: z.string().min(1).max(2_000),
      }),
    },
  )

  const closeTab = tool(
    async ({ tabId }) => {
      const closedTab = await runWithActivity(
        {
          state: "organizing",
          label: "Closing tab",
          affectedTabIds: [tabId],
        },
        () => browserContext.closeAgentTab(tabId),
        (result) => ({
          state: "organizing",
          label: "Closed tab",
          detail: result.title || result.url,
          affectedTabIds: [tabId],
        }),
      )
      return JSON.stringify(closedTab)
    },
    {
      name: "close_tab",
      description: "Close a specific open tab by ID.",
      schema: z.object({ tabId: z.string().min(1) }),
    },
  )

  const saveSite = tool(
    async ({ tabId }) => {
      const savedTab = await runWithActivity(
        {
          state: "organizing",
          label: "Saving page",
          affectedTabIds: [tabId],
        },
        async () => {
          const tab = browserContext.getAgentTabs().find((candidate) => candidate.id === tabId)
          if (!tab) throw new Error("Tab not found.")
          return browserContext.saveAgentTab(tabId)
        },
        (result) => ({
          state: "organizing",
          label: "Saved page",
          detail: result.title || result.url,
          affectedTabIds: [tabId],
        }),
      )
      return JSON.stringify(savedTab)
    },
    {
      name: "save_site",
      description: "Add a tab's page to saved sites.",
      schema: z.object({ tabId: z.string().min(1) }),
    },
  )

  const pinTab = tool(
    async ({ tabId }) => {
      const pinnedTab = await runWithActivity(
        {
          state: "organizing",
          label: "Pinning page",
          affectedTabIds: [tabId],
        },
        async () => {
          const tab = browserContext.getAgentTabs().find((candidate) => candidate.id === tabId)
          if (!tab) throw new Error("Tab not found.")
          return browserContext.pinAgentTab(tabId)
        },
        (result) => ({
          state: "organizing",
          label: "Pinned page",
          detail: result.title || result.url,
          affectedTabIds: [tabId],
        }),
      )
      return JSON.stringify(pinnedTab)
    },
    {
      name: "pin_tab",
      description: "Add a tab's page to pinned sites.",
      schema: z.object({ tabId: z.string().min(1) }),
    },
  )

  const downloadFile = tool(
    async ({ tabId, url }) => {
      const sourceTab = await runWithActivity(
        {
          state: "opening",
          label: "Starting download",
          detail: url,
          affectedTabIds: [tabId],
        },
        () => {
          const tab = browserContext.getAgentTabs().find((candidate) => candidate.id === tabId)
          if (!tab) throw new Error("Tab not found.")
          return browserContext.downloadFromTab(tabId, url)
        },
        () => ({
          state: "opening",
          label: "Started download",
          detail: url,
          affectedTabIds: [tabId],
        }),
      )
      return JSON.stringify({ tab: sourceTab, url })
    },
    {
      name: "download_file",
      description: "Download an HTTP(S) URL from a specific tab.",
      schema: z.object({
        tabId: z.string().min(1),
        url: z.string().min(1).max(2_000),
      }),
    },
  )

  return [
    readCurrentPage,
    listTabs,
    fetchResource,
    searchWeb,
    openTab,
    activateTab,
    readPage,
    findInPage,
    navigateTab,
    closeTab,
    saveSite,
    pinTab,
    downloadFile,
  ]
}