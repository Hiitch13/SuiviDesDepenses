"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

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

export default function ExpenseTracker() {
  // State for expenses
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Toast notifications
  const { toast } = useToast()

  // Form states
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("alimentation")

  // Fixed expense form states
  const [fixedAmount, setFixedAmount] = useState("")
  const [fixedDescription, setFixedDescription] = useState("")

  // Edit fixed expense
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null)
  const [isExceptional, setIsExceptional] = useState(false)

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Categories
  const categories = [
    { id: "alimentation", name: "Alimentation" },
    { id: "transport", name: "Transport" },
    { id: "loisirs", name: "Loisirs" },
    { id: "restaurant", name: "Restaurant" },
    { id: "shopping", name: "Shopping" },
    { id: "sante", name: "Santé" },
    { id: "autres", name: "Autres" },
  ]

  // Load data from server on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch("/api/expenses")

        if (!response.ok) {
          throw new Error("Erreur lors du chargement des données")
        }

        const data: ExpenseData = await response.json()

        setExpenses(data.expenses || [])
        setFixedExpenses(data.fixedExpenses || [])
      } catch (error) {
        console.error("Erreur:", error)
        toast({
          title: "Erreur",
          description: "Impossible de charger vos données. Veuillez réessayer.",
          variant: "destructive",
        })

        // Fallback to empty arrays
        setExpenses([])
        setFixedExpenses([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [toast])

  // Save data to server
  const saveData = async (newExpenses: Expense[], newFixedExpenses: FixedExpense[]) => {
    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expenses: newExpenses,
          fixedExpenses: newFixedExpenses,
        }),
      })

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde des données")
      }

      return true
    } catch (error) {
      console.error("Erreur:", error)
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder vos données. Veuillez réessayer.",
        variant: "destructive",
      })
      return false
    }
  }

  // Add a new expense
  const addExpense = async (e: React.FormEvent) => {
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

      // Reset form
      setAmount("")
      setDescription("")
      setCategory("alimentation")

      toast({
        title: "Dépense ajoutée",
        description: "Votre dépense a été enregistrée avec succès.",
      })
    }
  }

  // Add a new fixed expense
  const addFixedExpense = async (e: React.FormEvent) => {
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

      // Reset form
      setFixedAmount("")
      setFixedDescription("")

      toast({
        title: "Charge fixe ajoutée",
        description: "Votre charge fixe a été enregistrée avec succès.",
      })
    }
  }

  // Delete an expense
  const deleteExpense = async (id: string) => {
    const newExpenses = expenses.filter((expense) => expense.id !== id)

    const success = await saveData(newExpenses, fixedExpenses)
    if (success) {
      setExpenses(newExpenses)

      toast({
        title: "Dépense supprimée",
        description: "La dépense a été supprimée avec succès.",
      })
    }
  }

  // Delete a fixed expense
  const deleteFixedExpense = async (id: string) => {
    const newFixedExpenses = fixedExpenses.filter((expense) => expense.id !== id)

    const success = await saveData(expenses, newFixedExpenses)
    if (success) {
      setFixedExpenses(newFixedExpenses)

      toast({
        title: "Charge fixe supprimée",
        description: "La charge fixe a été supprimée avec succès.",
      })
    }
  }

  // Start editing a fixed expense
  const startEditFixedExpense = (expense: FixedExpense) => {
    setEditingFixedExpense(expense)
    setFixedAmount(expense.amount.toString())
    setFixedDescription(expense.description)
    setIsExceptional(expense.isExceptional || false)
  }

  // Save edited fixed expense
  const saveEditFixedExpense = async () => {
    if (!editingFixedExpense || !fixedAmount || !fixedDescription) return

    const updatedExpenses = fixedExpenses.map((expense) =>
      expense.id === editingFixedExpense.id
        ? {
            ...expense,
            amount: Number.parseFloat(fixedAmount),
            description: fixedDescription,
            isExceptional,
          }
        : expense,
    )

    const success = await saveData(expenses, updatedExpenses)
    if (success) {
      setFixedExpenses(updatedExpenses)
      setEditingFixedExpense(null)
      setFixedAmount("")
      setFixedDescription("")
      setIsExceptional(false)

      toast({
        title: "Charge fixe modifiée",
        description: "La charge fixe a été modifiée avec succès.",
      })
    }
  }

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalFixedExpenses = fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const totalAll = totalExpenses + totalFixedExpenses

  // Filter expenses by category
  const filteredExpenses = selectedCategory
    ? expenses.filter((expense) => expense.category === selectedCategory)
    : expenses

  // Group expenses by category for summary
  const expensesByCategory = expenses.reduce(
    (acc, expense) => {
      if (!acc[expense.category]) {
        acc[expense.category] = 0
      }
      acc[expense.category] += expense.amount
      return acc
    },
    {} as Record<string, number>,
  )

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Chargement de vos données...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Suivi des Dépenses</h1>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger value="dashboard">Tableau de bord</TabsTrigger>
          <TabsTrigger value="expenses">Dépenses</TabsTrigger>
          <TabsTrigger value="fixed">Charges fixes</TabsTrigger>
          <TabsTrigger value="add">Ajouter</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Dépenses Variables</CardTitle>
                <CardDescription>Total ce mois-ci</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalExpenses.toFixed(2)} €</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Charges Fixes</CardTitle>
                <CardDescription>Total mensuel</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalFixedExpenses.toFixed(2)} €</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Total</CardTitle>
                <CardDescription>Toutes dépenses</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalAll.toFixed(2)} €</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Répartition par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(expensesByCategory).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(expensesByCategory).map(([cat, amount]) => {
                      const categoryName = categories.find((c) => c.id === cat)?.name || cat
                      const percentage = (amount / totalExpenses) * 100

                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex justify-between">
                            <span>{categoryName}</span>
                            <span>
                              {amount.toFixed(2)} € ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
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

        {/* Expenses Tab */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>Liste des dépenses</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4 mt-2">
                  <Label htmlFor="filter">Filtrer par catégorie:</Label>
                  <Select value={selectedCategory || ""} onValueChange={(value) => setSelectedCategory(value || null)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Toutes les catégories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les catégories</SelectItem>
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
                    <div key={expense.id} className="flex justify-between items-center border-b pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{expense.description}</p>
                          <Badge variant="outline">{categories.find((c) => c.id === expense.category)?.name}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{expense.date}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold">{expense.amount.toFixed(2)} €</p>
                        <Button variant="ghost" size="icon" onClick={() => deleteExpense(expense.id)}>
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
                Total: {filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0).toFixed(2)} €
              </p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Fixed Expenses Tab */}
        <TabsContent value="fixed">
          <Card>
            <CardHeader>
              <CardTitle>Charges fixes mensuelles</CardTitle>
              <CardDescription>Dépenses récurrentes chaque mois</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fixedExpenses.map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center border-b pb-3">
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
                          <Button variant="ghost" size="icon" onClick={() => startEditFixedExpense(expense)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Modifier une charge fixe</DialogTitle>
                            <DialogDescription>Modifiez les détails de cette charge fixe</DialogDescription>
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
                              <Label htmlFor="exceptional">Montant exceptionnel ce mois-ci</Label>
                            </div>
                          </div>
                          <DialogFooter>
  {/* DialogClose va fermer le modal par défaut */}
  <DialogClose asChild>
    <Button
      onClick={async (event) => {
        const success = await saveEditFixedExpense()
        if (!success) {
          // En cas d’erreur, on empêche la fermeture
          event.preventDefault()
        }
      }}
    >
      Enregistrer
    </Button>
  </DialogClose>
</DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => deleteFixedExpense(expense.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <form onSubmit={addFixedExpense} className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-sm text-muted-foreground">Total mensuel: {totalFixedExpenses.toFixed(2)} €</p>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Add Expense Tab */}
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
    </div>
  )
}

