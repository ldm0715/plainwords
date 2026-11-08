// Reply-language for deterministic (non-LLM) assistant messages.
// The chat must mirror the user's language everywhere — including the strings
// code itself produces (balance replies, errors, confirmations).

export type Lang = "en" | "zh"

let current: Lang = "en"

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/

/** Detect language from the user's last message and lock replies to it. */
export function setLangFromText(text: string): void {
  current = CJK.test(text) ? "zh" : "en"
}

export function getLang(): Lang {
  return current
}

// --- UI language: explicit user setting (Settings dialog), persisted, and
// independent from the chat-reply language (which mirrors each message). ---

const UI_LANG_KEY = "plainwords:uiLang"

let uiLang: Lang = "en"
try {
  const saved = localStorage.getItem(UI_LANG_KEY)
  if (saved === "en" || saved === "zh") uiLang = saved
} catch {
  /* storage unavailable */
}

export function getUILang(): Lang {
  return uiLang
}

export function setUILang(lang: Lang): void {
  uiLang = lang
  try {
    localStorage.setItem(UI_LANG_KEY, lang)
  } catch {
    /* ignore */
  }
}

/** Inline bilingual UI string: ui("Contacts", "联系人") */
export function ui(en: string, zh: string): string {
  return uiLang === "zh" ? zh : en
}

type Key =
  | "connectFirst"
  | "balance"
  | "price"
  | "priceUnavailable"
  | "pendingBatch"
  | "batchPartial"
  | "batchDone"
  | "batchMixed"
  | "contactSaved"
  | "notInContactsNudge"
  | "somethingWentWrong"
  | "needAmount"
  | "insufficient"
  | "zeroBalance"
  | "allWouldLeaveNothing"
  | "quoteFailed"
  | "sendDone"
  | "sendFailed"
  | "contactNameRequired"
  | "contactBadAddress"
  | "contactDuplicate"
  | "contactNotFound"
  | "contactUpdated"
  | "contactRemoved"
  | "contactEditTitle"
  | "contactEditTitleDesc"
  | "contactApplyRemove"
  | "contactRemoveTitle"
  | "contactFieldName"
  | "contactFieldAddress"
  | "contactFieldNote"
  | "contactApply"
  | "contactCancel"
  | "contactApplied"
  | "contactCancelled"
  | "contactRemoveWarn"
  | "historyEmpty"
  | "confirmedOnChain"
  | "swapClosedQuoteOnly"

/** Translate a message key with the language locked by the last user text. */
export function t(key: Key, vars: Record<string, string> = {}): string {
  return MESSAGES[key](vars)
}

const MESSAGES: Record<Key, (v: Record<string, string>) => string> = {
  contactNameRequired: () =>
    current === "zh" ? "请先给联系人起个名字。" : "Please give the contact a name.",
  contactBadAddress: () =>
    current === "zh"
      ? "这看起来不是有效的 Solana 地址。"
      : "That doesn't look like a valid Solana address.",
  contactDuplicate: (v) =>
    current === "zh"
      ? `你已经有一个叫"${v.name}"的联系人了。`
      : `You already have a contact named "${v.name}".`,
  contactNotFound: (v) =>
    current === "zh" ? `联系人里没有"${v.name}"。` : `"${v.name}" is not in your contacts.`,
  contactUpdated: (v) =>
    current === "zh"
      ? `已更新联系人:"${v.name}" → ${v.addr}。`
      : `Contact updated: "${v.name}" → ${v.addr}.`,
  contactRemoved: (v) =>
    current === "zh" ? `已删除联系人"${v.name}"。` : `Removed contact "${v.name}".`,
  contactEditTitle: () => (current === "zh" ? "编辑联系人" : "Edit contact"),
  contactEditTitleDesc: () =>
    current === "zh"
      ? "确认以下修改 — 老值划线,新值在后。"
      : "Review the changes below — old struck through, new after the arrow.",
  contactApplyRemove: () => (current === "zh" ? "删除" : "Remove"),
  contactRemoveTitle: () => (current === "zh" ? "删除联系人" : "Remove contact"),
  contactFieldName: () => (current === "zh" ? "名字" : "Name"),
  contactFieldAddress: () => (current === "zh" ? "地址" : "Address"),
  contactFieldNote: () => (current === "zh" ? "备注" : "Note"),
  contactApply: () => (current === "zh" ? "确认" : "Confirm"),
  contactCancel: () => (current === "zh" ? "取消" : "Cancel"),
  contactApplied: () => (current === "zh" ? "已生效。" : "Applied."),
  contactCancelled: () => (current === "zh" ? "已取消 — 没有任何改动。" : "Cancelled — nothing changed."),
  contactRemoveWarn: () =>
    current === "zh"
      ? "删除后,提到的这个名字将不再自动解析为地址。"
      : "After removal, this name will no longer resolve to an address in chat.",
  historyEmpty: () =>
    current === "zh" ? "没有找到符合条件的转账记录。" : "No matching transfers found.",
  confirmedOnChain: () =>
    current === "zh" ? "已上链,详情见下方链接。" : "Confirmed on devnet — see the link below.",
  swapClosedQuoteOnly: () =>
    current === "zh"
      ? "已关闭 — 仅报价,devnet 聚合器已退役;主网上这条兑换可以一键执行。"
      : "Closed — quote only. Devnet swap routing is retired; on mainnet this executes via Jupiter in one tap.",
  connectFirst: () =>
    current === "zh"
      ? "请先连接钱包(左下角),然后告诉我想做什么。"
      : "Connect your wallet first (bottom left) — then tell me what you'd like to do.",
  balance: (v) =>
    current === "zh"
      ? `你有 ${v.sol} SOL${v.solUsd} 和 ${v.usdc} USDC。${v.total}`
      : `You have ${v.sol} SOL${v.solUsd} and ${v.usdc} USDC.${v.total}`,
  price: (v) =>
    current === "zh"
      ? `${v.amount} ${v.asset} ≈ ${v.out} ${v.quote}（Jupiter 实时报价）。`
      : `${v.amount} ${v.asset} ≈ ${v.out} ${v.quote} (live Jupiter quote).`,
  priceUnavailable: () =>
    current === "zh"
      ? "现在拿不到实时价格,稍后再试。"
      : "I can't get a live price right now — try again in a moment.",
  pendingBatch: (v) =>
    current === "zh"
      ? `共 ${v.count} 笔转账,请逐笔确认。`
      : `${v.count} transfers ready — please confirm each one.`,
  batchPartial: (v) =>
    current === "zh"
      ? `本批共 ${v.total} 笔,已完成 ${v.done} 笔 — 还有 ${v.remaining} 笔待确认。`
      : `${v.done} of ${v.total} done — ${v.remaining} still awaiting your confirmation.`,
  batchDone: (v) =>
    current === "zh"
      ? `本批 ${v.total} 笔已全部完成。`
      : `All ${v.total} transfers in this batch are done.`,
  batchMixed: (v) =>
    current === "zh"
      ? `本批 ${v.total} 笔已处理完毕 — ${v.done} 笔成功,${v.skipped} 笔未执行。`
      : `Batch finished: ${v.done} succeeded, ${v.skipped} not executed.`,
  contactSaved: (v) =>
    current === "zh"
      ? `已保存 — "${v.name}" 现在是 ${v.addr}。以后只要说"给 ${v.name} 转 20 USDC"就行。`
      : `Saved — "${v.name}" is now ${v.addr}. Next time just say "send 20 USDC to ${v.name}".`,
  notInContactsNudge: (v) =>
    current === "zh"
      ? `顺便说一句 — ${v.addr} 还不在你的联系人里。想记住它,直接说"把 ${v.addr} 存为 名字"。`
      : `By the way — ${v.addr} isn't in your Contacts yet. To remember it, just say "remember <name> as ${v.addr}".`,
  somethingWentWrong: () =>
    current === "zh" ? "出了点问题 — 请再试一次。" : "Something went wrong — please try again.",
  needAmount: () =>
    current === "zh"
      ? "金额需要大于零 — 你想转多少?"
      : "I need an amount greater than zero — how much did you want to move?",
  insufficient: (v) =>
    current === "zh"
      ? `你只有 ${v.balance} ${v.asset} — 不够转这么多。`
      : `You only have ${v.balance} ${v.asset} — not enough for that.`,
  zeroBalance: (v) =>
    current === "zh"
      ? `你的 ${v.asset} 余额现在是零。(演示提示:去 faucets.solana.com 领 devnet SOL。)`
      : `Your ${v.asset} balance is zero right now. (Demo tip: grab devnet SOL from faucets.solana.com.)`,
  allWouldLeaveNothing: (v) =>
    current === "zh"
      ? `全部转走会留不够网络费 — 至少保留 ${v.reserve} SOL。`
      : `Moving everything would leave nothing for network fees — keep at least ${v.reserve} SOL.`,
  quoteFailed: (v) =>
    current === "zh"
      ? `现在拿不到实时兑换报价(${v.err})。稍后再试;转账不受影响。`
      : `I couldn't get a live swap price right now (${v.err}). Try again in a moment; transfers still work.`,
  sendDone: (v) =>
    current === "zh"
      ? `完成 — 已把 ${v.amount} ${v.asset} 转给 ${v.to}${v.sig}。`
      : `Done — sent ${v.amount} ${v.asset} to ${v.to}${v.sig}.`,
  sendFailed: (v) =>
    current === "zh"
      ? `没有成功(${v.err})。链上没有任何变动 — 可以重试。`
      : `That didn't go through (${v.err}). Nothing was moved — you can try again.`,
}
