// The intent pipeline — everything between "LLM produced an intent" and
// "signature on chain". Amounts are resolved from raw integer balances only.

import { PublicKey, type Transaction } from "@solana/web3.js"
import { getSwapQuote } from "./jupiter"
import { t } from "./i18n"
import { assessRisk } from "./risk"
import {
  SOL_RESERVE,
  buildSOLTransfer,
  buildUSDCTransfer,
  getBalances,
  simulateTx,
  signSendConfirm,
  type Signer,
} from "./solana"
import type {
  AmountMode,
  Asset,
  Balances,
  ExecResult,
  PendingSend,
  PendingSwap,
  SendIntent,
  SimResult,
  SwapIntent,
} from "./types"

const LAMPORTS = 1_000_000_000
export const NETWORK_FEE_SOL = 0.000005
const ATA_RENT_SOL = 0.00204

export function decimalsOf(asset: Asset): number {
  return asset === "SOL" ? 9 : 6
}

export function fmtAmount(asset: Asset, ui: number): string {
  const digits = asset === "SOL" ? 4 : 2
  return ui.toLocaleString("en-US", { maximumFractionDigits: digits })
}

type Resolved = { raw: number } | { error: string }

/** Architecture rule #1: mode → exact integer amount, computed here, never by the LLM. */
function resolveRawAmount(
  mode: AmountMode,
  amount: number | undefined,
  rawBalance: number,
  asset: Asset,
): Resolved {
  const decimals = decimalsOf(asset)
  if (mode === "amount") {
    const raw = Math.floor((amount ?? 0) * 10 ** decimals)
    if (!Number.isFinite(raw) || raw <= 0) {
      return { error: t("needAmount") }
    }
    if (raw > rawBalance) {
      return { error: t("insufficient", { balance: fmtAmount(asset, rawBalance / 10 ** decimals), asset }) }
    }
    return { raw }
  }
  if (rawBalance <= 0) {
    return { error: t("zeroBalance", { asset }) }
  }
  if (mode === "half") {
    return { raw: Math.floor(rawBalance / 2) }
  }
  // mode "all": SOL keeps a reserve for fees + rent so the tx can land.
  const reserve = asset === "SOL" ? Math.floor(SOL_RESERVE * LAMPORTS) : 0
  const raw = rawBalance - reserve
  if (raw <= 0) {
    return { error: t("allWouldLeaveNothing", { reserve: String(SOL_RESERVE) }) }
  }
  return { raw }
}

function balanceOf(balances: Balances, asset: Asset): { ui: number; raw: number } {
  return asset === "SOL"
    ? { ui: balances.sol, raw: balances.solRaw }
    : { ui: balances.usdc, raw: balances.usdcRaw }
}

type ResolveError = { error: string }

export async function resolveSend(
  owner: PublicKey,
  intent: SendIntent,
  sessionTotalUsd: number,
  knownAddresses: string[] = [],
): Promise<PendingSend | ResolveError> {
  const balances = await getBalances(owner)
  const bal = balanceOf(balances, intent.asset)
  const resolved = resolveRawAmount(intent.mode, intent.amount, bal.raw, intent.asset)
  if ("error" in resolved) return resolved

  const uiAmount = resolved.raw / 10 ** decimalsOf(intent.asset)
  const dest = new PublicKey(intent.to)
  const tx: Transaction =
    intent.asset === "SOL"
      ? await buildSOLTransfer(owner, dest, uiAmount)
      : await buildUSDCTransfer(owner, dest, uiAmount)
  const sim: SimResult = await simulateTx(tx)
  const risk = assessRisk({
    asset: intent.asset,
    amount: uiAmount,
    balance: bal.ui,
    riskFlags: intent.risk_flags,
    dest: intent.to,
    destKnown: knownAddresses.includes(intent.to),
    sessionTotalUsd,
  })

  return {
    kind: "send",
    intent,
    asset: intent.asset,
    uiAmount,
    balanceBefore: bal.ui,
    destAddress: intent.to,
    feeSOL: NETWORK_FEE_SOL + (intent.asset === "USDC" ? ATA_RENT_SOL : 0), // ATA rent only if recipient has no USDC account
    risk,
    sim,
  }
}

export async function resolveSwap(
  owner: PublicKey,
  intent: SwapIntent,
  sessionTotalUsd: number,
): Promise<PendingSwap | ResolveError> {
  const balances = await getBalances(owner)
  const bal = balanceOf(balances, intent.from)
  const resolved = resolveRawAmount(intent.mode, intent.amount, bal.raw, intent.from)
  if ("error" in resolved) return resolved

  const uiAmount = resolved.raw / 10 ** decimalsOf(intent.from)

  let quote
  try {
    quote = await getSwapQuote(intent.from, intent.to, uiAmount)
  } catch (e) {
    return {
      error: t("quoteFailed", { err: e instanceof Error ? e.message : String(e) }),
    }
  }

  const risk = assessRisk({
    asset: intent.from,
    amount: uiAmount,
    balance: bal.ui,
    riskFlags: intent.risk_flags,
    sessionTotalUsd,
  })

  return {
    kind: "swap",
    intent,
    asset: intent.from,
    uiAmount,
    balanceBefore: bal.ui,
    toAsset: intent.to,
    expectedOut: quote.expectedOut,
    priceImpactPct: quote.priceImpactPct,
    feeSOL: NETWORK_FEE_SOL,
    risk,
  }
}

export async function executeSend(
  signTransaction: Signer,
  pending: PendingSend,
  owner: PublicKey,
): Promise<ExecResult> {
  const dest = new PublicKey(pending.destAddress)
  const tx: Transaction =
    pending.asset === "SOL"
      ? await buildSOLTransfer(owner, dest, pending.uiAmount)
      : await buildUSDCTransfer(owner, dest, pending.uiAmount)
  // Re-simulate against fresh state: the balance may have moved since the card
  // was resolved (multi-card turns, or a delayed confirmation). Refusing here
  // keeps the fee unspent — a failed on-chain tx still costs the network fee.
  const sim = await simulateTx(tx)
  if (!sim.ok) {
    return { ok: false, error: sim.error }
  }
  const signature = await signSendConfirm(signTransaction, tx)
  return { ok: true, signature, sentAmount: pending.uiAmount }
}

/** Deterministic fallback text shown when GLM can't summarize. */
export function templateSummary(action: PendingSend, result: ExecResult): string {
  if (!result.ok) {
    return t("sendFailed", { err: result.error ?? "unknown error" })
  }
  // The on-chain signature IS the order id; chat shows the 8-char prefix and
  // query_transfers rows carry the full value for unambiguous correlation.
  const sig = result.signature
    ? ` ${t("orderSuffix", { order: `${result.signature.slice(0, 8)}…` })}`
    : ""
  return t("sendDone", {
    amount: fmtAmount(action.asset, action.uiAmount),
    asset: action.asset,
    to: `${action.destAddress.slice(0, 4)}…${action.destAddress.slice(-4)}`,
    sig,
  })
}
