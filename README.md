# PlainWords

> The wallet that speaks your language. Say **"swap half my SOL into USDC"** — PlainWords understands the intent, computes the exact amount, checks the risks, simulates the transaction, and asks for one-tap confirmation.

Built for the [Solana Hackathon x MLH](https://events.mlh.com/events/15200-solana-hackathon) — AI Track.

## Why it must be Solana

- **Sub-cent fees** — conversational micro-payments (0.01 USDC) only make economic sense at ~$0.0001 per transaction.
- **~400ms confirmations** — a chat-driven flow needs the "sent" moment to feel instant.

## Architecture — three rules the demo lives by

1. **AI handles meaning, code handles math.** The LLM only outputs semantics like `mode: "half"`. Every amount is computed deterministically from the on-chain balance.
2. **The confirmation card is the only gate.** Nothing reaches the chain until the user confirms. Declined ⇒ zero on-chain changes.
3. **Dual-track risk control.** The LLM flags semantic red flags (`risk_flags`: drain-everything, pressure tactics, promises of returns); deterministic code checks the numbers (share of balance, session totals, blocklists). Either track escalates the confirmation level: 🟢 light → 🟡 standard → 🔴 type-CONFIRM.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui |
| LLM | GLM (Zhipu) via `openai` npm package, OpenAI-compatible endpoint, function calling |
| Chain | `@solana/web3.js` + wallet-adapter + Phantom (devnet) |
| Swap | Jupiter Aggregator REST API (devnet) |
| Prices | CoinGecko simple price |

## Run locally

### 1. Wallet (Phantom)

PlainWords talks to your wallet through [Phantom](https://phantom.app) — install the browser
extension, then switch it to **Devnet** (Settings → Developer Settings → Testnet Mode).

Fund your devnet wallet with test tokens:

- SOL: [faucets.solana.com](https://faucets.solana.com)
- USDC: [faucet.circle.com](https://faucet.circle.com) (select *Solana Devnet*)

When you open the app, click **Select Wallet** — Phantom appears automatically (marked
"Detected"); after the first approval it reconnects on its own.

> Any Wallet-Standard wallet works (Solflare, Backpack…), but the demo assumes Phantom.

### 2. App

```bash
npm install
cp .env.example .env   # then fill in VITE_LLM_KEY from https://open.bigmodel.cn
npm run dev
```

`.env` supports **any OpenAI-compatible endpoint** (`VITE_LLM_BASE_URL` / `VITE_LLM_MODEL`) —
GLM is just the default. The key stays in your `.env`, which is gitignored and never committed.

Supported assets: **SOL** and **USDC** on devnet.

## Project layout

```
src/
├── components/   # Sidebar, ChatWindow, ChatInput, ConfirmCard, GuidePanel, BalanceCards
├── lib/
│   ├── ai.ts         # GLM client, tools schema, intent parsing + summarizing
│   ├── pipeline.ts   # deterministic amount resolution, execution
│   ├── risk.ts       # dual-track risk assessment → confirm level
│   ├── solana.ts     # connection, balances, tx building, simulation
│   ├── jupiter.ts    # quote + swap REST wrappers
│   └── price.ts      # SOL/USD spot for display
└── prompts/system.md # assistant rules + few-shot examples
```
