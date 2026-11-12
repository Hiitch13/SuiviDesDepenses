"use client"

import { type FormEvent, useEffect, useState } from "react"

import { Chip, FIELD, FIELD_STYLE, LABEL, LABEL_STYLE, Sheet } from "@/components/thrift/controls"
import { type SavingsMove, defaultDateFor, recalibration, savingsBalanceAt } from "@/lib/budget"
import { euros, monthLabel, signedEuros } from "@/lib/format"

const PRIMARY = "w-full rounded-xl py-3.5 text-base font-semibold disabled:opacity-50"
const PRIMARY_STYLE = { backgroundColor: "var(--t-brass)", color: "var(--t-ink)" } as const

/**
 * Saisie ou correction d'un mouvement d'épargne. Un recalage existant s'y
 * corrige aussi : son montant est signé et son type ne change pas.
 */
export function SavingsMoveSheet({
  open,
  onOpenChange,
  move,
  defaultMonth,
  defaultKind = "versement",
  onSave,
  onDelete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Mouvement à corriger ; null pour en saisir un nouveau. */
  move: SavingsMove | null
  /** Mois dans lequel dater un nouveau mouvement. */
  defaultMonth: string
  defaultKind?: "versement" | "retrait"
  onSave: (move: SavingsMove) => void
  onDelete: (id: string) => void
}) {
  const [kind, setKind] = useState<SavingsMove["kind"]>(defaultKind)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")

  // Chaque ouverture repart de l'état du mouvement visé, pas du précédent.
  useEffect(() => {
    if (!open) return
    setKind(move?.kind ?? defaultKind)
    setAmount(move ? String(move.amount) : "")
    setDate(move?.date ?? defaultDateFor(defaultMonth))
    setNote(move?.note ?? "")
  }, [open, move, defaultMonth, defaultKind])

  const isAdjustment = kind === "ajustement"
  const parsed = parseFloat(amount)
  const valid = Number.isFinite(parsed) && (isAdjustment ? parsed !== 0 : parsed > 0) && /^\d{4}-\d{2}-\d{2}$/.test(date)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    onSave({
      id: move?.id ?? `mv-${Date.now()}`,
      kind,
      amount: Math.round(parsed * 100) / 100,
      date,
      note: note.trim(),
    })
  }

  const title = move ? (isAdjustment ? "Modifier le recalage" : "Modifier le mouvement") : "Mouvement d'épargne"

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <form onSubmit={submit} className="space-y-3">
        {isAdjustment ? (
          <p className="text-sm" style={{ color: "var(--t-sage)" }}>
            Écart ajouté pour coller à ton solde réel. Positif s'il manquait de l'argent au compte, négatif sinon.
          </p>
        ) : (
          <div className="flex gap-2">
            <Chip active={kind === "versement"} onClick={() => setKind("versement")}>
              Versement
            </Chip>
            <Chip active={kind === "retrait"} onClick={() => setKind("retrait")}>
              Retrait
            </Chip>
          </div>
        )}

        <div>
          <label htmlFor="sv-amount" className={LABEL} style={LABEL_STYLE}>
            Montant
          </label>
          <input
            id="sv-amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={isAdjustment ? "-25" : "200"}
            className={`${FIELD} tnum`}
            style={FIELD_STYLE}
            autoFocus={!move}
          />
        </div>

        <div>
          <label htmlFor="sv-date" className={LABEL} style={LABEL_STYLE}>
            Date
          </label>
          <input
            id="sv-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </div>

        <div>
          <label htmlFor="sv-note" className={LABEL} style={LABEL_STYLE}>
            Note (facultative)
          </label>
          <input
            id="sv-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={kind === "retrait" ? "Réparation voiture" : "Livret A"}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </div>

        <button type="submit" disabled={!valid} className={PRIMARY} style={PRIMARY_STYLE}>
          {move ? "Enregistrer" : kind === "retrait" ? "Noter le retrait" : "Noter le versement"}
        </button>

        {move && (
          <button
            type="button"
            onClick={() => onDelete(move.id)}
            className="w-full rounded-xl py-3 text-sm font-semibold"
            style={{ color: "var(--t-alert)" }}
          >
            Supprimer
          </button>
        )}
      </form>
    </Sheet>
  )
}

/**
 * « Fin <mois>, mon solde réel est de X. » Montre l'écart avant de l'enregistrer
 * sous forme d'ajustement.
 */
export function RecalibrateSheet({
  open,
  onOpenChange,
  moves,
  currentMonth,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  moves: SavingsMove[]
  currentMonth: string
  onConfirm: (adjustment: SavingsMove) => void
}) {
  const [month, setMonth] = useState(currentMonth)
  const [real, setReal] = useState("")

  useEffect(() => {
    if (!open) return
    setMonth(currentMonth)
    setReal("")
  }, [open, currentMonth])

  const validMonth = /^\d{4}-\d{2}$/.test(month)
  const computed = validMonth ? savingsBalanceAt(moves, month) : 0
  const parsed = parseFloat(real)
  const adjustment = validMonth && Number.isFinite(parsed) ? recalibration(moves, month, parsed) : null
  const noGap = validMonth && Number.isFinite(parsed) && adjustment === null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (adjustment) onConfirm(adjustment)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Recaler sur mon solde réel">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="rc-month" className={LABEL} style={LABEL_STYLE}>
            À la fin de quel mois ?
          </label>
          <input
            id="rc-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={FIELD}
            style={FIELD_STYLE}
          />
        </div>

        <div>
          <label htmlFor="rc-real" className={LABEL} style={LABEL_STYLE}>
            Solde réel de ton épargne
          </label>
          <input
            id="rc-real"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={real}
            onChange={(e) => setReal(e.target.value)}
            placeholder={String(Math.round(computed))}
            className={`${FIELD} tnum`}
            style={FIELD_STYLE}
            autoFocus
          />
        </div>

        {validMonth && (
          <p className="tnum text-sm" style={{ color: "var(--t-sage)" }}>
            Calculé fin {monthLabel(month)} : {euros(computed)}
            {adjustment && (
              <>
                <br />
                Écart enregistré :{" "}
                <span className="font-semibold" style={{ color: "var(--t-paper)" }}>
                  {signedEuros(adjustment.amount)}
                </span>
              </>
            )}
            {noGap && (
              <>
                <br />
                Aucun écart : rien à corriger.
              </>
            )}
          </p>
        )}

        <button type="submit" disabled={!adjustment} className={PRIMARY} style={PRIMARY_STYLE}>
          Recaler
        </button>
      </form>
    </Sheet>
  )
}
