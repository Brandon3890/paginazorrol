"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown } from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"
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
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Función para calcular min y max reales (ignorando valores 0 o null)
  const getMinMax = (products: Product[], key: keyof Product, defaultValue: number = 0): [number, number] => {
    const values = products
      .map(p => p[key] as number)
      .filter(v => v !== undefined && v !== null && v > 0)
    
    if (values.length === 0) {
      return [defaultValue, defaultValue + 10]
    }
    
    return [Math.min(...values), Math.max(...values)]
  }

  // Calcular valores mínimos y máximos reales usando la función
  const [minPrice, maxPrice] = getMinMax(products, 'price', 0)
  const [minAge, maxAge] = getMinMax(products, 'ageMin', 0)
  const [minPlayers, maxPlayers] = getMinMax(products, 'playersMax', 1)
  const [minDuration, maxDuration] = getMinMax(products, 'durationMin', 0)

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

  // Estado para el dropdown de ordenamiento
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  // Sincronizar con los filtros externos
  useEffect(() => {
    setPendingFilters(prev => {
      const hasExternalChanges = 
        JSON.stringify(prev.priceRange) !== JSON.stringify(filters.priceRange) ||
        JSON.stringify(prev.categories) !== JSON.stringify(filters.categories) ||
        JSON.stringify(prev.subcategories) !== JSON.stringify(filters.subcategories) ||
        JSON.stringify(prev.ageRange) !== JSON.stringify(filters.ageRange) ||
        JSON.stringify(prev.playersRange) !== JSON.stringify(filters.playersRange) ||
        JSON.stringify(prev.durationRange) !== JSON.stringify(filters.durationRange) ||
        prev.inStock !== filters.inStock ||
        JSON.stringify(prev.tags) !== JSON.stringify(filters.tags) ||
        prev.sortBy !== filters.sortBy;

      if (hasExternalChanges) {
        return {
          priceRange: filters.priceRange || [minPrice, maxPrice],
          categories: filters.categories || [],
          subcategories: filters.subcategories || [],
          ageRange: filters.ageRange || [minAge, maxAge],
          playersRange: filters.playersRange || [minPlayers, maxPlayers],
          durationRange: filters.durationRange || [minDuration, maxDuration],
          inStock: filters.inStock || false,
          tags: filters.tags || [],
          sortBy: filters.sortBy || 'default',
        };
      }
      return prev;
    });
  }, [filters, minPrice, maxPrice, minAge, maxAge, minPlayers, maxPlayers, minDuration, maxDuration])

  // Actualizar rangos cuando cambien los productos
  useEffect(() => {
    setPendingFilters(prev => ({
      ...prev,
      priceRange: prev.priceRange[0] === 0 ? [minPrice, maxPrice] : prev.priceRange,
      ageRange: prev.ageRange[0] === 0 ? [minAge, maxAge] : prev.ageRange,
      playersRange: prev.playersRange[0] === 0 ? [minPlayers, maxPlayers] : prev.playersRange,
      durationRange: prev.durationRange[0] === 0 ? [minDuration, maxDuration] : prev.durationRange,
    }))
  }, [minPrice, maxPrice, minAge, maxAge, minPlayers, maxPlayers, minDuration, maxDuration])

  // Función para aplicar filtros
  const applyFilters = useCallback((newFilters: Filters) => {
    onFiltersChange(newFilters)
  }, [onFiltersChange])

  const updatePendingFilters = (key: keyof Filters, value: any) => {
    const newFilters = { ...pendingFilters, [key]: value }
    setPendingFilters(newFilters)
    applyFilters(newFilters)
  }

  // Función para seleccionar ordenamiento
  const selectSort = (sort: SortOption) => {
    updatePendingFilters("sortBy", sort)
    setIsSortDropdownOpen(false)
  }

  const toggleArrayFilter = (key: "categories" | "subcategories" | "tags", value: string) => {
    const currentArray = pendingFilters[key] || []
    const newArray = currentArray.includes(value)
      ? currentArray.filter((item) => item !== value)
      : [...currentArray, value]
    updatePendingFilters(key, newArray)
  }

  const toggleSubcategoryFilter = (subcategoryName: string) => {
    const currentSubcategories = pendingFilters.subcategories || []
    const newSubcategories = currentSubcategories.includes(subcategoryName)
      ? currentSubcategories.filter((item) => item !== subcategoryName)
      : [...currentSubcategories, subcategoryName]
    updatePendingFilters("subcategories", newSubcategories)
  }

  const getSortLabel = (sort: SortOption): string => {
    switch (sort) {
      case 'default': return 'Por defecto'
      case 'price-asc': return 'Menor a mayor precio'
      case 'price-desc': return 'Mayor a menor precio'
      default: return 'Por defecto'
    }
  }

  // 👈 DISEÑO ORIGINAL: Flechas con el color original (muted)
  const getSortIcon = (sort: SortOption) => {
    switch (sort) {
      case 'default': return <ArrowUpDown className="w-4 h-4" />
      case 'price-asc': return <ArrowUp className="w-4 h-4" />
      case 'price-desc': return <ArrowDown className="w-4 h-4" />
      default: return <ArrowUpDown className="w-4 h-4" />
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

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false)
      }
    }

    if (isSortDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isSortDropdownOpen])

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
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Limpiar todos
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* ORDENAMIENTO POR PRECIO */}
          <motion.div 
            className="space-y-1.5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Label className="text-xs font-medium">Ordenar por precio</Label>
            
            {/* Dropdown selector único */}
            <div 
              className="relative" 
              ref={dropdownRef}
              onMouseEnter={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsSortDropdownOpen(!isSortDropdownOpen);
                }}
                className={`w-full h-10 px-4 py-2 text-sm font-medium rounded-md border transition-all duration-200 flex items-center justify-between
                  ${pendingFilters.sortBy !== 'default' 
                    ? 'bg-[#C2410C] text-white border-[#C2410C] hover:bg-[#9A3412]' 
                    : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                <div className="flex items-center gap-2 pointer-events-none">
                  {getSortIcon(pendingFilters.sortBy)}
                  <span>{getSortLabel(pendingFilters.sortBy)}</span>
                </div>
                <div className="pointer-events-none">
                  <motion.div
                    animate={{ rotate: isSortDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </div>
              </button>

              {/* Opciones del dropdown - DISEÑO ORIGINAL RESTAURADO */}
              <AnimatePresence>
                {isSortDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.1 }}
                    className="absolute left-0 right-0 mt-1 py-1 bg-popover rounded-md border shadow-lg z-[100]"
                  >
                    {[
                      { value: 'default', label: 'Por defecto', icon: <ArrowUpDown className="w-4 h-4" /> },
                      { value: 'price-asc', label: 'Menor a mayor precio', icon: <ArrowUp className="w-4 h-4" /> },
                      { value: 'price-desc', label: 'Mayor a menor precio', icon: <ArrowDown className="w-4 h-4" /> }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          selectSort(option.value as SortOption);
                        }}
                        className={`w-full px-4 py-2 text-sm text-left transition-colors duration-150 flex items-center gap-2
                          ${pendingFilters.sortBy === option.value 
                            ? 'bg-[#C2410C] text-white' 
                            : 'hover:bg-accent hover:text-accent-foreground'
                          }`}
                      >
                        {/* DISEÑO ORIGINAL: El ícono mantiene su color muted original */}
                        <span className={pendingFilters.sortBy === option.value ? 'text-white' : 'text-muted-foreground'}>
                          {option.icon}
                        </span>
                        {option.label}
                        {pendingFilters.sortBy === option.value && (
                          <span className="ml-auto font-bold">✓</span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Price Range */}
          <motion.div 
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Label className="text-sm font-medium">
              Rango de Precio (CLP) 
            </Label>
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

          {/* Categories */}
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

          {/* Subcategorías */}
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
            <Label className="text-sm font-medium">
              Edad Mínima
            </Label>
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
            <Label className="text-sm font-medium">
              Número de Jugadores
            </Label>
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
            <Label className="text-sm font-medium">
              Duración
            </Label>
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