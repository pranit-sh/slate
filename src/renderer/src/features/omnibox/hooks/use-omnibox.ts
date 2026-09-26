import { useEffect, useRef, useState } from "react"
import type { BrowserTabsState } from "../../../../../shared/electron-api"
import { getBrowserCommands } from "../commands/browser-command-registry"

const INITIAL_TABS_STATE: BrowserTabsState = {
  activeTabId: null,
  isActiveTabGhost: false,
  isActiveTabLoading: false,
  tabs: [],
}

export function useOmnibox() {
  const [tabsState, setTabsState] = useState(INITIAL_TABS_STATE)
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isQueryEdited, setIsQueryEdited] = useState(false)
  const [selectedValue, setSelectedValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const isCommandMode = normalizedQuery.startsWith(">")
  const commandQuery = normalizedQuery.slice(1).trim()
  const commands = getBrowserCommands().filter((command) => {
    if (!commandQuery) return true
    return `${command.label} ${command.keywords.join(" ")}`
      .toLocaleLowerCase()
      .includes(commandQuery)
  })
  const tabs = tabsState.tabs.filter((tab) => {
    if (isCommandMode) return false
    if (!isQueryEdited || !normalizedQuery) return true
    return `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(normalizedQuery)
  })

  useEffect(() => {
    const removeTabsListener = window.electron.browser.onTabsChanged(setTabsState)
    const removeQueryListener = window.electron.browser.onTabPickerQueryChanged(setQuery)
    const removeOpenedListener = window.electron.browser.onTabPickerOpened(() => {
      setIsQueryEdited(false)
      setSelectedValue("")
      setSuggestions([])
      requestAnimationFrame(() => {
        const input = inputRef.current
        if (!input) return
        input.focus()
        if (input.value.startsWith(">")) {
          input.setSelectionRange(input.value.length, input.value.length)
        } else {
          input.select()
        }
      })
    })
    void window.electron.browser.getTabs().then(setTabsState)

    return () => {
      removeTabsListener()
      removeQueryListener()
      removeOpenedListener()
    }
  }, [])

  useEffect(() => {
    const input = query.trim()
    setSuggestions([])
    if (!input || input.startsWith(">") || !isQueryEdited) return

    let isCurrent = true
    const timeout = window.setTimeout(() => {
      void window.electron.browser.getSearchSuggestions(input).then((results) => {
        if (isCurrent) setSuggestions(results)
      })
    }, 150)

    return () => {
      isCurrent = false
      window.clearTimeout(timeout)
    }
  }, [isQueryEdited, query])

  useEffect(() => {
    window.electron.browser.setTabPickerCommandCount(isCommandMode ? commands.length : 0)
  }, [commands.length, isCommandMode])

  function updateQuery(value: string): void {
    setQuery(value)
    setIsQueryEdited(true)
    window.electron.browser.setTabPickerQuery(value, true)
  }

  return {
    activeTabId: tabsState.activeTabId,
    commands,
    inputRef,
    isCommandMode,
    isQueryEdited,
    query,
    selectedValue,
    setSelectedValue,
    suggestions,
    tabs,
    updateQuery,
  }
}