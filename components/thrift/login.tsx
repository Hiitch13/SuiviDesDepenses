"use client"

import { type FormEvent, useState } from "react"
import { Wordmark } from "./ui"

export function Login({
  onSubmit,
  busy,
}: {
  onSubmit: (username: string, password: string) => void
  busy: boolean
}) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit(username, password)
  }

  const field =
    "w-full rounded-xl border px-4 py-3.5 text-base outline-none transition-colors placeholder:text-[var(--t-sage)] focus:border-[var(--t-brass)]"
  const fieldStyle = {
    backgroundColor: "var(--t-moss)",
    borderColor: "var(--t-line)",
    color: "var(--t-paper)",
  }

  return (
    <main className="flex min-h-[100svh] flex-col" style={{ backgroundColor: "var(--t-ink)" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <Wordmark className="text-[2.75rem]" />
        <p className="mt-3 text-lg leading-snug" style={{ color: "var(--t-mist)" }}>
          Combien il te reste ce mois-ci, et où part le reste.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-3">
          <div>
            <label htmlFor="pseudo" className="mb-1.5 block text-sm" style={{ color: "var(--t-sage)" }}>
              Pseudo
            </label>
            <input
              id="pseudo"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              className={field}
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="mdp" className="mb-1.5 block text-sm" style={{ color: "var(--t-sage)" }}>
              Mot de passe
            </label>
            <input
              id="mdp"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className={field}
              style={fieldStyle}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="!mt-6 w-full rounded-xl py-3.5 text-base font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--t-brass)", color: "var(--t-ink)" }}
          >
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </form>

        {/* L'API crée le compte à la première connexion : autant le dire. */}
        <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--t-sage)" }}>
          Pas encore de compte ? Choisis un pseudo et un mot de passe : il sera créé à la première connexion.
        </p>
      </div>

      {/* Le niveau qui monte, repris de l'écran principal. */}
      <div aria-hidden className="h-24 shrink-0 sm:h-28" style={{ backgroundColor: "var(--t-brass)" }} />
    </main>
  )
}
