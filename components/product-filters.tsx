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
import { motion, AnimatePresence } from "framer-motion"

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
  stock: number
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

  // Calcular productos con stock disponible
  const productsWithStock = products.filter(p => p.stock > 0).length

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

  // Función para aplicar filtros
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
    pendingFilters.playersRange[1] < maxPlayers ||
    pendingFilters.inStock

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
    >
      <Card className="sticky top-4 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <CardTitle className="text-lg">Filtros</CardTitle>
            </motion.div>
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllFilters}
                    className="text-xs text-muted-foreground hover:text-foreground relative overflow-hidden group"
                  >
                    <motion.div
                      whileHover={{ rotate: 90 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X className="w-3 h-3 mr-1" />
                    </motion.div>
                    Limpiar
                    <motion.div
                      className="absolute inset-0 bg-primary/10"
                      initial={{ scale: 0, opacity: 0 }}
                      whileHover={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Price Range */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Label className="text-sm font-medium">Rango de Precio (CLP)</Label>
<div className="px-2">
  <Slider
    value={pendingFilters.priceRange}
    onValueChange={(value) => updatePendingFilters("priceRange", value)}
    min={0}
    max={maxPrice}
    step={1}
    className="w-full"
  />
</div>
            <motion.div 
              className="flex justify-between text-sm text-muted-foreground"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.2 }}
            >
              <motion.span 
                key={`price-min-${pendingFilters.priceRange[0]}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                ${pendingFilters.priceRange[0].toLocaleString('es-CL')}
              </motion.span>
              <motion.span 
                key={`price-max-${pendingFilters.priceRange[1]}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                ${pendingFilters.priceRange[1].toLocaleString('es-CL')}
              </motion.span>
            </motion.div>
          </motion.div>

          {/* Categories - Con checkboxes */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Label className="text-sm font-medium">Categorías</Label>
            <motion.div 
              className="space-y-2 max-h-40 overflow-y-auto pr-2"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.05 }
                }
              }}
              initial="hidden"
              animate="visible"
            >
              {activeCategories.map((category) => (
                <motion.div
                  key={category.id}
                  variants={{
                    hidden: { opacity: 0, x: -10 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  whileHover={{ x: 5 }}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={`category-${category.id}`}
                    checked={pendingFilters.categories.includes(category.name)}
                    onCheckedChange={() => toggleArrayFilter("categories", category.name)}
                  />
                  <Label htmlFor={`category-${category.id}`} className="text-sm cursor-pointer">
                    {category.name}
                  </Label>
                  <AnimatePresence>
                    {pendingFilters.categories.includes(category.name) && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="w-1 h-1 rounded-full bg-[#C2410C]"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
              {activeCategories.length === 0 && (
                <motion.p 
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  No hay categorías disponibles
                </motion.p>
              )}
            </motion.div>
          </motion.div>

          {/* Subcategorías - Como etiquetas clickeables */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Etiquetas y Subcategorías</Label>
              <AnimatePresence>
                {pendingFilters.subcategories.length > 0 && (
                  <motion.span 
                    className="text-xs text-muted-foreground"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    {pendingFilters.subcategories.length} seleccionadas
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <motion.div 
              className="flex flex-wrap gap-2"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.03 }
                }
              }}
              initial="hidden"
              animate="visible"
            >
              {allActiveSubcategories.map((subcategory) => (
                <motion.div
                  key={subcategory.id}
                  variants={{
                    hidden: { opacity: 0, scale: 0.8 },
                    visible: { opacity: 1, scale: 1 }
                  }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Badge
                    variant={pendingFilters.subcategories.includes(subcategory.name) ? "default" : "secondary"}
                    className={`
                      cursor-pointer transition-all duration-200
                      ${pendingFilters.subcategories.includes(subcategory.name) 
                        ? 'bg-[#C2410C] text-white hover:bg-[#9A3412]' 
                        : 'bg-[#FEF3F2] text-[#991B1B] border border-[#FEE2E2] hover:bg-[#FEE2E2]'
                      }
                    `}
                    onClick={() => toggleSubcategoryFilter(subcategory.name)}
                  >
                    {subcategory.name}
                    <AnimatePresence>
                      {pendingFilters.subcategories.includes(subcategory.name) && (
                        <motion.div
                          initial={{ rotate: -90, opacity: 0 }}
                          animate={{ rotate: 0, opacity: 1 }}
                          exit={{ rotate: 90, opacity: 0 }}
                          className="inline-flex ml-1"
                        >
                          <X className="w-3 h-3" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Badge>
                </motion.div>
              ))}
              {allActiveSubcategories.length === 0 && (
                <motion.p 
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  No hay subcategorías disponibles
                </motion.p>
              )}
            </motion.div>
          </motion.div>

          {/* Age Range */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Label className="text-sm font-medium">Edad Mínima</Label>
<div className="px-2">
  <Slider
    value={pendingFilters.ageRange}
    onValueChange={(value) => updatePendingFilters("ageRange", value)}
    min={0}
    max={maxAge}
    step={1}
    className="w-full"
  />
</div>
            <motion.div 
              className="flex justify-between text-sm text-muted-foreground"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.2 }}
            >
              <motion.span 
                key={`age-min-${pendingFilters.ageRange[0]}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {pendingFilters.ageRange[0]}+ años
              </motion.span>
              <motion.span 
                key={`age-max-${pendingFilters.ageRange[1]}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {pendingFilters.ageRange[1]}+ años
              </motion.span>
            </motion.div>
          </motion.div>

          {/* Players Range */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
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
            <motion.div 
              className="flex justify-between text-sm text-muted-foreground"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.2 }}
            >
              <motion.span 
                key={`players-min-${pendingFilters.playersRange[0]}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {pendingFilters.playersRange[0]} jugador{pendingFilters.playersRange[0] > 1 ? "es" : ""}
              </motion.span>
              <motion.span 
                key={`players-max-${pendingFilters.playersRange[1]}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {pendingFilters.playersRange[1]} jugador{pendingFilters.playersRange[1] > 1 ? "es" : ""}
              </motion.span>
            </motion.div>
          </motion.div>

          {/* Stock Filter */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <motion.div 
              className="flex items-center space-x-2"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Checkbox
                id="inStock"
                checked={pendingFilters.inStock}
                onCheckedChange={(checked) => {
                  // Verificar si hay productos con stock > 0
                  const productsInStock = products.filter(p => p.stock > 0).length;
                  
                  if (checked && productsInStock === 0) {
                    alert("No hay productos disponibles en stock en este momento.");
                    return; // No aplicar el filtro si no hay productos en stock
                  }
                  
                  // Si el filtro se está desactivando o hay productos en stock, actualizar
                  updatePendingFilters("inStock", checked);
                }}
              />
              <Label htmlFor="inStock" className="text-sm font-medium cursor-pointer">
                Solo productos en stock
              </Label>
              <AnimatePresence>
                {pendingFilters.inStock && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="w-2 h-2 rounded-full bg-green-500"
                  />
                )}
              </AnimatePresence>
            </motion.div>
            
            {/* Mostrar cuántos productos tienen stock disponible */}
            <motion.p 
              className="text-xs text-muted-foreground ml-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {productsWithStock} productos con stock disponible
            </motion.p>

            {/* Mensaje de advertencia si no hay stock */}
            {productsWithStock === 0 && (
              <motion.p 
                className="text-xs text-amber-600 ml-6"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                ⚠️ No hay productos con stock disponible
              </motion.p>
            )}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}