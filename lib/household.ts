// Le foyer : un espace partagé entre plusieurs comptes, à côté du budget
// personnel de chacun. Ce fichier ne contient que des types et des calculs
// purs — l'accès à la base vit dans lib/db.ts.

import type { FixedExpense } from "./budget"

export type HouseholdRole = "proprietaire" | "membre"

export type Household = {
  id: string
  name: string
  members: { username: string; role: HouseholdRole }[]
}

/** Une dépense du foyer : comme une dépense perso, mais on sait qui a payé. */
export type SharedExpense = {
  id: string
  amount: number
  description: string
  category: string
  date: string
  paidBy: string
}

export type SharedFixedExpense = FixedExpense & { paidBy: string }

export type HouseholdMonth = {
  householdId: string
  month: string
  expenses: SharedExpense[]
  fixedExpenses: SharedFixedExpense[]
}

export type Invite = {
  householdId: string
  householdName: string
  username: string
  invitedBy: string
}

// =============================================================
// Partage des dépenses
// =============================================================

export type MemberBalance = {
  username: string
  /** Ce que cette personne a sorti de sa poche. */
  paid: number
  /** Sa part des dépenses du foyer. */
  share: number
  /** Positif : on lui doit. Négatif : elle doit. */
  balance: number
}

export type Transfer = { from: string; to: string; amount: number }

export type Settlement = {
  total: number
  balances: MemberBalance[]
  /** Qui rembourse qui, et combien. Liste minimale. */
  transfers: Transfer[]
}

/** Arrondi au centime, pour que les sommes retombent juste. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Qui a payé quoi, qui doit combien.
 *
 * Les dépenses du foyer sont partagées à parts égales entre ses membres. Celui
 * qui a avancé plus que sa part est créditeur, les autres lui doivent la
 * différence. Les virements apparient le plus gros débiteur au plus gros
 * créditeur, ce qui donne le moins de remboursements possible.
 *
 * Tout le calcul se fait en centimes entiers. En euros, arrondir la part et
 * les montants chacun de son côté laisse les soldes ne plus s'annuler : à deux
 * sur 20,01 €, chacun doit 10,005 €, et selon l'arrondi la dette totale ne
 * correspond plus à la créance totale. Quand la division ne tombe pas juste,
 * les centimes restants sont attribués aux premiers membres, dans l'ordre : la
 * répartition est donc toujours exacte au centime près, et reproductible.
 */
export function settle(month: HouseholdMonth, members: string[]): Settlement {
  const cents = (value: number) => Math.round(value * 100)

  const lines = [
    ...month.expenses.map((e) => ({ paidBy: e.paidBy, amount: cents(e.amount) })),
    ...month.fixedExpenses.map((f) => ({ paidBy: f.paidBy, amount: cents(f.amount) })),
  ]

  const totalCents = lines.reduce((s, l) => s + l.amount, 0)
  const total = totalCents / 100

  if (members.length === 0) {
    return { total, balances: [], transfers: [] }
  }

  const paidByMember = new Map<string, number>(members.map((m) => [m, 0]))
  lines.forEach((l) => {
    // Une dépense payée par quelqu'un qui a quitté le foyer compte dans le
    // total, mais n'est créditée à personne.
    if (paidByMember.has(l.paidBy)) {
      paidByMember.set(l.paidBy, (paidByMember.get(l.paidBy) as number) + l.amount)
    }
  })

  const base = Math.floor(totalCents / members.length)
  const remainder = totalCents - base * members.length

  const balances: MemberBalance[] = members.map((username, index) => {
    const paidCents = paidByMember.get(username) as number
    const shareCents = base + (index < remainder ? 1 : 0)
    return {
      username,
      paid: paidCents / 100,
      share: shareCents / 100,
      balance: (paidCents - shareCents) / 100,
    }
  })

  // Appariement glouton débiteurs ↔ créditeurs, toujours en centiemes.
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ username: b.username, left: cents(b.balance) }))
    .sort((a, b) => b.left - a.left || a.username.localeCompare(b.username))
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ username: b.username, left: -cents(b.balance) }))
    .sort((a, b) => b.left - a.left || a.username.localeCompare(b.username))

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left)
    if (amount > 0) {
      transfers.push({ from: debtors[i].username, to: creditors[j].username, amount: amount / 100 })
    }
    debtors[i].left -= amount
    creditors[j].left -= amount
    if (debtors[i].left === 0) i++
    if (creditors[j].left === 0) j++
  }

  return { total, balances, transfers }
}

/** Total des dépenses du foyer sur un mois, charges fixes comprises. */
export function householdTotal(month: HouseholdMonth): number {
  return round(
    month.expenses.reduce((s, e) => s + e.amount, 0) +
      month.fixedExpenses.reduce((s, f) => s + f.amount, 0)
  )
}

/** Ce qu'un membre a sorti de sa poche pour le foyer sur un mois, charges fixes comprises. */
export function paidByMember(month: HouseholdMonth | null, username: string): number {
  if (!month) return 0
  return round(
    month.expenses.filter((e) => e.paidBy === username).reduce((s, e) => s + e.amount, 0) +
      month.fixedExpenses.filter((f) => f.paidBy === username).reduce((s, f) => s + f.amount, 0)
  )
}

/** Répartition par catégorie, pour les barres classées. */
export function sharedSpendByCategory(month: HouseholdMonth): Record<string, number> {
  const out: Record<string, number> = {}
  month.expenses.forEach((e) => {
    out[e.category] = round((out[e.category] || 0) + e.amount)
  })
  return out
}

/** Identifiant court et lisible, suffisant pour distinguer quelques foyers. */
export function newHouseholdId(now: number = Date.now()): string {
  return `${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, "0")}`
}
