import { NextResponse } from "next/server"

import { ensureSchema, getDb, getMonth, upsertMonthStatement } from "@/lib/db"
import {
  createAgreement,
  createRequisition,
  getAccountTransactions,
  getRequisition,
  listInstitutions,
  mapTransactionsToExpenses,
} from "@/lib/gocardless"
import { sessionUser } from "@/lib/session"

// === Connexion d'une banque (GoCardless / Open Banking PSD2) ===
//
// PoC d'import des transactions Revolut comme dépenses. Le consentement est
// recueilli côté navigateur via le lien renvoyé par `connect` ; ici on ne fait
// que préparer le flux, lire l'état et transformer les transactions en `Expense`.
//
// Actions (POST, body JSON) :
//   { action: "institutions", country? }        → banques disponibles
//   { action: "connect", institutionId, redirect } → { requisitionId, link }
//   { action: "status", requisitionId }         → état + comptes liés
//   { action: "transactions", accountId, dateFrom?, dateTo? } → { expenses }
//   { action: "import", accountId, month, category?, dateFrom?, dateTo? } → fusionne dans le mois

const UNAUTHORIZED = () => NextResponse.json({ error: "Session expirée" }, { status: 401 })

// L'identifiant Revolut chez GoCardless. Surchargeable via env, au cas où il
// changerait ou pour tester une autre banque.
const DEFAULT_INSTITUTION_ID = process.env.GOCARDLESS_INSTITUTION_ID ?? "REVOLUT_REVOGB21"

function fail(error: unknown) {
  console.error("[API bank]", error)
  const message = error instanceof Error ? error.message : "Erreur inconnue"
  return NextResponse.json({ error: message }, { status: 502 })
}

export async function POST(request: Request) {
  try {
    const user = sessionUser(request)
    if (!user) return UNAUTHORIZED()

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action ?? "")

    // --- Liste des banques ---
    if (action === "institutions") {
      const country = typeof body.country === "string" && body.country ? body.country : "FR"
      return NextResponse.json({ institutions: await listInstitutions(country) })
    }

    // --- Démarrer un consentement ---
    if (action === "connect") {
      const institutionId =
        (typeof body.institutionId === "string" && body.institutionId.trim()) || DEFAULT_INSTITUTION_ID
      const redirect =
        (typeof body.redirect === "string" && body.redirect.trim()) ||
        process.env.GOCARDLESS_REDIRECT_URI ||
        new URL(request.url).origin

      const agreement = await createAgreement(institutionId)
      const requisition = await createRequisition(agreement.id, institutionId, redirect)
      return NextResponse.json({ requisitionId: requisition.id, link: requisition.link })
    }

    // --- État du consentement ---
    if (action === "status") {
      const requisitionId = String(body.requisitionId ?? "")
      if (!requisitionId) return NextResponse.json({ error: "requisitionId requis" }, { status: 400 })
      const requisition = await getRequisition(requisitionId)
      return NextResponse.json(requisition)
    }

    // --- Transactions transformées en dépenses ---
    if (action === "transactions") {
      const accountId = String(body.accountId ?? "")
      if (!accountId) return NextResponse.json({ error: "accountId requis" }, { status: 400 })

      const transactions = await getAccountTransactions(accountId, {
        dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : undefined,
        dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined,
      })
      const category = typeof body.category === "string" ? body.category : "autres"
      return NextResponse.json({
        count: transactions.length,
        expenses: mapTransactionsToExpenses(transactions, { category }),
      })
    }

    // --- Importer directement dans un mois existant ---
    if (action === "import") {
      const accountId = String(body.accountId ?? "")
      const month = String(body.month ?? "")
      if (!accountId || !month) {
        return NextResponse.json({ error: "accountId et month requis" }, { status: 400 })
      }

      await ensureSchema()
      const existing = await getMonth(user, month)
      if (!existing) {
        return NextResponse.json(
          { error: "Ce mois n'existe pas encore. Ouvre-le d'abord dans l'app." },
          { status: 404 }
        )
      }

      const transactions = await getAccountTransactions(accountId, {
        dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : `${month}-01`,
        dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined,
      })
      const imported = mapTransactionsToExpenses(transactions, {
        category: typeof body.category === "string" ? body.category : "autres",
      })

      // Fusion sans doublon : on n'ajoute que les ids jamais vus.
      const known = new Set(existing.expenses.map((e) => e.id))
      const fresh = imported.filter((e) => !known.has(e.id))
      if (fresh.length === 0) {
        return NextResponse.json({ imported: 0, skipped: imported.length })
      }

      const merged = { ...existing, expenses: [...existing.expenses, ...fresh] }
      await getDb().batch([upsertMonthStatement(merged)], "write")

      return NextResponse.json({ imported: fresh.length, skipped: imported.length - fresh.length })
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
  } catch (error) {
    return fail(error)
  }
}
