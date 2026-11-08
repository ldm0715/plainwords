// Shared domain types for the PlainWords intent pipeline.
//
// Architecture rule #1: the LLM only produces *semantics* (mode, asset,
// direction). Every number a user will actually sign is computed here in
// deterministic code.

export type Asset = "SOL" | "USDC"
export type AmountMode = "all" | "half" | "amount"

// LLM-side semantic risk flags (architecture rule #3: dual-track risk).
export type RiskFlag =
  | "all_assets"
  | "unsolicited_address"
  | "promise_of_returns"
  | "pressure_tactic"

export interface SwapIntent {
  tool: "swap_tokens"
  from: Asset
  to: Asset
  mode: AmountMode
  amount?: number
  risk_flags: RiskFlag[]
}

export interface SendIntent {
  tool: "send_payment"
  to: string
  asset: Asset
  mode: AmountMode
  amount?: number
  risk_flags: RiskFlag[]
}

export interface BalanceIntent {
  tool: "get_balance"
  risk_flags?: RiskFlag[]
}

/** Live SOL⇄USDC spot price. Read-only: no chain touch, no confirmation card. */
export interface PriceIntent {
  tool: "get_price"
  /** asset being priced; the quote is the other wallet asset. Default "SOL". */
  asset?: Asset
  /** how much of `asset` to price. Default 1. */
  amount?: number
}

/** Local-only actions on the address book. Never touch the chain. */
export interface AddContactIntent {
  tool: "add_contact"
  name: string
  address: string
}

export interface EditContactIntent {
  tool: "edit_contact"
  /** current name of the contact to edit */
  name: string
  new_name?: string
  new_address?: string
}

export interface RemoveContactIntent {
  tool: "remove_contact"
  name: string
}

export type ContactIntent = AddContactIntent | EditContactIntent | RemoveContactIntent

/** Ask about the saved transfer history (answered from the local cache). */
export interface QueryTransfersIntent {
  tool: "query_transfers"
  asset?: Asset
  direction?: "out" | "in"
  counterparty?: string
  days?: number
  limit?: number
}

export type Intent =
  | SwapIntent
  | SendIntent
  | BalanceIntent
  | PriceIntent
  | ContactIntent
  | QueryTransfersIntent

export interface Balances {
  sol: number
  usdc: number
  /** raw integers — all amount math happens here, floats only for display */
  solRaw: number
  usdcRaw: number
}

export type ConfirmLevel = "light" | "standard" | "strict"

export interface RiskAssessment {
  level: ConfirmLevel
  reasons: string[]
}

export interface SimResult {
  ok: boolean
  error?: string
  logs: string[]
}

/** A send action fully resolved by deterministic code, awaiting user confirmation. */
export interface PendingSend {
  kind: "send"
  intent: SendIntent
  asset: Asset
  uiAmount: number
  balanceBefore: number
  destAddress: string
  /** contact name, when the destination resolved from the address book */
  destLabel?: string
  feeSOL: number
  risk: RiskAssessment
  sim: SimResult | null
  /**
   * Set when several sends were requested in one sentence (system.md rule 5).
   * Lets confirm-time summaries reference sibling legs deterministically
   * instead of an LLM guessing what "the rest of the request" did.
   */
  batch?: { id: string; index: number; total: number }
}

/**
 * A swap resolved and quoted at live MAINNET rates (Jupiter retired devnet
 * routing in 2026 — real swaps can't land on devnet). Quote-only: the confirm
 * card shows the estimate and the mainnet-ready note; nothing executes.
 */
export interface PendingSwap {
  kind: "swap"
  intent: SwapIntent
  asset: Asset
  uiAmount: number
  balanceBefore: number
  toAsset: Asset
  expectedOut: number
  priceImpactPct: number
  feeSOL: number
  risk: RiskAssessment
}

export type PendingAction = PendingSend | PendingSwap

export interface ExecResult {
  ok: boolean
  signature?: string
  error?: string
  sentAmount?: number
  receivedAmount?: number
}

// --- Chat stream ---

export interface UserMessage {
  id: string
  role: "user"
  text: string
}

export interface AssistantMessage {
  id: string
  role: "assistant"
  text: string
}

export type ConfirmStatus =
  | "pending"
  | "executing"
  | "confirmed"
  | "cancelled"
  | "failed"
  | "closed"

export interface ConfirmMessage {
  id: string
  role: "confirm"
  action: PendingAction
  status: ConfirmStatus
  result?: ExecResult
  summary?: string
}

/** A pending contact edit/removal awaiting user confirmation. */
export interface PendingContactAction {
  op: "edit" | "remove"
  originalName: string
  newName?: string
  newAddress?: string
  newDescription?: string
  /** address before the change, for preview */
  currentAddress?: string
  currentDescription?: string
}

export type ContactConfirmStatus = "pending" | "applied" | "cancelled"

/** In-chat confirmation card (LLM-requested contact changes). */
export interface ContactConfirmMessage {
  id: string
  role: "contact-confirm"
  action: PendingContactAction
  status: ContactConfirmStatus
}

export type ChatMessage =
  | UserMessage
  | AssistantMessage
  | ConfirmMessage
  | ContactConfirmMessage
