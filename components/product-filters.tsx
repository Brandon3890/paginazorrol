"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useCategoryStore } from "@/lib/category-store"
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
  durationMin: number
  tags: string[]
  inStock: boolean
  stock: number
}

// Tipo para ordenamiento
export type SortOption = 'default' | 'price-asc' | 'price-desc'

interface Filters {
  priceRange: number[]
  categories: string[]
  subcategories: string[]
  ageRange: number[]
  playersRange: number[]
  durationRange: number[]
  inStock: boolean
  tags: string[]
  sortBy: SortOption
}

interface ProductFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  products: Product[]
}

export function ProductFilters({ filters, onFiltersChange, products }: ProductFiltersProps) {
  const { categories: dbCategories, fetchCategories } = useCategoryStore()

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

  // Calcular valores mínimos y máximos reales
  const minPrice = products.length > 0 ? Math.min(...products.map((p) => p.price)) : 0
  const maxPrice = products.length > 0 ? Math.max(...products.map((p) => p.price)) : 100
  
  const minAge = products.length > 0 ? Math.min(...products.map((p) => p.ageMin)) : 0
  const maxAge = products.length > 0 ? Math.max(...products.map((p) => p.ageMin)) : 18
  
  const minPlayers = products.length > 0 ? Math.min(...products.map((p) => p.playersMin)) : 1
  const maxPlayers = products.length > 0 ? Math.max(...products.map((p) => p.playersMax)) : 8

  const minDuration = products.length > 0 ? Math.min(...products.map((p) => p.durationMin || 0)) : 0
  const maxDuration = products.length > 0 ? Math.max(...products.map((p) => p.durationMin || 0)) : 120

  // Calcular productos con stock disponible
  const productsWithStock = products.filter(p => p.stock > 0).length

  // Estado local para los filtros
  const [pendingFilters, setPendingFilters] = useState<Filters>(() => ({
    priceRange: filters.priceRange || [minPrice, maxPrice],
    categories: filters.categories || [],
    subcategories: filters.subcategories || [],
    ageRange: filters.ageRange || [minAge, maxAge],
    playersRange: filters.playersRange || [minPlayers, maxPlayers],
    durationRange: filters.durationRange || [minDuration, maxDuration],
    inStock: filters.inStock || false,
    tags: filters.tags || [],
    sortBy: filters.sortBy || 'default',
  }))

  // Sincronizar con los filtros externos
  useEffect(() => {
    const hasExternalFilters = 
      (filters.categories || []).length > 0 ||
      (filters.subcategories || []).length > 0 ||
      (filters.tags || []).length > 0 ||
      (filters.priceRange && filters.priceRange[0] > minPrice) ||
      (filters.priceRange && filters.priceRange[1] < maxPrice) ||
      (filters.ageRange && filters.ageRange[0] > minAge) ||
      (filters.ageRange && filters.ageRange[1] < maxAge) ||
      (filters.playersRange && filters.playersRange[0] > minPlayers) ||
      (filters.playersRange && filters.playersRange[1] < maxPlayers) ||
      (filters.durationRange && filters.durationRange[0] > minDuration) ||
      (filters.durationRange && filters.durationRange[1] < maxDuration) ||
      filters.inStock ||
      filters.sortBy !== 'default'

    if (hasExternalFilters) {
      setPendingFilters({
        priceRange: filters.priceRange || [minPrice, maxPrice],
        categories: filters.categories || [],
        subcategories: filters.subcategories || [],
        ageRange: filters.ageRange || [minAge, maxAge],
        playersRange: filters.playersRange || [minPlayers, maxPlayers],
        durationRange: filters.durationRange || [minDuration, maxDuration],
        inStock: filters.inStock || false,
        tags: filters.tags || [],
        sortBy: filters.sortBy || 'default',
      })
    }
  }, [filters, minPrice, maxPrice, minAge, maxAge, minPlayers, maxPlayers, minDuration, maxDuration])

  // Función para aplicar filtros
  const applyFilters = useCallback((newFilters: Filters) => {
    onFiltersChange(newFilters)
  }, [onFiltersChange])

  const updatePendingFilters = (key: keyof Filters, value: any) => {
    const newFilters = { ...pendingFilters, [key]: value }
    setPendingFilters(newFilters)
    applyFilters(newFilters)
  }

  // 👈 NUEVA FUNCIÓN: Seleccionar ordenamiento directamente
  const selectSort = (sort: SortOption) => {
    updatePendingFilters("sortBy", sort)
  }

  const toggleArrayFilter = (key: "categories" | "subcategories" | "tags", value: string) => {
    const currentArray = pendingFilters[key] || []
    const newArray = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value]
    updatePendingFilters(key, newArray)
  }

  // Función para manejar subcategorías
  const toggleSubcategoryFilter = (subcategoryName: string) => {
    const currentSubcategories = pendingFilters.subcategories || []
    const newSubcategories = currentSubcategories.includes(subcategoryName)
      ? currentSubcategories.filter((item) => item !== subcategoryName)
      : [...currentSubcategories, subcategoryName]
    updatePendingFilters("subcategories", newSubcategories)
  }

  // Función para manejar tags
  const toggleTagFilter = (tag: string) => {
    const currentTags = pendingFilters.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((item) => item !== tag)
      : [...currentTags, tag]
    updatePendingFilters("tags", newTags)
  }

  // Obtener el texto del ordenamiento
  const getSortLabel = (sort: SortOption): string => {
    switch (sort) {
      case 'default': return 'Por defecto'
      case 'price-asc': return 'Menor a mayor precio'
      case 'price-desc': return 'Mayor a menor precio'
      default: return 'Por defecto'
    }
  }

  const clearAllFilters = () => {
    const clearedFilters = {
      priceRange: [minPrice, maxPrice],
      categories: [],
      subcategories: [],
      ageRange: [minAge, maxAge],
      playersRange: [minPlayers, maxPlayers],
      durationRange: [minDuration, maxDuration],
      inStock: false,
      tags: [],
      sortBy: 'default' as SortOption,
    }
    setPendingFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const hasActiveFilters =
    (pendingFilters.categories || []).length > 0 ||
    (pendingFilters.subcategories || []).length > 0 ||
    (pendingFilters.tags || []).length > 0 ||
    pendingFilters.priceRange[0] > minPrice ||
    pendingFilters.priceRange[1] < maxPrice ||
    pendingFilters.ageRange[0] > minAge ||
    pendingFilters.ageRange[1] < maxAge ||
    pendingFilters.playersRange[0] > minPlayers ||
    pendingFilters.playersRange[1] < maxPlayers ||
    pendingFilters.durationRange[0] > minDuration ||
    pendingFilters.durationRange[1] < maxDuration ||
    pendingFilters.inStock ||
    pendingFilters.sortBy !== 'default'

  // Función para formatear duración
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (mins === 0) {
      return `${hours}h`
    }
    return `${hours}h ${mins}min`
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
    >
      <Card className="overflow-hidden">
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
            </AnimatePresence>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 👈 ORDENAMIENTO POR PRECIO - BOTONES SEPARADOS */}
          <motion.div 
            className="space-y-1.5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Label className="text-xs font-medium">Ordenar por precio</Label>
            <div className="space-y-1">
              <Button
                variant={pendingFilters.sortBy === 'default' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectSort('default')}
                className={`w-full h-7 text-xs transition-all duration-200 ${
                  pendingFilters.sortBy === 'default' 
                    ? 'bg-[#C2410C] hover:bg-[#9A3412]' 
                    : ''
                }`}
              >
                <ArrowUpDown className="w-3 h-3 mr-1.5" />
                Por defecto
              </Button>
              <Button
                variant={pendingFilters.sortBy === 'price-asc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectSort('price-asc')}
                className={`w-full h-7 text-xs transition-all duration-200 ${
                  pendingFilters.sortBy === 'price-asc' 
                    ? 'bg-[#C2410C] hover:bg-[#9A3412]' 
                    : ''
                }`}
              >
                <ArrowDown className="w-3 h-3 mr-1.5" />
                Menor precio
              </Button>
              <Button
                variant={pendingFilters.sortBy === 'price-desc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => selectSort('price-desc')}
                className={`w-full h-7 text-xs transition-all duration-200 ${
                  pendingFilters.sortBy === 'price-desc' 
                    ? 'bg-[#C2410C] hover:bg-[#9A3412]' 
                    : ''
                }`}
              >
                <ArrowUp className="w-3 h-3 mr-1.5" />
                Mayor precio
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Seleccionado: {getSortLabel(pendingFilters.sortBy)}
            </p>
          </motion.div>

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
                min={minPrice}
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
                {(pendingFilters.subcategories || []).length > 0 && (
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
                min={minAge}
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
                min={minPlayers}
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

          {/* Duration Range */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <Label className="text-sm font-medium">Duración</Label>
            <div className="px-2">
              <Slider
                value={pendingFilters.durationRange}
                onValueChange={(value) => updatePendingFilters("durationRange", value)}
                min={minDuration}
                max={maxDuration}
                step={5}
                className="w-full"
              />
            </div>
            <motion.div 
              className="flex justify-between text-sm text-muted-foreground"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.2 }}
            >
              <motion.span 
                key={`duration-min-${pendingFilters.durationRange[0]}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {formatDuration(pendingFilters.durationRange[0])}
              </motion.span>
              <motion.span 
                key={`duration-max-${pendingFilters.durationRange[1]}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {formatDuration(pendingFilters.durationRange[1])}
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
                  const productsInStock = products.filter(p => p.stock > 0).length;
                  
                  if (checked && productsInStock === 0) {
                    alert("No hay productos disponibles en stock en este momento.");
                    return;
                  }
                  
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
            
            <motion.p 
              className="text-xs text-muted-foreground ml-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {productsWithStock} productos con stock disponible
            </motion.p>

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