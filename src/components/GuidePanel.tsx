import type { ReactNode } from "react"
import {
  ArrowLeftRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Database,
  Languages,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ui } from "@/lib/i18n"

interface Props {
  connected: boolean
  connecting: boolean
  onConnect: () => void
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number
  title: string
  done?: boolean
  children: ReactNode
}) {
  return (
    <li className="flex gap-3 rounded-lg border px-4 py-3">
      <span
        className={
          done
            ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        }
      >
        {done ? <CheckCircle2 className="size-4" /> : n}
      </span>
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-muted-foreground text-xs leading-relaxed">{children}</div>
      </div>
    </li>
  )
}

export function GuidePanel({ connected, connecting, onConnect }: Props) {
  // data lives INSIDE the component so ui() re-evaluates on language switch
  const PRINCIPLES = [
    {
      icon: Sparkles,
      title: ui("AI handles meaning, code handles math", "AI 管语义,代码管数字"),
      body: ui(
        'The model only decides what you want — "half", "everything", "20 USDC". Exact amounts are computed from your on-chain balance by deterministic code, never by the model.',
        "模型只理解你要什么——\u201c一半\u201d、\u201c全部\u201d、\u201c20 USDC\u201d。精确金额由确定性代码按链上余额计算,模型永远不碰数字。",
      ),
    },
    {
      icon: ShieldCheck,
      title: ui("The confirmation card is the only gate", "确认卡是唯一闸门"),
      body: ui(
        "Nothing reaches the chain until you press Confirm. Decline, and zero on-chain changes happen — guaranteed by design, not by promise.",
        "你不点确认,链上就不会有任何变更。拒绝即零改动——由架构保证,而非口头承诺。",
      ),
    },
    {
      icon: Database,
      title: ui("Dual-track risk checks", "风控双轨"),
      body: ui(
        'The model flags semantic red flags (drain-everything pressure, promised returns); deterministic code checks the numbers (share of balance, session totals, address book). Either track can raise the confirmation level.',
        "模型标记语义红旗(清空钱包、施压话术、收益承诺);代码核对数值(余额占比、会话累计、通讯录)。任一轨道都能提升确认级别。",
      ),
    },
  ]

  const EXAMPLES = [
    { say: "swap half my SOL into USDC", note: ui("vague amount → code computes exactly 50%", "模糊指令 → 代码精确算出 50%") },
    { say: "send 0.1 SOL to <address>", note: ui("plain transfer, simulated before you sign", "普通转账,签名前先模拟") },
    { say: "给 fat 转 20 USDC", note: ui("中文/English both work — replies mirror your language", "中英文皆可 — 回复跟随你的语言") },
    { say: "remember alice as <address>", note: ui('then just say "send 20 USDC to alice"', '之后只需说"给 alice 转 20 USDC"') },
    { say: "who did I send to this week?", note: ui("queries your saved transfer history", "查询已保存的转账记录") },
    { say: "sell all my USDT", note: ui("token you don't hold → gets corrected, not guessed", "没有的代币 → 纠正而非瞎猜") },
  ]

  const LEVELS = [
    {
      dot: "🟢",
      label: ui("Light", "轻量"),
      cls: "bg-emerald-500/10 text-emerald-500",
      body: ui("routine amounts — one tap to confirm.", "常规金额 — 一键确认。"),
    },
    {
      dot: "🟡",
      label: ui("Standard", "标准"),
      cls: "bg-amber-500/10 text-amber-500",
      body: ui(
        "over half a balance or an unknown address — read the card carefully.",
        "超过半数余额或陌生地址 — 请仔细阅读确认卡。",
      ),
    },
    {
      dot: "🔴",
      label: ui("Strong", "强确认"),
      cls: "bg-red-500/10 text-red-500",
      body: ui(
        "draining a wallet, pressure tactics — you must type CONFIRM to unlock the button.",
        "清空钱包、施压话术 — 必须输入 CONFIRM 才能解锁按钮。",
      ),
    },
  ]

  const FEATURES = [
    { icon: BookOpenText, title: ui("Chats", "多会话"), body: ui("Multiple conversations, kept per wallet account.", "多个对话,按钱包账户隔离保存。") },
    { icon: UsersRound, title: ui("Contacts", "联系人"), body: ui("Name → address book with notes; send in one tap.", "名字→地址簿,支持备注;一键发起转账。") },
    { icon: Clock3, title: ui("History", "历史记录"), body: ui("Live on-chain transfers with filters and search.", "链上实时转账记录,支持筛选与搜索。") },
    { icon: Languages, title: ui("Any language", "任意语言"), body: ui("Talk however you like — it answers in kind.", "怎么说都行 — 它用同样的语言回答。") },
  ]

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto min-w-0 max-w-2xl space-y-8 p-6 [overflow-wrap:anywhere]">
        {/* hero */}
        <section className="space-y-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-sm font-bold">
              P
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              {ui("How PlainWords works", "PlainWords 工作原理")}
            </h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {ui(
              "Say what you want in plain words. The AI understands it, deterministic code does the math, and nothing moves until you confirm — that's the whole product.",
              "用大白话说出你想做的事。AI 负责理解,确定性代码负责算数,你确认之前链上分文不动——这就是全部。",
            )}
          </p>
        </section>

        {/* quick start */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-wide uppercase">
              {ui("Quick start", "快速开始")}
            </h3>
            <span className="text-muted-foreground text-[11px]">{ui("about 3 minutes", "约 3 分钟")}</span>
          </div>
          <ol className="space-y-2">
            <Step n={1} title={ui("Install Phantom and switch to Devnet", "安装 Phantom 并切到 Devnet")}>
              {ui(
                "Phantom → Settings → Developer Settings → Testnet Mode, then reload this page.",
                "Phantom → 设置 → 开发者设置 → 测试网模式，然后刷新本页。",
              )}{" "}
              <a href="https://phantom.app" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {ui("Get Phantom", "安装 Phantom")}
              </a>
            </Step>
            <Step n={2} title={ui("Fund the wallet with test tokens", "给钱包领测试币")}>
              {ui("SOL from", "SOL 来自")}{" "}
              <a href="https://faucets.solana.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                faucets.solana.com
              </a>
              {ui(", USDC from", "，USDC 来自")}{" "}
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                faucet.circle.com
              </a>{" "}
              {ui("(choose Solana Devnet).", "（选择 Solana Devnet）。")}
            </Step>
            <Step n={3} title={ui("Connect your wallet", "连接钱包")} done={connected}>
              {connected ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3.5" />
                  {ui("Connected — chat and contacts are unlocked.", "已连接 —— 聊天和联系人已解锁。")}
                </span>
              ) : (
                <>
                  {ui("Chat stays locked until a wallet is connected.", "未连接钱包前，聊天和联系人处于锁定状态。")}{" "}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={onConnect}
                    disabled={connecting}
                  >
                    {connecting ? ui("Connecting…", "连接中…") : ui("Connect wallet", "连接钱包")}
                  </Button>
                </>
              )}
            </Step>
            <Step n={4} title={ui("Ask for something in plain words", "用大白话提一个请求")}>
              {ui(
                'Start with a read-only question like "how much do I have?", then try a transfer or a swap from the examples below.',
                "先问一个只读问题，比如“我现在有多少钱？”，再试下面的转账或兑换示例。",
              )}
            </Step>
            <Step n={5} title={ui("Confirm on the card, sign in Phantom", "在确认卡上确认，在 Phantom 里签名")}>
              {ui(
                "Nothing moves until you confirm. Red-level actions ask you to type CONFIRM first.",
                "你确认之前链上不会有任何变化。高风险操作需要先输入 CONFIRM。",
              )}
            </Step>
          </ol>
        </section>

        {/* examples as chat bubbles */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide uppercase">
            {ui("Try saying", "试着说")}
          </h3>
          <div className="space-y-2">
            {EXAMPLES.map((e) => (
              <div key={e.say} className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground max-w-[55%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm">
                  {e.say}
                </div>
                <div className="text-muted-foreground min-w-0 flex-1 truncate text-xs">{e.note}</div>
              </div>
            ))}
          </div>
        </section>

        {/* principles */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide uppercase">
            {ui("Why it is safe", "为什么安全")}
          </h3>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Card key={p.title} className="gap-3 py-0">
                <CardContent className="space-y-2 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p.icon className="text-primary size-5" />
                    <span className="text-muted-foreground/50 text-xs font-semibold">0{i + 1}</span>
                  </div>
                  <div className="text-sm leading-snug font-semibold">{p.title}</div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{p.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* confirm levels */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide uppercase">
            {ui("Confirmation levels", "确认级别")}
          </h3>
          <div className="space-y-2">
            {LEVELS.map((l) => (
              <div key={l.label} className="flex items-start gap-3 rounded-lg border px-4 py-2.5">
                <Badge variant="secondary" className={`${l.cls} mt-0.5 border-0 px-2 font-medium`}>
                  {l.dot} {l.label}
                </Badge>
                <p className="text-muted-foreground pt-0.5 text-xs leading-relaxed">{l.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* features */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide uppercase">
            {ui("Also in the box", "更多能力")}
          </h3>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-lg border px-4 py-3">
                <f.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <div className="text-sm font-medium">{f.title}</div>
                  <div className="text-muted-foreground text-xs">{f.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* devnet note */}
        <section className="border-sky-500/30 bg-sky-500/5 flex min-w-0 items-start gap-3 overflow-hidden rounded-lg border px-4 py-3">
          <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-sky-500" />
          <div className="min-w-0 text-xs leading-relaxed break-words text-sky-600 dark:text-sky-400">
            <span className="font-medium">{ui("Devnet demo.", "Devnet 演示。")}</span>{" "}
            {ui(
              "Everything runs on Solana devnet with test tokens (SOL from",
              "所有操作运行在 Solana devnet 测试网(SOL 来自",
            )}{" "}
            <a href="https://faucets.solana.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
              faucets.solana.com
            </a>
            {ui(", USDC from", ",USDC 来自")}
            <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">
              faucet.circle.com
            </a>
            {ui(
              "). Jupiter retired devnet routing in 2026, so swaps quote at live mainnet rates — on mainnet the same flow executes end-to-end.",
              ")。Jupiter 于 2026 年退役 devnet 路由,兑换报价采用主网实时价 — 主网环境下同样的流程可端到端执行。",
            )}{" "}
            <CheckCircle2 className="mr-0.5 inline size-3" />
            {ui("Transfers, contacts and history are fully live.", "转账、联系人与历史记录全部真实上链。")}
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}
