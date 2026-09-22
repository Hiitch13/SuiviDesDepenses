// Importe l'intégralité de l'ancien stockage JSONBin dans Turso.
//
//   npx tsx scripts/migrate-from-jsonbin.ts
//
// Lit JSONBIN_API_KEY, TURSO_DATABASE_URL et TURSO_AUTH_TOKEN dans .env.local.
// Rejouable sans risque : chaque utilisateur / mois est inséré ou remplacé.
import { loadEnvConfig } from "@next/env";
import { ensureSchema, getDb, upsertMonthStatement, type FixedExpense, type MonthData } from "../lib/db";
import { hashPassword } from "../lib/password";

loadEnvConfig(process.cwd());

const BIN_ID = "67f25abc8561e97a50f9a5ff";

type LegacyUser = {
  username: string;
  password: string;
  defaultFixedExpenses?: FixedExpense[];
  customCategories?: unknown[];
  categoryBudgets?: Record<string, number>;
  projects?: unknown[];
  initialSavings?: number;
  initialSavingsMonth?: string;
};

type LegacyData = {
  users?: LegacyUser[];
  defaultFixedExpenses?: FixedExpense[];
  months?: MonthData[];
};

async function fetchLegacyData(): Promise<LegacyData> {
  const apiKey = process.env.JSONBIN_API_KEY;
  if (!apiKey) throw new Error("JSONBIN_API_KEY manquante dans .env.local");

  const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: { "X-Master-Key": apiKey },
  });
  if (!response.ok) throw new Error(`Lecture JSONBin : HTTP ${response.status}`);
  const json = await response.json();
  return json.record as LegacyData;
}

async function main() {
  const data = await fetchLegacyData();
  const users = data.users ?? [];
  const months = data.months ?? [];
  console.log(`JSONBin : ${users.length} utilisateur(s), ${months.length} mois`);

  await ensureSchema();
  const db = getDb();

  const statements = [];

  for (const u of users) {
    statements.push({
      sql: `INSERT INTO users (username, password_hash, default_fixed_expenses, custom_categories, category_budgets,
                               projects, initial_savings, initial_savings_month)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
              password_hash = excluded.password_hash,
              default_fixed_expenses = excluded.default_fixed_expenses,
              custom_categories = excluded.custom_categories,
              category_budgets = excluded.category_budgets,
              projects = excluded.projects,
              initial_savings = excluded.initial_savings,
              initial_savings_month = excluded.initial_savings_month`,
      args: [
        u.username,
        hashPassword(u.password),
        JSON.stringify(u.defaultFixedExpenses ?? []),
        JSON.stringify(u.customCategories ?? []),
        JSON.stringify(u.categoryBudgets ?? {}),
        JSON.stringify(u.projects ?? []),
        u.initialSavings ?? 0,
        u.initialSavingsMonth ?? "",
      ],
    });
  }

  // Les mois d'avant le multi-utilisateurs n'ont pas de champ `user` : ils sont
  // invisibles dans l'app depuis longtemps et n'appartiennent à personne, on les ignore.
  const orphanMonths = months.filter((m) => !m.user);
  if (orphanMonths.length) {
    console.log(`Ignoré : ${orphanMonths.length} mois sans utilisateur (${orphanMonths.map((m) => m.month).join(", ")})`);
  }
  for (const month of months) {
    if (month.user) statements.push(upsertMonthStatement(month));
  }

  statements.push({
    sql: `INSERT INTO settings (key, value) VALUES ('defaultFixedExpenses', ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [JSON.stringify(data.defaultFixedExpenses ?? [])],
  });

  // Tout ou rien : une seule transaction
  await db.batch(statements, "write");

  const [{ rows: userRows }, { rows: monthRows }] = await db.batch(
    ["SELECT COUNT(*) AS n FROM users", "SELECT COUNT(*) AS n FROM months"],
    "read"
  );
  console.log(`Turso : ${userRows[0].n} utilisateur(s), ${monthRows[0].n} mois`);
  console.log("Migration terminée.");
}

main().catch((error) => {
  console.error("Échec de la migration :", error);
  process.exit(1);
});
