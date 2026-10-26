import type React from "react"
import type { Metadata, Viewport } from "next"
import "@/app/globals.css"
import { Archivo } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"

// Une seule famille pour toute l'app. L'axe de largeur remplace une seconde
// fonte : titres resserrés, chiffre héros légèrement élargi.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
})

export const metadata: Metadata = {
  title: "thrift",
  description: "Ce qu'il te reste à vivre ce mois-ci, et où part le reste.",
  applicationName: "thrift",
}

export const viewport: Viewport = {
  themeColor: "#071A17",
  // L'app se cale sur la hauteur réelle du téléphone, encoche comprise.
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className={archivo.variable} suppressHydrationWarning>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
