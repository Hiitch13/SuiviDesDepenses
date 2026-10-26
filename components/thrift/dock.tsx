"use client"

import { CalendarDays, PiggyBank, Plus, Search, SlidersHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

export type Screen = "mois" | "historique" | "epargne" | "reglages"

const ITEMS: { id: Screen; label: string; Icon: typeof CalendarDays }[] = [
  { id: "mois", label: "Mois", Icon: CalendarDays },
  { id: "historique", label: "Historique", Icon: Search },
  { id: "epargne", label: "Épargne", Icon: PiggyBank },
  { id: "reglages", label: "Réglages", Icon: SlidersHorizontal },
]

/**
 * Barre fixée en bas : tout est à portée de pouce. Le bouton d'ajout est au
 * centre parce que noter une dépense est le geste le plus fréquent de l'app.
 */
export function Dock({
  screen,
  onScreen,
  onAdd,
  canAdd,
}: {
  screen: Screen
  onScreen: (s: Screen) => void
  onAdd: () => void
  canAdd: boolean
}) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t"
      style={{
        backgroundColor: "var(--t-ink)",
        borderColor: "var(--t-line)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
        {ITEMS.slice(0, 2).map((item) => (
          <DockButton key={item.id} {...item} active={screen === item.id} onClick={() => onScreen(item.id)} />
        ))}

        <div className="flex w-[4.5rem] shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={onAdd}
            disabled={!canAdd}
            className="-mt-5 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform disabled:opacity-40 motion-safe:active:scale-95"
            style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
          >
            <Plus className="size-7" strokeWidth={2.5} />
            <span className="sr-only">Noter une dépense</span>
          </button>
        </div>

        {ITEMS.slice(2).map((item) => (
          <DockButton key={item.id} {...item} active={screen === item.id} onClick={() => onScreen(item.id)} />
        ))}
      </div>
    </nav>
  )
}

function DockButton({
  label,
  Icon,
  active,
  onClick,
}: {
  label: string
  Icon: typeof CalendarDays
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      // `min-w-0` est indispensable : sans lui les libellés imposent leur largeur,
      // la barre déborde l'écran et le dernier onglet sort du cadre.
      className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2.5 transition-colors")}
      style={{ color: active ? "var(--t-brass)" : "var(--t-sage)" }}
    >
      <Icon className="size-[1.3rem] shrink-0" strokeWidth={active ? 2.4 : 1.9} />
      <span className="w-full truncate text-center text-[0.68rem] font-medium leading-none">{label}</span>
    </button>
  )
}
