import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  type MonthData,
  type Project,
  DEFAULT_CATEGORIES,
  buildProjection,
  compareToPreviousMonth,
  computeTotals,
  daysRemaining,
  daysUntilPayday,
  defaultDateFor,
  frequentSuggestions,
  lastDayOf,
  monthlyHistory,
  overBudgetCategories,
  spendByCategory,
  toCsv,
  weeklyPacing,
} from "./budget.ts"

const expense = (amount: number, category: string, date: string, description = "x") => ({
  id: `${date}-${amount}`,
  amount,
  description,
  category,
  date,
})

const month = (m: string, salary: number, expenses: ReturnType<typeof expense>[], fixed = 0): MonthData => ({
  month: m,
  salary,
  expenses,
  fixedExpenses: fixed ? [{ id: "f", amount: fixed, description: "Loyer" }] : [],
})

describe("soldes du mois", () => {
  test("le reste à vivre déduit les charges fixes et les dépenses variables", () => {
    const t = computeTotals({
      salary: 2000,
      expenses: [expense(50, "alimentation", "2026-10-02"), expense(30, "transport", "2026-10-03")],
      fixedExpenses: [{ id: "f", amount: 800, description: "Loyer" }],
      extraIncomes: [{ id: "i", amount: 100, description: "Prime" }],
    })
    assert.equal(t.totalIncome, 2100)
    assert.equal(t.totalOut, 880)
    assert.equal(t.balance, 1220)
  })

  test("la part consommée est bornée à 100 même en dépassement", () => {
    const t = computeTotals({
      salary: 100,
      expenses: [expense(500, "autres", "2026-10-02")],
      fixedExpenses: [],
      extraIncomes: [],
    })
    assert.equal(t.spentShare, 100)
    assert.equal(t.balance, -400)
  })

  test("ce que l'on a payé pour le foyer est déduit du reste à vivre", () => {
    const t = computeTotals({
      salary: 2000,
      expenses: [expense(50, "alimentation", "2026-10-02")],
      fixedExpenses: [{ id: "f", amount: 800, description: "Loyer" }],
      extraIncomes: [],
      sharedPaid: 120,
    })
    assert.equal(t.totalShared, 120)
    assert.equal(t.totalOut, 970)
    assert.equal(t.balance, 1030)
  })

  test("sans foyer, rien n'est déduit", () => {
    const t = computeTotals({ salary: 1000, expenses: [], fixedExpenses: [], extraIncomes: [] })
    assert.equal(t.totalShared, 0)
    assert.equal(t.balance, 1000)
  })

  test("sans revenu, la part consommée vaut zéro plutôt que l'infini", () => {
    const t = computeTotals({ salary: 0, expenses: [], fixedExpenses: [], extraIncomes: [] })
    assert.equal(t.spentShare, 0)
  })
})

describe("budgets", () => {
  test("l'épargne n'est jamais un dépassement", () => {
    const spend = spendByCategory(
      [expense(500, "epargne", "2026-10-02"), expense(250, "alimentation", "2026-10-03")],
      DEFAULT_CATEGORIES
    )
    const over = overBudgetCategories(DEFAULT_CATEGORIES, spend, { epargne: 100, alimentation: 200 })
    assert.deepEqual(
      over.map((o) => o.id),
      ["alimentation"]
    )
    assert.equal(over[0].spent - over[0].budget, 50)
  })

  test("une catégorie sans budget n'est jamais signalée", () => {
    const spend = spendByCategory([expense(999, "loisirs", "2026-10-02")], DEFAULT_CATEGORIES)
    assert.deepEqual(overBudgetCategories(DEFAULT_CATEGORIES, spend, {}), [])
  })
})

describe("rythme de dépense", () => {
  const dans = (jour: number) => new Date(2026, 9, jour) // octobre 2026, 31 jours

  test("au-delà d'une semaine restante, le rythme est hebdomadaire", () => {
    const p = weeklyPacing("2026-10", 600, dans(10))
    assert.equal(p?.unit, "semaine")
    assert.equal(p?.days, 22)
    assert.equal(p?.value, 600 / 4) // 22 jours → 4 semaines entamées
  })

  test("dans les sept derniers jours, le rythme passe au jour", () => {
    const p = weeklyPacing("2026-10", 300, dans(28))
    assert.equal(p?.unit, "jour")
    assert.equal(p?.days, 4)
    assert.equal(p?.value, 75)
  })

  test("en dépassement, c'est le découvert qui est rapporté", () => {
    const p = weeklyPacing("2026-10", -120, dans(10))
    assert.equal(p?.isOver, true)
    assert.equal(p?.value, 120)
  })

  test("aucun rythme pour un mois qui n'est pas le mois en cours", () => {
    assert.equal(weeklyPacing("2026-03", 600, dans(10)), null)
  })
})

describe("jour de paie", () => {
  const dans = (jour: number) => new Date(2026, 9, jour) // octobre 2026, 31 jours

  test("le décompte court jusqu'au prochain jour de paie du même mois", () => {
    // Paie le 15 : depuis le 10, il reste 6 jours (10 → 15 inclus).
    assert.equal(daysUntilPayday(15, dans(10)), 6)
  })

  test("une fois le jour de paie passé, on compte jusqu'au mois suivant", () => {
    // Paie le 5 : depuis le 27, la prochaine paie tombe le 5 novembre.
    assert.equal(daysUntilPayday(5, dans(27)), 10)
  })

  test("un jour de paie au-delà du mois est ramené au dernier jour", () => {
    // « 31 » en février 2026 (28 jours) devient le 28.
    assert.equal(daysUntilPayday(31, new Date(2026, 1, 10)), 19)
  })

  test("sans jour de paie, daysRemaining reste calé sur la fin du mois", () => {
    assert.equal(daysRemaining("2026-10", null, dans(28)), 4)
  })

  test("le rythme suit la prochaine paie quand elle est renseignée", () => {
    const p = weeklyPacing("2026-10", 300, dans(28), 5)
    assert.equal(p?.days, 9) // 28 octobre → 5 novembre
  })
})

describe("dates", () => {
  test("le dernier jour tient compte des années bissextiles", () => {
    assert.equal(lastDayOf("2028-02"), "2028-02-29")
    assert.equal(lastDayOf("2026-02"), "2026-02-28")
    assert.equal(lastDayOf("2026-10"), "2026-10-31")
  })

  test("une dépense saisie dans un mois passé est datée de son dernier jour", () => {
    assert.equal(defaultDateFor("2026-03", new Date(2026, 9, 15)), "2026-03-31")
  })

  test("dans le mois en cours, la date proposée est aujourd'hui", () => {
    assert.equal(defaultDateFor("2026-10", new Date(2026, 9, 15, 12)), "2026-10-15")
  })
})

describe("suggestions d'habitudes", () => {
  const months = [
    month("2026-08", 2000, [expense(50, "alimentation", "2026-08-02", "Courses"), expense(9, "loisirs", "2026-08-03", "Ciné")]),
    month("2026-09", 2000, [expense(62, "alimentation", "2026-09-02", "Courses")]),
    month("2026-10", 2000, [expense(71, "alimentation", "2026-10-02", "Courses")]),
  ]

  test("regroupe sur la description, pas sur le montant, et garde le plus récent", () => {
    const [top] = frequentSuggestions(months, DEFAULT_CATEGORIES)
    assert.equal(top.description, "Courses")
    assert.equal(top.count, 3)
    assert.equal(top.amount, 71, "le montant retenu doit être celui de la dépense la plus récente")
  })

  test("une dépense unique n'est pas une habitude", () => {
    const noms = frequentSuggestions(months, DEFAULT_CATEGORIES).map((s) => s.description)
    assert.ok(!noms.includes("Ciné"))
  })

  test("une catégorie supprimée ne ressort plus", () => {
    const orphelines = [month("2026-10", 2000, [expense(5, "disparue", "2026-10-01", "A"), expense(6, "disparue", "2026-10-02", "A")])]
    assert.deepEqual(frequentSuggestions(orphelines, DEFAULT_CATEGORIES), [])
  })
})

describe("comparaison avec le mois précédent", () => {
  const months = [
    month("2026-08", 2000, [expense(100, "alimentation", "2026-08-02")]),
    month("2026-10", 2000, [expense(160, "alimentation", "2026-10-02"), expense(40, "loisirs", "2026-10-03")]),
  ]

  test("se cale sur le mois enregistré précédent, même s'il n'est pas contigu", () => {
    const { previousMonth, rows } = compareToPreviousMonth(months, "2026-10", DEFAULT_CATEGORIES)
    assert.equal(previousMonth, "2026-08")
    const alim = rows.find((r) => r.category.id === "alimentation")
    assert.equal(alim?.delta, 60)
    assert.equal(Math.round(alim!.deltaPct!), 60)
  })

  test("pas de pourcentage quand le mois précédent était à zéro", () => {
    const { rows } = compareToPreviousMonth(months, "2026-10", DEFAULT_CATEGORIES)
    assert.equal(rows.find((r) => r.category.id === "loisirs")?.deltaPct, null)
  })

  test("le plus ancien mois n'a rien à quoi se comparer", () => {
    assert.equal(compareToPreviousMonth(months, "2026-08", DEFAULT_CATEGORIES).previousMonth, null)
  })
})

describe("projection d'épargne", () => {
  const maintenant = new Date(2026, 9, 15) // octobre 2026
  const months = [
    month("2026-09", 2000, [expense(200, "epargne", "2026-09-10")]),
    month("2026-10", 2000, [expense(300, "epargne", "2026-10-10")]),
  ]

  test("l'épargne du mois d'ancrage est comptée, pas sautée", () => {
    const p = buildProjection({
      months,
      projects: [],
      initialSavings: 1000,
      initialSavingsMonth: "2026-10",
      now: maintenant,
    })
    // Ancrage en octobre à 1000, plus les 300 épargnés en octobre.
    assert.equal(p.points[0].month, "2026-10")
    assert.equal(p.points[0].solde, 1300)
    assert.equal(p.currentSavings, 1300)
  })

  test("les mois antérieurs à l'ancrage sont ignorés", () => {
    const p = buildProjection({
      months,
      projects: [],
      initialSavings: 1000,
      initialSavingsMonth: "2026-10",
      now: maintenant,
    })
    assert.ok(!p.points.some((x) => x.month === "2026-09"))
  })

  test("un projet est déduit à son échéance et sa faisabilité est tranchée", () => {
    const projets: Project[] = [
      { id: "p1", name: "Vélo", amount: 1200, targetMonth: "2026-12", type: "achat", included: true },
      { id: "p2", name: "Japon", amount: 9000, targetMonth: "2027-01", type: "voyage", included: true },
    ]
    const p = buildProjection({
      months,
      projects: projets,
      initialSavings: 1000,
      initialSavingsMonth: "2026-10",
      now: maintenant,
    })
    assert.equal(p.feasibility.get("p1"), true, "1 200 € en décembre doit être finançable")
    assert.equal(p.feasibility.get("p2"), false, "9 000 € en janvier ne l'est pas")
    assert.equal(p.hasNegative, true)
  })

  test("un projet exclu ne pèse pas sur la projection", () => {
    const exclu: Project[] = [
      { id: "p1", name: "Vélo", amount: 99999, targetMonth: "2026-12", type: "achat", included: false },
    ]
    const p = buildProjection({
      months,
      projects: exclu,
      initialSavings: 1000,
      initialSavingsMonth: "2026-10",
      now: maintenant,
    })
    assert.equal(p.hasNegative, false)
    assert.equal(p.feasibility.has("p1"), false)
  })

  test("seuls les mois strictement futurs sont extrapolés", () => {
    const projets: Project[] = [
      { id: "p", name: "Loin", amount: 10, targetMonth: "2027-01", type: "achat", included: true },
    ]
    const p = buildProjection({
      months,
      projects: projets,
      initialSavings: 1000,
      initialSavingsMonth: "2026-10",
      now: maintenant,
    })
    const futurs = p.points.filter((x) => x.projected).map((x) => x.month)
    assert.deepEqual(futurs, ["2026-11", "2026-12", "2027-01"])
    // Moyenne observée depuis l'ancrage : seul octobre est dans la fenêtre, soit 300.
    assert.equal(p.points.find((x) => x.month === "2026-11")?.solde, 1600)
  })

  test("sans solde renseigné, la projection part du premier mois connu à zéro", () => {
    const p = buildProjection({
      months,
      projects: [],
      initialSavings: 0,
      initialSavingsMonth: "",
      now: maintenant,
    })
    assert.equal(p.points[0].month, "2026-09")
    assert.equal(p.points[0].solde, 200)
  })
})

describe("historique et export", () => {
  test("l'historique est trié du plus ancien au plus récent", () => {
    const h = monthlyHistory([month("2026-10", 2000, []), month("2026-08", 2000, [])])
    assert.deepEqual(
      h.map((p) => p.month),
      ["2026-08", "2026-10"]
    )
  })

  test("l'épargne d'un mois ne compte que la catégorie Épargne", () => {
    const [h] = monthlyHistory([
      month("2026-10", 2000, [expense(300, "epargne", "2026-10-02"), expense(50, "loisirs", "2026-10-03")]),
    ])
    assert.equal(h.saved, 300)
    assert.equal(h.variable, 350)
  })

  test("le CSV échappe les points-virgules et les guillemets", () => {
    const csv = toCsv(
      [month("2026-10", 2000, [expense(12.5, "alimentation", "2026-10-02", 'Courses; "bio"')])],
      DEFAULT_CATEGORIES
    )
    const ligne = csv.split("\r\n")[1]
    assert.equal(ligne, '2026-10;2026-10-02;Alimentation;"Courses; ""bio""";12.50')
    assert.equal(ligne.split(";").length > 5, true, "le point-virgule interne reste dans le champ cité")
  })

  test("le CSV ajoute les charges fixes du mois d'extraction, et seulement celles-là", () => {
    const csv = toCsv(
      [
        month("2026-09", 2000, [expense(20, "loisirs", "2026-09-10")], 750),
        month("2026-10", 2000, [expense(12.5, "alimentation", "2026-10-02")], 800),
      ],
      DEFAULT_CATEGORIES,
      new Date(2026, 9, 31)
    )
    const lignes = csv.split("\r\n").slice(1)
    assert.deepEqual(lignes, [
      "2026-09;2026-09-10;Loisirs;x;20.00",
      "2026-10;2026-10-02;Alimentation;x;12.50",
      "2026-10;;Charge fixe;Loyer;800.00",
    ])
  })

  test("l'en-tête du CSV est stable", () => {
    assert.equal(toCsv([], DEFAULT_CATEGORIES).split("\r\n")[0], "mois;date;categorie;description;montant")
  })
})
