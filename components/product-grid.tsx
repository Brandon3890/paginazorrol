// components/product-grid.tsx - VERSIÓN CORREGIDA Y MEJORADA
"use client"

import { useState, useMemo, useEffect } from "react"
import { ProductCard } from "@/components/product-card"
import { ProductFilters } from "@/components/product-filters"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SlidersHorizontal, Search, X } from "lucide-react"
import { useProductStore } from "@/lib/product-store"
import { Input } from "@/components/ui/input"

// Define un tipo local para Product que sea compatible con ProductCard
interface CompatibleProduct {
  id: number
  name: string
  price: number
  originalPrice?: number
  image: string
  additionalImages?: string[]
  category: string
  subcategory: string
  age: string
  players: string
  duration: string
  tags: string[]
  description: string
  inStock: boolean
  isOnSale: boolean
  // Propiedades adicionales para compatibilidad
  ageMin: number
  playersMin: number
  playersMax: number
  slug?: string
  categoryId: number
  subcategoryId: number
  subcategoryIds: string[]
  subcategories: Array<{
    id: number
    name: string
    slug: string
    isPrimary: boolean
    displayOrder: number
  }>
  durationMin?: number
  stock: number // ← CAMBIADO: ahora es obligatorio, no opcional
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

interface ProductGridProps {
  category?: string
  subcategory?: string
  searchQuery?: string
  onSale?: boolean
}

export function ProductGrid({ category, subcategory, searchQuery, onSale }: ProductGridProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery || "")
  const { products, fetchProducts } = useProductStore()

  // Cargar productos al montar el componente - SOLO ACTIVOS para usuarios normales
  useEffect(() => {
    fetchProducts({ includeInactive: false, isAdmin: false });
  }, [fetchProducts])

  // Convertir productos a tipo compatible con ProductCard y filtrar solo activos
  const compatibleProducts: CompatibleProduct[] = useMemo(() => {
    const activeProducts = products.filter(product => product.isActive)
    
    return activeProducts.map(product => ({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image,
      additionalImages: product.additionalImages || [],
      category: product.category,
      subcategory: product.subcategory,
      age: product.age || `${product.ageMin}+ años`,
      players: product.players || `${product.playersMin}-${product.playersMax} jugadores`,
      duration: product.duration || `${product.durationMin} min`,
      tags: Array.isArray(product.tags) 
        ? product.tags.map(tag => 
            typeof tag === 'string' ? tag : 
            typeof tag === 'object' && tag !== null ? tag.name || String(tag.id) : 
            String(tag)
          )
        : [],
      description: product.description,
      inStock: product.inStock,
      isOnSale: product.isOnSale,
      ageMin: product.ageMin,
      playersMin: product.playersMin,
      playersMax: product.playersMax,
      slug: product.slug,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId,
      subcategoryIds: product.subcategoryIds || [],
      subcategories: product.subcategories || [],
      durationMin: product.durationMin,
      stock: product.stock || 0, // ← CORREGIDO: asegurar que siempre sea número
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }))
  }, [products])

  // Calcular máximos basados en productos activos
  const maxPrice = compatibleProducts.length > 0 ? Math.max(...compatibleProducts.map((p) => p.price)) : 100
  const maxAge = compatibleProducts.length > 0 ? Math.max(...compatibleProducts.map((p) => p.ageMin)) : 18
  const maxPlayers = compatibleProducts.length > 0 ? Math.max(...compatibleProducts.map((p) => p.playersMax)) : 8

  // Inicializar filtros sin rangos activos
  const [filters, setFilters] = useState({
    priceRange: [0, maxPrice], // Rango completo por defecto
    categories: [] as string[],
    subcategories: [] as string[],
    ageRange: [0, maxAge], // Rango completo por defecto
    playersRange: [1, maxPlayers], // Rango completo por defecto
    inStock: false,
    tags: [] as string[],
  })

  // Actualizar filtros cuando cambien los máximos
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      priceRange: [0, maxPrice],
      ageRange: [0, maxAge],
      playersRange: [1, maxPlayers]
    }))
  }, [maxPrice, maxAge, maxPlayers])

  // Función para limpiar todos los filtros
  const clearAllFilters = () => {
    const clearedFilters = {
      priceRange: [0, maxPrice],
      categories: [],
      subcategories: [],
      ageRange: [0, maxAge],
      playersRange: [1, maxPlayers],
      inStock: false,
      tags: [],
    }
    setFilters(clearedFilters)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (localSearchQuery.trim()) {
    }
  }

  const filteredProducts = useMemo(() => {
    let filtered = compatibleProducts

    // Filtro por productos en oferta
    if (onSale) {
      filtered = filtered.filter((product) => product.isOnSale)
    }

    // Filtro por categoría desde props
    if (category) {
      filtered = filtered.filter((product) => product.category === category)
    }

    // Filtro por subcategoría desde props
    if (subcategory) {
      filtered = filtered.filter((product) => 
        product.subcategory === subcategory || 
        product.subcategories.some(sub => sub.name === subcategory)
      )
    }

    // Filtro por búsqueda local
    if (localSearchQuery) {
      const query = localSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.tags.some((tag: string) => tag.toLowerCase().includes(query)),
      )
    }

    // Filtro por búsqueda desde props
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.tags.some((tag: string) => tag.toLowerCase().includes(query)),
      )
    }

    // Aplicar filtros del usuario
    filtered = filtered.filter((product) => {
      // Filtro por precio
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) {
        return false
      }

      // Filtro por categorías (checkboxes)
      if (filters.categories.length > 0 && !filters.categories.includes(product.category)) {
        return false
      }

      // Filtro por subcategorías (badges)
      if (filters.subcategories.length > 0) {
        const productSubcategoryNames = product.subcategories.map(sub => sub.name)
        const hasMatchingSubcategory = filters.subcategories.some(selectedSub => 
          productSubcategoryNames.includes(selectedSub) || product.subcategory === selectedSub
        )
        if (!hasMatchingSubcategory) {
          return false
        }
      }

      // Filtro por edad
      if (product.ageMin < filters.ageRange[0] || product.ageMin > filters.ageRange[1]) {
        return false
      }

      // Filtro por jugadores
      if (product.playersMax < filters.playersRange[0] || product.playersMin > filters.playersRange[1]) {
        return false
      }

      // Filtro por stock
      if (filters.inStock && !product.inStock) {
        return false
      }

      // Filtro por tags
      if (filters.tags.length > 0 && !filters.tags.some((tag) => product.tags.includes(tag))) {
        return false
      }

      return true
    })


    return filtered
  }, [category, subcategory, searchQuery, onSale, filters, compatibleProducts, localSearchQuery])

  // Verificar si hay filtros activos (excluyendo los rangos completos)
  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.subcategories.length > 0 ||
    filters.tags.length > 0 ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < maxPrice ||
    filters.ageRange[0] > 0 ||
    filters.ageRange[1] < maxAge ||
    filters.playersRange[0] > 1 ||
    filters.playersRange[1] < maxPlayers

  return (
    <div className="space-y-6">
      {/* Header con título y controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
          {category ? category : "Todos los Productos"}
        </h2>
        
        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
          <p className="text-muted-foreground text-sm whitespace-nowrap">
            {filteredProducts.length} productos
          </p>
          
          {/* Controles de filtro y búsqueda */}
          <div className="flex items-center gap-2">
            {/* Botón de filtros */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="hidden md:flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileFiltersOpen(true)}
              className="flex md:hidden items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
            </Button>

            {/* Barra de búsqueda */}
            <div className="hidden md:flex items-center">
              {searchExpanded ? (
                <form onSubmit={handleSearch} className="flex items-center gap-2 transition-all duration-300 ease-in-out">
                  <Input
                    placeholder="Buscar productos..."
                    className="w-64 transition-all duration-300 ease-in-out"
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    autoFocus
                    onBlur={() => {
                      if (!localSearchQuery) setSearchExpanded(false)
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSearchExpanded(false)
                      setLocalSearchQuery("")
                    }}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </form>
              ) : (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSearchExpanded(true)}
                  className="w-9 h-9 transition-all duration-200 hover:scale-105"
                >
                  <Search className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mostrar botón para limpiar filtros si hay activos */}
      {hasActiveFilters && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-blue-50 p-4 rounded-lg border border-blue-200 gap-3">
          <div className="text-sm text-blue-700">
            <strong>Filtros activos:</strong>
            {filters.categories.length > 0 && ` Categorías (${filters.categories.length})`}
            {filters.subcategories.length > 0 && ` Subcategorías (${filters.subcategories.length})`}
            {filters.tags.length > 0 && ` Etiquetas (${filters.tags.length})`}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearAllFilters}
            className="text-blue-700 border-blue-300 hover:bg-blue-100 whitespace-nowrap"
          >
            <X className="w-4 h-4 mr-1" />
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* Layout principal con filtros y productos */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Panel de filtros para desktop */}
        {showFilters && (
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-4 bg-background border rounded-lg shadow-sm p-4 h-fit">
              <ProductFilters filters={filters} onFiltersChange={setFilters} products={compatibleProducts} />
            </div>
          </div>
        )}

        {/* Grid de productos - Se adapta al ancho disponible */}
        <div className={`flex-1 min-w-0 transition-all duration-300 ${
          showFilters ? 'lg:max-w-[calc(100%-320px)]' : 'w-full'
        }`}>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground mb-4">No se encontraron productos que coincidan con los filtros.</p>
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  className="mt-2"
                  onClick={clearAllFilters}
                >
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className={`
              grid gap-4 sm:gap-6
              ${showFilters 
                ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' 
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              }
              auto-rows-fr
            `}>
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sheet móvil para filtros */}
      <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
        <SheetContent side="left" className="w-80 sm:w-96 overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-xl">Filtros</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <ProductFilters filters={filters} onFiltersChange={setFilters} products={compatibleProducts} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}