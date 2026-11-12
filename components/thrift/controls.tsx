"use client"

import type { ReactNode } from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// Styles de champ partagés : les champs natifs restent plus fiables au doigt
// que des composants enrobés, et ils héritent déjà des jetons.
// `min-w-0` est indispensable : placé dans une rangée flex à côté d'un bouton,
// un champ en `w-full` refuse sinon de rétrécir, déborde l'écran, et étire au
// passage la barre d'onglets fixée en bas.
export const FIELD =
  "w-full min-w-0 rounded-xl border px-3.5 py-3 text-base outline-none transition-colors placeholder:text-[var(--t-sage)] focus:border-[var(--t-brass)]"
export const FIELD_STYLE = {
  backgroundColor: "var(--t-moss)",
  borderColor: "var(--t-line)",
  color: "var(--t-paper)",
} as const

export const LABEL = "mb-1.5 block text-sm"
export const LABEL_STYLE = { color: "var(--t-sage)" } as const

/** Une feuille ancrée en bas : à portée de pouce, contrairement à une fenêtre centrée. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-auto bottom-0 left-0 right-0 max-h-[88svh] w-full max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl border-x-0 border-b-0 p-5 sm:left-1/2 sm:-translate-x-1/2"
        style={{ backgroundColor: "var(--t-pine)", borderColor: "var(--t-line)" }}
      >
        <DialogHeader className="mb-3 text-left">
          <DialogTitle className="text-lg font-semibold" style={{ color: "var(--t-paper)" }}>
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Au repos les icônes restent grises : une liste de dix corbeilles rouges
      // crie plus fort que les montants. Le rouge n'apparaît qu'à l'intention.
      className={cn(
        "shrink-0 rounded-lg p-2 text-[var(--t-sage)] transition-colors hover:bg-white/[0.06]",
        danger && "hover:text-[var(--t-alert)] focus-visible:text-[var(--t-alert)]"
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex shrink-0 items-center whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-colors"
      style={{
        backgroundColor: active ? "var(--t-brass)" : "var(--t-moss)",
        borderColor: active ? "var(--t-brass)" : "var(--t-line)",
        color: active ? "var(--t-ink)" : "var(--t-paper)",
      }}
    >
      {children}
    </button>
  )
}
