// Dual-track risk, code side (architecture rule #3): the LLM flags *semantic*
// weirdness via risk_flags; this module judges the *numbers* deterministically.
// Output drives the confirm card level: 🟢 light / 🟡 standard / 🔴 strict.

import type { Asset, ConfirmLevel, RiskAssessment, RiskFlag } from "./types"

const RATIO_STRICT = 0.9
const RATIO_STANDARD = 0.5

// Hackathon demo value; production would scale with the user's history.
export const SESSION_USD_LIMIT = 50

// Demo blocklist. Production: query a scam-address database at confirm time.
const BLOCKLIST = new Set<string>([
  // intentionally empty for the demo; populated via risk feeds in production
])

export const FLAG_LABELS: Record<RiskFlag, string> = {
  all_assets: "This moves your entire balance",
  unsolicited_address: "You haven't mentioned this address before",
  promise_of_returns: "Someone promised you gains or a refund",
  pressure_tactic: "Urgency or pressure language detected",
}

export interface RiskInput {
  asset: Asset
  amount: number
  balance: number
  riskFlags: RiskFlag[]
  dest?: string
  /** false when the destination address is not in the user's contacts */
  destKnown?: boolean
  sessionTotalUsd?: number
}

export function assessRisk(input: RiskInput): RiskAssessment {
  const reasons: string[] = []
  let level: ConfirmLevel = "light"

  const bump = (to: ConfirmLevel) => {
    const order: ConfirmLevel[] = ["light", "standard", "strict"]
    if (order.indexOf(to) > order.indexOf(level)) level = to
  }

  // Track 1 — numeric checks.
  if (input.balance > 0) {
    const ratio = input.amount / input.balance
    if (ratio > RATIO_STRICT) {
      bump("strict")
      reasons.push(`This is over 90% of your ${input.asset} balance`)
    } else if (ratio > RATIO_STANDARD) {
      bump("standard")
      reasons.push(`This is more than half of your ${input.asset} balance`)
    }
  }

  // Track 2 — semantic flags raised by the LLM.
  for (const flag of input.riskFlags) {
    const hard = flag === "all_assets" || flag === "pressure_tactic"
    bump(hard ? "strict" : "standard")
    reasons.push(FLAG_LABELS[flag])
  }

  if (input.dest && BLOCKLIST.has(input.dest)) {
    bump("strict")
    reasons.push("Destination address is on a known blocklist")
  }

  // Sending outside the address book always warrants a careful read.
  if (input.dest && input.destKnown === false) {
    bump("standard")
    reasons.push("This address is not in your contacts")
  }

  if ((input.sessionTotalUsd ?? 0) >= SESSION_USD_LIMIT) {
    bump("standard")
    reasons.push(`You've already moved over $${SESSION_USD_LIMIT} this session`)
  }

  return { level, reasons }
}
