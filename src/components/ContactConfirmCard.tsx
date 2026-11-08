// Confirmation card for contact edit/remove requested via chat (LLM actions).
// Nothing changes until the user confirms — same gate principle as transfers.

import { CheckCircle2, Pencil, Trash2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { t } from "@/lib/i18n"
import { shortAddress } from "@/lib/solana"
import type { ContactConfirmMessage, PendingContactAction } from "@/lib/types"

function DiffRow({
  label,
  before,
  after,
}: {
  label: string
  before: string
  after?: string
}) {
  const changed = after !== undefined && after !== before
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-mono text-xs">
        {changed ? (
          <>
            <span className="text-muted-foreground line-through">{before}</span>
            <span className="mx-1">→</span>
            <span className="text-foreground">{after}</span>
          </>
        ) : (
          before
        )}
      </span>
    </div>
  )
}

function Preview({ action }: { action: PendingContactAction }) {
  const addrShort = (a?: string) => (a ? shortAddress(a, 8) : "—")
  return (
    <>
      {action.op === "edit" ? (
        <>
          <DiffRow
            label={t("contactFieldName")}
            before={action.originalName}
            after={action.newName}
          />
          <DiffRow
            label={t("contactFieldAddress")}
            before={addrShort(action.currentAddress)}
            after={action.newAddress ? addrShort(action.newAddress) : undefined}
          />
        </>
      ) : (
        <>
          <DiffRow label={t("contactFieldName")} before={action.originalName} />
          <DiffRow label={t("contactFieldAddress")} before={addrShort(action.currentAddress)} />
        </>
      )}
    </>
  )
}

interface Props {
  message: ContactConfirmMessage
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
}

export function ContactConfirmCard({ message, onConfirm, onCancel }: Props) {
  const { action, status } = message
  const pending = status === "pending"
  const isEdit = action.op === "edit"

  return (
    <Card className="gap-4 py-0">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            {isEdit ? (
              <Pencil className="size-4 text-muted-foreground" />
            ) : (
              <Trash2 className="size-4 text-destructive" />
            )}
            {isEdit ? t("contactEditTitle") : t("contactRemoveTitle")}
          </div>
          <Badge variant="secondary" className="bg-amber-500/10 font-medium text-amber-500">
            {isEdit ? "✏️" : "🗑️"} {isEdit ? "local change" : "local change"}
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-3 px-4">
        <Preview action={action} />
        {!isEdit && <p className="text-muted-foreground text-xs">{t("contactRemoveWarn")}</p>}
      </CardContent>

      <CardFooter className="gap-2 px-4 pb-4">
        {pending ? (
          <>
            <Button variant="outline" className="flex-1" onClick={() => onCancel(message.id)}>
              {t("contactCancel")}
            </Button>
            <Button
              className="flex-1"
              variant={isEdit ? "default" : "destructive"}
              onClick={() => onConfirm(message.id)}
            >
              {t("contactApply")}
            </Button>
          </>
        ) : status === "applied" ? (
          <div className="flex items-center gap-1.5 text-sm text-emerald-500">
            <CheckCircle2 className="size-4" /> {t("contactApplied")}
          </div>
        ) : (
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <XCircle className="size-4" /> {t("contactCancelled")}
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
