import { createClient, type Client } from "@libsql/client";

import {
  type Household,
  type HouseholdMonth,
  type HouseholdRole,
  type Invite,
  newHouseholdId,
} from "./household";

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
  // --- Le foyer : un espace partagé, à côté du budget personnel de chacun ---
  `CREATE TABLE IF NOT EXISTS households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS household_members (
    household_id TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'membre',
    joined_at TEXT NOT NULL,
    PRIMARY KEY (household_id, username)
  )`,
  `CREATE TABLE IF NOT EXISTS household_invites (
    household_id TEXT NOT NULL,
    username TEXT NOT NULL,
    invited_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (household_id, username)
  )`,
  `CREATE TABLE IF NOT EXISTS household_months (
    household_id TEXT NOT NULL,
    month TEXT NOT NULL,
    expenses TEXT NOT NULL DEFAULT '[]',
    fixed_expenses TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (household_id, month)
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

// =============================================================
// Foyer
// =============================================================

/**
 * Le foyer de cet utilisateur, membres compris, ou null.
 *
 * Un compte n'appartient qu'à un seul foyer : au-delà, « Moi / Foyer » devrait
 * devenir un choix entre plusieurs espaces, et chaque dépense partagée devrait
 * désigner lequel. Le jour où le besoin se présente, c'est ici que ça change.
 */
export async function getHouseholdForUser(username: string): Promise<Household | null> {
  const { rows } = await getDb().execute({
    sql: `SELECT h.id, h.name FROM households h
          JOIN household_members m ON m.household_id = h.id
          WHERE m.username = ? LIMIT 1`,
    args: [username],
  });
  const row = rows[0];
  if (!row) return null;

  const id = String(row.id);
  const members = await getDb().execute({
    sql: "SELECT username, role FROM household_members WHERE household_id = ? ORDER BY joined_at",
    args: [id],
  });

  return {
    id,
    name: String(row.name),
    members: members.rows.map((m) => ({
      username: String(m.username),
      role: String(m.role) as HouseholdRole,
    })),
  };
}

export async function isHouseholdMember(householdId: string, username: string): Promise<boolean> {
  const { rows } = await getDb().execute({
    sql: "SELECT 1 FROM household_members WHERE household_id = ? AND username = ?",
    args: [householdId, username],
  });
  return rows.length > 0;
}

export async function createHousehold(name: string, owner: string): Promise<string> {
  const id = newHouseholdId();
  const now = new Date().toISOString();
  await getDb().batch(
    [
      { sql: "INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)", args: [id, name, now] },
      {
        sql: "INSERT INTO household_members (household_id, username, role, joined_at) VALUES (?, ?, 'proprietaire', ?)",
        args: [id, owner, now],
      },
    ],
    "write"
  );
  return id;
}

export async function renameHousehold(householdId: string, name: string): Promise<void> {
  await getDb().execute({ sql: "UPDATE households SET name = ? WHERE id = ?", args: [name, householdId] });
}

export async function inviteToHousehold(householdId: string, username: string, invitedBy: string): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO household_invites (household_id, username, invited_by, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(household_id, username) DO UPDATE SET invited_by = excluded.invited_by`,
    args: [householdId, username, invitedBy, new Date().toISOString()],
  });
}

/** Les invitations reçues par quelqu'un, avec le nom du foyer. */
export async function getInvitesFor(username: string): Promise<Invite[]> {
  const { rows } = await getDb().execute({
    sql: `SELECT i.household_id, i.invited_by, h.name FROM household_invites i
          JOIN households h ON h.id = i.household_id
          WHERE i.username = ? ORDER BY i.created_at`,
    args: [username],
  });
  return rows.map((r) => ({
    householdId: String(r.household_id),
    householdName: String(r.name),
    username,
    invitedBy: String(r.invited_by),
  }));
}

/** Les invitations qu'un foyer a envoyées et qui attendent encore. */
export async function getPendingInvites(householdId: string): Promise<string[]> {
  const { rows } = await getDb().execute({
    sql: "SELECT username FROM household_invites WHERE household_id = ? ORDER BY created_at",
    args: [householdId],
  });
  return rows.map((r) => String(r.username));
}

export async function acceptInvite(householdId: string, username: string): Promise<void> {
  await getDb().batch(
    [
      {
        sql: "INSERT INTO household_members (household_id, username, role, joined_at) VALUES (?, ?, 'membre', ?) ON CONFLICT DO NOTHING",
        args: [householdId, username, new Date().toISOString()],
      },
      // Les autres invitations en attente tombent : on ne rejoint qu'un foyer.
      { sql: "DELETE FROM household_invites WHERE username = ?", args: [username] },
    ],
    "write"
  );
}

export async function declineInvite(householdId: string, username: string): Promise<void> {
  await getDb().execute({
    sql: "DELETE FROM household_invites WHERE household_id = ? AND username = ?",
    args: [householdId, username],
  });
}

/**
 * Quitter un foyer. Le dernier à partir l'emporte avec lui : garder un foyer
 * sans membre laisserait des dépenses que plus personne ne peut lire.
 */
export async function leaveHousehold(householdId: string, username: string): Promise<void> {
  await getDb().execute({
    sql: "DELETE FROM household_members WHERE household_id = ? AND username = ?",
    args: [householdId, username],
  });
  const { rows } = await getDb().execute({
    sql: "SELECT COUNT(*) AS n FROM household_members WHERE household_id = ?",
    args: [householdId],
  });
  if (Number(rows[0].n) === 0) {
    await getDb().batch(
      [
        { sql: "DELETE FROM household_months WHERE household_id = ?", args: [householdId] },
        { sql: "DELETE FROM household_invites WHERE household_id = ?", args: [householdId] },
        { sql: "DELETE FROM households WHERE id = ?", args: [householdId] },
      ],
      "write"
    );
  }
}

function rowToHouseholdMonth(row: Record<string, unknown>): HouseholdMonth {
  return {
    householdId: String(row.household_id),
    month: String(row.month),
    expenses: parseJson(row.expenses, []),
    fixedExpenses: parseJson(row.fixed_expenses, []),
  };
}

export async function getHouseholdMonth(householdId: string, month: string): Promise<HouseholdMonth | null> {
  const { rows } = await getDb().execute({
    sql: "SELECT * FROM household_months WHERE household_id = ? AND month = ?",
    args: [householdId, month],
  });
  return rows[0] ? rowToHouseholdMonth(rows[0]) : null;
}

export async function getHouseholdMonths(householdId: string): Promise<HouseholdMonth[]> {
  const { rows } = await getDb().execute({
    sql: "SELECT * FROM household_months WHERE household_id = ? ORDER BY month",
    args: [householdId],
  });
  return rows.map(rowToHouseholdMonth);
}

export async function saveHouseholdMonth(data: HouseholdMonth): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO household_months (household_id, month, expenses, fixed_expenses)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(household_id, month) DO UPDATE SET
            expenses = excluded.expenses,
            fixed_expenses = excluded.fixed_expenses`,
    args: [
      data.householdId,
      data.month,
      JSON.stringify(data.expenses ?? []),
      JSON.stringify(data.fixedExpenses ?? []),
    ],
  });
}

export async function deleteMonth(username: string, month: string): Promise<boolean> {
  const result = await getDb().execute({
    sql: "DELETE FROM months WHERE user = ? AND month = ?",
    args: [username, month],
  });
  return result.rowsAffected > 0;
}
