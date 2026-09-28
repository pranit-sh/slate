import type { AiUiValue } from "../../../../../../../shared/electron-api"

export function formatUiValue(value: AiUiValue): string {
  if (value === null) return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}