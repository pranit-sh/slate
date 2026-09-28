import { lookup } from "node:dns/promises"
import { request } from "node:https"
import type { IncomingMessage } from "node:http"
import { isIP } from "node:net"
import * as ipaddr from "ipaddr.js"

const MAX_REDIRECTS = 5
const MAX_RESPONSE_BYTES = 100_000
const TOTAL_TIMEOUT_MS = 10_000
const MAX_RESPONSE_HEADER_BYTES = 16_384
const ACCEPT_HEADER = "application/json, application/xml, text/csv, text/plain, text/xml"
const ALLOWED_CONTENT_TYPES = [
  "application/json",
  "application/xml",
  "application/ld+json",
  "text/csv",
  "text/plain",
  "text/xml",
]

export interface PublicWebResource {
  url: string
  status: number
  contentType: string
  body: string
  truncated: boolean
}

export async function fetchPublicWebResource(
  value: string,
  signal?: AbortSignal,
): Promise<PublicWebResource> {
  let url = new URL(value)
  const requestSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(TOTAL_TIMEOUT_MS)])
    : AbortSignal.timeout(TOTAL_TIMEOUT_MS)
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const address = await resolvePublicHttpsUrl(url)
    const response = await requestPublicResource(url, address, requestSignal)

    const status = response.statusCode ?? 0
    if (status >= 300 && status < 400) {
      response.resume()
      const location = getHeader(response, "location")
      if (!location) throw new Error(`The resource returned redirect status ${status} without a location.`)
      if (redirectCount === MAX_REDIRECTS) throw new Error("The resource exceeded the redirect limit.")
      url = new URL(location, url)
      continue
    }

    if (status < 200 || status >= 300) {
      response.resume()
      throw new Error(`The resource returned HTTP ${status}.`)
    }
    const contentEncoding = getHeader(response, "content-encoding")?.trim().toLocaleLowerCase()
    if (contentEncoding && contentEncoding !== "identity") {
      response.resume()
      throw new Error(`Unsupported response encoding '${contentEncoding}'.`)
    }
    const contentType = getHeader(response, "content-type")?.split(";", 1)[0].trim().toLocaleLowerCase() ?? ""
    if (!ALLOWED_CONTENT_TYPES.some((allowed) => contentType === allowed || contentType.endsWith("+json"))) {
      response.resume()
      throw new Error(`Unsupported response type '${contentType || "unknown"}'. Open HTML and other dynamic content in a browser tab.`)
    }

    const { body, truncated } = await readLimitedBody(response)
    return { url: url.toString(), status, contentType, body, truncated }
  }
  throw new Error("The resource exceeded the redirect limit.")
}

interface ResolvedAddress {
  address: string
  family: 4 | 6
}

async function resolvePublicHttpsUrl(url: URL): Promise<ResolvedAddress> {
  if (url.protocol !== "https:") throw new Error("Only public HTTPS resources can be fetched.")
  if (url.username || url.password) throw new Error("Resource URLs cannot contain credentials.")
  const hostname = normalizeHostname(url.hostname)
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Private network resources cannot be fetched.")
  }
  const ipFamily = isIP(hostname)
  const addresses: ResolvedAddress[] = ipFamily
    ? [{ address: hostname, family: ipFamily as 4 | 6 }]
    : (await lookup(hostname, { all: true })).flatMap(({ address, family }) =>
        family === 4 || family === 6 ? [{ address, family }] : [],
      )
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error("Private network resources cannot be fetched.")
  }
  return addresses.find(({ family }) => family === 4) ?? addresses[0]
}

export function isPublicIpAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast"
  } catch {
    return false
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLocaleLowerCase()
}

function requestPublicResource(
  url: URL,
  resolvedAddress: ResolvedAddress,
  signal: AbortSignal,
): Promise<IncomingMessage> {
  const hostname = normalizeHostname(url.hostname)
  return new Promise((resolve, reject) => {
    const outgoingRequest = request({
      protocol: "https:",
      hostname: resolvedAddress.address,
      family: resolvedAddress.family,
      port: url.port || 443,
      method: "GET",
      path: `${url.pathname}${url.search}`,
      servername: isIP(hostname) ? undefined : hostname,
      setHost: false,
      maxHeaderSize: MAX_RESPONSE_HEADER_BYTES,
      headers: {
        Accept: ACCEPT_HEADER,
        "Accept-Encoding": "identity",
        Host: url.host,
      },
      signal,
    }, resolve)
    outgoingRequest.once("error", reject)
    outgoingRequest.end()
  })
}

function getHeader(response: IncomingMessage, name: string): string | undefined {
  const value = response.headers[name]
  return Array.isArray(value) ? value[0] : value
}

async function readLimitedBody(response: IncomingMessage): Promise<{ body: string; truncated: boolean }> {
  const chunks: Buffer[] = []
  let byteLength = 0
  let truncated = false
  for await (const value of response) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
    const remaining = MAX_RESPONSE_BYTES - byteLength
    if (chunk.byteLength > remaining) {
      chunks.push(chunk.subarray(0, remaining))
      truncated = true
      response.destroy()
      break
    }
    chunks.push(chunk)
    byteLength += chunk.byteLength
  }
  return { body: Buffer.concat(chunks).toString("utf8"), truncated }
}