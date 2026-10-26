import { NextResponse } from "next/server"

import { createUser, ensureSchema, getUser } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/password"
import { clearSessionCookie, sessionUser, setSessionCookie } from "@/lib/session"

function storageError(error: unknown) {
  console.error("[API auth]", error)
  return NextResponse.json(
    { error: "Le service de stockage ne répond pas. Réessaye dans quelques instants." },
    { status: 503 }
  )
}

/** Qui est connecté. Le client s'en sert au démarrage pour retrouver sa session. */
export async function GET(request: Request) {
  const username = sessionUser(request)
  if (!username) return NextResponse.json({ user: null }, { status: 200 })
  return NextResponse.json({ user: username })
}

/** Connexion, ou création du compte s'il n'existe pas encore. */
export async function POST(request: Request) {
  try {
    const { username, password } = (await request.json()) as { username?: string; password?: string }

    const name = (username ?? "").trim()
    const secret = (password ?? "").trim()
    if (!name || !secret) {
      return NextResponse.json({ error: "Pseudo et mot de passe requis" }, { status: 400 })
    }
    if (secret.length < 4) {
      return NextResponse.json({ error: "Le mot de passe fait au moins 4 caractères" }, { status: 400 })
    }

    await ensureSchema()
    const existing = await getUser(name)

    if (existing) {
      if (!verifyPassword(secret, existing.passwordHash)) {
        return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 })
      }
      return setSessionCookie(NextResponse.json({ user: name, created: false }), name)
    }

    await createUser(name, hashPassword(secret))
    return setSessionCookie(NextResponse.json({ user: name, created: true }), name)
  } catch (error) {
    return storageError(error)
  }
}

/** Déconnexion. */
export async function DELETE() {
  return clearSessionCookie(NextResponse.json({ ok: true }))
}
