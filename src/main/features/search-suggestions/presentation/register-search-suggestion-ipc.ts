import { ipcMain, type IpcMainInvokeEvent } from "electron"
import { IPC_CHANNELS } from "../../../../shared/electron-api"
import type { SearchSuggestionService } from "../application/search-suggestion-service"

interface SearchSuggestionContext {
  setSearchSuggestionCount(query: string, count: number): void
}

interface RegisterSearchSuggestionIpcOptions {
  service: SearchSuggestionService
  getContext(event: IpcMainInvokeEvent): SearchSuggestionContext | undefined
}

export function registerSearchSuggestionIpc(options: RegisterSearchSuggestionIpcOptions): void {
  ipcMain.handle(IPC_CHANNELS.getSearchSuggestions, async (event, query: string) => {
    const context = options.getContext(event)
    if (!context || typeof query !== "string") return []

    const suggestions = await options.service.getSuggestions(query)
    context.setSearchSuggestionCount(query, suggestions.length)
    return suggestions
  })
}