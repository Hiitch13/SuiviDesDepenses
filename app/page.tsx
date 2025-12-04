"use client"

import { useState, useEffect, FormEvent } from "react"
import { Plus, Edit, Trash2, User, LogOut, Wallet, Lock } from "lucide-react"
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
  user?: string
  month: string
  salary: number
  expenses: Expense[]
  fixedExpenses: FixedExpense[]
}

type AllData = {
  months: MonthData[]
}

export default function ExpenseTracker() {
  // === STATE UTILISATEUR ===
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  
  // Champs Login
  const [usernameInput, setUsernameInput] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

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
  // 0. Gestion Utilisateur (LOGIN AVEC MDP)
  // =========================
  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    if (!usernameInput.trim() || !passwordInput.trim()) {
        toast({ title: "Champs requis", description: "Veuillez entrer un pseudo et un mot de passe", variant: "destructive" })
        return
    }

    setIsLoggingIn(true)
    try {
        const res = await fetch("/api/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                isAuth: true, 
                username: usernameInput.trim(), 
                password: passwordInput.trim() 
            })
        })

        const data = await res.json()

        if (res.ok) {
            setCurrentUser(usernameInput.trim())
            toast({ title: data.message })
            
            // Reset datas
            setMonth("")
            setSalary("")
            setExpenses([])
            setFixedExpenses([])
        } else {
            toast({ title: "Erreur", description: data.error, variant: "destructive" })
        }

    } catch (error) {
        console.error(error)
        toast({ title: "Erreur réseau", description: "Impossible de se connecter", variant: "destructive" })
    } finally {
        setIsLoggingIn(false)
    }
  }

  function handleLogout() {
    setCurrentUser(null)
    setAllMonths([])
    setMonth("")
    setPasswordInput("")
    setUsernameInput("")
  }

  // =========================
  // 1. Charger la liste de tous les mois
  // =========================
  async function fetchAllMonths() {
    if (!currentUser) return 

    try {
      setIsLoading(true)
      const res = await fetch(`/api/expenses?user=${currentUser}`)
      if (!res.ok) throw new Error("Erreur chargement")

      const data: AllData = await res.json()
      const monthsList = data.months.map((m) => m.month)
      setAllMonths(monthsList)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // =========================
  // 2. Charger un mois précis
  // =========================
  async function fetchMonthData(selectedMonth: string) {
    if (!currentUser) return

    try {
      setIsLoading(true)
      const res = await fetch(`/api/expenses?month=${selectedMonth}&user=${currentUser}`)
      if (!res.ok) throw new Error("Mois introuvable")
      const data: MonthData = await res.json()

      setMonth(data.month)
      setSalary(data.salary.toString())
      setExpenses(data.expenses)
      setFixedExpenses(data.fixedExpenses)
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur", description: "Impossible de charger le mois", variant: "destructive" })
      setMonth("")
    } finally {
      setIsLoading(false)
    }
  }

  // =========================
  // 3. Effet au login
  // =========================
  useEffect(() => {
    if (currentUser) {
      fetchAllMonths()
    }
  }, [currentUser])

  // =========================
  // 4. saveData
  // =========================
  async function saveData(
    newExpenses: Expense[],
    newFixedExpenses: FixedExpense[],
    newMonth: string = month,
    newSalary: number = parseFloat(salary)
  ) {
    if (!newMonth || !currentUser) return false

    try {
      setIsLoading(true)
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: currentUser, 
          month: newMonth,
          salary: newSalary,
          expenses: newExpenses,
          fixedExpenses: newFixedExpenses,
        }),
      })
      if (!response.ok) throw new Error("Erreur sauvegarde")
      
      await fetchAllMonths()
      return true
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // =========================
  // 5. Création mois
  // =========================
  const [newMonthInput, setNewMonthInput] = useState("")
  const [newMonthSalary, setNewMonthSalary] = useState("")

  async function createNewMonth(e: FormEvent) {
    e.preventDefault()
    if (!newMonthInput || !newMonthSalary || !currentUser) return

    const monthData: MonthData = {
      user: currentUser,
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
      toast({ title: "Mois créé !" })
      await fetchAllMonths()
      setNewMonthInput("")
      setNewMonthSalary("")
    } else {
      toast({ title: "Erreur", description: "Impossible de créer ce mois.", variant: "destructive" })
    }
  }

  // =========================
  // 6 à 10. CRUD Dépenses
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
      setAmount(""); setDescription(""); setCategory("alimentation");
      toast({ title: "Dépense ajoutée" })
    }
  }

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
      setFixedAmount(""); setFixedDescription("");
      toast({ title: "Charge fixe ajoutée" })
    }
  }

  async function deleteExpense(id: string) {
    const newExpenses = expenses.filter((exp) => exp.id !== id)
    const success = await saveData(newExpenses, fixedExpenses)
    if (success) { setExpenses(newExpenses); toast({ title: "Supprimé" }) }
  }

  async function deleteFixedExpense(id: string) {
    const newFixedExpenses = fixedExpenses.filter((exp) => exp.id !== id)
    const success = await saveData(expenses, newFixedExpenses)
    if (success) { setFixedExpenses(newFixedExpenses); toast({ title: "Supprimé" }) }
  }

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
      setEditingFixedExpense(null); setFixedAmount(""); setFixedDescription(""); setIsExceptional(false);
      toast({ title: "Modifié" })
      return true
    }
    return false
  }

  // =========================
  // 11. Calculs
  // =========================
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0)
  const totalFixedExpenses = fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
  const numericSalary = parseFloat(salary) || 0
  const balance = numericSalary - (totalExpenses + totalFixedExpenses)

  const filteredExpenses = selectedCategory
    ? expenses.filter((exp) => exp.category === selectedCategory)
    : expenses

  const expensesByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount
    return acc
  }, {} as Record<string, number>)


  // =========================
  // RENDU : ECRAN DE CONNEXION
  // =========================
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Connexion</CardTitle>
            <CardDescription className="text-center">
              Entrez votre pseudo et mot de passe.<br/>
              <span className="text-xs text-muted-foreground">(Si le compte n'existe pas, il sera créé automatiquement)</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nom d'utilisateur</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="Ex: Alex"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="pl-10"
                    disabled={isLoggingIn}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="pl-10"
                        disabled={isLoggingIn}
                    />
                </div>
              </div>
              <Button type="submit" className="w-full h-10" disabled={isLoggingIn}>
                {isLoggingIn ? "Vérification..." : "Accéder à mes comptes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // =========================
  // RENDU : APPLICATION PRINCIPALE
  // =========================
  return (
    <div className="container mx-auto py-8 px-4 relative">
      {/* Header User */}
      <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold uppercase">
            {currentUser.charAt(0)}
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Utilisateur</p>
            <p className="font-bold text-lg">{currentUser}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Déconnexion
        </Button>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-center">Suivi des Dépenses</h1>

      {/* === Sélection & création d'un mois === */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Gestion des mois</CardTitle>
          <CardDescription>
            Gérez vos mois personnels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Sélection d'un mois existant */}
            <div>
              <Label>Mois disponible :</Label>
              <div className="flex items-center gap-2">
                <Select
                  onValueChange={fetchMonthData}
                  value={month}
                >
                  <SelectTrigger className="w-[200px] mt-1">
                    <SelectValue placeholder="Choisir un mois" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMonths.length === 0 && (
                      <SelectItem value="none" disabled>Aucun mois trouvé</SelectItem>
                    )}
                    {allMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {month && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={async () => {
                      if (confirm(`Supprimer le mois ${month} ?`)) {
                        const res = await fetch(`/api/expenses?month=${month}&user=${currentUser}`, {
                          method: "DELETE",
                        })
                        if (res.ok) {
                          toast({ title: `Mois ${month} supprimé` })
                          setMonth(""); setSalary(""); setExpenses([]); setFixedExpenses([]);
                          fetchAllMonths()
                        } else {
                          toast({ title: "Erreur suppression", variant: "destructive" })
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
            <form onSubmit={createNewMonth} className="flex flex-col md:flex-row gap-2 items-end flex-1 justify-end">
              <div>
                <Label htmlFor="newMonthInput">Nouveau mois</Label>
                <Input
                  id="newMonthInput"
                  placeholder="2025-05"
                  value={newMonthInput}
                  onChange={(e) => setNewMonthInput(e.target.value)}
                  className="w-32"
                />
              </div>
              <div>
                <Label htmlFor="newMonthSalary">Salaire</Label>
                <Input
                  id="newMonthSalary"
                  type="number"
                  placeholder="2000"
                  value={newMonthSalary}
                  onChange={(e) => setNewMonthSalary(e.target.value)}
                  className="w-24"
                />
              </div>
              <Button type="submit">Créer</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Si aucun mois n'est chargé */}
      {month === "" ? (
        <p className="text-center text-muted-foreground py-10">
          Sélectionnez un mois ci-dessus pour commencer
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-green-50 border-green-200">
                 <CardHeader className="pb-2">
                   <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                     <Wallet className="h-4 w-4" /> Revenus
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                   <p className="text-2xl font-bold text-green-800">{numericSalary.toFixed(2)} €</p>
                 </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Dépenses Variables</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totalExpenses.toFixed(2)} €</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Charges Fixes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totalFixedExpenses.toFixed(2)} €</p>
                </CardContent>
              </Card>

              <Card className={`${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm font-medium ${balance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    Reste à vivre
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-800' : 'text-red-800'}`}>
                    {balance.toFixed(2)} €
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card>
                <CardHeader>
                  <CardTitle>Ajustements</CardTitle>
                  <CardDescription>Modifier le salaire du mois</CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const success = await saveData(expenses, fixedExpenses, month, parseFloat(salary))
                      if (success) toast({ title: "Salaire mis à jour" })
                    }}
                    className="flex gap-2 items-end"
                  >
                    <div className="flex-1">
                      <Label htmlFor="salary-edit">Nouveau montant</Label>
                      <Input
                        id="salary-edit"
                        type="number"
                        step="0.01"
                        value={salary}
                        onChange={(e) => setSalary(e.target.value)}
                      />
                    </div>
                    <Button type="submit" variant="secondary"><Edit className="h-4 w-4" /></Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Répartition</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.entries(expensesByCategory).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(expensesByCategory).map(([cat, amount]) => {
                        const categoryName = categories.find((c) => c.id === cat)?.name || cat
                        const percentage = (amount / totalExpenses) * 100 || 0
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{categoryName}</span>
                              <span>{amount.toFixed(2)} € ({percentage.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-primary h-2 rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : <p className="text-muted-foreground text-sm">Rien à afficher</p>}
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