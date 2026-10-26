// Client pour l'API « Bank Account Data » de GoCardless (ex-Nordigen).
//
// Revolut n'expose pas d'API aux comptes personnels : seule une banque agréée
// (TPP, prestataire tiers sous PSD2) peut lire ces données. GoCardless joue ce
// rôle, et son API en lecture seule nous laisse récupérer les transactions d'un
// compte pour les importer comme dépenses. Aucune écriture, aucun virement.
//
// Cycle complet : accord d'accès (agreement) → lien de consentement ouvert dans
// le navigateur (requisition) → liste des comptes → transactions.
//
// Prérequis : GOCARDLESS_SECRET_ID et GOCARDLESS_SECRET_KEY (compte GoCardless).

import type { Expense } from "./budget"

export const GOCARDLESS_BASE = "https://bankaccountdata.gocardless.com/api/v2"

// === Types de l'API (réduits à ce dont on a besoin) ===

export type AccessToken = {
  access: string
  accessExpires: number // timestamp UNIX en secondes
  refresh: string
  refreshExpires: number
}

export type Institution = {
  id: string
  name: string
  bic?: string
  countries?: string[]
}

export type Agreement = {
  id: string
  institutionId: string
  maxHistoricalDays: number
  accessValidForDays: number
}

export type Requisition = {
  id: string
  status: string
  link: string
  accounts: string[]
  institutionId: string
}

export type Account = {
  id: string
  iban?: string
  name?: string
  ownerName?: string
  currency?: string
}

/** Une transaction déjà normalisée (montant en nombre, libellé aplati). */
export type BankTransaction = {
  transactionId: string
  /** "YYYY-MM-DD" */
  date: string
  /** Signé : négatif = argent qui sort. */
  amount: number
  currency: string
  description: string
}

// === Configuration ===

function credentials(): { secretId: string; secretKey: string } {
  const secretId = process.env.GOCARDLESS_SECRET_ID
  const secretKey = process.env.GOCARDLESS_SECRET_KEY
  if (!secretId || !secretKey) {
    throw new Error("GOCARDLESS_SECRET_ID et GOCARDLESS_SECRET_KEY sont requis")
  }
  return { secretId, secretKey }
}

// === Jeton d'accès ===

let cachedToken: AccessToken | null = null

async function getAccessToken(): Promise<string> {
  // On garde une marge d'une minute pour ne jamais utiliser un jeton expiré.
  if (cachedToken && cachedToken.accessExpires > Date.now() / 1000 + 60) {
    return cachedToken.access
  }

  const { secretId, secretKey } = credentials()
  const res = await fetch(`${GOCARDLESS_BASE}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  })
  if (!res.ok) throw new Error(`GoCardless : échec du jeton (${res.status})`)

  const data = (await res.json()) as {
    access: string
    access_expires: number
    refresh: string
    refresh_expires: number
  }
  cachedToken = {
    access: data.access,
    accessExpires: Date.now() / 1000 + data.access_expires,
    refresh: data.refresh,
    refreshExpires: Date.now() / 1000 + data.refresh_expires,
  }
  return cachedToken.access
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${GOCARDLESS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`GoCardless ${path} : ${res.status} ${body.slice(0, 300)}`)
  }
  return (await res.json()) as T
}

// === Endpoints ===

/** Les banques disponibles pour un pays (ex. "FR"). */
export async function listInstitutions(country = "FR"): Promise<Institution[]> {
  const data = await request<Institution[]>(`/institutions/?country=${encodeURIComponent(country.toLowerCase())}`)
  return data
}

/** Crée l'accord d'accès, qui fixe la portée (lecture seule) et la durée. */
export async function createAgreement(
  institutionId: string,
  options: { maxHistoricalDays?: number; accessValidForDays?: number } = {}
): Promise<Agreement> {
  const body = {
    institution_id: institutionId,
    max_historical_days: options.maxHistoricalDays ?? 90,
    access_valid_for_days: options.accessValidForDays ?? 90,
    access_scope: ["balances", "details", "transactions"],
  }
  const data = await request<{
    id: string
    institution_id: string
    max_historical_days: number
    access_valid_for_days: number
  }>("/agreements/enduser/", { method: "POST", body: JSON.stringify(body) })
  return {
    id: data.id,
    institutionId: data.institution_id,
    maxHistoricalDays: data.max_historical_days,
    accessValidForDays: data.access_valid_for_days,
  }
}

/**
 * Prépare la demande de consentement. `link` est l'URL à ouvrir pour que
 * l'utilisateur s'authentifie auprès de sa banque et autorise la lecture.
 */
export async function createRequisition(
  agreementId: string,
  institutionId: string,
  redirect: string
): Promise<Requisition> {
  const body = {
    redirect,
    institution_id: institutionId,
    agreement: agreementId,
    user_language: "FR",
  }
  const data = await request<{
    id: string
    status: string
    link: string
    accounts: string[]
    institution_id: string
  }>("/requisitions/", { method: "POST", body: JSON.stringify(body) })
  return {
    id: data.id,
    status: data.status,
    link: data.link,
    accounts: data.accounts ?? [],
    institutionId: data.institution_id,
  }
}

/** Relit l'état du consentement. `accounts` se remplit une fois le lien validé. */
export async function getRequisition(id: string): Promise<Requisition> {
  const data = await request<{
    id: string
    status: string
    link: string
    accounts: string[]
    institution_id: string
  }>(`/requisitions/${encodeURIComponent(id)}/`)
  return {
    id: data.id,
    status: data.status,
    link: data.link,
    accounts: data.accounts ?? [],
    institutionId: data.institution_id,
  }
}

// === Transactions ===

type RawTransaction = {
  transactionId?: string
  bookingDate?: string
  valueDate?: string
  transactionAmount?: { amount?: string | number; currency?: string }
  remittanceInformationUnstructured?: string
  remittanceInformationUnstructuredArray?: string[]
  remittanceInformationStructured?: string
}

function normalizeTransaction(raw: RawTransaction): BankTransaction | null {
  const rawAmount = raw.transactionAmount?.amount
  if (raw.transactionId == null || rawAmount == null) return null

  const amount = typeof rawAmount === "number" ? rawAmount : parseFloat(rawAmount)
  if (Number.isNaN(amount)) return null

  const description = (
    raw.remittanceInformationUnstructuredArray?.join(" ") ??
    raw.remittanceInformationUnstructured ??
    raw.remittanceInformationStructured ??
    ""
  ).trim()

  return {
    transactionId: raw.transactionId,
    date: (raw.valueDate ?? raw.bookingDate ?? "").slice(0, 10),
    amount,
    currency: raw.transactionAmount?.currency ?? "EUR",
    description,
  }
}

/**
 * Les transactions réservées d'un compte. Seules les opérations « booked » sont
 * importées : les opérations en attente (pending) changent encore de montant.
 */
export async function getAccountTransactions(
  accountId: string,
  options: { dateFrom?: string; dateTo?: string } = {}
): Promise<BankTransaction[]> {
  const params = new URLSearchParams()
  if (options.dateFrom) params.set("date_from", options.dateFrom)
  if (options.dateTo) params.set("date_to", options.dateTo)

  const qs = params.toString()
  const data = await request<{
    transactions?: { booked?: RawTransaction[]; pending?: RawTransaction[] }
  }>(`/accounts/${encodeURIComponent(accountId)}/transactions/${qs ? `?${qs}` : ""}`)

  return (data.transactions?.booked ?? [])
    .map(normalizeTransaction)
    .filter((t): t is BankTransaction => t !== null)
}

// === Conversion vers le modèle de l'app ===

/**
 * Transforme des transactions bancaires en dépenses (`Expense`).
 *
 * On ne garde que l'argent qui sort (montant négatif), en valeur absolue. Le
 * libellé de la banque devient la description ; la catégorie est « autres » par
 * défaut, à reclasser ensuite dans l'app. L'id est préfixé `gc-` pour ne jamais
 * entrer en collision avec ceux générés à la main et pour dédoublonner à l'import.
 */
export function mapTransactionsToExpenses(
  transactions: BankTransaction[],
  options: { category?: string } = {}
): Expense[] {
  const category = options.category ?? "autres"
  return transactions
    .filter((t) => t.amount < 0)
    .map((t) => ({
      id: `gc-${t.transactionId}`,
      amount: Math.round(Math.abs(t.amount) * 100) / 100,
      description: t.description || "Transaction",
      category,
      date: t.date,
    }))
}
