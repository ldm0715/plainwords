// Conversation sessions — persisted to localStorage so history survives reloads.

import { ui } from "./i18n"
import type { ChatMessage } from "./types"

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

// Per-account storage: chat sessions are isolated by the connected wallet.
const KEY_PREFIX = "plainwords:sessions"
const ACTIVE_PREFIX = "plainwords:activeSession"
const LEGACY_KEY = "plainwords:sessions" // pre-isolation global key
const LEGACY_ACTIVE = "plainwords:activeSession"

const keyOf = (owner: string) => `${KEY_PREFIX}:${owner}`
const activeKeyOf = (owner: string) => `${ACTIVE_PREFIX}:${owner}`

export const uid = (): string => Math.random().toString(36).slice(2, 10)

export function loadSessions(owner: string): Session[] {
  try {
    const raw = localStorage.getItem(keyOf(owner))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSessions(owner: string, sessions: Session[]): void {
  localStorage.setItem(keyOf(owner), JSON.stringify(sessions))
}

export function loadActiveId(owner: string): string | null {
  return localStorage.getItem(activeKeyOf(owner))
}

export function saveActiveId(owner: string, id: string): void {
  localStorage.setItem(activeKeyOf(owner), id)
}

/** One-time copy of pre-isolation global sessions into the first real account. */
export function migrateLegacySessions(owner: string): void {
  if (owner === "guest") return
  const flag = `plainwords:migrated-sessions:${owner}`
  if (localStorage.getItem(flag)) return
  if (!localStorage.getItem(keyOf(owner)) && localStorage.getItem(LEGACY_KEY)) {
    localStorage.setItem(keyOf(owner), localStorage.getItem(LEGACY_KEY)!)
    const legacyActive = localStorage.getItem(LEGACY_ACTIVE)
    if (legacyActive) localStorage.setItem(activeKeyOf(owner), legacyActive)
  }
  localStorage.setItem(flag, "1")
}

export function makeWelcome(): ChatMessage {
  return {
    id: uid(),
    role: "assistant",
    text: ui(
      "Hi! I'm PlainWords 👋  Tell me what you'd like to do in your own words — " +
        'for example "swap half my SOL into USDC" or "send 0.1 SOL to <address>". ' +
        "I'll do the math, check the risks, and show you a confirmation card before anything moves.",
      "嗨!我是 PlainWords 👋  用大白话告诉我想做什么 — " +
        "比如“把我一半的 SOL 换成 USDC”或“给 <地址> 转 0.1 SOL”。" +
        "我来算金额、查风险,确认之前链上分文不动。",
    ),
  }
}

export function makeSession(): Session {
  const now = Date.now()
  return { id: uid(), title: "New chat", createdAt: now, updatedAt: now, messages: [makeWelcome()] }
}
