import { NextResponse } from "next/server"

import {
  acceptInvite,
  createHousehold,
  declineInvite,
  ensureSchema,
  getHouseholdForUser,
  getHouseholdMonth,
  getHouseholdMonths,
  getInvitesFor,
  getPendingInvites,
  getUser,
  inviteToHousehold,
  leaveHousehold,
  renameHousehold,
  saveHouseholdMonth,
} from "@/lib/db"
import type { HouseholdMonth, SharedExpense, SharedFixedExpense } from "@/lib/household"
import { sessionUser } from "@/lib/session"

function storageError(error: unknown) {
  console.error("[API household]", error)
  return NextResponse.json(
    { error: "Le service de stockage ne répond pas. Réessaye dans quelques instants." },
    { status: 503 }
  )
}

const UNAUTHORIZED = () => NextResponse.json({ error: "Session expirée" }, { status: 401 })

/**
 * L'état du foyer pour la personne connectée : son foyer s'il en a un, les
 * invitations qu'il a reçues, et les mois partagés.
 */
export async function GET(request: Request) {
  try {
    const user = sessionUser(request)
    if (!user) return UNAUTHORIZED()

    await ensureSchema()
    const household = await getHouseholdForUser(user)
    const invites = await getInvitesFor(user)

    if (!household) {
      return NextResponse.json({ household: null, invites, months: [], pendingInvites: [] })
    }

    const monthParam = new URL(request.url).searchParams.get("month")
    if (monthParam) {
      const found = await getHouseholdMonth(household.id, monthParam)
      return NextResponse.json({
        household,
        invites,
        pendingInvites: await getPendingInvites(household.id),
        month: found ?? { householdId: household.id, month: monthParam, expenses: [], fixedExpenses: [] },
      })
    }

    return NextResponse.json({
      household,
      invites,
      pendingInvites: await getPendingInvites(household.id),
      months: await getHouseholdMonths(household.id),
    })
  } catch (error) {
    return storageError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = sessionUser(request)
    if (!user) return UNAUTHORIZED()

    await ensureSchema()
    const body = await request.json()
    const household = await getHouseholdForUser(user)

    // --- Créer un foyer ---
    if (body.action === "create") {
      if (household) {
        return NextResponse.json({ error: "Tu fais déjà partie d'un foyer" }, { status: 409 })
      }
      const name = String(body.name ?? "").trim()
      if (!name) return NextResponse.json({ error: "Donne un nom au foyer" }, { status: 400 })

      const id = await createHousehold(name, user)
      return NextResponse.json({ success: true, householdId: id })
    }

    // --- Accepter ou refuser une invitation ---
    if (body.action === "accept" || body.action === "decline") {
      const householdId = String(body.householdId ?? "")
      const invites = await getInvitesFor(user)
      // On ne peut accepter qu'une invitation qui nous est réellement adressée.
      if (!invites.some((i) => i.householdId === householdId)) {
        return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 })
      }

      if (body.action === "decline") {
        await declineInvite(householdId, user)
        return NextResponse.json({ success: true })
      }

      if (household) {
        return NextResponse.json({ error: "Quitte d'abord ton foyer actuel" }, { status: 409 })
      }
      await acceptInvite(householdId, user)
      return NextResponse.json({ success: true })
    }

    // --- Les actions suivantes demandent d'être membre ---
    if (!household) return NextResponse.json({ error: "Tu n'as pas encore de foyer" }, { status: 404 })

    if (body.action === "invite") {
      const invited = String(body.username ?? "").trim()
      if (!invited) return NextResponse.json({ error: "Indique un pseudo" }, { status: 400 })
      if (invited === user) return NextResponse.json({ error: "Tu en fais déjà partie" }, { status: 400 })
      if (household.members.some((m) => m.username === invited)) {
        return NextResponse.json({ error: `${invited} est déjà dans le foyer` }, { status: 409 })
      }
      // Le compte doit exister : sinon l'invitation attendrait quelqu'un qui
      // n'arrivera peut-être jamais, sans que personne ne le sache.
      if (!(await getUser(invited))) {
        return NextResponse.json({ error: `Aucun compte au pseudo « ${invited} »` }, { status: 404 })
      }

      await inviteToHousehold(household.id, invited, user)
      return NextResponse.json({ success: true })
    }

    if (body.action === "cancelInvite") {
      await declineInvite(household.id, String(body.username ?? ""))
      return NextResponse.json({ success: true })
    }

    if (body.action === "rename") {
      const name = String(body.name ?? "").trim()
      if (!name) return NextResponse.json({ error: "Donne un nom au foyer" }, { status: 400 })
      await renameHousehold(household.id, name)
      return NextResponse.json({ success: true })
    }

    if (body.action === "leave") {
      await leaveHousehold(household.id, user)
      return NextResponse.json({ success: true })
    }

    // --- Sauvegarder un mois partagé ---
    if (body.action === "saveMonth") {
      const month = String(body.month ?? "")
      if (!month) return NextResponse.json({ error: "Mois requis" }, { status: 400 })

      const members = household.members.map((m) => m.username)
      // Qui a payé est imposé côté serveur : on n'accepte que des membres.
      const expenses = (body.expenses as SharedExpense[] | undefined)?.filter((e) =>
        members.includes(e.paidBy)
      )
      const fixedExpenses = (body.fixedExpenses as SharedFixedExpense[] | undefined)?.filter((f) =>
        members.includes(f.paidBy)
      )

      const data: HouseholdMonth = {
        householdId: household.id,
        month,
        expenses: expenses ?? [],
        fixedExpenses: fixedExpenses ?? [],
      }
      await saveHouseholdMonth(data)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 })
  } catch (error) {
    return storageError(error)
  }
}
