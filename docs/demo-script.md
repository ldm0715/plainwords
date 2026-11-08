# PlainWords — demo video execution script

Target: 2:00–2:20, 1080p, English voiceover. All transfers happen on devnet; swaps are quote-only.

## 1. What the video shows

| # | Beat | Capability |
|---|---|---|
| 1 | Price + swap-all quote | Live SOL price, swap intent, mainnet quote, red risk gate |
| 2 | Unknown address → yellow card | Risk reason, cancel = zero changes |
| 3 | Save contact, retry, send | Contact resolution, green card, real signature |
| 4 | "How many transfers to mon?" | History query by counterparty |
| 5 | "This week's spend + largest" | Totals and largest transfer computed by code |

## 2. Pre-flight and data seeding (20 minutes)

Wallet and data:

- [ ] Phantom unlocked, network = **Devnet**
- [ ] Demo wallet has **≥ 2 SOL** (faucet.solana.com, request early)
- [ ] Second Phantom account created → its address = **alice** (NOT in Contacts yet)
- [ ] Generate a second address = **mon**:
      `node -e "const {Keypair}=require('@solana/web3.js');console.log(Keypair.generate().publicKey.toBase58())"`
- [ ] Add **mon** to Contacts (name `mon`, the generated address) — needed for name resolution
- [ ] From Phantom, send **3 transfers to mon**: `0.05`, `0.1`, `0.2 SOL` (real devnet txs)
- [ ] Open the app, connect, History → Refresh → confirm the 3 transfers appear
- [ ] Leave **alice** out of Contacts — beat 2 depends on it

Recording setup:

- [ ] Production site: `https://plainwords-chi.vercel.app`
- [ ] Settings → model list loads (server key works)
- [ ] Start a **New chat**
- [ ] Browser 1920×1080, zoom 100%, bookmarks bar hidden, DevTools closed
- [ ] OBS recording the browser window only, 1080p / 60fps, MP4

Balance math after seeding: ~2.0 − 0.35 ≈ **1.65 SOL**. All on-camera sends below are ≤ 3% of balance.

## 3. Shot-by-shot

### 0:00–0:10 — Hook (title card, no UI)

**Voiceover:**
> Sending crypto still feels like filling out a form. PlainWords is a Solana wallet you just talk to.

### 0:10–0:20 — Connect

**Do:** open the site → click **Connect wallet** → approve Phantom.

**Expected:** balance cards populate; chat composer appears.

**Voiceover:**
> Connect Phantom. Keys stay in the wallet — PlainWords only reads balances and prepares transactions.

### 0:20–0:45 — Price and swap-all

**Type:** `What's SOL worth right now?`

**Expected:** `1.00 SOL ≈ 89.xx USDC (live Jupiter quote).`

**Type:** `Swap all my SOL into USDC.`

**Expected card:** `Swap 1.64 SOL → USDC` · estimated USDC out · price impact · fee · blue devnet note · **🔴 Strong check** with reasons (`over 90% of your SOL balance`, `moves your entire balance`).

**Do:** type `CONFIRM` in the card input → click **Got it — close this quote**.

**Expected:** `Closed — quote only...`

**Voiceover:**
> The price comes from a live Jupiter quote. Swaps are quoted at mainnet rates, because devnet has no aggregator liquidity left — and PlainWords says so on the card. Because this one moves my whole balance, it escalates to a strong check. The button stays locked until I type CONFIRM, and closing it changes nothing.

### 0:45–1:20 — Unknown address → yellow card → save → send

**Type:** `Send 0.05 SOL to <alice full address>`

**Expected card:** 🟡 Standard check · reason `This address is not in your contacts` · simulated OK.

**Do:** click **Cancel**.

**Expected:** `Cancelled — no transfer was made.`

**Type:** `Remember alice as <alice full address>`

**Expected:** `Saved — "alice" is now <address>. Next time just say "send 20 USDC to alice".`

**Type:** `Send 0.05 SOL to alice`

**Expected card:** 🟢 Light check · To `alice · <address>` · simulated OK.

**Do:** **Confirm** → Phantom → **Approve**.

**Expected:** `Done — sent 0.05 SOL to alice (order 62tVeG3q…).`

**Voiceover:**
> Here's an address I haven't used before. The card turns yellow and tells me why: it's not in my contacts. I cancel — nothing moves on-chain. I save it as alice, ask again, and now it's a green check, because the name resolves and the amount is small. One confirmation, one signature — a real devnet transaction.

### 1:20–1:35 — Transfers to mon

**Type:** `How many transfers have I sent to mon?`

**Expected:** answer quoting `summary.matched` (3 transfers) and the total sent to mon.

**Voiceover:**
> History is parsed from the chain, and the count and totals come from deterministic code — the model just reads them out.

### 1:35–1:55 — Weekly spend and largest transfer

**Type:** `How much did I spend this week, and what was my largest transfer?`

**Expected:** 4 outgoing transfers, total ≈ 0.4 SOL, largest `0.2 SOL to mon`, with USD estimates.

**Voiceover:**
> Same for the week: the app sums the spending and identifies the largest transfer itself. No hallucinated arithmetic.

### 1:55–2:10 — Proof + close

**Do:** open **History** → show the alice row → click the signature link (Solscan devnet).

**Voiceover:**
> Every send is a real transaction you can verify.

**Closing card:**
> AI handles meaning. Code handles math. The confirmation card is the only gate.

### 2:10–2:15 — End card

Repo URL · live URL · “Built for Solana Hackathon x MLH”.

## 4. Voiceover block (for TTS)

> Sending crypto still feels like filling out a form. PlainWords is a Solana wallet you just talk to.
>
> Connect Phantom. Keys stay in the wallet — PlainWords only reads balances and prepares transactions.
>
> The price comes from a live Jupiter quote. Swaps are quoted at mainnet rates, because devnet has no aggregator liquidity left — and PlainWords says so on the card. Because this one moves my whole balance, it escalates to a strong check. The button stays locked until I type CONFIRM, and closing it changes nothing.
>
> Here's an address I haven't used before. The card turns yellow and tells me why: it's not in my contacts. I cancel — nothing moves on-chain. I save it as alice, ask again, and now it's a green check, because the name resolves and the amount is small. One confirmation, one signature — a real devnet transaction.
>
> History is parsed from the chain, and the count and totals come from deterministic code — the model just reads them out.
>
> Same for the week: the app sums the spending and identifies the largest transfer itself. No hallucinated arithmetic.
>
> Every send is a real transaction you can verify.
>
> AI handles meaning. Code handles math. The confirmation card is the only gate.

## 5. Expected values (fill in before recording)

| Item | Expected |
|---|---|
| SOL balance after seeding | `1.6–1.7 SOL` |
| Price answer | `1.00 SOL ≈ 89 USDC` |
| Swap-all card | `~1.64 SOL → ~146 USDC`, 🔴 Strong check |
| Transfers to mon | `3`, total `0.35 SOL` |
| Week spend | `4 transfers`, total `0.40 SOL`, largest `0.2 SOL to mon` |

Exact USD values move with the market — don't script them into the voiceover; let the screen carry the numbers.

## 6. Failure recovery

| Problem | Do |
|---|---|
| LLM timeout / "something went wrong" | Wait, resend the same message; if it persists, New chat |
| Yellow card doesn't appear | the address is already in Contacts — use a fresh address |
| Phantom popup missing | wallet button → disconnect → reconnect |
| Simulation failed | cancel, check SOL, retry |
| History missing the seeded txs | History → Refresh; wait 3–5s |
| Jupiter quote fails | skip the swap beat; the rest still works |
| "mon" isn't resolved | check the contact name is exactly `mon` |

## 7. Post-production

- CapCut auto-captions; verify `PlainWords`, `USDC`, `devnet`, `CONFIRM`, `mon`, `alice`.
- Cut typing pauses and wallet-popup delay; keep one signature popup for the "real" beat.
- Quiet music, no lyrics, under the voice.
- Export H.264 1080p, 8–12 Mbps.
- Upload to **YouTube unlisted** → use that link as the MLH demo URL.
