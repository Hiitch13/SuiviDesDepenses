import { NextResponse } from "next/server";

// === Types ===
type User = {
  username: string;
  password: string; // En prod, il faudrait hacher ce mdp (bcrypt), mais ok pour ce projet perso
};

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

type MonthData = {
  user: string;
  month: string;
  salary: number;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
};

// Structure globale du JSON
type AllData = {
  users: User[]; // <--- NOUVEAU : Liste des utilisateurs
  defaultFixedExpenses: FixedExpense[];
  months: MonthData[];
};

// === Configuration JSONBin ===
const binId = "67f25abc8561e97a50f9a5ff"; // Ton ID
const apiKey = process.env.JSONBIN_API_KEY || "TA_CLE_API";

// === Fonctions d'accès à JSONBin ===
async function getAllData(): Promise<AllData> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    method: "GET",
    headers: { "X-Master-Key": apiKey },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Erreur lecture DB");
  
  const json = await response.json();
  const record = json.record as AllData;

  // Initialiser le tableau users s'il n'existe pas encore
  if (!record.users) record.users = [];
  return record;
}

async function putAllData(data: AllData): Promise<void> {
  await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": apiKey,
    },
    body: JSON.stringify(data),
  });
}

// === GET (Récupérer les mois d'un user) ===
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const userParam = searchParams.get("user");

    // Sécurité : on exige un user pour voir des données
    if (!userParam) {
      return NextResponse.json({ error: "Utilisateur non spécifié" }, { status: 400 });
    }

    const allData = await getAllData();

    // Vérifier si l'utilisateur existe (optionnel, mais propre)
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

    // Filtrer les mois pour cet utilisateur
    const userMonths = allData.months.filter((m) => m.user === userParam);

    return NextResponse.json({ ...allData, months: userMonths });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// === POST (Gère AUTHENTIFICATION + SAUVEGARDE DONNÉES) ===
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const allData = await getAllData();

    // --- CAS 1 : AUTHENTIFICATION (Connexion / Inscription) ---
    // Si le body contient "isAuth: true", on gère le login
    if (body.isAuth) {
        const { username, password } = body;
        if (!username || !password) {
            return NextResponse.json({ error: "Pseudo et mot de passe requis" }, { status: 400 });
        }

        const existingUser = allData.users.find(u => u.username === username);

        if (existingUser) {
            // Utilisateur existe -> Vérification du MDP
            if (existingUser.password === password) {
                return NextResponse.json({ success: true, message: "Connexion réussie" });
            } else {
                return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
            }
        } else {
            // Utilisateur n'existe pas -> Création (Inscription)
            allData.users.push({ username, password });
            await putAllData(allData);
            return NextResponse.json({ success: true, message: "Compte créé avec succès" });
        }
    }

    // --- CAS 2 : SAUVEGARDE D'UN MOIS (Code précédent) ---
    const newMonthData = body as MonthData;
    
    if (!newMonthData.fixedExpenses || newMonthData.fixedExpenses.length === 0) {
      newMonthData.fixedExpenses = [...allData.defaultFixedExpenses];
    }

    const index = allData.months.findIndex(
      (m) => m.month === newMonthData.month && m.user === newMonthData.user
    );

    // Mise à jour des defaults globaux (simple apprentissage)
    newMonthData.fixedExpenses.forEach((fx) => {
      const existing = allData.defaultFixedExpenses.find((d) => d.id === fx.id);
      if (!existing) allData.defaultFixedExpenses.push(fx);
    });

    if (index !== -1) {
      allData.months[index] = newMonthData;
    } else {
      allData.months.push(newMonthData);
    }

    await putAllData(allData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}