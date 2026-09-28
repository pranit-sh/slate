import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { AiAgentActivity } from "../../../../shared/electron-api"
import type { AiBrowserContext } from "../application/ai-assistant-ports"

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

  const searchWeb = tool(
    async ({ query }) => {
      const tab = await runWithActivity(
        {
          state: "searching",
          label: `Searching for ${query}`,
          detail: query,
        },
        () => browserContext.searchWeb(query),
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
      description: "Search the web in a new tab using the user's configured search engine.",
      schema: z.object({ query: z.string().min(1).max(500) }),
    },
  )

  const openTab = tool(
    async ({ url, active }) => {
      const tab = await runWithActivity(
        { state: "opening", label: "Opening tab", detail: url },
        () => browserContext.openAgentTab(url, active),
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
      description: "Open an HTTP or HTTPS URL in a new foreground or background tab.",
      schema: z.object({
        url: z.url(),
        active: z.boolean().default(true),
      }),
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
        () => browserContext.navigateAgentTab(tabId, destination, signal),
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
        () => {
          const tab = browserContext.getAgentTabs().find((candidate) => candidate.id === tabId)
          if (!tab) throw new Error("Tab not found.")
          return browserContext.closeAgentTab(tabId)
        },
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