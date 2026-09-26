export interface ExternalUrlOpener {
  open(url: string): Promise<void>
}