# PlainWords

用大白话操作 Solana 钱包 —— 说出想做什么，确认一次，在 Phantom 里签名。

| | |
|---|---|
| **在线演示** | https://plainwords-chi.vercel.app（Phantom 切到 **Devnet**） |
| **赛事** | [Solana Hackathon x MLH](https://events.mlh.com/events/15200-solana-hackathon) —— AI Track / DeFi Track |
| **网络** | Solana Devnet · SOL 与 USDC |

## 能做什么

| 你说 | PlainWords 做什么 |
|---|---|
| "给 alice 转 20 USDC" | 解析联系人 → 风险评级 → 模拟交易 → 出一张确认卡 → Phantom 签名上链 |
| "给 `<地址>` 转 0.01 SOL 和 0.01 USDC" | 一轮里准备两笔转账，各自一张确认卡 |
| "把一半 SOL 换成 USDC" | 展示主网实时报价，配完整风控和确认交互 —— devnet 上只报价、不结算 |
| "我这周给 alice 转了多少钱？" | 从解析好的链上历史里直接回答，汇总数字由代码算出 |
| "记住 alice 的地址是 `<地址>`" | 保存联系人，只存本地，按连接的钱包隔离 |

## 工作流程

```
你说的一句话
  → LLM 识别意图（不做算术，不签名）
    → 确定性代码解析金额
      → 风险评级 + 交易模拟
        → 确认卡（唯一的上链入口）
          → Phantom 签名 → Solana devnet
```

| 层 | 职责 |
|---|---|
| **LLM（GLM）** | 识别意图和金额形式（`half`、`all`、`20` 或明确数字），输出语义风险标记 —— 不做算术，不签名 |
| **确定性代码** | 按链上余额解析金额、做数值风控、模拟并构建交易 |
| **用户** | 在确认卡上确认（高风险操作需手动输入 `CONFIRM`），并在钱包里签名 |

亚分手续费和约 1 秒确认，是"对话式小额支付"在成本上成立的前提 —— 这也是这个产品必须用 Solana 的原因。

## 技术栈

| 层 | 选型 |
|---|---|
| **前端** | Vite · React · TypeScript · Tailwind v4 · shadcn/ui |
| **AI** | GLM（智谱），OpenAI 兼容的 function calling |
| **Solana** | `@solana/web3.js` · wallet-adapter · Phantom |
| **报价** | Jupiter Swap API —— 主网实时报价 |
| **部署** | Vercel · Edge Function 注入服务端 LLM key |

## 开发时使用的 AI 工具

应用本身跑在 GLM 上；开发过程中使用了这些工具：

| 工具 | 模型 | 用途 |
|---|---|---|
| **zcode** | GLM-5.3 | 初版实现 —— 钱包层、意图管线、UI |
| **Claude Code** | DeepSeek-v4.1-flash | 部署排错、LLM 代理、README 与收尾 |


## 本地运行

```bash
npm install
cp .env.example .env   # 然后填入 LLM key（任意 OpenAI 兼容端点，默认 GLM）
npm run dev            # 打开 http://localhost:5173
```

| 需要 | 地址 |
|---|---|
| Phantom 切到 **Devnet** | https://phantom.app |
| Devnet SOL | https://faucet.solana.com |
| Devnet USDC | https://faucet.circle.com（选择 *Solana Devnet*） |

## 限制

- 仅 devnet，仅 SOL / USDC。兑换只报价，因为 Jupiter 不再提供 devnet 流动性。
- 联系人、聊天会话、历史缓存存放在 `localStorage`，按钱包地址隔离；私钥从不进入应用。
- 生产环境的 LLM key 由 Vercel Edge Function 注入，本地开发走 Vite 代理；用户也可以在设置里填自己的 key。

## 文档

- [产品与架构说明](docs/plainwords-plan.md)
- [部署说明](docs/deploy-plan.md)

## 许可证

MIT —— 见 [LICENSE](LICENSE)。
