import type React from "react"
import type { Metadata } from "next"
import { GeistMono } from "geist/font/mono"
import { Toaster } from "@/components/ui/toaster"
import { Suspense } from "react"
import { Modern_Antiqua, Poppins } from "next/font/google"
import { BackToTop } from "@/components/back-to-top" 
import "./globals.css"

// Fuentes
const modernAntiqua = Modern_Antiqua({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-modern-antiqua",
  display: "swap",
})

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["200","300","400","500","600","700","800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Zorro Lúdico",
  description: "Tu tienda online de juegos de mesa",
  generator: "BurttyMex UwU",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${modernAntiqua.variable} ${poppins.variable}`}>
      <body className="font-poppins">
        <Suspense fallback={null}>
          {children}
          <Toaster />
           <BackToTop />
        </Suspense>
      </body>
    </html>
  )
}