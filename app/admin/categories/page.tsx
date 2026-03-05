"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useCategoryStore } from "@/lib/category-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, ArrowLeft, Edit, Folder, Tag, Power, PowerOff, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Subcategory {
  id: number
  name: string
  slug: string
  category_id: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Category {
  id: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  subcategories: Subcategory[]
}

export default function AdminCategoriesPage() {
  const { categories, loading, fetchCategories, deactivateCategory, deactivateSubcategory, activateCategory, activateSubcategory } = useCategoryStore()

  const [categoryToDeactivate, setCategoryToDeactivate] = useState<number | null>(null)
  const [subcategoryToDeactivate, setSubcategoryToDeactivate] = useState<number | null>(null)
  const [categoryToActivate, setCategoryToActivate] = useState<number | null>(null)
  const [subcategoryToActivate, setSubcategoryToActivate] = useState<number | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [deactivateSubcategoryDialogOpen, setDeactivateSubcategoryDialogOpen] = useState(false)
  const [activateDialogOpen, setActivateDialogOpen] = useState(false)
  const [activateSubcategoryDialogOpen, setActivateSubcategoryDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("active")
  const [expandedCategories, setExpandedCategories] = useState<number[]>([])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Calcular estadísticas
  const totalCategories = categories.length
  const totalSubcategories = categories.reduce((total, category) => total + category.subcategories.length, 0)
  
  const activeCategories = categories.filter(cat => cat.is_active)
  const inactiveCategories = categories.filter(cat => !cat.is_active)
  
  const activeSubcategories = categories.reduce((total, category) => 
    total + category.subcategories.filter(sub => sub.is_active).length, 0
  )
  const inactiveSubcategories = categories.reduce((total, category) => 
    total + category.subcategories.filter(sub => !sub.is_active).length, 0
  )

  const handleDeactivateCategory = (id: number) => {
    setCategoryToDeactivate(id)
    setDeactivateDialogOpen(true)
  }

  const handleDeactivateSubcategory = (subcategoryId: number) => {
    setSubcategoryToDeactivate(subcategoryId)
    setDeactivateSubcategoryDialogOpen(true)
  }

  const handleActivateCategory = (id: number) => {
    setCategoryToActivate(id)
    setActivateDialogOpen(true)
  }

  const handleActivateSubcategory = (subcategoryId: number) => {
    setSubcategoryToActivate(subcategoryId)
    setActivateSubcategoryDialogOpen(true)
  }

  const confirmDeactivateCategory = () => {
    if (categoryToDeactivate) {
      deactivateCategory(categoryToDeactivate)
      setDeactivateDialogOpen(false)
      setCategoryToDeactivate(null)
    }
  }

  const confirmDeactivateSubcategory = () => {
    if (subcategoryToDeactivate) {
      deactivateSubcategory(subcategoryToDeactivate)
      setDeactivateSubcategoryDialogOpen(false)
      setSubcategoryToDeactivate(null)
    }
  }

  const confirmActivateCategory = () => {
    if (categoryToActivate) {
      activateCategory(categoryToActivate)
      setActivateDialogOpen(false)
      setCategoryToActivate(null)
    }
  }

  const confirmActivateSubcategory = () => {
    if (subcategoryToActivate) {
      activateSubcategory(subcategoryToActivate)
      setActivateSubcategoryDialogOpen(false)
      setSubcategoryToActivate(null)
    }
  }

  const toggleCategoryExpansion = (categoryId: number) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  // Componente para vista móvil - Categorías colapsables
  const MobileCategoryCard = ({ category }: { category: Category }) => {
    const isExpanded = expandedCategories.includes(category.id)
    const activeSubs = category.subcategories.filter(sub => sub.is_active)
    const inactiveSubs = category.subcategories.filter(sub => !sub.is_active)

    return (
      <Card className={!category.is_active ? "opacity-70 border-dashed" : ""}>
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Folder className="w-5 h-5 text-[#C2410C] flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base truncate">{category.name}</CardTitle>
                <CardDescription className="text-xs truncate">
                  {category.description || "Sin descripción"}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge variant={category.is_active ? "default" : "secondary"} className="text-xs">
                {category.subcategories.length}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleCategoryExpansion(category.id)}
                className="h-8 w-8"
              >
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          
          <div className="flex gap-2 mt-2">
            <Link href={`/admin/categories/edit/${category.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-xs h-8">
                <Edit className="w-3 h-3 mr-1" />
                Editar
              </Button>
            </Link>
            {category.is_active ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleDeactivateCategory(category.id)}
                className="flex-1 text-xs h-8 text-destructive"
              >
                <PowerOff className="w-3 h-3 mr-1" />
                Desactivar
              </Button>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleActivateCategory(category.id)}
                className="flex-1 text-xs h-8 text-green-600"
              >
                <Power className="w-3 h-3 mr-1" />
                Activar
              </Button>
            )}
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="p-4 pt-0 border-t">
            {/* Subcategorías Activas */}
            {activeSubs.length > 0 && (
              <div className="space-y-2 mb-3">
                <h4 className="text-xs font-medium text-muted-foreground">Activas ({activeSubs.length}):</h4>
                <div className="space-y-1">
                  {activeSubs.map((subcategory) => (
                    <div key={subcategory.id} className="flex items-center justify-between p-2 border rounded text-xs">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Tag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1">{subcategory.name}</span>
                        <Badge variant="outline" className="text-xs font-mono flex-shrink-0">
                          /{subcategory.slug}
                        </Badge>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <Link href={`/admin/categories/edit/${category.id}?subcategory=${subcategory.id}`}>
                          <Button variant="ghost" size="icon" className="w-6 h-6">
                            <Edit className="w-3 h-3" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-6 h-6 text-destructive"
                          onClick={() => handleDeactivateSubcategory(subcategory.id)}
                        >
                          <PowerOff className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subcategorías Inactivas */}
            {inactiveSubs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Inactivas ({inactiveSubs.length}):</h4>
                <div className="space-y-1">
                  {inactiveSubs.map((subcategory) => (
                    <div key={subcategory.id} className="flex items-center justify-between p-2 border rounded text-xs opacity-70">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Tag className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1">{subcategory.name}</span>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">Inactiva</Badge>
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-6 h-6 text-green-600"
                          onClick={() => handleActivateSubcategory(subcategory.id)}
                        >
                          <Power className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {category.subcategories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                No hay subcategorías
              </p>
            )}
          </CardContent>
        )}
      </Card>
    )
  }

  // Componente para vista desktop (original)
  const DesktopCategoryCard = ({ category, showInactive = false }: { category: Category, showInactive?: boolean }) => {
    const activeSubcategories = category.subcategories.filter(sub => sub.is_active)
    const inactiveSubcategories = category.subcategories.filter(sub => !sub.is_active)

    return (
      <Card className={!category.is_active ? "opacity-70 border-dashed" : ""}>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Folder className="w-5 h-5 text-[#C2410C]" />
                <CardTitle className="text-lg">{category.name}</CardTitle>
              </div>
              <CardDescription className="text-sm mb-3">{category.description}</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant={category.is_active ? "default" : "secondary"} className="text-xs">
                  {category.is_active ? "Activa" : "Inactiva"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {category.subcategories.length} subcategorías
                </Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  /{category.slug}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Link href={`/admin/categories/edit/${category.id}`}>
                <Button variant="outline" size="icon">
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
              {category.is_active ? (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => handleDeactivateCategory(category.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <PowerOff className="w-4 h-4" />
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => handleActivateCategory(category.id)}
                  className="text-green-600 hover:text-green-700"
                >
                  <Power className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Subcategorías Activas */}
            {activeSubcategories.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Subcategorías Activas:</h4>
                <div className="grid gap-2">
                  {activeSubcategories.map((subcategory: Subcategory) => (
                    <div key={subcategory.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{subcategory.name}</span>
                        <Badge variant="outline" className="text-xs font-mono ml-2">
                          /{subcategory.slug}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Link href={`/admin/categories/edit/${category.id}?subcategory=${subcategory.id}`}>
                          <Button variant="ghost" size="icon" className="w-8 h-8">
                            <Edit className="w-3 h-3" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeactivateSubcategory(subcategory.id)}
                        >
                          <PowerOff className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subcategorías Inactivas */}
            {showInactive && inactiveSubcategories.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Subcategorías Inactivas:</h4>
                <div className="grid gap-2">
                  {inactiveSubcategories.map((subcategory: Subcategory) => (
                    <div key={subcategory.id} className="flex items-center justify-between p-3 border rounded-lg opacity-70 border-dashed">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{subcategory.name}</span>
                        <Badge variant="outline" className="text-xs font-mono ml-2">
                          /{subcategory.slug}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">Inactiva</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-8 h-8 text-green-600 hover:text-green-700"
                          onClick={() => handleActivateSubcategory(subcategory.id)}
                        >
                          <Power className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {category.subcategories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No hay subcategorías en esta categoría
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p>Cargando categorías...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gestión de Categorías</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Organiza tu catálogo con categorías y subcategorías
              </p>
            </div>
            <Link href="/admin/categories/new">
              <Button className="flex items-center gap-2 w-full sm:w-auto bg-[#C2410C] hover:bg-[#9A3412]">
                <Plus className="w-4 h-4" />
                Nueva Categoría
              </Button>
            </Link>
          </div>
        </div>

        {/* Estadísticas - Siempre visibles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
          <Card className="text-center">
            <CardContent className="p-3 md:p-4">
              <Folder className="w-6 h-6 md:w-8 md:h-8 text-blue-500 mx-auto mb-1 md:mb-2" />
              <p className="text-lg md:text-2xl font-bold">{totalCategories}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Total Categorías</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-3 md:p-4">
              <Tag className="w-6 h-6 md:w-8 md:h-8 text-green-500 mx-auto mb-1 md:mb-2" />
              <p className="text-lg md:text-2xl font-bold">{totalSubcategories}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Total Subcategorías</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-3 md:p-4">
              <Eye className="w-6 h-6 md:w-8 md:h-8 text-green-500 mx-auto mb-1 md:mb-2" />
              <p className="text-lg md:text-2xl font-bold text-green-600">{activeCategories.length}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Categorías Activas</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-3 md:p-4">
              <Eye className="w-6 h-6 md:w-8 md:h-8 text-green-500 mx-auto mb-1 md:mb-2" />
              <p className="text-lg md:text-2xl font-bold text-green-600">{activeSubcategories}</p>
              <p className="text-xs md:text-sm text-muted-foreground">Subcategorías Activas</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex items-center gap-2 flex-1">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Activas</span>
              <Badge variant="secondary" className="ml-1">({activeCategories.length})</Badge>
            </TabsTrigger>
            <TabsTrigger value="inactive" className="flex items-center gap-2 flex-1">
              <EyeOff className="w-4 h-4" />
              <span className="hidden sm:inline">Inactivas</span>
              <Badge variant="secondary" className="ml-1">({inactiveCategories.length})</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeCategories.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <EyeOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No hay categorías activas</h3>
                  <p className="text-muted-foreground mb-4">
                    Todas las categorías están inactivas o no hay categorías creadas.
                  </p>
                  <Link href="/admin/categories/new">
                    <Button className="bg-[#C2410C] hover:bg-[#9A3412]">
                      <Plus className="w-4 h-4 mr-2" />
                      Crear Primera Categoría
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Vista móvil */}
                <div className="block md:hidden space-y-3">
                  {activeCategories.map((category: Category) => (
                    <MobileCategoryCard key={category.id} category={category} />
                  ))}
                </div>
                
                {/* Vista desktop */}
                <div className="hidden md:block space-y-6">
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      Mostrando <strong>{activeCategories.length}</strong> categorías activas con <strong>{activeSubcategories}</strong> subcategorías activas
                    </p>
                  </div>
                  {activeCategories.map((category: Category) => (
                    <DesktopCategoryCard key={category.id} category={category} showInactive={true} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="inactive" className="space-y-4">
            {inactiveCategories.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No hay categorías inactivas</h3>
                  <p className="text-muted-foreground">
                    Todas las categorías están activas.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Vista móvil */}
                <div className="block md:hidden space-y-3">
                  {inactiveCategories.map((category: Category) => (
                    <MobileCategoryCard key={category.id} category={category} />
                  ))}
                </div>
                
                {/* Vista desktop */}
                <div className="hidden md:block space-y-6">
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Mostrando <strong>{inactiveCategories.length}</strong> categorías inactivas con <strong>{inactiveSubcategories}</strong> subcategorías inactivas
                    </p>
                  </div>
                  {inactiveCategories.map((category: Category) => (
                    <DesktopCategoryCard key={category.id} category={category} showInactive={true} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Diálogos (se mantienen igual) */}
        <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Desactivar Categoría</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres desactivar esta categoría? No se mostrará en la tienda pero podrás reactivarla después.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeactivateCategory} className="w-full sm:w-auto">
                Desactivar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deactivateSubcategoryDialogOpen} onOpenChange={setDeactivateSubcategoryDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Desactivar Subcategoría</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres desactivar esta subcategoría? No se mostrará en la tienda pero podrás reactivarla después.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDeactivateSubcategoryDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeactivateSubcategory} className="w-full sm:w-auto">
                Desactivar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Activar Categoría</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres activar esta categoría? Se mostrará nuevamente en la tienda.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setActivateDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button 
                onClick={confirmActivateCategory} 
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                Activar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={activateSubcategoryDialogOpen} onOpenChange={setActivateSubcategoryDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Activar Subcategoría</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres activar esta subcategoría? Se mostrará nuevamente en la tienda.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setActivateSubcategoryDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button 
                onClick={confirmActivateSubcategory} 
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                Activar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  )
}