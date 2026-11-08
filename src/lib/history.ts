// On-chain transfer history for the connected wallet — pulled live from the
// RPC (devnet), not from local state, so it survives reloads and includes
// anything sent from Phantom directly.

import { getAssociatedTokenAddress } from "@solana/spl-token"
import { PublicKey, LAMPORTS_PER_SOL, type ConfirmedSignatureInfo } from "@solana/web3.js"
import { connection, USDC_MINT } from "./solana"
import type { Asset } from "./types"

export interface TransferRecord {
  signature: string
  /** SOL | USDC — SPL transfers carry the mint; falls back to SOL */
  asset: Asset
  /** outgoing (true) or incoming (false) from this wallet's perspective */
  outgoing: boolean
  uiAmount: number
  /** transaction fee paid by THIS wallet (0 for incoming) */
  feeSOL: number
  counterparty: string
  blockTime: number
}

function isUSDC(mint?: string): boolean {
  return !!mint && mint === USDC_MINT.toBase58()
}

function sumUsdcFor(
  balances: { mint: string; owner?: string; uiTokenAmount: { uiAmount: number | null } }[],
  ownerStr: string,
): number {
  // Token-balance entries carry `owner` = owner of the token account. Match on
  // that — accountIndex refers to the token account, not the wallet.
  return balances
    .filter((b) => isUSDC(b.mint) && b.owner === ownerStr)
    .reduce((sum, b) => sum + (b.uiTokenAmount.uiAmount ?? 0), 0)
}

// --- local cache (localStorage), so we only ever parse NEW transactions ---
// Key format: plainwords:history:<ownerBase58>
const HISTORY_PREFIX = "plainwords:history:"
const MAX_CACHED = 100

interface HistoryCache {
  records: TransferRecord[]
}

function cacheKey(owner: PublicKey): string {
  return HISTORY_PREFIX + owner.toBase58()
}

/** Instantly available cached records (render these first, sync in background). */
export function loadCachedHistory(owner: PublicKey): TransferRecord[] {
  try {
    const raw = localStorage.getItem(cacheKey(owner))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && Array.isArray(parsed.records) ? parsed.records : []
  } catch {
    return []
  }
}

function saveCache(owner: PublicKey, records: TransferRecord[]): void {
  try {
    const cache: HistoryCache = { records: records.slice(0, MAX_CACHED) }
    localStorage.setItem(cacheKey(owner), JSON.stringify(cache))
  } catch {
    /* storage full — cache is best-effort */
  }
}

/**
 * Incremental sync: fetch the latest signatures (1 cheap call), parse ONLY the
 * ones we haven't seen (expensive getParsedTransaction calls), merge, cache.
 * Keeps 429s away — steady-state adds cost 1-2 parsed txs instead of 20.
 */
export async function syncTransferHistory(
  owner: PublicKey,
  fetchLimit = 20,
): Promise<TransferRecord[]> {
  const cached = loadCachedHistory(owner)
  const seen = new Set(cached.map((r) => r.signature))

  // Incoming USDC transfers never touch the wallet itself (only its USDC ATA),
  // so the wallet's signature list can't see them. Query BOTH the wallet and
  // its USDC ATA, then merge + dedupe by signature.
  const fetchSigs = async (addr: PublicKey) => {
    try {
      return await connection.getSignaturesForAddress(addr, { limit: fetchLimit }, "confirmed")
    } catch {
      return []
    }
  }

  const mergeSigs = async (): Promise<ConfirmedSignatureInfo[]> => {
    const walletSigs = await fetchSigs(owner)
    const ata = await getAssociatedTokenAddress(USDC_MINT, owner)
    const ataSigs = await fetchSigs(ata)
    const map = new Map<string, ConfirmedSignatureInfo>()
    for (const s of [...walletSigs, ...ataSigs]) {
      if (!map.has(s.signature)) map.set(s.signature, s)
    }
    return [...map.values()].sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0))
  }

  let sigs = await mergeSigs()

  // The load-balanced public devnet RPC sometimes lands on a node with a
  // degraded signature index and returns a fraction of the list. If the
  // response is suspiciously short (fewer than we already have cached), retry
  // once and keep the better answer.
  if (sigs.length < cached.length) {
    await new Promise((r) => setTimeout(r, 600))
    const retry = await mergeSigs()
    if (retry.length > sigs.length) sigs = retry
  }

  const fresh: TransferRecord[] = []

  // Public devnet RPC rate-limits hard: pace the parsed fetches and stop the
  // round early on consecutive failures instead of fanning out into 429s.
  let failStreak = 0
  for (const sig of sigs) {
    if (sig.err || seen.has(sig.signature)) continue
    let rec: TransferRecord | null
    try {
      rec = await parseTransfer(owner, sig)
      failStreak = 0
    } catch (e) {
      console.warn("[history] parse failed for", sig.signature.slice(0, 8), e)
      failStreak++
      if (failStreak >= 2) {
        console.warn("[history] circuit-break, remaining txs retry on next sync")
        break
      }
      continue
    }
    if (rec) fresh.push(rec)
    await new Promise((r) => setTimeout(r, 400))
  }

  if (!fresh.length) return cached

  // newest first (sig list is newest-first already), merge + trim
  const merged = [...fresh, ...cached]
    .sort((a, b) => b.blockTime - a.blockTime)
    .slice(0, MAX_CACHED)
  saveCache(owner, merged)
  return merged
}

/**
 * Immediately ingest transactions whose signatures we already know (e.g. the
 * one we just sent). The public RPC's signature list lags a freshly-confirmed
 * tx by a few seconds, so sync alone would miss it on the first pass.
 */
export async function ingestSignatures(
  owner: PublicKey,
  signatures: string[],
): Promise<TransferRecord[]> {
  const cached = loadCachedHistory(owner)
  const seen = new Set(cached.map((r) => r.signature))
  const fresh: TransferRecord[] = []

  for (const signature of signatures) {
    if (seen.has(signature)) continue
    try {
      const rec = await parseTransfer(owner, { signature, blockTime: null, err: null } as ConfirmedSignatureInfo)
      if (rec) fresh.push(rec)
    } catch (e) {
      console.warn("[history] direct ingest failed for", signature.slice(0, 8), e)
    }
  }

  if (!fresh.length) return cached

  const merged = [...fresh, ...cached]
    .sort((a, b) => b.blockTime - a.blockTime)
    .slice(0, MAX_CACHED)
  saveCache(owner, merged)
  return merged
}

async function parseTransfer(
  owner: PublicKey,
  sig: ConfirmedSignatureInfo,
): Promise<TransferRecord | null> {
  {
    // NOTE: the public devnet RPC dropped getParsedTransaction (Method not
    // found). getTransaction with DEFAULT json encoding returns the same meta
    // (pre/post token balances carry mint + owner regardless of encoding) —
    // do NOT pass "jsonParsed" here: web3.js' response validator only accepts
    // the json shape and throws on the parsed accountKeys objects.
    // Network/RPC failures THROW (caller paces + circuit-breaks); a null
    // return means "checked, not a transfer".
    const tx = await connection.getTransaction(sig.signature, {
      maxSupportedTransactionVersion: 0,
    })
    if (!tx?.meta || !tx.blockTime) return null

    const pre = tx.meta.preBalances ?? []
    const post = tx.meta.postBalances ?? []
    // Verified live: json encoding returns a Message whose `accountKeys` IS a
    // plain array; getAccountKeys() (when present) returns
    // { staticAccountKeys, accountKeysFromLookups } — prefer the array.
    const msg = tx.transaction.message as unknown as {
      accountKeys?: unknown
      getAccountKeys?: () => unknown
    }
    const raw = Array.isArray(msg.accountKeys)
      ? msg.accountKeys
      : ((msg.getAccountKeys?.() as
          | { staticAccountKeys?: Array<{ pubkey?: PublicKey } | PublicKey> }
          | undefined
          | undefined)?.staticAccountKeys ?? [])
    const keys = (raw as Array<{ pubkey?: PublicKey } | PublicKey>).map((k) =>
      ("pubkey" in k && k.pubkey ? k.pubkey : (k as PublicKey)).toBase58(),
    )
    const ownerStr = owner.toBase58()
    const ownerIdx = keys.indexOf(ownerStr)

    // USDC delta FIRST — matched by token-account owner, it does NOT need the
    // wallet itself to appear in accountKeys. Incoming USDC transfers only
    // touch the recipient's ATA, so the wallet address is often absent and the
    // old ownerIdx<0 early-return silently dropped every incoming USDC record.
    const preTok = (tx.meta.preTokenBalances ?? []) as never as {
      accountIndex: number
      mint: string
      owner?: string
      uiTokenAmount: { uiAmount: number | null }
    }[]
    const postTok = (tx.meta.postTokenBalances ?? []) as typeof preTok
    const usdcPre = sumUsdcFor(preTok, ownerStr)
    const usdcPost = sumUsdcFor(postTok, ownerStr)
    const usdcDelta = usdcPost - usdcPre

    // Prefer USDC when both moved (a USDC transfer's SOL delta is just fees/rent).
    if (Math.abs(usdcDelta) > 0) {
      const outgoing = usdcDelta < 0
      const amount = Math.abs(usdcDelta)
      // counterparty: the other side's USDC token account owner
      const other = [...postTok, ...preTok].find(
        (b) => isUSDC(b.mint) && b.owner && b.owner !== ownerStr,
      )
      return {
        signature: sig.signature,
        asset: "USDC",
        outgoing,
        uiAmount: amount,
        // fee only applies when we're the sender (feePayer)
        feeSOL: outgoing ? tx.meta.fee / LAMPORTS_PER_SOL : 0,
        counterparty: other?.owner ?? "",
        blockTime: sig.blockTime ?? tx.blockTime,
      }
    }

    // SOL path — requires the wallet itself in accountKeys (SOL transfers
    // always list both sides, so absence means this tx isn't ours to record).
    if (ownerIdx < 0) return null

    const solDeltaRaw = post[ownerIdx] - pre[ownerIdx]
    const feeLamports = tx.meta.fee
    const solTransfer =
      ownerIdx === 0
        ? (solDeltaRaw + feeLamports) / LAMPORTS_PER_SOL
        : solDeltaRaw / LAMPORTS_PER_SOL

    // Counterparty = the OTHER account with the largest absolute SOL change.
    let counterpartyIdx = -1
    let maxDelta = 0
    for (let i = 0; i < keys.length; i++) {
      if (i === ownerIdx) continue
      const d = Math.abs(post[i] - pre[i])
      if (d > maxDelta) {
        maxDelta = d
        counterpartyIdx = i
      }
    }
    const counterparty = counterpartyIdx >= 0 ? keys[counterpartyIdx] : ""

    if (Math.abs(solTransfer) >= 0.000001) {
      return {
        signature: sig.signature,
        asset: "SOL",
        outgoing: solTransfer < 0, // we lost SOL ⇒ we sent it
        uiAmount: Math.abs(solTransfer),
        feeSOL: solTransfer < 0 ? tx.meta.fee / LAMPORTS_PER_SOL : 0,
        counterparty,
        blockTime: sig.blockTime ?? tx.blockTime,
      }
    }
    return null
  }
}

// --- query filter used by the LLM's query_transfers tool ---

export interface TransferFilter {
  asset?: "SOL" | "USDC"
  direction?: "out" | "in"
  /** contact name (resolved to its address by the caller) or raw address */
  counterpartyAddress?: string
  /** only include records newer than N days */
  days?: number
  limit?: number
}

export function filterTransfers(
  records: TransferRecord[],
  filter: TransferFilter,
): TransferRecord[] {
  let out = records
  if (filter.asset) out = out.filter((r) => r.asset === filter.asset)
  if (filter.direction) out = out.filter((r) => r.outgoing === (filter.direction === "out"))
  if (filter.counterpartyAddress) {
    const target = filter.counterpartyAddress.toLowerCase()
    out = out.filter((r) => r.counterparty.toLowerCase() === target)
  }
  if (filter.days && filter.days > 0) {
    const cutoff = Date.now() / 1000 - filter.days * 86400
    out = out.filter((r) => r.blockTime >= cutoff)
  }
  const limit = Math.min(Math.max(filter.limit ?? 10, 1), 50)
  return out.slice(0, limit)
}
