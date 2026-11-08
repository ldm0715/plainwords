import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { ContactConfirmCard } from "@/components/ContactConfirmCard"
import { ConfirmCard } from "@/components/ConfirmCard"
import { Markdown } from "@/components/Markdown"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatMessage as Msg } from "@/lib/types"

interface Props {
  messages: Msg[]
  busy: boolean
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
  onContactConfirm: (id: string) => void
  onContactCancel: (id: string) => void
}

export function ChatWindow({
  messages,
  busy,
  onConfirm,
  onCancel,
  onContactConfirm,
  onContactCancel,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, busy])

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="space-y-3 px-3 py-4">
        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap">
                  {m.text}
                </div>
              </div>
            )
          }
          if (m.role === "assistant") {
            return (
              <div key={m.id} className="flex justify-start">
                <div className="bg-muted min-w-0 max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2 text-sm">
                  <Markdown text={m.text} />
                </div>
              </div>
            )
          }
          return m.role === "contact-confirm" ? (
            <ContactConfirmCard
              key={m.id}
              message={m}
              onConfirm={onContactConfirm}
              onCancel={onContactCancel}
            />
          ) : (
            <ConfirmCard key={m.id} message={m} onConfirm={onConfirm} onCancel={onCancel} />
          )
        })}
        {busy && (
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-sm">
            <Loader2 className="size-4 animate-spin" /> thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
