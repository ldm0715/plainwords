import { useState } from "react"
import { Loader2, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ui } from "@/lib/i18n"
import type { Session } from "@/lib/sessions"

interface Props {
  sessions: Session[]
  activeId: string
  /** session with an LLM round-trip in flight — shows a spinner on its row */
  busyId?: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  className?: string
  /** "fab" = floating + button bottom-right (mobile), "button" = full-width top (sidebar) */
  newButtonStyle?: "button" | "fab"
}

export function SessionList({
  sessions,
  activeId,
  busyId = null,
  onSelect,
  onNew,
  onDelete,
  className,
  newButtonStyle = "button",
}: Props) {
  // newest first
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  const [pendingDelete, setPendingDelete] = useState<Session | null>(null)

  return (
    <div className={`relative flex min-h-0 flex-col gap-2 ${className ?? ""}`}>
      {newButtonStyle === "button" && (
        <Button variant="outline" className="w-full" onClick={onNew}>
          <Plus data-icon="inline-start" /> {ui("New chat", "新对话")}
        </Button>
      )}
      {newButtonStyle === "fab" && (
        <Button
          size="icon-lg"
          className="bg-primary text-primary-foreground absolute right-3 bottom-3 z-10 rounded-full shadow-lg"
          aria-label={ui("New chat", "新对话")}
          title={ui("New chat", "新对话")}
          onClick={onNew}
        >
          <Plus className="size-5" />
        </Button>
      )}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {sorted.map((s) => (
          <div
            key={s.id}
            data-active={s.id === activeId}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => e.key === "Enter" && onSelect(s.id)}
            className="group hover:bg-muted data-[active=true]:bg-muted flex cursor-pointer items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm"
          >
            {s.id === busyId && (
              <Loader2
                className="text-muted-foreground size-3.5 shrink-0 animate-spin"
                aria-label={ui("working…", "处理中…")}
              />
            )}
            <span className="truncate">{s.title}</span>
            <button
              type="button"
              aria-label={ui(`Delete chat "${s.title}"`, `删除会话"${s.title}"`)}
              className="text-muted-foreground hover:text-destructive shrink-0 px-1"
              onClick={(e) => {
                e.stopPropagation()
                setPendingDelete(s)
              }}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* delete confirmation — desktop X and mobile X both route here */}
      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{ui("Delete this chat?", "删除这个会话?")}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            {ui(
              `"${pendingDelete?.title ?? ""}" and its messages will be removed permanently.`,
              `"${pendingDelete?.title ?? ""}" 及其全部消息将被永久删除。`,
            )}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              {ui("Cancel", "取消")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              {ui("Delete", "删除")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
