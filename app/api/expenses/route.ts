import { NextResponse } from "next/server";
import {
  type Category,
  type MonthData,
  type Project,
  createUser,
  deleteMonth,
  ensureSchema,
  getDb,
  getGlobalDefaultFixedExpenses,
  getMonth,
  getUser,
  getUserMonths,
  updateInitialSavings,
  updateUserField,
  upsertMonthStatement,
} from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

function errorResponse(error: unknown) {
  console.error("[API expenses]", error);
  return NextResponse.json(
    { error: "Le service de stockage ne répond pas. Réessayez dans quelques instants." },
    { status: 503 }
  );
}

// === GET (Récupérer les mois d'un user) ===
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const userParam = searchParams.get("user");

    if (!userParam) {
      return NextResponse.json({ error: "Utilisateur requis" }, { status: 400 });
    }

    await ensureSchema();
    const user = await getUser(userParam);
    if (!user) {
      return NextResponse.json({ error: "Utilisateur inconnu" }, { status: 404 });
    }

    if (monthParam) {
      const foundMonth = await getMonth(userParam, monthParam);
      if (!foundMonth) return NextResponse.json({ error: "Mois introuvable" }, { status: 404 });
      return NextResponse.json(foundMonth);
    }

    return NextResponse.json({
      months: await getUserMonths(userParam),
      customCategories: user.customCategories,
      categoryBudgets: user.categoryBudgets,
      projects: user.projects,
      initialSavings: user.initialSavings,
      initialSavingsMonth: user.initialSavingsMonth,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// === POST (Auth + Sauvegarde INTELLIGENTE) ===
export async function POST(request: Request) {
  try {
    const body = await request.json();
    await ensureSchema();

    // --- CAS 1 : AUTHENTIFICATION ---
    if (body.isAuth) {
      const { username, password } = body as { username: string; password: string };
      const existingUser = await getUser(username);

      if (existingUser) {
        if (verifyPassword(password, existingUser.passwordHash)) {
          return NextResponse.json({ success: true, message: "Connexion réussie" });
        }
        return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
      }

      // Création de compte
      await createUser(username, hashPassword(password));
      return NextResponse.json({ success: true, message: "Compte créé" });
    }

    // --- CAS 1bis : GESTION DES CATEGORIES PERSONNALISEES ---
    if (body.isCategoryUpdate) {
      const { username, customCategories } = body as { username: string; customCategories: Category[] };
      if (!(await getUser(username))) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      }
      await updateUserField(username, "custom_categories", customCategories);
      return NextResponse.json({ success: true });
    }

    // --- CAS 1ter : GESTION DES BUDGETS PAR CATEGORIE ---
    if (body.isBudgetUpdate) {
      const { username, categoryBudgets } = body as { username: string; categoryBudgets: Record<string, number> };
      if (!(await getUser(username))) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      }
      await updateUserField(username, "category_budgets", categoryBudgets);
      return NextResponse.json({ success: true });
    }

    // --- CAS 1quater : GESTION DES PROJETS & DU SOLDE INITIAL ---
    if (body.isProjectUpdate) {
      const { username, projects, initialSavings, initialSavingsMonth } = body as {
        username: string;
        projects?: Project[];
        initialSavings?: number;
        initialSavingsMonth?: string;
      };
      if (!(await getUser(username))) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      }
      if (Array.isArray(projects)) {
        await updateUserField(username, "projects", projects);
      }
      await updateInitialSavings(
        username,
        typeof initialSavings === "number" ? initialSavings : undefined,
        typeof initialSavingsMonth === "string" ? initialSavingsMonth : undefined
      );
      return NextResponse.json({ success: true });
    }

    // --- CAS 2 : SAUVEGARDE / CREATION MOIS ---
    const newMonthData = body as MonthData;
    const user = await getUser(newMonthData.user);
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable pour la sauvegarde" }, { status: 404 });
    }

    const statements = [];

    if (newMonthData.fixedExpenses && newMonthData.fixedExpenses.length > 0) {
      // A. Un mois sauvegardé avec des charges fixes met à jour les défauts de l'utilisateur
      //    (on ne garde que les charges récurrentes, pas les exceptionnelles)
      const recurringExpenses = newMonthData.fixedExpenses.filter((fx) => !fx.isExceptional);
      statements.push({
        sql: "UPDATE users SET default_fixed_expenses = ? WHERE username = ?",
        args: [JSON.stringify(recurringExpenses), newMonthData.user],
      });
    } else {
      // B. Création d'un mois : on le pré-remplit avec les défauts de l'utilisateur,
      //    ou les défauts globaux s'il n'en a pas encore
      newMonthData.fixedExpenses =
        user.defaultFixedExpenses.length > 0
          ? [...user.defaultFixedExpenses]
          : await getGlobalDefaultFixedExpenses();
    }

    // C. Sauvegarde du mois, dans la même transaction que la mise à jour des défauts
    statements.push(upsertMonthStatement(newMonthData));
    await getDb().batch(statements, "write");

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

// === DELETE ===
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthToDelete = searchParams.get("month");
    const userToDelete = searchParams.get("user");

    if (!monthToDelete || !userToDelete) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

    await ensureSchema();
    const deleted = await deleteMonth(userToDelete, monthToDelete);
    if (!deleted) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
