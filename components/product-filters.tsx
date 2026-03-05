 "use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useCategoryStore } from "@/lib/category-store"
import { useIsMobile } from "@/hooks/use-mobile"

// Define el tipo compatible para Product
interface Product {
  id: number
  name: string
  price: number
  category: string
  subcategory: string
  ageMin: number
  playersMin: number
  playersMax: number
  tags: string[]
  inStock: boolean
}

interface Filters {
  priceRange: number[]
  categories: string[]
  subcategories: string[]
  ageRange: number[]
  playersRange: number[]
  inStock: boolean
  tags: string[]
}

interface ProductFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  products: Product[]
}

export function ProductFilters({ filters, onFiltersChange, products }: ProductFiltersProps) {
  const { categories: dbCategories, fetchCategories } = useCategoryStore()
  const isMobile = useIsMobile()

  // Cargar categorías de la base de datos
  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Extraer categorías activas de la base de datos
  const activeCategories = dbCategories.filter(cat => cat.is_active)
  
  // Extraer todas las subcategorías activas con información de su categoría
  const allActiveSubcategories = activeCategories.flatMap(category => 
    category.subcategories
      .filter(sub => sub.is_active)
      .map(sub => ({
        ...sub,
        categoryName: category.name,
        categoryId: category.id
      }))
  )

  // Combinar tags de productos + subcategorías para la sección de etiquetas
  const productTags = Array.from(new Set(products.flatMap((p) => p.tags)))

  const maxPrice = products.length > 0 ? Math.max(...products.map((p) => p.price)) : 100
  const maxAge = products.length > 0 ? Math.max(...products.map((p) => p.ageMin)) : 18
  const maxPlayers = products.length > 0 ? Math.max(...products.map((p) => p.playersMax)) : 8

  // Inicializar con filtros vacíos
  const [pendingFilters, setPendingFilters] = useState<Filters>(() => ({
    priceRange: [0, maxPrice],
    categories: [],
    subcategories: [],
    ageRange: [0, maxAge],
    playersRange: [1, maxPlayers],
    inStock: false,
    tags: [],
  }))

  // Solo sincronizar cuando los filtros externos cambien explícitamente
  useEffect(() => {
    // Solo actualizar si los filtros externos tienen valores diferentes a los iniciales
    const hasExternalFilters = 
      filters.categories.length > 0 ||
      filters.subcategories.length > 0 ||
      filters.tags.length > 0 ||
      filters.priceRange[0] > 0 ||
      filters.priceRange[1] < maxPrice ||
      filters.ageRange[0] > 0 ||
      filters.ageRange[1] < maxAge ||
      filters.playersRange[0] > 1 ||
      filters.playersRange[1] < maxPlayers ||
      filters.inStock;

    if (hasExternalFilters) {
      setPendingFilters({
        priceRange: filters.priceRange.length > 0 ? filters.priceRange : [0, maxPrice],
        categories: filters.categories || [],
        subcategories: filters.subcategories || [],
        ageRange: filters.ageRange.length > 0 ? filters.ageRange : [0, maxAge],
        playersRange: filters.playersRange.length > 0 ? filters.playersRange : [1, maxPlayers],
        inStock: filters.inStock || false,
        tags: filters.tags || [],
      })
    }
  }, [filters, maxPrice, maxAge, maxPlayers])

  // Función para aplicar filtros solo cuando el usuario interactúa
  const applyFilters = useCallback((newFilters: Filters) => {
    onFiltersChange(newFilters)
  }, [onFiltersChange])

  const updatePendingFilters = (key: keyof Filters, value: any) => {
    const newFilters = { ...pendingFilters, [key]: value }
    setPendingFilters(newFilters)
    applyFilters(newFilters)
  }

  const toggleArrayFilter = (key: "categories" | "subcategories" | "tags", value: string) => {
    const currentArray = pendingFilters[key]
    const newArray = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value]
    updatePendingFilters(key, newArray)
  }

  // Función para manejar subcategorías
  const toggleSubcategoryFilter = (subcategoryName: string) => {
    const currentSubcategories = pendingFilters.subcategories
    const newSubcategories = currentSubcategories.includes(subcategoryName)
      ? currentSubcategories.filter((item) => item !== subcategoryName)
      : [...currentSubcategories, subcategoryName]
    updatePendingFilters("subcategories", newSubcategories)
  }

  // Función para manejar tags
  const toggleTagFilter = (tag: string) => {
    const currentTags = pendingFilters.tags
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((item) => item !== tag)
      : [...currentTags, tag]
    updatePendingFilters("tags", newTags)
  }

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
    setPendingFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const hasActiveFilters =
    pendingFilters.categories.length > 0 ||
    pendingFilters.subcategories.length > 0 ||
    pendingFilters.tags.length > 0 ||
    pendingFilters.priceRange[0] > 0 ||
    pendingFilters.priceRange[1] < maxPrice ||
    pendingFilters.ageRange[0] > 0 ||
    pendingFilters.ageRange[1] < maxAge ||
    pendingFilters.playersRange[0] > 1 ||
    pendingFilters.playersRange[1] < maxPlayers

  return (
    <Card className="sticky top-4">
      
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Filtros</CardTitle>
          {/* 
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Limpiar
            </Button>
          )}*/}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Price Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Rango de Precio (CLP)</Label>
          <div className="px-2">
            <Slider
              value={pendingFilters.priceRange}
              onValueChange={(value) => updatePendingFilters("priceRange", value)}
              max={maxPrice}
              step={1}
              className="w-full"
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>${pendingFilters.priceRange[0].toLocaleString('es-CL')}</span>
            <span>${pendingFilters.priceRange[1].toLocaleString('es-CL')}</span>
          </div>
        </div>

        {/* Categories - Con checkboxes */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Categorías</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {activeCategories.map((category) => (
              <div key={category.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`category-${category.id}`}
                  checked={pendingFilters.categories.includes(category.name)}
                  onCheckedChange={() => toggleArrayFilter("categories", category.name)}
                />
                <Label htmlFor={`category-${category.id}`} className="text-sm">
                  {category.name}
                </Label>
              </div>
            ))}
            {activeCategories.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay categorías disponibles</p>
            )}
          </div>
        </div>

        {/* Subcategorías - Como etiquetas clickeables */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Etiquetas y Subcategorías</Label>
            {pendingFilters.subcategories.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {pendingFilters.subcategories.length} seleccionadas
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 max">
            {allActiveSubcategories.map((subcategory) => (
              <Badge
                key={subcategory.id}
                variant={pendingFilters.subcategories.includes(subcategory.name) ? "default" : "secondary"}
                className={`
                  cursor-pointer hover:bg-primary/80
                  ${pendingFilters.subcategories.includes(subcategory.name) 
                    ? 'bg-[#C2410C] text-white hover:bg-[#9A3412]' 
                    : 'bg-[#FEF3F2] text-[#991B1B] border border-[#FEE2E2] hover:bg-[#FEE2E2]'
                  }
                `}
                onClick={() => toggleSubcategoryFilter(subcategory.name)}
              >
                {subcategory.name}
                {pendingFilters.subcategories.includes(subcategory.name) && (
                  <X className="w-3 h-3 ml-1" />
                )}
              </Badge>
            ))}
            {allActiveSubcategories.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay subcategorías disponibles</p>
            )}
          </div>
        </div>

        {/* Age Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Edad Mínima</Label>
          <div className="px-2">
            <Slider
              value={pendingFilters.ageRange}
              onValueChange={(value) => updatePendingFilters("ageRange", value)}
              max={maxAge}
              step={1}
              className="w-full"
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{pendingFilters.ageRange[0]}+ años</span>
            <span>{pendingFilters.ageRange[1]}+ años</span>
          </div>
        </div>

        {/* Players Range */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Número de Jugadores</Label>
          <div className="px-2">
            <Slider
              value={pendingFilters.playersRange}
              onValueChange={(value) => updatePendingFilters("playersRange", value)}
              min={1}
              max={maxPlayers}
              step={1}
              className="w-full"
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              {pendingFilters.playersRange[0]} jugador{pendingFilters.playersRange[0] > 1 ? "es" : ""}
            </span>
            <span>
              {pendingFilters.playersRange[1]} jugador{pendingFilters.playersRange[1] > 1 ? "es" : ""}
            </span>
          </div>
        </div>

        {/* Stock Filter */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="inStock"
              checked={pendingFilters.inStock}
              onCheckedChange={(checked) => updatePendingFilters("inStock", checked)}
            />
            <Label htmlFor="inStock" className="text-sm font-medium">
              Solo productos en stock
            </Label>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
