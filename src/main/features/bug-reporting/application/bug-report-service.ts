import type { ExternalUrlOpener } from "./bug-report-ports"

const NEW_ISSUE_URL = "https://github.com/pranit-sh/slate/issues/new"

interface BugReportServiceOptions {
  appVersion: string
  operatingSystem: string
  externalUrlOpener: ExternalUrlOpener
}

export class BugReportService {
  constructor(private readonly options: BugReportServiceOptions) {}

  open(): Promise<void> {
    const url = new URL(NEW_ISSUE_URL)
    url.searchParams.set("labels", "bug")
    url.searchParams.set("title", "[Bug]: ")
    url.searchParams.set(
      "body",
      [
        "### What happened?",
        "",
        "",
        "### Environment",
        `- Slate: ${this.options.appVersion}`,
        `- OS: ${this.options.operatingSystem}`,
      ].join("\n"),
    )
    return this.options.externalUrlOpener.open(url.toString())
  }
}