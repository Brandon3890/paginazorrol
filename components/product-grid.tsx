// components/product-grid.tsx
"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { ProductCard } from "@/components/product-card"
import { ProductFilters } from "@/components/product-filters"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { SlidersHorizontal, X, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { useProductStore } from "@/lib/product-store"
import { useToast } from "@/hooks/use-toast"

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
  tags: string[] // Ahora es array de strings
  description: string
  inStock: boolean
  isOnSale: boolean
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
  stock: number
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

// Configuración de paginación
const PRODUCTS_PER_PAGE = 15

// Función para obtener el tag principal como string (para ordenamiento)
const getPrimaryTag = (tags: string[]): string => {
  if (!tags || tags.length === 0) return '';
  return tags[0];
}

// Función para determinar el orden de los productos
const getProductPriority = (product: CompatibleProduct): number => {
  const tags = product.tags || [];
  
  // 1. PREVENTA (primero)
  if (tags.some(tag => tag === 'preventa')) return 1
  
  // 2. DESCUENTO (segundo)
  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  if (hasDiscount || tags.some(tag => tag === 'descuento')) return 2
  
  // 3. NOVEDAD (tercero)
  if (tags.some(tag => tag === 'novedad')) return 3
  
  // 4. SIN ETIQUETA (cuarto)
  if (product.inStock && product.stock > 0) return 4
  
  // 5. AGOTADO (último)
  return 5
}

export function ProductGrid({ category, subcategory, searchQuery, onSale }: ProductGridProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const { products, fetchProducts, globalSearchQuery } = useProductStore()
  const { toast } = useToast()

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [category, subcategory, searchQuery, globalSearchQuery, onSale])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await fetchProducts({ force: true })
      toast({
        title: "Productos actualizados",
        description: "Los productos se han actualizado correctamente",
        duration: 2000,
      })
    } catch (error) {
      console.error('Error refreshing products:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchProducts, toast])

  useEffect(() => {
    fetchProducts({ includeInactive: false, isAdmin: false });
  }, [fetchProducts])

  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 Refrescando productos automáticamente...')
      fetchProducts({ force: true })
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchProducts])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ Pestaña visible, refrescando productos...')
        fetchProducts({ force: true })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchProducts])

  useEffect(() => {
    const handlePaymentComplete = () => {
      console.log('💰 Evento payment-complete recibido, refrescando productos...')
      fetchProducts({ force: true })
    }
    const handleStockUpdate = () => {
      console.log('📦 Evento stock-update recibido, refrescando productos...')
      fetchProducts({ force: true })
    }
    window.addEventListener('payment-complete', handlePaymentComplete)
    window.addEventListener('stock-update', handleStockUpdate)
    return () => {
      window.removeEventListener('payment-complete', handlePaymentComplete)
      window.removeEventListener('stock-update', handleStockUpdate)
    }
  }, [fetchProducts])

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
      tags: product.tags || [], // Usar tags normalizados directamente
      description: product.description,
      inStock: product.stock > 0,
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
      stock: product.stock || 0,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    }))
  }, [products])

  const maxPrice = compatibleProducts.length > 0 ? Math.max(...compatibleProducts.map((p) => p.price)) : 100
  const maxAge = compatibleProducts.length > 0 ? Math.max(...compatibleProducts.map((p) => p.ageMin)) : 18
  const maxPlayers = compatibleProducts.length > 0 ? Math.max(...compatibleProducts.map((p) => p.playersMax)) : 8

  const [filters, setFilters] = useState({
    priceRange: [0, maxPrice],
    categories: [] as string[],
    subcategories: [] as string[],
    ageRange: [0, maxAge],
    playersRange: [1, maxPlayers],
    inStock: false,
    tags: [] as string[],
  })

  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      priceRange: [0, maxPrice],
      ageRange: [0, maxAge],
      playersRange: [1, maxPlayers]
    }))
  }, [maxPrice, maxAge, maxPlayers])

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

  // Filtrar y ordenar productos
  const filteredProducts = useMemo(() => {
    let filtered = compatibleProducts

    if (onSale) {
      filtered = filtered.filter((product) => product.isOnSale)
    }

    if (category) {
      filtered = filtered.filter((product) => product.category === category)
    }

    if (subcategory) {
      filtered = filtered.filter((product) => 
        product.subcategory === subcategory || 
        product.subcategories.some(sub => sub.name === subcategory)
      )
    }

    if (globalSearchQuery && globalSearchQuery.trim()) {
      const query = globalSearchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.tags.some((tag: string) => tag.toLowerCase().includes(query)),
      )
    }

    if (searchQuery && !globalSearchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query) ||
          product.tags.some((tag: string) => tag.toLowerCase().includes(query)),
      )
    }

    filtered = filtered.filter((product) => {
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) return false
      if (filters.categories.length > 0 && !filters.categories.includes(product.category)) return false
      if (filters.subcategories.length > 0) {
        const productSubcategoryNames = product.subcategories.map(sub => sub.name)
        const hasMatchingSubcategory = filters.subcategories.some(selectedSub => 
          productSubcategoryNames.includes(selectedSub) || product.subcategory === selectedSub
        )
        if (!hasMatchingSubcategory) return false
      }
      if (product.ageMin < filters.ageRange[0] || product.ageMin > filters.ageRange[1]) return false
      if (product.playersMax < filters.playersRange[0] || product.playersMin > filters.playersRange[1]) return false
      if (filters.inStock && product.stock <= 0) return false
      if (filters.tags.length > 0 && !filters.tags.some((tag) => product.tags.includes(tag))) return false
      return true
    })

    // ORDENAR PRODUCTOS según prioridad
    return filtered.sort((a, b) => getProductPriority(a) - getProductPriority(b))
  }, [category, subcategory, searchQuery, onSale, filters, compatibleProducts, globalSearchQuery])

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  )

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.subcategories.length > 0 ||
    filters.tags.length > 0 ||
    filters.priceRange[0] > 0 ||
    filters.priceRange[1] < maxPrice ||
    filters.ageRange[0] > 0 ||
    filters.ageRange[1] < maxAge ||
    filters.playersRange[0] > 1 ||
    filters.playersRange[1] < maxPlayers ||
    filters.inStock

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 
          className="text-2xl sm:text-3xl font-semibold"
          style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600 }}
        >
          PRODUCTOS
        </h2>
        
        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
          <p className="text-muted-foreground text-sm whitespace-nowrap">
            {filteredProducts.length} productos
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-9 h-9 transition-all duration-200 hover:scale-105"
              title="Actualizar productos"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>

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
          </div>
        </div>
      </div>

      {globalSearchQuery && globalSearchQuery.trim() && (
        <div className="flex justify-between items-center bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="text-sm text-orange-700">
            <strong>Buscando:</strong> "{globalSearchQuery}"
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => useProductStore.getState().setGlobalSearchQuery("")}
            className="text-orange-700 border-orange-300 hover:bg-orange-100"
          >
            <X className="w-4 h-4 mr-1" />
            Limpiar búsqueda
          </Button>
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-blue-50 p-4 rounded-lg border border-blue-200 gap-3">
          <div className="text-sm text-blue-700">
            <strong>Filtros activos:</strong>
            {filters.categories.length > 0 && ` Categorías (${filters.categories.length})`}
            {filters.subcategories.length > 0 && ` Subcategorías (${filters.subcategories.length})`}
            {filters.tags.length > 0 && ` Etiquetas (${filters.tags.length})`}
            {filters.inStock && ` Stock disponible`}
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

      <div className="flex flex-col lg:flex-row gap-6">
        {showFilters && (
          <div className="hidden lg:block w-80 flex-shrink-0">
            <div className="sticky top-4 bg-background border rounded-lg shadow-sm p-4 h-fit">
              <ProductFilters filters={filters} onFiltersChange={setFilters} products={compatibleProducts} />
            </div>
          </div>
        )}

        <div className={`flex-1 min-w-0 transition-all duration-300 ${
          showFilters ? 'lg:max-w-[calc(100%-320px)]' : 'w-full'
        }`}>
          {paginatedProducts.length === 0 ? (
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
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6 auto-rows-fr">
                {paginatedProducts.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-10">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-10 h-10 ${currentPage === pageNum ? 'bg-[#C2410C] hover:bg-[#9A3412]' : ''}`}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="w-10 h-10"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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