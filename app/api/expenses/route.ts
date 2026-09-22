import { NextResponse } from "next/server";

// === Types ===
type FixedExpense = {
  id: string;
  amount: number;
  description: string;
  isExceptional?: boolean;
};

type Expense = {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
};

// Revenu supplémentaire ponctuel (prime, revenu annexe, cadeau reçu...)
type IncomeEntry = {
  id: string;
  amount: number;
  description: string;
};

type Category = {
  id: string;
  name: string;
  color: string;
};

// Projet / achat / voyage planifié (inspiré du budget foyer Excel)
type Project = {
  id: string;
  name: string;
  amount: number; // coût total estimé
  targetMonth: string; // échéance "YYYY-MM"
  type: "voyage" | "achat" | "projet"; // catégorie du projet
  included: boolean; // "Inclus ?" — activable / désactivable pour simuler
};

type User = {
  username: string;
  password: string;
  // NOUVEAU : Chaque utilisateur a ses propres charges par défaut
  defaultFixedExpenses?: FixedExpense[];
  // Catégories personnalisées ajoutées par l'utilisateur
  customCategories?: Category[];
  // Budgets mensuels optionnels par catégorie (clé = id de catégorie)
  categoryBudgets?: Record<string, number>;
  // Projets / achats / voyages planifiés (transversaux aux mois)
  projects?: Project[];
  // Solde d'épargne de référence saisi manuellement
  initialSavings?: number;
  // Mois ("YYYY-MM") auquel le solde de référence a été renseigné pour la
  // dernière fois : l'épargne n'est cumulée qu'à partir de ce mois.
  initialSavingsMonth?: string;
};

type MonthData = {
  user: string;
  month: string;
  salary: number;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  // Objectif d'épargne du mois (optionnel)
  savingsGoal?: number;
  // Revenus supplémentaires du mois (en plus du salaire)
  extraIncomes?: IncomeEntry[];
};

// Structure globale du JSON
type AllData = {
  users: User[]; 
  // On garde ça pour la rétrocompatibilité, mais on ne s'en servira plus vraiment
  defaultFixedExpenses: FixedExpense[]; 
  months: MonthData[];
};

// === Configuration JSONBin ===
const binId = "67f25abc8561e97a50f9a5ff"; // Ton ID
const apiKey = process.env.JSONBIN_API_KEY || "TA_CLE_API";

// === Fonctions d'accès à JSONBin ===

// JSONBin est le seul stockage de l'app : s'il répond lentement ou tombe (502/504 côté
// hébergeur, connexion impossible...), tout est bloqué. On borne donc chaque appel dans le
// temps, on réessaie une fois les lectures en cas d'erreur transitoire, et on remonte une
// erreur typée pour renvoyer un 503 explicite plutôt qu'un 500 muet.
const JSONBIN_TIMEOUT_MS = 8000;

class StorageError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

async function fetchJsonBin(url: string, init: RequestInit, retries: number): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(JSONBIN_TIMEOUT_MS) });
      // 5xx = problème côté JSONBin, ça vaut le coup de réessayer ; 4xx = erreur de config, inutile
      if (response.status >= 500 && attempt < retries) continue;
      return response;
    } catch (error) {
      if (attempt >= retries) throw new StorageError(`JSONBin injoignable (${(error as Error).name})`);
    }
  }
}

async function getAllData(): Promise<AllData> {
  const response = await fetchJsonBin(
    `https://api.jsonbin.io/v3/b/${binId}/latest`,
    { method: "GET", headers: { "X-Master-Key": apiKey }, cache: "no-store" },
    1
  );
  if (!response.ok) throw new StorageError("Erreur lecture DB", response.status);
  
  const json = await response.json();
  const record = json.record as AllData;

  // Initialiser le tableau users s'il n'existe pas
  if (!record.users) record.users = [];
  return record;
}

async function putAllData(data: AllData): Promise<void> {
  // Pas de retry sur l'écriture : une PUT qui a abouti côté JSONBin mais dont la réponse
  // s'est perdue serait rejouée sans dommage (même contenu), mais on préfère rester simple
  // et laisser l'utilisateur relancer depuis l'UI avec un message clair.
  const response = await fetchJsonBin(
    `https://api.jsonbin.io/v3/b/${binId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": apiKey,
      },
      body: JSON.stringify(data),
    },
    0
  );
  // Avant, une PUT en échec était ignorée : l'API répondait "success" alors que rien
  // n'était enregistré. On refuse désormais de mentir au client.
  if (!response.ok) throw new StorageError("Erreur écriture DB", response.status);
}

function errorResponse(error: unknown) {
  if (error instanceof StorageError) {
    console.error(`[JSONBin] ${error.message}${error.status ? ` (HTTP ${error.status})` : ""}`);
    return NextResponse.json(
      { error: "Le service de stockage ne répond pas. Réessayez dans quelques instants." },
      { status: 503 }
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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

    const allData = await getAllData();

    // Vérifier user
    const userExists = allData.users.some(u => u.username === userParam);
    if (!userExists) {
        return NextResponse.json({ error: "Utilisateur inconnu" }, { status: 404 });
    }

    if (monthParam) {
      const foundMonth = allData.months.find(
        (m) => m.month === monthParam && m.user === userParam
      );
      if (!foundMonth) return NextResponse.json({ error: "Mois introuvable" }, { status: 404 });
      return NextResponse.json(foundMonth);
    }

    const currentUserData = allData.users.find(u => u.username === userParam);
    const userMonths = allData.months.filter((m) => m.user === userParam);
    // On ne renvoie que ce qui concerne cet utilisateur : surtout pas `allData.users`,
    // qui contient les mots de passe de tous les comptes.
    return NextResponse.json({
      months: userMonths,
      customCategories: currentUserData?.customCategories || [],
      categoryBudgets: currentUserData?.categoryBudgets || {},
      projects: currentUserData?.projects || [],
      initialSavings: currentUserData?.initialSavings || 0,
      initialSavingsMonth: currentUserData?.initialSavingsMonth || "",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// === POST (Auth + Sauvegarde INTELLIGENTE) ===
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const allData = await getAllData();

    // --- CAS 1 : AUTHENTIFICATION ---
    if (body.isAuth) {
        const { username, password } = body;
        const existingUser = allData.users.find(u => u.username === username);

        if (existingUser) {
            if (existingUser.password === password) {
                return NextResponse.json({ success: true, message: "Connexion réussie" });
            } else {
                return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
            }
        } else {
            // Création compte avec liste vide par défaut
            allData.users.push({ username, password, defaultFixedExpenses: [] });
            await putAllData(allData);
            return NextResponse.json({ success: true, message: "Compte créé" });
        }
    }

    // --- CAS 1bis : GESTION DES CATEGORIES PERSONNALISEES ---
    if (body.isCategoryUpdate) {
      const { username, customCategories } = body as { username: string; customCategories: Category[] };
      const idx = allData.users.findIndex(u => u.username === username);

      if (idx === -1) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      }

      allData.users[idx].customCategories = customCategories;
      await putAllData(allData);
      return NextResponse.json({ success: true });
    }

    // --- CAS 1ter : GESTION DES BUDGETS PAR CATEGORIE ---
    if (body.isBudgetUpdate) {
      const { username, categoryBudgets } = body as { username: string; categoryBudgets: Record<string, number> };
      const idx = allData.users.findIndex(u => u.username === username);

      if (idx === -1) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      }

      allData.users[idx].categoryBudgets = categoryBudgets;
      await putAllData(allData);
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
      const idx = allData.users.findIndex(u => u.username === username);

      if (idx === -1) {
        return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
      }

      if (Array.isArray(projects)) {
        allData.users[idx].projects = projects;
      }
      if (typeof initialSavings === "number") {
        allData.users[idx].initialSavings = initialSavings;
      }
      if (typeof initialSavingsMonth === "string") {
        allData.users[idx].initialSavingsMonth = initialSavingsMonth;
      }
      await putAllData(allData);
      return NextResponse.json({ success: true });
    }

    // --- CAS 2 : SAUVEGARDE / CREATION MOIS ---
    const newMonthData = body as MonthData;
    const currentUserIndex = allData.users.findIndex(u => u.username === newMonthData.user);
    
    if (currentUserIndex === -1) {
        return NextResponse.json({ error: "Utilisateur introuvable pour la sauvegarde" }, { status: 404 });
    }

    // A. INTELLIGENCE : MISE A JOUR DES DEFAUTS UTILISATEUR
    // Si on sauvegarde un mois qui contient des charges fixes, on met à jour les préférences de l'utilisateur
    if (newMonthData.fixedExpenses && newMonthData.fixedExpenses.length > 0) {
        // On ne garde que celles qui ne sont PAS exceptionnelles
        const recurringExpenses = newMonthData.fixedExpenses.filter(fx => !fx.isExceptional);
        
        // On met à jour le profil de l'utilisateur avec cette nouvelle liste "propre"
        allData.users[currentUserIndex].defaultFixedExpenses = recurringExpenses;
    }

    // B. CREATION D'UN NOUVEAU MOIS (Remplissage automatique)
    // Si le mois envoyé n'a pas de charges fixes (c'est une création), on prend les défauts de l'USER
    if (!newMonthData.fixedExpenses || newMonthData.fixedExpenses.length === 0) {
        const userDefaults = allData.users[currentUserIndex].defaultFixedExpenses || [];
        
        // Si l'user n'a pas encore de défauts, on fallback sur les globaux (optionnel)
        // ou on laisse vide. Ici je mets les défauts globaux si l'user est vide pour aider au début.
        if (userDefaults.length === 0 && allData.defaultFixedExpenses) {
             newMonthData.fixedExpenses = [...allData.defaultFixedExpenses];
        } else {
             newMonthData.fixedExpenses = [...userDefaults];
        }
    }

    // C. SAUVEGARDE DU MOIS
    const index = allData.months.findIndex(
      (m) => m.month === newMonthData.month && m.user === newMonthData.user
    );

    if (index !== -1) {
      allData.months[index] = newMonthData;
    } else {
      allData.months.push(newMonthData);
    }

    await putAllData(allData);

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

// === DELETE ===
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const monthToDelete = searchParams.get("month")
    const userToDelete = searchParams.get("user")

    if (!monthToDelete || !userToDelete) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

    const allData = await getAllData()
    const updatedMonths = allData.months.filter(
      m => !(m.month === monthToDelete && m.user === userToDelete)
    )

    if (updatedMonths.length === allData.months.length) return NextResponse.json({ error: "Introuvable" }, { status: 404 })

    allData.months = updatedMonths
    await putAllData(allData)

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}