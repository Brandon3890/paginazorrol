"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useCouponStore } from "@/lib/coupon-store"
import { useProductStore } from "@/lib/product-store"
import { useCategoryStore } from "@/lib/category-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, Loader2, X } from "lucide-react"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Category {
  id: number
  name: string
  slug: string
  is_active: boolean
  subcategories?: Subcategory[] // Agregar esta línea
}

interface Subcategory {
  id: number
  name: string
  slug: string
  category_id: number
  is_active: boolean
}

interface Product {
  id: number
  name: string
  price: number
  categoryId: number
  subcategoryId: number
  isActive: boolean
}

export default function NewCouponPage() {
  const router = useRouter()
  const { addCoupon } = useCouponStore()
  const { products, fetchProducts } = useProductStore()
  const { categories, fetchCategories } = useCategoryStore()
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  
  // Estados para los diálogos de selección
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showSubcategoryDialog, setShowSubcategoryDialog] = useState(false)
  const [showProductDialog, setShowProductDialog] = useState(false)

  // Estados del formulario
  const [formData, setFormData] = useState({
    code: "",
    discountPercentage: 10,
    expirationDate: "",
    maxUses: 100,
    type: "global" as "global" | "category" | "subcategory" | "product" | "multiple",
    isActive: true,
    categories: [] as number[],
    subcategories: [] as number[],
    products: [] as number[],
  })

  // Estados para selecciones temporales
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [selectedSubcategories, setSelectedSubcategories] = useState<number[]>([])
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])

  // Obtener todas las subcategorías de las categorías
  const allSubcategories = categories.flatMap((category: Category) => 
    category.subcategories || []
  ).filter((subcategory: Subcategory) => subcategory.is_active)

  // Cargar datos al montar el componente
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        await Promise.all([
          fetchCategories(),
          fetchProducts()
        ])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [fetchCategories, fetchProducts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validaciones
    if (!formData.code.trim()) {
      alert("El código del cupón es requerido")
      return
    }

    if (formData.discountPercentage < 1 || formData.discountPercentage > 100) {
      alert("El porcentaje de descuento debe estar entre 1 y 100")
      return
    }

    if (!formData.expirationDate) {
      alert("La fecha de expiración es requerida")
      return
    }

    if (formData.maxUses < 1) {
      alert("Los usos máximos deben ser al menos 1")
      return
    }

    // Validar selecciones según el tipo
    if (formData.type === 'category' && formData.categories.length === 0) {
      alert("Debes seleccionar al menos una categoría para este tipo de cupón")
      return
    }

    if (formData.type === 'subcategory' && formData.subcategories.length === 0) {
      alert("Debes seleccionar al menos una subcategoría para este tipo de cupón")
      return
    }

    if (formData.type === 'product' && formData.products.length === 0) {
      alert("Debes seleccionar al menos un producto para este tipo de cupón")
      return
    }

    if (formData.type === 'multiple' && 
        formData.categories.length === 0 && 
        formData.subcategories.length === 0 && 
        formData.products.length === 0) {
      alert("Debes seleccionar al menos una categoría, subcategoría o producto para el tipo múltiple")
      return
    }
    
    setSaving(true)

    try {
      await addCoupon({
        code: formData.code.toUpperCase(),
        discountPercentage: formData.discountPercentage,
        expirationDate: formData.expirationDate,
        maxUses: formData.maxUses,
        type: formData.type,
        isActive: formData.isActive,
        categories: formData.type === 'category' || formData.type === 'multiple' ? formData.categories : [],
        subcategories: formData.type === 'subcategory' || formData.type === 'multiple' ? formData.subcategories : [],
        products: formData.type === 'product' || formData.type === 'multiple' ? formData.products : [],
      })
      setShowSuccessDialog(true)
    } catch (error) {
      console.error('Error creating coupon:', error)
      alert("Error al crear el cupón. Verifica que el código no esté en uso.")
    } finally {
      setSaving(false)
    }
  }

  const handleSuccessConfirm = () => {
    setShowSuccessDialog(false)
    router.push('/admin/coupons')
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Funciones para manejar selecciones
  const handleCategorySelect = (categoryId: number) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId]
    
    setSelectedCategories(newCategories)
  }

  const handleSubcategorySelect = (subcategoryId: number) => {
    const newSubcategories = selectedSubcategories.includes(subcategoryId)
      ? selectedSubcategories.filter(id => id !== subcategoryId)
      : [...selectedSubcategories, subcategoryId]
    
    setSelectedSubcategories(newSubcategories)
  }

  const handleProductSelect = (productId: number) => {
    const newProducts = selectedProducts.includes(productId)
      ? selectedProducts.filter(id => id !== productId)
      : [...selectedProducts, productId]
    
    setSelectedProducts(newProducts)
  }

  // Aplicar selecciones al formulario
  const applyCategorySelection = () => {
    setFormData(prev => ({
      ...prev,
      categories: selectedCategories
    }))
    setShowCategoryDialog(false)
  }

  const applySubcategorySelection = () => {
    setFormData(prev => ({
      ...prev,
      subcategories: selectedSubcategories
    }))
    setShowSubcategoryDialog(false)
  }

  const applyProductSelection = () => {
    setFormData(prev => ({
      ...prev,
      products: selectedProducts
    }))
    setShowProductDialog(false)
  }

  // Remover elementos seleccionados
  const removeCategory = (categoryId: number) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(id => id !== categoryId)
    }))
  }

  const removeSubcategory = (subcategoryId: number) => {
    setFormData(prev => ({
      ...prev,
      subcategories: prev.subcategories.filter(id => id !== subcategoryId)
    }))
  }

  const removeProduct = (productId: number) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter(id => id !== productId)
    }))
  }

  // Obtener nombres para mostrar
  const getCategoryName = (id: number) => {
    const category = categories.find((c: Category) => c.id === id)
    return category?.name || `Categoría ${id}`
  }

  const getSubcategoryName = (id: number) => {
    const subcategory = allSubcategories.find((s: Subcategory) => s.id === id)
    return subcategory?.name || `Subcategoría ${id}`
  }

  const getProductName = (id: number) => {
    const product = products.find((p: Product) => p.id === id)
    return product?.name || `Producto ${id}`
  }

  // Inicializar selecciones cuando se abre el diálogo
  const openCategoryDialog = () => {
    setSelectedCategories(formData.categories)
    setShowCategoryDialog(true)
  }

  const openSubcategoryDialog = () => {
    setSelectedSubcategories(formData.subcategories)
    setShowSubcategoryDialog(true)
  }

  const openProductDialog = () => {
    setSelectedProducts(formData.products)
    setShowProductDialog(true)
  }

  // Resetear selecciones cuando cambia el tipo
  useEffect(() => {
    if (formData.type === 'global') {
      setFormData(prev => ({
        ...prev,
        categories: [],
        subcategories: [],
        products: []
      }))
    } else if (formData.type === 'category') {
      setFormData(prev => ({
        ...prev,
        subcategories: [],
        products: []
      }))
    } else if (formData.type === 'subcategory') {
      setFormData(prev => ({
        ...prev,
        categories: [],
        products: []
      }))
    } else if (formData.type === 'product') {
      setFormData(prev => ({
        ...prev,
        categories: [],
        subcategories: []
      }))
    }
  }, [formData.type])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/coupons">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Cupones
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Crear Nuevo Cupón
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Configura un nuevo cupón de descuento para tu tienda
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del Cupón</CardTitle>
              <CardDescription>
                Completa los datos básicos del cupón de descuento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código del Cupón *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => handleInputChange('code', e.target.value)}
                      placeholder="EJ: VERANO20"
                      required
                      className="font-mono uppercase"
                    />
                    <p className="text-xs text-muted-foreground">
                      El código se convertirá automáticamente a mayúsculas
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="discountPercentage">Porcentaje de Descuento *</Label>
                    <Input
                      id="discountPercentage"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.discountPercentage}
                      onChange={(e) => handleInputChange('discountPercentage', parseFloat(e.target.value) || 0)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Debe ser entre 1% y 100%
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expirationDate">Fecha de Expiración *</Label>
                    <Input
                      id="expirationDate"
                      type="date"
                      value={formData.expirationDate}
                      onChange={(e) => handleInputChange('expirationDate', e.target.value)}
                      required
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxUses">Usos Máximos *</Label>
                    <Input
                      id="maxUses"
                      type="number"
                      min="1"
                      value={formData.maxUses}
                      onChange={(e) => handleInputChange('maxUses', parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Cupón *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "global" | "category" | "subcategory" | "product" | "multiple") => handleInputChange('type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global (Todos los productos)</SelectItem>
                        <SelectItem value="category">Por Categoría</SelectItem>
                        <SelectItem value="subcategory">Por Subcategoría</SelectItem>
                        <SelectItem value="product">Por Producto</SelectItem>
                        <SelectItem value="multiple">Múltiple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="isActive">Estado del Cupón</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                      />
                      <Label htmlFor="isActive">
                        {formData.isActive ? "Activo" : "Inactivo"}
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Selectores para tipos específicos */}
                {(formData.type === 'category' || formData.type === 'multiple') && (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Categorías</Label>
                        <p className="text-sm text-muted-foreground">
                          {formData.type === 'category' ? 'Selecciona las categorías a las que aplicará el cupón' : 'Selecciona categorías (opcional)'}
                        </p>
                      </div>
                      <Button type="button" variant="outline" onClick={openCategoryDialog}>
                        Seleccionar Categorías
                      </Button>
                    </div>
                    
                    {formData.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {formData.categories.map(categoryId => (
                          <Badge key={categoryId} variant="secondary" className="flex items-center gap-1">
                            {getCategoryName(categoryId)}
                            <X 
                              className="w-3 h-3 cursor-pointer" 
                              onClick={() => removeCategory(categoryId)}
                            />
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No se han seleccionado categorías
                      </p>
                    )}
                  </div>
                )}

                {(formData.type === 'subcategory' || formData.type === 'multiple') && (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Subcategorías</Label>
                        <p className="text-sm text-muted-foreground">
                          {formData.type === 'subcategory' ? 'Selecciona las subcategorías a las que aplicará el cupón' : 'Selecciona subcategorías (opcional)'}
                        </p>
                      </div>
                      <Button type="button" variant="outline" onClick={openSubcategoryDialog}>
                        Seleccionar Subcategorías
                      </Button>
                    </div>
                    
                    {formData.subcategories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {formData.subcategories.map(subcategoryId => (
                          <Badge key={subcategoryId} variant="secondary" className="flex items-center gap-1">
                            {getSubcategoryName(subcategoryId)}
                            <X 
                              className="w-3 h-3 cursor-pointer" 
                              onClick={() => removeSubcategory(subcategoryId)}
                            />
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No se han seleccionado subcategorías
                      </p>
                    )}
                  </div>
                )}

                {(formData.type === 'product' || formData.type === 'multiple') && (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Productos</Label>
                        <p className="text-sm text-muted-foreground">
                          {formData.type === 'product' ? 'Selecciona los productos a los que aplicará el cupón' : 'Selecciona productos (opcional)'}
                        </p>
                      </div>
                      <Button type="button" variant="outline" onClick={openProductDialog}>
                        Seleccionar Productos
                      </Button>
                    </div>
                    
                    {formData.products.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {formData.products.map(productId => (
                          <Badge key={productId} variant="secondary" className="flex items-center gap-1 max-w-[200px]">
                            <span className="truncate">{getProductName(productId)}</span>
                            <X 
                              className="w-3 h-3 cursor-pointer flex-shrink-0" 
                              onClick={() => removeProduct(productId)}
                            />
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No se han seleccionado productos
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    disabled={saving || loading}
                    className="bg-[#C2410C] hover:bg-[#9A3412]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Crear Cupón
                      </>
                    )}
                  </Button>
                  
                  <Link href="/admin/coupons">
                    <Button variant="outline" type="button">
                      Cancelar
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Diálogo de éxito */}
        <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¡Cupón Creado!</AlertDialogTitle>
              <AlertDialogDescription>
                El cupón ha sido creado exitosamente y ya está disponible para su uso.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleSuccessConfirm}>
                Volver a la lista
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Diálogo para seleccionar categorías */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Seleccionar Categorías</DialogTitle>
              <DialogDescription>
                Elige las categorías a las que aplicará el cupón
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay categorías disponibles
                </div>
              ) : (
                <div className="grid gap-2">
                  {categories.map((category: Category) => (
                    <div
                      key={category.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedCategories.includes(category.id)
                          ? 'bg-orange-50 border-orange-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      <div className={`w-4 h-4 border rounded mr-3 ${
                        selectedCategories.includes(category.id)
                          ? 'bg-orange-500 border-orange-500'
                          : 'border-gray-300'
                      }`} />
                      <span>{category.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={applyCategorySelection} className="flex-1">
                Aplicar ({selectedCategories.length} seleccionadas)
              </Button>
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Diálogo para seleccionar subcategorías */}
        <Dialog open={showSubcategoryDialog} onOpenChange={setShowSubcategoryDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Seleccionar Subcategorías</DialogTitle>
              <DialogDescription>
                Elige las subcategorías a las que aplicará el cupón
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {allSubcategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay subcategorías disponibles
                </div>
              ) : (
                <div className="grid gap-2">
                  {allSubcategories.map((subcategory: Subcategory) => (
                    <div
                      key={subcategory.id}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedSubcategories.includes(subcategory.id)
                          ? 'bg-orange-50 border-orange-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleSubcategorySelect(subcategory.id)}
                    >
                      <div className={`w-4 h-4 border rounded mr-3 ${
                        selectedSubcategories.includes(subcategory.id)
                          ? 'bg-orange-500 border-orange-500'
                          : 'border-gray-300'
                      }`} />
                      <span>{subcategory.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={applySubcategorySelection} className="flex-1">
                Aplicar ({selectedSubcategories.length} seleccionadas)
              </Button>
              <Button variant="outline" onClick={() => setShowSubcategoryDialog(false)}>
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Diálogo para seleccionar productos */}
        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Seleccionar Productos</DialogTitle>
              <DialogDescription>
                Elige los productos a los que aplicará el cupón
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {products.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay productos disponibles
                </div>
              ) : (
                <div className="grid gap-2">
                  {products.map((product: Product) => (
                    <div
                      key={product.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedProducts.includes(product.id)
                          ? 'bg-orange-50 border-orange-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleProductSelect(product.id)}
                    >
                      <div className="flex items-center">
                        <div className={`w-4 h-4 border rounded mr-3 ${
                          selectedProducts.includes(product.id)
                            ? 'bg-orange-500 border-orange-500'
                            : 'border-gray-300'
                        }`} />
                        <span className="truncate max-w-[200px]">{product.name}</span>
                      </div>
                      <Badge variant="outline" className="ml-2 flex-shrink-0">
                        ${product.price}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-4">
              <Button onClick={applyProductSelection} className="flex-1">
                Aplicar ({selectedProducts.length} seleccionados)
              </Button>
              <Button variant="outline" onClick={() => setShowProductDialog(false)}>
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  )
}