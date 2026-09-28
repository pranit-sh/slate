import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_REDIRECTS = 5
const MAX_RESPONSE_BYTES = 100_000
const REQUEST_TIMEOUT_MS = 10_000
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
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicHttpsUrl(url)
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
      : AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    const response = await fetch(url, {
      headers: { Accept: "application/json, application/xml, text/csv, text/plain, text/xml" },
      redirect: "manual",
      signal: requestSignal,
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) throw new Error(`The resource returned redirect status ${response.status} without a location.`)
      if (redirectCount === MAX_REDIRECTS) throw new Error("The resource exceeded the redirect limit.")
      url = new URL(location, url)
      continue
    }

    if (!response.ok) throw new Error(`The resource returned HTTP ${response.status}.`)
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLocaleLowerCase() ?? ""
    if (!ALLOWED_CONTENT_TYPES.some((allowed) => contentType === allowed || contentType.endsWith("+json"))) {
      throw new Error(`Unsupported response type '${contentType || "unknown"}'. Open HTML and other dynamic content in a browser tab.`)
    }

    const { body, truncated } = await readLimitedBody(response)
    return { url: url.toString(), status: response.status, contentType, body, truncated }
  }
  throw new Error("The resource exceeded the redirect limit.")
}

async function assertPublicHttpsUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new Error("Only public HTTPS resources can be fetched.")
  if (url.username || url.password) throw new Error("Resource URLs cannot contain credentials.")
  const hostname = url.hostname.toLocaleLowerCase()
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Private network resources cannot be fetched.")
  }
  const addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true })).map(({ address }) => address)
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("Private network resources cannot be fetched.")
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [first, second] = address.split(".").map(Number)
    return first === 0
      || first === 10
      || first === 127
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && (second === 0 || second === 168))
      || (first === 198 && (second === 18 || second === 19))
      || first >= 224
  }
  const normalized = address.toLocaleLowerCase()
  if (normalized.startsWith("::ffff:")) return isPrivateAddress(normalized.slice(7))
  return normalized === "::"
    || normalized === "::1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("ff")
    || normalized.startsWith("2001:db8:")
}

async function readLimitedBody(response: Response): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: "", truncated: false }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  let truncated = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const remaining = MAX_RESPONSE_BYTES - byteLength
    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, remaining))
      truncated = true
      await reader.cancel()
      break
    }
    chunks.push(value)
    byteLength += value.byteLength
  }
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { body: new TextDecoder().decode(bytes), truncated }
}