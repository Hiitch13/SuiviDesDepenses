import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Types
type Expense = {
  id: string
  amount: number
  description: string
  category: string
  date: string
}

type FixedExpense = {
  id: string
  amount: number
  description: string
  isExceptional?: boolean
}

type ExpenseData = {
  expenses: Expense[]
  fixedExpenses: FixedExpense[]
}

// Path to the JSON file
const DATA_FILE_PATH = path.join(process.cwd(), "data", "expenses.json")

// Ensure the data directory exists
const ensureDataDirectoryExists = () => {
  const dataDir = path.join(process.cwd(), "data")
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

// Read data from the JSON file
const readDataFromFile = (): ExpenseData => {
  ensureDataDirectoryExists()

  if (!fs.existsSync(DATA_FILE_PATH)) {
    // Create default data if file doesn't exist
    const defaultData: ExpenseData = {
      expenses: [],
      fixedExpenses: [
        { id: "1", amount: 500, description: "Loyer" },
        { id: "2", amount: 50, description: "Internet" },
        { id: "3", amount: 80, description: "Électricité" },
      ],
    }

    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(defaultData, null, 2))
    return defaultData
  }

  const fileContent = fs.readFileSync(DATA_FILE_PATH, "utf-8")
  return JSON.parse(fileContent) as ExpenseData
}

// Write data to the JSON file
const writeDataToFile = (data: ExpenseData) => {
  ensureDataDirectoryExists()
  fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2))
}

// GET handler - Read expenses
export async function GET() {
  try {
    const data = readDataFromFile()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error reading expense data:", error)
    return NextResponse.json({ error: "Failed to read expense data" }, { status: 500 })
  }
}

// POST handler - Save expenses
export async function POST(request: Request) {
  try {
    const data: ExpenseData = await request.json()

    // Validate data
    if (!data.expenses || !Array.isArray(data.expenses) || !data.fixedExpenses || !Array.isArray(data.fixedExpenses)) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 })
    }

    writeDataToFile(data)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving expense data:", error)
    return NextResponse.json({ error: "Failed to save expense data" }, { status: 500 })
  }
}

