import { createHmac, timingSafeEqual } from "crypto"
import type { NextResponse } from "next/server"

// Session signée, sans état côté serveur.
//
// Le jeton porte le pseudo et une date d'expiration, scellés par un HMAC. Rien
// à stocker ni à nettoyer, et un jeton modifié est rejeté. Le cookie est
// `httpOnly` : le JavaScript de la page n'y a pas accès, donc une faille XSS ne
// permet pas de le voler.

const COOKIE = "thrift_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 jours

function secret(): string {
  const value = process.env.SESSION_SECRET
  // Pas de valeur de repli : un secret par défaut laisserait n'importe qui
  // forger un jeton valide pour n'importe quel compte.
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET manquante ou trop courte (32 caractères minimum)")
  }
  return value
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function createSessionToken(username: string, now: number = Date.now()): string {
  const expiresAt = now + MAX_AGE_SECONDS * 1000
  // Le pseudo est encodé pour que le séparateur reste sans ambiguïté.
  const payload = `${Buffer.from(username, "utf8").toString("base64url")}.${expiresAt}`
  return `${payload}.${sign(payload)}`
}

export function readSessionToken(token: string | undefined, now: number = Date.now()): string | null {
  if (!token) return null

  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [encodedUser, expiresAt, signature] = parts

  const expected = Buffer.from(sign(`${encodedUser}.${expiresAt}`))
  const received = Buffer.from(signature)
  // Comparaison à durée constante : une comparaison classique laisse deviner
  // la signature octet par octet en mesurant le temps de réponse.
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  if (!Number.isFinite(Number(expiresAt)) || Number(expiresAt) < now) return null

  const username = Buffer.from(encodedUser, "base64url").toString("utf8")
  return username || null
}

/** Le pseudo de la session, ou null. Seule source de vérité sur l'identité. */
export function sessionUser(request: Request, now: number = Date.now()): string | null {
  const header = request.headers.get("cookie")
  if (!header) return null

  const token = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1)

  return readSessionToken(token && decodeURIComponent(token), now)
}

export function setSessionCookie(response: NextResponse, username: string): NextResponse {
  response.cookies.set(COOKIE, createSessionToken(username), {
    httpOnly: true,
    sameSite: "lax",
    // En développement le site est servi en clair : un cookie `secure` ne
    // serait jamais renvoyé par le navigateur.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
  return response
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  return response
}
