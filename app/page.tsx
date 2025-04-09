"use client"

import { useState, useEffect, FormEvent } from "react"
import { Plus, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card, CardContent, CardDescription, CardFooter,
  CardHeader, CardTitle
} from "@/components/ui/card"
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger, DialogClose,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

// === Types ===
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

type MonthData = {
  month: string
  salary: number
  expenses: Expense[]
  fixedExpenses: FixedExpense[]
}

// Pour l'affichage de la liste de mois
type AllData = {
  months: MonthData[]
}

export default function ExpenseTracker() {
  // NEW: liste de tous les mois disponibles
  const [allMonths, setAllMonths] = useState<string[]>([])

  // Le mois sélectionné
  const [month, setMonth] = useState("")
  const [salary, setSalary] = useState("")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Toast
  const { toast } = useToast()

  // Form states pour une nouvelle dépense
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("alimentation")

  // Form states pour une nouvelle charge fixe
  const [fixedAmount, setFixedAmount] = useState("")
  const [fixedDescription, setFixedDescription] = useState("")
  const [isExceptional, setIsExceptional] = useState(false)
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null)

  // Filtre par catégorie
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Catégories
  const categories = [
    { id: "alimentation", name: "Alimentation" },
    { id: "transport", name: "Transport" },
    { id: "loisirs", name: "Loisirs" },
    { id: "restaurant", name: "Restaurant" },
    { id: "shopping", name: "Shopping" },
    { id: "sante", name: "Santé" },
    { id: "epargne", name: "Epargne" },
    { id: "autres", name: "Autres" },
  ]

  // =========================
  // 1. Charger la liste de tous les mois
  // =========================
  async function fetchAllMonths() {
    try {
      setIsLoading(true)
      const res = await fetch("/api/expenses") // sans paramètre → AllData
      if (!res.ok) throw new Error("Erreur lors du chargement de la liste des mois")

      const data: AllData = await res.json()
      const monthsList = data.months.map((m) => m.month)
      setAllMonths(monthsList)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erreur",
        description: "Impossible de charger la liste des mois.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // =========================
  // 2. Charger un mois précis
  // =========================
  async function fetchMonthData(selectedMonth: string) {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/expenses?month=${selectedMonth}`)
      if (!res.ok) {
        throw new Error("Mois introuvable")
      }
      const data: MonthData = await res.json()

      setMonth(data.month)
      setSalary(data.salary.toString())
      setExpenses(data.expenses)
      setFixedExpenses(data.fixedExpenses)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erreur",
        description: `Impossible de charger le mois ${selectedMonth}`,
        variant: "destructive",
      })
      // On réinitialise si échec
      setMonth("")
      setSalary("")
      setExpenses([])
      setFixedExpenses([])
    } finally {
      setIsLoading(false)
    }
  }

  // =========================
  // 3. Au chargement, récupérer la liste de tous les mois
  // =========================
  useEffect(() => {
    fetchAllMonths()
  }, [])

  // =========================
  // 4. saveData: POST (ajout / maj du mois)
  // =========================
  async function saveData(
    newExpenses: Expense[],
    newFixedExpenses: FixedExpense[],
    newMonth: string = month,
    newSalary: number = parseFloat(salary)
  ) {
    if (!newMonth) {
      toast({ title: "Choisissez un mois", variant: "destructive" })
      return false
    }

    try {
      setIsLoading(true)
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: newMonth,
          salary: newSalary,
          expenses: newExpenses,
          fixedExpenses: newFixedExpenses,
        }),
      })
      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde des données")
      }
      // Mise à jour de la liste des mois si besoin
      await fetchAllMonths()
      return true
    } catch (error) {
      console.error(error)
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les données.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // =========================
  // 5. Gérer la création d'un nouveau mois
  // =========================
  const [newMonthInput, setNewMonthInput] = useState("")
  const [newMonthSalary, setNewMonthSalary] = useState("")

  async function createNewMonth(e: FormEvent) {
    e.preventDefault()
    if (!newMonthInput || !newMonthSalary) return

    const monthData: MonthData = {
      month: newMonthInput,
      salary: parseFloat(newMonthSalary),
      expenses: [],
      fixedExpenses: [],
    }
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(monthData),
    })
    if (response.ok) {
      toast({ title: `Mois ${newMonthInput} créé !` })
      // Refresh la liste des mois et sélectionne ce nouveau mois
      await fetchAllMonths()
      setNewMonthInput("")
      setNewMonthSalary("")
    } else {
      toast({
        title: "Erreur",
        description: "Impossible de créer ce mois.",
        variant: "destructive",
      })
    }
  }

  // =========================
  // 6. Ajout d'une dépense
  // =========================
  async function addExpense(e: FormEvent) {
    e.preventDefault()
    if (!amount || !description) return

    const newExpense: Expense = {
      id: Date.now().toString(),
      amount: Number.parseFloat(amount),
      description,
      category,
      date: new Date().toISOString().split("T")[0],
    }

    const newExpenses = [newExpense, ...expenses]
    const success = await saveData(newExpenses, fixedExpenses)
    if (success) {
      setExpenses(newExpenses)
      setAmount("")
      setDescription("")
      setCategory("alimentation")

      toast({
        title: "Dépense ajoutée",
        description: "Votre dépense a été enregistrée avec succès.",
      })
    }
  }

  // =========================
  // 7. Ajout d'une charge fixe
  // =========================
  async function addFixedExpense(e: FormEvent) {
    e.preventDefault()
    if (!fixedAmount || !fixedDescription) return

    const newFixedExpense: FixedExpense = {
      id: Date.now().toString(),
      amount: Number.parseFloat(fixedAmount),
      description: fixedDescription,
    }

    const newFixedExpenses = [...fixedExpenses, newFixedExpense]
    const success = await saveData(expenses, newFixedExpenses)
    if (success) {
      setFixedExpenses(newFixedExpenses)
      setFixedAmount("")
      setFixedDescription("")
      toast({
        title: "Charge fixe ajoutée",
        description: "Votre charge fixe a été enregistrée avec succès.",
      })
    }
  }

  // =========================
  // 8. Suppression d'une dépense
  // =========================
  async function deleteExpense(id: string) {
    const newExpenses = expenses.filter((exp) => exp.id !== id)
    const success = await saveData(newExpenses, fixedExpenses)
    if (success) {
      setExpenses(newExpenses)
      toast({ title: "Dépense supprimée" })
    }
  }

  // =========================
  // 9. Suppression d'une charge fixe
  // =========================
  async function deleteFixedExpense(id: string) {
    const newFixedExpenses = fixedExpenses.filter((exp) => exp.id !== id)
    const success = await saveData(expenses, newFixedExpenses)
    if (success) {
      setFixedExpenses(newFixedExpenses)
      toast({ title: "Charge fixe supprimée" })
    }
  }

  // =========================
  // 10. Edition d'une charge fixe
  // =========================
  function startEditFixedExpense(expense: FixedExpense) {
    setEditingFixedExpense(expense)
    setFixedAmount(expense.amount.toString())
    setFixedDescription(expense.description)
    setIsExceptional(expense.isExceptional || false)
  }

  async function saveEditFixedExpense() {
    if (!editingFixedExpense || !fixedAmount || !fixedDescription) return false

    const updatedFixed = fixedExpenses.map((exp) =>
      exp.id === editingFixedExpense.id
        ? { ...exp, amount: parseFloat(fixedAmount), description: fixedDescription, isExceptional }
        : exp
    )
    const success = await saveData(expenses, updatedFixed)
    if (success) {
      setFixedExpenses(updatedFixed)
      setEditingFixedExpense(null)
      setFixedAmount("")
      setFixedDescription("")
      setIsExceptional(false)
      toast({ title: "Charge fixe modifiée" })
      return true
    }
    return false
  }

  // =========================
  // 11. Calculs
  // =========================
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const totalFixedExpenses = fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
  const totalAll = totalExpenses + totalFixedExpenses
  const numericSalary = parseFloat(salary) || 0
  const balance = numericSalary - totalAll

  // Filtrer par catégorie
  const filteredExpenses = selectedCategory
    ? expenses.filter((exp) => exp.category === selectedCategory)
    : expenses

  // Répartition par catégorie
  const expensesByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount
    return acc
  }, {} as Record<string, number>)

  // =========================
  // Rendu
  // =========================
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Suivi des Dépenses (Multi-mois)</h1>

      {/* === Sélection & création d'un mois === */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Gestion des mois</CardTitle>
          <CardDescription>
            Sélectionner un mois existant ou en créer un nouveau
          </CardDescription>
        </CardHeader>
        <CardContent>
  <div className="flex flex-col md:flex-row gap-4">
    {/* Sélection d'un mois existant */}
    <div>
      <Label>Mois disponible :</Label>
      <div className="flex items-center gap-2">
        <Select
          onValueChange={(val) => {
            fetchMonthData(val)
          }}
        >
          <SelectTrigger className="w-[200px] mt-1">
            <SelectValue placeholder="Choisir un mois" />
          </SelectTrigger>
          <SelectContent>
            {allMonths.length === 0 && (
              <SelectItem value="all" disabled>Aucun mois</SelectItem>
            )}
            {allMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Bouton supprimer à côté */}
        {month && (
            <Button
            variant="destructive"
            size="icon"
            onClick={async () => {
              if (confirm(`Supprimer le mois ${month} ?`)) {
              const res = await fetch(`/api/expenses?month=${month}`, {
                method: "DELETE",
              })
              if (res.ok) {
                toast({ title: `Mois ${month} supprimé` })
                setMonth("")
                setSalary("")
                setExpenses([])
                setFixedExpenses([])
                fetchAllMonths()
              } else {
                toast({
                title: "Erreur",
                description: "Impossible de supprimer ce mois",
                variant: "destructive",
                })
              }
              }
            }}
            >
            <Trash2 className="h-4 w-4" />
            </Button>
        )}
      </div>
    </div>

    {/* Création d'un nouveau mois */}
    <form onSubmit={createNewMonth} className="flex flex-col md:flex-row gap-2 items-end">
      <div>
        <Label htmlFor="newMonthInput">Nouveau mois (YYYY-MM)</Label>
        <Input
          id="newMonthInput"
          placeholder="2025-05"
          value={newMonthInput}
          onChange={(e) => setNewMonthInput(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="newMonthSalary">Salaire (€)</Label>
        <Input
          id="newMonthSalary"
          type="number"
          placeholder="2000"
          value={newMonthSalary}
          onChange={(e) => setNewMonthSalary(e.target.value)}
        />
      </div>
      <Button type="submit" className="mt-4 md:mt-6">
        Créer
      </Button>
    </form>
  </div>
</CardContent>

      </Card>

      {/* Si aucun mois n'est chargé, on arrête là */}
      {month === "" ? (
        <p className="text-center text-muted-foreground">
          Sélectionnez un mois pour afficher ou modifier ses dépenses
        </p>
      ) : (
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid grid-cols-4 mb-8">
            <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
            <TabsTrigger value="expenses">Dépenses</TabsTrigger>
            <TabsTrigger value="fixed">Charges fixes</TabsTrigger>
            <TabsTrigger value="add">Ajouter</TabsTrigger>
          </TabsList>

          {/* === Dashboard === */}
          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Salaire & Paramètres du mois */}
              <Card>
                <CardHeader>
                  <CardTitle>Paramètres du mois</CardTitle>
                  <CardDescription>Modifier salaire & mois</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const success = await saveData(expenses, fixedExpenses, month, parseFloat(salary))
                      if (success) {
                        toast({ title: "Paramètres mis à jour" })
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="month">Mois (YYYY-MM)</Label>
                      <Input
                        id="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="salary">Salaire (€)</Label>
                      <Input
                        id="salary"
                        type="number"
                        step="0.01"
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                      />
                    </div>
                    <Button type="submit">Enregistrer</Button>
                  </form>
                </CardContent>
              </Card>

              {/* Dépenses Variables */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Dépenses Variables</CardTitle>
                  <CardDescription>Total</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalExpenses.toFixed(2)} €</p>
                </CardContent>
              </Card>

              {/* Charges Fixes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Charges Fixes</CardTitle>
                  <CardDescription>Total</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalFixedExpenses.toFixed(2)} €</p>
                </CardContent>
              </Card>
            </div>

            {/* Bilan */}
            <Card>
              <CardHeader>
                <CardTitle>Bilan</CardTitle>
                <CardDescription>Différence entre Salaire et Dépenses</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  Reste : {balance.toFixed(2)} €
                </p>
              </CardContent>
            </Card>

            {/* Répartition & dernières dépenses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Répartition par catégorie</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.entries(expensesByCategory).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(expensesByCategory).map(([cat, amount]) => {
                        const categoryName = categories.find((c) => c.id === cat)?.name || cat
                        const percentage = (amount / totalExpenses) * 100 || 0

                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between">
                              <span>{categoryName}</span>
                              <span>
                                {amount.toFixed(2)} € ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-primary h-2.5 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Aucune dépense enregistrée</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dernières dépenses</CardTitle>
                </CardHeader>
                <CardContent>
                  {expenses.length > 0 ? (
                    <div className="space-y-4">
                      {expenses.slice(0, 5).map((expense) => (
                        <div key={expense.id} className="flex justify-between items-center border-b pb-2">
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {categories.find((c) => c.id === expense.category)?.name} • {expense.date}
                            </p>
                          </div>
                          <p className="font-semibold">{expense.amount.toFixed(2)} €</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Aucune dépense enregistrée</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === Expenses Tab === */}
          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>Liste des dépenses</CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-4 mt-2">
                    <Label htmlFor="filter">Filtrer par catégorie:</Label>
                    <Select
                      value={selectedCategory || ""}
                      onValueChange={(value) => {
                        if (value === "all") setSelectedCategory(null)
                        else setSelectedCategory(value)
                      }}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Toutes les catégories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredExpenses.length > 0 ? (
                  <div className="space-y-4">
                    {filteredExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex justify-between items-center border-b pb-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{expense.description}</p>
                            <Badge variant="outline">
                              {categories.find((c) => c.id === expense.category)?.name}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{expense.date}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="font-semibold">{expense.amount.toFixed(2)} €</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteExpense(expense.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Aucune dépense trouvée</p>
                )}
              </CardContent>
              <CardFooter>
                <p className="text-sm text-muted-foreground">
                  Total: {filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)} €
                </p>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* === Fixed Tab === */}
          <TabsContent value="fixed">
            <Card>
              <CardHeader>
                <CardTitle>Charges fixes mensuelles</CardTitle>
                <CardDescription>Dépenses récurrentes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fixedExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex justify-between items-center border-b pb-3"
                    >
                      <div>
                        <p className="font-medium">{expense.description}</p>
                        {expense.isExceptional && (
                          <Badge variant="outline" className="bg-amber-100">
                            Exceptionnel ce mois
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold">{expense.amount.toFixed(2)} €</p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEditFixedExpense(expense)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Modifier une charge fixe</DialogTitle>
                              <DialogDescription>
                                Modifiez les détails de cette charge fixe
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="fixed-amount-edit">Montant (€)</Label>
                                <Input
                                  id="fixed-amount-edit"
                                  type="number"
                                  step="0.01"
                                  value={fixedAmount}
                                  onChange={(e) => setFixedAmount(e.target.value)}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="fixed-description-edit">Description</Label>
                                <Input
                                  id="fixed-description-edit"
                                  value={fixedDescription}
                                  onChange={(e) => setFixedDescription(e.target.value)}
                                />
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="exceptional"
                                  checked={isExceptional}
                                  onChange={(e) => setIsExceptional(e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <Label htmlFor="exceptional">Exceptionnel ce mois-ci</Label>
                              </div>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button
                                  onClick={async (event) => {
                                    const success = await saveEditFixedExpense()
                                    if (!success) {
                                      event.preventDefault() // Empêche la fermeture du modal si erreur
                                    }
                                  }}
                                >
                                  Enregistrer
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteFixedExpense(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Formulaire d'ajout de charge fixe */}
                  <form
                    onSubmit={addFixedExpense}
                    className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4"
                  >
                    <div>
                      <Label htmlFor="fixed-amount">Montant (€)</Label>
                      <Input
                        id="fixed-amount"
                        type="number"
                        step="0.01"
                        placeholder="50.00"
                        value={fixedAmount}
                        onChange={(e) => setFixedAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="fixed-description">Description</Label>
                      <Input
                        id="fixed-description"
                        placeholder="Abonnement téléphone"
                        value={fixedDescription}
                        onChange={(e) => setFixedDescription(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" className="w-full">
                        <Plus className="mr-2 h-4 w-4" /> Ajouter
                      </Button>
                    </div>
                  </form>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-sm text-muted-foreground">
                  Total mensuel: {totalFixedExpenses.toFixed(2)} €
                </p>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* === Add Tab === */}
          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle>Ajouter une dépense</CardTitle>
                <CardDescription>Enregistrez une nouvelle dépense</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={addExpense} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Montant (€)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder="15.99"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Catégorie</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="Courses au supermarché"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Ajouter la dépense
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
