"use client"

import { type ReactNode, useState } from "react"
import { ChevronDown, Plus } from "lucide-react"

import { ProjectionChart } from "@/components/thrift/charts"
import { Amount, Empty, Panel, Row, SectionTitle } from "@/components/thrift/ui"
import { type Projection, type SavingsMonth, type SavingsMove, moveDelta } from "@/lib/budget"
import { dayLabel, euros, eurosRound, monthLabel, signedEuros } from "@/lib/format"

const KIND_LABEL: Record<SavingsMove["kind"], string> = {
  versement: "Versement",
  retrait: "Retrait",
  ajustement: "Recalage",
}

/**
 * L'écran Épargne : le solde réel d'abord, puis d'où il vient mois par mois,
 * puis seulement la projection. Les projets sont rendus par la page (enfants).
 */
export function SavingsScreen({
  history,
  projection,
  currentMonth,
  onAddMove,
  onEditMove,
  onRecalibrate,
  children,
}: {
  /** Synthèse mensuelle, du plus ancien au plus récent. */
  history: SavingsMonth[]
  projection: Projection
  currentMonth: string
  onAddMove: (month: string) => void
  onEditMove: (move: SavingsMove) => void
  onRecalibrate: () => void
  children?: ReactNode
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set([currentMonth]))
  const toggle = (m: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })

  const thisMonth = history.find((h) => h.month === currentMonth)
  const rows = [...history].reverse()

  // La liste entière se replie : sur une longue histoire elle repousse la
  // projection loin sous le pli.
  const [listOpen, setListOpen] = useState(true)
  const allOpen = rows.length > 0 && rows.every((r) => open.has(r.month))
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(rows.map((r) => r.month)))

  return (
    <div className="space-y-4 px-4 pt-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
      <div className="space-y-4">
      <Panel>
        <SectionTitle>Épargne</SectionTitle>
        <p className="figure-hero text-[clamp(2.5rem,12vw,3.75rem)]" style={{ color: "var(--t-brass)" }}>
          {euros(projection.currentSavings)}
        </p>
        <p className="tnum mt-2 text-sm" style={{ color: "var(--t-sage)" }}>
          Ce mois : +{euros(thisMonth?.deposited ?? 0)} versé · −{euros(thisMonth?.withdrawn ?? 0)} retiré
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAddMove(currentMonth)}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
          >
            <Plus className="size-4" />
            Mouvement
          </button>
          <button
            type="button"
            onClick={onRecalibrate}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: "var(--t-moss)", color: "var(--t-paper)" }}
          >
            Recaler sur mon solde réel
          </button>
        </div>
      </Panel>

      <Panel flush>
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="-mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 text-left"
          >
            <h2 className="text-[0.95rem] font-semibold" style={{ color: "var(--t-paper)" }}>
              Mois par mois
            </h2>
            <span className="text-xs" style={{ color: "var(--t-sage)" }}>
              {rows.length} mois
            </span>
            <ChevronDown
              className="size-4 shrink-0 transition-transform"
              style={{ color: "var(--t-sage)", transform: listOpen ? "rotate(180deg)" : undefined }}
              aria-hidden
            />
          </button>
          {listOpen && rows.length > 1 && (
            <button
              type="button"
              onClick={toggleAll}
              className="shrink-0 text-xs font-semibold"
              style={{ color: "var(--t-brass)" }}
            >
              {allOpen ? "Tout replier" : "Tout déplier"}
            </button>
          )}
        </div>
        {!listOpen ? null : rows.length === 0 ? (
          <Empty title="Rien de mis de côté pour l'instant">
            Note un versement, ou recale sur ton solde réel si tu as déjà de l'épargne.
          </Empty>
        ) : (
          rows.map((r) => (
            <MonthBlock
              key={r.month}
              row={r}
              isOpen={open.has(r.month)}
              onToggle={() => toggle(r.month)}
              onAdd={() => onAddMove(r.month)}
              onEdit={onEditMove}
            />
          ))
        )}
      </Panel>
      </div>

      <div className="space-y-4">
      <Panel>
        <SectionTitle aside={`rythme ${signedEuros(projection.monthlyPace)} / mois`}>Projection</SectionTitle>
        <ProjectionChart points={projection.points} currentMonth={currentMonth} />
        {projection.hasNegative && (
          <p className="mt-3 text-sm" style={{ color: "var(--t-alert)" }}>
            En l'état, le solde passe sous zéro avant la fin de la projection. Décale un projet ou augmente l'épargne
            mensuelle.
          </p>
        )}
        {projection.points.length > 1 && (
          <p className="mt-2 text-xs" style={{ color: "var(--t-sage)" }}>
            Fin de projection : {eurosRound(projection.projectedFinalSavings)}, projets inclus déduits.
          </p>
        )}
      </Panel>

      {children}
      </div>
    </div>
  )
}

function MonthBlock({
  row,
  isOpen,
  onToggle,
  onAdd,
  onEdit,
}: {
  row: SavingsMonth
  isOpen: boolean
  onToggle: () => void
  onAdd: () => void
  onEdit: (move: SavingsMove) => void
}) {
  const empty = row.moves.length === 0
  return (
    <div className="border-t" style={{ borderColor: "var(--t-line)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm capitalize" style={{ color: "var(--t-paper)" }}>
            {monthLabel(row.month)}
          </span>
          <span className="tnum text-xs" style={{ color: "var(--t-sage)" }}>
            {empty
              ? "Rien versé"
              : [
                  row.deposited > 0 ? `+${euros(row.deposited)}` : null,
                  row.withdrawn > 0 ? `−${euros(row.withdrawn)}` : null,
                  row.adjusted !== 0 ? `recalage ${signedEuros(row.adjusted)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </span>
        <Amount tone={empty ? "muted" : "default"}>{euros(row.balance)}</Amount>
        <ChevronDown
          className="size-4 shrink-0 transition-transform"
          style={{ color: "var(--t-sage)", transform: isOpen ? "rotate(180deg)" : undefined }}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div className="pb-2" style={{ backgroundColor: "var(--t-ink)" }}>
          {row.moves.map((m) => (
            <Row key={m.id} onClick={() => onEdit(m)} className="py-2.5 pl-6">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm" style={{ color: "var(--t-paper)" }}>
                  {m.note || KIND_LABEL[m.kind]}
                </span>
                <span className="text-xs" style={{ color: "var(--t-sage)" }}>
                  {dayLabel(m.date)} · {KIND_LABEL[m.kind]}
                </span>
              </span>
              <Amount tone={m.kind === "versement" ? "accent" : "default"}>{signedEuros(moveDelta(m))}</Amount>
            </Row>
          ))}
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold"
            style={{ color: "var(--t-brass)" }}
          >
            <Plus className="size-4" />
            Mouvement en {monthLabel(row.month)}
          </button>
        </div>
      )}
    </div>
  )
}
