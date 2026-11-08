// "Send to contact" dialog from the Contacts panel. Collects asset + amount,
// then hands a ready-made SendIntent to the app — which runs it through the
// SAME pipeline as chat requests (resolve → risk → simulate → confirm card),
// just without the LLM round-trip.
//
// Front-end guards: balance shown live, Half/All pre-fill the computed amount
// (read-only — the exact integer math still happens on-chain data at resolve
// time), and over-balance exact amounts are rejected before Continue.

import { useState } from "react"
import { SendHorizonal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { shortAddress } from "@/lib/solana"
import { ui } from "@/lib/i18n"
import type { Contact } from "@/lib/contacts"
import type { AmountMode, Asset, Balances, SendIntent } from "@/lib/types"

interface Props {
  contact: Contact | null
  balances: Balances | null
  onClose: () => void
  onSubmit: (intent: SendIntent, displayText: string) => void
}

const ASSETS: Asset[] = ["SOL", "USDC"]
const SOL_RESERVE = 0.01 // mirrors pipeline's rent/fee reserve for "all"

function fmtPreview(n: number): string {
  return Number(n.toFixed(6)).toString()
}

export function SendContactDialog({ contact, balances, onClose, onSubmit }: Props) {
  const [asset, setAsset] = useState<Asset>("SOL")
  const [mode, setMode] = useState<"exact" | "half" | "all">("exact")
  const [amountText, setAmountText] = useState("")

  const balance = balances ? (asset === "SOL" ? balances.sol : balances.usdc) : undefined

  // Half/All preview — the authoritative amount is still computed from the
  // on-chain balance at resolve time; this is a read-only estimate.
  const preview =
    mode === "half"
      ? (balance ?? 0) / 2
      : mode === "all"
        ? Math.max(0, (balance ?? 0) - (asset === "SOL" ? SOL_RESERVE : 0))
        : null

  const amount = Number.parseFloat(amountText)
  const overBalance =
    mode === "exact" && balance !== undefined && Number.isFinite(amount) && amount > balance
  const valid =
    mode !== "exact"
      ? (preview ?? 0) > 0
      : Number.isFinite(amount) && amount > 0 && !overBalance

  const submit = () => {
    if (!contact || !valid) return
    const intent: SendIntent =
      mode === "exact"
        ? { tool: "send_payment", to: contact.address, asset, mode: "amount", amount, risk_flags: [] }
        : { tool: "send_payment", to: contact.address, asset, mode: mode as AmountMode, risk_flags: [] }
    const displayText =
      mode === "exact"
        ? `Send ${amount} ${asset} to ${contact.name}`
        : `Send ${mode} of my ${asset} to ${contact.name}`
    onSubmit(intent, displayText)
  }

  const pill = (active: boolean) =>
    active
      ? "bg-muted text-foreground rounded-md px-3 py-1.5 text-sm font-medium"
      : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-colors"

  return (
    <Dialog open={contact !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        {contact && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <SendHorizonal className="size-4 text-muted-foreground" />
                {ui("Send to", "转账给")} {contact.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-0.5">
                <div className="text-muted-foreground font-mono text-xs break-all">
                  {shortAddress(contact.address, 12)}
                </div>
                {contact.description && (
                  <div className="text-muted-foreground text-xs italic">{contact.description}</div>
                )}
              </div>

              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex gap-1">
                  {ASSETS.map((a) => (
                    <button key={a} type="button" className={pill(asset === a)} onClick={() => setAsset(a)}>
                      {a}
                    </button>
                  ))}
                </div>
                {balance !== undefined && (
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {ui("Balance", "余额")}: {fmtPreview(balance)} {asset}
                  </span>
                )}
              </div>

              <div className="flex gap-1">
                {(["exact", "half", "all"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={pill(mode === m)}
                    onClick={() => setMode(m)}
                  >
                    {m === "exact" ? ui("Exact", "精确") : m === "half" ? ui("Half", "一半") : ui("All", "全部")}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Input
                  autoFocus={mode === "exact"}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={mode === "exact" ? amountText : fmtPreview(preview ?? 0)}
                  onChange={(e) => setAmountText(e.target.value)}
                  readOnly={mode !== "exact"}
                  placeholder={ui(`Amount in ${asset}`, `金额(${asset})`)}
                  aria-label={ui(`Amount in ${asset}`, `金额 ${asset}`)}
                  className="tabular-nums read-only:text-muted-foreground"
                />
                {mode !== "exact" && (
                  <p className="text-muted-foreground text-[11px]">
                    {ui("Calculated from your on-chain balance — the exact amount is finalized on the confirmation card.", "按链上余额计算 — 精确金额以确认卡为准。")}
                  </p>
                )}
                {overBalance && (
                  <p className="text-destructive text-[11px]">
                    {ui("Exceeds your balance", "超过你的余额")} ({fmtPreview(balance!)} {asset}).
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>
                {ui("Cancel", "取消")}
              </Button>
              <Button disabled={!valid} onClick={submit}>
                <SendHorizonal data-icon="inline-start" /> {ui("Continue", "继续")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
