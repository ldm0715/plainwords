// SOL/USD spot for balance display + session risk accounting.
//
// Sourced from the Jupiter mainnet quote (same-origin /jup proxy as swaps) —
// CoinGecko's free tier 429s browsers hard and its error responses lack CORS
// headers, which surfaces as confusing CORS failures. The quote path is
// already proven, proxied and unlimited for our purposes.

const WSOL = "So11111111111111111111111111111111111111112"
const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"

export async function getSOLPriceUSD(): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      inputMint: WSOL,
      outputMint: MAINNET_USDC,
      amount: "10000000", // 0.01 SOL — any route yields the spot price
      slippageBps: "50",
    })
    const res = await fetch(`/jup/swap/v2/quote?${params}`)
    if (!res.ok) return null
    const q = (await res.json()) as { inAmount: string; outAmount: string }
    const inSOL = Number(q.inAmount) / 1e9
    const outUSDC = Number(q.outAmount) / 1e6
    if (!Number.isFinite(inSOL) || !Number.isFinite(outUSDC) || inSOL <= 0) return null
    return outUSDC / inSOL
  } catch {
    return null
  }
}
