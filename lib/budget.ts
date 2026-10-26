// Types du domaine et calculs purs. Aucune dépendance à React : tout ce qui est
// ici se teste en isolation et se réutilise entre les écrans.

export type Expense = {
  id: string
  amount: number
  description: string
  category: string
  date: string
}

export type FixedExpense = {
  id: string
  amount: number
  description: string
  isExceptional?: boolean
}

export type Category = {
  id: string
  name: string
  color: string
}

export type IncomeEntry = {
  id: string
  amount: number
  description: string
}

export type MonthData = {
  user?: string
  month: string
  salary: number
  expenses: Expense[]
  fixedExpenses: FixedExpense[]
  savingsGoal?: number
  extraIncomes?: IncomeEntry[]
}

export type ProjectType = "voyage" | "achat" | "projet"

export type Project = {
  id: string
  name: string
  amount: number
  targetMonth: string
  type: ProjectType
  included: boolean
}

export type AllData = {
  months: MonthData[]
  customCategories?: Category[]
  categoryBudgets?: Record<string, number>
  projects?: Project[]
  initialSavings?: number
  initialSavingsMonth?: string
}

// === Catégories ===
// Ordre figé, validé sur le fond --t-pine : écart minimal ΔE 8,6 en deutéranopie
// et 19,3 en vision normale. Ne pas permuter sans refaire tourner le validateur
// (voir DESIGN.md).
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "alimentation", name: "Alimentation", color: "#d95926" },
  { id: "transport", name: "Transport", color: "#3987e5" },
  { id: "loisirs", name: "Loisirs", color: "#d55181" },
  { id: "restaurant", name: "Restaurant", color: "#c98500" },
  { id: "shopping", name: "Shopping", color: "#9085e9" },
  { id: "sante", name: "Santé", color: "#e66767" },
  { id: "epargne", name: "Épargne", color: "#008300" },
  { id: "autres", name: "Autres", color: "#8a9a94" },
]

// Teintes proposées pour une catégorie créée par l'utilisateur. La première est
// la seule du jeu de référence restée libre ; les suivantes s'en écartent assez
// pour rester distinguables.
export const CUSTOM_CATEGORY_COLORS = [
  "#199e70",
  "#5eb3d6",
  "#b07cc6",
  "#cf7a4f",
  "#7f9c3a",
  "#c76e8e",
]

export const PROJECT_TYPES: Record<ProjectType, { label: string }> = {
  voyage: { label: "Voyage" },
  achat: { label: "Achat" },
  projet: { label: "Projet" },
}

// === Helpers de mois ("YYYY-MM") ===
export function addMonths(ym: string, n: number): string {
  const [y, mo] = ym.split("-").map(Number)
  const d = new Date(y, mo - 1 + n, 1)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`
}

// === Soldes du mois affiché ===
export type MonthTotals = {
  totalExpenses: number
  totalFixed: number
  totalExtraIncome: number
  totalIncome: number
  totalOut: number
  /** Ce qu'il reste à vivre : revenus − (charges fixes + dépenses variables). */
  balance: number
  /** Part des revenus déjà consommée, bornée à 100. */
  spentShare: number
}

export function computeTotals(input: {
  salary: number
  expenses: Expense[]
  fixedExpenses: FixedExpense[]
  extraIncomes: IncomeEntry[]
}): MonthTotals {
  const totalExpenses = input.expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalFixed = input.fixedExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalExtraIncome = input.extraIncomes.reduce((sum, i) => sum + i.amount, 0)
  const totalIncome = input.salary + totalExtraIncome
  const totalOut = totalExpenses + totalFixed
  return {
    totalExpenses,
    totalFixed,
    totalExtraIncome,
    totalIncome,
    totalOut,
    balance: totalIncome - totalOut,
    spentShare: totalIncome > 0 ? Math.min(100, (totalOut / totalIncome) * 100) : 0,
  }
}

export function spendByCategory(expenses: Expense[], categories: Category[]): Record<string, number> {
  const out: Record<string, number> = {}
  categories.forEach((cat) => {
    out[cat.id] = 0
  })
  expenses.forEach((e) => {
    out[e.category] = (out[e.category] || 0) + e.amount
  })
  return out
}

/** L'épargne n'est jamais un dépassement : c'est de l'argent mis de côté, pas dépensé. */
export function overBudgetCategories(
  categories: Category[],
  spend: Record<string, number>,
  budgets: Record<string, number>
) {
  return categories
    .filter((cat) => cat.id !== "epargne" && budgets[cat.id] && spend[cat.id] > budgets[cat.id])
    .map((cat) => ({ ...cat, spent: spend[cat.id], budget: budgets[cat.id] }))
}

/** Jours restants dans le mois, uniquement si le mois affiché est le mois réel en cours. */
export function daysLeftInMonth(month: string, now: Date = new Date()): number | null {
  if (month !== currentMonthKey(now)) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.round((lastDay.getTime() - today.getTime()) / 86400000) + 1
}

export type Pacing = {
  isOver: boolean
  /** Montant par période restante, ou le découvert en valeur absolue. */
  value: number
  days: number
  /** Sous une semaine restante, raisonner « par semaine » n'a plus de sens : on passe au jour. */
  unit: "semaine" | "jour"
}

/** Ce qu'il reste par semaine — ou par jour en fin de mois — pour tenir sans découvert. */
export function weeklyPacing(month: string, balance: number, now: Date = new Date()): Pacing | null {
  const days = daysLeftInMonth(month, now)
  if (days === null) return null
  if (balance < 0) return { isOver: true, value: Math.abs(balance), days, unit: "semaine" }

  if (days <= 7) return { isOver: false, value: balance / Math.max(1, days), days, unit: "jour" }
  const weeks = Math.ceil(days / 7)
  return { isOver: false, value: balance / weeks, days, unit: "semaine" }
}

// === Suggestions de saisie rapide ===
export type Suggestion = { amount: number; description: string; category: string; count: number }

/**
 * Dépenses les plus fréquentes, tous mois confondus. Regroupées par catégorie +
 * description, sans le montant : une dépense récurrente à prix variable (courses,
 * essence) ne doit pas être éclatée en une entrée par montant. Le montant retenu
 * est le plus récent.
 */
export function frequentSuggestions(months: MonthData[], categories: Category[], limit = 3): Suggestion[] {
  const freq = new Map<string, Suggestion & { lastDate: string }>()
  months
    .flatMap((m) => m.expenses)
    .forEach((e) => {
      const key = `${e.category}|${e.description}`
      const existing = freq.get(key)
      if (existing) {
        existing.count += 1
        if (e.date >= existing.lastDate) {
          existing.amount = e.amount
          existing.lastDate = e.date
        }
      } else {
        freq.set(key, {
          amount: e.amount,
          description: e.description,
          category: e.category,
          count: 1,
          lastDate: e.date,
        })
      }
    })
  return Array.from(freq.values())
    .filter((s) => s.count >= 2 && categories.some((c) => c.id === s.category))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// === Évolution dans le temps ===
export type MonthPoint = {
  month: string
  income: number
  fixed: number
  variable: number
  saved: number
  balance: number
}

/** Une ligne par mois enregistré, du plus ancien au plus récent. */
export function monthlyHistory(months: MonthData[]): MonthPoint[] {
  return [...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      const totals = computeTotals({
        salary: m.salary,
        expenses: m.expenses,
        fixedExpenses: m.fixedExpenses,
        extraIncomes: m.extraIncomes ?? [],
      })
      return {
        month: m.month,
        income: totals.totalIncome,
        fixed: totals.totalFixed,
        variable: totals.totalExpenses,
        saved: m.expenses.filter((e) => e.category === "epargne").reduce((s, e) => s + e.amount, 0),
        balance: totals.balance,
      }
    })
}

export type CategoryDelta = {
  category: Category
  current: number
  previous: number
  delta: number
  /** `null` quand le mois précédent est à zéro : une variation en % n'aurait pas de sens. */
  deltaPct: number | null
}

/** Comparaison par catégorie entre le mois affiché et le mois enregistré juste avant. */
export function compareToPreviousMonth(
  months: MonthData[],
  month: string,
  categories: Category[]
): { previousMonth: string | null; rows: CategoryDelta[] } {
  const recorded = months.map((m) => m.month).sort()
  const previousMonth = recorded.filter((m) => m < month).pop() ?? null
  if (!previousMonth) return { previousMonth: null, rows: [] }

  const current = months.find((m) => m.month === month)
  const previous = months.find((m) => m.month === previousMonth)
  const curSpend = spendByCategory(current?.expenses ?? [], categories)
  const prevSpend = spendByCategory(previous?.expenses ?? [], categories)

  const rows = categories
    .map((category) => {
      const cur = curSpend[category.id] || 0
      const prev = prevSpend[category.id] || 0
      return {
        category,
        current: cur,
        previous: prev,
        delta: cur - prev,
        deltaPct: prev > 0 ? ((cur - prev) / prev) * 100 : null,
      }
    })
    .filter((r) => r.current > 0 || r.previous > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  return { previousMonth, rows }
}

// === Projection d'épargne ===
export type ProjectionPoint = { month: string; solde: number; projected: boolean }

export type Projection = {
  points: ProjectionPoint[]
  currentSavings: number
  projectedFinalSavings: number
  hasNegative: boolean
  /** Par id de projet : le solde suffit-il à son échéance ? */
  feasibility: Map<string, boolean>
}

/**
 * Simule le solde d'épargne mois par mois.
 *
 * Le solde de départ est daté du mois où il a été renseigné pour la dernière fois.
 * On ancre la projection à ce mois, avec ce solde, puis on ajoute l'épargne de ce
 * mois-là inclus et de tous les suivants. Seuls les mois strictement futurs sont
 * extrapolés à partir de la moyenne observée ; un mois passé sans donnée vaut 0.
 */
export function buildProjection(input: {
  months: MonthData[]
  projects: Project[]
  initialSavings: number
  initialSavingsMonth: string
  now?: Date
}): Projection {
  const currentMonth = currentMonthKey(input.now ?? new Date())

  const netByMonth = new Map<string, number>()
  input.months.forEach((m) => {
    netByMonth.set(
      m.month,
      m.expenses.filter((e) => e.category === "epargne").reduce((s, e) => s + e.amount, 0)
    )
  })

  const includedProjects = input.projects.filter((p) => p.included)
  const hasStartingBalance = input.initialSavings > 0 && !!input.initialSavingsMonth

  let anchorMonth: string
  let anchorBalance: number
  if (hasStartingBalance) {
    anchorMonth = input.initialSavingsMonth
    anchorBalance = input.initialSavings
  } else {
    const recorded = [...netByMonth.keys()].sort()
    anchorMonth = recorded.length > 0 ? recorded[0] : currentMonth
    anchorBalance = 0
  }

  const observedFromAnchor = [...netByMonth.keys()].filter((mo) => mo >= anchorMonth)
  const avgNet =
    observedFromAnchor.length > 0
      ? observedFromAnchor.reduce((s, mo) => s + (netByMonth.get(mo) as number), 0) / observedFromAnchor.length
      : 0

  const endCandidates = [
    anchorMonth,
    currentMonth,
    ...observedFromAnchor,
    ...includedProjects.map((p) => p.targetMonth).filter((mo) => mo >= currentMonth),
  ].sort()
  const endMonth = endCandidates[endCandidates.length - 1]

  const projectsByMonth = new Map<string, Project[]>()
  includedProjects.forEach((p) => {
    if (p.targetMonth < currentMonth) return
    const arr = projectsByMonth.get(p.targetMonth) || []
    arr.push(p)
    projectsByMonth.set(p.targetMonth, arr)
  })

  const points: ProjectionPoint[] = []
  const feasibility = new Map<string, boolean>()
  let runningBalance = anchorBalance
  let cursor = anchorMonth
  let guard = 0
  while (cursor <= endMonth && guard < 600) {
    const isRecorded = netByMonth.has(cursor)
    const isFuture = cursor > currentMonth
    runningBalance += isRecorded ? (netByMonth.get(cursor) as number) : isFuture ? avgNet : 0

    const due = projectsByMonth.get(cursor) || []
    due.forEach((p) => {
      feasibility.set(p.id, runningBalance >= p.amount)
      runningBalance -= p.amount
    })

    points.push({
      month: cursor,
      solde: Math.round(runningBalance * 100) / 100,
      projected: isFuture && !isRecorded,
    })
    cursor = addMonths(cursor, 1)
    guard++
  }

  const currentPoint = points.find((p) => p.month === currentMonth)
  return {
    points,
    currentSavings: currentPoint ? currentPoint.solde : anchorBalance,
    projectedFinalSavings: points.length > 0 ? points[points.length - 1].solde : anchorBalance,
    hasNegative: points.some((p) => p.solde < 0),
    feasibility,
  }
}

// === Export ===
/** Une ligne par dépense, toutes périodes confondues. Séparateur ';' pour Excel FR. */
export function toCsv(months: MonthData[], categories: Category[]): string {
  const label = (id: string) => categories.find((c) => c.id === id)?.name ?? id
  const escape = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

  const rows = [["mois", "date", "categorie", "description", "montant"]]
  ;[...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .forEach((m) => {
      ;[...m.expenses]
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((e) => {
          rows.push([m.month, e.date, label(e.category), e.description, e.amount.toFixed(2)])
        })
    })

  return rows.map((r) => r.map((cell) => escape(String(cell))).join(";")).join("\r\n")
}
