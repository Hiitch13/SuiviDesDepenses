"use client"

import { useState, useEffect, FormEvent } from "react"
import { 
  Plus, 
  Edit, 
  Trash2, 
  User, 
  LogOut, 
  Wallet, 
  Lock, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  PieChart as PieChartIcon, 
  ArrowRight, 
  DollarSign, 
  Activity, 
  CheckCircle2,
  Search
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter,
  CardHeader, 
  CardTitle
} from "@/components/ui/card"
import {
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger
} from "@/components/ui/tabs"
import {
  Select, 
  SelectContent, 
  SelectItem,
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select"
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

// Import Recharts (Graphiques)
// Assurez-vous d'avoir fait : npm install recharts
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend 
} from "recharts"

// === PALETTE DE COULEURS ===
const COLORS = [
  '#3b82f6', // Bleu
  '#10b981', // Emeraude
  '#f59e0b', // Ambre
  '#ef4444', // Rouge
  '#8b5cf6', // Violet
  '#ec4899', // Rose
  '#6366f1', // Indigo
  '#64748b'  // Gris
];

// === TYPES ===
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
  // ==========================================
  // 1. STATES (États de l'application)
  // ==========================================
  
  // Utilisateur courant
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  
  // Login / Auth
  const [usernameInput, setUsernameInput] = useState("")
  const [passwordInput, setPasswordInput] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Données Globales
  const [allMonths, setAllMonths] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Données du Mois Sélectionné
  const [month, setMonth] = useState("")
  const [salary, setSalary] = useState("")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])

  // UI & Feedback
  const { toast } = useToast()
  
  // Formulaires : Ajout Dépense
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("alimentation")
  
  // Formulaires : Charges Fixes
  const [fixedAmount, setFixedAmount] = useState("")
  const [fixedDescription, setFixedDescription] = useState("")
  const [isExceptional, setIsExceptional] = useState(false)
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null)
  
  // Filtres
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  
  // Formulaire : Nouveau Mois
  const [newMonthInput, setNewMonthInput] = useState("")
  const [newMonthSalary, setNewMonthSalary] = useState("")

  // Configuration des catégories
  const categories = [
    { id: "alimentation", name: "Alimentation", color: COLORS[0] },
    { id: "transport", name: "Transport", color: COLORS[1] },
    { id: "loisirs", name: "Loisirs", color: COLORS[2] },
    { id: "restaurant", name: "Restaurant", color: COLORS[3] },
    { id: "shopping", name: "Shopping", color: COLORS[4] },
    { id: "sante", name: "Santé", color: COLORS[5] },
    { id: "epargne", name: "Epargne", color: COLORS[6] },
    { id: "autres", name: "Autres", color: COLORS[7] },
  ]

  // ==========================================
  // 2. AUTHENTIFICATION
  // ==========================================
  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    
    if (!usernameInput.trim() || !passwordInput.trim()) {
        toast({ 
          title: "Champs requis", 
          description: "Veuillez entrer un pseudo et un mot de passe.", 
          variant: "destructive" 
        })
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
            toast({ 
              title: "Bienvenue !", 
              description: "Connexion réussie." 
            })
            // Réinitialiser les données locales
            setMonth("")
            setSalary("")
            setExpenses([])
            setFixedExpenses([])
        } else {
            toast({ 
              title: "Accès refusé", 
              description: data.error || "Erreur inconnue", 
              variant: "destructive" 
            })
        }
    } catch (error) {
        console.error(error)
        toast({ 
          title: "Erreur réseau", 
          description: "Impossible de joindre le serveur.", 
          variant: "destructive" 
        })
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

  // ==========================================
  // 3. CHARGEMENT DES DONNÉES (API)
  // ==========================================
  
  // Charger la liste des mois disponibles
  async function fetchAllMonths() {
    if (!currentUser) return 
    try {
      setIsLoading(true)
      const res = await fetch(`/api/expenses?user=${currentUser}`)
      if (!res.ok) throw new Error("Erreur lors du chargement")
      
      const data: AllData = await res.json()
      setAllMonths(data.months.map((m) => m.month))
    } catch (error) { 
      console.error(error) 
    } finally { 
      setIsLoading(false) 
    }
  }

  // Charger un mois spécifique
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
      toast({ 
        title: "Erreur", 
        description: "Impossible de charger les données du mois.", 
        variant: "destructive" 
      })
      setMonth("")
    } finally { 
      setIsLoading(false) 
    }
  }

  // Charger les mois dès que l'utilisateur est connecté
  useEffect(() => { 
    if (currentUser) {
      fetchAllMonths()
    }
  }, [currentUser])

  // ==========================================
  // 4. SAUVEGARDE (API)
  // ==========================================
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
          fixedExpenses: newFixedExpenses 
        }),
      })

      if (!response.ok) throw new Error("Erreur sauvegarde")
      
      await fetchAllMonths()
      return true
    } catch (error) {
      console.error(error)
      toast({ 
        title: "Erreur", 
        description: "La sauvegarde a échoué.", 
        variant: "destructive" 
      })
      return false
    } finally { 
      setIsLoading(false) 
    }
  }

  // ==========================================
  // 5. GESTION DU MOIS (Création / Suppression)
  // ==========================================
  async function createNewMonth(e: FormEvent) {
    e.preventDefault()
    if (!newMonthInput || !newMonthSalary || !currentUser) return
    
    const monthData: MonthData = { 
      user: currentUser, 
      month: newMonthInput, 
      salary: parseFloat(newMonthSalary), 
      expenses: [], 
      fixedExpenses: [] 
    }

    const response = await fetch("/api/expenses", { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify(monthData) 
    })

    if (response.ok) {
      toast({ title: "Nouveau mois créé !" })
      await fetchAllMonths()
      setNewMonthInput("")
      setNewMonthSalary("")
    } else { 
      toast({ title: "Erreur lors de la création", variant: "destructive" }) 
    }
  }

  async function deleteMonth() {
    if (!month || !currentUser) return
    
    if (confirm(`Êtes-vous sûr de vouloir supprimer le mois ${month} ?`)) {
       const res = await fetch(`/api/expenses?month=${month}&user=${currentUser}`, { 
         method: "DELETE" 
       })
       
       if (res.ok) {
         toast({ title: "Mois supprimé" })
         setMonth("")
         setSalary("")
         setExpenses([])
         setFixedExpenses([])
         fetchAllMonths()
       } else {
         toast({ title: "Erreur suppression", variant: "destructive" })
       }
    }
  }

  // ==========================================
  // 6. GESTION DES DÉPENSES
  // ==========================================
  async function addExpense(e: FormEvent) {
    e.preventDefault()
    if (!amount || !description) return

    const newExp: Expense = { 
      id: Date.now().toString(), 
      amount: parseFloat(amount), 
      description, 
      category, 
      date: new Date().toISOString().split("T")[0] 
    }

    const newExps = [newExp, ...expenses]
    
    if (await saveData(newExps, fixedExpenses)) {
      setExpenses(newExps)
      setAmount("")
      setDescription("")
      setCategory("alimentation")
      toast({ title: "Dépense ajoutée" })
    }
  }

  async function deleteExpense(id: string) {
    const newExps = expenses.filter((e) => e.id !== id)
    if (await saveData(newExps, fixedExpenses)) { 
      setExpenses(newExps)
      toast({ title: "Dépense supprimée" }) 
    }
  }

  // ==========================================
  // 7. GESTION DES CHARGES FIXES
  // ==========================================
  async function addFixedExpense(e: FormEvent) {
    e.preventDefault()
    if (!fixedAmount || !fixedDescription) return

    const newFixed: FixedExpense = { 
      id: Date.now().toString(), 
      amount: parseFloat(fixedAmount), 
      description: fixedDescription 
    }

    const newFixedList = [...fixedExpenses, newFixed]
    
    if (await saveData(expenses, newFixedList)) {
      setFixedExpenses(newFixedList)
      setFixedAmount("")
      setFixedDescription("")
      toast({ title: "Charge ajoutée" })
    }
  }

  async function deleteFixedExpense(id: string) {
    const newFixed = fixedExpenses.filter((e) => e.id !== id)
    if (await saveData(expenses, newFixed)) { 
      setFixedExpenses(newFixed)
      toast({ title: "Charge supprimée" }) 
    }
  }

  function startEditFixedExpense(fx: FixedExpense) {
    setEditingFixedExpense(fx)
    setFixedAmount(fx.amount.toString())
    setFixedDescription(fx.description)
    setIsExceptional(fx.isExceptional || false)
  }

  async function saveEditFixedExpense() {
    if (!editingFixedExpense || !fixedAmount || !fixedDescription) return false
    
    const updated = fixedExpenses.map((e) => 
      e.id === editingFixedExpense.id 
        ? { ...e, amount: parseFloat(fixedAmount), description: fixedDescription, isExceptional } 
        : e
    )
    
    if (await saveData(expenses, updated)) {
      setFixedExpenses(updated)
      setEditingFixedExpense(null)
      setFixedAmount("")
      setFixedDescription("")
      setIsExceptional(false)
      toast({ title: "Charge modifiée" })
      return true
    } 
    return false
  }

  // ==========================================
  // 8. CALCULS & STATISTIQUES
  // ==========================================
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalFixed = fixedExpenses.reduce((sum, e) => sum + e.amount, 0)
  const numericSalary = parseFloat(salary) || 0
  const totalOut = totalExpenses + totalFixed
  const balance = numericSalary - totalOut
  
  // Pour la barre de progression (max 100%)
  const progress = numericSalary > 0 ? (totalOut / numericSalary) * 100 : 0
  
  // Filtrage des dépenses
  const filteredExpenses = selectedCategory 
    ? expenses.filter((e) => e.category === selectedCategory) 
    : expenses
  
  // Préparation des données pour le graphique Recharts
  const chartData = categories.map(cat => {
    const val = expenses
      .filter(e => e.category === cat.id)
      .reduce((acc, curr) => acc + curr.amount, 0)
    return { name: cat.name, value: val, color: cat.color }
  }).filter(item => item.value > 0)

  // ==========================================
  // 9. RENDU : PAGE DE CONNEXION
  // ==========================================
  if (!currentUser) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        {/* Partie Gauche : Image / Branding */}
        <div className="hidden lg:flex w-1/2 bg-slate-900 items-center justify-center relative overflow-hidden">
             <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=3000&auto=format&fit=crop')] bg-cover bg-center" />
             <div className="relative z-10 text-white p-12">
                 <h2 className="text-4xl font-bold mb-6">Maîtrisez vos finances.</h2>
                 <p className="text-lg text-slate-300">
                   Une solution simple et élégante pour suivre vos dépenses, gérer vos charges et épargner sereinement.
                 </p>
                 <div className="mt-8 flex gap-4">
                     <div className="flex items-center gap-2 text-sm text-slate-400">
                       <CheckCircle2 className="h-4 w-4 text-emerald-500"/> Multi-utilisateurs
                     </div>
                     <div className="flex items-center gap-2 text-sm text-slate-400">
                       <CheckCircle2 className="h-4 w-4 text-emerald-500"/> Sécurisé
                     </div>
                     <div className="flex items-center gap-2 text-sm text-slate-400">
                       <CheckCircle2 className="h-4 w-4 text-emerald-500"/> Analytique
                     </div>
                 </div>
             </div>
        </div>

        {/* Partie Droite : Formulaire */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
            <Card className="w-full max-w-md shadow-xl border-none bg-white/80 backdrop-blur-sm">
              <CardHeader className="space-y-1">
                  <CardTitle className="text-2xl font-bold text-center">Connexion</CardTitle>
                  <CardDescription className="text-center">
                    Entrez vos identifiants pour accéder à votre espace
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Identifiant</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input 
                              id="username" 
                              placeholder="Pseudo" 
                              value={usernameInput} 
                              onChange={(e) => setUsernameInput(e.target.value)} 
                              className="pl-10 h-11" 
                              disabled={isLoggingIn} 
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Mot de passe</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input 
                              id="password" 
                              type="password" 
                              placeholder="••••••••" 
                              value={passwordInput} 
                              onChange={(e) => setPasswordInput(e.target.value)} 
                              className="pl-10 h-11" 
                              disabled={isLoggingIn} 
                            />
                        </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-11 bg-slate-900 hover:bg-slate-800 transition-all" 
                      disabled={isLoggingIn}
                    >
                        {isLoggingIn ? "Authentification..." : "Se connecter"} 
                        <ArrowRight className="ml-2 h-4 w-4"/>
                    </Button>
                  </form>
              </CardContent>
            </Card>
        </div>
      </div>
    )
  }

  // ==========================================
  // 10. RENDU : APPLICATION PRINCIPALE
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      
      {/* --- NAVBAR --- */}
      <nav className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-md px-4 py-3 shadow-sm">
        <div className="container mx-auto flex justify-between items-center max-w-7xl">
             <div className="flex items-center gap-2">
                 <div className="bg-slate-900 p-2 rounded-lg">
                   <Wallet className="h-5 w-5 text-white" />
                 </div>
                 <span className="font-bold text-lg text-slate-800 hidden md:block">
                   FinancePro
                 </span>
             </div>
             <div className="flex items-center gap-4">
                 <div className="flex flex-col text-right">
                     <span className="text-xs text-slate-500">Compte</span>
                     <span className="text-sm font-semibold text-slate-900">{currentUser}</span>
                 </div>
                 <div className="h-9 w-9 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shadow-md uppercase">
                     {currentUser.charAt(0)}
                 </div>
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   onClick={handleLogout} 
                   className="text-slate-500 hover:text-red-600 transition-colors"
                 >
                     <LogOut className="h-5 w-5" />
                 </Button>
             </div>
        </div>
      </nav>

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        
        {/* --- HEADER & SÉLECTEUR DE MOIS --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tableau de Bord</h1>
                <p className="text-slate-500 mt-1">
                  Aperçu financier pour <span className="font-semibold text-slate-700">{month || "..."}</span>
                </p>
            </div>
            
            <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                <Select onValueChange={fetchMonthData} value={month}>
                  <SelectTrigger className="w-[160px] border-none shadow-none focus:ring-0 font-medium">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMonths.length === 0 && <SelectItem value="none" disabled>Aucun mois</SelectItem>}
                    {allMonths.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>

                {month && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-red-500" 
                      onClick={deleteMonth}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}

                <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-slate-900 text-white shadow-sm hover:bg-slate-800">
                        <Plus className="h-4 w-4 mr-1"/> Nouveau
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Créer un nouveau mois</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={createNewMonth} className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Mois (YYYY-MM)</Label>
                                  <Input 
                                    placeholder="2025-06" 
                                    value={newMonthInput} 
                                    onChange={e => setNewMonthInput(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Salaire Est.</Label>
                                  <Input 
                                    type="number" 
                                    placeholder="2000" 
                                    value={newMonthSalary} 
                                    onChange={e => setNewMonthSalary(e.target.value)}
                                  />
                                </div>
                            </div>
                            <Button type="submit" className="w-full bg-slate-900">Créer</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </div>

        {/* --- CONTENU PRINCIPAL --- */}
        {month === "" ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed rounded-xl shadow-sm">
                <div className="bg-slate-50 p-4 rounded-full mb-4">
                  <Calendar className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">Aucune donnée affichée</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm text-center">
                  Sélectionnez un mois existant dans le menu ci-dessus ou créez-en un nouveau pour commencer.
                </p>
            </div>
        ) : (
            <>
            {/* KPI CARDS (Indicateurs Clés) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                
                {/* 1. Revenus */}
                <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Revenus Nets</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{numericSalary.toFixed(2)} €</div>
                        <div className="flex items-center text-xs text-emerald-600 mt-1 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                            <TrendingUp className="h-3 w-3 mr-1" /> Entrées
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Charges Fixes */}
                <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Charges Fixes</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Activity className="h-4 w-4 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{totalFixed.toFixed(2)} €</div>
                        <p className="text-xs text-slate-500 mt-1">Récurrent mensuel</p>
                    </CardContent>
                </Card>

                {/* 3. Dépenses Variables */}
                <Card className="shadow-sm border-slate-200 hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Dépenses Variables</CardTitle>
                        <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                          <PieChartIcon className="h-4 w-4 text-orange-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{totalExpenses.toFixed(2)} €</div>
                        <p className="text-xs text-slate-500 mt-1">{expenses.length} transaction(s)</p>
                    </CardContent>
                </Card>

                {/* 4. Reste à Vivre (Balance) */}
                <Card className={`shadow-sm border-slate-200 hover:shadow-md transition-shadow ${balance < 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Reste à Vivre</CardTitle>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${balance < 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
                             <Wallet className={`h-4 w-4 ${balance < 0 ? 'text-red-600' : 'text-slate-900'}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {balance.toFixed(2)} €
                        </div>
                        {balance < 0 ? (
                            <div className="flex items-center text-xs text-red-600 mt-1 bg-red-100 w-fit px-2 py-0.5 rounded-full">
                                <TrendingDown className="h-3 w-3 mr-1" /> Attention
                            </div>
                        ) : (
                            <div className="flex items-center text-xs text-slate-500 mt-1">
                                <div className="h-1.5 w-16 bg-slate-200 rounded-full overflow-hidden mr-2">
                                    <div className="h-full bg-slate-900 rounded-full" style={{width: `${Math.min(progress, 100)}%`}}/>
                                </div>
                                {Math.round(progress)}% utilisé
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* --- ONGLETS / TABS --- */}
            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="bg-white border p-1 rounded-xl shadow-sm w-full md:w-auto grid grid-cols-4 md:flex h-auto">
                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Vue d'ensemble
                    </TabsTrigger>
                    <TabsTrigger value="expenses" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Dépenses
                    </TabsTrigger>
                    <TabsTrigger value="fixed" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Charges Fixes
                    </TabsTrigger>
                    <TabsTrigger value="add" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Ajout Rapide
                    </TabsTrigger>
                </TabsList>

                {/* --- CONTENU ONGLET 1 : VUE D'ENSEMBLE --- */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Bloc : Ajustement Salaire */}
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader>
                              <CardTitle>Ajustement Revenus</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form 
                                  onSubmit={async (e) => { 
                                    e.preventDefault(); 
                                    if (await saveData(expenses, fixedExpenses, month, parseFloat(salary))) {
                                      toast({title:"Salaire mis à jour"})
                                    }
                                  }} 
                                  className="flex gap-2"
                                >
                                    <Input 
                                      type="number" 
                                      value={salary} 
                                      onChange={e => setSalary(e.target.value)} 
                                      className="font-mono bg-slate-50" 
                                    />
                                    <Button variant="outline" type="submit">
                                      <Edit className="h-4 w-4"/>
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* Bloc : Graphique Camembert */}
                        <Card className="lg:col-span-2 shadow-sm border-slate-200">
                            <CardHeader>
                                <CardTitle>Répartition des Dépenses</CardTitle>
                                <CardDescription>Analyse par catégorie</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                {chartData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                              data={chartData} 
                                              cx="50%" 
                                              cy="50%" 
                                              innerRadius={60} 
                                              outerRadius={80} 
                                              paddingAngle={5} 
                                              dataKey="value"
                                            >
                                                {chartData.map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip 
                                              formatter={(value: number) => `${value.toFixed(2)} €`} 
                                              contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} 
                                            />
                                            <Legend 
                                              verticalAlign="middle" 
                                              align="right" 
                                              layout="vertical" 
                                              iconType="circle" 
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                      Pas assez de données pour le graphique
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Bloc : Dernières Transactions */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                          <CardTitle>Dernières transactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-0">
                                {expenses.slice(0, 5).map((exp, i) => (
                                    <div 
                                      key={exp.id} 
                                      className={`flex items-center justify-between py-4 ${i !== expenses.slice(0,5).length-1 ? 'border-b border-slate-100' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                {exp.category === "alimentation" ? "🍎" : exp.category === "transport" ? "🚗" : "💸"}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900">{exp.description}</p>
                                                <p className="text-xs text-slate-500">
                                                  {new Date(exp.date).toLocaleDateString('fr-FR', {day: 'numeric', month: 'long'})} • {categories.find(c=>c.id===exp.category)?.name}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="font-bold text-slate-900">-{exp.amount.toFixed(2)} €</span>
                                    </div>
                                ))}
                                {expenses.length === 0 && (
                                  <p className="text-center text-slate-500 py-4">Aucune transaction récente.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- CONTENU ONGLET 2 : LISTE COMPLÈTE --- */}
                <TabsContent value="expenses">
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                              <CardTitle>Historique Dépenses</CardTitle>
                              <CardDescription>Liste complète des transactions</CardDescription>
                            </div>
                            <Select 
                              value={selectedCategory || "all"} 
                              onValueChange={v => setSelectedCategory(v === "all" ? null : v)}
                            >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="Filtrer par catégorie" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">Tout voir</SelectItem>
                                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                {filteredExpenses.map((exp) => (
                                    <div 
                                      key={exp.id} 
                                      className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900">{exp.description}</span>
                                            <div className="flex gap-2 text-xs text-slate-500 items-center mt-1">
                                                <Badge 
                                                  variant="secondary" 
                                                  className="font-normal" 
                                                  style={{
                                                    backgroundColor: categories.find(c=>c.id===exp.category)?.color + '20', 
                                                    color: categories.find(c=>c.id===exp.category)?.color
                                                  }}
                                                >
                                                    {categories.find(c=>c.id===exp.category)?.name}
                                                </Badge>
                                                <span>{exp.date}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-mono font-bold">-{exp.amount.toFixed(2)} €</span>
                                            <Button 
                                              size="icon" 
                                              variant="ghost" 
                                              className="h-8 w-8 text-slate-400 hover:text-red-500" 
                                              onClick={() => deleteExpense(exp.id)}
                                            >
                                              <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {filteredExpenses.length === 0 && (
                                  <div className="p-8 text-center text-slate-500">Aucun résultat trouvé</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- CONTENU ONGLET 3 : CHARGES FIXES --- */}
                <TabsContent value="fixed">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Liste des charges */}
                        <div className="md:col-span-2 space-y-4">
                            {fixedExpenses.map((fx) => (
                                <Card 
                                  key={fx.id} 
                                  className="shadow-sm border-slate-200 group hover:border-slate-300 transition-all"
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                              <Activity className="h-5 w-5"/>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">{fx.description}</p>
                                                {fx.isExceptional && (
                                                  <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 mt-1">
                                                    Ponctuel
                                                  </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-lg">{fx.amount.toFixed(2)} €</span>
                                            
                                            {/* Boutons d'action (visibles au survol) */}
                                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                      <Button 
                                                        size="icon" 
                                                        variant="ghost" 
                                                        className="h-8 w-8" 
                                                        onClick={() => { 
                                                          setEditingFixedExpense(fx); 
                                                          setFixedAmount(fx.amount.toString()); 
                                                          setFixedDescription(fx.description); 
                                                          setIsExceptional(fx.isExceptional || false) 
                                                        }}
                                                      >
                                                        <Edit className="h-4 w-4"/>
                                                      </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                          <DialogTitle>Modifier Charge</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="space-y-4 py-4">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                  <Label>Montant</Label>
                                                                  <Input 
                                                                    type="number" 
                                                                    value={fixedAmount} 
                                                                    onChange={e => setFixedAmount(e.target.value)} 
                                                                  />
                                                                </div>
                                                                <div className="space-y-2">
                                                                  <Label>Nom</Label>
                                                                  <Input 
                                                                    value={fixedDescription} 
                                                                    onChange={e => setFixedDescription(e.target.value)} 
                                                                  />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                              <input 
                                                                type="checkbox" 
                                                                id="exep" 
                                                                checked={isExceptional} 
                                                                onChange={e => setIsExceptional(e.target.checked)} 
                                                                className="rounded border-slate-300"
                                                              />
                                                              <Label htmlFor="exep">Exceptionnel ce mois-ci</Label>
                                                            </div>
                                                            <Button onClick={saveEditFixedExpense} className="w-full">
                                                              Enregistrer
                                                            </Button>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                                <Button 
                                                  size="icon" 
                                                  variant="ghost" 
                                                  className="h-8 w-8 hover:text-red-500" 
                                                  onClick={() => deleteFixedExpense(fx.id)}
                                                >
                                                  <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                            {fixedExpenses.length === 0 && (
                              <div className="text-center p-10 border-2 border-dashed rounded-xl text-slate-400">
                                Aucune charge fixe définie
                              </div>
                            )}
                        </div>
                        
                        {/* Formulaire ajout rapide */}
                        <Card className="h-fit shadow-sm border-slate-200 bg-slate-50/50">
                            <CardHeader>
                              <CardTitle className="text-sm uppercase tracking-wide text-slate-500">
                                Nouvelle Charge
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={addFixedExpense} className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Montant (€)</Label>
                                      <Input 
                                        type="number" 
                                        step="0.01" 
                                        value={fixedAmount} 
                                        onChange={e => setFixedAmount(e.target.value)} 
                                        className="bg-white"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Description</Label>
                                      <Input 
                                        placeholder="Ex: Netflix" 
                                        value={fixedDescription} 
                                        onChange={e => setFixedDescription(e.target.value)} 
                                        className="bg-white"
                                      />
                                    </div>
                                    <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800">
                                      Ajouter
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- CONTENU ONGLET 4 : AJOUTER DÉPENSE --- */}
                <TabsContent value="add">
                    <div className="max-w-xl mx-auto">
                        <Card className="shadow-lg border-slate-200">
                            <CardHeader className="text-center bg-slate-50 border-b pb-6">
                                <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-2">
                                  <Plus className="h-6 w-6 text-green-700"/>
                                </div>
                                <CardTitle>Nouvelle Dépense</CardTitle>
                                <CardDescription>Ajoutez une transaction rapidement</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <form onSubmit={addExpense} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">Montant</Label>
                                            <div className="relative">
                                              <span className="absolute left-3 top-2.5 text-slate-400">€</span>
                                              <Input 
                                                type="number" 
                                                step="0.01" 
                                                className="pl-8 text-lg font-semibold" 
                                                placeholder="0.00" 
                                                value={amount} 
                                                onChange={e => setAmount(e.target.value)} 
                                                autoFocus 
                                              />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-600">Catégorie</Label>
                                            <Select value={category} onValueChange={setCategory}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600">Description</Label>
                                        <Input 
                                          placeholder="Ex: Courses Carrefour..." 
                                          value={description} 
                                          onChange={e => setDescription(e.target.value)} 
                                        />
                                    </div>
                                    <Button 
                                      type="submit" 
                                      size="lg" 
                                      className="w-full bg-slate-900 hover:bg-slate-800 text-white"
                                    >
                                      Valider la dépense
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
            </>
        )}
      </div>
    </div>
  )
}