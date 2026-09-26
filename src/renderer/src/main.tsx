import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import { OmniboxSurface } from "./features/omnibox"
import { VisitsPage } from "./features/visits"
import { SettingsPage } from "./features/settings"
import { SavedSitesPage } from "./features/saved-sites"
import { DownloadsPage } from "./features/downloads"
import SiteSettingsApp from "./SiteSettingsApp"
import "./index.css"

const isTabPicker = window.location.hash === "#tab-picker"
const isVisits = window.location.hash === "#visits"
const isSettings = window.location.hash === "#settings"
const isSaved = window.location.hash === "#saved"
const isDownloads = window.location.hash === "#downloads"
const isSiteSettings = window.location.hash === "#site-settings"
if (isTabPicker || isSiteSettings) document.documentElement.dataset.surface = "tab-picker"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isTabPicker ? <OmniboxSurface /> : isSiteSettings ? <SiteSettingsApp /> : isVisits ? <VisitsPage /> : isSaved ? <SavedSitesPage /> : isDownloads ? <DownloadsPage /> : isSettings ? <SettingsPage /> : <App />}
  </StrictMode>,
)