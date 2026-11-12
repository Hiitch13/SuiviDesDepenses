"use client"

import { useId, useMemo, useState } from "react"

import { useWidth } from "./use-width"
import { type Category, type CategoryDelta, type MonthPoint, type ProjectionPoint, SAVINGS_COLOR } from "@/lib/budget"
import { euros, eurosRound, monthLabel, monthShort, signedEuros } from "@/lib/format"
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
        const isOver = budget !== undefined && over > 0
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
  { key: "saved", label: "Épargne", color: SAVINGS_COLOR },
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
// Projection d'épargne — solde réel puis extrapolé, projets en marches
// =============================================================

/** Pas « rond » (1, 2 ou 5 × 10^n) pour environ `count` intervalles. */
function niceStep(range: number, count: number): number {
  const raw = Math.max(range, 1) / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
}

const K = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })

/** "12,5 k€", "−3 k€", "800 €" : court, pour un axe. */
function compactEuros(v: number): string {
  const sign = v < 0 ? "−" : ""
  const a = Math.abs(v)
  return a >= 1000 ? `${sign}${K.format(a / 1000)} k€` : `${sign}${Math.round(a)} €`
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function ProjectionChart({ points, currentMonth }: { points: ProjectionPoint[]; currentMonth: string }) {
  const clipId = useId()
  const [hover, setHover] = useState<number | null>(null)
  const { ref, width } = useWidth<HTMLDivElement>()

  if (points.length < 2) {
    return (
      <Empty title="Pas encore de projection">
        Note un versement ou recale sur ton solde réel pour voir la courbe se dessiner.
      </Empty>
    )
  }

  const before = (p: ProjectionPoint) => p.solde + p.deducted.reduce((s, d) => s + d.amount, 0)
  const todayIndex = Math.max(
    0,
    points.findIndex((p) => p.month === currentMonth)
  )
  const active = hover ?? todayIndex
  const activePoint = points[active]

  // Une unité SVG = un pixel : le texte des axes garde sa taille réelle.
  const W = Math.max(width, 1)
  const H = 250
  const PAD = { top: 24, right: 54, bottom: 28, left: 8 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const values = points.flatMap((p) => [p.solde, before(p)])
  const step = niceStep(Math.max(...values, 0) - Math.min(...values, 0), 4)
  const yMin = Math.floor(Math.min(...values, 0) / step) * step
  const yMax = Math.ceil(Math.max(...values, 0) / step) * step || step
  const ticks: number[] = []
  for (let t = yMin; t <= yMax + step / 2; t += step) ticks.push(Math.round(t))

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * plotW
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH

  // Sommets du tracé : un projet fait une marche verticale dans son mois, pas
  // une pente vers le mois suivant. Tout ce qui suit le solde réel d'aujourd'hui
  // est une hypothèse, tracée en pointillés.
  const solid: string[] = []
  const dashed: string[] = []
  points.forEach((p, i) => {
    const top = `${x(i)},${y(before(p))}`
    const bottom = `${x(i)},${y(p.solde)}`
    if (i < todayIndex) {
      solid.push(bottom)
    } else if (i === todayIndex) {
      solid.push(top)
      dashed.push(top)
      if (p.deducted.length > 0) dashed.push(bottom)
    } else {
      if (p.deducted.length > 0) dashed.push(top)
      dashed.push(bottom)
    }
  })

  // Repères de dates : chaque janvier (avec l'année) sur une longue période,
  // un mois sur trois sinon.
  const longSpan = points.length > 18
  const xLabels = points
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => (longSpan ? p.month.endsWith("-01") : i % 3 === 0))
    .map(({ p, i }) => ({ i, text: longSpan ? p.month.slice(0, 4) : monthShort(p.month) }))

  const milestones = points
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.deducted.length > 0)

  const zeroY = y(0)
  const todayX = x(todayIndex)
  const activeBefore = before(activePoint)

  return (
    <figure className="m-0">
      {/* Lecture du mois pointé (aujourd'hui par défaut). */}
      <div className="mb-2 min-h-[4.25rem]" aria-live="polite">
        <p className="text-xs" style={{ color: "var(--t-sage)" }}>
          {capitalize(monthLabel(activePoint.month))} ·{" "}
          {active === todayIndex ? "aujourd'hui" : activePoint.projected ? "projection" : "réel"}
        </p>
        <p
          className="tnum text-xl font-semibold"
          style={{ color: activePoint.solde < 0 ? "var(--t-alert)" : "var(--t-paper)" }}
        >
          {euros(active === todayIndex ? activeBefore : activePoint.solde)}
        </p>
        {activePoint.deducted.map((d) => (
          <p key={d.id} className="tnum text-xs" style={{ color: d.feasible ? "var(--t-sage)" : "var(--t-alert)" }}>
            {d.name} −{eurosRound(d.amount)} · {d.feasible ? "finançable" : "hors budget"}
            {active !== todayIndex && ` · solde avant ${eurosRound(activeBefore)}`}
          </p>
        ))}
      </div>

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
            aria-label={`Projection du solde d'épargne de ${monthLabel(points[0].month)} à ${monthLabel(
              points[points.length - 1].month
            )}, ${eurosRound(points[points.length - 1].solde)} à la fin.`}
            onPointerLeave={() => setHover(null)}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const px = ((e.clientX - rect.left) / rect.width) * W
              const i = Math.round(((px - PAD.left) / plotW) * (points.length - 1))
              setHover(Math.max(0, Math.min(points.length - 1, i)))
            }}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={PAD.left - 4} y={PAD.top - 4} width={plotW + 8} height={plotH + 8} />
              </clipPath>
            </defs>

            {/* Sous zéro : une teinte d'alerte, pour que le découvert se voie d'un coup d'œil. */}
            {yMin < 0 ? (
              <rect
                x={PAD.left}
                y={zeroY}
                width={plotW}
                height={PAD.top + plotH - zeroY}
                fill="var(--t-alert)"
                opacity={0.08}
              />
            ) : null}

            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + plotW}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? "var(--t-sage)" : "var(--t-line)"}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left + plotW + 8}
                  y={y(t)}
                  dominantBaseline="middle"
                  fontSize={11}
                  fill={t < 0 ? "var(--t-alert)" : "var(--t-sage)"}
                >
                  {compactEuros(t)}
                </text>
              </g>
            ))}

            {/* Aujourd'hui : la frontière entre le relevé et l'hypothèse. */}
            <line
              x1={todayX}
              x2={todayX}
              y1={PAD.top - 6}
              y2={PAD.top + plotH}
              stroke="var(--t-sage)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={todayX}
              y={PAD.top - 10}
              textAnchor={todayX > PAD.left + plotW - 40 ? "end" : todayX < PAD.left + 40 ? "start" : "middle"}
              fontSize={11}
              fill="var(--t-sage)"
            >
              aujourd'hui
            </text>

            {hover !== null && hover !== todayIndex ? (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--t-paper)"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
            ) : null}

            <g clipPath={`url(#${clipId})`}>
              {solid.length > 1 ? (
                <polyline
                  points={solid.join(" ")}
                  fill="none"
                  stroke="var(--t-brass)"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {dashed.length > 1 ? (
                <polyline
                  points={dashed.join(" ")}
                  fill="none"
                  stroke="var(--t-brass)"
                  strokeWidth={2}
                  strokeDasharray="3 5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.8}
                />
              ) : null}
            </g>

            {/* Point actif */}
            <circle
              cx={x(active)}
              cy={y(active === todayIndex ? activeBefore : activePoint.solde)}
              r={5}
              fill="var(--t-brass)"
              stroke="var(--t-pine)"
              strokeWidth={2}
            />

            {/* Jalons : une pastille numérotée au pied de chaque marche, détaillée sous le graphe. */}
            {milestones.map(({ p, i }, k) => {
              const bad = p.deducted.some((d) => !d.feasible)
              return (
                <g key={p.month}>
                  <circle
                    cx={x(i)}
                    cy={y(p.solde)}
                    r={8}
                    fill={bad ? "var(--t-alert)" : "var(--t-paper)"}
                    stroke="var(--t-pine)"
                    strokeWidth={2}
                  />
                  <text
                    x={x(i)}
                    y={y(p.solde)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={10}
                    fontWeight={700}
                    fill="var(--t-ink)"
                  >
                    {k + 1}
                  </text>
                </g>
              )
            })}

            {xLabels.map(({ i, text }) => (
              <text
                key={i}
                x={x(i)}
                y={H - 8}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                fontSize={11}
                fill="var(--t-sage)"
              >
                {text}
              </text>
            ))}
          </svg>
        )}
      </div>

      <figcaption className="mt-3 space-y-1.5">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" style={{ color: "var(--t-sage)" }}>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: "var(--t-brass)" }} />
            Solde réel
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="w-4 border-t-2 border-dashed" style={{ borderColor: "var(--t-brass)" }} />
            Projection
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: "var(--t-paper)" }} />
            Projet déduit
          </span>
        </div>
        {milestones.length > 0 && (
          <ol className="space-y-1 pt-1">
            {milestones.map(({ p }, k) => (
              <li key={p.month} className="tnum flex gap-2 text-xs">
                <span
                  className="flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: p.deducted.some((d) => !d.feasible) ? "var(--t-alert)" : "var(--t-paper)",
                    color: "var(--t-ink)",
                  }}
                >
                  {k + 1}
                </span>
                <span style={{ color: "var(--t-paper)" }}>
                  {monthShort(p.month)} · {p.deducted.map((d) => `${d.name} −${eurosRound(d.amount)}`).join(", ")}
                  <span style={{ color: p.deducted.some((d) => !d.feasible) ? "var(--t-alert)" : "var(--t-sage)" }}>
                    {" "}
                    · {eurosRound(before(p))} avant, {eurosRound(p.solde)} après
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs" style={{ color: "var(--t-sage)" }}>
          Glisse le doigt sur la courbe pour lire un mois. La projection prolonge le rythme des six derniers mois.
        </p>
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
