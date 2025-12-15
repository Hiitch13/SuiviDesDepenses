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

type User = {
  username: string;
  password: string;
  // NOUVEAU : Chaque utilisateur a ses propres charges par défaut
  defaultFixedExpenses?: FixedExpense[]; 
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
  users: User[]; 
  // On garde ça pour la rétrocompatibilité, mais on ne s'en servira plus vraiment
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

  // Initialiser le tableau users s'il n'existe pas
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

    const userMonths = allData.months.filter((m) => m.user === userParam);
    return NextResponse.json({ ...allData, months: userMonths });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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