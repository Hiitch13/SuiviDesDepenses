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

type MonthData = {
  user: string; // <--- AJOUT IMPORTANT : le propriétaire du mois
  month: string;
  salary: number;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
};

// Le JSON complet
type AllData = {
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
    headers: {
      "X-Master-Key": apiKey,
    },
    cache: "no-store", // Important pour éviter le cache Vercel/Next en dev
  });
  if (!response.ok) {
    throw new Error("Erreur lors de la lecture du JSONBin");
  }
  const json = await response.json();
  return json.record as AllData;
}

async function putAllData(data: AllData): Promise<void> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Master-Key": apiKey,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Erreur lors de la mise à jour du JSONBin");
  }
}

// === GET ===
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get("month");
    const userParam = searchParams.get("user"); // <--- On récupère l'user

    // Si pas d'user spécifié, on peut renvoyer une erreur ou un tableau vide par sécurité
    // Pour simplifier, si pas d'user, on renvoie tout (mode admin) ou vide.
    // Ici, on va exiger un user pour filtrer correctement.
    if (!userParam) {
       // Optionnel : retourner une erreur si on veut être strict
       // return NextResponse.json({ error: "User required" }, { status: 400 });
    }

    const allData = await getAllData();

    // 1. Si on cherche un mois précis pour un utilisateur précis
    if (monthParam && userParam) {
      const foundMonth = allData.months.find(
        (m) => m.month === monthParam && m.user === userParam
      );
      if (!foundMonth) {
        return NextResponse.json({ error: "Mois introuvable pour cet utilisateur" }, { status: 404 });
      }
      return NextResponse.json(foundMonth);
    }

    // 2. Sinon, on renvoie la liste filtrée pour cet utilisateur
    // On ne renvoie que les mois qui appartiennent à "userParam"
    const userMonths = userParam 
      ? allData.months.filter((m) => m.user === userParam)
      : allData.months; // Si pas d'user, on renvoie tout (pour debug)

    // On renvoie une structure cohérente avec AllData mais filtrée
    return NextResponse.json({
      ...allData,
      months: userMonths
    });

  } catch (error) {
    console.error("Error reading data:", error);
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}

// === POST ===
export async function POST(request: Request) {
  try {
    const newMonthData = (await request.json()) as MonthData;
    
    // Validation basique
    if (!newMonthData.user || !newMonthData.month) {
        return NextResponse.json({ error: "User and Month are required" }, { status: 400 });
    }

    const allData = await getAllData();

    // 1) Gestion des charges fixes par défaut (Globales pour simplifier, ou à filtrer aussi si tu veux séparer)
    // Ici, on garde les defaults globaux pour que tout le monde partage les "idées" de charges,
    // mais chaque mois a sa propre copie.
    if (!newMonthData.fixedExpenses || newMonthData.fixedExpenses.length === 0) {
      newMonthData.fixedExpenses = [...allData.defaultFixedExpenses];
    }

    // 2) Vérifier si ce mois existe déjà POUR CET UTILISATEUR
    const index = allData.months.findIndex(
      (m) => m.month === newMonthData.month && m.user === newMonthData.user
    );

    // 3) Mise à jour des defaults globaux (Optionnel : ça apprend des nouveaux ajouts de tout le monde)
    newMonthData.fixedExpenses.forEach((fx) => {
      const existing = allData.defaultFixedExpenses.find((d) => d.id === fx.id);
      if (!existing) {
        allData.defaultFixedExpenses.push(fx);
      } else {
        // On ne met à jour la description globale que si nécessaire, mais attention aux conflits entre users.
        // Pour l'instant on laisse simple.
        existing.amount = fx.amount; 
        existing.description = fx.description;
      }
    });

    // 4) Mettre à jour ou ajouter
    if (index !== -1) {
      // Mise à jour du mois existant de l'utilisateur
      allData.months[index] = newMonthData;
    } else {
      // Nouveau mois pour l'utilisateur
      allData.months.push(newMonthData);
    }

    // 5) Sauvegarder
    await putAllData(allData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving data:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}

// === DELETE ===
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const monthToDelete = searchParams.get("month")
    const userToDelete = searchParams.get("user") // <--- AJOUT

    if (!monthToDelete || !userToDelete) {
      return NextResponse.json({ error: "Mois ou Utilisateur non spécifié" }, { status: 400 })
    }

    const allData = await getAllData()

    // On ne garde que les mois qui NE SONT PAS (ce mois ET cet user)
    const updatedMonths = allData.months.filter(
      m => !(m.month === monthToDelete && m.user === userToDelete)
    )

    if (updatedMonths.length === allData.months.length) {
      return NextResponse.json({ error: "Mois introuvable" }, { status: 404 })
    }

    allData.months = updatedMonths
    await putAllData(allData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erreur lors de la suppression :", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}