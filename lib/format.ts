// Mise en forme pour l'affichage. Tout passe par ici pour que les montants et
// les dates s'écrivent de la même façon partout.

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const EUR_ROUND = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

export function euros(value: number): string {
  return EUR.format(value)
}

/** Sans centimes : pour les grands nombres où ils n'apportent rien. */
export function eurosRound(value: number): string {
  return EUR_ROUND.format(value)
}

/** Montant signé, pour une variation. Le signe est porté par le texte, pas par la couleur seule. */
export function signedEuros(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${EUR.format(Math.abs(value))}`
}

export function percent(value: number, digits = 0): string {
  return `${value.toFixed(digits).replace(".", ",")} %`
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
]

/** "2026-10" → "octobre 2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  return `${MONTHS_FR[m - 1]} ${y}`
}

/**
 * "de octobre 2026" ne se dit pas. Renvoie le libellé précédé de « de » ou « d' »
 * selon l'initiale du mois (avril, août, octobre).
 */
export function ofMonth(ym: string): string {
  const label = monthLabel(ym)
  return /^[aeiouéèêh]/i.test(label) ? `d'${label}` : `de ${label}`
}

/** "2026-10" → "oct. 26", pour les axes de graphiques */
export function monthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m) return ym
  const name = MONTHS_FR[m - 1]
  const abbrev = name.length > 4 ? `${name.slice(0, 3)}.` : name
  return `${abbrev} ${String(y).slice(2)}`
}

/** "2026-10-24" → "24 oct." */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number)
  if (!m || !d) return iso
  const name = MONTHS_FR[m - 1]
  return `${d} ${name.length > 4 ? `${name.slice(0, 3)}.` : name}`
}

/** Deux lettres pour la pastille de compte. */
export function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}
