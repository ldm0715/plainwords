// Address book — so "send 20 USDC to alice" resolves without asking for an
// address. Stored locally (devnet demo; production would sync encrypted).

import { PublicKey } from "@solana/web3.js"

export type ContactError =
  | "contactNameRequired"
  | "contactBadAddress"
  | "contactDuplicate"
  | "contactNotFound"

export interface Contact {
  /** lowercase, unique */
  name: string
  /** base58 Solana address */
  address: string
  /** optional note to tell same-name contacts apart */
  description?: string
}

// Per-account storage: contacts are isolated by the connected wallet (Phantom
// supports account switching — data must not leak across accounts).
const STORAGE_PREFIX = "plainwords:contacts"
const LEGACY_KEY = "plainwords:contacts" // pre-isolation global key

const keyOf = (owner: string) => `${STORAGE_PREFIX}:${owner}`

export function loadContacts(owner: string): Contact[] {
  try {
    const raw = localStorage.getItem(keyOf(owner))
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (c): c is Contact => !!c && typeof c.name === "string" && typeof c.address === "string",
    )
  } catch {
    return []
  }
}

export function saveContacts(owner: string, contacts: Contact[]): void {
  localStorage.setItem(keyOf(owner), JSON.stringify(contacts))
}

/** One-time copy of pre-isolation global data into the first real account. */
export function migrateLegacyContacts(owner: string): void {
  if (owner === "guest") return
  const flag = `plainwords:migrated-contacts:${owner}`
  if (localStorage.getItem(flag)) return
  if (!localStorage.getItem(keyOf(owner)) && localStorage.getItem(LEGACY_KEY)) {
    localStorage.setItem(keyOf(owner), localStorage.getItem(LEGACY_KEY)!)
  }
  localStorage.setItem(flag, "1")
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

export function addContact(
  owner: string,
  name: string,
  address: string,
  description?: string,
): Contact | { error: ContactError } {
  const n = normalizeName(name)
  if (!n) return { error: "contactNameRequired" }
  const trimmed = address.trim()
  try {
    new PublicKey(trimmed)
  } catch {
    return { error: "contactBadAddress" }
  }
  const contacts = loadContacts(owner)
  if (contacts.some((c) => c.name === n)) {
    return { error: "contactDuplicate" }
  }
  const desc = description?.trim()
  const contact: Contact = { name: n, address: trimmed, ...(desc ? { description: desc } : {}) }
  saveContacts(owner, [...contacts, contact])
  return contact
}

/** Edit a contact's name/address/description (original found by its current name). */
export function updateContact(
  owner: string,
  originalName: string,
  changes: { name?: string; address?: string; description?: string },
): Contact | { error: ContactError } {
  const contacts = loadContacts(owner)
  const idx = contacts.findIndex((c) => c.name === normalizeName(originalName))
  if (idx < 0) return { error: "contactNotFound" }

  const next = { ...contacts[idx] }
  if (changes.name !== undefined) {
    const n = normalizeName(changes.name)
    if (!n) return { error: "contactNameRequired" }
    if (n !== next.name && contacts.some((c) => c.name === n)) {
      return { error: "contactDuplicate" }
    }
    next.name = n
  }
  if (changes.address !== undefined) {
    const a = changes.address.trim()
    try {
      new PublicKey(a)
    } catch {
      return { error: "contactBadAddress" }
    }
    next.address = a
  }
  if (changes.description !== undefined) {
    const d = changes.description.trim()
    if (d) next.description = d
    else delete next.description
  }
  contacts[idx] = next
  saveContacts(owner, contacts)
  return next
}

export function removeContact(owner: string, name: string): void {
  saveContacts(owner, loadContacts(owner).filter((c) => c.name !== normalizeName(name)))
}

/** Rendered into the system prompt so the LLM can resolve names to addresses. */
export function formatContactsForPrompt(contacts: Contact[]): string {
  if (!contacts.length) return ""
  return (
    "\n\n## Known contacts\n" +
    contacts.map((c) => `- ${c.name}: ${c.address}`).join("\n") +
    "\n"
  )
}
