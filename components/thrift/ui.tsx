"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Le mot-symbole. Minuscules, chasse resserrée, jamais traduit ni mis en capitales. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("wordmark text-[1.35rem] leading-none", className)} style={{ color: "var(--t-paper)" }}>
      thrift
    </span>
  )
}

/**
 * Un bloc de contenu. Pas de carte, pas d'ombre : un fond légèrement plus clair
 * et un filet suffisent à séparer.
 */
export function Panel({
  children,
  className,
  flush = false,
}: {
  children: ReactNode
  className?: string
  /** Sans marge intérieure, pour les listes qui gèrent la leur ligne par ligne. */
  flush?: boolean
}) {
  return (
    <section
      className={cn("rounded-2xl border", flush ? "py-1" : "p-4 sm:p-5", className)}
      style={{ backgroundColor: "var(--t-pine)", borderColor: "var(--t-line)" }}
    >
      {children}
    </section>
  )
}

export function SectionTitle({
  children,
  aside,
  className,
}: {
  children: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-[0.95rem] font-semibold" style={{ color: "var(--t-paper)" }}>
        {children}
      </h2>
      {aside ? (
        <span className="shrink-0 text-xs" style={{ color: "var(--t-sage)" }}>
          {aside}
        </span>
      ) : null}
    </div>
  )
}

/** La pastille colorée qui porte l'identité d'une catégorie, à côté du texte. */
export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  )
}

/** Une ligne de liste. Les lignes se séparent par un filet, pas par des cartes. */
export function Row({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  const content = (
    <div className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", className)}>{children}</div>
  )
  if (!onClick) {
    return <div className="border-b last:border-b-0" style={{ borderColor: "var(--t-line)" }}>{content}</div>
  }
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--t-line)" }}>
      <button type="button" onClick={onClick} className="w-full rounded-lg transition-colors hover:bg-white/[0.03]">
        {content}
      </button>
    </div>
  )
}

/** Montant aligné en colonne : chiffres tabulaires obligatoires. */
export function Amount({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode
  tone?: "default" | "muted" | "over" | "accent"
  className?: string
}) {
  const color =
    tone === "muted"
      ? "var(--t-sage)"
      : tone === "over"
        ? "var(--t-clay)"
        : tone === "accent"
          ? "var(--t-brass)"
          : "var(--t-paper)"
  return (
    <span className={cn("tnum shrink-0 font-semibold", className)} style={{ color }}>
      {children}
    </span>
  )
}

/** Écran vide : une invitation à agir, pas un constat. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="font-semibold" style={{ color: "var(--t-paper)" }}>
        {title}
      </p>
      {children ? (
        <p className="mx-auto mt-1.5 max-w-[34ch] text-sm" style={{ color: "var(--t-sage)" }}>
          {children}
        </p>
      ) : null}
    </div>
  )
}
