// Jupiter quote access, quote-only.
//
// Reality check (2026): Jupiter RETIRED devnet routing — v6 is gone and the
// hosted v1/v2 API is mainnet-only. Real swaps can't land on devnet through
// an aggregator anymore. So PlainWords quotes swaps at LIVE MAINNET RATES
// (through the same-origin /jup dev proxy) and shows the full confirm-card
// flow; on mainnet this exact intent executes end-to-end via Jupiter.

import type { Asset } from "./types"

// Same-origin path served by the vite dev proxy (vite.config.ts).
const BASE = "/jup"

const WSOL_MINT = "So11111111111111111111111111111111111111112"
// Mainnet USDC (quotes are mainnet-priced).
const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

function mintOf(asset: Asset): string {
  return asset === "SOL" ? WSOL_MINT : MAINNET_USDC_MINT
}

function decimalsOf(asset: Asset): number {
  return asset === "SOL" ? 9 : 6
}

export interface SwapQuote {
  /** out-per-1-in at mainnet rates */
  rate: number
  /** expected output for the requested amount, ui units */
  expectedOut: number
  /** percent, e.g. 0.15 */
  priceImpactPct: number
}

export async function getSwapQuote(input: Asset, output: Asset, uiAmount: number): Promise<SwapQuote> {
  const amount = Math.floor(uiAmount * 10 ** decimalsOf(input))
  const params = new URLSearchParams({
    inputMint: mintOf(input),
    outputMint: mintOf(output),
    amount: String(amount),
    slippageBps: "50",
  })
  const res = await fetch(`${BASE}/swap/v2/quote?${params}`)
  if (!res.ok) {
    throw new Error(`Jupiter responded ${res.status}: ${(await res.text()).slice(0, 120)}`)
  }
  const quote = (await res.json()) as { inAmount: string; outAmount: string; priceImpactPct: string }
  const inAmt = Number(quote.inAmount) / 10 ** decimalsOf(input)
  const outAmt = Number(quote.outAmount) / 10 ** decimalsOf(output)
  return {
    rate: outAmt / inAmt,
    expectedOut: outAmt,
    priceImpactPct: Number(quote.priceImpactPct) * 100,
  }
}
