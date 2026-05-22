import { Header } from "@/components/header"
import { CategoryBreadcrumb } from "@/components/category-breadcrumb"
import { ProductGrid } from "@/components/product-grid"
import { Footer } from "@/components/footer"
import { notFound } from "next/navigation"
import { Suspense } from "react"

// Forzar renderizado dinámico para evitar problemas de build
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ category: string }>
}

// Función para obtener la URL base
function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}

export default async function CategoryPage({ params }: PageProps) {
  const resolvedParams = await params
  const categorySlug = decodeURIComponent(resolvedParams.category) // Decodificar URL

  console.log(`🔍 Buscando categoría con slug: ${categorySlug}`)

  const baseUrl = getBaseUrl()
  
  let categories = []
  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    if (!response.ok) {
      console.error(`❌ Error fetching categories: ${response.status}`)
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    categories = await response.json()
    console.log(`✅ Categorías cargadas: ${categories.length}`)
    console.log(`📋 Slugs disponibles: ${categories.map((c: any) => c.slug).join(', ')}`)
    
  } catch (error) {
    console.error('❌ Error fetching categories:', error)
    notFound()
  }

  // Buscar categoría por slug (case-sensitive)
  const category = categories.find((cat: any) => 
    cat.slug === categorySlug && cat.is_active === true
  )

  if (!category) {
    console.log(`❌ Categoría no encontrada para slug: ${categorySlug}`)
    notFound()
  }

  console.log(`✅ Categoría encontrada: ${category.name} (ID: ${category.id})`)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <CategoryBreadcrumb
          items={[
            { name: "Inicio", href: "/" },
            { name: "Todos los Productos", href: "/filtro" },
            { name: category.name, href: `/filtro/${category.slug}` },
          ]}
        />
        <div className="mt-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">{category.name}</h1>
          <p className="text-muted-foreground mb-8">
            {category.description || `Explora nuestra selección de ${category.name.toLowerCase()}`}
          </p>
          <Suspense fallback={
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
          }>
            <ProductGrid category={category.name} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

// Metadata dinámica
export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = await params
  const categorySlug = decodeURIComponent(resolvedParams.category)
  const baseUrl = getBaseUrl()

  try {
    const response = await fetch(`${baseUrl}/api/categories`, { 
      cache: 'no-store' 
    })
    
    if (response.ok) {
      const categories = await response.json()
      const category = categories.find((cat: any) => cat.slug === categorySlug && cat.is_active)
      
      if (category) {
        return {
          title: `${category.name} - Zorro Lúdico`,
          description: category.description || `Descubre nuestra selección de ${category.name.toLowerCase()}`,
          openGraph: {
            title: `${category.name} - Zorro Lúdico`,
            description: category.description || `Descubre nuestra selección de ${category.name.toLowerCase()}`,
            type: 'website',
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching categories for metadata:', error)
  }

  return {
    title: 'Categoría - Zorro Lúdico',
    description: 'Explora nuestros productos por categoría',
  }
}