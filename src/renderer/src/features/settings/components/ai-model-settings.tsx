import { type FormEvent, useEffect, useState } from "react"
import { Bot, CircleAlert, Plus, RefreshCw, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { AiConnectionStatus, AiModel, AiProvider, AiSettings } from "../../../../../shared/electron-api"

const EMPTY_AI_SETTINGS: AiSettings = { activeModelId: null, models: [] }
const PROVIDER_OPTIONS: Array<{
  value: AiProvider
  label: string
  modelExample: string
  endpointExample: string
  faviconUrl: string
}> = [
  {
    value: "openai",
    label: "OpenAI",
    modelExample: "gpt-5-mini",
    endpointExample: "https://api.openai.com/v1",
    faviconUrl: "https://openai.com/favicon.ico",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    modelExample: "claude-sonnet-4-5",
    endpointExample: "https://api.anthropic.com/v1",
    faviconUrl: "https://www.anthropic.com/favicon.ico",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    modelExample: "gemini-2.5-flash",
    endpointExample: "https://generativelanguage.googleapis.com/v1beta",
    faviconUrl: "https://www.google.com/favicon.ico",
  },
]

interface ModelForm {
  id?: string
  name: string
  provider: AiProvider
  model: string
  endpoint: string
  apiKey: string
}

const EMPTY_MODEL_FORM: ModelForm = {
  name: "",
  provider: "openai",
  model: "",
  endpoint: "",
  apiKey: "",
}

type ConnectionState = AiConnectionStatus | { state: "checking" }

function ProviderOption({ provider }: { provider: (typeof PROVIDER_OPTIONS)[number] }) {
  return (
    <span className="flex items-center gap-2">
      <img src={provider.faviconUrl} alt="" className="size-4 rounded-sm object-contain" />
      <span>{provider.label}</span>
    </span>
  )
}

function ConnectionStatus({ status }: { status: ConnectionState | undefined }) {
  if (!status) return null
  if (status.state === "checking") return <Badge variant="outline">Checking…</Badge>
  if (status.state === "connected") return <Badge variant="secondary">Connected</Badge>
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="cursor-default gap-1">
            <CircleAlert />
            Error
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{status.message}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function AiModelSettings() {
  const [aiSettings, setAiSettings] = useState(EMPTY_AI_SETTINGS)
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false)
  const [modelForm, setModelForm] = useState<ModelForm>(EMPTY_MODEL_FORM)
  const [modelError, setModelError] = useState("")
  const [isSavingModel, setIsSavingModel] = useState(false)
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, ConnectionState>>({})

  function checkConnection(id: string): void {
    setConnectionStatuses((current) => ({ ...current, [id]: { state: "checking" } }))
    void window.electron.browser.testAiModelConnection(id).then((status) => {
      setConnectionStatuses((current) => ({ ...current, [id]: status }))
    })
  }

  useEffect(() => {
    void window.electron.browser.getAiSettings().then((storedAiSettings) => {
      setAiSettings(storedAiSettings)
      for (const model of storedAiSettings.models) checkConnection(model.id)
    })
  }, [])

  function openNewModelDialog(): void {
    setModelForm(EMPTY_MODEL_FORM)
    setModelError("")
    setIsModelDialogOpen(true)
  }

  function openEditModelDialog(model: AiModel): void {
    setModelForm({
      id: model.id,
      name: model.name,
      provider: model.provider,
      model: model.model,
      endpoint: model.endpoint,
      apiKey: "",
    })
    setModelError("")
    setIsModelDialogOpen(true)
  }

  async function saveModel(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSavingModel(true)
    setModelError("")
    try {
      const nextSettings = await window.electron.browser.saveAiModel({
        ...modelForm,
        apiKey: modelForm.apiKey || undefined,
      })
      setAiSettings(nextSettings)
      setIsModelDialogOpen(false)
      const savedId = modelForm.id ?? nextSettings.models.find(
        (model) => !aiSettings.models.some((existing) => existing.id === model.id),
      )?.id
      if (savedId) checkConnection(savedId)
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "Could not save this model.")
    } finally {
      setIsSavingModel(false)
    }
  }

  return (
    <>
      <section aria-labelledby="ai-model-settings" className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="ai-model-settings" className="text-sm font-normal text-muted-foreground">AI models</h2>
          <Button type="button" size="sm" variant="outline" onClick={openNewModelDialog}>
            <Plus />
            Add model
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          {aiSettings.models.length === 0 ? (
            <div className="flex min-h-28 items-center gap-3 px-4 py-5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm">No AI models configured</div>
                <div className="text-xs text-muted-foreground">
                  Add a provider model and API key to use the agent panel.
                </div>
              </div>
            </div>
          ) : (
            aiSettings.models.map((model, index) => (
              <div key={model.id}>
                {index > 0 && <Separator />}
                <div className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    onClick={() => openEditModelDialog(model)}
                    aria-label={`Edit ${model.name}`}
                  >
                    <img
                      src={PROVIDER_OPTIONS.find((provider) => provider.value === model.provider)?.faviconUrl}
                      alt=""
                      className="size-5 shrink-0 rounded-sm object-contain"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{model.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {PROVIDER_OPTIONS.find((provider) => provider.value === model.provider)?.label}
                        {" · "}{model.model}
                      </span>
                    </span>
                  </button>
                  <ConnectionStatus status={connectionStatuses[model.id]} />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => checkConnection(model.id)}
                    disabled={connectionStatuses[model.id]?.state === "checking"}
                    aria-label={`Test connection for ${model.name}`}
                    title="Test connection"
                  >
                    <RefreshCw
                      className={connectionStatuses[model.id]?.state === "checking" ? "animate-spin" : undefined}
                    />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${model.name}`}
                        title="Delete model"
                      >
                        <X />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {model.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the model and its stored API key from this device.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            void window.electron.browser.deleteAiModel(model.id).then(setAiSettings)
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          API keys are encrypted using your operating system credentials and are never exposed to web pages.
        </p>
      </section>

      <Dialog open={isModelDialogOpen} onOpenChange={setIsModelDialogOpen}>
        <DialogContent>
          <form onSubmit={(event) => void saveModel(event)}>
            <DialogHeader>
              <DialogTitle>{modelForm.id ? "Edit AI model" : "Add AI model"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-5">
              <label className="grid gap-1.5 text-sm" htmlFor="model-name">
                Name
                <Input
                  id="model-name"
                  value={modelForm.name}
                  onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })}
                  placeholder="Work assistant"
                  autoFocus
                  required
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="grid gap-1.5 text-sm">
                  Provider
                  <Select
                    value={modelForm.provider}
                    onValueChange={(provider) => {
                      setModelForm({ ...modelForm, provider: provider as AiProvider, endpoint: "" })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <ProviderOption
                        provider={PROVIDER_OPTIONS.find((provider) => provider.value === modelForm.provider)!}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          <ProviderOption provider={provider} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-sm" htmlFor="model-id">
                  Model ID
                  <Input
                    id="model-id"
                    value={modelForm.model}
                    onChange={(event) => setModelForm({ ...modelForm, model: event.target.value })}
                    placeholder={PROVIDER_OPTIONS.find((provider) => provider.value === modelForm.provider)?.modelExample}
                    required
                    spellCheck={false}
                  />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm" htmlFor="model-endpoint">
                Endpoint
                <Input
                  id="model-endpoint"
                  type="url"
                  value={modelForm.endpoint}
                  onChange={(event) => setModelForm({ ...modelForm, endpoint: event.target.value })}
                  placeholder={PROVIDER_OPTIONS.find((provider) => provider.value === modelForm.provider)?.endpointExample}
                  spellCheck={false}
                />
              </label>
              <label className="grid gap-1.5 text-sm" htmlFor="api-key">
                API key
                <Input
                  id="api-key"
                  type="password"
                  value={modelForm.apiKey}
                  onChange={(event) => setModelForm({ ...modelForm, apiKey: event.target.value })}
                  placeholder={modelForm.id ? "Leave blank to keep the saved key" : "Enter API key"}
                  autoComplete="new-password"
                  required={!modelForm.id}
                />
              </label>
              {modelError && <p className="text-sm text-destructive" role="alert">{modelError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModelDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSavingModel}>
                {isSavingModel ? "Saving…" : "Save model"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}