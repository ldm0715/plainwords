# PlainWords — 部署计划(GitHub → Vercel,方案 D)

> 目标:公开仓库不含任何密钥;线上 LLM 请求经 Vercel Edge Function 注入服务端 key;
> 本地开发沿用现有 `.env` + vite 代理;演示与赛后作废都简单。

## 1. 现状与结论

- **钱包零配置**:私钥只在 Phantom 扩展,代码经手的是公开地址 + 运行时签名回调,仓库无任何钱包密钥可泄
- **仓库唯一敏感项**:LLM key(`.env` 已 gitignore,确认不会上传)
- **实测结论**:
  - 智谱端点不返回 CORS 授权头 → 线上浏览器直连必挂 → 必须服务端代理
  - Jupiter 托管 API 只剩主网 → 走 `/jup` 服务端 rewrite(公开端点,无需保密)
  - Vercel rewrites 会缓冲流式响应 → LLM 走 Edge Function 透传(官方文档明确该坑)
  - web3.js `getTransaction` 需默认 json 编码;devnet 公共 RPC 已下线 `getParsedTransaction`
  - CoinGecko 免费 429 → 价格源已改为 Jupiter 主网报价反推(同 `/jup` 通道)

## 2. 代码改造清单(第 1 步,由 Claude 执行)

| 文件 | 改动 |
|---|---|
| `api/llm.ts`(新建) | Edge Function:`/api/llm/*` → `open.bigmodel.cn/api/coding/paas/v4/*`,注入 `Authorization: Bearer ${ZHIPU_API_KEY}`,剥除客户端鉴权头,流式透传 |
| `src/lib/ai.ts` | baseURL 分支:`import.meta.env.PROD` → `${origin}/api/llm`(客户端不带 key);dev → `/llm` + 本地 key(现状不变) |
| `vercel.json` | 删 `/llm` rewrite(被函数取代);保留 `/jup` rewrite |
| `.env.example` | 注明:`VITE_LLM_KEY` 仅本地开发需要;线上由 Vercel 环境变量 `ZHIPU_API_KEY` 提供 |
| `README.md` | 已含 Phantom 安装/Devnet/领水/运行步骤,补充部署一段(可选) |

## 3. 执行顺序

1. **Claude**:代码改造 + 本地 build 验证
2. **Claude**:git 首次 commit(先展示变更摘要,用户确认;`*.tsbuildinfo` 已入 gitignore)
3. **用户**:GitHub 建仓(github.com → New repository → `plainwords` → Public → 不勾任何初始化选项)
4. **用户**:推送(可把两条命令发给 Claude 代跑,登录走浏览器):
   ```bash
   git remote add origin https://github.com/<用户名>/plainwords.git
   git push -u origin main
   ```
5. **用户**:Vercel(vercel.com → GitHub 登录 → Add New Project → Import `plainwords`)
   - Framework:自动识别 Vite
   - Environment Variables:`ZHIPU_API_KEY = <智谱 key>`
   - Deploy → 得到 `https://plainwords-xxx.vercel.app`
6. **用户**:线上验证
   - 连 Phantom → 聊天一轮 → F12 Network:`/api/llm` 命中函数、请求头无用户 key
   - 余额/swap 报价/历史(`vercel.json` 的 `/jup` rewrite 生效)
7. **Devpost**:填仓库链接 + 部署链接

## 4. 环境变量一览(部署后)

| 变量 | 放哪 | 用途 |
|---|---|---|
| `ZHIPU_API_KEY` | Vercel → Settings → Environment Variables | Edge Function 注入上游鉴权;**不进仓库** |
| `VITE_LLM_KEY` | 本地 `.env` | 仅本地 dev;线上不读 |
| `VITE_LLM_MODEL` | 两边 | 模型名(线上默认建议 `glm-4-flash`) |
| — | — | `VITE_LLM_EXTRA_HEADERS`(opencode session 头)在直连智谱后**可弃** |

## 5. LLM 配置讨论点(执行时定)

1. **模型**:线上建议 `glm-4-flash`(非思考、低延迟,意图解析足够);本地可继续 `glm-5.3-flash`
2. **上下文窗口**:每轮全量历史进 prompt → 计划加"最近 12 轮"截断
3. **key 轮换**:Edge Function 支持逗号分隔多 key 轮换(~10 行)防限流,可选
4. **赛后处置**:作废智谱 key;Vercel 删环境变量(可选保留)

## 6. 演示/风险预案

- 演示视频:开头 5 秒带过 "Phantom on devnet, funded with test tokens"
- 评委自跑:README 第 1/2 步(装 Phantom → 领水 → 填自己的 key)
- Jupiter devnet 已退役:swap 为报价卡,README/Guide 已说明 mainnet-ready 叙事

---
*冻结于 2026-11-07。变化仅当:Devpost 官方要求冲突,或 Vercel 平台行为与上述实测不符。*
