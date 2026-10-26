import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { type HouseholdMonth, householdTotal, settle, sharedSpendByCategory } from "./household.ts"

const mois = (
  expenses: { amount: number; paidBy: string; category?: string }[],
  fixed: { amount: number; paidBy: string }[] = []
): HouseholdMonth => ({
  householdId: "h1",
  month: "2026-10",
  expenses: expenses.map((e, i) => ({
    id: `e${i}`,
    amount: e.amount,
    description: `dépense ${i}`,
    category: e.category ?? "alimentation",
    date: "2026-10-05",
    paidBy: e.paidBy,
  })),
  fixedExpenses: fixed.map((f, i) => ({
    id: `f${i}`,
    amount: f.amount,
    description: `charge ${i}`,
    paidBy: f.paidBy,
  })),
})

describe("partage du foyer", () => {
  test("à deux, celui qui a trop avancé est remboursé par l'autre", () => {
    const s = settle(mois([{ amount: 162, paidBy: "Ali" }], [{ amount: 780, paidBy: "Ali" }, { amount: 42, paidBy: "Estelle" }]), [
      "Ali",
      "Estelle",
    ])
    assert.equal(s.total, 984)
    assert.equal(s.balances.find((b) => b.username === "Ali")?.paid, 942)
    assert.equal(s.balances.find((b) => b.username === "Estelle")?.paid, 42)
    assert.equal(s.balances[0].share, 492)
    assert.deepEqual(s.transfers, [{ from: "Estelle", to: "Ali", amount: 450 }])
  })

  test("quand chacun a payé sa part, personne ne doit rien", () => {
    const s = settle(mois([{ amount: 100, paidBy: "Ali" }, { amount: 100, paidBy: "Estelle" }]), ["Ali", "Estelle"])
    assert.deepEqual(s.transfers, [])
    assert.ok(s.balances.every((b) => b.balance === 0))
  })

  test("la somme des soldes est nulle", () => {
    const s = settle(
      mois([
        { amount: 33.33, paidBy: "Ali" },
        { amount: 10, paidBy: "Bea" },
      ]),
      ["Ali", "Bea", "Cam"]
    )
    const sommeCentimes = s.balances.reduce((acc, b) => acc + Math.round(b.balance * 100), 0)
    assert.equal(sommeCentimes, 0, "les soldes doivent s'annuler exactement, au centime")
  })

  test("à trois, les remboursements sont les moins nombreux possibles", () => {
    // Ali avance tout : les deux autres le remboursent, soit deux virements.
    const s = settle(mois([{ amount: 300, paidBy: "Ali" }]), ["Ali", "Bea", "Cam"])
    assert.equal(s.transfers.length, 2)
    assert.ok(s.transfers.every((t) => t.to === "Ali" && t.amount === 100))
  })

  test("un seul membre : rien à partager", () => {
    const s = settle(mois([{ amount: 50, paidBy: "Ali" }]), ["Ali"])
    assert.equal(s.total, 50)
    assert.equal(s.balances[0].balance, 0)
    assert.deepEqual(s.transfers, [])
  })

  test("un foyer sans membre ne plante pas", () => {
    const s = settle(mois([{ amount: 50, paidBy: "Ali" }]), [])
    assert.equal(s.total, 50)
    assert.deepEqual(s.balances, [])
    assert.deepEqual(s.transfers, [])
  })

  test("une dépense payée par un ancien membre compte au total sans être créditée", () => {
    const s = settle(mois([{ amount: 200, paidBy: "Parti" }, { amount: 100, paidBy: "Ali" }]), ["Ali", "Bea"])
    assert.equal(s.total, 300)
    assert.equal(s.balances.find((b) => b.username === "Ali")?.paid, 100)
    // Chacun doit 150 ; Ali en a avancé 100, Bea rien.
    assert.equal(s.balances.find((b) => b.username === "Ali")?.balance, -50)
    assert.equal(s.balances.find((b) => b.username === "Bea")?.balance, -150)
  })

  test("un centime indivisible reste réparti exactement", () => {
    // 20,01 € à deux : la part ne tombe pas juste. Le centime en trop va au
    // premier membre, et le remboursement rétablit l'équilibre au centime.
    const s = settle(mois([{ amount: 10, paidBy: "Ali" }, { amount: 10.01, paidBy: "Bea" }]), ["Ali", "Bea"])
    assert.equal(s.total, 20.01)
    assert.deepEqual(
      s.balances.map((b) => b.share),
      [10.01, 10]
    )
    assert.equal(
      s.balances.reduce((acc, b) => acc + Math.round(b.balance * 100), 0),
      0,
      "les soldes doivent s'annuler exactement, au centime"
    )
    assert.deepEqual(s.transfers, [{ from: "Ali", to: "Bea", amount: 0.01 }])
  })

  test("les montants à centimes ne dérivent pas", () => {
    const s = settle(
      mois([
        { amount: 33.33, paidBy: "Ali" },
        { amount: 16.67, paidBy: "Bea" },
        { amount: 0.01, paidBy: "Cam" },
      ]),
      ["Ali", "Bea", "Cam"]
    )
    assert.equal(s.total, 50.01)
    assert.equal(s.balances.reduce((acc, b) => acc + Math.round(b.balance * 100), 0), 0)
    const totalVire = s.transfers.reduce((acc, t) => acc + t.amount, 0)
    const totalDu = s.balances.filter((b) => b.balance < 0).reduce((acc, b) => acc - b.balance, 0)
    assert.equal(Math.round(totalVire * 100), Math.round(totalDu * 100))
  })
})

describe("totaux du foyer", () => {
  test("le total additionne dépenses et charges fixes", () => {
    assert.equal(householdTotal(mois([{ amount: 12.3, paidBy: "Ali" }], [{ amount: 780, paidBy: "Ali" }])), 792.3)
  })

  test("la répartition par catégorie ignore les charges fixes", () => {
    const r = sharedSpendByCategory(
      mois(
        [
          { amount: 60, paidBy: "Ali", category: "alimentation" },
          { amount: 20, paidBy: "Bea", category: "alimentation" },
          { amount: 15, paidBy: "Ali", category: "transport" },
        ],
        [{ amount: 780, paidBy: "Ali" }]
      )
    )
    assert.deepEqual(r, { alimentation: 80, transport: 15 })
  })
})
