"use client"

import { type FormEvent, useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, Download, LogOut, Pencil, Plus, Trash2, X } from "lucide-react"

import { cn } from "@/lib/utils"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"

import { CategoryBars, ComparisonList, EvolutionChart, ProjectionChart } from "@/components/thrift/charts"
import { Dock, type Screen } from "@/components/thrift/dock"
import { Login } from "@/components/thrift/login"
import { Reservoir } from "@/components/thrift/reservoir"
import { Amount, Dot, Empty, Panel, Row, SectionTitle, Wordmark } from "@/components/thrift/ui"

import {
  type AllData,
  type Category,
  CUSTOM_CATEGORY_COLORS,
  DEFAULT_CATEGORIES,
  type Expense,
  type FixedExpense,
  type IncomeEntry,
  type MonthData,
  PROJECT_TYPES,
  type Project,
  type ProjectType,
  buildProjection,
  compareToPreviousMonth,
  computeTotals,
  currentMonthKey,
  daysRemaining,
  defaultDateFor,
  frequentSuggestions,
  lastDayOf,
  monthlyHistory,
  overBudgetCategories,
  spendByCategory,
  toCsv,
  weeklyPacing,
} from "@/lib/budget"
import {
  type Household,
  type HouseholdMonth,
  type Invite,
  type SharedExpense,
  householdTotal,
  settle,
  sharedSpendByCategory,
} from "@/lib/household"
import { dayLabel, euros, eurosRound, initials, monthLabel, ofMonth } from "@/lib/format"

// Styles de champ partagés : les champs natifs restent plus fiables au doigt
// que des composants enrobés, et ils héritent déjà des jetons.
// `min-w-0` est indispensable : placé dans une rangée flex à côté d'un bouton,
// un champ en `w-full` refuse sinon de rétrécir, déborde l'écran, et étire au
// passage la barre d'onglets fixée en bas.
const FIELD =
  "w-full min-w-0 rounded-xl border px-3.5 py-3 text-base outline-none transition-colors placeholder:text-[var(--t-sage)] focus:border-[var(--t-brass)]"
const FIELD_STYLE = {
  backgroundColor: "var(--t-moss)",
  borderColor: "var(--t-line)",
  color: "var(--t-paper)",
} as const

const LABEL = "mb-1.5 block text-sm"
const LABEL_STYLE = { color: "var(--t-sage)" } as const

export default function Thrift() {
  // ==========================================
  // 1. États
  // ==========================================
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  // Vrai tant qu'on n'a pas su si un cookie de session existe : évite de
  // faire clignoter l'écran de connexion devant quelqu'un de déjà connecté.
  const [isRestoringSession, setIsRestoringSession] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  const [screen, setScreen] = useState<Screen>("mois")

  const [allMonths, setAllMonths] = useState<string[]>([])
  const [allMonthsData, setAllMonthsData] = useState<MonthData[]>([])

  // Mois affiché
  const [month, setMonth] = useState("")
  const [salary, setSalary] = useState("")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([])
  const [extraIncomes, setExtraIncomes] = useState<IncomeEntry[]>([])
  const [savingsGoalInput, setSavingsGoalInput] = useState("0")

  // Préférences du compte
  const [customCategories, setCustomCategories] = useState<Category[]>([])
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({})
  const [projects, setProjects] = useState<Project[]>([])
  const [initialSavings, setInitialSavings] = useState(0)
  const [initialSavingsInput, setInitialSavingsInput] = useState("0")
  const [initialSavingsMonth, setInitialSavingsMonth] = useState("")
  // Jour du mois où tombe la paie (1-31). 0 = fin du mois.
  const [payDay, setPayDay] = useState(0)

  // Saisie d'une dépense
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("alimentation")
  const [expenseDate, setExpenseDate] = useState("")
  // Dépense en cours de modification ; null quand on en saisit une nouvelle.
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  // Charges fixes
  const [fixedAmount, setFixedAmount] = useState("")
  const [fixedDescription, setFixedDescription] = useState("")
  const [isExceptional, setIsExceptional] = useState(false)
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null)
  const [isFixedFormOpen, setIsFixedFormOpen] = useState(false)

  // Revenus supplémentaires
  const [incomeAmount, setIncomeAmount] = useState("")
  const [incomeDescription, setIncomeDescription] = useState("")

  // Catégories personnalisées
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newCategoryColor, setNewCategoryColor] = useState(CUSTOM_CATEGORY_COLORS[0])

  // Création d'une catégorie directement depuis la saisie d'une dépense.
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [quickCategoryName, setQuickCategoryName] = useState("")
  const [quickCategoryColor, setQuickCategoryColor] = useState(CUSTOM_CATEGORY_COLORS[0])

  // Projets
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectAmount, setNewProjectAmount] = useState("")
  const [newProjectMonth, setNewProjectMonth] = useState("")
  const [newProjectType, setNewProjectType] = useState<ProjectType>("achat")

  // Gestion du mois
  const [isNewMonthDialogOpen, setIsNewMonthDialogOpen] = useState(false)
  const [newMonthInput, setNewMonthInput] = useState("")
  const [newMonthSalary, setNewMonthSalary] = useState("")
  const [isEditMonthOpen, setIsEditMonthOpen] = useState(false)
  const [editMonthInput, setEditMonthInput] = useState("")
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)

  // Foyer
  const [view, setView] = useState<"moi" | "foyer">("moi")
  const [household, setHousehold] = useState<Household | null>(null)
  const [invites, setInvites] = useState<Invite[]>([])
  const [pendingInvites, setPendingInvites] = useState<string[]>([])
  const [householdMonths, setHouseholdMonths] = useState<HouseholdMonth[]>([])
  const [newHouseholdName, setNewHouseholdName] = useState("")
  const [inviteName, setInviteName] = useState("")
  // Qui paie la dépense en cours de saisie, quand elle est pour le foyer.
  const [paidBy, setPaidBy] = useState("")

  // Recherche et filtres de l'historique
  const [query, setQuery] = useState("")
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [scopeAllMonths, setScopeAllMonths] = useState(false)

  const { toast } = useToast()

  const categories = useMemo(() => [...DEFAULT_CATEGORIES, ...customCategories], [customCategories])
  const currentMonthStr = currentMonthKey()

  // ==========================================
  // 2. Authentification
  // ==========================================
  async function handleLogin(username: string, password: string) {
    if (!username.trim() || !password.trim()) {
      toast({ title: "Champs requis", description: "Entre un pseudo et un mot de passe.", variant: "destructive" })
      return
    }

    setIsLoggingIn(true)
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      })
      const data = await res.json()

      if (res.ok) {
        // Le serveur a posé le cookie de session ; le pseudo renvoyé fait foi.
        setCurrentUser(data.user)
        if (data.created) toast({ title: "Compte créé", description: `Bienvenue, ${data.user}.` })
        setMonth("")
        setSalary("")
        setExpenses([])
        setFixedExpenses([])
        setExtraIncomes([])
        setSavingsGoalInput("0")
      } else {
        toast({ title: "Accès refusé", description: data.error || "Erreur inconnue", variant: "destructive" })
      }
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur réseau", description: "Impossible de joindre le serveur.", variant: "destructive" })
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {})
    setCurrentUser(null)
    setAllMonths([])
    setAllMonthsData([])
    setMonth("")
    setScreen("mois")
  }

  // Retrouve la session au démarrage : sans ça, chaque rafraîchissement
  // renvoyait à l'écran de connexion.
  useEffect(() => {
    let cancelled = false
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.user) setCurrentUser(d.user)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsRestoringSession(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ==========================================
  // 3. Chargement des données
  // ==========================================
  async function fetchAllMonths() {
    if (!currentUser) return
    try {
      setIsLoading(true)
      const res = await fetch("/api/expenses")
      if (res.status === 401) {
        setCurrentUser(null)
        return
      }
      if (!res.ok) throw new Error("Erreur lors du chargement")

      const data: AllData = await res.json()
      setAllMonths(data.months.map((m) => m.month).sort())
      setAllMonthsData(data.months)
      setCustomCategories(data.customCategories || [])
      setCategoryBudgets(data.categoryBudgets || {})
      setProjects(data.projects || [])
      setInitialSavings(data.initialSavings || 0)
      setInitialSavingsInput(String(data.initialSavings || 0))
      setInitialSavingsMonth(data.initialSavingsMonth || "")
      setPayDay(data.payDay || 0)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchHousehold() {
    try {
      const res = await fetch("/api/household")
      if (!res.ok) return
      const data = await res.json()
      setHousehold(data.household)
      setInvites(data.invites ?? [])
      setPendingInvites(data.pendingInvites ?? [])
      setHouseholdMonths(data.months ?? [])
      // Sans foyer, la vue partagée n'a rien à montrer.
      if (!data.household) setView("moi")
    } catch (error) {
      console.error(error)
    }
  }

  async function fetchMonthData(selectedMonth: string) {
    if (!currentUser) return
    try {
      setIsLoading(true)
      const res = await fetch(`/api/expenses?month=${encodeURIComponent(selectedMonth)}`)
      if (!res.ok) throw new Error("Mois introuvable")

      const data: MonthData = await res.json()
      setMonth(data.month)
      setSalary(data.salary.toString())
      setExpenses(data.expenses)
      setFixedExpenses(data.fixedExpenses)
      setExtraIncomes(data.extraIncomes || [])
      setSavingsGoalInput((data.savingsGoal ?? 0).toString())
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur", description: "Impossible de charger ce mois.", variant: "destructive" })
      setMonth("")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser) {
      fetchAllMonths()
      fetchHousehold()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  // Ouvre le mois en cours dès qu'il existe, plutôt qu'un écran vide.
  useEffect(() => {
    if (!currentUser || month || allMonths.length === 0) return
    const target = allMonths.includes(currentMonthStr) ? currentMonthStr : allMonths[allMonths.length - 1]
    fetchMonthData(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, allMonths])

  // ==========================================
  // 4. Sauvegarde
  // ==========================================
  async function saveData(
    newExpenses: Expense[],
    newFixedExpenses: FixedExpense[],
    newMonth: string = month,
    newSalary: number = parseFloat(salary),
    newSavingsGoal: number = parseFloat(savingsGoalInput),
    newExtraIncomes: IncomeEntry[] = extraIncomes
  ) {
    if (!newMonth || !currentUser) return false

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
          savingsGoal: newSavingsGoal,
          extraIncomes: newExtraIncomes,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "La sauvegarde a échoué.")
      }

      // Le serveur a accepté exactement ce qu'on lui a envoyé : on remplace le
      // mois localement plutôt que de recharger tout l'historique.
      const savedMonth: MonthData = {
        month: newMonth,
        salary: newSalary,
        expenses: newExpenses,
        fixedExpenses: newFixedExpenses,
        savingsGoal: newSavingsGoal,
        extraIncomes: newExtraIncomes,
      }
      setAllMonthsData((prev) =>
        prev.some((m) => m.month === newMonth)
          ? prev.map((m) => (m.month === newMonth ? savedMonth : m))
          : [...prev, savedMonth]
      )
      return true
    } catch (error) {
      console.error(error)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "La sauvegarde a échoué.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // ==========================================
  // 5. Gestion du mois
  // ==========================================
  function getSuggestedNextMonth(): string {
    const reference = month || [...allMonths].sort().slice(-1)[0] || ""
    const [y, m] = reference.split("-").map(Number)
    if (!y || !m) return currentMonthStr

    const nextDate = new Date(y, m, 1)
    return `${nextDate.getFullYear()}-${(nextDate.getMonth() + 1).toString().padStart(2, "0")}`
  }

  async function createNewMonth(e: FormEvent) {
    e.preventDefault()
    if (!newMonthInput || !newMonthSalary || !currentUser) return

    const monthData: MonthData = {
      month: newMonthInput,
      salary: parseFloat(newMonthSalary),
      expenses: [],
      fixedExpenses: [],
    }

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(monthData),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Erreur lors de la création")
      }

      toast({ title: "Mois créé" })
      // Rechargement nécessaire : le serveur reprend les charges fixes par défaut.
      await fetchAllMonths()
      await fetchMonthData(newMonthInput)
      setNewMonthInput("")
      setNewMonthSalary("")
      setIsNewMonthDialogOpen(false)
    } catch (error) {
      console.error(error)
      toast({
        title: "Erreur lors de la création",
        description: error instanceof Error ? error.message : "Impossible de joindre le serveur.",
        variant: "destructive",
      })
    }
  }

  /**
   * Ouvre le mois en cours d'un geste, en reprenant le dernier salaire connu.
   * On le propose plutôt que de le créer d'office : écrire dans le compte de
   * quelqu'un sans qu'il l'ait demandé est une mauvaise surprise.
   */
  async function openCurrentMonth() {
    if (!currentUser || isLoading) return

    const previous = [...allMonthsData].sort((a, b) => a.month.localeCompare(b.month)).pop()
    try {
      setIsLoading(true)
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: currentMonthStr,
          salary: previous?.salary ?? 0,
          expenses: [],
          fixedExpenses: [],
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Impossible d'ouvrir le mois")
      }
      await fetchAllMonths()
      await fetchMonthData(currentMonthStr)
      toast({ title: `${monthLabel(currentMonthStr)} ouvert` })
    } catch (error) {
      console.error(error)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'ouvrir le mois.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteMonth() {
    if (!month || !currentUser) return
    if (!confirm(`Supprimer ${monthLabel(month)} et toutes ses dépenses ?`)) return

    const res = await fetch(`/api/expenses?month=${encodeURIComponent(month)}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Mois supprimé" })
      setMonth("")
      setSalary("")
      setExpenses([])
      setFixedExpenses([])
      setExtraIncomes([])
      fetchAllMonths()
    } else {
      toast({ title: "Erreur suppression", variant: "destructive" })
    }
  }

  // Recrée le mois sous la nouvelle date avec les mêmes données, puis supprime l'ancien.
  async function renameMonth(e: FormEvent) {
    e.preventDefault()
    if (!month || !currentUser) return

    const target = editMonthInput.trim()
    if (!/^\d{4}-\d{2}$/.test(target)) {
      toast({ title: "Format invalide", description: "Utilise AAAA-MM, par exemple 2026-09.", variant: "destructive" })
      return
    }
    if (target === month) {
      setIsEditMonthOpen(false)
      return
    }
    if (allMonths.includes(target)) {
      toast({ title: "Ce mois existe déjà", description: monthLabel(target), variant: "destructive" })
      return
    }

    try {
      setIsLoading(true)
      const createRes = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: target,
          salary: parseFloat(salary) || 0,
          expenses,
          fixedExpenses,
          savingsGoal: parseFloat(savingsGoalInput) || 0,
          extraIncomes,
        }),
      })
      if (!createRes.ok) throw new Error("create")

      const delRes = await fetch(`/api/expenses?month=${encodeURIComponent(month)}`, { method: "DELETE" })
      if (!delRes.ok) throw new Error("delete")

      // Reporte la référence du solde de départ si elle pointait sur l'ancien mois.
      if (initialSavingsMonth === month) {
        await saveProjects(projects, initialSavings, target)
        setInitialSavingsMonth(target)
      }

      toast({ title: "Date corrigée", description: `${monthLabel(month)} → ${monthLabel(target)}` })
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
  // 6. Dépenses
  // ==========================================
  async function logExpense(
    expAmount: number,
    expDescription: string,
    expCategory: string,
    expDate: string = defaultDateFor(month)
  ) {
    if (!expAmount) return false

    const newExp: Expense = {
      id: Date.now().toString(),
      amount: expAmount,
      description: expDescription.trim() || categories.find((c) => c.id === expCategory)?.name || "Dépense",
      category: expCategory,
      date: expDate,
    }

    const newExps = [newExp, ...expenses]

    if (await saveData(newExps, fixedExpenses)) {
      setExpenses(newExps)

      // Le total post-ajout vient de newExps : `expenses` n'est pas encore à jour.
      const budget = categoryBudgets[expCategory]
      const categoryTotal = newExps
        .filter((e) => e.category === expCategory)
        .reduce((sum, e) => sum + e.amount, 0)

      if (budget && categoryTotal > budget) {
        toast({
          title: "Budget dépassé",
          description: `${categories.find((c) => c.id === expCategory)?.name} : ${euros(categoryTotal)} sur ${euros(budget)}`,
          variant: "destructive",
        })
      } else {
        toast({ title: "Dépense notée" })
      }
      return true
    }
    return false
  }

  function openExpenseSheet(expense?: Expense | SharedExpense) {
    if (expense) {
      setEditingExpense(expense as Expense)
      setAmount(String(expense.amount))
      setDescription(expense.description)
      setCategory(expense.category)
      setExpenseDate(expense.date)
      setPaidBy("paidBy" in expense ? expense.paidBy : (currentUser ?? ""))
    } else {
      setEditingExpense(null)
      setAmount("")
      setDescription("")
      setCategory("alimentation")
      setExpenseDate(defaultDateFor(month))
      setPaidBy(currentUser ?? "")
    }
    setIsQuickAddOpen(true)
  }

  async function submitExpense(e: FormEvent) {
    e.preventDefault()
    if (!amount) return

    const value = parseFloat(amount)
    if (Number.isNaN(value)) return

    // --- Dépense du foyer ---
    if (isShared && currentHouseholdMonth) {
      const label = description.trim() || categories.find((c) => c.id === category)?.name || "Dépense"
      const payer = paidBy || currentUser || ""

      const next: HouseholdMonth = editingExpense
        ? {
            ...currentHouseholdMonth,
            expenses: currentHouseholdMonth.expenses.map((x) =>
              x.id === editingExpense.id
                ? { ...x, amount: value, description: label, category, date: expenseDate || x.date, paidBy: payer }
                : x
            ),
          }
        : {
            ...currentHouseholdMonth,
            expenses: [
              {
                id: Date.now().toString(),
                amount: value,
                description: label,
                category,
                date: expenseDate || defaultDateFor(month),
                paidBy: payer,
              },
              ...currentHouseholdMonth.expenses,
            ],
          }

      if (await saveSharedMonth(next)) {
        setIsQuickAddOpen(false)
        setEditingExpense(null)
        setAmount("")
        setDescription("")
        toast({ title: editingExpense ? "Dépense modifiée" : "Dépense notée pour le foyer" })
      }
      return
    }

    if (editingExpense) {
      const updated = expenses.map((x) =>
        x.id === editingExpense.id
          ? {
              ...x,
              amount: value,
              description: description.trim() || categories.find((c) => c.id === category)?.name || "Dépense",
              category,
              date: expenseDate || x.date,
            }
          : x
      )
      if (await saveData(updated, fixedExpenses)) {
        setExpenses(updated)
        setIsQuickAddOpen(false)
        setEditingExpense(null)
        toast({ title: "Dépense modifiée" })
      }
      return
    }

    if (await logExpense(value, description, category, expenseDate || defaultDateFor(month))) {
      setAmount("")
      setDescription("")
      setCategory("alimentation")
      setIsQuickAddOpen(false)
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
  // 7. Catégories et budgets
  // ==========================================
  async function saveCustomCategories(newList: Category[]) {
    if (!currentUser) return false
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCategoryUpdate: true, customCategories: newList }),
      })
      return res.ok
    } catch (error) {
      console.error(error)
      return false
    }
  }

  /**
   * Crée une catégorie personnalisée à partir d'un nom et d'une couleur, puis la
   * persiste. Renvoie la catégorie créée, ou null si la saisie est invalide ou
   * si la sauvegarde échoue. Partagé entre l'écran des réglages et la saisie
   * d'une dépense, pour pouvoir créer une catégorie là où l'on en a besoin.
   */
  async function createCategory(name: string, color: string): Promise<Category | null> {
    if (!name.trim()) return null

    const id = name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")

    if (!id || categories.some((c) => c.id === id)) {
      toast({ title: "Cette catégorie existe déjà", variant: "destructive" })
      return null
    }

    const newCategory = { id, name: name.trim(), color }
    const newList = [...customCategories, newCategory]
    if (await saveCustomCategories(newList)) {
      setCustomCategories(newList)
      return newCategory
    }
    toast({ title: "Erreur lors de l'ajout", variant: "destructive" })
    return null
  }

  async function addCustomCategory(e: FormEvent) {
    e.preventDefault()
    const created = await createCategory(newCategoryName, newCategoryColor)
    if (created) {
      setCategory(created.id)
      setNewCategoryName("")
      setNewCategoryColor(CUSTOM_CATEGORY_COLORS[0])
      toast({ title: "Catégorie ajoutée" })
    }
  }

  /** Ajoute la catégorie saisie dans la feuille « Noter une dépense », puis la sélectionne. */
  async function submitQuickCategory() {
    const created = await createCategory(quickCategoryName, quickCategoryColor)
    if (created) {
      setCategory(created.id)
      setQuickCategoryName("")
      setQuickCategoryColor(CUSTOM_CATEGORY_COLORS[0])
      setIsAddingCategory(false)
      toast({ title: "Catégorie ajoutée" })
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
        body: JSON.stringify({ isBudgetUpdate: true, categoryBudgets: newBudgets }),
      })
      toast(
        res.ok
          ? { title: "Budgets enregistrés" }
          : { title: "Erreur lors de l'enregistrement", variant: "destructive" }
      )
      return res.ok
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" })
      return false
    }
  }

  async function savePayDay(value: number) {
    if (!currentUser) return false
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPayDayUpdate: true, payDay: value }),
      })
      if (res.ok) {
        setPayDay(value)
        toast({ title: value ? `Jour de paie : le ${value}` : "Jour de paie : fin du mois" })
      } else {
        toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" })
      }
      return res.ok
    } catch (error) {
      console.error(error)
      toast({ title: "Erreur lors de l'enregistrement", variant: "destructive" })
      return false
    }
  }

  // ==========================================
  // 8. Projets et solde de départ
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
      toast({ title: "Champs requis", description: "Nom, montant et mois cible.", variant: "destructive" })
      return
    }

    const newList = [
      ...projects,
      {
        id: Date.now().toString(),
        name: newProjectName.trim(),
        amount: parseFloat(newProjectAmount),
        targetMonth: newProjectMonth,
        type: newProjectType,
        included: true,
      },
    ]

    if (await saveProjects(newList)) {
      setProjects(newList)
      setNewProjectName("")
      setNewProjectAmount("")
      setNewProjectMonth("")
      setNewProjectType("achat")
      toast({ title: "Projet ajouté" })
    } else {
      toast({ title: "Erreur lors de l'ajout", variant: "destructive" })
    }
  }

  async function toggleProjectIncluded(id: string) {
    const previous = projects
    const newList = projects.map((p) => (p.id === id ? { ...p, included: !p.included } : p))
    setProjects(newList) // la simulation réagit tout de suite
    if (!(await saveProjects(newList))) {
      toast({ title: "Erreur d'enregistrement", variant: "destructive" })
      setProjects(previous)
    }
  }

  async function deleteProject(id: string) {
    const newList = projects.filter((p) => p.id !== id)
    if (await saveProjects(newList)) {
      setProjects(newList)
      toast({ title: "Projet supprimé" })
    } else {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" })
    }
  }

  async function saveInitialSavings() {
    const value = parseFloat(initialSavingsInput) || 0
    // Le solde est daté du mois consulté : l'épargne est cumulée à partir de là.
    const refMonth = month || currentMonthStr
    if (await saveProjects(projects, value, refMonth)) {
      setInitialSavings(value)
      setInitialSavingsMonth(refMonth)
      toast({ title: `Solde enregistré, référence ${monthLabel(refMonth)}` })
    } else {
      toast({ title: "Erreur d'enregistrement", variant: "destructive" })
    }
  }

  // ==========================================
  // 9. Revenus supplémentaires et charges fixes
  // ==========================================
  async function addExtraIncome(e: FormEvent) {
    e.preventDefault()
    if (!incomeAmount || !incomeDescription.trim()) return

    const newList = [
      ...extraIncomes,
      { id: Date.now().toString(), amount: parseFloat(incomeAmount), description: incomeDescription.trim() },
    ]

    if (await saveData(expenses, fixedExpenses, month, parseFloat(salary), parseFloat(savingsGoalInput), newList)) {
      setExtraIncomes(newList)
      setIncomeAmount("")
      setIncomeDescription("")
      toast({ title: "Revenu ajouté" })
    }
  }

  async function deleteExtraIncome(id: string) {
    const newList = extraIncomes.filter((i) => i.id !== id)
    if (await saveData(expenses, fixedExpenses, month, parseFloat(salary), parseFloat(savingsGoalInput), newList)) {
      setExtraIncomes(newList)
      toast({ title: "Revenu supprimé" })
    }
  }

  function openFixedForm(fx?: FixedExpense) {
    if (fx) {
      setEditingFixedExpense(fx)
      setFixedAmount(fx.amount.toString())
      setFixedDescription(fx.description)
      setIsExceptional(fx.isExceptional || false)
    } else {
      setEditingFixedExpense(null)
      setFixedAmount("")
      setFixedDescription("")
      setIsExceptional(false)
    }
    setIsFixedFormOpen(true)
  }

  async function submitFixedExpense(e: FormEvent) {
    e.preventDefault()
    if (!fixedAmount || !fixedDescription) return

    const updated = editingFixedExpense
      ? fixedExpenses.map((x) =>
          x.id === editingFixedExpense.id
            ? { ...x, amount: parseFloat(fixedAmount), description: fixedDescription, isExceptional }
            : x
        )
      : [
          ...fixedExpenses,
          { id: Date.now().toString(), amount: parseFloat(fixedAmount), description: fixedDescription, isExceptional },
        ]

    if (await saveData(expenses, updated)) {
      setFixedExpenses(updated)
      setIsFixedFormOpen(false)
      setEditingFixedExpense(null)
      setFixedAmount("")
      setFixedDescription("")
      setIsExceptional(false)
      toast({ title: editingFixedExpense ? "Charge modifiée" : "Charge ajoutée" })
    }
  }

  async function deleteFixedExpense(id: string) {
    const newFixed = fixedExpenses.filter((e) => e.id !== id)
    if (await saveData(expenses, newFixed)) {
      setFixedExpenses(newFixed)
      toast({ title: "Charge supprimée" })
    }
  }

  async function saveSalary(value: string) {
    const parsed = parseFloat(value) || 0
    if (await saveData(expenses, fixedExpenses, month, parsed)) {
      setSalary(value)
      toast({ title: "Revenu enregistré" })
    }
  }

  async function saveSavingsGoal(value: string) {
    const parsed = parseFloat(value) || 0
    if (await saveData(expenses, fixedExpenses, month, parseFloat(salary), parsed)) {
      setSavingsGoalInput(value)
      toast({ title: "Objectif enregistré" })
    }
  }

  // ==========================================
  // 10. Foyer
  // ==========================================
  async function householdAction(body: Record<string, unknown>, successTitle?: string) {
    try {
      setIsLoading(true)
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "L\u2019action a échoué.")
      await fetchHousehold()
      if (successTitle) toast({ title: successTitle })
      return true
    } catch (error) {
      console.error(error)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "L\u2019action a échoué.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  async function createHouseholdFn(e: FormEvent) {
    e.preventDefault()
    if (!newHouseholdName.trim()) return
    if (await householdAction({ action: "create", name: newHouseholdName.trim() }, "Foyer créé")) {
      setNewHouseholdName("")
      setView("foyer")
    }
  }

  async function inviteMember(e: FormEvent) {
    e.preventDefault()
    if (!inviteName.trim()) return
    if (await householdAction({ action: "invite", username: inviteName.trim() }, `${inviteName.trim()} est invité`)) {
      setInviteName("")
    }
  }

  async function leaveHouseholdFn() {
    if (!household) return
    const last = household.members.length === 1
    const message = last
      ? `Tu es seul dans « ${household.name} » : le quitter supprimera définitivement ses dépenses partagées. Continuer ?`
      : `Quitter « ${household.name} » ? Tu ne verras plus ses dépenses partagées.`
    if (!confirm(message)) return
    if (await householdAction({ action: "leave" }, "Foyer quitté")) setView("moi")
  }

  /** Enregistre le mois partagé et met à jour la copie locale. */
  async function saveSharedMonth(next: HouseholdMonth) {
    if (!household) return false
    try {
      setIsLoading(true)
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveMonth",
          month: next.month,
          expenses: next.expenses,
          fixedExpenses: next.fixedExpenses,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "La sauvegarde a échoué.")

      setHouseholdMonths((prev) =>
        prev.some((m) => m.month === next.month)
          ? prev.map((m) => (m.month === next.month ? next : m))
          : [...prev, next]
      )
      return true
    } catch (error) {
      console.error(error)
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "La sauvegarde a échoué.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteSharedExpense(id: string) {
    if (!currentHouseholdMonth) return
    const next = {
      ...currentHouseholdMonth,
      expenses: currentHouseholdMonth.expenses.filter((e) => e.id !== id),
    }
    if (await saveSharedMonth(next)) toast({ title: "Dépense supprimée" })
  }

  // ==========================================
  // 11. Export
  // ==========================================
  function exportCsv() {
    const csv = toCsv(allMonthsData, categories)
    // Le BOM force Excel à lire l'UTF-8 : sans lui les accents sont cassés.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `thrift-${currentUser}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Export téléchargé" })
  }

  // ==========================================
  // 12. Dérivés
  // ==========================================
  const totals = computeTotals({
    salary: parseFloat(salary) || 0,
    expenses,
    fixedExpenses,
    extraIncomes,
  })
  const spend = spendByCategory(expenses, categories)
  const overBudget = overBudgetCategories(categories, spend, categoryBudgets)
  const pacing = weeklyPacing(month, totals.balance, new Date(), payDay || null)
  const daysLeft = daysRemaining(month, payDay || null)

  const savingsGoalNum = parseFloat(savingsGoalInput) || 0
  const savedThisMonth = spend["epargne"] || 0
  const savingsProgress = savingsGoalNum > 0 ? Math.min(100, (savedThisMonth / savingsGoalNum) * 100) : 0

  const suggestions = frequentSuggestions(allMonthsData, categories)
  const history = useMemo(() => monthlyHistory(allMonthsData), [allMonthsData])
  const comparison = useMemo(
    () => compareToPreviousMonth(allMonthsData, month, categories),
    [allMonthsData, month, categories]
  )
  const projection = useMemo(
    () => buildProjection({ months: allMonthsData, projects, initialSavings, initialSavingsMonth }),
    [allMonthsData, projects, initialSavings, initialSavingsMonth]
  )

  // Barres « où ça part » : les dépenses variables, hors épargne qui n'est pas une sortie.
  const spendRows = categories
    .filter((c) => c.id !== "epargne")
    .map((c) => ({ category: c, spent: spend[c.id] || 0, budget: categoryBudgets[c.id] }))

  // Historique filtré : recherche plein texte, catégorie, portée.
  const searchPool = useMemo(() => {
    const pool = scopeAllMonths
      ? allMonthsData.flatMap((m) => m.expenses.map((e) => ({ ...e, month: m.month })))
      : expenses.map((e) => ({ ...e, month }))
    return pool.sort((a, b) => b.date.localeCompare(a.date))
  }, [scopeAllMonths, allMonthsData, expenses, month])

  const filteredExpenses = useMemo(() => {
    const q = query.trim().toLowerCase()
    return searchPool.filter((e) => {
      if (filterCategory && e.category !== filterCategory) return false
      if (!q) return true
      const label = categories.find((c) => c.id === e.category)?.name ?? ""
      return e.description.toLowerCase().includes(q) || label.toLowerCase().includes(q) || e.amount.toFixed(2).includes(q)
    })
  }, [searchPool, query, filterCategory, categories])

  const filteredTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const sortedProjects = [...projects].sort((a, b) => a.targetMonth.localeCompare(b.targetMonth))
  const includedTotal = projects.filter((p) => p.included).reduce((s, p) => s + p.amount, 0)

  const catById = (id: string) => categories.find((c) => c.id === id)

  const memberNames = household?.members.map((m) => m.username) ?? []
  const currentHouseholdMonth: HouseholdMonth | null = household
    ? (householdMonths.find((m) => m.month === month) ?? {
        householdId: household.id,
        month,
        expenses: [],
        fixedExpenses: [],
      })
    : null
  const settlement = currentHouseholdMonth ? settle(currentHouseholdMonth, memberNames) : null
  const sharedTotal = currentHouseholdMonth ? householdTotal(currentHouseholdMonth) : 0
  const sharedSpend = currentHouseholdMonth ? sharedSpendByCategory(currentHouseholdMonth) : {}
  const sharedRows = categories
    .filter((c) => c.id !== "epargne")
    .map((c) => ({ category: c, spent: sharedSpend[c.id] || 0 }))
  const isShared = view === "foyer" && !!household

  // Le mois réel n'existe pas encore, mais d'autres mois sont enregistrés :
  // sans ce rappel on atterrit sur le mois précédent sans comprendre pourquoi.
  const needsCurrentMonth = allMonths.length > 0 && !allMonths.includes(currentMonthStr) && !!month

  // ==========================================
  // 12. Rendu
  // ==========================================
  if (isRestoringSession) {
    return <main className="min-h-[100svh]" style={{ backgroundColor: "var(--t-ink)" }} />
  }

  if (!currentUser) {
    return <Login onSubmit={handleLogin} busy={isLoggingIn} />
  }

  return (
    <div className="min-h-[100svh]" style={{ backgroundColor: "var(--t-ink)" }}>
      {/* Barre haute */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: "var(--t-ink)", borderColor: "var(--t-line)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Wordmark />

          <button
            type="button"
            onClick={() => setIsMonthPickerOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium"
            style={{ color: "var(--t-paper)" }}
          >
            {month ? monthLabel(month) : "Choisir un mois"}
            <ChevronDown className="size-4" style={{ color: "var(--t-sage)" }} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex size-9 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: "var(--t-moss)", color: "var(--t-mist)" }}
            title={`${currentUser} — se déconnecter`}
          >
            <span aria-hidden>{initials(currentUser)}</span>
            <span className="sr-only">Se déconnecter de {currentUser}</span>
          </button>
        </div>
      </header>

      <main className="pb-dock mx-auto max-w-2xl">
        {/* Bascule entre le budget personnel et celui du foyer. Elle ne sert
            que sur l'écran du mois : ailleurs, tout est personnel. */}
        {household && screen === "mois" && (
          <div className="flex gap-1.5 px-4 pt-4">
            {(["moi", "foyer"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: view === v ? "var(--t-brass)" : "var(--t-pine)",
                  borderColor: view === v ? "var(--t-brass)" : "var(--t-line)",
                  color: view === v ? "var(--t-ink)" : "var(--t-mist)",
                }}
              >
                {v === "moi" ? "Moi" : household.name}
              </button>
            ))}
          </div>
        )}

        {/* ===================== FOYER ===================== */}
        {screen === "mois" && isShared && currentHouseholdMonth && settlement && (
          <div className="space-y-4 px-4 pt-4">
            <Panel>
              <SectionTitle>{household!.name}</SectionTitle>
              <p className="figure-hero text-[clamp(2.5rem,12vw,3.75rem)]" style={{ color: "var(--t-paper)" }}>
                {euros(sharedTotal)}
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--t-sage)" }}>
                dépensés ensemble en {monthLabel(month)}, charges fixes comprises.
              </p>
            </Panel>

            <Panel>
              <SectionTitle aside={`${memberNames.length} membres`}>Qui a payé quoi</SectionTitle>
              <ul className="space-y-2.5">
                {settlement.balances.map((b) => (
                  <li key={b.username} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate" style={{ color: "var(--t-paper)" }}>
                      {b.username}
                      {b.username === currentUser && (
                        <span style={{ color: "var(--t-sage)" }}> (toi)</span>
                      )}
                    </span>
                    <span className="tnum shrink-0" style={{ color: "var(--t-sage)" }}>
                      a avancé {euros(b.paid)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--t-line)" }}>
                {settlement.transfers.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--t-sage)" }}>
                    {sharedTotal === 0
                      ? "Rien de noté en commun ce mois-ci."
                      : "Chacun a payé sa part, personne ne doit rien."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {settlement.transfers.map((t) => (
                      <li key={`${t.from}-${t.to}`} className="text-sm" style={{ color: "var(--t-paper)" }}>
                        {t.to === currentUser ? (
                          <>
                            <span className="font-semibold">{t.from}</span> te doit{" "}
                            <span className="tnum font-semibold" style={{ color: "var(--t-brass)" }}>
                              {euros(t.amount)}
                            </span>
                          </>
                        ) : t.from === currentUser ? (
                          <>
                            <span className="font-semibold">Tu dois</span>{" "}
                            <span className="tnum font-semibold" style={{ color: "var(--t-brass)" }}>
                              {euros(t.amount)}
                            </span>{" "}
                            à {t.to}
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">{t.from}</span> doit{" "}
                            <span className="tnum font-semibold" style={{ color: "var(--t-brass)" }}>
                              {euros(t.amount)}
                            </span>{" "}
                            à {t.to}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>

            <Panel>
              <SectionTitle aside={euros(sharedTotal - currentHouseholdMonth.fixedExpenses.reduce((a, f) => a + f.amount, 0))}>
                Où ça part
              </SectionTitle>
              <CategoryBars rows={sharedRows} />
            </Panel>

            <Panel flush>
              <div className="px-4 pb-1 pt-3">
                <SectionTitle
                  aside={euros(currentHouseholdMonth.fixedExpenses.reduce((a, f) => a + f.amount, 0))}
                >
                  Charges fixes du foyer
                </SectionTitle>
              </div>
              {currentHouseholdMonth.fixedExpenses.length === 0 ? (
                <Empty title="Aucune charge commune">Loyer, internet, électricité…</Empty>
              ) : (
                currentHouseholdMonth.fixedExpenses.map((fx) => (
                  <Row key={fx.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm" style={{ color: "var(--t-paper)" }}>
                        {fx.description}
                      </span>
                      <span className="text-xs" style={{ color: "var(--t-sage)" }}>
                        payé par {fx.paidBy === currentUser ? "toi" : fx.paidBy}
                      </span>
                    </span>
                    <Amount>{euros(fx.amount)}</Amount>
                    <IconButton
                      label={`Supprimer ${fx.description}`}
                      danger
                      onClick={() =>
                        saveSharedMonth({
                          ...currentHouseholdMonth,
                          fixedExpenses: currentHouseholdMonth.fixedExpenses.filter((x) => x.id !== fx.id),
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </Row>
                ))
              )}
              <form
                className="flex gap-2 px-4 py-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  const label = (form.elements.namedItem("fxLabel") as HTMLInputElement).value.trim()
                  const value = parseFloat((form.elements.namedItem("fxAmount") as HTMLInputElement).value)
                  if (!label || Number.isNaN(value)) return
                  saveSharedMonth({
                    ...currentHouseholdMonth,
                    fixedExpenses: [
                      ...currentHouseholdMonth.fixedExpenses,
                      { id: Date.now().toString(), amount: value, description: label, paidBy: currentUser ?? "" },
                    ],
                  }).then((ok) => ok && form.reset())
                }}
              >
                <input name="fxLabel" placeholder="Loyer" className={FIELD} style={FIELD_STYLE} aria-label="Intitulé de la charge commune" />
                <input
                  name="fxAmount"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="780"
                  className={`${FIELD} !w-24 shrink-0`}
                  style={FIELD_STYLE}
                  aria-label="Montant de la charge commune"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl px-3.5"
                  style={{ backgroundColor: "var(--t-moss)", color: "var(--t-brass)" }}
                  aria-label="Ajouter la charge commune"
                >
                  <Plus className="size-5" />
                </button>
              </form>
            </Panel>

            <Panel flush>
              <div className="px-4 pb-1 pt-3">
                <SectionTitle>Dépenses communes</SectionTitle>
              </div>
              {currentHouseholdMonth.expenses.length === 0 ? (
                <Empty title="Rien de noté en commun">
                  Appuie sur + puis choisis « {household!.name} » pour partager une dépense.
                </Empty>
              ) : (
                currentHouseholdMonth.expenses.map((e) => (
                  <Row key={e.id}>
                    <Dot color={catById(e.category)?.color ?? "var(--t-sage)"} />
                    <button
                      type="button"
                      onClick={() => openExpenseSheet(e)}
                      className="min-w-0 flex-1 rounded-lg text-left"
                    >
                      <span className="block truncate text-sm" style={{ color: "var(--t-paper)" }}>
                        {e.description}
                      </span>
                      <span className="text-xs" style={{ color: "var(--t-sage)" }}>
                        {dayLabel(e.date)} · payé par {e.paidBy === currentUser ? "toi" : e.paidBy}
                      </span>
                    </button>
                    <Amount>{euros(e.amount)}</Amount>
                    <IconButton label={`Supprimer ${e.description}`} danger onClick={() => deleteSharedExpense(e.id)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </Row>
                ))
              )}
            </Panel>
          </div>
        )}

        {/* ===================== MOIS ===================== */}
        {screen === "mois" && !isShared &&
          (!month ? (
            <div className="px-4 pt-10">
              <Panel>
                <Empty title="Aucun mois ouvert">
                  Crée un mois pour commencer à suivre ce qu'il te reste.
                </Empty>
                <button
                  type="button"
                  onClick={() => {
                    setNewMonthInput(getSuggestedNextMonth())
                    setIsNewMonthDialogOpen(true)
                  }}
                  className="mx-auto mt-2 flex items-center gap-2 rounded-xl px-5 py-3 font-semibold"
                  style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                >
                  <Plus className="size-5" /> Créer un mois
                </button>
              </Panel>
            </div>
          ) : (
            <>
              <Reservoir balance={totals.balance} income={totals.totalIncome} daysLeft={daysLeft} payDaySet={!!payDay} />

              <div className="space-y-4 px-4 pt-4">
                {needsCurrentMonth && (
                  <Panel className="flex flex-wrap items-center gap-3">
                    <p className="min-w-0 flex-1 text-sm" style={{ color: "var(--t-paper)" }}>
                      {monthLabel(currentMonthStr)} n'est pas encore ouvert. Tu regardes {monthLabel(month)}.
                    </p>
                    <button
                      type="button"
                      onClick={openCurrentMonth}
                      disabled={isLoading}
                      className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                      style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                    >
                      Ouvrir {monthLabel(currentMonthStr).split(" ")[0]}
                    </button>
                  </Panel>
                )}

                {/* Ce qui mérite une réaction, en haut. */}
                {(overBudget.length > 0 || pacing) && (
                  <Panel className="space-y-2.5">
                    {overBudget.map((c) => (
                      <p key={c.id} className="flex items-start gap-2 text-sm" style={{ color: "var(--t-paper)" }}>
                        <Dot color={c.color} className="mt-1.5" />
                        <span>
                          {c.name} dépasse son budget de{" "}
                          <span className="tnum font-semibold" style={{ color: "var(--t-alert)" }}>
                            {euros(c.spent - c.budget)}
                          </span>
                        </span>
                      </p>
                    ))}
                    {pacing &&
                      (pacing.isOver ? (
                        <p className="text-sm" style={{ color: "var(--t-paper)" }}>
                          Tu es à découvert de{" "}
                          <span className="tnum font-semibold" style={{ color: "var(--t-alert)" }}>
                            {euros(pacing.value)}
                          </span>{" "}
                          pour ce mois.
                        </p>
                      ) : (
                        <p className="text-sm" style={{ color: "var(--t-paper)" }}>
                          Tu peux dépenser{" "}
                          <span className="tnum font-semibold" style={{ color: "var(--t-brass)" }}>
                            {euros(pacing.value)}
                          </span>{" "}
                          par {pacing.unit} sur les {pacing.days} jours restants.
                        </p>
                      ))}
                  </Panel>
                )}

                <Panel>
                  <SectionTitle aside={euros(totals.totalExpenses)}>Où ça part</SectionTitle>
                  <CategoryBars
                    rows={spendRows}
                    onSelect={(id) => {
                      setFilterCategory(id)
                      setScopeAllMonths(false)
                      setScreen("historique")
                    }}
                  />
                </Panel>

                <Panel flush>
                  <div className="px-4 pb-1 pt-3">
                    <SectionTitle aside={`${euros(totals.totalFixed)} par mois`}>Charges fixes</SectionTitle>
                  </div>
                  {fixedExpenses.length === 0 ? (
                    <Empty title="Aucune charge fixe">Loyer, abonnements, assurances…</Empty>
                  ) : (
                    fixedExpenses.map((fx) => (
                      <Row key={fx.id}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm" style={{ color: "var(--t-paper)" }}>
                            {fx.description}
                          </span>
                          {fx.isExceptional && (
                            <span className="text-xs" style={{ color: "var(--t-sage)" }}>
                              Exceptionnelle, non reprise le mois prochain
                            </span>
                          )}
                        </span>
                        <Amount>{euros(fx.amount)}</Amount>
                        <IconButton label={`Modifier ${fx.description}`} onClick={() => openFixedForm(fx)}>
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton label={`Supprimer ${fx.description}`} onClick={() => deleteFixedExpense(fx.id)} danger>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </Row>
                    ))
                  )}
                  <div className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openFixedForm()}
                      className="flex items-center gap-2 text-sm font-medium"
                      style={{ color: "var(--t-brass)" }}
                    >
                      <Plus className="size-4" /> Ajouter une charge
                    </button>
                  </div>
                </Panel>

                <Panel>
                  <SectionTitle aside={euros(totals.totalIncome)}>Revenus</SectionTitle>
                  <InlineAmountField
                    label="Salaire"
                    value={salary}
                    onSave={saveSalary}
                    placeholder="2000"
                  />

                  {extraIncomes.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {extraIncomes.map((inc) => (
                        <li key={inc.id} className="flex items-center gap-3 text-sm">
                          <span className="min-w-0 flex-1 truncate" style={{ color: "var(--t-paper)" }}>
                            {inc.description}
                          </span>
                          <Amount tone="accent">+{euros(inc.amount)}</Amount>
                          <IconButton label={`Supprimer ${inc.description}`} onClick={() => deleteExtraIncome(inc.id)} danger>
                            <Trash2 className="size-4" />
                          </IconButton>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form onSubmit={addExtraIncome} className="mt-3 flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      value={incomeAmount}
                      onChange={(e) => setIncomeAmount(e.target.value)}
                      placeholder="Montant"
                      className={`${FIELD} !w-28 shrink-0`}
                      style={FIELD_STYLE}
                      aria-label="Montant du revenu supplémentaire"
                    />
                    <input
                      value={incomeDescription}
                      onChange={(e) => setIncomeDescription(e.target.value)}
                      placeholder="Prime, remboursement…"
                      className={FIELD}
                      style={FIELD_STYLE}
                      aria-label="Nature du revenu supplémentaire"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-xl px-3.5"
                      style={{ backgroundColor: "var(--t-moss)", color: "var(--t-brass)" }}
                      aria-label="Ajouter le revenu"
                    >
                      <Plus className="size-5" />
                    </button>
                  </form>
                </Panel>

                <Panel>
                  <SectionTitle aside={savingsGoalNum > 0 ? `${Math.round(savingsProgress)} %` : undefined}>
                    Objectif d'épargne
                  </SectionTitle>
                  <InlineAmountField
                    label="Objectif du mois"
                    value={savingsGoalInput}
                    onSave={saveSavingsGoal}
                    placeholder="400"
                  />
                  {savingsGoalNum > 0 && (
                    <>
                      <div className="mt-3 h-2.5 w-full rounded-[3px]" style={{ backgroundColor: "var(--t-moss)" }}>
                        <div
                          className="h-full rounded-r-[4px]"
                          style={{
                            width: `${savingsProgress}%`,
                            backgroundColor: catById("epargne")?.color ?? "var(--t-brass)",
                          }}
                        />
                      </div>
                      <p className="tnum mt-1.5 text-xs" style={{ color: "var(--t-sage)" }}>
                        {euros(savedThisMonth)} mis de côté sur {euros(savingsGoalNum)}
                      </p>
                    </>
                  )}
                </Panel>

                <Panel flush>
                  <div className="px-4 pb-1 pt-3">
                    <SectionTitle
                      aside={
                        expenses.length > 0 ? (
                          <button type="button" onClick={() => setScreen("historique")} style={{ color: "var(--t-brass)" }}>
                            Tout voir
                          </button>
                        ) : undefined
                      }
                    >
                      Dernières dépenses
                    </SectionTitle>
                  </div>
                  {expenses.length === 0 ? (
                    <Empty title="Rien de noté">Appuie sur + pour noter ta première dépense du mois.</Empty>
                  ) : (
                    expenses.slice(0, 6).map((e) => (
                      <ExpenseRow
                        key={e.id}
                        expense={e}
                        category={catById(e.category)}
                        onEdit={() => openExpenseSheet(e)}
                        onDelete={() => deleteExpense(e.id)}
                      />
                    ))
                  )}
                </Panel>
              </div>
            </>
          ))}

        {/* ===================== HISTORIQUE ===================== */}
        {screen === "historique" && (
          <div className="space-y-4 px-4 pt-4">
            <Panel>
              <SectionTitle>Rechercher</SectionTitle>
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Auchan, essence, 45…"
                  className={FIELD}
                  style={FIELD_STYLE}
                  aria-label="Rechercher une dépense"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2"
                    style={{ color: "var(--t-sage)" }}
                    aria-label="Effacer la recherche"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Chip active={!scopeAllMonths} onClick={() => setScopeAllMonths(false)}>
                  {month ? monthLabel(month) : "Mois affiché"}
                </Chip>
                <Chip active={scopeAllMonths} onClick={() => setScopeAllMonths(true)}>
                  Tous les mois
                </Chip>
              </div>

              {/* Une seule rangée qui défile : la liste des catégories sur quatre
                  lignes repoussait les résultats hors de l'écran. */}
              <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Chip active={filterCategory === null} onClick={() => setFilterCategory(null)}>
                  Toutes
                </Chip>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    active={filterCategory === c.id}
                    onClick={() => setFilterCategory(filterCategory === c.id ? null : c.id)}
                  >
                    <Dot color={c.color} className="mr-1.5" />
                    {c.name}
                  </Chip>
                ))}
              </div>
            </Panel>

            <Panel flush>
              <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-3">
                <h2 className="text-[0.95rem] font-semibold" style={{ color: "var(--t-paper)" }}>
                  {filteredExpenses.length} dépense{filteredExpenses.length > 1 ? "s" : ""}
                </h2>
                <Amount>{euros(filteredTotal)}</Amount>
              </div>
              {filteredExpenses.length === 0 ? (
                <Empty title="Aucun résultat">Essaie un autre mot, ou élargis à tous les mois.</Empty>
              ) : (
                filteredExpenses
                  .slice(0, 100)
                  .map((e) => (
                    <ExpenseRow
                      key={`${e.month}-${e.id}`}
                      expense={e}
                      category={catById(e.category)}
                      showMonth={scopeAllMonths ? e.month : undefined}
                      onEdit={e.month === month ? () => openExpenseSheet(e) : undefined}
                      onDelete={e.month === month ? () => deleteExpense(e.id) : undefined}
                    />
                  ))
              )}
              {filteredExpenses.length > 100 && (
                <p className="px-4 py-3 text-xs" style={{ color: "var(--t-sage)" }}>
                  Les 100 plus récentes sont affichées. Affine la recherche pour voir les autres.
                </p>
              )}
            </Panel>

            <Panel>
              <SectionTitle aside={`${history.length} mois`}>Évolution</SectionTitle>
              <EvolutionChart history={history} />
            </Panel>

            <Panel>
              <SectionTitle
                aside={comparison.previousMonth ? `contre ${monthLabel(comparison.previousMonth)}` : undefined}
              >
                Comparaison
              </SectionTitle>
              {comparison.previousMonth ? (
                <ComparisonList rows={comparison.rows} />
              ) : (
                <Empty title="Pas de mois précédent">
                  La comparaison apparaîtra dès qu'un mois antérieur sera enregistré.
                </Empty>
              )}
            </Panel>

            <Panel>
              <SectionTitle>Export</SectionTitle>
              <p className="mb-3 text-sm" style={{ color: "var(--t-sage)" }}>
                Toutes tes dépenses, tous les mois, dans un tableur.
              </p>
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ backgroundColor: "var(--t-moss)", color: "var(--t-paper)" }}
              >
                <Download className="size-4" /> Télécharger le CSV
              </button>
            </Panel>
          </div>
        )}

        {/* ===================== ÉPARGNE ===================== */}
        {screen === "epargne" && (
          <div className="space-y-4 px-4 pt-4">
            <Panel>
              <SectionTitle>Épargne</SectionTitle>
              <p className="figure-hero text-[clamp(2.5rem,12vw,3.75rem)]" style={{ color: "var(--t-brass)" }}>
                {euros(projection.currentSavings)}
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--t-sage)" }}>
                Aujourd'hui. Projetée à {eurosRound(projection.projectedFinalSavings)} une fois les projets inclus
                déduits.
              </p>
              {projection.hasNegative && (
                <p className="mt-3 text-sm" style={{ color: "var(--t-alert)" }}>
                  En l'état, le solde passe sous zéro avant la fin de la projection. Décale un projet ou augmente
                  l'épargne mensuelle.
                </p>
              )}
            </Panel>

            <Panel>
              <SectionTitle>Projection</SectionTitle>
              <ProjectionChart points={projection.points} currentMonth={currentMonthStr} />
            </Panel>

            <Panel>
              <SectionTitle>Solde de départ</SectionTitle>
              <p className="mb-3 text-sm" style={{ color: "var(--t-sage)" }}>
                Ce que tu as déjà de côté. Daté du mois consulté{month ? ` (${monthLabel(month)})` : ""} : l'épargne est
                cumulée à partir de là.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={initialSavingsInput}
                  onChange={(e) => setInitialSavingsInput(e.target.value)}
                  className={FIELD}
                  style={FIELD_STYLE}
                  aria-label="Solde d'épargne de départ"
                />
                <button
                  type="button"
                  onClick={saveInitialSavings}
                  className="shrink-0 rounded-xl px-4 font-semibold"
                  style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                >
                  Enregistrer
                </button>
              </div>
              {initialSavingsMonth && (
                <p className="mt-2 text-xs" style={{ color: "var(--t-sage)" }}>
                  Référence actuelle : {monthLabel(initialSavingsMonth)}
                </p>
              )}
            </Panel>

            <Panel flush>
              <div className="px-4 pb-1 pt-3">
                <SectionTitle aside={`${eurosRound(includedTotal)} inclus`}>Projets</SectionTitle>
              </div>
              {sortedProjects.length === 0 ? (
                <Empty title="Aucun projet">Un voyage, un achat : note-le et vois s'il tient dans ton épargne.</Empty>
              ) : (
                sortedProjects.map((p) => {
                  const feasible = projection.feasibility.get(p.id)
                  return (
                    <Row key={p.id}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm" style={{ color: "var(--t-paper)" }}>
                          {p.name}
                        </span>
                        <span className="text-xs" style={{ color: "var(--t-sage)" }}>
                          {PROJECT_TYPES[p.type].label} · {monthLabel(p.targetMonth)}
                          {p.included && feasible !== undefined && (
                            <span style={{ color: feasible ? "var(--t-sage)" : "var(--t-alert)" }}>
                              {feasible ? " · finançable" : " · hors budget"}
                            </span>
                          )}
                        </span>
                      </span>
                      <Amount tone={p.included ? "default" : "muted"}>{eurosRound(p.amount)}</Amount>
                      <Switch
                        checked={p.included}
                        onCheckedChange={() => toggleProjectIncluded(p.id)}
                        aria-label={`Inclure ${p.name} dans la projection`}
                      />
                      <IconButton label={`Supprimer ${p.name}`} onClick={() => deleteProject(p.id)} danger>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </Row>
                  )
                })
              )}

              <form onSubmit={addProject} className="space-y-2 px-4 py-4">
                <input
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Voyage Japon"
                  className={FIELD}
                  style={FIELD_STYLE}
                  aria-label="Nom du projet"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={newProjectAmount}
                    onChange={(e) => setNewProjectAmount(e.target.value)}
                    placeholder="2800"
                    className={FIELD}
                    style={FIELD_STYLE}
                    aria-label="Montant du projet"
                  />
                  <input
                    value={newProjectMonth}
                    onChange={(e) => setNewProjectMonth(e.target.value)}
                    placeholder="2027-06"
                    className={FIELD}
                    style={FIELD_STYLE}
                    aria-label="Mois cible, au format AAAA-MM"
                  />
                </div>
                <div className="flex gap-2">
                  {(Object.keys(PROJECT_TYPES) as ProjectType[]).map((t) => (
                    <Chip key={t} active={newProjectType === t} onClick={() => setNewProjectType(t)}>
                      {PROJECT_TYPES[t].label}
                    </Chip>
                  ))}
                  <button
                    type="submit"
                    className="ml-auto rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </Panel>
          </div>
        )}

        {/* ===================== RÉGLAGES ===================== */}
        {screen === "reglages" && (
          <div className="space-y-4 px-4 pt-4">
            {/* Invitations reçues, en premier : quelqu'un attend une réponse. */}
            {invites.length > 0 && (
              <Panel>
                <SectionTitle>Invitations</SectionTitle>
                <ul className="space-y-3">
                  {invites.map((inv) => (
                    <li key={inv.householdId}>
                      <p className="text-sm" style={{ color: "var(--t-paper)" }}>
                        <span className="font-semibold">{inv.invitedBy}</span> t&apos;invite à rejoindre{" "}
                        <span className="font-semibold">{inv.householdName}</span>.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            householdAction({ action: "accept", householdId: inv.householdId }, "Foyer rejoint")
                          }
                          className="rounded-xl px-4 py-2 text-sm font-semibold"
                          style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                        >
                          Rejoindre
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            householdAction({ action: "decline", householdId: inv.householdId }, "Invitation refusée")
                          }
                          className="rounded-xl px-4 py-2 text-sm font-semibold"
                          style={{ backgroundColor: "var(--t-moss)", color: "var(--t-mist)" }}
                        >
                          Refuser
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {household ? (
              <Panel flush>
                <div className="px-4 pb-1 pt-3">
                  <SectionTitle aside={`${household.members.length} membres`}>{household.name}</SectionTitle>
                </div>
                {household.members.map((m) => (
                  <Row key={m.username}>
                    <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--t-paper)" }}>
                      {m.username}
                      {m.username === currentUser && <span style={{ color: "var(--t-sage)" }}> (toi)</span>}
                    </span>
                    <span className="text-xs" style={{ color: "var(--t-sage)" }}>
                      {m.role === "proprietaire" ? "a créé le foyer" : "membre"}
                    </span>
                  </Row>
                ))}
                {pendingInvites.map((u) => (
                  <Row key={u}>
                    <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--t-sage)" }}>
                      {u}
                    </span>
                    <span className="text-xs" style={{ color: "var(--t-sage)" }}>
                      invitation en attente
                    </span>
                    <IconButton
                      label={`Annuler l'invitation de ${u}`}
                      danger
                      onClick={() => householdAction({ action: "cancelInvite", username: u }, "Invitation annulée")}
                    >
                      <X className="size-4" />
                    </IconButton>
                  </Row>
                ))}

                <form onSubmit={inviteMember} className="flex gap-2 px-4 py-3">
                  <input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Pseudo à inviter"
                    autoCapitalize="none"
                    className={FIELD}
                    style={FIELD_STYLE}
                    aria-label="Pseudo de la personne à inviter"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl px-4 text-sm font-semibold"
                    style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                  >
                    Inviter
                  </button>
                </form>

                <Row onClick={leaveHouseholdFn}>
                  <LogOut className="size-4" style={{ color: "var(--t-alert)" }} />
                  <span className="flex-1 text-sm" style={{ color: "var(--t-alert)" }}>
                    Quitter {household.name}
                  </span>
                </Row>
              </Panel>
            ) : (
              <Panel>
                <SectionTitle>Foyer</SectionTitle>
                <p className="mb-3 text-sm" style={{ color: "var(--t-sage)" }}>
                  Un espace partagé à côté de ton budget perso : les dépenses communes y vont, et l&apos;app calcule qui
                  doit combien à qui. Tu invites ensuite qui tu veux par son pseudo.
                </p>
                <form onSubmit={createHouseholdFn} className="flex gap-2">
                  <input
                    value={newHouseholdName}
                    onChange={(e) => setNewHouseholdName(e.target.value)}
                    placeholder="Maison, Coloc, Vacances…"
                    className={FIELD}
                    style={FIELD_STYLE}
                    aria-label="Nom du foyer"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-xl px-4 text-sm font-semibold"
                    style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                  >
                    Créer
                  </button>
                </form>
              </Panel>
            )}

            <Panel>
              <SectionTitle>Budgets par catégorie</SectionTitle>
              <p className="mb-3 text-sm" style={{ color: "var(--t-sage)" }}>
                Laisse vide pour ne pas suivre de budget sur une catégorie.
              </p>
              <BudgetEditor
                categories={categories.filter((c) => c.id !== "epargne")}
                budgets={categoryBudgets}
                onSave={async (next) => {
                  if (await saveCategoryBudgets(next)) setCategoryBudgets(next)
                }}
              />
            </Panel>

            <Panel>
              <SectionTitle>Jour de paie</SectionTitle>
              <p className="mb-3 text-sm" style={{ color: "var(--t-sage)" }}>
                Le décompte des jours restants se cale sur ta prochaine paie plutôt que sur la fin du mois.
              </p>
              <select
                value={payDay}
                onChange={(e) => savePayDay(Number(e.target.value))}
                className={`${FIELD} appearance-none`}
                style={FIELD_STYLE}
                aria-label="Jour du mois où tombe la paie"
              >
                <option value={0}>Fin du mois</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Le {d}
                  </option>
                ))}
              </select>
            </Panel>

            <Panel flush>
              <div className="px-4 pb-1 pt-3">
                <SectionTitle>Catégories</SectionTitle>
              </div>
              {categories.map((c) => {
                const isCustom = customCategories.some((cc) => cc.id === c.id)
                return (
                  <Row key={c.id}>
                    <Dot color={c.color} />
                    <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--t-paper)" }}>
                      {c.name}
                    </span>
                    {isCustom ? (
                      <IconButton label={`Supprimer ${c.name}`} onClick={() => deleteCustomCategory(c.id)} danger>
                        <Trash2 className="size-4" />
                      </IconButton>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--t-sage)" }}>
                        par défaut
                      </span>
                    )}
                  </Row>
                )
              })}

              <form onSubmit={addCustomCategory} className="space-y-2.5 px-4 py-4">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Animaux, travaux…"
                  className={FIELD}
                  style={FIELD_STYLE}
                  aria-label="Nom de la nouvelle catégorie"
                />
                <div className="flex items-center gap-2">
                  {CUSTOM_CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCategoryColor(c)}
                      className="flex size-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: c }}
                      aria-label={`Couleur ${c}`}
                      aria-pressed={newCategoryColor === c}
                    >
                      {newCategoryColor === c && <Check className="size-4" style={{ color: "var(--t-ink)" }} />}
                    </button>
                  ))}
                  <button
                    type="submit"
                    className="ml-auto rounded-xl px-4 py-2 text-sm font-semibold"
                    style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            </Panel>

            <Panel flush>
              <div className="px-4 pb-1 pt-3">
                <SectionTitle>Mois</SectionTitle>
              </div>
              <Row
                onClick={() => {
                  setNewMonthInput(getSuggestedNextMonth())
                  setIsNewMonthDialogOpen(true)
                }}
              >
                <Plus className="size-4" style={{ color: "var(--t-brass)" }} />
                <span className="flex-1 text-sm" style={{ color: "var(--t-paper)" }}>
                  Créer un mois
                </span>
              </Row>
              {month && (
                <>
                  <Row
                    onClick={() => {
                      setEditMonthInput(month)
                      setIsEditMonthOpen(true)
                    }}
                  >
                    <Pencil className="size-4" style={{ color: "var(--t-sage)" }} />
                    <span className="flex-1 text-sm" style={{ color: "var(--t-paper)" }}>
                      Corriger la date {ofMonth(month)}
                    </span>
                  </Row>
                  <Row onClick={deleteMonth}>
                    <Trash2 className="size-4" style={{ color: "var(--t-alert)" }} />
                    <span className="flex-1 text-sm" style={{ color: "var(--t-alert)" }}>
                      Supprimer {monthLabel(month)}
                    </span>
                  </Row>
                </>
              )}
            </Panel>

            <Panel flush>
              <div className="px-4 pb-1 pt-3">
                <SectionTitle>Compte</SectionTitle>
              </div>
              <Row>
                <span className="flex-1 text-sm" style={{ color: "var(--t-paper)" }}>
                  Connecté en tant que {currentUser}
                </span>
              </Row>
              <Row onClick={handleLogout}>
                <LogOut className="size-4" style={{ color: "var(--t-sage)" }} />
                <span className="flex-1 text-sm" style={{ color: "var(--t-paper)" }}>
                  Se déconnecter
                </span>
              </Row>
            </Panel>
          </div>
        )}
      </main>

      <Dock screen={screen} onScreen={setScreen} onAdd={() => openExpenseSheet()} canAdd={!!month} />

      {/* ===================== Noter une dépense ===================== */}
      <Sheet
        open={isQuickAddOpen}
        onOpenChange={(v) => {
          setIsQuickAddOpen(v)
          if (!v) setEditingExpense(null)
        }}
        title={editingExpense ? "Modifier la dépense" : "Noter une dépense"}
      >
        {!editingExpense && !isShared && suggestions.length > 0 && (
          <div className="mb-4">
            <p className={LABEL} style={LABEL_STYLE}>
              Tes habitudes
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={`${s.category}-${s.description}`}
                  type="button"
                  onClick={() => logExpense(s.amount, s.description, s.category)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--t-moss)", color: "var(--t-paper)" }}
                >
                  <Dot color={catById(s.category)?.color ?? "var(--t-sage)"} />
                  {s.description}
                  <span className="tnum font-semibold" style={{ color: "var(--t-brass)" }}>
                    {euros(s.amount)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={submitExpense} className="space-y-3">
          {household && !editingExpense && (
            <div>
              <p className={LABEL} style={LABEL_STYLE}>
                Pour qui
              </p>
              <div className="flex gap-2">
                <Chip active={view === "moi"} onClick={() => setView("moi")}>
                  Moi
                </Chip>
                <Chip active={view === "foyer"} onClick={() => setView("foyer")}>
                  {household.name}
                </Chip>
              </div>
            </div>
          )}

          {isShared && memberNames.length > 1 && (
            <div>
              <p className={LABEL} style={LABEL_STYLE}>
                Qui a payé
              </p>
              <div className="flex flex-wrap gap-2">
                {memberNames.map((m) => (
                  <Chip key={m} active={paidBy === m} onClick={() => setPaidBy(m)}>
                    {m === currentUser ? "Moi" : m}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="qa-montant" className={LABEL} style={LABEL_STYLE}>
              Montant
            </label>
            <input
              id="qa-montant"
              type="number"
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className={`${FIELD} figure-hero !text-4xl`}
              style={FIELD_STYLE}
            />
          </div>

          <div>
            <p className={LABEL} style={LABEL_STYLE}>
              Catégorie
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                  <Dot color={c.color} className="mr-1.5" />
                  {c.name}
                </Chip>
              ))}
              {!isAddingCategory && (
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors"
                  style={{ backgroundColor: "var(--t-moss)", borderColor: "var(--t-line)", color: "var(--t-brass)" }}
                >
                  <Plus className="size-4" /> Nouvelle
                </button>
              )}
            </div>

            {isAddingCategory && (
              <div className="mt-2.5 rounded-xl border p-3" style={{ borderColor: "var(--t-line)" }}>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={quickCategoryName}
                    onChange={(e) => setQuickCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && quickCategoryName.trim()) {
                        e.preventDefault()
                        submitQuickCategory()
                      }
                    }}
                    placeholder="Nom de la catégorie"
                    className={FIELD}
                    style={FIELD_STYLE}
                    aria-label="Nom de la nouvelle catégorie"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCategory(false)
                      setQuickCategoryName("")
                    }}
                    className="shrink-0 rounded-xl px-3"
                    style={{ color: "var(--t-sage)" }}
                    aria-label="Annuler la création de catégorie"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {CUSTOM_CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setQuickCategoryColor(c)}
                      className="flex size-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: c }}
                      aria-label={`Couleur ${c}`}
                      aria-pressed={quickCategoryColor === c}
                    >
                      {quickCategoryColor === c && <Check className="size-4" style={{ color: "var(--t-ink)" }} />}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={submitQuickCategory}
                    disabled={!quickCategoryName.trim()}
                    className="ml-auto rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
                  >
                    Ajouter
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="qa-date" className={LABEL} style={LABEL_STYLE}>
              Date
            </label>
            <input
              id="qa-date"
              type="date"
              value={expenseDate}
              min={month ? `${month}-01` : undefined}
              max={month ? lastDayOf(month) : undefined}
              onChange={(e) => setExpenseDate(e.target.value)}
              className={FIELD}
              style={FIELD_STYLE}
            />
          </div>

          <div>
            <label htmlFor="qa-desc" className={LABEL} style={LABEL_STYLE}>
              Description (facultative)
            </label>
            <input
              id="qa-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Courses Auchan"
              className={FIELD}
              style={FIELD_STYLE}
            />
          </div>

          <button
            type="submit"
            disabled={!amount || isLoading}
            className="w-full rounded-xl py-3.5 text-base font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
          >
            {editingExpense ? "Enregistrer" : isShared ? "Noter pour le foyer" : "Noter la dépense"}
          </button>
        </form>
      </Sheet>

      {/* ===================== Choisir un mois ===================== */}
      <Sheet open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen} title="Choisir un mois">
        {allMonths.length === 0 ? (
          <Empty title="Aucun mois enregistré">Crée ton premier mois pour démarrer.</Empty>
        ) : (
          <ul className="-mx-1">
            {[...allMonths].reverse().map((m) => (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => {
                    fetchMonthData(m)
                    setIsMonthPickerOpen(false)
                    setScreen("mois")
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
                  style={{ color: m === month ? "var(--t-brass)" : "var(--t-paper)" }}
                >
                  <span className="flex-1">{monthLabel(m)}</span>
                  {m === month && <Check className="size-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => {
            setIsMonthPickerOpen(false)
            setNewMonthInput(getSuggestedNextMonth())
            setIsNewMonthDialogOpen(true)
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold"
          style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
        >
          <Plus className="size-5" /> Créer un mois
        </button>
      </Sheet>

      {/* ===================== Créer un mois ===================== */}
      <Sheet open={isNewMonthDialogOpen} onOpenChange={setIsNewMonthDialogOpen} title="Créer un mois">
        <form onSubmit={createNewMonth} className="space-y-3">
          <div>
            <label htmlFor="nm-mois" className={LABEL} style={LABEL_STYLE}>
              Mois (AAAA-MM)
            </label>
            <input
              id="nm-mois"
              value={newMonthInput}
              onChange={(e) => setNewMonthInput(e.target.value)}
              placeholder="2026-11"
              className={FIELD}
              style={FIELD_STYLE}
            />
          </div>
          <div>
            <label htmlFor="nm-salaire" className={LABEL} style={LABEL_STYLE}>
              Salaire
            </label>
            <input
              id="nm-salaire"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={newMonthSalary}
              onChange={(e) => setNewMonthSalary(e.target.value)}
              placeholder="2000"
              className={FIELD}
              style={FIELD_STYLE}
            />
          </div>
          <p className="text-sm" style={{ color: "var(--t-sage)" }}>
            Tes charges fixes récurrentes seront reprises automatiquement.
          </p>
          <button
            type="submit"
            className="w-full rounded-xl py-3.5 font-semibold"
            style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
          >
            Créer
          </button>
        </form>
      </Sheet>

      {/* ===================== Corriger la date ===================== */}
      <Sheet open={isEditMonthOpen} onOpenChange={setIsEditMonthOpen} title="Corriger la date du mois">
        <form onSubmit={renameMonth} className="space-y-3">
          <input
            value={editMonthInput}
            onChange={(e) => setEditMonthInput(e.target.value)}
            placeholder="2026-09"
            className={FIELD}
            style={FIELD_STYLE}
            aria-label="Nouvelle date, au format AAAA-MM"
          />
          <p className="text-sm" style={{ color: "var(--t-sage)" }}>
            Les dépenses et charges du mois suivent la nouvelle date.
          </p>
          <button
            type="submit"
            className="w-full rounded-xl py-3.5 font-semibold"
            style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
          >
            Corriger
          </button>
        </form>
      </Sheet>

      {/* ===================== Charge fixe ===================== */}
      <Sheet
        open={isFixedFormOpen}
        onOpenChange={setIsFixedFormOpen}
        title={editingFixedExpense ? "Modifier la charge" : "Ajouter une charge"}
      >
        <form onSubmit={submitFixedExpense} className="space-y-3">
          <div>
            <label htmlFor="fx-desc" className={LABEL} style={LABEL_STYLE}>
              Intitulé
            </label>
            <input
              id="fx-desc"
              value={fixedDescription}
              onChange={(e) => setFixedDescription(e.target.value)}
              placeholder="Loyer"
              className={FIELD}
              style={FIELD_STYLE}
            />
          </div>
          <div>
            <label htmlFor="fx-montant" className={LABEL} style={LABEL_STYLE}>
              Montant
            </label>
            <input
              id="fx-montant"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={fixedAmount}
              onChange={(e) => setFixedAmount(e.target.value)}
              placeholder="780"
              className={FIELD}
              style={FIELD_STYLE}
            />
          </div>
          <label className="flex items-center gap-3 py-1">
            <Switch checked={isExceptional} onCheckedChange={setIsExceptional} />
            <span className="text-sm" style={{ color: "var(--t-paper)" }}>
              Exceptionnelle — ne pas la reprendre le mois prochain
            </span>
          </label>
          <button
            type="submit"
            className="w-full rounded-xl py-3.5 font-semibold"
            style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
          >
            {editingFixedExpense ? "Enregistrer" : "Ajouter"}
          </button>
        </form>
      </Sheet>
    </div>
  )
}

// =============================================================
// Petits composants locaux
// =============================================================

/** Une feuille ancrée en bas : à portée de pouce, contrairement à une fenêtre centrée. */
function Sheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-auto bottom-0 left-0 right-0 max-h-[88svh] w-full max-w-2xl translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl border-x-0 border-b-0 p-5 sm:left-1/2 sm:-translate-x-1/2"
        style={{ backgroundColor: "var(--t-pine)", borderColor: "var(--t-line)" }}
      >
        <DialogHeader className="mb-3 text-left">
          <DialogTitle className="text-lg font-semibold" style={{ color: "var(--t-paper)" }}>
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Au repos les icônes restent grises : une liste de dix corbeilles rouges
      // crie plus fort que les montants. Le rouge n'apparaît qu'à l'intention.
      className={cn(
        "shrink-0 rounded-lg p-2 text-[var(--t-sage)] transition-colors hover:bg-white/[0.06]",
        danger && "hover:text-[var(--t-alert)] focus-visible:text-[var(--t-alert)]"
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex shrink-0 items-center whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-colors"
      style={{
        backgroundColor: active ? "var(--t-brass)" : "var(--t-moss)",
        borderColor: active ? "var(--t-brass)" : "var(--t-line)",
        color: active ? "var(--t-ink)" : "var(--t-paper)",
      }}
    >
      {children}
    </button>
  )
}

function ExpenseRow({
  expense,
  category,
  showMonth,
  onDelete,
  onEdit,
}: {
  expense: Expense
  category?: Category
  showMonth?: string
  onDelete?: () => void
  onEdit?: () => void
}) {
  return (
    <Row>
      <Dot color={category?.color ?? "var(--t-sage)"} />
      <button
        type="button"
        onClick={onEdit}
        disabled={!onEdit}
        className="min-w-0 flex-1 rounded-lg text-left disabled:cursor-default"
      >
        <span className="block truncate text-sm" style={{ color: "var(--t-paper)" }}>
          {expense.description}
        </span>
        <span className="text-xs" style={{ color: "var(--t-sage)" }}>
          {dayLabel(expense.date)}
          {showMonth ? ` · ${monthLabel(showMonth)}` : ""}
          {category ? ` · ${category.name}` : ""}
        </span>
      </button>
      <Amount>{euros(expense.amount)}</Amount>
      {onDelete && (
        <IconButton label={`Supprimer ${expense.description}`} onClick={onDelete} danger>
          <Trash2 className="size-4" />
        </IconButton>
      )}
    </Row>
  )
}

/** Montant modifiable sur place : on n'enregistre que si la valeur a bougé. */
function InlineAmountField({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string
  value: string
  onSave: (v: string) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const dirty = draft !== value

  return (
    <div>
      <label className={LABEL} style={LABEL_STYLE}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className={FIELD}
          style={FIELD_STYLE}
        />
        {dirty && (
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="shrink-0 rounded-xl px-4 text-sm font-semibold"
            style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
          >
            Enregistrer
          </button>
        )}
      </div>
    </div>
  )
}

/** Budgets : un brouillon local, enregistré en une fois. */
function BudgetEditor({
  categories,
  budgets,
  onSave,
}: {
  categories: Category[]
  budgets: Record<string, number>
  onSave: (next: Record<string, number>) => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  useEffect(() => {
    setDraft(Object.fromEntries(categories.map((c) => [c.id, budgets[c.id] ? String(budgets[c.id]) : ""])))
  }, [categories, budgets])

  const dirty = categories.some((c) => (draft[c.id] ?? "") !== (budgets[c.id] ? String(budgets[c.id]) : ""))

  return (
    <div className="space-y-2.5">
      {categories.map((c) => (
        <div key={c.id} className="flex items-center gap-3">
          <Dot color={c.color} />
          <span className="min-w-0 flex-1 truncate text-sm" style={{ color: "var(--t-paper)" }}>
            {c.name}
          </span>
          <input
            type="number"
            step="1"
            inputMode="decimal"
            value={draft[c.id] ?? ""}
            onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })}
            placeholder="—"
            className={`${FIELD} tnum !w-28 shrink-0 text-right`}
            style={FIELD_STYLE}
            aria-label={`Budget mensuel pour ${c.name}`}
          />
        </div>
      ))}
      {dirty && (
        <button
          type="button"
          onClick={() => {
            const next: Record<string, number> = {}
            Object.entries(draft).forEach(([id, v]) => {
              const n = parseFloat(v)
              if (!Number.isNaN(n) && n > 0) next[id] = n
            })
            onSave(next)
          }}
          className="w-full rounded-xl py-3 font-semibold"
          style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
        >
          Enregistrer les budgets
        </button>
      )}
    </div>
  )
}
