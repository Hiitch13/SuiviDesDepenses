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
// Remplace par l'ID de ton bin et configure ta clé API via les variables d'environnement par exemple
const binId = "67f25abc8561e97a50f9a5ff";
const apiKey = process.env.JSONBIN_API_KEY || "TA_CLE_API";
console.log("Clé JSONBin : ", process.env.JSONBIN_API_KEY);

// === DELETE ===
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const monthToDelete = searchParams.get("month")

    if (!monthToDelete) {
      return NextResponse.json({ error: "Mois non spécifié" }, { status: 400 })
    }

    const allData = await getAllData()

    const updatedMonths = allData.months.filter(m => m.month !== monthToDelete)

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

// === Fonctions d'accès à JSONBin ===
async function getAllData(): Promise<AllData> {
  const response = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    method: "GET",
    headers: {
      "X-Master-Key": apiKey,
    },
  });
  if (!response.ok) {
    throw new Error("Erreur lors de la lecture du JSONBin");
  }
  const json = await response.json();
  // On suppose que la structure est stockée dans json.record
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

    const allData = await getAllData();

    // Si un mois est précisé en paramètre, renvoyer uniquement celui-ci
    if (monthParam) {
      const foundMonth = allData.months.find((m) => m.month === monthParam);
      if (!foundMonth) {
        return NextResponse.json({ error: "Month not found" }, { status: 404 });
      }
      return NextResponse.json(foundMonth);
    }

    // Sinon, renvoyer l'ensemble des données
    return NextResponse.json(allData);
  } catch (error) {
    console.error("Error reading data:", error);
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}

// === POST ===
export async function POST(request: Request) {
  try {
    const newMonthData = (await request.json()) as MonthData;
    const allData = await getAllData();

    // 1) Si le nouveau mois n'a pas de charges fixes, on lui met celles par défaut
    if (!newMonthData.fixedExpenses || newMonthData.fixedExpenses.length === 0) {
      newMonthData.fixedExpenses = [...allData.defaultFixedExpenses];
    }

    // 2) Vérifier si ce mois existe déjà
    const index = allData.months.findIndex((m) => m.month === newMonthData.month);

    // 3) Pour chaque charge fixe du mois, si elle n'existe pas dans defaultFixedExpenses, on l'ajoute
    newMonthData.fixedExpenses.forEach((fx) => {
      const existing = allData.defaultFixedExpenses.find((d) => d.id === fx.id);
      if (!existing) {
        // Nouvelle charge fixe : on l'ajoute
        allData.defaultFixedExpenses.push(fx);
      } else {
        // Charge fixe existante : on la met à jour
        existing.amount = fx.amount;
        existing.description = fx.description;
        existing.isExceptional = fx.isExceptional;
      }
    });
    

    // 4) Mettre à jour le mois existant ou l'ajouter
    if (index !== -1) {
      allData.months[index] = newMonthData;
    } else {
      allData.months.push(newMonthData);
    }

    // 5) Sauvegarder les modifications dans JSONBin
    await putAllData(allData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving data:", error);
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 });
  }
}
