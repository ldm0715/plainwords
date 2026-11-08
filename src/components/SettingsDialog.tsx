// Settings dialog — UI language switch + runtime LLM configuration.
// The LLM section lets anyone point the app at their own OpenAI-compatible
// endpoint (URL + key + model picked from the live /models list) — stored in
// localStorage only, so the repo never carries keys. Empty fields fall back
// to the build-time defaults from .env.

import { useEffect, useState } from "react"
import { Eye, EyeOff, Languages, Loader2, RefreshCw, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getUILang, setUILang, ui, type Lang } from "@/lib/i18n"
import { applyLLMConfig, fetchModels, getLLMConfig, loadLLMConfig } from "@/lib/ai"

interface Props {
  open: boolean
  onClose: () => void
  onChange: (lang: Lang) => void
}

export function SettingsDialog({ open, onClose, onChange }: Props) {
  const current = getUILang()

  const pick = (lang: Lang) => {
    setUILang(lang)
    onChange(lang)
  }

  // --- LLM config form ---
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [showKey, setShowKey] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!open) return
    const cfg = getLLMConfig()
    setBaseUrl(cfg.baseUrl)
    setApiKey(cfg.apiKey)
    setModel(cfg.model)
    setModels([])
    setModelsError(null)
    setSaved(false)
  }, [open])

  const loadModels = async () => {
    setLoadingModels(true)
    setModelsError(null)
    try {
      const ids = await fetchModels({ baseUrl, apiKey })
      setModels(ids)
      if (!ids.length) setModelsError(ui("Endpoint returned no models.", "端点没有返回模型。"))
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoadingModels(false)
    }
  }

  const save = () => {
    applyLLMConfig({
      baseUrl: baseUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      model: model.trim() || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    // reflect the stored subset (clearing a field falls back to env defaults)
    const stored = loadLLMConfig()
    setBaseUrl(stored.baseUrl ?? baseUrl)
    setModel(stored.model ?? model)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-4 text-muted-foreground" />
            {ui("Settings", "设置")}
          </DialogTitle>
          <DialogDescription>
            {ui("Interface language — applies to buttons, tabs and panels.", "界面语言 — 应用于按钮、标签和面板。")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-active={current === "en"}
            onClick={() => pick("en")}
            className={
              current === "en"
                ? "bg-muted border-border flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium"
                : "text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium transition-colors"
            }
          >
            <Languages className="size-4" /> English
          </button>
          <button
            type="button"
            data-active={current === "zh"}
            onClick={() => pick("zh")}
            className={
              current === "zh"
                ? "bg-muted border-border flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium"
                : "text-muted-foreground hover:bg-muted/50 flex items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium transition-colors"
            }
          >
            <Languages className="size-4" /> 中文
          </button>
        </div>

        <p className="text-muted-foreground text-center text-[11px]">
          {ui(
            "Chat replies follow the language you type in, regardless of this setting.",
            "聊天回复跟随你输入的语言,与此设置无关。",
          )}
        </p>

        {/* --- LLM configuration --- */}
        <div className="border-t pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              {ui("Model endpoint", "模型端点")}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-2"
              onClick={() => {
                setBaseUrl("")
                setApiKey("")
                setModel("")
                applyLLMConfig({})
                setModels([])
              }}
            >
              {ui("Reset to defaults", "恢复默认")}
            </button>
          </div>
          <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
            {ui(
              "Any OpenAI-compatible endpoint. Stored only in this browser — never sent to our servers or committed to the repo. Leave empty to use the built-in default.",
              "任意 OpenAI 兼容端点。仅保存在本浏览器 — 不会上传或写入仓库。留空则使用内置默认值。",
            )}
          </p>
          <div className="space-y-2">
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={ui("API base URL, e.g. https://open.bigmodel.cn/api/paas/v4", "API 地址,如 https://open.bigmodel.cn/api/paas/v4")}
              className="font-mono text-xs"
              aria-label="API base URL"
            />
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={ui("API key", "API 密钥")}
                className="pr-9 font-mono text-xs"
                aria-label="API key"
              />
              <button
                type="button"
                aria-label={showKey ? ui("Hide key", "隐藏密钥") : ui("Show key", "显示密钥")}
                onClick={() => setShowKey((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={ui("Model id", "模型名")}
                className="pr-9 font-mono text-xs"
                aria-label="Model id"
              />
              <button
                type="button"
                aria-label={ui("Fetch model list", "获取模型列表")}
                title={ui("Fetch model list", "获取模型列表")}
                disabled={!baseUrl.trim() || !apiKey.trim() || loadingModels}
                onClick={loadModels}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 disabled:opacity-40"
              >
                {loadingModels ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
              </button>
            </div>
            {models.length > 0 && (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger
                  className="w-full font-mono text-xs"
                  aria-label={ui("Pick a model", "选择模型")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {!models.includes(model) && model && (
                    <SelectItem value={model}>{model}</SelectItem>
                  )}
                  {models.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {modelsError && <p className="text-destructive text-[11px]">{modelsError}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {ui("Close", "关闭")}
          </Button>
          <Button onClick={save}>{saved ? ui("Saved ✓", "已保存 ✓") : ui("Save", "保存")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
