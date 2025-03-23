import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// === Types ===
type FixedExpense = {
  id: string
  amount: number
  description: string
  isExceptional?: boolean
};

type Expense = {
  id: string
  amount: number
  description: string
  category: string
  date: string
};

type MonthData = {
  month: string
  salary: number
  expenses: Expense[]
  fixedExpenses: FixedExpense[]
};

// Le JSON complet
type AllData = {
  defaultFixedExpenses: FixedExpense[]
  months: MonthData[]
};


// === Fichiers & Helpers ===
// En haut de route.ts
const DEFAULT_FIXED_EXPENSES: FixedExpense[] = [
  { id: "1", amount: 500, description: "Loyer" },
  { id: "2", amount: 50, description: "Internet" },
  { id: "3", amount: 80, description: "Électricité" },
];

const DATA_FILE_PATH = path.join(process.cwd(), "data", "expenses.json")

function ensureDataDirectoryExists() {
  const dataDir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

function readAllData(): AllData {
  ensureDataDirectoryExists()

  if (!fs.existsSync(DATA_FILE_PATH)) {
    const defaultData: AllData = {
      defaultFixedExpenses: [
        { id: "1", amount: 500, description: "Loyer" },
        { id: "2", amount: 50, description: "Internet" },
        { id: "3", amount: 80, description: "Électricité" }
      ],
      months: []
    };
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  

  const fileContent = fs.readFileSync(DATA_FILE_PATH, "utf-8")
  return JSON.parse(fileContent) as AllData
}

function writeAllData(data: AllData) {
  ensureDataDirectoryExists()
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2))
}

// === GET ===
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get("month")

    const allData = readAllData()

    // S'il y a ?month=..., on renvoie juste le mois demandé
    if (monthParam) {
      const foundMonth = allData.months.find((m) => m.month === monthParam)
      if (!foundMonth) {
        return NextResponse.json({ error: "Month not found" }, { status: 404 })
      }
      return NextResponse.json(foundMonth)
    }

    // Sinon, on renvoie tout (liste de tous les mois)
    return NextResponse.json(allData)
  } catch (error) {
    console.error("Error reading data:", error)
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 })
  }
}

// === POST ===
export async function POST(request: Request) {
  try {
    const newMonthData = (await request.json()) as MonthData
    const allData = readAllData()

    // 1) Si le nouveau mois n'a pas de charges fixes, on lui met celles par défaut
    if (!newMonthData.fixedExpenses || newMonthData.fixedExpenses.length === 0) {
      newMonthData.fixedExpenses = [...allData.defaultFixedExpenses]
    }

    // 2) Vérifier si ce mois existe déjà
    const index = allData.months.findIndex(m => m.month === newMonthData.month)

    // 3) IMPORTANT : Pour chaque charge fixe du mois, si elle n'existe pas dans defaultFixedExpenses, on l'ajoute
    newMonthData.fixedExpenses.forEach((fx) => {
      const alreadyInDefaults = allData.defaultFixedExpenses.find(d => d.id === fx.id)
      if (!alreadyInDefaults) {
        allData.defaultFixedExpenses.push(fx)
      }
    })

    // 4) Soit on met à jour le mois, soit on le crée
    if (index !== -1) {
      allData.months[index] = newMonthData
    } else {
      allData.months.push(newMonthData)
    }

    // 5) Sauvegarde
    writeAllData(allData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving data:", error)
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 })
  }
}