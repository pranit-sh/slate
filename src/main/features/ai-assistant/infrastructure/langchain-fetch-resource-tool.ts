import { tool } from "@langchain/core/tools"
import { z } from "zod"
import type { AiAgentActivity } from "../../../../shared/electron-api"
import { fetchPublicWebResource } from "./public-web-resource-fetcher"

const MAX_CACHE_ENTRIES = 20

interface FetchResourceToolOptions {
  onActivity: (activity: AiAgentActivity) => void
  signal?: AbortSignal
}

function formatActivityUrl(value: string): string {
  const url = new URL(value)
  return `${url.origin}${url.pathname}`
}

export function createFetchResourceTool({
  onActivity,
  signal,
}: FetchResourceToolOptions) {
  const resourceCache = new Map<string, Awaited<ReturnType<typeof fetchPublicWebResource>>>()

  return tool(
    async ({ url }) => {
      const normalizedUrl = new URL(url).toString()
      const activityUrl = formatActivityUrl(normalizedUrl)
      const activityId = crypto.randomUUID()
      onActivity({
        id: activityId,
        state: "reading",
        label: "Fetching public data",
        detail: activityUrl,
        status: "active",
      })

      try {
        let resource = resourceCache.get(normalizedUrl)
        if (!resource) {
          resource = await fetchPublicWebResource(normalizedUrl, signal)
          if (resourceCache.size >= MAX_CACHE_ENTRIES) {
            const oldestKey = resourceCache.keys().next().value
            if (oldestKey) resourceCache.delete(oldestKey)
          }
          resourceCache.set(normalizedUrl, resource)
        }
        onActivity({
          id: activityId,
          state: "reading",
          label: "Fetched public data",
          detail: formatActivityUrl(resource.url),
          status: "complete",
        })
        return JSON.stringify(resource)
      } catch (error) {
        const isCancelled = signal?.aborted
          || (error instanceof Error && error.name === "AbortError")
        onActivity({
          id: activityId,
          state: "reading",
          label: "Fetching public data",
          detail: error instanceof Error ? error.message : undefined,
          status: isCancelled ? "cancelled" : "failed",
        })
        throw error
      }
    },
    {
      name: "fetch_resource",
      description: "Fetch a public HTTPS JSON, XML, CSV, or plain-text API/resource without opening a browser tab. This sends no browser cookies or credentials, rejects HTML and private-network destinations, validates redirects, and limits response size. Prefer official APIs and structured endpoints when available. Open user-facing, dynamic, or authenticated pages in a browser tab instead.",
      schema: z.object({ url: z.url() }),
    },
  )
}