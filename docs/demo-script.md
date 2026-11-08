# PlainWords 2 分钟 Demo 台本（中英对照）

> 录制目标：MLH Solana Hackathon，2 分钟以内。
> 英文版建议：UI 设为 English，聊天用英文输入，配音用文末的英文 TTS 文本。
> 中文版建议：UI 设为中文，聊天用中文输入，配音/字幕用文末的中文文本。

## 录制前检查

- Phantom 切到 **Devnet**，钱包里至少有 0.05 SOL 和少量 USDC
- 应用 Settings → Interface language，按录制版本选择 English / 中文
- 联系人里**不要**提前存在 `mon`，否则“新地址提示”演不出来
- 完整预跑一遍全流程，确认 LLM 响应和公共 RPC 正常
- 浏览器缩放 100%，隐藏书签栏，关闭系统通知和聊天软件
- 窗口录制 1080p；自动缩放、光标平滑、点击特效在 OpenScreen 里后期加
- 红色卡片只展示，**不要真的确认**，否则会把大部分 SOL 转出去

## 时间轴

### 0:00–0:08 开场与连接钱包

- **画面**：首页 → Connect Wallet → Phantom 弹窗 → 确认
- **旁白**：连接后鼠标扫过侧栏余额条

**English VO**

> This is PlainWords, a Solana wallet you run in plain language. Connect Phantom, and your SOL and U-S-D-C balances load instantly.

**中文旁白**

> 这是 PlainWords，一个用自然语言操作的 Solana 钱包。连接 Phantom，SOL 和 USDC 余额立即显示。

### 0:08–0:22 新会话：查价格与余额

- **画面**：点 New chat，依次发送两条消息（两条分开问，只读工具不会合并）
- **输入 EN**：`What's the price of SOL right now?`
- **输入 ZH**：`现在 SOL 什么价格？`
- **输入 EN**：`How much is in my wallet?`
- **输入 ZH**：`我钱包里有多少钱？`

**English VO**

> Start a new chat. Ask what SOL is worth right now, then ask how much is in the wallet. No forms, no dashboards. Just questions.

**中文旁白**

> 新建一个会话，先问 SOL 现在的价格，再问钱包里有多少钱。没有表单，没有仪表盘，直接用说的。

### 0:22–0:34 兑换报价卡片

- **画面**：发送后出现 confirm card，悬停展示预计到账、价格影响、风险原因
- **输入 EN**：`Swap half my SOL for USDC.`
- **输入 ZH**：`把一半 SOL 换成 USDC。`
- **操作**：说明 devnet 只报价，然后取消卡片

**English VO**

> Now, swap half my SOL for U-S-D-C. PlainWords pulls a live Jupiter quote and scores the risk before anything moves. On devnet, swaps are quote-only, so we stop at the card.

**中文旁白**

> 把一半 SOL 换成 USDC。PlainWords 拉取实时 Jupiter 报价，并在任何操作前做风险评估。devnet 上只报价、不落链，所以我们停在卡片这一步。

### 0:34–1:16 多资产转账、取消、补发、存联系人

- **输入 EN**：`Send 0.01 SOL and 1 USDC to FkzyUQZxg4k24z7TCkpBh5QU5EXE6tv7JeVzcMehdTjo`
- **输入 ZH**：`给 FkzyUQZxg4k24z7TCkpBh5QU5EXE6tv7JeVzcMehdTjo 转 0.01 SOL 和 1 USDC。`
- **画面**：出现两张确认卡片；助手提示该地址不在联系人
- **操作 1**：取消 SOL 卡片（0:40 左右）
- **操作 2**：确认 USDC 卡片 → Phantom 签名 → 成功摘要（0:42–0:48）
- **输入 EN**：`Did the SOL transfer go through?`
- **输入 ZH**：`SOL 那笔转成功了吗？`
- **预期**：助手回答没有，卡片已取消
- **输入 EN**：`Send 0.01 SOL to the same address.`
- **输入 ZH**：`给刚才那个地址再转 0.01 SOL。`
- **操作 3**：确认 → Phantom 签名 → 成功摘要 + 订单号（1:01–1:07）
- **输入 EN**：`Save that address as mon.`
- **输入 ZH**：`把刚才那个地址存为 mon。`
- **预期**：联系人已保存（1:08–1:13）

**English VO**

> Next, send zero point zero one SOL and one U-S-D-C to an address that is not saved yet. The model notices it is new, and prepares both transfers as separate confirm cards. We only need the U-S-D-C leg, so cancel the SOL card, confirm the U-S-D-C card, and sign. The chat records that cancellation. Ask whether the SOL transfer went through, and the model correctly says no. Resend it, confirm, sign again. It lands in about a second. Then save this address as mon.

**中文旁白**

> 接下来，把 0.01 SOL 和 1 USDC 转给一个还没保存的地址。模型注意到这是新地址，并把两笔转账分别做成确认卡片。我们只要 USDC：取消 SOL，确认 USDC，签名。聊天里会记录这次取消，所以当我们问 SOL 那笔是否成功时，模型会如实回答没有。重新发起、确认、再签一次，大约一秒到账。然后把这个地址存为 mon。

### 1:16–1:30 全部余额触发红色强确认卡片

- **输入 EN**：`Send all my SOL to mon.`
- **输入 ZH**：`把剩下的 SOL 全转给 mon。`
- **画面**：红色 strict 卡片，逐条展示风险原因；指出确认需要输入 CONFIRM
- **操作**：取消卡片，不要确认

**English VO**

> Now try to send all my SOL. That is over ninety percent of the balance, so it gets a red, strict card. The risk reasons are spelled out, and confirming would require typing CONFIRM. We cancel.

**中文旁白**

> 现在试着把全部 SOL 转出去。这超过余额的 90%，所以触发红色强确认卡片。风险原因逐条列出，确认需要手动输入 CONFIRM。我们取消。

### 1:30–1:48 本周花费与极值

- **输入 EN**：`How much did I spend this week? What were the largest and smallest transfers?`
- **输入 ZH**：`这周花了多少钱？最大和最小的一笔分别是什么？`
- **注意**：这里按最近 7 天滚动窗口统计，不是自然周
- **画面**：助手给出汇总、明细、最大和最小记录

**English VO**

> Finally, how much did I spend this week, and what were the largest and smallest transfers? Every total, ranking and extreme is computed in code. The model only explains the numbers it is given, and never guesses.

**中文旁白**

> 最后，这周花了多少钱？最大和最小的一笔分别是什么？所有合计、排序和极值都由代码计算，模型只负责解释这些数字，不做猜测。

### 1:48–2:00 历史、联系人与收尾

- **画面**：切到 History 展示转账记录 → 切到 Contacts 展示 mon → 回到聊天
- **旁白**：收尾

**English VO**

> Contacts remember addresses. History shows every transfer. Plain words in, one confirmation, your signature out. That is PlainWords.

**中文旁白**

> 联系人记住地址，历史记录展示每一笔转账。自然语言输入，一次确认，由你签名。这就是 PlainWords。

## 英文 TTS 文本（逐段生成，便于对齐时间轴）

建议逐段生成音频后按时间点铺轨，语速 140–150 wpm。

**S1（0:00，约 8 秒）**

This is PlainWords, a Solana wallet you run in plain language. Connect Phantom, and your SOL and U-S-D-C balances load instantly.

**S2（0:08，约 13 秒）**

Start a new chat. Ask what SOL is worth right now, then ask how much is in the wallet. No forms, no dashboards. Just questions.

**S3（0:22，约 12 秒）**

Now, swap half my SOL for U-S-D-C. PlainWords pulls a live Jupiter quote and scores the risk before anything moves. On devnet, swaps are quote-only, so we stop at the card.

**S4（0:34，约 40 秒）**

Next, send zero point zero one SOL and one U-S-D-C to an address that is not saved yet. The model notices it is new, and prepares both transfers as separate confirm cards. We only need the U-S-D-C leg, so cancel the SOL card, confirm the U-S-D-C card, and sign. The chat records that cancellation. Ask whether the SOL transfer went through, and the model correctly says no. Resend it, confirm, sign again. It lands in about a second. Then save this address as mon.

**S5（1:16，约 13 秒）**

Now try to send all my SOL. That is over ninety percent of the balance, so it gets a red, strict card. The risk reasons are spelled out, and confirming would require typing CONFIRM. We cancel.

**S6（1:30，约 17 秒）**

Finally, how much did I spend this week, and what were the largest and smallest transfers? Every total, ranking and extreme is computed in code. The model only explains the numbers it is given, and never guesses.

**S7（1:48，约 11 秒）**

Contacts remember addresses. History shows every transfer. Plain words in, one confirmation, your signature out. That is PlainWords.

## 中文配音 / 字幕文本

**S1**

这是 PlainWords，一个用自然语言操作的 Solana 钱包。连接 Phantom，SOL 和 USDC 余额立即显示。

**S2**

新建一个会话，先问 SOL 现在的价格，再问钱包里有多少钱。没有表单，没有仪表盘，直接用说的。

**S3**

把一半 SOL 换成 USDC。PlainWords 拉取实时 Jupiter 报价，并在任何操作前做风险评估。devnet 上只报价、不落链，所以我们停在卡片这一步。

**S4**

接下来，把 0.01 SOL 和 1 USDC 转给一个还没保存的地址。模型注意到这是新地址，并把两笔转账分别做成确认卡片。我们只要 USDC：取消 SOL，确认 USDC，签名。聊天里会记录这次取消，所以当我们问 SOL 那笔是否成功时，模型会如实回答没有。重新发起、确认、再签一次，大约一秒到账。然后把这个地址存为 mon。

**S5**

现在试着把全部 SOL 转出去。这超过余额的 90%，所以触发红色强确认卡片。风险原因逐条列出，确认需要手动输入 CONFIRM。我们取消。

**S6**

最后，这周花了多少钱？最大和最小的一笔分别是什么？所有合计、排序和极值都由代码计算，模型只负责解释这些数字，不做猜测。

**S7**

联系人记住地址，历史记录展示每一笔转账。自然语言输入，一次确认，由你签名。这就是 PlainWords。

## TTS 发音提示

- `U-S-D-C` 写成带连字符，避免被读成一个单词
- `SOL` 若被 TTS 读成字母逐个念，改成 `Solana`
- `CONFIRM` 按普通单词读即可
- `mon` 读作 /mɒn/，与 “on” 押韵
- 英文配音中不要出现完整地址，TTS 会逐字符朗读

## 常见问题与备选台词

| 情况 | 处理 |
|---|---|
| 助手追问 “same address” 是哪一个 | 重新发送完整地址再转一次 |
| 助手要求提供 mon 的地址 | 直接贴完整地址，台词不变 |
| 历史查询为空 | 先点一次 History 标签触发同步，再问一遍 |
| Swap 报价接口失败 | 跳过该段，旁白改为 “兑换报价依赖 Jupiter 接口，这里跳过” |
| 红色卡片没出现 | 确认输入是“全部/剩下的 SOL”，且金额超过余额 90% |
| 总时长超了 | 砍掉 S2 的余额问题，只演示价格查询 |
| Phantom 签名弹窗延迟 | 提前解锁 Phantom，录前先手动转一笔热身 |
