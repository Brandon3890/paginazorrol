"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useCategoryStore } from "@/lib/category-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save, Plus, Trash2, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function EditCategoryPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const categoryId = parseInt(params.id as string)
  
  const { 
    categories, 
    getCategoryById, 
    updateCategory, 
    updateSubcategory,
    addSubcategory,
    deactivateSubcategory,
    deleteSubcategoryPermanently,
    deleteCategoryPermanently
  } = useCategoryStore()

  const category = getCategoryById(categoryId)
  const subcategoryToEdit = searchParams.get('subcategory')

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    description: "",
    is_active: true
  })

  const [subcategoryForm, setSubcategoryForm] = useState({
    name: "",
    is_active: true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<'category' | 'subcategories'>('category')
  
  // Estados para los diálogos
  const [deactivateSubcategoryDialog, setDeactivateSubcategoryDialog] = useState({
    open: false,
    subcategoryId: null as number | null,
    subcategoryName: ""
  })
  
  const [deleteSubcategoryDialog, setDeleteSubcategoryDialog] = useState({
    open: false,
    subcategoryId: null as number | null,
    subcategoryName: ""
  })
  
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState({
    open: false,
    categoryId: null as number | null,
    categoryName: ""
  })

  useEffect(() => {
    if (category) {
      setCategoryForm({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
        is_active: category.is_active
      })
    }
  }, [category])

  useEffect(() => {
    if (subcategoryToEdit && category) {
      const subcategory = category.subcategories.find(sub => sub.id === parseInt(subcategoryToEdit))
      if (subcategory) {
        setSubcategoryForm({
          name: subcategory.name,
          is_active: subcategory.is_active
        })
        setActiveTab('subcategories')
      }
    }
  }, [subcategoryToEdit, category])

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: Record<string, string> = {}
    
    if (!categoryForm.name.trim()) {
      newErrors.name = "El nombre es requerido"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const categoryData = {
      ...categoryForm,
      slug: generateSlug(categoryForm.name)
    }

    updateCategory(categoryId, categoryData)
    router.push("/admin/categories")
  }

  const handleSubcategorySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: Record<string, string> = {}
    
    if (!subcategoryForm.name.trim()) {
      newErrors.subcategoryName = "El nombre es requerido"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const subcategoryData = {
      name: subcategoryForm.name.trim(),
      slug: generateSlug(subcategoryForm.name),
      is_active: subcategoryForm.is_active
    }

    if (subcategoryToEdit) {
      updateSubcategory(parseInt(subcategoryToEdit), subcategoryData)
    } else {
      addSubcategory({
        ...subcategoryData,
        category_id: categoryId
      })
    }

    setSubcategoryForm({ name: "", is_active: true })
    setErrors({})
  }

  // Diálogo para desactivar subcategoría
  const openDeactivateSubcategoryDialog = (subcategoryId: number, subcategoryName: string) => {
    setDeactivateSubcategoryDialog({
      open: true,
      subcategoryId,
      subcategoryName
    })
  }

  const confirmDeactivateSubcategory = () => {
    if (deactivateSubcategoryDialog.subcategoryId) {
      deactivateSubcategory(deactivateSubcategoryDialog.subcategoryId)
      setDeactivateSubcategoryDialog({ open: false, subcategoryId: null, subcategoryName: "" })
    }
  }

  // Diálogo para eliminar permanentemente subcategoría
  const openDeleteSubcategoryDialog = (subcategoryId: number, subcategoryName: string) => {
    setDeleteSubcategoryDialog({
      open: true,
      subcategoryId,
      subcategoryName
    })
  }

  const confirmDeleteSubcategory = () => {
    if (deleteSubcategoryDialog.subcategoryId) {
      deleteSubcategoryPermanently(deleteSubcategoryDialog.subcategoryId)
      setDeleteSubcategoryDialog({ open: false, subcategoryId: null, subcategoryName: "" })
    }
  }

  // Diálogo para eliminar permanentemente categoría
  const openDeleteCategoryDialog = () => {
    if (category) {
      setDeleteCategoryDialog({
        open: true,
        categoryId: category.id,
        categoryName: category.name
      })
    }
  }

  const confirmDeleteCategory = () => {
    if (deleteCategoryDialog.categoryId) {
      deleteCategoryPermanently(deleteCategoryDialog.categoryId)
      setDeleteCategoryDialog({ open: false, categoryId: null, categoryName: "" })
      router.push("/admin/categories")
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-foreground mb-4">Categoría no encontrada</h1>
            <Link href="/admin/categories">
              <Button>Volver a Categorías</Button>
            </Link>
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
          <Link href="/admin/categories">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Categorías
            </Button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Editar: {category.name}</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Modifica la categoría y gestiona sus subcategorías
              </p>
            </div>
            <Button 
              variant="destructive" 
              onClick={openDeleteCategoryDialog}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar Categoría
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Navegación */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Navegación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant={activeTab === 'category' ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab('category')}
                >
                  Información de la Categoría
                </Button>
                <Button
                  variant={activeTab === 'subcategories' ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab('subcategories')}
                >
                  Subcategorías ({category.subcategories.length})
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Contenido */}
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'category' && (
              <Card>
                <CardHeader>
                  <CardTitle>Editar Categoría</CardTitle>
                  <CardDescription>
                    Modifica la información básica de la categoría
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCategorySubmit} className="space-y-6">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre de la categoría *</Label>
                        <Input
                          id="name"
                          value={categoryForm.name}
                          onChange={(e) => {
                            setCategoryForm(prev => ({ ...prev, name: e.target.value }))
                            if (errors.name) setErrors(prev => ({ ...prev, name: "" }))
                          }}
                          className={errors.name ? "border-destructive" : ""}
                        />
                        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                        <p className="text-xs text-muted-foreground">
                          Slug generado: /{generateSlug(categoryForm.name)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                          id="description"
                          value={categoryForm.description}
                          onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="isActive">Categoría activa</Label>
                          <p className="text-sm text-muted-foreground">
                            Las categorías inactivas no se mostrarán en la tienda
                          </p>
                        </div>
                        <Switch
                          id="isActive"
                          checked={categoryForm.is_active}
                          onCheckedChange={(checked) => setCategoryForm(prev => ({ ...prev, is_active: checked }))}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full bg-[#C2410C] hover:bg-[#9A3412]">
                      <Save className="w-4 h-4 mr-2" />
                      Guardar Cambios
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {activeTab === 'subcategories' && (
              <div className="space-y-6">
                {/* Formulario de subcategoría */}
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {subcategoryToEdit ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
                    </CardTitle>
                    <CardDescription>
                      {subcategoryToEdit 
                        ? 'Modifica la información de la subcategoría' 
                        : 'Crea una nueva subcategoría para esta categoría'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubcategorySubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="subcategoryName">Nombre *</Label>
                        <Input
                          id="subcategoryName"
                          value={subcategoryForm.name}
                          onChange={(e) => {
                            setSubcategoryForm(prev => ({ ...prev, name: e.target.value }))
                            if (errors.subcategoryName) setErrors(prev => ({ ...prev, subcategoryName: "" }))
                          }}
                          className={errors.subcategoryName ? "border-destructive" : ""}
                        />
                        {errors.subcategoryName && <p className="text-sm text-destructive">{errors.subcategoryName}</p>}
                        <p className="text-xs text-muted-foreground">
                          Slug generado: /{generateSlug(subcategoryForm.name)}
                        </p>
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="subcategoryActive">Subcategoría activa</Label>
                          <p className="text-sm text-muted-foreground">
                            Las subcategorías inactivas no se mostrarán en la tienda
                          </p>
                        </div>
                        <Switch
                          id="subcategoryActive"
                          checked={subcategoryForm.is_active}
                          onCheckedChange={(checked) => setSubcategoryForm(prev => ({ ...prev, is_active: checked }))}
                        />
                      </div>

                      <div className="flex gap-4 pt-2">
                        {subcategoryToEdit && (
                          <Link 
                            href={`/admin/categories/edit/${categoryId}`}
                            className="flex-1"
                          >
                            <Button variant="outline" className="w-full">
                              Cancelar Edición
                            </Button>
                          </Link>
                        )}
                        <Button 
                          type="submit" 
                          className={subcategoryToEdit ? "flex-1 bg-[#C2410C] hover:bg-[#9A3412]" : "w-full bg-[#C2410C] hover:bg-[#9A3412]"}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {subcategoryToEdit ? 'Guardar Cambios' : 'Crear Subcategoría'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Lista de subcategorías existentes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Subcategorías Existentes</CardTitle>
                    <CardDescription>
                      Gestiona las subcategorías de esta categoría
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {category.subcategories.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No hay subcategorías en esta categoría
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {category.subcategories.map((subcategory) => (
                          <div key={subcategory.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-medium">{subcategory.name}</p>
                                <p className="text-sm text-muted-foreground font-mono">/{subcategory.slug}</p>
                              </div>
                              <div className="flex gap-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                  subcategory.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {subcategory.is_active ? 'Activa' : 'Inactiva'}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Link href={`/admin/categories/edit/${categoryId}?subcategory=${subcategory.id}`}>
                                <Button variant="outline" size="icon">
                                  <Save className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button 
                                variant="outline" 
                                size="icon"
                                onClick={() => openDeactivateSubcategoryDialog(subcategory.id, subcategory.name)}
                                className="text-yellow-600 hover:text-yellow-700"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon"
                                onClick={() => openDeleteSubcategoryDialog(subcategory.id, subcategory.name)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Diálogo para desactivar subcategoría */}
        <Dialog open={deactivateSubcategoryDialog.open} onOpenChange={(open) => setDeactivateSubcategoryDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <DialogTitle>Desactivar Subcategoría</DialogTitle>
              </div>
              <DialogDescription>
                ¿Estás seguro de que quieres desactivar la subcategoría "{deactivateSubcategoryDialog.subcategoryName}"? 
                No se mostrará en la tienda pero podrás reactivarla después.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => setDeactivateSubcategoryDialog({ open: false, subcategoryId: null, subcategoryName: "" })} 
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                variant="default"
                onClick={confirmDeactivateSubcategory}
                className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700"
              >
                Desactivar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo para eliminar permanentemente subcategoría */}
        <Dialog open={deleteSubcategoryDialog.open} onOpenChange={(open) => setDeleteSubcategoryDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <DialogTitle>Eliminar Subcategoría Permanentemente</DialogTitle>
              </div>
              <DialogDescription className="space-y-2">
                <p className="font-semibold text-red-600">¡Esta acción no se puede deshacer!</p>
                <p>La subcategoría "{deleteSubcategoryDialog.subcategoryName}" será eliminada permanentemente de la base de datos.</p>
                <p>Los productos asociados a esta subcategoría podrían quedar sin categoría.</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => setDeleteSubcategoryDialog({ open: false, subcategoryId: null, subcategoryName: "" })} 
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={confirmDeleteSubcategory}
                className="w-full sm:w-auto"
              >
                Eliminar Permanentemente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo para eliminar permanentemente categoría */}
        <Dialog open={deleteCategoryDialog.open} onOpenChange={(open) => setDeleteCategoryDialog(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <DialogTitle>Eliminar Categoría Permanentemente</DialogTitle>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground mt-2">
                <p className="font-semibold text-red-600">
                  ¡Esta acción no se puede deshacer!
                </p>
                <p>
                  La categoría "{deleteCategoryDialog.categoryName}" y todas sus
                  subcategorías serán eliminadas permanentemente de la base de datos.
                </p>
                <p>
                  Los productos asociados a esta categoría podrían quedar sin categoría.
                </p>
              </div>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => setDeleteCategoryDialog({ open: false, categoryId: null, categoryName: "" })} 
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive"
                onClick={confirmDeleteCategory}
                className="w-full sm:w-auto"
              >
                Eliminar Permanentemente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  )
}