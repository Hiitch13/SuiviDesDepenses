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

/**
 * Un mouvement sur le pot d'épargne. Versement et retrait portent un montant
 * positif ; un ajustement (recalage sur le solde réel) est signé : c'est l'écart
 * constaté. Le mois se déduit de la date.
 */
export type SavingsMoveKind = "versement" | "retrait" | "ajustement"

export type SavingsMove = {
  id: string
  kind: SavingsMoveKind
  amount: number
  /** "YYYY-MM-DD" */
  date: string
  note: string
}

export type AllData = {
  months: MonthData[]
  customCategories?: Category[]
  categoryBudgets?: Record<string, number>
  projects?: Project[]
  savingsMoves?: SavingsMove[]
  /** Jour du mois où tombe la paie (1-31). 0 = fin du mois (comportement par défaut). */
  payDay?: number
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
  { id: "autres", name: "Autres", color: "#97a5a0" },
]

/** Teinte de l'épargne (graphiques, barre d'objectif) : l'ancienne catégorie « Épargne ». */
export const SAVINGS_COLOR = "#008300"

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

/** Dernier jour d'un mois "YYYY-MM", au format ISO. */
export function lastDayOf(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  return `${ym}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`
}

/**
 * Date proposée pour une dépense saisie dans un mois donné : aujourd'hui si
 * l'on est bien dans ce mois, sinon son dernier jour. Une dépense ne doit
 * jamais porter une date hors du mois qui la contient.
 */
export function defaultDateFor(ym: string, now: Date = new Date()): string {
  if (!ym) return now.toISOString().split("T")[0]
  if (ym === currentMonthKey(now)) {
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    return local.toISOString().split("T")[0]
  }
  return lastDayOf(ym)
}

// === Soldes du mois affiché ===
export type MonthTotals = {
  totalExpenses: number
  totalFixed: number
  totalExtraIncome: number
  totalIncome: number
  /** Ce que l'on a payé soi-même pour le foyer ce mois-ci. */
  totalShared: number
  totalOut: number
  /** Épargne nette du mois : versements − retraits. Négative si l'on a plus pioché que versé. */
  savingsNet: number
  /**
   * Ce qu'il reste à vivre : revenus − (charges fixes + dépenses variables +
   * dépenses payées pour le foyer + épargne nette).
   */
  balance: number
  /** Part des revenus déjà consommée ou mise de côté, bornée à 100. */
  spentShare: number
}

export function computeTotals(input: {
  salary: number
  expenses: Expense[]
  fixedExpenses: FixedExpense[]
  extraIncomes: IncomeEntry[]
  /** Dépenses du foyer payées de sa poche : elles sortent du même compte. */
  sharedPaid?: number
  savings?: SavingsFlow
}): MonthTotals {
  const totalExpenses = input.expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalFixed = input.fixedExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalExtraIncome = input.extraIncomes.reduce((sum, i) => sum + i.amount, 0)
  const totalIncome = input.salary + totalExtraIncome
  const totalShared = input.sharedPaid ?? 0
  const totalOut = totalExpenses + totalFixed + totalShared
  const savingsNet = input.savings?.net ?? 0
  const consumed = totalOut + savingsNet
  return {
    totalExpenses,
    totalFixed,
    totalExtraIncome,
    totalIncome,
    totalShared,
    totalOut,
    savingsNet,
    balance: totalIncome - consumed,
    spentShare: totalIncome > 0 ? Math.min(100, Math.max(0, (consumed / totalIncome) * 100)) : 0,
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

export function overBudgetCategories(
  categories: Category[],
  spend: Record<string, number>,
  budgets: Record<string, number>
) {
  return categories
    .filter((cat) => budgets[cat.id] && spend[cat.id] > budgets[cat.id])
    .map((cat) => ({ ...cat, spent: spend[cat.id], budget: budgets[cat.id] }))
}

/** Jours restants dans le mois, uniquement si le mois affiché est le mois réel en cours. */
export function daysLeftInMonth(month: string, now: Date = new Date()): number | null {
  if (month !== currentMonthKey(now)) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return Math.round((lastDay.getTime() - today.getTime()) / 86400000) + 1
}

/**
 * Jours restants jusqu'au prochain jour de paie, aujourd'hui inclus.
 *
 * Le jour de paie est ramené au dernier jour du mois s'il le dépasse (un « 31 »
 * en février devient le 28/29). S'il est passé ou tombe aujourd'hui (la paie est
 * alors reçue), on compte jusqu'à la paie du mois suivant : c'est la date à
 * laquelle l'argent doit suffire.
 */
export function daysUntilPayday(payDay: number, now: Date = new Date()): number {
  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const thisMonthDay = Math.min(payDay, daysInMonth(now.getFullYear(), now.getMonth()))
  let target = new Date(now.getFullYear(), now.getMonth(), thisMonthDay)
  if (target <= today) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const nextMonthDay = Math.min(payDay, daysInMonth(next.getFullYear(), next.getMonth()))
    target = new Date(next.getFullYear(), next.getMonth(), nextMonthDay)
  }
  return Math.round((target.getTime() - today.getTime()) / 86400000) + 1
}

/**
 * Jours restants pour le mois affiché : jusqu'au prochain jour de paie s'il est
 * renseigné, sinon jusqu'à la fin du mois. Null si le mois affiché n'est pas le
 * mois en cours (le rythme n'a de sens qu'« aujourd'hui »).
 */
export function daysRemaining(month: string, payDay?: number | null, now: Date = new Date()): number | null {
  if (month !== currentMonthKey(now)) return null
  if (payDay && payDay >= 1 && payDay <= 31) return daysUntilPayday(payDay, now)
  return daysLeftInMonth(month, now)
}

export type Pacing = {
  isOver: boolean
  /** Montant par période restante, ou le découvert en valeur absolue. */
  value: number
  days: number
  /** Sous une semaine restante, raisonner « par semaine » n'a plus de sens : on passe au jour. */
  unit: "semaine" | "jour"
}

/** Ce qu'il reste par semaine — ou par jour en fin de période — pour tenir sans découvert. */
export function weeklyPacing(
  month: string,
  balance: number,
  now: Date = new Date(),
  payDay?: number | null
): Pacing | null {
  const days = daysRemaining(month, payDay, now)
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
export function monthlyHistory(months: MonthData[], moves: SavingsMove[] = []): MonthPoint[] {
  return [...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      const savings = savingsFlow(moves, m.month)
      const totals = computeTotals({
        salary: m.salary,
        expenses: m.expenses,
        fixedExpenses: m.fixedExpenses,
        extraIncomes: m.extraIncomes ?? [],
        savings,
      })
      return {
        month: m.month,
        income: totals.totalIncome,
        fixed: totals.totalFixed,
        variable: totals.totalExpenses,
        saved: savings.net,
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

// === Épargne : mouvements, solde, historique ===
const round2 = (n: number) => Math.round(n * 100) / 100

export const monthOf = (date: string) => date.slice(0, 7)

/** Effet d'un mouvement sur le solde. */
export function moveDelta(m: SavingsMove): number {
  if (m.kind === "versement") return m.amount
  if (m.kind === "retrait") return -m.amount
  return m.amount
}

export type SavingsFlow = { deposited: number; withdrawn: number; net: number }

/**
 * Ce qui a été versé et retiré dans un mois. Les ajustements n'en font pas
 * partie : ils corrigent le compte, ils ne sortent ni n'entrent dans le budget.
 */
export function savingsFlow(moves: SavingsMove[], month: string): SavingsFlow {
  let deposited = 0
  let withdrawn = 0
  moves.forEach((m) => {
    if (monthOf(m.date) !== month) return
    if (m.kind === "versement") deposited += m.amount
    else if (m.kind === "retrait") withdrawn += m.amount
  })
  return { deposited: round2(deposited), withdrawn: round2(withdrawn), net: round2(deposited - withdrawn) }
}

/** Solde du pot à la fin d'un mois : tous les mouvements jusque-là, ajustements compris. */
export function savingsBalanceAt(moves: SavingsMove[], month: string): number {
  return round2(moves.filter((m) => monthOf(m.date) <= month).reduce((s, m) => s + moveDelta(m), 0))
}

export type SavingsMonth = SavingsFlow & {
  month: string
  /** Somme des ajustements du mois, signée. */
  adjusted: number
  /** Solde en fin de mois. */
  balance: number
  /** Mouvements du mois, triés par date. */
  moves: SavingsMove[]
}

/**
 * Une ligne par mois, du premier mouvement jusqu'à `upTo` (ou jusqu'au dernier
 * mouvement s'il est daté plus tard). Les mois sans mouvement figurent à zéro :
 * un trou dans l'épargne doit se voir.
 */
export function savingsHistory(moves: SavingsMove[], upTo: string): SavingsMonth[] {
  if (moves.length === 0) return []
  const months = moves.map((m) => monthOf(m.date)).sort()
  const first = months[0]
  const last = months[months.length - 1] > upTo ? months[months.length - 1] : upTo

  const rows: SavingsMonth[] = []
  let balance = 0
  for (let cursor = first, guard = 0; cursor <= last && guard < 1200; cursor = addMonths(cursor, 1), guard++) {
    const inMonth = moves.filter((m) => monthOf(m.date) === cursor).sort((a, b) => a.date.localeCompare(b.date))
    const flow = savingsFlow(inMonth, cursor)
    const adjusted = round2(inMonth.filter((m) => m.kind === "ajustement").reduce((s, m) => s + m.amount, 0))
    balance = round2(balance + flow.net + adjusted)
    rows.push({ month: cursor, ...flow, adjusted, balance, moves: inMonth })
  }
  return rows
}

/**
 * Recalage : « fin <mois>, mon solde réel est de X ». Renvoie l'ajustement à
 * ajouter pour que le solde calculé égale X, daté du dernier jour du mois, ou
 * null s'il n'y a pas d'écart.
 */
export function recalibration(
  moves: SavingsMove[],
  month: string,
  realBalance: number,
  id: string = `adj-${Date.now()}`
): SavingsMove | null {
  const gap = round2(realBalance - savingsBalanceAt(moves, month))
  if (gap === 0) return null
  return { id, kind: "ajustement", amount: gap, date: lastDayOf(month), note: "Recalage" }
}

// === Projection d'épargne ===
export type ProjectionPoint = { month: string; solde: number; projected: boolean }

export type Projection = {
  points: ProjectionPoint[]
  /** Solde réel à la fin du mois en cours, sans aucun projet déduit. */
  currentSavings: number
  projectedFinalSavings: number
  hasNegative: boolean
  /** Par id de projet : le solde suffit-il à son échéance ? */
  feasibility: Map<string, boolean>
  /** Épargne nette mensuelle retenue pour extrapoler. */
  monthlyPace: number
}

/** Nombre de mois complets sur lesquels on mesure le rythme d'épargne. */
const PACE_WINDOW = 6

/**
 * Simule le solde d'épargne mois par mois.
 *
 * Jusqu'au mois en cours, la courbe suit le solde réel. Au-delà, chaque mois
 * sans mouvement saisi ajoute le rythme moyen (versements − retraits) des six
 * derniers mois complets — à partir du premier mouvement, les mois vides comptant
 * zéro. Les projets inclus sont déduits à leur échéance.
 */
export function buildProjection(input: { moves: SavingsMove[]; projects: Project[]; now?: Date }): Projection {
  const currentMonth = currentMonthKey(input.now ?? new Date())
  const { moves } = input
  const history = savingsHistory(moves, currentMonth)
  const firstMonth = history.length > 0 && history[0].month < currentMonth ? history[0].month : currentMonth

  const windowStart = [addMonths(currentMonth, -PACE_WINDOW), firstMonth].sort()[1]
  const windowMonths: string[] = []
  for (let m = windowStart; m < currentMonth; m = addMonths(m, 1)) windowMonths.push(m)
  const paceMonths = windowMonths.length > 0 ? windowMonths : [currentMonth]
  const monthlyPace = round2(paceMonths.reduce((s, m) => s + savingsFlow(moves, m).net, 0) / paceMonths.length)

  const includedProjects = input.projects.filter((p) => p.included && p.targetMonth >= currentMonth)
  const projectsByMonth = new Map<string, Project[]>()
  includedProjects.forEach((p) => {
    const arr = projectsByMonth.get(p.targetMonth) || []
    arr.push(p)
    projectsByMonth.set(p.targetMonth, arr)
  })

  const lastRecorded = history.length > 0 ? history[history.length - 1].month : currentMonth
  const endMonth = [currentMonth, lastRecorded, ...includedProjects.map((p) => p.targetMonth)].sort().pop() as string
  const byMonth = new Map(history.map((h) => [h.month, h]))

  const points: ProjectionPoint[] = []
  const feasibility = new Map<string, boolean>()
  let running = 0
  for (let cursor = firstMonth, guard = 0; cursor <= endMonth && guard < 1200; cursor = addMonths(cursor, 1), guard++) {
    const row = byMonth.get(cursor)
    const hasMoves = !!row && row.moves.length > 0
    const isFuture = cursor > currentMonth
    if (hasMoves) running += row.net + row.adjusted
    else if (isFuture) running += monthlyPace

    ;(projectsByMonth.get(cursor) || []).forEach((p) => {
      feasibility.set(p.id, running >= p.amount)
      running -= p.amount
    })

    points.push({ month: cursor, solde: round2(running), projected: isFuture && !hasMoves })
  }

  return {
    points,
    currentSavings: savingsBalanceAt(moves, currentMonth),
    projectedFinalSavings: points.length > 0 ? points[points.length - 1].solde : 0,
    hasNegative: points.some((p) => p.solde < 0),
    feasibility,
    monthlyPace,
  }
}

// === Migration de l'ancienne épargne ===
/**
 * Convertit l'ancien modèle — épargne saisie comme dépense de catégorie
 * « epargne », plus un solde de départ ancré sur un mois — en mouvements.
 *
 * L'ancien calcul ignorait l'épargne saisie avant le mois du solde de départ
 * (elle y était déjà comptée). L'ajustement de départ vaut donc ce solde moins
 * ce qui a été versé avant : le solde au début du mois de référence reste celui
 * que l'utilisateur avait saisi, sans effacer l'historique antérieur.
 */
export function migrateLegacySavings(input: {
  months: MonthData[]
  initialSavings: number
  initialSavingsMonth: string
}): { moves: SavingsMove[]; months: MonthData[]; changedMonths: string[] } {
  const moves: SavingsMove[] = []
  const changedMonths: string[] = []

  const months = input.months.map((m) => {
    const legacy = m.expenses.filter((e) => e.category === "epargne")
    if (legacy.length === 0) return m
    changedMonths.push(m.month)
    legacy.forEach((e) => {
      if (e.amount === 0) return
      moves.push({
        id: e.id,
        kind: e.amount > 0 ? "versement" : "retrait",
        amount: Math.abs(e.amount),
        date: monthOf(e.date) === m.month ? e.date : lastDayOf(m.month),
        note: e.description,
      })
    })
    return { ...m, expenses: m.expenses.filter((e) => e.category !== "epargne") }
  })

  if (input.initialSavings > 0 && input.initialSavingsMonth) {
    const before = moves
      .filter((mv) => monthOf(mv.date) < input.initialSavingsMonth)
      .reduce((s, mv) => s + moveDelta(mv), 0)
    const amount = round2(input.initialSavings - before)
    if (amount !== 0) {
      moves.push({
        id: "migration-solde-depart",
        kind: "ajustement",
        amount,
        date: `${input.initialSavingsMonth}-01`,
        note: "Solde de départ",
      })
    }
  }

  moves.sort((a, b) => a.date.localeCompare(b.date))
  changedMonths.sort()
  return { moves, months, changedMonths }
}

// === Export ===
/** Bornes incluses, au format "YYYY-MM". Une borne absente ne filtre pas. */
export type ExportRange = { from?: string; to?: string }

const MOVE_LABELS: Record<SavingsMoveKind, string> = {
  versement: "Versement",
  retrait: "Retrait",
  ajustement: "Recalage",
}

/**
 * Pour chaque mois de la période : ses revenus, ses charges fixes (sans date :
 * elles valent pour tout le mois), ses dépenses variables, puis ses mouvements
 * d'épargne (montant signé). Le fichier se termine par les totaux de la
 * période, pour ne rien avoir à recalculer dans le tableur. Séparateur ';'
 * pour Excel FR.
 */
export function toCsv(
  months: MonthData[],
  categories: Category[],
  range: ExportRange = {},
  moves: SavingsMove[] = []
): string {
  const label = (id: string) => categories.find((c) => c.id === id)?.name ?? id
  const escape = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const money = (v: number) => v.toFixed(2)
  const inRange = (ym: string) => (!range.from || ym >= range.from) && (!range.to || ym <= range.to)

  const byMonth = new Map(months.filter((m) => inRange(m.month)).map((m) => [m.month, m]))
  const movesInRange = moves.filter((mv) => inRange(monthOf(mv.date)))
  // Un mouvement peut tomber dans un mois jamais ouvert : il a quand même sa place.
  const keys = [...new Set([...byMonth.keys(), ...movesInRange.map((mv) => monthOf(mv.date))])].sort()

  let income = 0
  let fixed = 0
  let variable = 0
  let saved = 0
  const rows = [["mois", "date", "type", "categorie", "description", "montant"]]
  keys.forEach((key) => {
    const m = byMonth.get(key)
    if (m) {
      if (m.salary > 0) rows.push([m.month, "", "Revenu", "", "Salaire", money(m.salary)])
      ;(m.extraIncomes ?? []).forEach((i) => {
        rows.push([m.month, "", "Revenu", "", i.description, money(i.amount)])
      })
      m.fixedExpenses.forEach((f) => {
        rows.push([m.month, "", "Charge fixe", "", f.description, money(f.amount)])
      })
      ;[...m.expenses]
        .sort((a, b) => a.date.localeCompare(b.date))
        .forEach((e) => {
          rows.push([m.month, e.date, "Dépense", label(e.category), e.description, money(e.amount)])
        })

      const totals = computeTotals({
        salary: m.salary,
        expenses: m.expenses,
        fixedExpenses: m.fixedExpenses,
        extraIncomes: m.extraIncomes ?? [],
      })
      income += totals.totalIncome
      fixed += totals.totalFixed
      variable += totals.totalExpenses
    }

    movesInRange
      .filter((mv) => monthOf(mv.date) === key)
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((mv) => {
        rows.push([key, mv.date, "Épargne", MOVE_LABELS[mv.kind], mv.note, money(moveDelta(mv))])
      })
    saved += savingsFlow(movesInRange, key).net
  })
  saved = round2(saved)

  rows.push(
    [],
    ["", "", "Total", "", "Revenus", money(income)],
    ["", "", "Total", "", "Charges fixes", money(fixed)],
    ["", "", "Total", "", "Dépenses variables", money(variable)],
    ["", "", "Total", "", "Dépenses (fixes + variables)", money(fixed + variable)],
    ["", "", "Total", "", "Solde (revenus − dépenses)", money(income - fixed - variable)],
    ["", "", "Total", "", "Épargne nette (versements − retraits)", money(saved)],
    ["", "", "Total", "", "Reste (solde − épargne nette)", money(income - fixed - variable - saved)]
  )

  return rows.map((r) => r.map((cell) => escape(String(cell))).join(";")).join("\r\n")
}
