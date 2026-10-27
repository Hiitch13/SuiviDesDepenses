import { NextResponse } from "next/server"

import {
  type Category,
  type MonthData,
  type Project,
  deleteMonth,
  ensureSchema,
  getDb,
  getGlobalDefaultFixedExpenses,
  getMonth,
  getUser,
  getUserMonths,
  updateInitialSavings,
  updatePayDay,
  updateUserField,
  upsertMonthStatement,
} from "@/lib/db"
import { sessionUser } from "@/lib/session"

function storageError(error: unknown) {
  console.error("[API expenses]", error)
  return NextResponse.json(
    { error: "Le service de stockage ne répond pas. Réessaye dans quelques instants." },
    { status: 503 }
  )
}

const UNAUTHORIZED = () => NextResponse.json({ error: "Session expirée" }, { status: 401 })

/**
 * À qui appartient la requête.
 *
 * Le pseudo vient exclusivement du cookie de session signé, jamais de l'URL ni
 * du corps : c'est ce qui empêche de lire ou d'écrire le compte d'autrui en
 * changeant un paramètre.
 */
function requireUser(request: Request): string | null {
  return sessionUser(request)
}

// === GET : les mois de l'utilisateur, ou un mois précis ===
export async function GET(request: Request) {
  try {
    const user = requireUser(request)
    if (!user) return UNAUTHORIZED()

    await ensureSchema()
    const record = await getUser(user)
    if (!record) return UNAUTHORIZED()

    const monthParam = new URL(request.url).searchParams.get("month")
    if (monthParam) {
      const found = await getMonth(user, monthParam)
      if (!found) return NextResponse.json({ error: "Mois introuvable" }, { status: 404 })
      return NextResponse.json(found)
    }

    return NextResponse.json({
      months: await getUserMonths(user),
      customCategories: record.customCategories,
      categoryBudgets: record.categoryBudgets,
      projects: record.projects,
      initialSavings: record.initialSavings,
      initialSavingsMonth: record.initialSavingsMonth,
      payDay: record.payDay,
    })
  } catch (error) {
    return storageError(error)
  }
}

// === POST : préférences du compte, ou sauvegarde d'un mois ===
export async function POST(request: Request) {
  try {
    const user = requireUser(request)
    if (!user) return UNAUTHORIZED()

    await ensureSchema()
    if (!(await getUser(user))) return UNAUTHORIZED()

    const body = await request.json()

    if (body.isCategoryUpdate) {
      await updateUserField(user, "custom_categories", body.customCategories as Category[])
      return NextResponse.json({ success: true })
    }

    if (body.isBudgetUpdate) {
      await updateUserField(user, "category_budgets", body.categoryBudgets as Record<string, number>)
      return NextResponse.json({ success: true })
    }

    if (body.isProjectUpdate) {
      const { projects, initialSavings, initialSavingsMonth } = body as {
        projects?: Project[]
        initialSavings?: number
        initialSavingsMonth?: string
      }
      if (Array.isArray(projects)) {
        await updateUserField(user, "projects", projects)
      }
      await updateInitialSavings(
        user,
        typeof initialSavings === "number" ? initialSavings : undefined,
        typeof initialSavingsMonth === "string" ? initialSavingsMonth : undefined
      )
      return NextResponse.json({ success: true })
    }

    if (body.isPayDayUpdate) {
      const payDay = Number(body.payDay)
      if (!Number.isInteger(payDay) || payDay < 0 || payDay > 31) {
        return NextResponse.json({ error: "Jour de paie invalide" }, { status: 400 })
      }
      await updatePayDay(user, payDay)
      return NextResponse.json({ success: true })
    }

    // --- Sauvegarde / création d'un mois ---
    // Le propriétaire est imposé par la session, quoi que le corps contienne.
    const monthData = { ...(body as MonthData), user }
    if (!monthData.month) {
      return NextResponse.json({ error: "Mois requis" }, { status: 400 })
    }

    const record = await getUser(user)
    const statements = []

    if (monthData.fixedExpenses && monthData.fixedExpenses.length > 0) {
      // Un mois sauvegardé avec des charges fixes met à jour les défauts du
      // compte, en ne gardant que les charges récurrentes.
      const recurring = monthData.fixedExpenses.filter((fx) => !fx.isExceptional)
      statements.push({
        sql: "UPDATE users SET default_fixed_expenses = ? WHERE username = ?",
        args: [JSON.stringify(recurring), user],
      })
    } else {
      // Création : on pré-remplit avec les défauts du compte, sinon les globaux.
      monthData.fixedExpenses =
        record && record.defaultFixedExpenses.length > 0
          ? [...record.defaultFixedExpenses]
          : await getGlobalDefaultFixedExpenses()
    }

    statements.push(upsertMonthStatement(monthData))
    await getDb().batch(statements, "write")

    return NextResponse.json({ success: true })
  } catch (error) {
    return storageError(error)
  }
}

// === DELETE : supprimer un mois ===
export async function DELETE(request: Request) {
  try {
    const user = requireUser(request)
    if (!user) return UNAUTHORIZED()

    const month = new URL(request.url).searchParams.get("month")
    if (!month) return NextResponse.json({ error: "Mois requis" }, { status: 400 })

    await ensureSchema()
    const deleted = await deleteMonth(user, month)
    if (!deleted) return NextResponse.json({ error: "Introuvable" }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return storageError(error)
  }
}
