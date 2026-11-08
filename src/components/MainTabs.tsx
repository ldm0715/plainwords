// Top tab bar of the main panel. "Chats" (session list) is mobile-only —
// on desktop the sidebar already shows the list. The account menu (avatar →
// address/copy/change/disconnect + settings) sits at the far right on ALL
// screen sizes.

import { AccountMenu } from "@/components/AccountMenu"
import { ui } from "@/lib/i18n"

export type Tab = "chat" | "chats" | "history" | "contacts" | "guide"

const TABS: { id: Tab; en: string; zh: string; mobileOnly?: boolean }[] = [
  { id: "chats", en: "Chats", zh: "会话", mobileOnly: true },
  { id: "chat", en: "Chat", zh: "聊天" },
  { id: "history", en: "History", zh: "历史" },
  { id: "contacts", en: "Contacts", zh: "联系人" },
  { id: "guide", en: "Guide", zh: "指南" },
]

interface Props {
  tab: Tab
  onTabChange: (t: Tab) => void
  onOpenSettings: () => void
}

export function MainTabs({ tab, onTabChange, onOpenSettings }: Props) {
  return (
    <div className="flex items-center border-b px-2 py-2 sm:px-4 sm:py-2.5">
      {/* tabs live in their own scrollable strip — overflow would otherwise
          clip the account popover that opens next to them */}
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-active={tab === t.id}
            onClick={() => onTabChange(t.id)}
            className={
              (t.mobileOnly ? "lg:hidden " : "shrink-0 ") +
              (tab === t.id
                ? "bg-muted text-foreground rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap sm:px-3 sm:text-sm"
                : "text-muted-foreground hover:text-foreground rounded-md px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:px-3 sm:text-sm")
            }
          >
            {ui(t.en, t.zh)}
          </button>
        ))}
      </div>
      {/* mobile-only: desktop has the full wallet button + gear in the sidebar.
          Sits OUTSIDE the scroll strip so its popover is never clipped. */}
      <div className="shrink-0 pl-1 lg:hidden">
        <AccountMenu onOpenSettings={onOpenSettings} />
      </div>
    </div>
  )
}
