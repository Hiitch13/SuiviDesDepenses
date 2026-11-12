import assert from "node:assert/strict"
import { describe, test } from "node:test"

import {
  type MonthData,
  type Project,
  type SavingsMove,
  DEFAULT_CATEGORIES,
  buildProjection,
  compareToPreviousMonth,
  computeTotals,
  daysRemaining,
  daysUntilPayday,
  defaultDateFor,
  frequentSuggestions,
  lastDayOf,
  migrateLegacySavings,
  monthlyHistory,
  moveDelta,
  overBudgetCategories,
  recalibration,
  savingsBalanceAt,
  savingsFlow,
  savingsHistory,
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
  test("une catégorie au-delà de son budget est signalée avec son dépassement", () => {
    const spend = spendByCategory(
      [expense(90, "loisirs", "2026-10-02"), expense(250, "alimentation", "2026-10-03")],
      DEFAULT_CATEGORIES
    )
    const over = overBudgetCategories(DEFAULT_CATEGORIES, spend, { loisirs: 100, alimentation: 200 })
    assert.deepEqual(
      over.map((o) => o.id),
      ["alimentation"]
    )
    assert.equal(over[0].spent - over[0].budget, 50)
  })

  test("la catégorie Épargne n'existe plus : l'épargne passe par les mouvements", () => {
    assert.ok(!DEFAULT_CATEGORIES.some((c) => c.id === "epargne"))
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

  test("le jour même de la paie, elle est reçue : on compte jusqu'à la suivante", () => {
    // Paie le 4 : le 4 novembre, la prochaine tombe le 4 décembre.
    assert.equal(daysUntilPayday(4, new Date(2026, 10, 4)), 31)
  })

  test("la veille de la paie, elle reste à venir", () => {
    assert.equal(daysUntilPayday(4, new Date(2026, 10, 3)), 2)
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

const move = (kind: SavingsMove["kind"], amount: number, date: string, note = ""): SavingsMove => ({
  id: `${kind}-${date}-${amount}`,
  kind,
  amount,
  date,
  note,
})

describe("mouvements d'épargne", () => {
  const moves = [
    move("versement", 200, "2026-09-10"),
    move("retrait", 50, "2026-09-20"),
    move("versement", 300, "2026-10-05"),
    move("ajustement", -25, "2026-10-31"),
  ]

  test("un retrait se soustrait, un ajustement garde son signe", () => {
    assert.equal(moveDelta(move("versement", 10, "2026-10-01")), 10)
    assert.equal(moveDelta(move("retrait", 10, "2026-10-01")), -10)
    assert.equal(moveDelta(move("ajustement", -7, "2026-10-01")), -7)
  })

  test("le flux du mois ignore les ajustements", () => {
    assert.deepEqual(savingsFlow(moves, "2026-10"), { deposited: 300, withdrawn: 0, net: 300 })
    assert.deepEqual(savingsFlow(moves, "2026-09"), { deposited: 200, withdrawn: 50, net: 150 })
  })

  test("le solde cumule tout jusqu'à la fin du mois, ajustements compris", () => {
    assert.equal(savingsBalanceAt(moves, "2026-08"), 0)
    assert.equal(savingsBalanceAt(moves, "2026-09"), 150)
    assert.equal(savingsBalanceAt(moves, "2026-10"), 425)
  })

  test("l'historique couvre chaque mois, trous compris, du plus ancien au plus récent", () => {
    const h = savingsHistory([move("versement", 100, "2026-07-01"), move("versement", 40, "2026-09-03")], "2026-10")
    assert.deepEqual(
      h.map((r) => [r.month, r.net, r.balance]),
      [
        ["2026-07", 100, 100],
        ["2026-08", 0, 100],
        ["2026-09", 40, 140],
        ["2026-10", 0, 140],
      ]
    )
  })

  test("l'historique ventile versé, retiré et ajusté, et garde les mouvements du mois", () => {
    const oct = savingsHistory(moves, "2026-10").find((r) => r.month === "2026-10")!
    assert.equal(oct.deposited, 300)
    assert.equal(oct.withdrawn, 0)
    assert.equal(oct.adjusted, -25)
    assert.equal(oct.moves.length, 2)
  })

  test("l'historique va jusqu'à un mouvement daté dans le futur", () => {
    const h = savingsHistory([move("versement", 5, "2026-09-01"), move("versement", 10, "2026-12-01")], "2026-10")
    assert.deepEqual(
      h.map((r) => r.month),
      ["2026-09", "2026-10", "2026-11", "2026-12"]
    )
  })

  test("sans mouvement, l'historique est vide", () => {
    assert.deepEqual(savingsHistory([], "2026-10"), [])
  })

  test("un recalage crée un ajustement égal à l'écart, daté de la fin du mois", () => {
    const adj = recalibration(moves, "2026-10", 500)
    assert.equal(adj?.kind, "ajustement")
    assert.equal(adj?.amount, 75)
    assert.equal(adj?.date, "2026-10-31")
  })

  test("un recalage sans écart ne crée rien", () => {
    assert.equal(recalibration(moves, "2026-10", 425), null)
  })

  test("le reste à vivre déduit les versements et récupère les retraits", () => {
    const t = computeTotals({
      salary: 2000,
      expenses: [expense(100, "alimentation", "2026-10-02")],
      fixedExpenses: [],
      extraIncomes: [],
      savings: { deposited: 300, withdrawn: 50, net: 250 },
    })
    assert.equal(t.savingsNet, 250)
    assert.equal(t.balance, 1650)
    assert.equal(t.totalExpenses, 100, "l'épargne n'est pas une dépense")
  })
})

describe("projection d'épargne", () => {
  const maintenant = new Date(2026, 9, 15) // octobre 2026
  const moves = [move("versement", 200, "2026-09-10"), move("versement", 300, "2026-10-10")]
  const projet = (id: string, amount: number, targetMonth: string, included = true): Project => ({
    id,
    name: id,
    amount,
    targetMonth,
    type: "achat",
    included,
  })

  test("le solde actuel est le solde réel, sans projet déduit", () => {
    const p = buildProjection({ moves, projects: [projet("p", 100, "2026-10")], now: maintenant })
    assert.equal(p.currentSavings, 500)
    assert.equal(p.points.find((x) => x.month === "2026-10")?.solde, 400, "la courbe, elle, déduit le projet")
  })

  test("le futur est extrapolé sur la moyenne des mois complets passés", () => {
    const p = buildProjection({ moves, projects: [projet("p", 10, "2027-01")], now: maintenant })
    assert.deepEqual(
      p.points.filter((x) => x.projected).map((x) => x.month),
      ["2026-11", "2026-12", "2027-01"]
    )
    // Seul septembre est un mois complet depuis le premier mouvement : 200 par mois.
    assert.equal(p.points.find((x) => x.month === "2026-11")?.solde, 700)
  })

  test("la moyenne porte au plus sur les six derniers mois complets, trous comptés à zéro", () => {
    const longs = [
      move("versement", 1000, "2026-01-05"), // hors fenêtre
      move("versement", 600, "2026-06-05"),
      move("retrait", 60, "2026-08-05"),
    ]
    const p = buildProjection({ moves: longs, projects: [projet("p", 1, "2026-11")], now: maintenant })
    // Fenêtre avril → septembre : (600 − 60) / 6 = 90.
    const oct = p.points.find((x) => x.month === "2026-10")!.solde
    assert.equal(p.points.find((x) => x.month === "2026-11")?.solde, oct + 90 - 1)
  })

  test("un retrait fait baisser la moyenne", () => {
    const p = buildProjection({
      moves: [move("versement", 300, "2026-08-01"), move("retrait", 300, "2026-09-01")],
      projects: [projet("p", 1, "2026-11")],
      now: maintenant,
    })
    assert.equal(p.points.find((x) => x.month === "2026-11")?.solde, -1)
  })

  test("si tout a commencé ce mois-ci, le rythme est celui du mois en cours", () => {
    const p = buildProjection({
      moves: [move("versement", 250, "2026-10-02")],
      projects: [projet("p", 1, "2026-11")],
      now: maintenant,
    })
    assert.equal(p.points.find((x) => x.month === "2026-11")?.solde, 499)
  })

  test("un projet est déduit à son échéance et sa faisabilité est tranchée", () => {
    const p = buildProjection({
      moves,
      projects: [projet("p1", 600, "2026-12"), projet("p2", 9000, "2027-01")],
      now: maintenant,
    })
    assert.equal(p.feasibility.get("p1"), true)
    assert.equal(p.feasibility.get("p2"), false)
    assert.equal(p.hasNegative, true)
  })

  test("un projet exclu ne pèse pas sur la projection", () => {
    const p = buildProjection({ moves, projects: [projet("p1", 99999, "2026-12", false)], now: maintenant })
    assert.equal(p.hasNegative, false)
    assert.equal(p.feasibility.has("p1"), false)
  })

  test("un versement programmé plus tard compte à son mois, la courbe part quand même d'aujourd'hui", () => {
    const p = buildProjection({ moves: [move("versement", 100, "2026-12-05")], projects: [], now: maintenant })
    assert.equal(p.points[0].month, "2026-10")
    assert.equal(p.currentSavings, 0)
    assert.equal(p.points.find((x) => x.month === "2026-12")?.solde, 100)
  })

  test("sans mouvement, la projection part de zéro au mois courant", () => {
    const p = buildProjection({ moves: [], projects: [], now: maintenant })
    assert.equal(p.currentSavings, 0)
    assert.deepEqual(p.points, [{ month: "2026-10", solde: 0, projected: false, deducted: [] }])
  })

  test("chaque point porte les projets déduits ce mois-là, avec leur faisabilité", () => {
    const p = buildProjection({
      moves,
      projects: [projet("p1", 600, "2026-12"), projet("p2", 9000, "2027-01"), projet("p3", 5, "2027-01", false)],
      now: maintenant,
    })
    const dec = p.points.find((x) => x.month === "2026-12")!
    assert.deepEqual(dec.deducted, [{ id: "p1", name: "p1", amount: 600, feasible: true }])
    // Le solde du point est celui d'après déduction : avant, il valait 500 + 2 × 200.
    assert.equal(dec.solde, 300)
    const jan = p.points.find((x) => x.month === "2027-01")!
    assert.deepEqual(
      jan.deducted.map((d) => [d.id, d.feasible]),
      [["p2", false]],
      "un projet exclu n'apparaît pas"
    )
    assert.deepEqual(p.points.find((x) => x.month === "2026-11")?.deducted, [])
  })
})

describe("migration de l'ancienne épargne", () => {
  const maintenant = new Date(2026, 9, 15)
  const legacy = [
    month("2026-08", 2000, [expense(100, "epargne", "2026-08-03", "Livret"), expense(20, "loisirs", "2026-08-04")]),
    month("2026-09", 2000, [expense(200, "epargne", "2026-09-10")]),
    month("2026-10", 2000, [expense(300, "epargne", "2026-10-10"), expense(-80, "epargne", "2026-10-12", "Pioche")]),
    month("2026-12", 2000, [expense(999, "epargne", "2026-12-01")]),
  ]

  // Ancien calcul du solde « aujourd'hui », recopié pour servir d'oracle.
  function oldCurrentSavings(months: MonthData[], initialSavings: number, initialSavingsMonth: string, current: string) {
    const net = new Map(
      months.map((m) => [m.month, m.expenses.filter((e) => e.category === "epargne").reduce((s, e) => s + e.amount, 0)])
    )
    const has = initialSavings > 0 && !!initialSavingsMonth
    const anchor = has ? initialSavingsMonth : ([...net.keys()].sort()[0] ?? current)
    let bal = has ? initialSavings : 0
    for (const [mo, v] of net) if (mo >= anchor && mo <= current) bal += v
    return bal
  }

  test("les dépenses Épargne deviennent des versements ou des retraits et quittent les dépenses", () => {
    const r = migrateLegacySavings({ months: legacy, initialSavings: 0, initialSavingsMonth: "" })
    assert.equal(r.moves.filter((m) => m.kind === "versement").length, 4)
    const retrait = r.moves.find((m) => m.kind === "retrait")!
    assert.equal(retrait.amount, 80)
    assert.equal(retrait.note, "Pioche")
    assert.ok(r.months.every((m) => m.expenses.every((e) => e.category !== "epargne")))
    assert.equal(r.months.find((m) => m.month === "2026-08")?.expenses.length, 1, "les autres dépenses restent")
    assert.deepEqual(r.changedMonths, ["2026-08", "2026-09", "2026-10", "2026-12"])
  })

  test("le solde de départ devient un ajustement qui préserve le solde exact", () => {
    const r = migrateLegacySavings({ months: legacy, initialSavings: 1000, initialSavingsMonth: "2026-09" })
    const adj = r.moves.find((m) => m.kind === "ajustement")!
    assert.equal(adj.date, "2026-09-01")
    assert.equal(adj.amount, 900, "1 000 moins les 100 versés en août, déjà comptés dans le solde de départ")
  })

  for (const [initial, ref] of [
    [0, ""],
    [1000, "2026-09"],
    [1000, "2026-10"],
    [500, "2026-06"],
    [700, ""],
  ] as const) {
    test(`invariant : même solde aujourd'hui avant et après migration (${initial} / ${ref || "sans mois"})`, () => {
      const r = migrateLegacySavings({ months: legacy, initialSavings: initial, initialSavingsMonth: ref })
      const attendu = oldCurrentSavings(legacy, initial, ref, "2026-10")
      assert.equal(savingsBalanceAt(r.moves, "2026-10"), attendu)
      assert.equal(buildProjection({ moves: r.moves, projects: [], now: maintenant }).currentSavings, attendu)
    })
  }

  test("une dépense Épargne datée hors de son mois est ramenée dans ce mois", () => {
    const r = migrateLegacySavings({
      months: [month("2026-10", 0, [expense(50, "epargne", "2026-11-02")])],
      initialSavings: 0,
      initialSavingsMonth: "",
    })
    assert.equal(r.moves[0].date, "2026-10-31")
  })

  test("sans épargne ni solde de départ, rien ne change", () => {
    const r = migrateLegacySavings({
      months: [month("2026-10", 0, [expense(5, "loisirs", "2026-10-02")])],
      initialSavings: 0,
      initialSavingsMonth: "",
    })
    assert.deepEqual(r.moves, [])
    assert.deepEqual(r.changedMonths, [])
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

  test("l'épargne d'un mois vient des mouvements, nette des retraits", () => {
    const [h] = monthlyHistory(
      [month("2026-10", 2000, [expense(50, "loisirs", "2026-10-03")])],
      [move("versement", 300, "2026-10-02"), move("retrait", 100, "2026-10-09"), move("ajustement", 40, "2026-10-31")]
    )
    assert.equal(h.saved, 200)
    assert.equal(h.variable, 50)
    assert.equal(h.balance, 1750)
  })

  test("le CSV échappe les points-virgules et les guillemets", () => {
    const csv = toCsv(
      [month("2026-10", 0, [expense(12.5, "alimentation", "2026-10-02", 'Courses; "bio"')])],
      DEFAULT_CATEGORIES
    )
    const ligne = csv.split("\r\n")[1]
    assert.equal(ligne, '2026-10;2026-10-02;Dépense;Alimentation;"Courses; ""bio""";12.50')
    assert.equal(ligne.split(";").length > 6, true, "le point-virgule interne reste dans le champ cité")
  })

  const deuxMois = () => [
    month("2026-09", 2000, [expense(20, "loisirs", "2026-09-10")], 750),
    {
      ...month("2026-10", 2000, [expense(12.5, "alimentation", "2026-10-02")], 800),
      extraIncomes: [{ id: "i", amount: 100, description: "Prime" }],
    },
  ]

  test("chaque mois donne ses revenus, ses charges fixes et ses dépenses, puis les totaux", () => {
    const lignes = toCsv(deuxMois(), DEFAULT_CATEGORIES).split("\r\n").slice(1)
    assert.deepEqual(lignes, [
      "2026-09;;Revenu;;Salaire;2000.00",
      "2026-09;;Charge fixe;;Loyer;750.00",
      "2026-09;2026-09-10;Dépense;Loisirs;x;20.00",
      "2026-10;;Revenu;;Salaire;2000.00",
      "2026-10;;Revenu;;Prime;100.00",
      "2026-10;;Charge fixe;;Loyer;800.00",
      "2026-10;2026-10-02;Dépense;Alimentation;x;12.50",
      "",
      ";;Total;;Revenus;4100.00",
      ";;Total;;Charges fixes;1550.00",
      ";;Total;;Dépenses variables;32.50",
      ";;Total;;Dépenses (fixes + variables);1582.50",
      ";;Total;;Solde (revenus − dépenses);2517.50",
      ";;Total;;Épargne nette (versements − retraits);0.00",
      ";;Total;;Reste (solde − épargne nette);2517.50",
    ])
  })

  test("une période ne garde que ses mois, et ses totaux ne comptent qu'eux", () => {
    const lignes = toCsv(deuxMois(), DEFAULT_CATEGORIES, { from: "2026-09", to: "2026-09" }).split("\r\n")
    assert.equal(lignes.some((l) => l.startsWith("2026-10")), false)
    assert.equal(lignes.at(-3), ";;Total;;Solde (revenus − dépenses);1230.00")
  })

  test("le CSV range les mouvements d'épargne dans leur mois, montant signé, et les totalise", () => {
    const moves = [
      move("retrait", 80, "2026-10-12", "Pioche"),
      move("versement", 300, "2026-10-02"),
      move("ajustement", 15, "2026-10-31", "Recalage"),
      move("versement", 50, "2026-11-03"), // hors période
    ]
    const lignes = toCsv(deuxMois(), DEFAULT_CATEGORIES, { to: "2026-10" }, moves).split("\r\n")
    const octobre = lignes.filter((l) => l.startsWith("2026-10"))
    assert.deepEqual(octobre.slice(-3), [
      "2026-10;2026-10-02;Épargne;Versement;;300.00",
      "2026-10;2026-10-12;Épargne;Retrait;Pioche;-80.00",
      "2026-10;2026-10-31;Épargne;Recalage;Recalage;15.00",
    ])
    assert.equal(lignes.some((l) => l.startsWith("2026-11")), false)
    assert.equal(lignes.at(-2), ";;Total;;Épargne nette (versements − retraits);220.00")
    assert.equal(lignes.at(-1), ";;Total;;Reste (solde − épargne nette);2297.50")
  })

  test("un mouvement dans un mois jamais ouvert apparaît quand même", () => {
    const lignes = toCsv([], DEFAULT_CATEGORIES, {}, [move("versement", 10, "2026-07-01")]).split("\r\n")
    assert.equal(lignes[1], "2026-07;2026-07-01;Épargne;Versement;;10.00")
  })

  test("l'en-tête du CSV est stable", () => {
    assert.equal(toCsv([], DEFAULT_CATEGORIES).split("\r\n")[0], "mois;date;type;categorie;description;montant")
  })
})
