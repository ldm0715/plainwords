// Custom wallet button — the stock WalletMultiButton hard-codes a 4+4 address
// abbreviation and a downward dropdown; we show more of the address and pop the
// menu up, centered. Modal ("Change wallet") still uses the stock wallet modal.

import { useEffect, useRef, useState } from "react"
import { Check, ChevronUp, Copy, Wallet } from "lucide-react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { Button } from "@/components/ui/button"
import { ui } from "@/lib/i18n"

export function WalletButton() {
  const { publicKey, wallet, disconnect, connecting, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // close on outside click / Escape
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

  if (!connected || !publicKey) {
    return (
      <Button className="w-full" onClick={() => setVisible(true)} disabled={connecting}>
        {connecting ? ui("Connecting…", "连接中…") : ui("Select Wallet", "选择钱包")}
      </Button>
    )
  }

  const addr = publicKey.toBase58()
  const display = `${addr.slice(0, 10)}…${addr.slice(-10)}`
  const icon = wallet?.adapter.icon

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard blocked — user can still view the address via the modal */
    }
  }

  const item =
    "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted"

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="outline"
        className="w-full justify-between"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon ? (
            <img src={icon} alt="" className="size-5 shrink-0 rounded" />
          ) : (
            <Wallet className="size-4 shrink-0" />
          )}
          <span className="truncate font-mono text-xs">{display}</span>
        </span>
        <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
      </Button>

      {open && (
        <div
          role="menu"
          className="bg-popover absolute bottom-[calc(100%+6px)] left-1/2 z-50 w-max min-w-40 -translate-x-1/2 rounded-lg border p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.4)]"
        >
          <button type="button" role="menuitem" className={item} onClick={copy}>
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
        </div>
      )}
    </div>
  )
}
