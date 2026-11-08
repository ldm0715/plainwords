import { useState } from "react"
import { Pencil, Plus, SendHorizonal, UserRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { shortAddress } from "@/lib/solana"
import { t, ui } from "@/lib/i18n"
import { isValidAddress, type Contact, type ContactError } from "@/lib/contacts"

interface Props {
  contacts: Contact[]
  onAdd: (name: string, address: string, description?: string) => Contact | { error: ContactError }
  /** open the confirmation dialog for an edit (App owns the dialog) */
  onRequestEdit: (
    originalName: string,
    newName: string,
    newAddress: string,
    currentAddress: string,
    newDescription?: string,
  ) => void
  /** open the confirmation dialog for a removal */
  onRequestRemove: (name: string, address: string) => void
  /** open the send dialog for this contact */
  onRequestSend: (contact: Contact) => void
}

interface EditDraft {
  original: string
  name: string
  address: string
  description: string
}

interface AddDraft {
  name: string
  address: string
  description: string
}

export function ContactsPanel({
  contacts,
  onAdd,
  onRequestEdit,
  onRequestRemove,
  onRequestSend,
}: Props) {
  const [error, setError] = useState<ContactError | null>(null)
  const [edit, setEdit] = useState<EditDraft | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [add, setAdd] = useState<AddDraft>({ name: "", address: "", description: "" })

  const submitAdd = () => {
    const res = onAdd(add.name, add.address, add.description)
    if ("error" in res) {
      setError(res.error)
      return
    }
    setError(null)
    setAdd({ name: "", address: "", description: "" })
    setAddOpen(false)
  }

  const submitEdit = () => {
    if (!edit) return
    if (!edit.name.trim()) {
      setError("contactNameRequired")
      return
    }
    if (!isValidAddress(edit.address)) {
      setError("contactBadAddress")
      return
    }
    setError(null)
    const current = contacts.find((c) => c.name === edit.original)
    onRequestEdit(edit.original, edit.name, edit.address, current?.address ?? "", edit.description)
    // the confirm dialog takes over from here — drop the inline edit form so
    // the row reverts to display mode no matter how the dialog resolves
    setEdit(null)
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{ui("Contacts", "联系人")}</h2>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus data-icon="inline-start" /> {ui("Add", "添加")}
          </Button>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {ui("Save addresses once, then just say", "地址存一次,以后只需说")}{" "}
          <span className="font-mono text-xs">{ui("\"send 20 USDC to alice\"", "\"给 alice 转 20 USDC\"")}</span>{" "}
          {ui("— PlainWords resolves the name, no address copying needed.", "— PlainWords 自动解析名字,无需复制地址。")}
        </p>

        {contacts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
              <UserRound className="size-4" />
              {ui("No contacts yet — click Add to create one.", "还没有联系人 — 点击添加创建。")}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) =>
              edit?.original === c.name ? (
                /* edit mode */
                <div key={c.name} className="space-y-2 rounded-lg border border-primary/40 px-4 py-3">
                  <div className="flex min-w-0 gap-2">
                    <Input
                      value={edit.name}
                      onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      placeholder={ui("name", "名字")}
                      className="w-28 shrink-0"
                      aria-label="Contact name"
                    />
                    <Input
                      value={edit.address}
                      onChange={(e) => setEdit({ ...edit, address: e.target.value })}
                      placeholder={ui("Solana address", "Solana 地址")}
                      className="min-w-0 flex-1 font-mono text-xs"
                      aria-label="Solana address"
                    />
                  </div>
                  <Input
                    value={edit.description}
                    onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                    placeholder={ui("note (optional) — e.g. 'roommate', 'Binance hot wallet'", "备注(可选)— 如:'室友'、'交易所热钱包'")}
                    aria-label={ui("Contact note", "联系人备注")}
                    className="text-xs"
                  />
                  {error && (
                    <p className="text-destructive text-xs">{t(error, { name: edit.name })}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEdit(null)
                        setError(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={submitEdit}>
                      {ui("Save", "保存")}
                    </Button>
                  </div>
                </div>
              ) : (
                /* display mode — send/edit/remove */
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium capitalize">{c.name}</span>
                      {c.description && (
                        <span className="text-muted-foreground truncate text-xs italic">
                          {c.description}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate font-mono text-xs">
                      {shortAddress(c.address, 12)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label={`Send to ${c.name}`}
                      title={`Send to ${c.name}`}
                      onClick={() => onRequestSend(c)}
                    >
                      <SendHorizonal />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${c.name}`}
                      onClick={() => {
                        setError(null)
                        setEdit({
                          original: c.name,
                          name: c.name,
                          address: c.address,
                          description: c.description ?? "",
                        })
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${c.name}`}
                      className="hover:text-destructive"
                      onClick={() => onRequestRemove(c.name, c.address)}
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {/* add-contact dialog (opened by the + button, keeps the list full-height) */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{ui("Add a contact", "添加联系人")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex min-w-0 gap-2">
                <Input
                  autoFocus
                  value={add.name}
                  onChange={(e) => setAdd({ ...add, name: e.target.value })}
                  placeholder={ui("name (e.g. alice)", "名字(如 alice)")}
                  className="w-36"
                  aria-label="Contact name"
                />
                <Input
                  value={add.address}
                  onChange={(e) => setAdd({ ...add, address: e.target.value })}
                  placeholder={ui("Solana address", "Solana 地址")}
                  className="min-w-0 flex-1 font-mono text-xs"
                  aria-label="Solana address"
                />
              </div>
              <Input
                value={add.description}
                onChange={(e) => setAdd({ ...add, description: e.target.value })}
                placeholder={ui("note (optional) — e.g. 'roommate', 'Binance hot wallet'", "备注(可选)— 如:'室友'、'交易所热钱包'")}
                aria-label={ui("Contact note", "联系人备注")}
                className="text-xs"
              />
              {error && <p className="text-destructive text-xs">{t(error, { name: add.name })}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                {ui("Cancel", "取消")}
              </Button>
              <Button
                onClick={submitAdd}
                disabled={!add.name.trim() || !add.address.trim()}
              >
                {ui("Add", "添加")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ScrollArea>
  )
}
