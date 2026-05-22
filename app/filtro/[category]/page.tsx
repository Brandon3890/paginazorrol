import { Header } from "@/components/header"
import { CategoryBreadcrumb } from "@/components/category-breadcrumb"
import { ProductGrid } from "@/components/product-grid"
import { Footer } from "@/components/footer"
import { notFound } from "next/navigation"
import { Suspense } from "react"

// Forzar renderizado dinámico
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
  const categorySlug = decodeURIComponent(resolvedParams.category)

  console.log(`🔍 Buscando categoría con slug: ${categorySlug}`)

  const baseUrl = getBaseUrl()
  
  let categories = []
  try {
    // Intentar primero con fetch absoluto
    const response = await fetch(`${baseUrl}/api/categories`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    console.log(`📡 Response status: ${response.status}`)
    
    if (!response.ok) {
      console.error(`❌ Error fetching categories: ${response.status}`)
      
      // Si es 403 o 401, puede ser problema de autenticación
      if (response.status === 403 || response.status === 401) {
        console.log('⚠️ Error de autenticación, intentando con ruta relativa...')
        // Intentar con ruta relativa como fallback
        const fallbackResponse = await fetch('/api/categories', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          }
        })
        
        if (!fallbackResponse.ok) {
          throw new Error(`HTTP error! status: ${fallbackResponse.status}`)
        }
        
        categories = await fallbackResponse.json()
      } else {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    } else {
      categories = await response.json()
    }
    
    console.log(`✅ Categorías cargadas: ${categories.length}`)
    console.log(`📋 Slugs disponibles: ${categories.map((c: any) => c.slug).join(', ')}`)
    
  } catch (error) {
    console.error('❌ Error fetching categories:', error)
    // No llamar a notFound() aquí, intentar mostrar mensaje de error
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error al cargar categorías</h1>
            <p className="text-gray-600 mb-4">
              No se pudieron cargar las categorías. Por favor, intenta de nuevo más tarde.
            </p>
            <p className="text-sm text-gray-500">
              Error: {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Buscar categoría por slug
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