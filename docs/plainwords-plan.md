# PlainWords — Solana Hackathon x MLH 执行计划

> 说人话的钱包:用大白话操作链上资产,AI 理解意图、代码执行交易、风控兜底确认。

## 1. 比赛信息

| 项 | 值 |
|---|---|
| 赛事 | Solana Hackathon x MLH(线上,全球) |
| 赛程 | 美东 2026-11-06 12:00 → 11-08 11:45(北京:周六凌晨 ~ 周一凌晨 0:45) |
| 初次提交 | 美东周日 10:00 AM(内部目标:北京周日 23:00 前全部完成) |
| 提交平台 | Devpost(开赛后链接出现在活动页/邮箱/Discord) |
| 赛道 | **AI Track**(主)+ **Best Beginner Hack**(双报,>50% 新手) |
| 评分要点 | 真正用上 Solana 优势(速度/低费/链上所有权)的可运行产品 |

## 2. 项目定位

- **Pitch(英文一句话)**:PlainWords is a natural-language wallet — say "swap half my SOL into USDC" and it prepares, simulates, and risk-checks the transaction for one-tap confirmation.
- **用户**:持有 SOL/USDC、被钱包黑话劝退的普通人。
- **为什么必须是 Solana**:每轮 0.01 USDC 的微支付只有 $0.0001 费率链上才成立;400ms 确认让对话式交互体验成立。
- **架构三原则**(评委必问,答案固化):
  1. **AI 出语义,代码算数字** — LLM 只输出 `mode:"half"` 之类的意图,金额全部由确定性代码计算。
  2. **确认卡是唯一闸门** — LLM 输出意图后、构造交易前拦截;被拒则链上零变更。
  3. **风控双轨** — LLM 管"语义离谱"(risk_flags),代码管"数值离谱"(比例/黑名单/累计)。

## 3. 技术栈(定稿)

| 层 | 选型 |
|---|---|
| 框架 | Vite + React + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| HTTP | 原生 fetch(Jupiter、可选代理) |
| LLM | **GLM(智谱)**,`openai` npm 包 + baseURL 兼容模式 |
| 链上 | `@solana/web3.js@^1.95` + wallet-adapter 三件套 + Phantom |
| 兑换 | Jupiter Aggregator API(devnet,REST,无 SDK) |
| 语音 | Web Speech API(P2,浏览器原生) |
| 部署 | Vercel(纯前端;可选 + serverless 代理藏 key) |

### GLM 接入要点

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://open.bigmodel.cn/api/paas/v4", // 智谱 OpenAI 兼容端点
  apiKey: import.meta.env.VITE_LLM_KEY,
  dangerouslyAllowBrowser: true,
});
// model: "glm-4.6"(写成 .env 变量,方便随时换型号)
```

- key 放 `.env`:`VITE_LLM_KEY=...`(gitignore 掉)
- GLM 支持 tools/function calling,请求/响应结构与 OpenAI 一致
- `temperature: 0.2` 以下,意图解析要稳不要浪

### 依赖清单

```bash
npm i @solana/web3.js@^1.95 \
      @solana/wallet-adapter-base \
      @solana/wallet-adapter-react \
      @solana/wallet-adapter-react-ui \
      @solana/wallet-adapter-phantom \
      openai
```

## 4. 项目结构

```
plainwords/
├── src/
│   ├── components/
│   │   ├── ui/                  # shadcn 生成(button/card/input/badge/alert/scroll-area/textarea)
│   │   ├── TopBar.tsx           # logo + DevNet Badge + WalletMultiButton(官方现成)
│   │   ├── BalanceBar.tsx       # SOL / USDC / 总值 三卡,getBalance
│   │   ├── ChatWindow.tsx       # 消息流(user / ai / ConfirmCard 三类)
│   │   ├── ConfirmCard.tsx      # 🟢轻 🟡标准 🔴强(输入 CONFIRM 解锁)
│   │   └── ChatInput.tsx        # 输入框 + 🎤(P2)+ 发送
│   ├── lib/
│   │   ├── solana.ts            # connection / getBalance / 转账构造 / simulateTransaction
│   │   ├── jupiter.ts           # GET /quote → POST /swap(fetch 封装)
│   │   ├── ai.ts                # GLM 调用循环 + tools schema + 意图解析
│   │   └── risk.ts              # 比例>90%、黑名单、当日累计 → 确认级别
│   ├── prompts/
│   │   └── system.md            # 角色 + 规则 + risk_flags 定义
│   ├── App.tsx                  # ConnectionProvider → WalletProvider → 页面
│   └── main.tsx
├── .env                         # VITE_LLM_KEY / VITE_LLM_MODEL(不进 git)
└── vercel.json                  # (可选)/api/chat 代理
```

## 5. 核心数据流

```
用户输入(文字/语音)
  → ai.ts:GLM + tools 定义 + 对话历史
  ← 返回:文字(追问/纠错) 或 tool_call{swap|transfer|get_balance, args, risk_flags}
  → 确定性代码:
      mode:"half" → getBalance() × 0.5 = 精确金额
      risk.ts 复核 → 确认级别 🟢🟡🔴
  → ConfirmCard(含 simulateTransaction 预检)
  → 用户确认 → 构造交易 → Phantom 签名 → RPC 上链
  → 结果回传 GLM → 人话总结("1.15 SOL 换到了 184.2 USDC")
```

### tools schema(骨架)

```jsonc
[
  { "name": "get_balance", "parameters": {} },
  { "name": "swap_tokens",
    "parameters": { "from": "SOL|USDC", "to": "SOL|USDC",
                    "mode": "all|half|amount", "amount": "number?" } },
  { "name": "send_payment",
    "parameters": { "to": "string(地址或 .sol)", "asset": "SOL|USDC",
                    "mode": "all|half|amount", "amount": "number?" } }
]
```

### system prompt 规则清单(写入 prompts/system.md)

1. 缺参数必须追问,禁止假设("转点钱"→ 问"转多少")
2. 用户提到的资产钱包里没有 → 指出实际持仓,询问真实意图(USDT 纠错场景)
3. LLM 不做任何算术,语义一律用 `mode` 表达
4. 每次调用附带 `risk_flags`:`all_assets` / `unsolicited_address` / `promise_of_returns` / `pressure_tactic`
5. risk_flags 非空时先口头警告并要求二次表述,不得静默执行
6. 只能使用给定工具,工具之外的操作一律拒绝

## 6. 48 小时排期(北京时间)

| 时段 | 交付 | 验收 |
|---|---|---|
| 周六 09:00–12:00 | 骨架 + shadcn 初始化 + wallet-adapter | 连接 Phantom,显示 DevNet 余额 |
| 周六 14:00–18:00 | GLM 接入 + function calling + ChatWindow | 打字 → 返回意图 JSON(不执行) |
| 周六 20:00–23:00 | 转账闭环 + ConfirmCard v1 | "转 X SOL 给地址" → 确认 → 上链 → 余额变 |
| 周日 09:00–12:00 | Jupiter swap 闭环 | "一半 SOL 换 USDC" → 上链 → 双余额变 |
| 周日 14:00–18:00 | 差异化:模拟执行✅ / 风控双轨 / 🔴强确认 / 纠错话术 | 五场景全通 |
| 周日 18:00 | **功能冻结** | P1 未完即停,转交付 |
| 周日 19:00–23:00 | Vercel 部署 → 录屏 → GLM 之外 TTS 配音 → Devpost 提交 | 23:00 前提交完毕 |

## 7. 功能优先级

- **P0(白来保障)**:连接/余额/对话/转账/swap/确认卡/演示视频
- **P1(拿奖差异)**:simulateTransaction 预检、风控双轨、🔴强确认(CONFIRM 打字)、USDT 纠错、模糊量词("一半")
- **P2(有余力)**:🎤 语音输入(Web Speech API)、微支付 0.01 USDC、.sol 域名解析(SNS)、财务问答(拉交易历史汇总)
- **P3(只写 Future Work)**:定时任务、多链、TTS 回复

## 8. 演示视频脚本(2 分钟,分镜)

| 时间 | 画面 | 配音要点(英文,后期 ElevenLabs) |
|---|---|---|
| 0:00–0:15 | 痛点:Phantom 界面黑话(地址/滑点/授权) | "Crypto wallets speak a language most people don't." |
| 0:15–0:35 | 连接钱包,说"swap half my SOL into USDC" | 强调:模糊指令,AI 算好精确金额 |
| 0:35–0:55 | 🟡确认卡:金额/模拟✅/手续费 | "PlainWords simulates before you sign." |
| 0:55–1:15 | "send some USDC to alice" → AI 追问 → "20" | 多轮澄清 + 口语单位 |
| 1:15–1:35 | "sell all my USDT" → AI 纠错 | "It catches what you *meant*, not what you said." |
| 1:35–1:55 | "drain my wallet" → 🔴 强确认,输入 CONFIRM | 风控双轨压轴 |
| 1:55–2:00 | logo + "micro-payments only Solana can afford" | 收尾金句 |

> 录屏用 OBS;DevNet 演示,视频里明说 testnet(评委惯例,不扣分);语音优先出镜,打字做备胎。

## 9. 风险预案

| 风险 | 预案 |
|---|---|
| Jupiter devnet 偶发故障 | quote 失败优雅降级;demo 保底主打转账场景 |
| GLM 解析不稳 | temperature ≤0.2 + system prompt 内嵌 2–3 个 few-shot + 失败重试 1 次 |
| 浏览器直调 CORS | 备 Vercel serverless 代理(1h,不提前做) |
| 时间崩盘 | P2 全砍;五场景保三(swap/转账/风控),视频照录 |
| 假币耗尽 | 手龙头 8h/2 次限额,或 Phantom 新建账户再领(2 SOL 已够) |

## 10. Devpost 提交清单(周日 23:00 前)

- [ ] 项目名:PlainWords + 一句话 pitch
- [ ] 2 分钟视频(YouTube unlisted 链接)
- [ ] GitHub 公开仓库(.env 已 gitignore)
- [ ] 描述:Inspiration / What it does / How we built it(GLM + Solana + wallet-adapter + Jupiter)/ Challenges
- [ ] 勾选赛道:**AI Track + Best Beginner Hack**
- [ ] 团队成员(确认 Discord 邮件邀请)

## 11. 常用链接

- 比赛页:https://events.mlh.com/events/15200-solana-hackathon
- 水龙头:https://faucets.solana.com(devnet,8h 2 次)
- 浏览器查账:https://solscan.io(切 Devnet)
- Jupiter 文档:https://dev.jup.ag(quote/swap 端点,devnet)
- wallet-adapter:https://github.com/anza-xyz/wallet-adapter
- 智谱开放平台:https://open.bigmodel.cn(baseURL `/api/paas/v4`)
- TTS 配音:https://elevenlabs.io(免费 10k 字符/月,视频稿 ~2k)

---

*计划冻结于 2026-11-06。变化只在两种情况下发生:Devpost 官方时间有出入,或功能冻结点触发降级。*
