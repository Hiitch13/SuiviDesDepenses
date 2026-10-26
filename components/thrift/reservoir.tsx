"use client"

import { useEffect, useState } from "react"
import { euros, eurosRound } from "@/lib/format"

type Props = {
  /** Ce qu'il reste à vivre. Peut être négatif. */
  balance: number
  /** Salaire + revenus supplémentaires. */
  income: number
  /** Jours restants dans le mois, ou null si le mois affiché n'est pas le mois en cours. */
  daysLeft: number | null
}

/**
 * Le geste central de l'app : le mois est un réservoir qui se vide.
 *
 * Le remplissage monte depuis le bas à hauteur de ce qu'il reste ; le vide
 * au-dessus, c'est ce qui est déjà parti. Le chiffre est écrit deux fois, chaque
 * copie découpée sur la ligne de remplissage — en papier sur le fond sombre, en
 * encre sur le laiton — pour rester lisible quelle que soit la hauteur.
 */
export function Reservoir({ balance, income, daysLeft }: Props) {
  const isOver = balance < 0
  const ratio = income > 0 ? Math.max(0, Math.min(1, balance / income)) : 0

  // Le remplissage monte une fois au montage : le seul mouvement non sollicité
  // de l'app. Neutralisé par la règle « mouvement réduit » dans globals.css.
  const [filled, setFilled] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const level = filled ? ratio * 100 : 0

  // La couleur du remplissage porte la sévérité. Les trois teintes sont assez
  // claires pour que le chiffre, écrit en encre par-dessus, reste au-delà de
  // 6:1 — c'est justement quand la marge fond qu'il doit rester lisible.
  const fill = isOver || ratio < 0.12 ? "var(--t-alert)" : ratio < 0.25 ? "#d98a3c" : "var(--t-brass)"

  const content = (
    <div className="flex h-full flex-col justify-end px-5 pb-7 pt-16 sm:px-8 sm:pb-9">
      <p className="text-sm font-medium opacity-75">
        {isOver ? "tu es à découvert de" : "il te reste"}
      </p>
      <p className="figure-hero mt-1 text-[clamp(3.25rem,16vw,5.5rem)]">
        {euros(Math.abs(balance))}
      </p>
      <p className="mt-3 text-sm opacity-75">
        {isOver
          ? `au-delà de ${eurosRound(income)} de revenus`
          : `sur ${eurosRound(income)} de revenus`}
        {daysLeft !== null && ` · ${daysLeft} jour${daysLeft > 1 ? "s" : ""} avant la fin du mois`}
      </p>
    </div>
  )

  return (
    <section
      className="relative isolate min-h-[19rem] overflow-hidden sm:min-h-[22rem]"
      style={{ backgroundColor: "var(--t-pine)" }}
    >
      {/* Le niveau. Seul élément décoratif de l'app, et il porte une donnée. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 motion-safe:transition-[height] motion-safe:ease-out motion-safe:[transition-duration:900ms]"
        style={{ height: `${level}%`, backgroundColor: fill }}
      />

      {/* Copie claire, découpée au-dessus de la ligne de remplissage. */}
      <div
        aria-hidden
        className="absolute inset-0 motion-safe:transition-[clip-path] motion-safe:ease-out motion-safe:[transition-duration:900ms]"
        style={{ clipPath: `inset(0 0 ${level}% 0)`, color: "var(--t-paper)" }}
      >
        {content}
      </div>

      {/* Copie sombre, découpée à l'intérieur du remplissage. */}
      <div
        aria-hidden
        className="absolute inset-0 motion-safe:transition-[clip-path] motion-safe:ease-out motion-safe:[transition-duration:900ms]"
        style={{ clipPath: `inset(${100 - level}% 0 0 0)`, color: "var(--t-ink)" }}
      >
        {content}
      </div>

      {/* Les deux copies sont décoratives : seule celle-ci est lue à voix haute. */}
      <div className="sr-only">
        {isOver
          ? `Tu es à découvert de ${euros(Math.abs(balance))} sur ${eurosRound(income)} de revenus.`
          : `Il te reste ${euros(balance)} sur ${eurosRound(income)} de revenus.`}
        {daysLeft !== null && ` ${daysLeft} jours avant la fin du mois.`}
      </div>
    </section>
  )
}
