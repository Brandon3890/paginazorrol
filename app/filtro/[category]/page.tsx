import { Header } from "@/components/header"
import { CategoryBreadcrumb } from "@/components/category-breadcrumb"
import { ProductGrid } from "@/components/product-grid"
import { Footer } from "@/components/footer"
import { notFound } from "next/navigation"

export async function generateStaticParams() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/categories`)
    
    if (!response.ok) {
      return []
    }
    
    const categories = await response.json()
    
    return categories
      .filter((cat: any) => cat.is_active)
      .map((category: any) => ({
        category: category.slug,
      }))
  } catch (error) {
    console.error('Error generating static params for categories:', error)
    return []
  }
}

interface PageProps {
  params: Promise<{ category: string }>
}

export default async function CategoryPage({ params }: PageProps) {
  const resolvedParams = await params
  const categorySlug = resolvedParams.category

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  
  let categories = []
  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      next: { revalidate: 3600 },
      cache: 'no-store'
    })
    
    if (response.ok) {
      categories = await response.json()
    }
  } catch (error) {
    console.error('Error fetching categories:', error)
  }

  const category = categories.find((cat: any) => 
    cat.slug === categorySlug && cat.is_active
  )

  if (!category) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <CategoryBreadcrumb
          items={[
            { name: "Inicio", href: "/" },
            { name: category.name, href: `/filtro/${category.slug}` },
          ]}
        />
        <div className="mt-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">{category.name}</h1>
          <p className="text-muted-foreground mb-8">
            {category.description || `Explora nuestra selección de ${category.name.toLowerCase()}`}
          </p>
          <ProductGrid category={category.name} />
        </div>
      </main>
      <Footer />
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const resolvedParams = await params
  const categorySlug = resolvedParams.category

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''
  
  let categories = []
  try {
    const response = await fetch(`${baseUrl}/api/categories`)
    if (response.ok) {
      categories = await response.json()
    }
  } catch (error) {
    console.error('Error fetching categories for metadata:', error)
  }

  const category = categories.find((cat: any) => cat.slug === categorySlug && cat.is_active)

  if (!category) {
    return {
      title: 'Categoría No Encontrada',
    }
  }

  return {
    title: `${category.name} - Zorro Lúdico`,
    description: category.description || `Descubre nuestra selección de ${category.name.toLowerCase()}`,
  }
}