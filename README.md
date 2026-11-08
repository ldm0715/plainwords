# PlainWords

[中文说明](README.zh.md)

Operate a Solana wallet in plain language — say what you want, confirm once, sign in Phantom.

| | |
|---|---|
| **Live demo** | https://plainwords-chi.vercel.app (Phantom on **Devnet**) |
| **Demo video** | [▶ Watch the 2-minute walkthrough](https://drive.google.com/file/d/1SNOw3q6e4dBKiPbAs4GwHQ5XXUlC0wp4/view?usp=sharing) |
| **Event** | [Solana Hackathon x MLH](https://events.mlh.com/events/15200-solana-hackathon) — AI Track / DeFi Track |
| **Network** | Solana Devnet · SOL and USDC |

## What it does

| You say | PlainWords does |
|---|---|
| "send 20 USDC to alice" | resolves the contact, scores risk, simulates the transfer, asks for one confirmation, signs in Phantom |
| "send 0.01 SOL and 0.01 USDC to `<address>`" | prepares both transfers in one turn, each with its own confirm card |
| "swap half my SOL" | shows a live mainnet quote with full risk and confirmation UI — quote-only on devnet |
| "how much did I send alice this week?" | answers from parsed on-chain history, with totals computed in code |
| "remember alice as `<address>`" | saves the contact locally, isolated per connected wallet |

## How it works

```
your words
  → LLM intent (no arithmetic, no signing)
    → deterministic amount resolution
      → risk score + transaction simulation
        → confirmation card (only gate to the chain)
          → Phantom signature → Solana devnet
```

| Layer | Responsibility |
|---|---|
| **LLM (GLM)** | intent and amount expression (`half`, `all`, `20`, or an exact number), plus semantic risk flags — never math, never signing |
| **Deterministic code** | resolves amounts against the on-chain balance, numeric risk checks, transaction simulation and building |
| **User** | confirms on the card (red-level actions require typing `CONFIRM`) and signs in the wallet |

Sub-cent fees and ~1s settlement are what make conversational micro-payments viable at all — that is the Solana part of the product.

## Tech stack

| Layer | Choice |
|---|---|
| **UI** | Vite · React · TypeScript · Tailwind v4 · shadcn/ui |
| **AI** | GLM (Zhipu) via the OpenAI-compatible function-calling API |
| **Solana** | `@solana/web3.js` · wallet-adapter · Phantom |
| **Quotes** | Jupiter Swap API — live mainnet quotes |
| **Deploy** | Vercel · Edge Function injects the server-side LLM key |

## AI tools used to build it

The app itself runs on GLM. These tools were used during development:

| Tool | Model | Role |
|---|---|---|
| **zcode** | GLM-5.3 | Initial implementation — wallet layer, intent pipeline, UI |
| **Claude Code** | DeepSeek-v4.1-flash | Deployment debugging, LLM proxy, README and cleanup |


## Run locally

```bash
npm install
cp .env.example .env   # then add an LLM key (any OpenAI-compatible endpoint; GLM by default)
npm run dev            # open http://localhost:5173
```

| Need | Where |
|---|---|
| Phantom set to **Devnet** | https://phantom.app |
| Devnet SOL | https://faucet.solana.com |
| Devnet USDC | https://faucet.circle.com (select *Solana Devnet*) |

## Limits

- Devnet only, SOL/USDC only. Swap is quote-only because Jupiter no longer serves devnet liquidity.
- Contacts, chat sessions, and history cache live in `localStorage`, keyed by wallet address. Private keys never enter the app.
- The LLM key is injected by a Vercel Edge Function in production and by the Vite proxy locally; users can also bring their own key in Settings.

## Docs

- [Product and architecture notes](docs/plainwords-plan.md)
- [Deployment notes](docs/deploy-plan.md)

## License

MIT — see [LICENSE](LICENSE).
