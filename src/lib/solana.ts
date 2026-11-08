// On-chain layer: connection, balances, transaction building, simulation.
// Devnet only (hackathon demo). No keys ever live here — the wallet signs.

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token"
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js"
import type { Balances, SimResult } from "./types"

export const DEVNET_ENDPOINT = clusterApiUrl("devnet")
export const connection = new Connection(DEVNET_ENDPOINT, "confirmed")

// Canonical devnet USDC mint (same one Jupiter devnet routes against).
export const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
export const USDC_DECIMALS = 6

// Keep this much SOL untouched when a user says "all" — rent + fees.
export const SOL_RESERVE = 0.01

export async function getBalances(owner: PublicKey): Promise<Balances> {
  const ata = getAssociatedTokenAddress(USDC_MINT, owner)
  const [lamports, usdcRaw] = await Promise.all([
    connection.getBalance(owner),
    ata.then((a) => connection.getTokenAccountBalance(a).catch(() => null)),
  ])
  const usdcRawInt = usdcRaw ? Number(usdcRaw.value.amount) : 0
  return {
    sol: lamports / LAMPORTS_PER_SOL,
    usdc: usdcRawInt / 10 ** USDC_DECIMALS,
    solRaw: lamports,
    usdcRaw: usdcRawInt,
  }
}

function describeTxError(err: unknown): string {
  if (err instanceof Error) return err.message
  const s = JSON.stringify(err)
  return s && s !== "{}" ? s : "transaction failed during simulation"
}

export async function simulateTx(
  tx: Transaction | VersionedTransaction,
): Promise<SimResult> {
  try {
    // TS overloads don't accept the union; branch so each call matches exactly one.
    // (legacy overload takes no config — its default already skips sig verification)
    const res =
      tx instanceof Transaction
        ? await connection.simulateTransaction(tx)
        : await connection.simulateTransaction(tx, { sigVerify: false })
    if (res.value.err) {
      return { ok: false, error: describeTxError(res.value.err), logs: res.value.logs ?? [] }
    }
    return { ok: true, logs: res.value.logs ?? [] }
  } catch (e) {
    return { ok: false, error: describeTxError(e), logs: [] }
  }
}

export async function buildSOLTransfer(
  owner: PublicKey,
  dest: PublicKey,
  amountSol: number,
): Promise<Transaction> {
  const { blockhash } = await connection.getLatestBlockhash()
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: dest,
      lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
    }),
  )
  tx.feePayer = owner
  tx.recentBlockhash = blockhash
  return tx
}

export async function buildUSDCTransfer(
  owner: PublicKey,
  dest: PublicKey,
  amountUsdc: number,
): Promise<Transaction> {
  const srcAta = await getAssociatedTokenAddress(USDC_MINT, owner)
  const dstAta = await getAssociatedTokenAddress(USDC_MINT, dest)
  const tx = new Transaction()
  // Create the recipient's USDC account first if they don't have one.
  const dstInfo = await connection.getAccountInfo(dstAta)
  if (!dstInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        owner,
        dstAta,
        dest,
        USDC_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    )
  }
  tx.add(
    createTransferInstruction(
      srcAta,
      dstAta,
      owner,
      Math.floor(amountUsdc * 10 ** USDC_DECIMALS),
    ),
  )
  const { blockhash } = await connection.getLatestBlockhash()
  tx.feePayer = owner
  tx.recentBlockhash = blockhash
  return tx
}

/** Signature function injected from the wallet adapter. */
export type Signer = <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>

/** Refresh blockhash (the user may have stared at the confirm card a while), then sign+send+confirm. */
export async function signSendConfirm(signTransaction: Signer, tx: Transaction): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  const signed = await signTransaction(tx)
  const signature = await connection.sendRawTransaction(signed.serialize())
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed")
  return signature
}

export function shortAddress(addr: string, keep = 4): string {
  return addr.length > keep * 2 + 1 ? `${addr.slice(0, keep)}…${addr.slice(-keep)}` : addr
}
