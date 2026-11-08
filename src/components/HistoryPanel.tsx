import { useState } from "react"
import { ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCw, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fmtAmount } from "@/lib/pipeline"
import { ui } from "@/lib/i18n"
import { shortAddress } from "@/lib/solana"
import type { Contact } from "@/lib/contacts"
import type { TransferRecord } from "@/lib/history"

interface Props {
  records: TransferRecord[] | null
  loading: boolean
  contacts: Contact[]
  onRefresh: (opts?: { force?: boolean; manual?: boolean }) => void
}

function fmtTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      data-active={active}
      onClick={onClick}
      className={
        active
          ? "bg-muted text-foreground shrink-0 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap"
          : "text-muted-foreground hover:text-foreground shrink-0 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors"
      }
    >
      {children}
    </button>
  )
}

export function HistoryPanel({ records, loading, contacts, onRefresh }: Props) {
  const byAddress = new Map(contacts.map((c) => [c.address, c.name]))

  // filters combine with AND: direction × asset × search
  const [dir, setDir] = useState<"all" | "out" | "in">("all")
  const [asset, setAsset] = useState<"all" | "SOL" | "USDC">("all")
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState("")

  const filtered = (records ?? []).filter((r) => {
    if (dir !== "all" && (r.outgoing ? "out" : "in") !== dir) return false
    if (asset !== "all" && r.asset !== asset) return false
    const needle = q.trim().toLowerCase()
    if (needle) {
      const name = byAddress.get(r.counterparty)?.toLowerCase() ?? ""
      if (!r.counterparty.toLowerCase().includes(needle) && !name.includes(needle)) return false
    }
    return true
  })

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{ui("Transfers", "转账记录")}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={ui("Search transfers", "搜索转账")}
              onClick={() => {
                setSearchOpen((o) => !o)
                if (searchOpen) setQ("")
              }}
            >
              {searchOpen ? <X /> : <Search />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRefresh({ manual: true })}
              disabled={loading}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} data-icon="inline-start" />
              {ui("Refresh", "刷新")}
            </Button>
          </div>
        </div>

        {searchOpen && (
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ui("Search contact name or address…", "搜索联系人或地址…")}
            aria-label={ui("Search by contact or address", "按联系人或地址搜索")}
          />
        )}

        <div className="bg-muted/60 flex flex-nowrap items-center gap-1 overflow-x-auto rounded-lg p-1">
          <FilterPill active={dir === "all"} onClick={() => setDir("all")}>
            {ui("All", "全部")}
          </FilterPill>
          <FilterPill active={dir === "out"} onClick={() => setDir("out")}>
            {ui("Sent", "支出")}
          </FilterPill>
          <FilterPill active={dir === "in"} onClick={() => setDir("in")}>
            {ui("Received", "收入")}
          </FilterPill>
          <span className="text-muted-foreground/50 shrink-0 px-1 text-xs">·</span>
          <FilterPill active={asset === "all"} onClick={() => setAsset("all")}>
            {ui("All", "全部")}
          </FilterPill>
          <FilterPill active={asset === "SOL"} onClick={() => setAsset("SOL")}>
            SOL
          </FilterPill>
          <FilterPill active={asset === "USDC"} onClick={() => setAsset("USDC")}>
            USDC
          </FilterPill>
        </div>

        {records !== null && records.length === 0 && !loading && (
          <Card className="border-dashed">
            <CardContent className="text-muted-foreground py-6 text-center text-sm">
              {ui("No transfers yet — send SOL or USDC and it will show up here.", "还没有转账记录 — 发送 SOL 或 USDC 后会显示在这里。")}
            </CardContent>
          </Card>
        )}

        {records === null && !loading && (
          <Card className="border-dashed">
            <CardContent className="text-muted-foreground py-6 text-center text-sm">
              {ui("Connect your wallet to see your transfer history.", "连接钱包后可查看转账记录。")}
            </CardContent>
          </Card>
        )}

        {records !== null && records.length > 0 && filtered.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="text-muted-foreground py-6 text-center text-sm">
              {ui("No transfers match these filters.", "没有符合筛选条件的记录。")}
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {filtered.map((r) => {
            const contactName = byAddress.get(r.counterparty)
            return (
              <div key={r.signature} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                <div
                  className={
                    r.outgoing
                      ? "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full"
                      : "flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
                  }
                >
                  {r.outgoing ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">
                      {r.outgoing ? ui("To ", "转给 ") : ui("From ", "来自 ")}
                      <span className={contactName ? "" : "font-mono text-xs"}>
                        {contactName ??
                          (r.counterparty ? shortAddress(r.counterparty, 8) : ui("unknown", "未知"))}
                      </span>
                    </span>
                    {contactName && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary h-4 px-1.5 text-[10px]">
                        {ui("contact", "联系人")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground text-xs">{fmtTime(r.blockTime)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-sm font-semibold tabular-nums ${r.outgoing ? "" : "text-emerald-500"}`}>
                    {r.outgoing ? "−" : "+"}
                    {fmtAmount(r.asset, r.uiAmount)} {r.asset}
                  </div>
                  {r.outgoing && r.feeSOL > 0 && (
                    <div className="text-muted-foreground text-[11px] tabular-nums">
                      −{r.feeSOL.toFixed(6)} SOL {ui("fee", "手续费")}
                    </div>
                  )}
                  <a
                    href={`https://solscan.io/tx/${r.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px] underline-offset-2 hover:underline"
                  >
                    tx <ExternalLink className="size-2.5" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </ScrollArea>
  )
}
