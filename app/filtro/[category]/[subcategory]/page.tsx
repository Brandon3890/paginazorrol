import { Header } from "@/components/header"
import { CategoryBreadcrumb } from "@/components/category-breadcrumb"
import { ProductGrid } from "@/components/product-grid"
import { Footer } from "@/components/footer"
import { notFound } from "next/navigation"

// Esta función se ejecuta en el servidor para generar las páginas estáticas
export async function generateStaticParams() {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/categories`)
    
    if (!response.ok) {
      return []
    }
    
    const categories = await response.json()
    
    const params = categories
      .filter((cat: any) => cat.is_active)
      .flatMap((category: any) =>
        category.subcategories
          .filter((sub: any) => sub.is_active)
          .map((subcategory: any) => ({
            category: category.slug,
            subcategory: subcategory.slug,
          }))
      )
    
    return params
  } catch (error) {
    console.error('Error generating static params for subcategories:', error)
    return []
  }
}

interface PageProps {
  params: Promise<{ category: string; subcategory: string }>
}

export default async function SubcategoryPage({ params }: PageProps) {
  const resolvedParams = await params
  const { category: categorySlug, subcategory: subcategorySlug } = resolvedParams

  // Obtener categorías del API
  let categories = []
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/categories`, {
      next: { revalidate: 3600 } // Revalidar cada hora
    })
    
    if (response.ok) {
      categories = await response.json()
    }
  } catch (error) {
    console.error('Error fetching categories:', error)
  }

  // Encontrar la categoría y subcategoría
  const category = categories.find((cat: any) => 
    cat.slug === categorySlug && cat.is_active
  )

  if (!category) {
    notFound()
  }

  const subcategory = category.subcategories.find((sub: any) => 
    sub.slug === subcategorySlug && sub.is_active
  )

  if (!subcategory) {
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
          <ProductGrid category={category.name} subcategory={subcategory.name} />
        </div>
      </main>
      <Footer />
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ category: string; subcategory: string }> }) {
  const resolvedParams = await params
  const { category: categorySlug, subcategory: subcategorySlug } = resolvedParams

  let categories = []
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/categories`)
    if (response.ok) {
      categories = await response.json()
    }
  } catch (error) {
    console.error('Error fetching categories for metadata:', error)
  }

  const category = categories.find((cat: any) => cat.slug === categorySlug && cat.is_active)
  const subcategory = category?.subcategories.find((sub: any) => sub.slug === subcategorySlug && sub.is_active)

  if (!category || !subcategory) {
    return {
      title: 'Subcategoría No Encontrada',
    }
  }

  return {
    title: `${subcategory.name} - ${category.name} - Nuestra Tienda`,
    description: subcategory.description || `Descubre nuestra selección de ${subcategory.name.toLowerCase()} en ${category.name.toLowerCase()}`,
  }
}