import { Header } from "@/components/header"
import { CategoryNav } from "@/components/category-nav"
import { ProductGrid } from "@/components/product-grid"
import { CategoryBreadcrumb } from "@/components/category-breadcrumb"
import { Footer } from "@/components/footer"

interface SearchPageProps {
  searchParams: { q?: string }
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q || ""

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <CategoryBreadcrumb
          items={[
            { name: "Inicio", href: "/" },
            { name: `Búsqueda: "${query}"`, href: `/search?q=${query}` },
          ]}
        />
        <div className="mt-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Resultados para "{query}"</h1>
          <ProductGrid searchQuery={query} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
