import { Header } from "@/components/header"
import { CategoryBreadcrumb } from "@/components/category-breadcrumb"
import { ProductGrid } from "@/components/product-grid"
import { Footer } from "@/components/footer"
import { Suspense } from "react"

// Forzar renderizado dinámico para producción
export const dynamic = 'force-dynamic'

export default function FiltroPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <CategoryBreadcrumb
          items={[
            { name: "Inicio", href: "/" },
            { name: "Todos los Productos", href: "/filtro" },
          ]}
        />
        <div className="mt-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Todos los Productos</h1>
          <p className="text-muted-foreground mb-8">
            Explora nuestra completa colección de productos
          </p>
          <Suspense fallback={<div>Cargando productos...</div>}>
            <ProductGrid />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}