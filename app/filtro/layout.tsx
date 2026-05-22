import { ReactNode } from "react"

interface FiltroLayoutProps {
  children: ReactNode
}

export default function FiltroLayout({ children }: FiltroLayoutProps) {
  return (
    <div className="filtro-layout">
      {children}
    </div>
  )
}