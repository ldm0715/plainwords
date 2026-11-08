import { useState } from "react"
import { Mic, SendHorizonal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ui } from "@/lib/i18n"

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

const PLACEHOLDERS = [
  ['Try: "swap half my SOL into USDC"', '试试:"把我一半的 SOL 换成 USDC"'],
  ['Try: "send 0.1 SOL to <address>"', '试试:"给 <地址> 转 0.1 SOL"'],
  ['Try: "how much do I have?"', '试试:"我现在有多少钱?"'],
]

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("")
  const [placeholderIdx] = useState(() => Math.floor(Math.random() * PLACEHOLDERS.length))
  const ph = PLACEHOLDERS[placeholderIdx]

  const send = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText("")
  }

  return (
    <div className="border-t bg-card px-3 pt-3 pb-4">
      <div className="border-input bg-background flex items-end gap-2 rounded-2xl border p-2 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          title={ui("Voice input — coming in P2", "语音输入 — P2 阶段")}
          disabled
          aria-label="Voice input coming soon"
        >
          <Mic />
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          placeholder={ui(ph[0], ph[1])}
          className="max-h-32 min-h-9 min-w-0 flex-1 resize-none border-0 px-1 py-1.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button size="icon" className="shrink-0" onClick={send} disabled={disabled || !text.trim()} aria-label="Send">
          <SendHorizonal />
        </Button>
      </div>
      <p className="text-muted-foreground mt-1.5 px-2 text-center text-[11px]">
        {ui(
          "PlainWords prepares everything — nothing moves until you confirm.",
          "PlainWords 只做准备 — 未经你确认,链上分文不动。",
        )}
      </p>
    </div>
  )
}
