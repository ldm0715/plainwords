// LLM access via any OpenAI-compatible endpoint (default: GLM/Zhipu — see .env).
// Browser-side call is an accepted hackathon tradeoff (see docs/plainwords-plan.md §3);
// keys ship in the bundle, never in git.

import { PublicKey } from "@solana/web3.js"
import OpenAI from "openai"
import systemPrompt from "@/prompts/system.md?raw"
import { formatContactsForPrompt, type Contact } from "./contacts"
import { formatNowForPrompt, isLocalDate } from "./time"
import type {
  Asset,
  AmountMode,
  BalanceIntent,
  EditContactIntent,
  HistoryPeriod,
  Intent,
  PriceIntent,
  QueryTransfersIntent,
  RiskFlag,
  SendIntent,
  SwapIntent,
} from "./types"

// The OpenAI SDK needs an ABSOLUTE URL (it calls new URL(baseURL) internally),
// so a relative "/llm" proxy base is resolved against the page origin — the
// request stays same-origin and flows through the vite dev proxy.
function resolveBaseUrl(raw: string): string {
  if (raw.startsWith("/") && typeof window !== "undefined") {
    return `${window.location.origin}${raw}`
  }
  return raw
}

const ENV_BASE_URL = resolveBaseUrl(
  import.meta.env.VITE_LLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
)
const ENV_MODEL = import.meta.env.VITE_LLM_MODEL || "glm-5.3-flash"

// Optional extra headers for gateways that need them, e.g. opencode.ai zen
// requires {"x-opencode-session":"<id>"}.
function parseExtraHeaders(): Record<string, string> {
  try {
    const parsed = JSON.parse(import.meta.env.VITE_LLM_EXTRA_HEADERS || "{}")
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

// Runtime overrides from the Settings dialog (localStorage). A user-supplied
// key/url beats the build-time env — lets judges run the deployed app with
// their own key without touching a repo file.
export interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
}

const LLM_CFG_KEY = "plainwords:llmConfig"

/** Sentinel shown in Settings when requests use the server-side key. */
export const SERVER_KEY_PLACEHOLDER = "server-managed"

export function loadLLMConfig(): Partial<LLMConfig> {
  try {
    const raw = localStorage.getItem(LLM_CFG_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export function saveLLMConfig(cfg: Partial<LLMConfig>): void {
  if (!cfg.apiKey && !cfg.baseUrl && !cfg.model) {
    localStorage.removeItem(LLM_CFG_KEY)
  } else {
    localStorage.setItem(LLM_CFG_KEY, JSON.stringify(cfg))
  }
}

// In production builds the app is served by Vercel: /api/llm is an Edge
// Function that injects the server-side key (ZHIPU_API_KEY) — or forwards a
// user's own key from Settings (BYOK) via the x-api-key header. Local dev
// keeps the vite /llm proxy + .env key.
const isProd = Boolean(import.meta.env.PROD)

/** Build the client from the effective config (settings > env). */
function buildClient(): OpenAI {
  const effective = getLLMConfig()
  return new OpenAI({
    baseURL: effective.baseUrl,
    apiKey: effective.apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      ...parseExtraHeaders(),
      // BYOK: forward the user's own key to the /api/llm edge function
      ...(isProd && savedApiKey() ? { "x-api-key": savedApiKey()! } : {}),
    },
  })
}

let client = buildClient()

/** Current effective config: settings overrides > env fallbacks. */
export function getLLMConfig(): LLMConfig {
  const saved = loadLLMConfig()
  if (isProd) {
    return {
      baseUrl: saved.baseUrl || resolveBaseUrl("/api/llm"),
      apiKey: saved.apiKey || SERVER_KEY_PLACEHOLDER,
      model: saved.model || ENV_MODEL,
    }
  }
  return {
    baseUrl: saved.baseUrl || ENV_BASE_URL,
    apiKey: saved.apiKey || import.meta.env.VITE_LLM_KEY || "",
    model: saved.model || ENV_MODEL,
  }
}

function savedApiKey(): string | undefined {
  const key = loadLLMConfig().apiKey
  // The placeholder is not a real key — never forward it as BYOK.
  return key && key !== SERVER_KEY_PLACEHOLDER ? key : undefined
}

/** Rebuild the client after the user changes settings. */
export function applyLLMConfig(cfg: Partial<LLMConfig>): void {
  saveLLMConfig(cfg)
  client = buildClient()
}

const client_ = () => client

export const isAIConfigured = () => Boolean(getLLMConfig().apiKey)

/** Fetch the model list from the configured endpoint (OpenAI-compatible /models). */
export async function fetchModels(cfg: { baseUrl: string; apiKey: string }): Promise<string[]> {
  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`)
  }
  const json = (await res.json()) as { data?: { id: string }[] }
  const ids = (json.data ?? []).map((m) => m.id).filter(Boolean)
  return ids.sort()
}

const ASSETS: Asset[] = ["SOL", "USDC"]
const MODES: AmountMode[] = ["all", "half", "amount"]
const FLAGS: RiskFlag[] = [
  "all_assets",
  "unsolicited_address",
  "promise_of_returns",
  "pressure_tactic",
]

const HISTORY_PERIODS: HistoryPeriod[] = [
  "today",
  "yesterday",
  "last_3_days",
  "last_7_days",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
]

// Prompt parity (system.md rule 5): at most 3 send_payment calls per turn.
const MAX_TURN_INTENTS = 3

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_balance",
      description:
        "Show the user's current SOL and USDC balances — these are the complete balances for the two supported assets. Call when they ask how much they have.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_price",
      description:
        "Live Jupiter SOL/USDC quote — an estimate, not a guaranteed execution price. Call when the user asks what SOL or USDC is worth in the other asset, e.g. \"SOL 现在多少 U?\", \"what's 0.5 SOL in USDC?\". Read-only — no confirmation needed.",
      parameters: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            enum: ASSETS,
            description: "Asset being priced. Default SOL (priced in USDC).",
          },
          amount: {
            type: "number",
            description: "Amount of that asset to price. Default 1.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "swap_tokens",
      description:
        "Swap between SOL and USDC. Use mode 'half' for 'half of it', 'all' for 'everything', 'amount' only when the user said an exact number. This only opens a quote/confirmation card — nothing executes until the user confirms. On devnet swaps are quote-only (no settlement); on mainnet the same card executes.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", enum: ASSETS },
          to: { type: "string", enum: ASSETS },
          mode: { type: "string", enum: MODES },
          amount: {
            type: "number",
            description: "Exact amount in token units. Only for mode 'amount'.",
          },
          risk_flags: { type: "array", items: { type: "string", enum: FLAGS } },
        },
        required: ["from", "to", "mode", "risk_flags"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_payment",
      description:
        "Send SOL or USDC to a Solana address. Use mode 'half' for 'half of it', 'all' for 'everything', 'amount' only when the user said an exact number. This only opens a confirmation card — the transfer executes after the user confirms and signs.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Destination Solana address (base58)" },
          asset: { type: "string", enum: ASSETS },
          mode: { type: "string", enum: MODES },
          amount: {
            type: "number",
            description: "Exact amount in token units. Only for mode 'amount'.",
          },
          risk_flags: { type: "array", items: { type: "string", enum: FLAGS } },
        },
        required: ["to", "asset", "mode", "risk_flags"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_contact",
      description:
        "Save a name → Solana address mapping to the user's contacts. Call when the user asks to remember/save/add a contact (e.g. \"remember alice as <address>\", \"save this address as bob\"). Local-only, nothing goes on-chain.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short contact name, e.g. 'alice'" },
          address: { type: "string", description: "Solana address (base58)" },
        },
        required: ["name", "address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_contact",
      description:
        "Change an existing contact's name and/or address. `name` must match a contact from Known contacts. Include new_name and/or new_address — at least one.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Current contact name to edit" },
          new_name: { type: "string", description: "New name (omit to keep)" },
          new_address: { type: "string", description: "New Solana address (omit to keep)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_contact",
      description:
        "Delete a contact by name. `name` must match a contact from Known contacts. Only call when the user clearly wants to delete/forget a contact.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact name to delete" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_transfers",
      description:
        "Look up the user's SOL/USDC transfer history (in and out). Use for questions like \"who did I send to?\", \"how much did I send to fat?\", \"这周花了多少钱\", \"最大的一笔是多少\". The result is data for you to summarize in the user's language. " +
        "Fields: `count` = matching transfers in the loaded history; `returned` = rows in `transfers` (a display list only, may be smaller than `count`); `window` = the resolved local date range actually used; `summary` = totals over ALL matches — `matched`, `sent`/`received` sums and fees, USD estimates, and `ranked` (every match sorted by USD value, largest first); `coverage` = `loaded`, `oldestLoaded`, and `partial` (true means older transfers inside the requested window may not be scanned yet). " +
        "Time filters are natural local calendar days, not rolling hours: prefer `period` for named windows ('today', 'this_week' starts Monday), `since`/`until` for explicit dates or ranges from the Current time block, and `days` only for 'past N days' including today. " +
        "History is synced from the chain on wallet connect: roughly the latest 50 signatures per address, cache up to 100 transfers, SOL/USDC only. " +
        "Never count, sum, convert or sort yourself — read `summary` and `ranked`. If `coverage.partial` is true, say the totals are based on the latest available transfers; never present them as a complete week/all-time total.",
      parameters: {
        type: "object",
        properties: {
          asset: { type: "string", enum: ASSETS, description: "Filter by token (optional)" },
          direction: {
            type: "string",
            enum: ["out", "in"],
            description: "out = sent by user, in = received (optional)",
          },
          counterparty: {
            type: "string",
            description: "Contact name or exact address to filter by (optional)",
          },
          signature: {
            type: "string",
            description:
              "Order id (transaction signature), full or the 8-char prefix shown in result messages. Use it to look up ONE specific transfer.",
          },
          period: {
            type: "string",
            enum: HISTORY_PERIODS,
            description:
              "Named natural-day window in the user's local timezone. this_week starts Monday. Prefer this when the user names a period (optional)",
          },
          since: {
            type: "string",
            description:
              "Inclusive local start date, YYYY-MM-DD — take it from the Current time block, e.g. for '前三天' use the date 3 days ago (optional)",
          },
          until: {
            type: "string",
            description:
              "Inclusive local end date, YYYY-MM-DD (optional; omit for 'up to now')",
          },
          days: {
            type: "number",
            description:
              "Last N calendar days including today (1–365), local timezone. Use only for 'past N days'; for named periods prefer `period` (optional)",
          },
          limit: {
            type: "number",
            description:
              "Display list size only, 1–50 (default 10). Totals always cover every match (optional)",
          },
        },
        required: [],
      },
    },
  },
]

export interface HistoryTurn {
  role: "user" | "assistant"
  content: string
}

/** One parsed tool call: the validated intent plus its id for read-only round-trips. */
export interface IntentItem {
  intent: Intent
  toolCallId?: string
}

export type AIResult =
  | { kind: "text"; text: string }
  | { kind: "intents"; items: IntentItem[]; warning?: string }

/** Narrow + validate raw tool arguments into a typed Intent; null when invalid. */
function coerceIntent(name: string, raw: string): Intent | null {
  let args: Record<string, unknown>
  try {
    args = JSON.parse(raw || "{}")
  } catch {
    return null
  }
  const flags = Array.isArray(args.risk_flags)
    ? (args.risk_flags as string[]).filter((f): f is RiskFlag => FLAGS.includes(f as RiskFlag))
    : []

  if (name === "get_balance") {
    const intent: BalanceIntent = { tool: "get_balance" }
    return intent
  }

  if (name === "get_price") {
    const intent: PriceIntent = { tool: "get_price" }
    if (ASSETS.includes(args.asset as Asset)) intent.asset = args.asset as Asset
    if (typeof args.amount === "number" && args.amount > 0) intent.amount = args.amount
    return intent
  }

  const mode = MODES.includes(args.mode as AmountMode) ? (args.mode as AmountMode) : null
  const amount = typeof args.amount === "number" && args.amount > 0 ? args.amount : undefined

  if (name === "swap_tokens") {
    const from = ASSETS.includes(args.from as Asset) ? (args.from as Asset) : null
    const to = ASSETS.includes(args.to as Asset) ? (args.to as Asset) : null
    if (!from || !to || from === to || !mode) return null
    if (mode === "amount" && !amount) return null
    const intent: SwapIntent = { tool: "swap_tokens", from, to, mode, risk_flags: flags }
    if (amount !== undefined) intent.amount = amount
    return intent
  }

  if (name === "send_payment") {
    const to = typeof args.to === "string" ? args.to.trim() : ""
    const asset = ASSETS.includes(args.asset as Asset) ? (args.asset as Asset) : null
    try {
      new PublicKey(to) // validates base58 shape; throws on garbage
    } catch {
      return null
    }
    if (!to || !asset || !mode) return null
    if (mode === "amount" && !amount) return null
    const intent: SendIntent = { tool: "send_payment", to, asset, mode, risk_flags: flags }
    if (amount !== undefined) intent.amount = amount
    return intent
  }

  if (name === "add_contact") {
    const name2 = typeof args.name === "string" ? args.name.trim() : ""
    const address = typeof args.address === "string" ? args.address.trim() : ""
    if (!name2 || !address) return null
    try {
      new PublicKey(address)
    } catch {
      return null
    }
    return { tool: "add_contact", name: name2, address }
  }

  if (name === "edit_contact") {
    const name2 = typeof args.name === "string" ? args.name.trim() : ""
    const newName =
      typeof args.new_name === "string" && args.new_name.trim() ? args.new_name.trim() : undefined
    const newAddress =
      typeof args.new_address === "string" && args.new_address.trim()
        ? args.new_address.trim()
        : undefined
    if (!name2 || (!newName && !newAddress)) return null
    if (newAddress) {
      try {
        new PublicKey(newAddress)
      } catch {
        return null
      }
    }
    const intent: EditContactIntent = { tool: "edit_contact", name: name2 }
    if (newName) intent.new_name = newName
    if (newAddress) intent.new_address = newAddress
    return intent
  }

  if (name === "remove_contact") {
    const name2 = typeof args.name === "string" ? args.name.trim() : ""
    if (!name2) return null
    return { tool: "remove_contact", name: name2 }
  }

  if (name === "query_transfers") {
    const intent: QueryTransfersIntent = { tool: "query_transfers" }
    if (ASSETS.includes(args.asset as Asset)) intent.asset = args.asset as Asset
    if (args.direction === "out" || args.direction === "in") intent.direction = args.direction
    if (typeof args.counterparty === "string" && args.counterparty.trim()) {
      intent.counterparty = args.counterparty.trim()
    }
    if (typeof args.signature === "string" && args.signature.trim()) {
      intent.signature = args.signature.trim()
    }
    if (typeof args.period === "string" && args.period.trim()) {
      if (!HISTORY_PERIODS.includes(args.period as HistoryPeriod)) return null
      intent.period = args.period as HistoryPeriod
    }
    // A malformed date would silently query the wrong window — reject the call
    // and let the guided retry produce a valid one.
    if (typeof args.since === "string" && args.since.trim()) {
      if (!isLocalDate(args.since)) return null
      intent.since = args.since.trim()
    }
    if (typeof args.until === "string" && args.until.trim()) {
      if (!isLocalDate(args.until)) return null
      intent.until = args.until.trim()
    }
    if (typeof args.limit === "number" && args.limit > 0) {
      intent.limit = Math.min(Math.floor(args.limit), 50)
    }
    if (typeof args.days === "number" && args.days > 0) {
      intent.days = Math.min(Math.floor(args.days), 365)
    }
    return intent
  }

  return null
}

/**
 * One turn of intent parsing: plain-language reply OR 1..N validated tool
 * intents (multi-send turns — system.md rule 5). Contacts are injected into
 * the system prompt so names resolve to addresses. Retries once on malformed
 * output (docs/plainwords-plan.md §9).
 */
export async function parseIntent(
  history: HistoryTurn[],
  contacts: Contact[] = [],
): Promise<AIResult> {
  if (!isAIConfigured()) {
    throw new Error(
      `AI is not configured — set your API key in Settings (or VITE_LLM_KEY in .env; endpoint ${getLLMConfig().baseUrl}, model ${getLLMConfig().model}).`,
    )
  }

  const system = systemPrompt + formatNowForPrompt() + formatContactsForPrompt(contacts)

  const ask = async () =>
    client_().chat.completions.create({
      model: getLLMConfig().model,
      temperature: 0.2,
      tools: TOOLS,
      messages: [{ role: "system", content: system }, ...history],
    })

  let res = await ask()
  let msg = res.choices[0]?.message

  // Coerce EVERY function tool call into a validated intent — one sentence may
  // carry several transfers (system.md rule 5). A turn is all-or-nothing: one
  // malformed call voids the whole turn (never silently drop a transfer leg)
  // and triggers the guided retry below.
  const parseCalls = (m: typeof msg): IntentItem[] | null => {
    const calls = m?.tool_calls ?? []
    if (!calls.length) return null
    const items: IntentItem[] = []
    for (const call of calls) {
      // openai v5 unions custom tool calls into tool_calls; only function calls are ours
      if (call.type !== "function") return []
      const intent = coerceIntent(call.function.name, call.function.arguments)
      if (!intent) return []
      items.push({ intent, toolCallId: call.id })
    }
    return items
  }

  let items = parseCalls(msg)

  if (items !== null && items.length === 0) {
    // Malformed tool output → one guided retry (docs/plainwords-plan.md §9).
    res = await ask()
    msg = res.choices[0]?.message
    items = parseCalls(msg)
  }

  if (items !== null && items.length > 0) {
    return {
      kind: "intents",
      items: items.slice(0, MAX_TURN_INTENTS),
      warning: msg?.content?.trim() || undefined, // rule 7: verbal warning alongside the calls
    }
  }

  const text = msg?.content?.trim()
  if (text) return { kind: "text", text }
  return {
    kind: "text",
    text: "I'm not sure I understood that. Could you say it another way? For example: “swap half my SOL into USDC”.",
  }
}

/**
 * Second round for read-only tools: feed the tool's data result back to the
 * model and let it answer in natural language (e.g. history summaries).
 */
export async function answerWithToolResult(args: {
  history: HistoryTurn[]
  toolCallId: string
  toolName: string
  toolArgs: unknown
  result: unknown
}): Promise<string> {
  const res = await client_().chat.completions.create({
    model: getLLMConfig().model,
    temperature: 0.3,
    tools: TOOLS,
    messages: [
      { role: "system", content: systemPrompt + formatNowForPrompt() },
      ...args.history,
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: args.toolCallId,
            type: "function",
            function: { name: args.toolName, arguments: JSON.stringify(args.toolArgs) },
          },
        ],
      },
      { role: "tool", tool_call_id: args.toolCallId, content: JSON.stringify(args.result) },
    ],
  })
  return res.choices[0]?.message?.content?.trim() || ""
}

/** Post-transaction plain-language summary. Falls back to a template if GLM fails. */
export async function summarize(args: {
  userText: string
  summaryTemplate: string
}): Promise<string> {
  if (!isAIConfigured()) return args.summaryTemplate
  try {
    const res = await client_().chat.completions.create({
      model: getLLMConfig().model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You summarize finished Solana transactions for a non-technical user. One or two short, warm sentences. REPLY IN THE SAME LANGUAGE as the user's message below (Chinese message ⇒ Chinese summary). Use the numbers you are given exactly — never invent or round differently. The transaction result is complete and self-contained: describe ONLY what it states — never speculate about other transfers, pending items, or what the transaction history does or does not show. No emoji spam, no financial advice.",
        },
        {
          role: "user",
          content: `User asked: "${args.userText}"\nTransaction result: ${args.summaryTemplate}\nWrite the summary.`,
        },
      ],
    })
    return res.choices[0]?.message?.content?.trim() || args.summaryTemplate
  } catch {
    return args.summaryTemplate
  }
}
