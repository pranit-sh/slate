import { useEffect, useState } from "react"
import type { NextUpRecommendation } from "../../../../../shared/electron-api"

export function useNextUp() {
  const [recommendations, setRecommendations] = useState<NextUpRecommendation[]>([])

  useEffect(() => {
    let isSubscribed = true
    const removeListener = window.electron.browser.onNextUpRecommendationsChanged(
      setRecommendations,
    )

    void window.electron.browser.getNextUpRecommendations().then((items) => {
      if (isSubscribed) setRecommendations(items)
    }).catch((error) => console.error("Failed to load Next up recommendations", error))

    return () => {
      isSubscribed = false
      removeListener()
    }
  }, [])

  function dismiss(recommendation: NextUpRecommendation): void {
    setRecommendations((items) => items.filter((item) => item.id !== recommendation.id))
    void window.electron.browser.dismissNextUpRecommendation(recommendation.id)
  }

  return { recommendations, dismiss }
}