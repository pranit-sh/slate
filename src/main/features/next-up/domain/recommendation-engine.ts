import type { NextUpReason, NextUpRecommendation, Visit } from "../../../../shared/electron-api"

const MAX_HISTORY_AGE_DAYS = 180
const RECENCY_HALF_LIFE_DAYS = 30
const TIME_WINDOW_MINUTES = 90
const MIN_VISITS = 3
const MIN_DISTINCT_DAYS = 2
const MIN_CONFIDENCE = 0.42

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
])

const SENSITIVE_PARAMETERS = new Set([
  "access_token",
  "auth",
  "code",
  "id_token",
  "session",
  "state",
  "token",
])

interface RecommendationCandidate {
  id: string
  origin: string
  url: string
  title: string
  faviconUrl: string
  visitedAt: Date[]
  lastVisitedAt: Date
}

export interface NextUpOptions {
  now?: Date
  limit?: number
  excludedUrls?: Iterable<string>
  dismissedIds?: Iterable<string>
}

function getCircularMinuteDistance(left: Date, right: Date): number {
  const leftMinutes = left.getHours() * 60 + left.getMinutes()
  const rightMinutes = right.getHours() * 60 + right.getMinutes()
  const distance = Math.abs(leftMinutes - rightMinutes)
  return Math.min(distance, 24 * 60 - distance)
}

function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day > 0 && day < 6
}

function getDayAffinity(visitedAt: Date, now: Date): number {
  if (visitedAt.getDay() === now.getDay()) return 1
  return isWeekday(visitedAt) === isWeekday(now) ? 0.65 : 0.25
}

function getDayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function getWeekKey(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 1)
  const dayOffset = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  return `${date.getFullYear()}-${Math.floor((dayOffset + start.getDay()) / 7)}`
}

function isSearchResultsUrl(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, "")
  if (host === "google.com" && url.pathname === "/search") return true
  if (host === "bing.com" && url.pathname === "/search") return true
  if (host === "duckduckgo.com" && url.searchParams.has("q")) return true
  return host === "search.brave.com" && url.pathname === "/search"
}

export function normalizeRecommendationUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (isSearchResultsUrl(url)) return null
    if (/(^|\/)(auth|callback|login|logout|oauth|signin)(\/|$)/i.test(url.pathname)) return null
    if ([...url.searchParams.keys()].some((key) => SENSITIVE_PARAMETERS.has(key.toLowerCase()))) {
      return null
    }

    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) {
        url.searchParams.delete(key)
      }
    }
    return url.toString()
  } catch {
    return null
  }
}

function collectCandidates(visits: Visit[], now: Date): RecommendationCandidate[] {
  const candidates = new Map<string, RecommendationCandidate>()
  const oldestAllowedTime = now.getTime() - MAX_HISTORY_AGE_DAYS * 86_400_000

  for (const visit of visits) {
    const normalizedUrl = normalizeRecommendationUrl(visit.url)
    if (!normalizedUrl) continue

    const visitTimes = visit.visitTimes
      .map((value) => new Date(value))
      .filter((date) => Number.isFinite(date.getTime()) && date.getTime() <= now.getTime() && date.getTime() >= oldestAllowedTime)
    if (visitTimes.length === 0) continue

    const mostRecentTime = visitTimes.reduce((latest, date) => date > latest ? date : latest)
    const existing = candidates.get(normalizedUrl)
    if (existing) {
      existing.visitedAt.push(...visitTimes)
      if (mostRecentTime > existing.lastVisitedAt) {
        existing.title = visit.title
        existing.faviconUrl = visit.faviconUrl
        existing.lastVisitedAt = mostRecentTime
      }
      continue
    }

    const url = new URL(normalizedUrl)
    candidates.set(normalizedUrl, {
      id: normalizedUrl,
      origin: url.origin,
      url: normalizedUrl,
      title: visit.title || url.hostname,
      faviconUrl: visit.faviconUrl,
      visitedAt: visitTimes,
      lastVisitedAt: mostRecentTime,
    })
  }

  return [...candidates.values()]
}

function scoreCandidate(candidate: RecommendationCandidate, now: Date): NextUpRecommendation | null {
  const distinctDays = new Set(candidate.visitedAt.map(getDayKey))
  if (candidate.visitedAt.length < MIN_VISITS || distinctDays.size < MIN_DISTINCT_DAYS) return null

  let recencyWeightTotal = 0
  let weightedTimeAffinity = 0
  let weightedDayAffinity = 0
  for (const visitedAt of candidate.visitedAt) {
    const ageDays = (now.getTime() - visitedAt.getTime()) / 86_400_000
    const recencyWeight = 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS)
    const minuteDistance = getCircularMinuteDistance(visitedAt, now)
    const timeAffinity = Math.exp(-0.5 * (minuteDistance / TIME_WINDOW_MINUTES) ** 2)
    recencyWeightTotal += recencyWeight
    weightedTimeAffinity += timeAffinity * recencyWeight
    weightedDayAffinity += getDayAffinity(visitedAt, now) * recencyWeight
  }

  const timeAffinity = weightedTimeAffinity / recencyWeightTotal
  const dayAffinity = weightedDayAffinity / recencyWeightTotal
  const distinctWeeks = new Set(candidate.visitedAt.map(getWeekKey)).size
  const recurrence = 0.7 * Math.min(distinctDays.size / 5, 1)
    + 0.3 * Math.min(distinctWeeks / 3, 1)
  const ageDays = (now.getTime() - candidate.lastVisitedAt.getTime()) / 86_400_000
  const recency = 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS)
  const frequency = Math.min(Math.log1p(candidate.visitedAt.length) / Math.log1p(12), 1)
  const confidence = 0.4 * timeAffinity
    + 0.2 * dayAffinity
    + 0.15 * recurrence
    + 0.15 * recency
    + 0.1 * frequency
  if (confidence < MIN_CONFIDENCE) return null

  const reason: NextUpReason = timeAffinity >= 0.55
    ? "usual-time"
    : dayAffinity >= 0.65 ? "usual-day" : "frequent"
  return {
    id: candidate.id,
    title: candidate.title,
    url: candidate.url,
    faviconUrl: candidate.faviconUrl,
    reason,
    confidence,
  }
}

export function getNextUpRecommendations(
  visits: Visit[],
  options: NextUpOptions = {},
): NextUpRecommendation[] {
  const now = options.now ?? new Date()
  const limit = Math.max(0, options.limit ?? 3)
  const excludedUrls = new Set(
    [...(options.excludedUrls ?? [])]
      .map(normalizeRecommendationUrl)
      .filter((url): url is string => Boolean(url)),
  )
  const dismissedIds = new Set(options.dismissedIds ?? [])
  const selectedOrigins = new Set<string>()

  return collectCandidates(visits, now)
    .filter((candidate) => !excludedUrls.has(candidate.id) && !dismissedIds.has(candidate.id))
    .map((candidate) => ({ candidate, recommendation: scoreCandidate(candidate, now) }))
    .filter((item): item is { candidate: RecommendationCandidate; recommendation: NextUpRecommendation } => Boolean(item.recommendation))
    .sort((left, right) => right.recommendation.confidence - left.recommendation.confidence)
    .flatMap(({ candidate, recommendation }) => {
      if (selectedOrigins.has(candidate.origin)) return []
      selectedOrigins.add(candidate.origin)
      return recommendation
    })
    .slice(0, limit)
}