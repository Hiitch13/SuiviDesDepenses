import { createClient, type Client } from "@libsql/client";

// === Types partagés entre l'API et le script de migration ===
export type FixedExpense = {
  id: string;
  amount: number;
  description: string;
  isExceptional?: boolean;
};

export type Expense = {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string;
};

export type IncomeEntry = {
  id: string;
  amount: number;
  description: string;
};

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Project = {
  id: string;
  name: string;
  amount: number; // coût total estimé
  targetMonth: string; // échéance "YYYY-MM"
  type: "voyage" | "achat" | "projet";
  included: boolean; // activable / désactivable pour simuler
};

export type UserRecord = {
  username: string;
  passwordHash: string;
  // Charges fixes reprises automatiquement à la création d'un mois
  defaultFixedExpenses: FixedExpense[];
  customCategories: Category[];
  // Budgets mensuels optionnels par catégorie (clé = id de catégorie)
  categoryBudgets: Record<string, number>;
  projects: Project[];
  // Solde d'épargne de départ et mois de référence de la projection
  initialSavings: number;
  initialSavingsMonth: string;
};

export type MonthData = {
  user: string;
  month: string;
  salary: number;
  expenses: Expense[];
  fixedExpenses: FixedExpense[];
  savingsGoal?: number;
  // Revenus en plus du salaire
  extraIncomes?: IncomeEntry[];
};

// === Connexion Turso ===
// Une base SQLite hébergée, accédée en HTTP : pas de connexion persistante à gérer,
// ce qui convient aux fonctions serverless de Netlify. Chaque requête ne touche que
// les lignes de l'utilisateur concerné (l'ancien stockage JSONBin relisait et
// réécrivait l'intégralité des données de tous les comptes à chaque opération).
let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

// Les listes (dépenses, charges fixes, catégories) sont stockées en JSON dans la ligne
// du mois / de l'utilisateur : le client envoie et attend toujours la liste complète,
// et cela garde chaque sauvegarde atomique en une seule écriture.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    default_fixed_expenses TEXT NOT NULL DEFAULT '[]',
    custom_categories TEXT NOT NULL DEFAULT '[]',
    category_budgets TEXT NOT NULL DEFAULT '{}',
    projects TEXT NOT NULL DEFAULT '[]',
    initial_savings REAL NOT NULL DEFAULT 0,
    initial_savings_month TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS months (
    user TEXT NOT NULL,
    month TEXT NOT NULL,
    salary REAL NOT NULL DEFAULT 0,
    savings_goal REAL,
    expenses TEXT NOT NULL DEFAULT '[]',
    fixed_expenses TEXT NOT NULL DEFAULT '[]',
    extra_incomes TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (user, month)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

export function getDb(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) throw new Error("TURSO_DATABASE_URL manquante");
    client = createClient({ url, authToken });
  }
  return client;
}

// Crée les tables si besoin, une seule fois par processus (mémoïsé, et réarmé en cas d'échec
// pour ne pas rester bloqué sur une erreur transitoire).
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getDb()
      .batch(SCHEMA, "write")
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

// === Lecture ===
function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getUser(username: string): Promise<UserRecord | null> {
  const { rows } = await getDb().execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [username],
  });
  const row = rows[0];
  if (!row) return null;
  return {
    username: String(row.username),
    passwordHash: String(row.password_hash),
    defaultFixedExpenses: parseJson(row.default_fixed_expenses, []),
    customCategories: parseJson(row.custom_categories, []),
    categoryBudgets: parseJson(row.category_budgets, {}),
    projects: parseJson(row.projects, []),
    initialSavings: Number(row.initial_savings) || 0,
    initialSavingsMonth: String(row.initial_savings_month ?? ""),
  };
}

function rowToMonth(row: Record<string, unknown>): MonthData {
  return {
    user: String(row.user),
    month: String(row.month),
    salary: Number(row.salary),
    savingsGoal: row.savings_goal == null ? undefined : Number(row.savings_goal),
    expenses: parseJson(row.expenses, []),
    fixedExpenses: parseJson(row.fixed_expenses, []),
    extraIncomes: parseJson(row.extra_incomes, []),
  };
}

export async function getMonth(username: string, month: string): Promise<MonthData | null> {
  const { rows } = await getDb().execute({
    sql: "SELECT * FROM months WHERE user = ? AND month = ?",
    args: [username, month],
  });
  return rows[0] ? rowToMonth(rows[0]) : null;
}

export async function getUserMonths(username: string): Promise<MonthData[]> {
  const { rows } = await getDb().execute({
    sql: "SELECT * FROM months WHERE user = ? ORDER BY month",
    args: [username],
  });
  return rows.map(rowToMonth);
}

// Charges fixes globales de secours (héritage de l'ancien stockage), utilisées pour
// un utilisateur qui n'a pas encore ses propres charges par défaut.
export async function getGlobalDefaultFixedExpenses(): Promise<FixedExpense[]> {
  const { rows } = await getDb().execute({
    sql: "SELECT value FROM settings WHERE key = 'defaultFixedExpenses'",
    args: [],
  });
  return parseJson(rows[0]?.value, []);
}

// === Écriture ===
export async function createUser(username: string, passwordHash: string): Promise<void> {
  await getDb().execute({
    sql: "INSERT INTO users (username, password_hash) VALUES (?, ?)",
    args: [username, passwordHash],
  });
}

export async function updateUserField(
  username: string,
  field: "default_fixed_expenses" | "custom_categories" | "category_budgets" | "projects",
  value: unknown
): Promise<void> {
  await getDb().execute({
    sql: `UPDATE users SET ${field} = ? WHERE username = ?`,
    args: [JSON.stringify(value), username],
  });
}

export async function updateInitialSavings(
  username: string,
  initialSavings: number | undefined,
  initialSavingsMonth: string | undefined
): Promise<void> {
  const sets: string[] = [];
  const args: (number | string)[] = [];
  if (initialSavings !== undefined) {
    sets.push("initial_savings = ?");
    args.push(initialSavings);
  }
  if (initialSavingsMonth !== undefined) {
    sets.push("initial_savings_month = ?");
    args.push(initialSavingsMonth);
  }
  if (sets.length === 0) return;
  await getDb().execute({
    sql: `UPDATE users SET ${sets.join(", ")} WHERE username = ?`,
    args: [...args, username],
  });
}

export function upsertMonthStatement(data: MonthData) {
  return {
    sql: `INSERT INTO months (user, month, salary, savings_goal, expenses, fixed_expenses, extra_incomes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user, month) DO UPDATE SET
            salary = excluded.salary,
            savings_goal = excluded.savings_goal,
            expenses = excluded.expenses,
            fixed_expenses = excluded.fixed_expenses,
            extra_incomes = excluded.extra_incomes`,
    args: [
      data.user,
      data.month,
      Number(data.salary) || 0,
      data.savingsGoal ?? null,
      JSON.stringify(data.expenses ?? []),
      JSON.stringify(data.fixedExpenses ?? []),
      JSON.stringify(data.extraIncomes ?? []),
    ],
  };
}

export async function deleteMonth(username: string, month: string): Promise<boolean> {
  const result = await getDb().execute({
    sql: "DELETE FROM months WHERE user = ? AND month = ?",
    args: [username, month],
  });
  return result.rowsAffected > 0;
}
