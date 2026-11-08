// The confirmation card — the single gate between AI intent and the chain
// (architecture rule #2). Rejected here ⇒ zero on-chain changes.

import { useState } from "react"
import { ArrowLeftRight, CheckCircle2, ExternalLink, Loader2, ShieldAlert, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fmtAmount } from "@/lib/pipeline"
import { shortAddress } from "@/lib/solana"
import { t, ui } from "@/lib/i18n"
import type { ConfirmLevel, ConfirmMessage } from "@/lib/types"

const LEVEL_META: Record<ConfirmLevel, { dot: string; label: string; badge: string }> = {
  light: { dot: "🟢", label: ui("Light check", "轻量确认"), badge: "bg-emerald-500/10 text-emerald-500" },
  standard: { dot: "🟡", label: ui("Standard check", "标准确认"), badge: "bg-amber-500/10 text-amber-500" },
  strict: { dot: "🔴", label: ui("Strong check", "强确认"), badge: "bg-red-500/10 text-red-500" },
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium tabular-nums">{children}</span>
    </div>
  )
}

interface Props {
  message: ConfirmMessage
  onConfirm: (id: string) => void
  onCancel: (id: string) => void
}

export function ConfirmCard({ message, onConfirm, onCancel }: Props) {
  const { action, status, result } = message
  const [typed, setTyped] = useState("")
  const isStrict = action.risk.level === "strict"
  const isSend = action.kind === "send"
  const simBlocked = isSend && action.sim !== null && !action.sim.ok
  const level = LEVEL_META[action.risk.level]
  const pending = status === "pending"

  const title = isSend
    ? `${ui("Send", "转出")} ${fmtAmount(action.asset, action.uiAmount)} ${action.asset}`
    : `${ui("Swap", "兑换")} ${fmtAmount(action.asset, action.uiAmount)} ${action.asset} → ${action.toAsset}`

  return (
    <Card className="gap-4 py-0">
      {/* header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <ArrowLeftRight className="size-4 text-muted-foreground" />
            {title}
          </div>
          <Badge className={`${level.badge} border-0 font-medium`} variant="secondary">
            {level.dot} {level.label}
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-3 px-4">
        {isSend ? (
          <>
            <Row label="Amount">
              {fmtAmount(action.asset, action.uiAmount)} {action.asset}
            </Row>
            <Row label="To">
              <span className="font-mono text-xs">
                {action.destLabel ? `${action.destLabel} · ` : ""}
                {shortAddress(action.destAddress, 8)}
              </span>
            </Row>
          </>
        ) : (
          <>
            <Row label={ui("You'd swap", "你将兑换")}>
              {fmtAmount(action.asset, action.uiAmount)} {action.asset}
            </Row>
            <Row label={ui("You'd get (est.)", "预计获得")}>
              ≈ {fmtAmount(action.toAsset, action.expectedOut)} {action.toAsset}
            </Row>
            <Row label={ui("Price impact", "价格影响")}>{action.priceImpactPct.toFixed(2)}%</Row>
          </>
        )}
        <Row label={ui("Network fee", "网络费")}>~{action.feeSOL.toFixed(5)} SOL</Row>

        {/* simulation result (sends only — swaps are quote-only on devnet) */}
        {isSend &&
          (action.sim === null ? (
            <div className="text-muted-foreground text-xs">{ui("◇ Simulation unavailable", "◇ 模拟不可用")}</div>
          ) : action.sim.ok ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-500">
              <CheckCircle2 className="size-3.5" /> {ui("Simulated on devnet — no errors found", "已在 devnet 模拟 — 无错误")}
            </div>
          ) : (
            <div className="text-destructive space-y-1 text-xs">
              <div className="flex items-start gap-1.5">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {ui("Simulation failed", "模拟失败")}:{" "}
                  {action.sim.error ?? ui("transaction would be rejected", "交易将被拒绝")}.
                  Confirming is disabled — this transaction would not land on-chain.
                </span>
              </div>
              {/* most common devnet cause, stated plainly */}
              {/AccountNotFound/i.test(action.sim.error ?? "") && (
                <div className="pl-5">
                  {ui("Tip: the sending wallet may have no SOL left for fees — top it up (faucet or a small transfer) and ask again.", "提示:发送钱包可能没有 SOL 付手续费 — 先充值(水龙头或小额转入)再重试。")}
                </div>
              )}
            </div>
          ))}

        {!isSend && (
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-600 dark:text-sky-400">
            Jupiter retired devnet routing in 2026, so swaps can't land on devnet — this estimate
            uses live mainnet rates. On mainnet, this exact flow signs and executes via Jupiter.
          </div>
        )}

        {/* risk reasons */}
        {action.risk.reasons.length > 0 && (
          <div className="border-amber-500/30 bg-amber-500/5 rounded-lg border px-3 py-2">
            <div className="mb-1 text-xs font-medium text-amber-500">{ui("Why this needs your attention", "需要注意的原因")}</div>
            <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-600 dark:text-amber-400">
              {action.risk.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* strict gate: type CONFIRM — hidden while sim-blocked, typing can't
            unlock a hard-locked button and would only mislead */}
        {isStrict && pending && !simBlocked && (
          <div className="space-y-1.5">
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              placeholder={ui("Type CONFIRM to unlock", "输入 CONFIRM 解锁")}
              className="font-mono"
              aria-label="Type CONFIRM to unlock the confirm button"
            />
          </div>
        )}
      </CardContent>

      {/* actions / terminal status */}
      {pending ? (
        isSend ? (
          <CardFooter className="gap-2 px-4 pb-4">
            <Button variant="outline" className="flex-1" onClick={() => onCancel(message.id)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              variant={isStrict ? "destructive" : "default"}
              disabled={simBlocked || (isStrict && typed !== "CONFIRM")}
              onClick={() => onConfirm(message.id)}
            >
              {isStrict ? ui("I understand — confirm", "我已了解 — 确认") : ui("Confirm", "确认")}
            </Button>
          </CardFooter>
        ) : (
          <CardFooter className="px-4 pb-4">
            <Button
              className="w-full"
              variant="outline"
              disabled={isStrict && typed !== "CONFIRM"}
              onClick={() => onConfirm(message.id)}
            >
              {ui("Got it — close this quote", "知道了 — 关闭报价")}
            </Button>
          </CardFooter>
        )
      ) : (
        <CardFooter className="px-4 pb-4">
          {status === "executing" && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> {ui("Signing and sending…", "签名并发送中…")}
            </div>
          )}
          {status === "confirmed" && (
            <div className="w-full space-y-1">
              <div className="flex items-center gap-1.5 text-sm text-emerald-500">
                <CheckCircle2 className="size-4" /> {t("confirmedOnChain")}
              </div>
              {result?.signature && (
                <a
                  href={`https://solscan.io/tx/${result.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono text-xs underline-offset-2 hover:underline"
                >
                  {ui("view on Solscan", "在 Solscan 查看")} <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          )}
          {status === "cancelled" && (
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <XCircle className="size-4" /> {ui("Cancelled — nothing was moved on-chain.", "已取消 — 链上无任何变动。")}
            </div>
          )}
          {status === "closed" && (
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <XCircle className="size-4" /> Closed — quote only. On mainnet this swap executes via
              Jupiter in one tap.
            </div>
          )}
          {status === "failed" && (
            <div className="text-destructive text-sm">
              {result?.error?.includes("User rejected")
                ? ui("You rejected the signature in your wallet — nothing was moved.", "你在钱包中拒绝了签名 — 链上无任何变动。")
                : result?.error?.includes("SIGN_WINDOW_CLOSED")
                  ? ui(
                      "No signature arrived — the wallet popup may have been closed. Nothing was signed or moved on-chain.",
                      "没有收到钱包签名 — 签名弹窗可能被关掉了。链上无任何变动。",
                    )
                  : `${ui("Failed", "失败")}: ${result?.error ?? ui("unknown error", "未知错误")}`}
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
