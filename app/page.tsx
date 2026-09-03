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
  Search,
  Target,
  Plane,
  ShoppingBag,
  Rocket,
  PiggyBank
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
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"

// Import Recharts (Graphiques)
// Assurez-vous d'avoir fait : npm install recharts
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine
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

type Category = {
  id: string
  name: string
  color: string
}

type MonthData = {
  user?: string
  month: string
  salary: number
  expenses: Expense[]
  fixedExpenses: FixedExpense[]
  savingsGoal?: number
}

type ProjectType = "voyage" | "achat" | "projet"

type Project = {
  id: string
  name: string
  amount: number
  targetMonth: string
  type: ProjectType
  included: boolean
}

type AllData = {
  months: MonthData[]
  customCategories?: Category[]
  categoryBudgets?: Record<string, number>
  projects?: Project[]
  initialSavings?: number
  initialSavingsMonth?: string
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
  const [allExpensesHistory, setAllExpensesHistory] = useState<Expense[]>([])
  const [allMonthsData, setAllMonthsData] = useState<MonthData[]>([])
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

  // Catégories personnalisées (ajoutées par l'utilisateur)
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState(COLORS[0])

  // Budgets mensuels par catégorie (optionnels)
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({})

  // Objectif d'épargne du mois
  const [savingsGoalInput, setSavingsGoalInput] = useState("0")

  // Projets & épargne (inspiré du budget foyer Excel)
  const [projects, setProjects] = useState<Project[]>([])
  const [initialSavings, setInitialSavings] = useState<number>(0)
  const [initialSavingsInput, setInitialSavingsInput] = useState("0")
  const [initialSavingsMonth, setInitialSavingsMonth] = useState<string>("")
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectAmount, setNewProjectAmount] = useState("")
  const [newProjectMonth, setNewProjectMonth] = useState("")
  const [newProjectType, setNewProjectType] = useState<ProjectType>("achat")

  // Bouton flottant d'ajout rapide
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  
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
  const [isNewMonthDialogOpen, setIsNewMonthDialogOpen] = useState(false)

  // Formulaire : Corriger la date du mois
  const [isEditMonthOpen, setIsEditMonthOpen] = useState(false)
  const [editMonthInput, setEditMonthInput] = useState("")

  // Configuration des catégories (catégories par défaut + catégories personnalisées de l'utilisateur)
  const defaultCategories: Category[] = [
    { id: "alimentation", name: "Alimentation", color: COLORS[0] },
    { id: "transport", name: "Transport", color: COLORS[1] },
    { id: "loisirs", name: "Loisirs", color: COLORS[2] },
    { id: "restaurant", name: "Restaurant", color: COLORS[3] },
    { id: "shopping", name: "Shopping", color: COLORS[4] },
    { id: "sante", name: "Santé", color: COLORS[5] },
    { id: "epargne", name: "Epargne", color: COLORS[6] },
    { id: "autres", name: "Autres", color: COLORS[7] },
  ]
  const categories = [...defaultCategories, ...customCategories]

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
            setSavingsGoalInput("0")
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
      setAllMonths(data.months.map((m) => m.month).sort())
      setAllExpensesHistory(data.months.flatMap((m) => m.expenses))
      setAllMonthsData(data.months)
      setCustomCategories(data.customCategories || [])
      setCategoryBudgets(data.categoryBudgets || {})
      setProjects(data.projects || [])
      setInitialSavings(data.initialSavings || 0)
      setInitialSavingsInput((data.initialSavings || 0).toString())
      setInitialSavingsMonth(data.initialSavingsMonth || "")
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
      setSavingsGoalInput((data.savingsGoal ?? 0).toString())
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
    newSalary: number = parseFloat(salary),
    newSavingsGoal: number = parseFloat(savingsGoalInput)
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
          savingsGoal: newSavingsGoal,
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

  // Suggère le mois suivant le dernier mois connu (reste modifiable librement)
  function getSuggestedNextMonth(): string {
    const reference = month || [...allMonths].sort().slice(-1)[0] || ""
    const [y, m] = reference.split("-").map(Number)
    if (!y || !m) return ""

    const nextDate = new Date(y, m, 1) // m est 1-indexé -> index 0-indexé du mois suivant
    const ny = nextDate.getFullYear()
    const nm = (nextDate.getMonth() + 1).toString().padStart(2, "0")
    return `${ny}-${nm}`
  }

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
      setIsNewMonthDialogOpen(false)
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

  // Corriger la date (YYYY-MM) du mois sélectionné : on recrée le mois sous la
  // nouvelle date avec les mêmes données, puis on supprime l'ancien.
  async function renameMonth(e: FormEvent) {
    e.preventDefault()
    if (!month || !currentUser) return

    const target = editMonthInput.trim()
    if (!/^\d{4}-\d{2}$/.test(target)) {
      toast({ title: "Format invalide", description: "Utilisez YYYY-MM (ex : 2026-09).", variant: "destructive" })
      return
    }
    if (target === month) {
      setIsEditMonthOpen(false)
      return
    }
    if (allMonths.includes(target)) {
      toast({ title: "Mois déjà existant", description: `${target} existe déjà.`, variant: "destructive" })
      return
    }

    try {
      setIsLoading(true)
      // 1. Créer/écraser le mois sous la nouvelle date avec les données actuelles
      const createRes = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: currentUser,
          month: target,
          salary: parseFloat(salary) || 0,
          expenses,
          fixedExpenses,
          savingsGoal: parseFloat(savingsGoalInput) || 0,
        }),
      })
      if (!createRes.ok) throw new Error("create")

      // 2. Supprimer l'ancien mois
      const delRes = await fetch(`/api/expenses?month=${month}&user=${currentUser}`, { method: "DELETE" })
      if (!delRes.ok) throw new Error("delete")

      // 3. Reporter la référence du solde de départ si elle pointait sur l'ancien mois
      if (initialSavingsMonth === month) {
        await saveProjects(projects, initialSavings, target)
        setInitialSavingsMonth(target)
      }

      toast({ title: "Date du mois corrigée", description: `${month} → ${target}` })
      setMonth(target)
      setIsEditMonthOpen(false)
      await fetchAllMonths()
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors de la modification", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  // ==========================================
  // 6. GESTION DES DÉPENSES
  // ==========================================
  // Logique partagée entre le formulaire d'ajout, les suggestions rapides et le bouton flottant
  async function logExpense(expAmount: number, expDescription: string, expCategory: string) {
    if (!expAmount) return false

    const newExp: Expense = {
      id: Date.now().toString(),
      amount: expAmount,
      description: expDescription.trim() || categories.find(c => c.id === expCategory)?.name || "Dépense",
      category: expCategory,
      date: new Date().toISOString().split("T")[0]
    }

    const newExps = [newExp, ...expenses]

    if (await saveData(newExps, fixedExpenses)) {
      setExpenses(newExps)

      // Le total post-ajout doit venir de newExps (données fraîches), jamais de `expenses`
      // juste après un setState, dont la mise à jour n'est pas synchrone.
      const budget = categoryBudgets[expCategory]
      const categoryTotal = newExps
        .filter(e => e.category === expCategory)
        .reduce((sum, e) => sum + e.amount, 0)

      if (budget && categoryTotal > budget) {
        toast({
          title: "Budget dépassé",
          description: `${categories.find(c => c.id === expCategory)?.name}: ${categoryTotal.toFixed(2)}€ / ${budget}€`,
          variant: "destructive",
        })
      } else {
        toast({ title: "Dépense ajoutée" })
      }
      return true
    }
    return false
  }

  async function addExpense(e: FormEvent) {
    e.preventDefault()
    if (!amount) return

    if (await logExpense(parseFloat(amount), description, category)) {
      setAmount("")
      setDescription("")
      setCategory("alimentation")
      setIsQuickAddOpen(false)
    }
  }

  async function quickLogSuggestion(sugg: { amount: number; description: string; category: string }) {
    await logExpense(sugg.amount, sugg.description, sugg.category)
  }

  async function deleteExpense(id: string) {
    const newExps = expenses.filter((e) => e.id !== id)
    if (await saveData(newExps, fixedExpenses)) {
      setExpenses(newExps)
      toast({ title: "Dépense supprimée" })
    }
  }

  // ==========================================
  // 6bis. GESTION DES CATÉGORIES PERSONNALISÉES
  // ==========================================
  async function saveCustomCategories(newList: Category[]) {
    if (!currentUser) return false
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isCategoryUpdate: true,
          username: currentUser,
          customCategories: newList,
        }),
      })
      return res.ok
    } catch (error) {
      console.error(error)
      return false
    }
  }

  async function addCustomCategory(e: FormEvent) {
    e.preventDefault()
    if (!newCategoryName.trim()) return

    const id = newCategoryName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    if (!id || categories.some((c) => c.id === id)) {
      toast({ title: "Cette catégorie existe déjà", variant: "destructive" })
      return
    }

    const newCat: Category = { id, name: newCategoryName.trim(), color: newCategoryColor }
    const newList = [...customCategories, newCat]

    if (await saveCustomCategories(newList)) {
      setCustomCategories(newList)
      setCategory(id)
      setNewCategoryName("")
      setNewCategoryColor(COLORS[0])
      toast({ title: "Catégorie ajoutée" })
    } else {
      toast({ title: "Erreur lors de l'ajout de la catégorie", variant: "destructive" })
    }
  }

  async function deleteCustomCategory(id: string) {
    const newList = customCategories.filter((c) => c.id !== id)
    if (await saveCustomCategories(newList)) {
      setCustomCategories(newList)
      if (category === id) setCategory("alimentation")
      toast({ title: "Catégorie supprimée" })
    } else {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" })
    }
  }

  async function saveCategoryBudgets(newBudgets: Record<string, number>) {
    if (!currentUser) return false
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBudgetUpdate: true,
          username: currentUser,
          categoryBudgets: newBudgets,
        }),
      })
      if (res.ok) {
        toast({ title: "Budgets enregistrés" })
      } else {
        toast({ title: "Erreur lors de l'enregistrement des budgets", variant: "destructive" })
      }
      return res.ok
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors de l'enregistrement des budgets", variant: "destructive" })
      return false
    }
  }

  // ==========================================
  // 6ter. GESTION DES PROJETS & DU SOLDE INITIAL
  // ==========================================
  async function saveProjects(
    newProjects: Project[],
    newInitialSavings: number = initialSavings,
    newInitialSavingsMonth: string = initialSavingsMonth
  ) {
    if (!currentUser) return false
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isProjectUpdate: true,
          username: currentUser,
          projects: newProjects,
          initialSavings: newInitialSavings,
          initialSavingsMonth: newInitialSavingsMonth,
        }),
      })
      return res.ok
    } catch (error) {
      console.error(error)
      return false
    }
  }

  async function addProject(e: FormEvent) {
    e.preventDefault()
    if (!newProjectName.trim() || !newProjectAmount || !newProjectMonth) {
      toast({ title: "Champs requis", description: "Nom, montant et mois cible sont obligatoires.", variant: "destructive" })
      return
    }

    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName.trim(),
      amount: parseFloat(newProjectAmount),
      targetMonth: newProjectMonth,
      type: newProjectType,
      included: true,
    }

    const newList = [...projects, newProject]
    if (await saveProjects(newList)) {
      setProjects(newList)
      setNewProjectName("")
      setNewProjectAmount("")
      setNewProjectMonth("")
      setNewProjectType("achat")
      toast({ title: "Projet ajouté" })
    } else {
      toast({ title: "Erreur lors de l'ajout du projet", variant: "destructive" })
    }
  }

  async function toggleProjectIncluded(id: string) {
    const newList = projects.map(p => p.id === id ? { ...p, included: !p.included } : p)
    setProjects(newList) // feedback immédiat pour la simulation
    if (!(await saveProjects(newList))) {
      toast({ title: "Erreur d'enregistrement", variant: "destructive" })
      setProjects(projects) // rollback
    }
  }

  async function deleteProject(id: string) {
    const newList = projects.filter(p => p.id !== id)
    if (await saveProjects(newList)) {
      setProjects(newList)
      toast({ title: "Projet supprimé" })
    } else {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" })
    }
  }

  async function saveInitialSavings() {
    const value = parseFloat(initialSavingsInput) || 0
    // On horodate le solde au mois de la fiche consultée : l'épargne est cumulée
    // à partir de ce mois (inclus). On colle ainsi à ce que l'utilisateur voit.
    const refMonth = month || currentMonthStr
    if (await saveProjects(projects, value, refMonth)) {
      setInitialSavings(value)
      setInitialSavingsMonth(refMonth)
      toast({ title: `Solde de départ enregistré (référence ${refMonth})` })
    } else {
      toast({ title: "Erreur d'enregistrement", variant: "destructive" })
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

  // Total dépensé par catégorie ce mois (pour les budgets et les conseils)
  const categorySpendById: Record<string, number> = {}
  categories.forEach(cat => {
    categorySpendById[cat.id] = expenses
      .filter(e => e.category === cat.id)
      .reduce((sum, e) => sum + e.amount, 0)
  })

  // Catégories en dépassement de budget (l'épargne n'est jamais un "dépassement")
  const overBudgetCategories = categories
    .filter(cat => cat.id !== "epargne" && categoryBudgets[cat.id] && categorySpendById[cat.id] > categoryBudgets[cat.id])
    .map(cat => ({ ...cat, spent: categorySpendById[cat.id], budget: categoryBudgets[cat.id] }))

  const hasAnyBudget = categories.some(cat => cat.id !== "epargne" && categoryBudgets[cat.id])

  // Rythme hebdomadaire : uniquement pertinent si le mois affiché est le mois réel en cours
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`
  let weeklyPacing: { isOver: boolean; value: number } | null = null
  if (month === currentMonthStr) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysRemaining = Math.round((lastDayOfMonth.getTime() - today.getTime()) / 86400000) + 1
    const weeksRemaining = Math.max(1, Math.ceil(daysRemaining / 7))
    weeklyPacing = balance >= 0
      ? { isOver: false, value: balance / weeksRemaining }
      : { isOver: true, value: Math.abs(balance) }
  }

  // Objectif d'épargne du mois (basé sur la catégorie "epargne" déjà utilisée pour logger l'épargne)
  const epargneTotal = categorySpendById["epargne"] || 0
  const savingsGoalNum = parseFloat(savingsGoalInput) || 0
  const savingsProgress = savingsGoalNum > 0 ? Math.min(100, (epargneTotal / savingsGoalNum) * 100) : 0

  // Suggestions de dépenses fréquentes (top 3 tous mois confondus, pour un relog en un clic).
  // Regroupées par catégorie + description uniquement (pas le montant) : une dépense récurrente
  // à prix variable (courses, essence...) ne doit pas être éclatée en une entrée par montant,
  // chacune ne comptant alors qu'une fois — ce qui laissait un achat ponctuel arriver à égalité
  // et gagner par hasard d'ordre. Le montant le plus récent est conservé pour le relog rapide.
  const expenseFrequency = new Map<string, { amount: number; description: string; category: string; count: number; lastDate: string }>()
  allExpensesHistory.forEach(e => {
    const key = `${e.category}|${e.description}`
    const existing = expenseFrequency.get(key)
    if (existing) {
      existing.count += 1
      if (e.date >= existing.lastDate) {
        existing.amount = e.amount
        existing.lastDate = e.date
      }
    } else {
      expenseFrequency.set(key, { amount: e.amount, description: e.description, category: e.category, count: 1, lastDate: e.date })
    }
  })
  const frequentSuggestions = Array.from(expenseFrequency.values())
    .filter(combo => combo.count >= 2 && categories.some(c => c.id === combo.category))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  // ==========================================
  // 8bis. PROJECTION D'ÉPARGNE & PROJETS
  // ==========================================
  // Épargne réelle de chaque mois = uniquement ce qui est explicitement rangé dans
  // la catégorie "Epargne" (via l'ajout rapide). Le reste à vivre n'est PAS compté.
  const netByMonth = new Map<string, number>()
  allMonthsData.forEach(m => {
    const net = m.expenses
      .filter(e => e.category === "epargne")
      .reduce((s, e) => s + e.amount, 0)
    netByMonth.set(m.month, net)
  })

  // Ajoute n mois à une chaîne "YYYY-MM"
  function addMonths(ym: string, n: number): string {
    const [y, mo] = ym.split("-").map(Number)
    const d = new Date(y, (mo - 1) + n, 1)
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`
  }

  const includedProjects = projects.filter(p => p.included)
  const hasStartingBalance = initialSavings > 0 && !!initialSavingsMonth

  // ANCRAGE DATÉ DU SOLDE DE DÉPART :
  // Le solde de départ est daté du mois où il a été renseigné pour la dernière
  // fois (initialSavingsMonth). On ancre la projection à ce mois, avec ce solde,
  // puis on ajoute l'épargne (catégorie "Epargne") du mois de référence INCLUS
  // et de tous les mois suivants.
  // Ainsi : "solde de départ + épargne depuis (et y compris) le mois renseigné".
  // Si aucun solde n'a jamais été renseigné, on repart du 1er mois connu à 0.
  let anchorMonth: string
  let anchorBalance: number

  if (hasStartingBalance) {
    anchorMonth = initialSavingsMonth
    anchorBalance = initialSavings
  } else {
    const recorded = [...netByMonth.keys()].sort()
    anchorMonth = recorded.length > 0 ? recorded[0] : currentMonthStr
    anchorBalance = 0
  }

  // Épargne mensuelle moyenne pour extrapoler les mois à venir, estimée sur les
  // mois enregistrés situés à partir de l'ancre (fenêtre d'observation réelle).
  const observedFromAnchor = [...netByMonth.keys()].filter(mo => mo >= anchorMonth)
  const avgNet = observedFromAnchor.length > 0
    ? observedFromAnchor.reduce((s, mo) => s + (netByMonth.get(mo) as number), 0) / observedFromAnchor.length
    : 0

  // Fin de la timeline : de l'ancre jusqu'au dernier mois avec données / dernière
  // échéance de projet inclus (les échéances passées sont ignorées).
  const endCandidates = [
    anchorMonth,
    currentMonthStr,
    ...[...netByMonth.keys()].filter(mo => mo >= anchorMonth),
    ...includedProjects.map(p => p.targetMonth).filter(mo => mo >= currentMonthStr),
  ].sort()
  const endMonth = endCandidates[endCandidates.length - 1]

  // Projets inclus (échéance >= mois en cours) regroupés par mois d'échéance
  const projectsByMonth = new Map<string, Project[]>()
  includedProjects.forEach(p => {
    if (p.targetMonth < currentMonthStr) return
    const arr = projectsByMonth.get(p.targetMonth) || []
    arr.push(p)
    projectsByMonth.set(p.targetMonth, arr)
  })

  // Simulation mois par mois du solde d'épargne cumulé à partir de l'ancre.
  // L'épargne du mois d'ancrage n'est pas ré-ajoutée (le solde est "à jour").
  const projectionData: { month: string; solde: number; projected: boolean }[] = []
  const projectFeasibility = new Map<string, boolean>()
  let runningBalance = anchorBalance
  {
    let cursor = anchorMonth
    let guard = 0
    while (cursor <= endMonth && guard < 600) {
      const isRecorded = netByMonth.has(cursor)
      // On n'extrapole (avgNet) que les mois STRICTEMENT futurs. Le mois en cours
      // et les mois passés sans donnée valent 0 (épargne réellement enregistrée).
      // L'épargne du mois d'ancrage est comptée elle aussi (référence incluse).
      const isFuture = cursor > currentMonthStr
      runningBalance += isRecorded
        ? (netByMonth.get(cursor) as number)
        : (isFuture ? avgNet : 0)
      // On règle les projets échéant ce mois-ci
      const due = projectsByMonth.get(cursor) || []
      due.forEach(p => {
        projectFeasibility.set(p.id, runningBalance >= p.amount)
        runningBalance -= p.amount
      })
      projectionData.push({
        month: cursor,
        solde: Math.round(runningBalance * 100) / 100,
        projected: isFuture && !isRecorded,
      })
      cursor = addMonths(cursor, 1)
      guard++
    }
  }

  // Épargne "actuelle" = solde de départ + épargne cumulée jusqu'au mois en cours
  // (soit la valeur de la projection au mois courant).
  const currentPoint = projectionData.find(p => p.month === currentMonthStr)
  const currentSavings = currentPoint ? currentPoint.solde : anchorBalance
  const projectedFinalSavings =
    projectionData.length > 0 ? projectionData[projectionData.length - 1].solde : currentSavings
  const hasNegativeProjection = projectionData.some(p => p.solde < 0)

  const projectTypeMeta: Record<ProjectType, { label: string; color: string }> = {
    voyage: { label: "Voyage", color: "#8b5cf6" },
    achat: { label: "Achat", color: "#f59e0b" },
    projet: { label: "Projet", color: "#3b82f6" },
  }
  const sortedProjects = [...projects].sort((a, b) => a.targetMonth.localeCompare(b.targetMonth))
  const totalIncludedProjects = includedProjects.reduce((s, p) => s + p.amount, 0)

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
                    <Dialog
                      open={isEditMonthOpen}
                      onOpenChange={(open) => {
                        setIsEditMonthOpen(open)
                        if (open) setEditMonthInput(month)
                      }}
                    >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-900"
                            title="Corriger la date du mois"
                          >
                              <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Corriger la date du mois</DialogTitle>
                              <DialogDescription>
                                Modifie l'année/le mois de cette fiche. Les données (salaire, dépenses, charges) sont conservées.
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={renameMonth} className="space-y-4 pt-2">
                                <div className="space-y-2">
                                  <Label>Mois (YYYY-MM)</Label>
                                  <Input
                                    placeholder="2026-09"
                                    value={editMonthInput}
                                    onChange={e => setEditMonthInput(e.target.value)}
                                    autoFocus
                                  />
                                </div>
                                <Button type="submit" className="w-full bg-slate-900" disabled={isLoading}>
                                  Enregistrer la correction
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}

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

                <Dialog
                  open={isNewMonthDialogOpen}
                  onOpenChange={(open) => {
                    setIsNewMonthDialogOpen(open)
                    if (open) {
                      setNewMonthInput(getSuggestedNextMonth())
                      setNewMonthSalary(salary || newMonthSalary)
                    }
                  }}
                >
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-slate-900 text-white shadow-sm hover:bg-slate-800">
                        <Plus className="h-4 w-4 mr-1"/> Nouveau
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Créer un nouveau mois</DialogTitle>
                          <DialogDescription>
                            Le mois suivant est proposé automatiquement, mais vous pouvez le modifier librement.
                          </DialogDescription>
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
                <TabsList className="bg-white border p-1 rounded-xl shadow-sm w-full md:w-auto grid grid-cols-3 md:grid-cols-5 md:flex h-auto">
                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Vue d'ensemble
                    </TabsTrigger>
                    <TabsTrigger value="expenses" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Dépenses
                    </TabsTrigger>
                    <TabsTrigger value="fixed" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Charges Fixes
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Projets & Épargne
                    </TabsTrigger>
                    <TabsTrigger value="add" className="rounded-lg data-[state=active]:bg-slate-900 data-[state=active]:text-white py-2">
                      Ajout Rapide
                    </TabsTrigger>
                </TabsList>

                {/* --- CONTENU ONGLET 1 : VUE D'ENSEMBLE --- */}
                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="flex flex-col gap-6">
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

                            {/* Bloc : Objectif d'épargne */}
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                  <CardTitle>Objectif d'Épargne</CardTitle>
                                  <CardDescription>Basé sur la catégorie "Epargne"</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <form
                                      onSubmit={async (e) => {
                                        e.preventDefault()
                                        if (await saveData(expenses, fixedExpenses, month, parseFloat(salary), parseFloat(savingsGoalInput))) {
                                          toast({ title: "Objectif d'épargne mis à jour" })
                                        }
                                      }}
                                      className="flex gap-2"
                                    >
                                        <Input
                                          type="number"
                                          value={savingsGoalInput}
                                          onChange={e => setSavingsGoalInput(e.target.value)}
                                          className="font-mono bg-slate-50"
                                        />
                                        <Button variant="outline" type="submit">
                                          <Edit className="h-4 w-4"/>
                                        </Button>
                                    </form>
                                    {savingsGoalNum > 0 && (
                                        <div>
                                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${savingsProgress}%` }} />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                              {epargneTotal.toFixed(2)} € / {savingsGoalNum.toFixed(2)} € épargnés
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

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

                    {/* Bloc : Conseils du mois */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                          <CardTitle>Conseils du mois</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {overBudgetCategories.length > 0 ? (
                                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                                    <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p>
                                      Vous avez dépassé votre budget en {" "}
                                      {overBudgetCategories.map((c, i) => (
                                        <span key={c.id} className="font-semibold">
                                          {c.name} ({c.spent.toFixed(2)} € / {c.budget} €){i < overBudgetCategories.length - 1 ? ", " : ""}
                                        </span>
                                      ))}.
                                    </p>
                                </div>
                            ) : hasAnyBudget ? (
                                <div className="flex items-start gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p>Bravo, vous respectez tous vos budgets ce mois-ci !</p>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">
                                  Définissez des budgets par catégorie (bouton + dans "Ajout Rapide") pour recevoir des conseils personnalisés.
                                </p>
                            )}

                            {weeklyPacing && (
                                weeklyPacing.isOver ? (
                                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
                                        <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" />
                                        <p>Vous êtes déjà en dépassement de {weeklyPacing.value.toFixed(2)} € pour ce mois.</p>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3">
                                        <Calendar className="h-4 w-4 mt-0.5 shrink-0" />
                                        <p>Il vous reste <span className="font-semibold">{weeklyPacing.value.toFixed(2)} €/semaine</span> pour finir le mois sereinement.</p>
                                    </div>
                                )
                            )}
                        </CardContent>
                    </Card>

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

                {/* --- CONTENU ONGLET : PROJETS & ÉPARGNE --- */}
                <TabsContent value="projects" className="space-y-6">
                    {/* KPIs épargne */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Solde de départ</CardTitle>
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                  <PiggyBank className="h-4 w-4 text-slate-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                          type="number"
                                          value={initialSavingsInput}
                                          onChange={e => setInitialSavingsInput(e.target.value)}
                                          className="font-mono bg-slate-50 pr-6"
                                        />
                                        <span className="absolute right-2 top-2.5 text-xs text-slate-400">€</span>
                                    </div>
                                    <Button variant="outline" size="icon" onClick={saveInitialSavings}>
                                      <Edit className="h-4 w-4"/>
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">
                                  Votre épargne réelle aujourd'hui{initialSavingsMonth ? ` (réf. ${initialSavingsMonth})` : ""}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Épargne actuelle</CardTitle>
                                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${currentSavings < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                  {currentSavings.toFixed(2)} €
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                  {hasStartingBalance
                                    ? `Départ ${anchorMonth} + épargne depuis`
                                    : "Cumul de l'épargne enregistrée"}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Projection finale</CardTitle>
                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Target className="h-4 w-4 text-blue-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${projectedFinalSavings < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                  {projectedFinalSavings.toFixed(2)} €
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Après projets inclus</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-500">Projets inclus</CardTitle>
                                <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
                                  <Rocket className="h-4 w-4 text-violet-600" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-900">{totalIncludedProjects.toFixed(2)} €</div>
                                <p className="text-xs text-slate-500 mt-1">{includedProjects.length} projet(s) actif(s)</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Projection cumulée */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader>
                            <CardTitle>Projection de l'épargne</CardTitle>
                            <CardDescription>
                              {hasStartingBalance
                                ? `Solde de départ (${anchorMonth}) + épargne « Epargne » depuis ce mois. `
                                : "Cumul de l'épargne « Epargne » mois par mois. "}
                              Les projets « inclus » sont déduits à leur échéance ; les mois à venir sont extrapolés à partir de votre épargne moyenne ({avgNet.toFixed(0)} €/mois).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[320px]">
                            {projectionData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={projectionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="soldeGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                                        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" width={55} />
                                        <RechartsTooltip
                                          formatter={(value: number) => [`${value.toFixed(2)} €`, "Solde"]}
                                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                                        <Area type="monotone" dataKey="solde" stroke="#10b981" strokeWidth={2} fill="url(#soldeGradient)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm text-center">
                                  Enregistrez au moins un mois ou ajoutez un projet pour voir la projection.
                                </div>
                            )}
                        </CardContent>
                        {hasNegativeProjection && (
                            <CardFooter>
                                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 w-full">
                                    <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p>Attention : votre solde d'épargne passe sous zéro sur la période. Décalez ou désactivez un projet pour rétablir l'équilibre.</p>
                                </div>
                            </CardFooter>
                        )}
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Liste des projets */}
                        <div className="md:col-span-2 space-y-4">
                            {sortedProjects.map((p) => {
                                const meta = projectTypeMeta[p.type]
                                const feasible = projectFeasibility.get(p.id)
                                const TypeIcon = p.type === "voyage" ? Plane : p.type === "achat" ? ShoppingBag : Rocket
                                return (
                                    <Card key={p.id} className={`shadow-sm border-slate-200 group ${!p.included ? 'opacity-60' : ''}`}>
                                        <CardContent className="p-4 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: meta.color + '20', color: meta.color }}>
                                                  <TypeIcon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                        <Badge variant="secondary" className="font-normal" style={{ backgroundColor: meta.color + '20', color: meta.color }}>
                                                          {meta.label}
                                                        </Badge>
                                                        <span className="text-xs text-slate-500">Échéance {p.targetMonth}</span>
                                                        {p.included && (
                                                          feasible ? (
                                                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Réalisable</Badge>
                                                          ) : (
                                                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Épargne insuffisante</Badge>
                                                          )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="font-bold text-lg">{p.amount.toFixed(2)} €</span>
                                                <div className="flex flex-col items-center">
                                                    <Switch checked={p.included} onCheckedChange={() => toggleProjectIncluded(p.id)} />
                                                    <span className="text-[10px] text-slate-400 mt-0.5">Inclus</span>
                                                </div>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                  onClick={() => deleteProject(p.id)}
                                                >
                                                  <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                            {projects.length === 0 && (
                              <div className="text-center p-10 border-2 border-dashed rounded-xl text-slate-400">
                                Aucun projet planifié. Ajoutez un voyage, un achat ou un projet à droite.
                              </div>
                            )}
                        </div>

                        {/* Formulaire nouveau projet */}
                        <Card className="h-fit shadow-sm border-slate-200 bg-slate-50/50">
                            <CardHeader>
                              <CardTitle className="text-sm uppercase tracking-wide text-slate-500">Nouveau projet</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={addProject} className="space-y-4">
                                    <div className="space-y-2">
                                      <Label>Nom</Label>
                                      <Input placeholder="Ex: Voyage Japon" value={newProjectName} onChange={e => setNewProjectName(e.target.value)} className="bg-white" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Type</Label>
                                      <Select value={newProjectType} onValueChange={(v) => setNewProjectType(v as ProjectType)}>
                                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="achat">Achat</SelectItem>
                                            <SelectItem value="voyage">Voyage</SelectItem>
                                            <SelectItem value="projet">Projet</SelectItem>
                                          </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Montant (€)</Label>
                                      <Input type="number" step="0.01" placeholder="1500" value={newProjectAmount} onChange={e => setNewProjectAmount(e.target.value)} className="bg-white" />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Mois cible (YYYY-MM)</Label>
                                      <Input placeholder="2027-06" value={newProjectMonth} onChange={e => setNewProjectMonth(e.target.value)} className="bg-white" />
                                    </div>
                                    <Button type="submit" className="w-full bg-slate-900 text-white hover:bg-slate-800">Ajouter le projet</Button>
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
                                {frequentSuggestions.length > 0 && (
                                    <div className="mb-6 space-y-2">
                                        <Label className="text-slate-500 text-xs uppercase tracking-wide">Suggestions rapides</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {frequentSuggestions.map((sugg, i) => (
                                                <button
                                                  key={i}
                                                  type="button"
                                                  onClick={() => quickLogSuggestion(sugg)}
                                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm transition-colors"
                                                >
                                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categories.find(c => c.id === sugg.category)?.color }} />
                                                    {sugg.description} · {sugg.amount.toFixed(2)}€
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                                            <div className="flex items-center justify-between">
                                                <Label className="text-slate-600">Catégorie</Label>
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button type="button" size="icon" variant="ghost" className="h-5 w-5 text-slate-400 hover:text-slate-900">
                                                          <Plus className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                          <DialogTitle>Gérer les catégories</DialogTitle>
                                                          <DialogDescription>Ajoutez vos propres catégories pour les ajouts rapides.</DialogDescription>
                                                        </DialogHeader>
                                                        <form onSubmit={addCustomCategory} className="space-y-4 pt-2">
                                                            <div className="space-y-2">
                                                              <Label>Nom de la catégorie</Label>
                                                              <Input
                                                                placeholder="Ex: Abonnements"
                                                                value={newCategoryName}
                                                                onChange={e => setNewCategoryName(e.target.value)}
                                                              />
                                                            </div>
                                                            <div className="space-y-2">
                                                              <Label>Couleur</Label>
                                                              <div className="flex gap-2 flex-wrap">
                                                                  {COLORS.map(c => (
                                                                    <button
                                                                      key={c}
                                                                      type="button"
                                                                      onClick={() => setNewCategoryColor(c)}
                                                                      className="h-7 w-7 rounded-full ring-offset-2 transition-all"
                                                                      style={{
                                                                        backgroundColor: c,
                                                                        boxShadow: newCategoryColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
                                                                      }}
                                                                    />
                                                                  ))}
                                                              </div>
                                                            </div>
                                                            <Button type="submit" className="w-full bg-slate-900">Ajouter la catégorie</Button>
                                                        </form>

                                                        {customCategories.length > 0 && (
                                                            <div className="pt-4 border-t space-y-2">
                                                                <Label className="text-slate-500 text-xs uppercase tracking-wide">Vos catégories</Label>
                                                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                                                    {customCategories.map(c => (
                                                                        <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-slate-50">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                                                                                <span className="text-sm text-slate-700">{c.name}</span>
                                                                            </div>
                                                                            <Button
                                                                              type="button"
                                                                              size="icon"
                                                                              variant="ghost"
                                                                              className="h-7 w-7 text-slate-400 hover:text-red-500"
                                                                              onClick={() => deleteCustomCategory(c.id)}
                                                                            >
                                                                              <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="pt-4 border-t space-y-2">
                                                            <Label className="text-slate-500 text-xs uppercase tracking-wide">Budgets mensuels (optionnel)</Label>
                                                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                                {categories.filter(c => c.id !== "epargne").map(c => (
                                                                    <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                                                            <span className="text-sm text-slate-700 truncate">{c.name}</span>
                                                                        </div>
                                                                        <div className="relative w-28 shrink-0">
                                                                            <Input
                                                                              type="number"
                                                                              min="0"
                                                                              placeholder="Aucun"
                                                                              className="h-8 text-sm pr-6"
                                                                              value={categoryBudgets[c.id] ?? ""}
                                                                              onChange={e => setCategoryBudgets(prev => ({ ...prev, [c.id]: parseFloat(e.target.value) || 0 }))}
                                                                            />
                                                                            <span className="absolute right-2 top-1.5 text-xs text-slate-400">€</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <Button
                                                              type="button"
                                                              variant="outline"
                                                              className="w-full"
                                                              onClick={() => saveCategoryBudgets(categoryBudgets)}
                                                            >
                                                              Enregistrer les budgets
                                                            </Button>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                            <Select value={category} onValueChange={setCategory}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-600">Description (optionnel)</Label>
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

      {/* --- BOUTON FLOTTANT D'AJOUT RAPIDE --- */}
      {month !== "" && (
          <Dialog
            open={isQuickAddOpen}
            onOpenChange={(open) => {
              setIsQuickAddOpen(open)
              if (!open) {
                setAmount("")
                setDescription("")
                setCategory("alimentation")
              }
            }}
          >
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajout rapide</DialogTitle>
                    <DialogDescription>Loggez une dépense en quelques secondes, depuis n'importe quel onglet.</DialogDescription>
                  </DialogHeader>

                  {frequentSuggestions.length > 0 && (
                      <div className="space-y-2">
                          <Label className="text-slate-500 text-xs uppercase tracking-wide">Suggestions rapides</Label>
                          <div className="flex flex-wrap gap-2">
                              {frequentSuggestions.map((sugg, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={async () => { await quickLogSuggestion(sugg); setIsQuickAddOpen(false) }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm transition-colors"
                                  >
                                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: categories.find(c => c.id === sugg.category)?.color }} />
                                      {sugg.description} · {sugg.amount.toFixed(2)}€
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  <form onSubmit={addExpense} className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label className="text-slate-600">Montant</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400">€</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="pl-8"
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
                          <Label className="text-slate-600">Description (optionnel)</Label>
                          <Input
                            placeholder="Ex: Courses Carrefour..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                          />
                      </div>
                      <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white">
                        Valider la dépense
                      </Button>
                  </form>
              </DialogContent>
          </Dialog>
      )}
    </div>
  )
}