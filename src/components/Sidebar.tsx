import { Settings } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BalanceCards } from "@/components/BalanceBar"
import { SessionList } from "@/components/SessionList"
import { WalletButton } from "@/components/WalletButton"
import { ui } from "@/lib/i18n"
import type { Session } from "@/lib/sessions"
import type { Balances } from "@/lib/types"

interface Props {
  sessions: Session[]
  activeId: string
  /** session with an LLM round-trip in flight — spinner on its row */
  busySessionId: string | null
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteSession: (id: string) => void
  balances: Balances | null
  solPriceUsd: number | null
  onOpenSettings: () => void
}

export function Sidebar({
  sessions,
  activeId,
  busySessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  balances,
  solPriceUsd,
  onOpenSettings,
}: Props) {
  return (
    <aside className="hidden shrink-0 flex-col gap-4 lg:flex lg:w-72">
      {/* brand */}
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
            P
          </div>
          <div>
            <h1 className="text-lg leading-tight font-semibold tracking-tight">PlainWords</h1>
            <p className="text-muted-foreground text-xs">
              {ui("the wallet that speaks your language", "说人话的钱包")}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono text-[11px]">
          Devnet
        </Badge>
      </div>

      {/* conversation history */}
      <SessionList
        className="min-h-0 flex-1"
        sessions={sessions}
        activeId={activeId}
        busyId={busySessionId}
        onSelect={onSelectSession}
        onNew={onNewSession}
        onDelete={onDeleteSession}
      />

      {/* account block pinned to the bottom */}
      <div className="space-y-3">
        <BalanceCards balances={balances} solPriceUsd={solPriceUsd} />
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <WalletButton />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            aria-label={ui("Settings", "设置")}
            title={ui("Settings", "设置")}
            onClick={onOpenSettings}
          >
            <Settings />
          </Button>
        </div>
      </div>
    </aside>
  )
}
