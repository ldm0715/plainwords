import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react"
import { WalletModalProvider, useWalletModal } from "@solana/wallet-adapter-react-ui"
import "@solana/wallet-adapter-react-ui/styles.css"
import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BalanceCards } from "@/components/BalanceBar"
import { ChatInput } from "@/components/ChatInput"
import { ChatWindow } from "@/components/ChatWindow"
import { ContactActionDialog } from "@/components/ContactActionDialog"
import { ContactsPanel } from "@/components/ContactsPanel"
import { SendContactDialog } from "@/components/SendContactDialog"
import { GuidePanel } from "@/components/GuidePanel"
import { SettingsDialog } from "@/components/SettingsDialog"
import { HistoryPanel } from "@/components/HistoryPanel"
import { MainTabs, type Tab } from "@/components/MainTabs"
import { SessionList } from "@/components/SessionList"
import { Sidebar } from "@/components/Sidebar"
import { answerWithToolResult, parseIntent, summarize, type HistoryTurn } from "@/lib/ai"
import {
  addContact,
  loadContacts,
  migrateLegacyContacts,
  removeContact,
  updateContact,
  type Contact,
} from "@/lib/contacts"
import { executeSend, fmtAmount, resolveSend, resolveSwap, templateSummary } from "@/lib/pipeline"
import {
  matchTransfers,
  ingestSignatures,
  loadCachedHistory,
  syncTransferHistory,
  type TransferRecord,
} from "@/lib/history"
import { setLangFromText, t, ui, type Lang } from "@/lib/i18n"
import { getSOLPriceUSD } from "@/lib/price"
import {
  loadActiveId,
  loadSessions,
  makeSession,
  migrateLegacySessions,
  saveActiveId,
  saveSessions,
  uid,
  type Session,
} from "@/lib/sessions"
import {
  DEVNET_ENDPOINT,
  SIGN_WINDOW_CLOSED,
  USDC_MINT,
  connection,
  getBalances,
} from "@/lib/solana"
import { getAssociatedTokenAddress } from "@solana/spl-token"
import type {
  Balances,
  ChatMessage,
  ConfirmMessage,
  PendingContactAction,
  PendingSend,
  SendIntent,
  SwapIntent,
} from "@/lib/types"

function WalletProviders({ children }: { children: React.ReactNode }) {
  // Phantom (and any Wallet-Standard wallet) auto-registers — explicit adapters
  // only trigger the "registered as a Standard Wallet" warning.
  const wallets = useMemo(() => [], [])
  return (
    <ConnectionProvider endpoint={DEVNET_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

/** Shared "connect a wallet first" prompt for wallet-gated areas. */
function ConnectCard({
  title,
  body,
  connecting,
  onConnect,
}: {
  title: string
  body: string
  connecting: boolean
  onConnect: () => void
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
        <Wallet className="size-5" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{body}</p>
      </div>
      <Button onClick={onConnect} disabled={connecting}>
        {connecting ? ui("Connecting…", "连接中…") : ui("Connect wallet", "连接钱包")}
      </Button>
    </div>
  )
}

function AppInner() {
  const { publicKey, signTransaction, connected, connecting } = useWallet()
  const { setVisible: openWalletModal } = useWalletModal()
  // Chat needs a wallet: balances, contacts scoping and signing all depend on it.
  const walletReady = Boolean(publicKey && connected)
  const [tab, setTab] = useState<Tab>("chat")
  const [busy, setBusy] = useState(false)
  // which session has an LLM round-trip in flight (session-list spinner)
  const [busySid, setBusySid] = useState<string | null>(null)
  // UI language (Settings dialog) — state exists purely to re-render on change
  const [, setUiLangTick] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Everything user-scoped is keyed by the connected wallet (Phantom supports
  // account switching — chats, contacts and risk totals must not leak across).
  const ownerKey = publicKey?.toBase58() ?? "guest"
  const sessionTotalUsdRef = useRef(0)
  const lastUserTextRef = useRef("")
  // Live progress of multi-send batches (one sentence, several transfers):
  // lets each leg's summary state how many legs are done / still pending.
  // Session-scoped on purpose — stale cards after a reload just summarize
  // without the batch suffix.
  const batchProgress = useRef(new Map<string, { total: number; done: number; skipped: number }>())

  // --- conversation sessions (persisted, per-account) ---
  const [sessions, setSessions] = useState<Session[]>(() => {
    const loaded = loadSessions("guest")
    return loaded.length ? loaded : [makeSession()]
  })
  const [activeId, setActiveId] = useState<string>(() => {
    const ids = loadSessions("guest").map((s) => s.id)
    const saved = loadActiveId("guest")
    return saved && ids.includes(saved) ? saved : (ids[0] ?? "")
  })
  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0]
  const messages = activeSession?.messages ?? []

  // Switch account spaces whenever the connected wallet changes (also covers
  // the guest → real-account transition after autoConnect).
  useEffect(() => {
    // risk session totals are per-account too — reset on switch
    sessionTotalUsdRef.current = 0
    migrateLegacySessions(ownerKey)
    migrateLegacyContacts(ownerKey)
    const loaded = loadSessions(ownerKey)
    setSessions(loaded.length ? loaded : [makeSession()])
    const ids = loaded.map((s) => s.id)
    const saved = loadActiveId(ownerKey)
    setActiveId(saved && ids.includes(saved) ? saved : (ids[0] ?? ""))
    setContacts(loadContacts(ownerKey))
  }, [ownerKey])

  useEffect(() => saveSessions(ownerKey, sessions), [sessions, ownerKey])
  useEffect(() => {
    if (activeId) saveActiveId(ownerKey, activeId)
  }, [activeId, ownerKey])

  // All session writes go through here with an EXPLICIT session id — async
  // flows capture it at entry so a reply always lands in the session it
  // belongs to, even if the user switches away mid-request.
  const mutateSession = useCallback(
    (sid: string, fn: (msgs: ChatMessage[]) => ChatMessage[], titleFromUser?: string) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sid
            ? {
                ...s,
                messages: fn(s.messages),
                updatedAt: Date.now(),
                title:
                  titleFromUser && s.title === "New chat"
                    ? titleFromUser.slice(0, 32)
                    : s.title,
              }
            : s,
        ),
      )
    },
    [],
  )

  const selectSession = useCallback((id: string) => {
    setActiveId(id)
    setTab("chat")
  }, [])

  const startNewSession = useCallback(() => {
    const s = makeSession()
    setSessions((prev) => [s, ...prev])
    setActiveId(s.id)
    setTab("chat")
  }, [])

  const deleteSession = useCallback(
    (id: string) => {
      const remaining = sessions.filter((s) => s.id !== id)
      const next = remaining.length ? remaining : [makeSession()]
      setSessions(next)
      if (id === activeId || !next.some((s) => s.id === activeId)) setActiveId(next[0].id)
    },
    [sessions, activeId],
  )

  // --- wallet / balances ---
  const [balances, setBalances] = useState<Balances | null>(null)
  const [solPriceUsd, setSolPriceUsd] = useState<number | null>(null)

  const refreshBalances = useCallback(async () => {
    if (!publicKey) {
      setBalances(null)
      return
    }
    try {
      setBalances(await getBalances(publicKey))
    } catch {
      /* devnet hiccup — keep last known balances */
    }
  }, [publicKey])

  useEffect(() => {
    refreshBalances()
    const t = setInterval(refreshBalances, 20_000)
    return () => clearInterval(t)
  }, [refreshBalances])

  useEffect(() => {
    getSOLPriceUSD().then(setSolPriceUsd)
  }, [])

  // --- contacts ---
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts("guest"))

  const handleAddContact = useCallback(
    (name: string, address: string, description?: string) => {
      const res = addContact(ownerKey, name, address, description)
      if (!("error" in res)) setContacts(loadContacts(ownerKey))
      return res
    },
    [ownerKey],
  )

  // --- on-chain transfer history ---
  const [history, setHistory] = useState<TransferRecord[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  // true when the last sync hit the signature-scan cap — older transfers may exist
  const [historyCapped, setHistoryCapped] = useState(false)

  // History sync is rate-limited on purpose (devnet 429s): only runs on wallet
  // change / after a confirmed transfer / manual Refresh, throttled to 30s,
  // and only touches state when the data actually changed.
  const lastSyncAtRef = useRef(0)

  const refreshHistory = useCallback(
    async (opts?: { force?: boolean; manual?: boolean }) => {
      if (!publicKey) {
        setHistory(null)
        setHistoryCapped(false)
        return
      }
      const now = Date.now()
      if (opts?.manual) {
        // a human clicked — always fire (only dedupe sub-second double clicks)
        if (now - lastSyncAtRef.current < 800) return
      } else if (opts?.force) {
        if (now - lastSyncAtRef.current < 3_000) return
      } else if (now - lastSyncAtRef.current < 30_000) {
        return
      }
      lastSyncAtRef.current = now
      setHistoryLoading(true)
      try {
        // cache-first: instant paint from localStorage, then parse only NEW txs
        const { records: next, capped } = await syncTransferHistory(publicKey)
        setHistoryCapped(capped)
        setHistory((prev) => {
          if (
            prev &&
            prev.length === next.length &&
            prev[0]?.signature === next[0]?.signature
          ) {
            return prev // nothing new — keep the old reference, no re-render
          }
          return next
        })
      } catch (e) {
        console.error("[history] sync failed:", e)
        setHistory((prev) => prev ?? loadCachedHistory(publicKey))
      } finally {
        setHistoryLoading(false)
      }
    },
    [publicKey],
  )

  // sync once per wallet connection — no auto-refresh on tab switches; the
  // cache renders instantly and the Refresh button forces a fresh sync
  useEffect(() => {
    refreshHistory({ force: true })
  }, [refreshHistory])

  // Incoming-transfer awareness WITHOUT polling: subscribe to the owner's SOL
  // account + USDC ATA over WebSocket; a balance change (someone paid us)
  // schedules one delayed forced sync (the signature list lags fresh txs by a
  // few seconds — syncing immediately would find nothing).
  useEffect(() => {
    if (!publicKey) return
    let ataSub: number | undefined
    let closed = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const scheduleSync = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (!closed) refreshHistory({ force: true })
      }, 3500)
    }

    const ownerSub = connection.onAccountChange(publicKey, scheduleSync)

    getAssociatedTokenAddress(USDC_MINT, publicKey)
      .then((ata) => {
        if (closed) return
        ataSub = connection.onAccountChange(ata, scheduleSync)
      })
      .catch(() => {})

    return () => {
      closed = true
      if (timer) clearTimeout(timer)
      void connection.removeAccountChangeListener(ownerSub)
      if (ataSub !== undefined) void connection.removeAccountChangeListener(ataSub)
    }
  }, [publicKey, refreshHistory])

  // --- chat flow ---
  const pushTo = useCallback(
    (sid: string, text: string) => {
      mutateSession(sid, (m) => [...m, { id: uid(), role: "assistant", text }])
    },
    [mutateSession],
  )

  // Shared execution tail for transfer/swap intents: deterministic resolve →
  // risk → confirm card. Used by BOTH the chat (LLM intents) and the Contacts
  // send dialog (direct intents, no LLM round-trip).
  const runTransferIntent = useCallback(
    async (
      sid: string,
      intent: SendIntent | SwapIntent,
      batch?: { id: string; index: number; total: number },
    ) => {
      if (!publicKey || !connected) {
        pushTo(sid, t("connectFirst"))
        return
      }
      const pending =
        intent.tool === "send_payment"
          ? await resolveSend(
              publicKey,
              intent,
              sessionTotalUsdRef.current,
              contacts.map((c) => c.address),
            )
          : await resolveSwap(publicKey, intent, sessionTotalUsdRef.current)

      if ("error" in pending) {
        pushTo(sid, pending.error)
        return
      }
      // Tag the confirm card with the contact name when we know it.
      if (pending.kind === "send") {
        pending.destLabel = contacts.find((c) => c.address === pending.destAddress)?.name
        if (batch) pending.batch = batch
      }
      mutateSession(sid, (m) => [
        ...m,
        { id: uid(), role: "confirm", action: pending, status: "pending" },
      ])
    },
    [publicKey, connected, pushTo, contacts, mutateSession],
  )

  const handleSend = useCallback(
    async (text: string) => {
      // The composer is gated on wallet connection; this is the safety net.
      if (!publicKey || !connected) return

      // Bind every write in this flow to the session it was sent from — the
      // user may switch sessions while the LLM round-trip is in flight.
      const sid = activeId
      const pushAssistant = (t: string) => pushTo(sid, t)
      lastUserTextRef.current = text
      setLangFromText(text) // deterministic replies mirror the user's language
      setBusySid(sid)
      mutateSession(sid, (m) => [...m, { id: uid(), role: "user", text }], text)

      setBusy(true)
      try {
        // Only plain text turns go back to the LLM; confirm cards stay UI-side.
        const chatHistory: HistoryTurn[] = messages
          .filter(
            (m): m is Extract<ChatMessage, { role: "user" | "assistant" }> =>
              m.role !== "confirm" && m.role !== "contact-confirm",
          )
          .map((m) => ({ role: m.role, content: m.text }))
        chatHistory.push({ role: "user", content: text })

        const result = await parseIntent(chatHistory, contacts)

        if (result.kind === "text") {
          pushAssistant(result.text)
          return
        }

        if (result.warning) pushAssistant(result.warning)

        // One sentence can carry several transfers (system.md rule 5): run the
        // chain once per parsed call. Batches are send-only — the guard skips
        // any non-executable intent that slips into a multi-call turn.
        const multi = result.items.length > 1
        const sendItems = result.items.filter((i) => i.intent.tool === "send_payment")
        const batching = sendItems.length > 1
        let batchId: string | undefined
        let sendNo = 0
        if (batching) {
          pushAssistant(t("pendingBatch", { count: String(sendItems.length) }))
          batchId = uid()
          batchProgress.current.set(batchId, { total: sendItems.length, done: 0, skipped: 0 })
        }

        for (const item of result.items) {
          const { intent } = item

          if (multi && intent.tool !== "send_payment" && intent.tool !== "swap_tokens") continue

          let batch: PendingSend["batch"] | undefined
          if (batching && intent.tool === "send_payment") {
            sendNo++
            batch = { id: batchId!, index: sendNo, total: sendItems.length }
          }

          if (intent.tool === "get_balance") {
            const b = await getBalances(publicKey)
            const solUsd = solPriceUsd !== null ? ` (≈ $${(b.sol * solPriceUsd).toFixed(2)})` : ""
            const total =
              solPriceUsd !== null ? ` Total ≈ $${(b.sol * solPriceUsd + b.usdc).toFixed(2)}.` : ""
            pushAssistant(
              t("balance", {
                sol: b.sol.toFixed(4),
                solUsd,
                usdc: b.usdc.toFixed(2),
                total,
              }),
            )
            continue
          }

          if (intent.tool === "get_price") {
            // boot-time price if we have it, else a fresh quote; math stays
            // deterministic here — the LLM never converts currencies itself
            const price = solPriceUsd ?? (await getSOLPriceUSD())
            if (price === null) {
              pushAssistant(t("priceUnavailable"))
              continue
            }
            const asset = intent.asset ?? "SOL"
            const amount = intent.amount ?? 1
            const quote = asset === "SOL" ? "USDC" : "SOL"
            const out = asset === "SOL" ? amount * price : amount / price
            pushAssistant(
              t("price", {
                amount: fmtAmount(asset, amount),
                asset,
                out: fmtAmount(quote, out),
                quote,
              }),
            )
            continue
          }

          if (intent.tool === "query_transfers") {
            const all = history ?? (publicKey ? loadCachedHistory(publicKey) : [])
            // resolve a contact name to its address for precise filtering
            const cpAddress = intent.counterparty
              ? (contacts.find((c) => c.name === intent.counterparty!.toLowerCase())?.address ??
                intent.counterparty)
              : undefined
            // Filter first, slice only for display: totals, counts and rankings
            // must cover every match, otherwise "this week's total" silently
            // shrinks to the display limit.
            const matched = matchTransfers(all, {
              asset: intent.asset,
              direction: intent.direction,
              counterpartyAddress: cpAddress,
              signaturePrefix: intent.signature,
              days: intent.days,
            })
            const limit = Math.min(Math.max(intent.limit ?? 10, 1), 50)
            const rows = matched.slice(0, limit)
            // Coverage metadata: history is synced newest-first from a capped
            // signature scan, so the model must know when older matches may be
            // missing instead of assuming the totals are complete.
            const oldestLoaded =
              all.length > 0 ? Math.min(...all.map((r) => r.blockTime)) : null
            const windowStart =
              intent.days && intent.days > 0
                ? Date.now() / 1000 - intent.days * 86400
                : null
            const coverage = {
              loaded: all.length,
              oldestLoaded:
                oldestLoaded === null
                  ? null
                  : new Date(oldestLoaded * 1000)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " "),
              partial:
                historyCapped &&
                oldestLoaded !== null &&
                (windowStart === null || oldestLoaded > windowStart),
            }
            const nameByAddr = new Map(contacts.map((c) => [c.address, c.name]))
            const data = rows.map((r) => ({
              direction: r.outgoing ? "out" : "in",
              counterparty: nameByAddr.get(r.counterparty) ?? r.counterparty,
              asset: r.asset,
              amount: Number(r.uiAmount.toFixed(6)),
              feeSOL: Number(r.feeSOL.toFixed(6)),
              // full on-chain order id — the LLM correlates result messages
              // (8-char prefix) against this; timestamps alone are ambiguous
              signature: r.signature,
              time: new Date(r.blockTime * 1000).toISOString().slice(0, 16).replace("T", " "),
            }))
            // deterministic totals — the LLM quotes these, it never adds numbers itself
            const total = (asset: "SOL" | "USDC", out: boolean) =>
              Number(
                matched
                  .filter((r) => r.asset === asset && r.outgoing === out)
                  .reduce((s, r) => s + r.uiAmount, 0)
                  .toFixed(6),
              )
            const sentFeeSOL = Number(matched.reduce((s, r) => s + (r.outgoing ? r.feeSOL : 0), 0).toFixed(6))
            const solP = solPriceUsd ?? null
            // Ranked view for "largest / smallest / top N" questions — sorting
            // is deterministic code, so the model never compares numbers. The
            // chronological `transfers` list stays untouched for recency.
            const usdOf = (r: TransferRecord) =>
              r.asset === "SOL" ? r.uiAmount * (solP ?? 0) : r.uiAmount
            const sameAsset = matched.length > 0 && matched.every((r) => r.asset === matched[0].asset)
            const ranked =
              solP !== null || sameAsset
                ? [...matched]
                    .sort((a, b) =>
                      solP !== null ? usdOf(b) - usdOf(a) : b.uiAmount - a.uiAmount,
                    )
                    .map((r) => ({
                      direction: r.outgoing ? "out" : "in",
                      asset: r.asset,
                      amount: Number(r.uiAmount.toFixed(6)),
                      counterparty: nameByAddr.get(r.counterparty) ?? r.counterparty,
                      time: new Date(r.blockTime * 1000)
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " "),
                      signature: r.signature,
                      ...(solP !== null ? { usdEstimate: +usdOf(r).toFixed(2) } : {}),
                    }))
                : []
            const summary = {
              matched: matched.length,
              sent: {
                SOL: total("SOL", true),
                USDC: total("USDC", true),
                totalFeesSOL: sentFeeSOL,
                ...(solP !== null ? { usdEstimate: +(total("SOL", true) * solP + total("USDC", true)).toFixed(2) } : {}),
              },
              received: {
                SOL: total("SOL", false),
                USDC: total("USDC", false),
                ...(solP !== null ? { usdEstimate: +(total("SOL", false) * solP + total("USDC", false)).toFixed(2) } : {}),
              },
              // Sorted by USD value, largest first; last entry is the smallest.
              ranked,
            }
            try {
              const answer = await answerWithToolResult({
                history: chatHistory,
                toolCallId: item.toolCallId ?? "",
                toolName: "query_transfers",
                toolArgs: intent,
                result: { count: matched.length, returned: rows.length, coverage, summary, transfers: data },
              })
              pushAssistant(answer || `Found ${matched.length} transfer(s).`)
            } catch {
              // deterministic fallback when the LLM round-trip fails
              if (!matched.length) {
                pushAssistant(t("historyEmpty"))
              } else {
                const lines = rows
                  .slice(0, 5)
                  .map(
                    (r) =>
                      `${r.outgoing ? "→" : "←"} ${r.uiAmount} ${r.asset} · ${
                        nameByAddr.get(r.counterparty) ?? r.counterparty.slice(0, 8)
                      } · ${new Date(r.blockTime * 1000).toLocaleDateString()}`,
                  )
                pushAssistant(lines.join("\n"))
              }
            }
            continue
          }

          if (intent.tool === "add_contact") {
            const res = addContact(ownerKey, intent.name, intent.address)
            if ("error" in res) {
              pushAssistant(t(res.error, { name: intent.name }))
            } else {
              setContacts(loadContacts(ownerKey))
              pushAssistant(
                t("contactSaved", {
                  name: res.name,
                  addr: `${res.address.slice(0, 4)}…${res.address.slice(-4)}`,
                }),
              )
            }
            continue
          }

          if (intent.tool === "edit_contact") {
            const existing = contacts.find((c) => c.name === intent.name.toLowerCase())
            if (!existing) {
              pushAssistant(t("contactNotFound", { name: intent.name }))
              continue
            }
            mutateSession(sid, (m) => [
              ...m,
              {
                id: uid(),
                role: "contact-confirm",
                action: {
                  op: "edit",
                  originalName: existing.name,
                  newName: intent.new_name,
                  newAddress: intent.new_address,
                  currentAddress: existing.address,
                },
                status: "pending",
              },
            ])
            continue
          }

          if (intent.tool === "remove_contact") {
            const existing = contacts.find((c) => c.name === intent.name.toLowerCase())
            if (!existing) {
              pushAssistant(t("contactNotFound", { name: intent.name }))
              continue
            }
            mutateSession(sid, (m) => [
              ...m,
              {
                id: uid(),
                role: "contact-confirm",
                action: {
                  op: "remove",
                  originalName: existing.name,
                  currentAddress: existing.address,
                },
                status: "pending",
              },
            ])
            continue
          }

          await runTransferIntent(sid, intent, batch)
        }
      } catch (e) {
        pushAssistant(
          e instanceof Error ? e.message : t("somethingWentWrong"),
        )
      } finally {
        setBusy(false)
        setBusySid(null)
      }
    },
    [messages, publicKey, connected, walletReady, activeId, pushTo, solPriceUsd, contacts, mutateSession, history],
  )

  const updateConfirmIn = useCallback(
    (sid: string, id: string, patch: Partial<ConfirmMessage>) => {
      mutateSession(sid, (m) =>
        m.map((msg) =>
          msg.id === id && msg.role === "confirm" ? { ...msg, ...patch } : msg,
        ),
      )
    },
    [mutateSession],
  )

  const handleConfirm = useCallback(
    async (id: string) => {
      // this card's session — execution keeps writing here even if the user
      // navigates to another session while the tx is signing/confirming
      const sid = activeId
      const pushAssistant = (t: string) => pushTo(sid, t)
      const updateConfirm = (mid: string, patch: Partial<ConfirmMessage>) =>
        updateConfirmIn(sid, mid, patch)
      const msg = messages.find((m): m is ConfirmMessage => m.id === id && m.role === "confirm")
      if (!msg || msg.status !== "pending") return

      // Swaps are quote-only on devnet (Jupiter retired devnet routing): the
      // card closes with an explanation instead of executing.
      if (msg.action.kind === "swap") {
        updateConfirm(id, { status: "closed" })
        pushAssistant(t("swapClosedQuoteOnly"))
        return
      }

      if (!publicKey || !signTransaction) return
      updateConfirm(id, { status: "executing" })
      try {
        const result = await executeSend(signTransaction, msg.action, publicKey)

        const template = templateSummary(msg.action, result)
        const prog = msg.action.batch ? batchProgress.current.get(msg.action.batch.id) : undefined

        if (!result.ok) {
          // executeSend re-simulated right before signing and refused (balance
          // moved since the card was resolved). Nothing was signed, no fee lost.
          if (prog) prog.skipped++
          updateConfirm(id, { status: "failed", result })
          pushAssistant(
            await summarize({
              userText: lastUserTextRef.current,
              summaryTemplate: template,
            }),
          )
          refreshBalances()
          return
        }

        if (prog) prog.done++

        // Batch legs get deterministic, context-aware summaries — an LLM shown
        // only this tx's result will "helpfully" claim the sibling legs never
        // happened. Only solo sends go through the LLM summarizer.
        let summary: string
        if (prog) {
          const remaining = prog.total - prog.done - prog.skipped
          const suffix =
            remaining > 0
              ? t("batchPartial", {
                  total: String(prog.total),
                  done: String(prog.done),
                  remaining: String(remaining),
                })
              : prog.skipped > 0
                ? t("batchMixed", {
                    total: String(prog.total),
                    done: String(prog.done),
                    skipped: String(prog.skipped),
                  })
                : t("batchDone", { total: String(prog.total) })
          summary = `${template} ${suffix}`
        } else {
          summary = await summarize({
            userText: lastUserTextRef.current,
            summaryTemplate: template,
          })
        }

        // session risk accounting: USD value moved in this session
        const usd =
          msg.action.asset === "SOL" ? msg.action.uiAmount * (solPriceUsd ?? 0) : msg.action.uiAmount
        sessionTotalUsdRef.current += usd

        updateConfirm(id, { status: "confirmed", result })
        // the summary must ALSO live as a plain chat message — confirm cards are
        // hidden from the LLM, so this is how it learns the transfer landed
        pushAssistant(summary)

        // Nudge to save unknown recipients — the address in this message lets the
        // LLM handle a follow-up like "save as alice" without re-asking.
        if (!msg.action.destLabel) {
          pushAssistant(
            t("notInContactsNudge", {
              addr: msg.action.destAddress,
            }),
          )
        }

        refreshBalances()
        // Ingest the just-confirmed tx by its KNOWN signature — the RPC's
        // signature list lags fresh txs by a few seconds, so a plain sync
        // right after confirmation often finds nothing.
        if (result.signature) {
          try {
            setHistory(await ingestSignatures(publicKey, [result.signature]))
          } catch {
            refreshHistory({ force: true })
          }
        } else {
          refreshHistory({ force: true })
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e)
        // Standard-wallet sessions expire silently (locked extension / stale site
        // authorization) — translate that into an actionable message.
        const friendly = /not connected/i.test(raw)
          ? "Your wallet session expired — click the wallet button (bottom left), disconnect, connect again, then retry."
          : raw
        updateConfirm(id, { status: "failed", result: { ok: false, error: friendly } })
        // The card is invisible to the LLM — without a chat message it would
        // see an unanswered transfer request and may claim it succeeded.
        pushAssistant(
          /not connected/i.test(raw)
            ? t("walletSessionExpired")
            : /User rejected/i.test(raw)
              ? t("signRejected")
              : raw.includes(SIGN_WINDOW_CLOSED)
                ? t("signTimeout")
                : t("sendFailed", { err: raw }),
        )
      }
    },
    [messages, publicKey, signTransaction, solPriceUsd, activeId, updateConfirmIn, refreshBalances, refreshHistory, pushTo],
  )

  const handleCancel = useCallback(
    (id: string) => {
      const sid = activeId
      const msg = messages.find((m): m is ConfirmMessage => m.id === id && m.role === "confirm")
      // a cancelled leg still counts against its batch's remaining total
      const prog =
        msg?.action.kind === "send" && msg.action.batch
          ? batchProgress.current.get(msg.action.batch.id)
          : undefined
      if (prog) prog.skipped++
      updateConfirmIn(sid, id, { status: "cancelled" })
      // The card is invisible to the LLM — without a chat message it would see
      // an unanswered transfer request and may claim it succeeded.
      pushTo(sid, t("transferCancelled"))
    },
    [messages, activeId, updateConfirmIn, pushTo],
  )

  // --- in-chat contact confirmation cards (LLM requests) ---
  const updateContactConfirmIn = useCallback(
    (sid: string, id: string, patch: Partial<Extract<ChatMessage, { role: "contact-confirm" }>>) => {
      mutateSession(sid, (m) =>
        m.map((msg) =>
          msg.id === id && msg.role === "contact-confirm" ? { ...msg, ...patch } : msg,
        ),
      )
    },
    [mutateSession],
  )

  const handleContactConfirm = useCallback(
    (id: string) => {
      const sid = activeId
      const pushAssistant = (t: string) => pushTo(sid, t)
      const updateContactConfirm = (
        mid: string,
        patch: Partial<Extract<ChatMessage, { role: "contact-confirm" }>>,
      ) => updateContactConfirmIn(sid, mid, patch)
      const msg = messages.find(
        (m): m is Extract<ChatMessage, { role: "contact-confirm" }> =>
          m.id === id && m.role === "contact-confirm",
      )
      if (!msg || msg.status !== "pending") return
      const a = msg.action

      if (a.op === "edit") {
        const res = updateContact(ownerKey, a.originalName, { name: a.newName, address: a.newAddress })
        if ("error" in res) {
          updateContactConfirm(id, { status: "cancelled" })
          pushAssistant(t(res.error, { name: a.originalName }))
          return
        }
        setContacts(loadContacts(ownerKey))
        updateContactConfirm(id, { status: "applied" })
        pushAssistant(
          t("contactUpdated", {
            name: res.name,
            addr: `${res.address.slice(0, 4)}…${res.address.slice(-4)}`,
          }),
        )
        return
      }

      removeContact(ownerKey, a.originalName)
      setContacts(loadContacts(ownerKey))
      updateContactConfirm(id, { status: "applied" })
      pushAssistant(t("contactRemoved", { name: a.originalName }))
    },
    [messages, activeId, updateContactConfirmIn, pushTo, ownerKey],
  )

  const handleContactCancel = useCallback(
    (id: string) => {
      updateContactConfirmIn(activeId, id, { status: "cancelled" })
    },
    [activeId, updateContactConfirmIn],
  )

  // --- Contacts-panel edit/remove confirmation dialog ---
  const [contactAction, setContactAction] = useState<PendingContactAction | null>(null)

  // --- "send to contact" dialog state ---
  const [sendFor, setSendFor] = useState<Contact | null>(null)

  const handleContactActionConfirm = useCallback(() => {
    if (!contactAction) return
    const a = contactAction
    if (a.op === "edit") {
      updateContact(ownerKey, a.originalName, {
        name: a.newName,
        address: a.newAddress,
        description: a.newDescription,
      })
    } else {
      removeContact(ownerKey, a.originalName)
    }
    setContacts(loadContacts(ownerKey))
    setContactAction(null)
  }, [contactAction, ownerKey])

  // --- layout ---
  return (
    <div className="bg-background text-foreground mx-auto flex h-dvh max-w-6xl flex-col lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
      <Sidebar
        sessions={sessions}
        activeId={activeSession?.id ?? ""}
        busySessionId={busySid}
        onSelectSession={selectSession}
        onNewSession={startNewSession}
        onDeleteSession={deleteSession}
        balances={balances}
        solPriceUsd={solPriceUsd}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
        <MainTabs tab={tab} onTabChange={setTab} onOpenSettings={() => setSettingsOpen(true)} />

        {/* mobile: balances under the tab bar (desktop shows them in the sidebar) */}
        <div className="px-3 pt-3 lg:hidden">
          <BalanceCards balances={balances} solPriceUsd={solPriceUsd} />
        </div>

        {tab === "chat" ? (
          <>
            <ChatWindow
              messages={messages}
              /* session-scoped: only the session that is actually processing
                 shows "thinking…" — never the one the user switched to */
              busy={busySid !== null && busySid === (activeSession?.id ?? "")}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              onContactConfirm={handleContactConfirm}
              onContactCancel={handleContactCancel}
            />
            {walletReady ? (
              <ChatInput onSend={handleSend} disabled={busy} />
            ) : (
              <div className="border-t bg-card px-4 py-5">
                <ConnectCard
                  title={ui("Connect your wallet to start", "先连接钱包再开始")}
                  body={ui(
                    "PlainWords reads balances and prepares transactions for you. Connect Phantom on Devnet — signing happens in the wallet, keys never leave it.",
                    "PlainWords 需要读取余额并为你准备交易。连接切到 Devnet 的 Phantom —— 签名在钱包里完成，私钥不会离开钱包。",
                  )}
                  connecting={connecting}
                  onConnect={() => openWalletModal(true)}
                />
              </div>
            )}
          </>
        ) : tab === "chats" ? (
          <div className="min-h-0 flex-1 p-4">
            <SessionList
              className="h-full"
              newButtonStyle="fab"
              sessions={sessions}
              activeId={activeSession?.id ?? ""}
              busyId={busySid}
              onSelect={selectSession}
              onNew={startNewSession}
              onDelete={deleteSession}
            />
          </div>
        ) : tab === "history" ? (
          <HistoryPanel
            records={history}
            loading={historyLoading}
            contacts={contacts}
            onRefresh={refreshHistory}
          />
        ) : tab === "contacts" ? (
          walletReady ? (
            <ContactsPanel
              contacts={contacts}
              onAdd={handleAddContact}
              onRequestEdit={(originalName, newName, newAddress, currentAddress, newDescription) =>
                setContactAction({
                  op: "edit",
                  originalName,
                  newName,
                  newAddress,
                  newDescription,
                  currentAddress,
                  currentDescription: contacts.find((c) => c.name === originalName)?.description,
                })
              }
              onRequestRemove={(name, address) =>
                setContactAction({ op: "remove", originalName: name, currentAddress: address })
              }
              onRequestSend={(c) => setSendFor(c)}
            />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <ConnectCard
                title={ui("Connect your wallet to manage contacts", "连接钱包后管理联系人")}
                body={ui(
                  "Contacts are stored per wallet, so PlainWords needs to know which wallet you're using. Connect Phantom on Devnet to add, edit or send.",
                  "联系人按钱包隔离存储，PlainWords 需要知道你在用哪个钱包。连接切到 Devnet 的 Phantom 后即可添加、编辑或转账。",
                )}
                connecting={connecting}
                onConnect={() => openWalletModal(true)}
              />
            </div>
          )
        ) : (
          <GuidePanel
            connected={walletReady}
            connecting={connecting}
            onConnect={() => openWalletModal(true)}
          />
        )}
      </main>

      <ContactActionDialog
        action={contactAction}
        onConfirm={handleContactActionConfirm}
        onCancel={() => setContactAction(null)}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChange={(_lang: Lang) => setUiLangTick((n) => n + 1)}
      />

      <SendContactDialog
        contact={sendFor}
        balances={balances}
        onClose={() => setSendFor(null)}
        onSubmit={(intent, displayText) => {
          setSendFor(null)
          setTab("chat")
          const sid = activeId
          // leave a user-message trace so the chat (and the LLM's context) stays coherent
          mutateSession(sid, (m) => [...m, { id: uid(), role: "user", text: displayText }], displayText)
          void runTransferIntent(sid, intent)
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    <WalletProviders>
      <AppInner />
    </WalletProviders>
  )
}
