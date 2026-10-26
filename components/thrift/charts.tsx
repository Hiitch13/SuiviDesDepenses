"use client"

import { useId, useMemo, useState } from "react"

import { useWidth } from "./use-width"
import type { Category, CategoryDelta, MonthPoint } from "@/lib/budget"
import { euros, eurosRound, monthShort, signedEuros } from "@/lib/format"
import { Empty } from "./ui"

// =============================================================
// Où part l'argent — barres classées, avec repère de budget
// =============================================================
// Comparer des catégories entre elles est un travail de barres, pas d'anneau :
// l'œil compare mal des angles, et un anneau ne peut pas porter le budget.

type CategoryBarsProps = {
  rows: { category: Category; spent: number; budget?: number }[]
  onSelect?: (categoryId: string) => void
}

export function CategoryBars({ rows, onSelect }: CategoryBarsProps) {
  const shown = rows.filter((r) => r.spent > 0 || r.budget).sort((a, b) => b.spent - a.spent)

  // Échelle partagée par toutes les lignes, sinon les longueurs ne se comparent pas.
  // La marge de 6 % garde le repère de budget visible quand il est au maximum,
  // au lieu de le coller au bord où il serait rogné.
  const scale = Math.max(...shown.map((r) => Math.max(r.spent, r.budget ?? 0)), 1) * 1.06

  if (shown.length === 0) {
    return <Empty title="Rien de noté ce mois-ci">Ajoute une dépense et la répartition apparaîtra ici.</Empty>
  }

  return (
    <ul className="space-y-3.5">
      {shown.map(({ category, spent, budget }) => {
        const over = budget ? spent - budget : 0
        const isOver = budget !== undefined && category.id !== "epargne" && over > 0
        const Wrapper = onSelect ? "button" : "div"

        return (
          <li key={category.id}>
            <Wrapper
              {...(onSelect ? { type: "button" as const, onClick: () => onSelect(category.id) } : {})}
              className="block w-full rounded-lg text-left"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="truncate text-sm" style={{ color: "var(--t-paper)" }}>
                    {category.name}
                  </span>
                </span>
                <span className="tnum shrink-0 text-sm font-semibold" style={{ color: "var(--t-paper)" }}>
                  {euros(spent)}
                </span>
              </div>

              <div
                className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-[3px]"
                style={{ backgroundColor: "var(--t-moss)" }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-r-[4px]"
                  style={{ width: `${(spent / scale) * 100}%`, backgroundColor: category.color }}
                />
                {budget ? (
                  // Repère de budget : un filet, pas une seconde barre.
                  <div
                    aria-hidden
                    className="absolute inset-y-0 w-0.5"
                    style={{ left: `${(budget / scale) * 100}%`, backgroundColor: "var(--t-paper)" }}
                  />
                ) : null}
              </div>

              {budget ? (
                <p className="mt-1 text-xs" style={{ color: isOver ? "var(--t-alert)" : "var(--t-sage)" }}>
                  {isOver ? `Dépassé de ${euros(over)} — budget ${eurosRound(budget)}` : `Budget ${eurosRound(budget)}`}
                </p>
              ) : null}
            </Wrapper>
          </li>
        )
      })}
    </ul>
  )
}

// =============================================================
// Évolution — une ligne par mois enregistré
// =============================================================

type Series = { key: keyof MonthPoint & string; label: string; color: string }

const SERIES: Series[] = [
  { key: "variable", label: "Dépenses variables", color: "#d95926" },
  { key: "fixed", label: "Charges fixes", color: "#3987e5" },
  { key: "saved", label: "Épargne", color: "#008300" },
]

export function EvolutionChart({ history }: { history: MonthPoint[] }) {
  const clipId = useId()
  const [hover, setHover] = useState<number | null>(null)
  const { ref, width } = useWidth<HTMLDivElement>()

  if (history.length < 2) {
    return (
      <Empty title="Pas encore de quoi tracer une courbe">
        Il faut au moins deux mois enregistrés pour voir une évolution.
      </Empty>
    )
  }

  // Une unité SVG = un pixel : le texte des axes garde sa taille réelle.
  const W = Math.max(width, 1)
  const H = 220
  const PAD = { top: 16, right: 56, bottom: 28, left: 8 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const max = Math.max(...history.flatMap((p) => SERIES.map((s) => p[s.key] as number)), 1)
  const niceMax = Math.ceil(max / 500) * 500 || 500

  const x = (i: number) => PAD.left + (history.length === 1 ? plotW / 2 : (i / (history.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (v / niceMax) * plotH

  const ticks = [0, niceMax / 2, niceMax]
  const active = hover ?? history.length - 1

  // Un label d'axe sur deux quand les mois s'accumulent, pour éviter le chevauchement.
  const labelEvery = Math.ceil(history.length / 6)

  return (
    <figure className="m-0">
      <div className="relative" ref={ref}>
        {width === 0 ? (
          <div style={{ height: H }} />
        ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block touch-none"
          role="img"
          aria-label="Évolution des dépenses, des charges fixes et de l'épargne mois par mois."
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const px = ((e.clientX - rect.left) / rect.width) * W
            const i = Math.round(((px - PAD.left) / plotW) * (history.length - 1))
            setHover(Math.max(0, Math.min(history.length - 1, i)))
          }}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top - 8} width={plotW} height={plotH + 8} />
            </clipPath>
          </defs>

          {/* Repères horizontaux, filets pleins et discrets. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--t-line)"
                strokeWidth={1}
              />
              <text
                x={PAD.left + plotW + 8}
                y={y(t)}
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--t-sage)"
              >
                {t >= 1000 ? `${Math.round(t / 1000)}k` : t}
              </text>
            </g>
          ))}

          {/* Mois survolé */}
          {hover !== null ? (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top - 8}
              y2={PAD.top + plotH}
              stroke="var(--t-sage)"
              strokeWidth={1}
            />
          ) : null}

          <g clipPath={`url(#${clipId})`}>
            {SERIES.map((s) => (
              <polyline
                key={s.key}
                points={history.map((p, i) => `${x(i)},${y(p[s.key] as number)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* Point final de chaque série : anneau dans la couleur du fond pour
              rester lisible quand deux séries se croisent. */}
          {SERIES.map((s) => (
            <circle
              key={s.key}
              cx={x(active)}
              cy={y(history[active][s.key] as number)}
              r={4.5}
              fill={s.color}
              stroke="var(--t-pine)"
              strokeWidth={2}
            />
          ))}

          {history.map((p, i) =>
            i % labelEvery === 0 || i === history.length - 1 ? (
              <text
                key={p.month}
                x={x(i)}
                y={H - 8}
                textAnchor={i === history.length - 1 ? "end" : i === 0 ? "start" : "middle"}
                fontSize={11}
                fill="var(--t-sage)"
              >
                {monthShort(p.month)}
              </text>
            ) : null
          )}
        </svg>
        )}
      </div>

      <figcaption className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--t-sage)" }}>
              <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
        <p className="tnum text-xs" style={{ color: "var(--t-paper)" }}>
          {monthShort(history[active].month)} ·{" "}
          {SERIES.map((s, i) => (
            <span key={s.key}>
              {i > 0 && "  "}
              {s.label.toLowerCase()} {eurosRound(history[active][s.key] as number)}
            </span>
          ))}
        </p>
      </figcaption>
    </figure>
  )
}

// =============================================================
// Projection d'épargne — une seule série, enregistré puis extrapolé
// =============================================================

export function ProjectionChart({
  points,
  currentMonth,
}: {
  points: { month: string; solde: number; projected: boolean }[]
  currentMonth: string
}) {
  const { ref, width } = useWidth<HTMLDivElement>()

  if (points.length < 2) {
    return (
      <Empty title="Pas encore de projection">
        Renseigne un solde de départ et note ton épargne pour voir la courbe se dessiner.
      </Empty>
    )
  }

  const W = Math.max(width, 1)
  const H = 200
  const PAD = { top: 18, right: 56, bottom: 26, left: 8 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const values = points.map((p) => p.solde)
  const rawMax = Math.max(...values, 0)
  const rawMin = Math.min(...values, 0)
  const span = rawMax - rawMin || 1

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * plotW
  const y = (v: number) => PAD.top + plotH - ((v - rawMin) / span) * plotH

  // La partie extrapolée est tracée en pointillés : c'est une hypothèse, pas un relevé.
  const splitIndex = Math.max(0, points.findIndex((p) => p.projected))
  const recorded = splitIndex === -1 ? points : points.slice(0, splitIndex + 1)
  const forecast = splitIndex === -1 ? [] : points.slice(splitIndex === 0 ? 0 : splitIndex)

  const last = points[points.length - 1]
  const zeroY = y(0)
  const showZero = rawMin < 0

  return (
    <figure className="m-0">
      <div ref={ref}>
        {width === 0 ? (
          <div style={{ height: H }} />
        ) : (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="block"
        role="img"
        aria-label={`Projection du solde d'épargne, de ${points[0].month} à ${last.month}.`}
      >
        {showZero ? (
          <line x1={PAD.left} x2={PAD.left + plotW} y1={zeroY} y2={zeroY} stroke="var(--t-alert)" strokeWidth={1} />
        ) : null}

        <polyline
          points={recorded.map((p, i) => `${x(i)},${y(p.solde)}`).join(" ")}
          fill="none"
          stroke="var(--t-brass)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {forecast.length > 1 ? (
          <polyline
            points={forecast
              .map((p) => `${x(points.indexOf(p))},${y(p.solde)}`)
              .join(" ")}
            fill="none"
            stroke="var(--t-brass)"
            strokeWidth={2}
            strokeDasharray="2 5"
            strokeLinecap="round"
            opacity={0.75}
          />
        ) : null}

        <circle
          cx={x(points.length - 1)}
          cy={y(last.solde)}
          r={4.5}
          fill="var(--t-brass)"
          stroke="var(--t-pine)"
          strokeWidth={2}
        />
        <text
          x={x(points.length - 1) + 9}
          y={y(last.solde)}
          dominantBaseline="middle"
          fontSize={11}
          fill="var(--t-paper)"
        >
          {eurosRound(last.solde)}
        </text>

        <text x={PAD.left} y={H - 6} fontSize={11} fill="var(--t-sage)">
          {monthShort(points[0].month)}
        </text>
        <text x={PAD.left + plotW} y={H - 6} textAnchor="end" fontSize={11} fill="var(--t-sage)">
          {monthShort(last.month)}
        </text>
      </svg>
        )}
      </div>

      <figcaption className="mt-2 text-xs" style={{ color: "var(--t-sage)" }}>
        Trait plein : épargne enregistrée jusqu'à {monthShort(currentMonth)}. Pointillés : projection au rythme moyen
        observé, projets inclus déduits à leur échéance.
      </figcaption>
    </figure>
  )
}

// =============================================================
// Comparaison avec le mois précédent
// =============================================================

export function ComparisonList({ rows }: { rows: CategoryDelta[] }) {
  const shown = useMemo(() => rows.slice(0, 6), [rows])
  const widest = Math.max(...shown.map((r) => Math.abs(r.delta)), 1)

  if (shown.length === 0) {
    return <Empty title="Rien à comparer">Aucune dépense sur l'un des deux mois.</Empty>
  }

  return (
    <ul className="space-y-3">
      {shown.map((r) => {
        const up = r.delta > 0
        const width = (Math.abs(r.delta) / widest) * 50 // 50 % de part et d'autre de l'axe
        return (
          <li key={r.category.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: r.category.color }}
                />
                <span className="truncate text-sm" style={{ color: "var(--t-paper)" }}>
                  {r.category.name}
                </span>
              </span>
              <span className="tnum shrink-0 text-sm font-semibold" style={{ color: "var(--t-paper)" }}>
                {signedEuros(r.delta)}
                {r.deltaPct !== null && (
                  <span className="ml-1.5 font-normal" style={{ color: "var(--t-sage)" }}>
                    {r.deltaPct > 0 ? "+" : "−"}
                    {Math.abs(Math.round(r.deltaPct))} %
                  </span>
                )}
              </span>
            </div>

            {/* Axe central : à droite on a dépensé plus, à gauche moins. */}
            <div className="relative mt-1.5 h-2.5 w-full rounded-[3px]" style={{ backgroundColor: "var(--t-moss)" }}>
              <div
                aria-hidden
                className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
                style={{ backgroundColor: "var(--t-line)" }}
              />
              <div
                className={up ? "absolute inset-y-0 left-1/2 rounded-r-[4px]" : "absolute inset-y-0 right-1/2 rounded-l-[4px]"}
                style={{ width: `${width}%`, backgroundColor: r.category.color }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
