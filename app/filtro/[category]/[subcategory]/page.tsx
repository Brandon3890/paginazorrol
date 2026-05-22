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
  params: Promise<{ category: string; subcategory: string }>
}

function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}

export default async function SubcategoryPage({ params }: PageProps) {
  const resolvedParams = await params
  const categorySlug = decodeURIComponent(resolvedParams.category)
  const subcategorySlug = decodeURIComponent(resolvedParams.subcategory)

  console.log(`🔍 Buscando: Categoría=${categorySlug}, Subcategoría=${subcategorySlug}`)

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
    
  } catch (error) {
    console.error('❌ Error fetching categories:', error)
    notFound()
  }

  // Buscar categoría
  const category = categories.find((cat: any) => 
    cat.slug === categorySlug && cat.is_active === true
  )

  if (!category) {
    console.log(`❌ Categoría no encontrada: ${categorySlug}`)
    notFound()
  }

  // Buscar subcategoría
  const subcategory = category.subcategories?.find((sub: any) => 
    sub.slug === subcategorySlug && sub.is_active === true
  )

  if (!subcategory) {
    console.log(`❌ Subcategoría no encontrada: ${subcategorySlug} en categoría ${category.name}`)
    console.log(`📋 Subcategorías disponibles: ${category.subcategories?.map((s: any) => s.slug).join(', ') || 'ninguna'}`)
    notFound()
  }

  console.log(`✅ Subcategoría encontrada: ${subcategory.name} (ID: ${subcategory.id})`)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <CategoryBreadcrumb
          items={[
            { name: "Inicio", href: "/" },
            { name: "Todos los Productos", href: "/filtro" },
            { name: category.name, href: `/filtro/${category.slug}` },
            { name: subcategory.name, href: `/filtro/${category.slug}/${subcategory.slug}` },
          ]}
        />
        <div className="mt-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {category.name} - {subcategory.name}
          </h1>
          <p className="text-muted-foreground mb-8">
            {subcategory.description || `Explora nuestra selección de ${subcategory.name.toLowerCase()} en ${category.name.toLowerCase()}`}
          </p>
          <Suspense fallback={
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
          }>
            <ProductGrid category={category.name} subcategory={subcategory.name} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}

// Metadata dinámica para subcategoría
export async function generateMetadata({ params }: { params: Promise<{ category: string; subcategory: string }> }) {
  const resolvedParams = await params
  const categorySlug = decodeURIComponent(resolvedParams.category)
  const subcategorySlug = decodeURIComponent(resolvedParams.subcategory)
  const baseUrl = getBaseUrl()

  try {
    const response = await fetch(`${baseUrl}/api/categories`, { 
      cache: 'no-store' 
    })
    
    if (response.ok) {
      const categories = await response.json()
      const category = categories.find((cat: any) => cat.slug === categorySlug && cat.is_active)
      const subcategory = category?.subcategories?.find((sub: any) => sub.slug === subcategorySlug && sub.is_active)
      
      if (category && subcategory) {
        return {
          title: `${subcategory.name} - ${category.name} - Zorro Lúdico`,
          description: subcategory.description || `Descubre nuestra selección de ${subcategory.name.toLowerCase()}`,
          openGraph: {
            title: `${subcategory.name} - ${category.name} - Zorro Lúdico`,
            description: subcategory.description || `Descubre nuestra selección de ${subcategory.name.toLowerCase()}`,
            type: 'website',
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching categories for metadata:', error)
  }

  return {
    title: 'Subcategoría - Zorro Lúdico',
    description: 'Explora nuestros productos por subcategoría',
  }
}