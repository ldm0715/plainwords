// Compact account menu for the tab bar (mobile-first): avatar button at the
// far right; the popover holds the full address, copy/change/disconnect and
// the settings entry. Desktop sidebar keeps its own full-width WalletButton.

import { useEffect, useRef, useState } from "react"
import { Check, Copy, Languages, Wallet } from "lucide-react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { ui } from "@/lib/i18n"
import { shortAddress } from "@/lib/solana"

interface Props {
  onOpenSettings: () => void
}

export function AccountMenu({ onOpenSettings }: Props) {
  const { publicKey, wallet, disconnect, connecting, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const item =
    "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted"

  if (!connected || !publicKey) {
    return (
      <button
        type="button"
        disabled={connecting}
        onClick={() => setVisible(true)}
        aria-label={ui("Select Wallet", "选择钱包")}
        className="border-border hover:bg-muted flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold disabled:opacity-50"
      >
        {connecting ? "…" : <Wallet className="size-4" />}
      </button>
    )
  }

  const addr = publicKey.toBase58()
  const icon = wallet?.adapter.icon

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ui("Account", "账户")}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="border-border hover:bg-muted flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border"
      >
        {icon ? (
          <img src={icon} alt="" className="size-full object-cover" />
        ) : (
          <Wallet className="size-4" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="bg-popover absolute top-[calc(100%+8px)] right-0 z-50 w-max min-w-56 rounded-lg border p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.4)]"
        >
          {/* masked address header */}
          <div className="border-b px-3 pt-1 pb-2">
            <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
              {wallet?.adapter.name ?? "Wallet"}
            </div>
            <div className="mt-0.5 font-mono text-[11px]">
              {shortAddress(addr, 8)}
            </div>
          </div>

          <button type="button" role="menuitem" className={`${item} mt-1`} onClick={copy}>
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? ui("Copied", "已复制") : ui("Copy address", "复制地址")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false)
              setVisible(true)
            }}
          >
            <Wallet className="size-3.5" />
            {ui("Change wallet", "更换钱包")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${item} hover:bg-destructive/10`}
            onClick={() => {
              setOpen(false)
              void disconnect()
            }}
          >
            <span className="size-3.5 rounded-full border border-current" />
            {ui("Disconnect", "断开连接")}
          </button>

          {/* settings entry inside the same popover */}
          <div className="border-t pt-1 mt-1">
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false)
                onOpenSettings()
              }}
            >
              <Languages className="size-3.5" />
              {ui("Settings", "设置")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
