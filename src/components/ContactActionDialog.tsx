// Modal confirmation for contact edit/remove — one dialog for both entry
// points (chat/LLM requests and the Contacts panel). Nothing applies until
// the user confirms.

import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { t } from "@/lib/i18n"
import { shortAddress } from "@/lib/solana"
import type { ContactError } from "@/lib/contacts"
import type { PendingContactAction } from "@/lib/types"

function DiffLine({ label, before, after }: { label: string; before: string; after?: string }) {
  const changed = after !== undefined && after !== before
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-mono text-xs break-all">
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

interface Props {
  action: PendingContactAction | null
  /** Why the last apply failed (invalid address, duplicate name, …) */
  error: ContactError | null
  onConfirm: () => void
  onCancel: () => void
}

export function ContactActionDialog({ action, error, onConfirm, onCancel }: Props) {
  const open = action !== null
  const isEdit = action?.op === "edit"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        {action && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isEdit ? (
                  <Pencil className="size-4 text-muted-foreground" />
                ) : (
                  <Trash2 className="size-4 text-destructive" />
                )}
                {isEdit ? t("contactEditTitle") : t("contactRemoveTitle")}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? t("contactEditTitleDesc")
                  : `${action.originalName} · ${shortAddress(action.currentAddress ?? "", 8)}`}
              </DialogDescription>
            </DialogHeader>

              <div className="space-y-2">
                {isEdit ? (
                  <>
                    <DiffLine
                      label={t("contactFieldName")}
                      before={action.originalName}
                      after={action.newName}
                    />
                    <DiffLine
                      label={t("contactFieldAddress")}
                      before={shortAddress(action.currentAddress ?? "", 12)}
                      after={
                        action.newAddress ? shortAddress(action.newAddress, 12) : undefined
                      }
                    />
                    <DiffLine
                      label={t("contactFieldNote")}
                      before={action.currentDescription || "(none)"}
                      after={
                        action.newDescription !== undefined
                          ? (action.newDescription || "(cleared)")
                          : undefined
                      }
                    />
                  </>
                ) : (
                <>
                  <DiffLine label={t("contactFieldName")} before={action.originalName} />
                  <DiffLine
                    label={t("contactFieldAddress")}
                    before={shortAddress(action.currentAddress ?? "", 12)}
                  />
                  {action.currentDescription ? (
                    <DiffLine label={t("contactFieldNote")} before={action.currentDescription} />
                  ) : null}
                  <p className="text-muted-foreground text-xs">{t("contactRemoveWarn")}</p>
                </>
              )}
            </div>

            {error && (
              <p className="text-destructive text-xs">
                {t(error, { name: action.originalName })}
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onCancel}>
                {t("contactCancel")}
              </Button>
              <Button variant={isEdit ? "default" : "destructive"} onClick={onConfirm}>
                {isEdit ? t("contactApply") : t("contactApplyRemove")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
