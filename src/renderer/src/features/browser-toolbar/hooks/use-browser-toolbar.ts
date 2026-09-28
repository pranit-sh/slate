import { useEffect, useRef, useState } from "react"
import type {
  AddressBarFeedback,
  BrowserNavigationState,
  BrowserTabsState,
} from "../../../../../shared/electron-api"

const INITIAL_TABS_STATE: BrowserTabsState = {
  activeTabId: null,
  isActiveTabGhost: false,
  isActiveTabLoading: false,
  tabs: [],
}

export function useBrowserToolbar() {
  const [address, setAddress] = useState("")
  const [tabsState, setTabsState] = useState(INITIAL_TABS_STATE)
  const [navigationState, setNavigationState] = useState<BrowserNavigationState>({
    canGoBack: false,
    canGoForward: false,
  })
  const [addressBarFeedback, setAddressBarFeedback] = useState<AddressBarFeedback | null>(null)
  const [isOmniboxOpen, setIsOmniboxOpen] = useState(false)
  const addressButtonRef = useRef<HTMLButtonElement>(null)
  const addressBarFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const removeFocusListener = window.electron.browser.onFocus(() => {
      addressButtonRef.current?.blur()
      setIsOmniboxOpen(false)
    })
    const removeUrlListener = window.electron.browser.onUrlChanged(setAddress)
    const removeTabsListener = window.electron.browser.onTabsChanged(setTabsState)
    const removeNavigationStateListener =
      window.electron.browser.onNavigationStateChanged(setNavigationState)
    const removeAddressBarFeedbackListener = window.electron.browser.onAddressBarFeedback(
      (feedback) => {
        if (addressBarFeedbackTimerRef.current) {
          clearTimeout(addressBarFeedbackTimerRef.current)
        }
        setAddressBarFeedback(feedback)
        addressBarFeedbackTimerRef.current = setTimeout(() => {
          setAddressBarFeedback(null)
          addressBarFeedbackTimerRef.current = null
        }, 1_500)
      },
    )
    let isSubscribed = true

    void window.electron.browser.getTabs().then((state) => {
      if (!isSubscribed) return

      setTabsState(state)
      setAddress(state.tabs.find((tab) => tab.id === state.activeTabId)?.url ?? "")
    })
    void window.electron.browser.getNavigationState().then((state) => {
      if (isSubscribed) setNavigationState(state)
    })

    return () => {
      isSubscribed = false
      removeFocusListener()
      removeUrlListener()
      removeTabsListener()
      removeNavigationStateListener()
      removeAddressBarFeedbackListener()
      if (addressBarFeedbackTimerRef.current) clearTimeout(addressBarFeedbackTimerRef.current)
    }
  }, [])

  useEffect(() => {
    window.electron.browser.setTabPickerVisible(isOmniboxOpen)
  }, [isOmniboxOpen])

  useEffect(
    () => () => window.electron.browser.setTabPickerVisible(false),
    [],
  )

  function createTab(): void {
    setAddress("")
    setIsOmniboxOpen(false)
    window.electron.browser.newTab()
  }

  function createGhostTab(): void {
    setAddress("")
    setIsOmniboxOpen(false)
    window.electron.browser.newGhostTab()
  }

  function blurAddress(): void {
    addressButtonRef.current?.blur()
    setIsOmniboxOpen(false)
  }

  function openOmnibox(): void {
    if (addressBarFeedbackTimerRef.current) {
      clearTimeout(addressBarFeedbackTimerRef.current)
      addressBarFeedbackTimerRef.current = null
    }
    setAddressBarFeedback(null)
    window.electron.browser.setTabPickerQuery(address, false)
    setIsOmniboxOpen(true)
  }

  return {
    activeTab: tabsState.tabs.find((tab) => tab.id === tabsState.activeTabId) ?? null,
    address,
    addressButtonRef,
    blurAddress,
    addressBarFeedback,
    canGoBack: navigationState.canGoBack,
    canGoForward: navigationState.canGoForward,
    closeOmnibox: () => setIsOmniboxOpen(false),
    createGhostTab,
    createTab,
    isGhostTab: tabsState.isActiveTabGhost,
    isLoading: tabsState.isActiveTabLoading,
    isOmniboxOpen,
    openOmnibox,
  }
}