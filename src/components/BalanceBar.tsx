import { Card, CardContent } from "@/components/ui/card"
import type { Balances } from "@/lib/types"

interface Props {
  balances: Balances | null
  solPriceUsd: number | null
}

function fmtSol(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 })
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

/** Three compact balance cards in a row (sidebar bottom / mobile top). */
export function BalanceCards({ balances, solPriceUsd }: Props) {
  if (!balances) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-muted-foreground py-5 text-center text-sm">
          Connect your wallet to see your balances.
        </CardContent>
      </Card>
    )
  }

  const solUsd = solPriceUsd !== null ? balances.sol * solPriceUsd : null
  const totalUsd = solUsd !== null ? solUsd + balances.usdc : null

  const cards = [
    { label: "SOL", value: fmtSol(balances.sol), sub: solUsd !== null ? `≈ $${fmtUsd(solUsd)}` : "" },
    { label: "USDC", value: fmtUsd(balances.usdc), sub: balances.usdc > 0 ? "≈ same in $" : "" },
    { label: "Total", value: totalUsd !== null ? `$${fmtUsd(totalUsd)}` : "—", sub: "estimated" },
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {cards.map((c) => (
        <Card key={c.label} className="py-0">
          <CardContent className="px-3 py-2">
            <div className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {c.label}
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold tabular-nums">{c.value}</div>
            <div className="text-muted-foreground h-3.5 truncate text-[11px]">{c.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
