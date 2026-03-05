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
  subcategories?: Subcategory[]
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

interface EditCouponPageProps {
  params: Promise<{
    id: string
  }>
}

export default function EditCouponPage({ params }: EditCouponPageProps) {
  const router = useRouter()
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [couponId, setCouponId] = useState<number | null>(null)
  
  const { coupons, updateCoupon, fetchCoupons } = useCouponStore()
  const { products, fetchProducts } = useProductStore()
  const { categories, fetchCategories } = useCategoryStore()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  
  // Estados para los diálogos de selección
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [showSubcategoryDialog, setShowSubcategoryDialog] = useState(false)
  const [showProductDialog, setShowProductDialog] = useState(false)

  // Estados del formulario
  const [formData, setFormData] = useState({
    code: "",
    discountPercentage: 0,
    expirationDate: "",
    maxUses: 1,
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

  // Resolver los params asíncronamente
  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await params
      setResolvedParams(resolved)
      setCouponId(parseInt(resolved.id))
    }
    
    resolveParams()
  }, [params])

  // Cargar datos al montar el componente
  useEffect(() => {
    const loadData = async () => {
      if (!couponId) return
      
      setLoading(true)
      try {
        await Promise.all([
          fetchCategories(),
          fetchProducts(),
          fetchCoupons()
        ])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [couponId, fetchCategories, fetchProducts, fetchCoupons])

  // Buscar el cupón actual y cargar datos en el formulario
const currentCoupon = couponId ? coupons.find(c => c.id === couponId) : null

useEffect(() => {
  if (currentCoupon) {
    console.log('🎯 Cargando datos del cupón:', currentCoupon);
    
    // Función MEJORADA para convertir a números - maneja arrays anidados
    const safeNumberArray = (arr: any): number[] => {
      console.log('🔍 Procesando array:', arr);
      
      if (!arr) return [];
      if (!Array.isArray(arr)) {
        // Si no es array, intentar convertirlo
        if (typeof arr === 'string') {
          try {
            const parsed = JSON.parse(arr);
            if (Array.isArray(parsed)) {
              return safeNumberArray(parsed);
            }
          } catch {
            // Si falla el parse, tratar como número individual
            const num = Number(arr);
            return isNaN(num) ? [] : [num];
          }
        }
        const num = Number(arr);
        return isNaN(num) ? [] : [num];
      }
      
      // Procesar array plano
      const result: number[] = [];
      for (const item of arr) {
        if (Array.isArray(item)) {
          // Si es un array anidado, procesar recursivamente
          result.push(...safeNumberArray(item));
        } else {
          const num = Number(item);
          if (!isNaN(num)) {
            result.push(num);
          } else {
            console.warn('⚠️ Ignorando valor no numérico en array:', item);
          }
        }
      }
      
      console.log('✅ Array procesado:', result);
      return result;
    };
    
    const categoriesArray = safeNumberArray(currentCoupon.categories);
    const subcategoriesArray = safeNumberArray(currentCoupon.subcategories);
    const productsArray = safeNumberArray(currentCoupon.products);
    
    console.log('📋 IDs finales convertidos:', {
      categories: categoriesArray,
      subcategories: subcategoriesArray,
      products: productsArray
    });
    
    setFormData({
      code: currentCoupon.code,
      discountPercentage: currentCoupon.discountPercentage,
      expirationDate: currentCoupon.expirationDate.split('T')[0],
      maxUses: currentCoupon.maxUses,
      type: currentCoupon.type,
      isActive: currentCoupon.isActive,
      categories: categoriesArray,
      subcategories: subcategoriesArray,
      products: productsArray,
    });
  }
}, [currentCoupon]);

  // Funciones seguras para obtener nombres
  const getCategoryName = (id: any): string => {
    // Validación exhaustiva del ID
    if (Array.isArray(id)) {
      console.error('❌ ERROR: getCategoryName recibió un array:', id);
      return 'ERROR: ID inválido';
    }
    
    const numId = Number(id);
    if (isNaN(numId)) {
      console.warn('❌ ID de categoría no es un número:', id);
      return 'ID inválido';
    }
    
    const category = categories.find((c: Category) => c.id === numId);
    if (!category) {
      console.warn('❌ Categoría no encontrada:', numId);
      return `Categoría ${numId}`;
    }
    return category.name;
  }

  const getSubcategoryName = (id: any): string => {
    // Validación exhaustiva del ID
    if (Array.isArray(id)) {
      console.error('❌ ERROR: getSubcategoryName recibió un array:', id);
      return 'ERROR: ID inválido';
    }
    
    const numId = Number(id);
    if (isNaN(numId)) {
      console.warn('❌ ID de subcategoría no es un número:', id);
      return 'ID inválido';
    }
    
    // Buscar en allSubcategories primero
    const subcategory = allSubcategories.find((s: Subcategory) => s.id === numId);
    if (subcategory) return subcategory.name;
    
    // Si no se encuentra, buscar en las categorías anidadas
    for (const category of categories) {
      const found = category.subcategories?.find((s: Subcategory) => s.id === numId);
      if (found) return found.name;
    }
    
    console.warn('❌ Subcategoría no encontrada:', numId);
    return `Subcategoría ${numId}`;
  }

  const getProductName = (id: any): string => {
    // Validación exhaustiva del ID
    if (Array.isArray(id)) {
      console.error('❌ ERROR: getProductName recibió un array:', id);
      return 'ERROR: ID inválido';
    }
    
    const numId = Number(id);
    if (isNaN(numId)) {
      console.warn('❌ ID de producto no es un número:', id);
      return 'ID inválido';
    }
    
    const product = products.find((p: Product) => p.id === numId);
    if (!product) {
      console.warn('❌ Producto no encontrado:', numId);
      return `Producto ${numId}`;
    }
    return product.name;
  }

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  if (!couponId) return
  
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
    // Función MEJORADA para limpiar arrays
    const cleanArray = (arr: number[]): number[] => {
      return arr
        .map(id => {
          const num = Number(id);
          if (isNaN(num)) {
            console.warn('⚠️ Eliminando ID inválido:', id);
            return null;
          }
          return num;
        })
        .filter((id): id is number => id !== null && id > 0);
    };

    const cleanCategories = cleanArray(formData.categories);
    const cleanSubcategories = cleanArray(formData.subcategories);
    const cleanProducts = cleanArray(formData.products);

    console.log('📤 Enviando datos limpios al servidor:', {
      cleanCategories,
      cleanSubcategories,
      cleanProducts,
      originalCategories: formData.categories,
      originalSubcategories: formData.subcategories,
      originalProducts: formData.products
    });

    await updateCoupon(couponId, {
      code: formData.code.toUpperCase(),
      discountPercentage: formData.discountPercentage,
      expirationDate: formData.expirationDate,
      maxUses: formData.maxUses,
      type: formData.type,
      isActive: formData.isActive,
      categories: formData.type === 'category' || formData.type === 'multiple' ? cleanCategories : [],
      subcategories: formData.type === 'subcategory' || formData.type === 'multiple' ? cleanSubcategories : [],
      products: formData.type === 'product' || formData.type === 'multiple' ? cleanProducts : [],
    })
    setShowSuccessDialog(true)
  } catch (error) {
    console.error('Error updating coupon:', error)
    alert("Error al actualizar el cupón. Verifica que el código no esté en uso.")
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
    console.log('🎯 Seleccionando categoría:', categoryId);
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId]
    
    console.log('📋 Nuevas categorías seleccionadas:', newCategories);
    setSelectedCategories(newCategories)
  }

  const handleSubcategorySelect = (subcategoryId: number) => {
    console.log('🎯 Seleccionando subcategoría:', subcategoryId);
    const newSubcategories = selectedSubcategories.includes(subcategoryId)
      ? selectedSubcategories.filter(id => id !== subcategoryId)
      : [...selectedSubcategories, subcategoryId]
    
    console.log('📋 Nuevas subcategorías seleccionadas:', newSubcategories);
    setSelectedSubcategories(newSubcategories)
  }

  const handleProductSelect = (productId: number) => {
    console.log('🎯 Seleccionando producto:', productId);
    const newProducts = selectedProducts.includes(productId)
      ? selectedProducts.filter(id => id !== productId)
      : [...selectedProducts, productId]
    
    console.log('📋 Nuevos productos seleccionados:', newProducts);
    setSelectedProducts(newProducts)
  }

  // Aplicar selecciones al formulario
  const applyCategorySelection = () => {
    console.log('💾 Aplicando selección de categorías:', selectedCategories);
    setFormData(prev => ({
      ...prev,
      categories: selectedCategories
    }))
    setShowCategoryDialog(false)
  }

  const applySubcategorySelection = () => {
    console.log('💾 Aplicando selección de subcategorías:', selectedSubcategories);
    setFormData(prev => ({
      ...prev,
      subcategories: selectedSubcategories
    }))
    setShowSubcategoryDialog(false)
  }

  const applyProductSelection = () => {
    console.log('💾 Aplicando selección de productos:', selectedProducts);
    setFormData(prev => ({
      ...prev,
      products: selectedProducts
    }))
    setShowProductDialog(false)
  }

  // Remover elementos seleccionados
  const removeCategory = (categoryId: number) => {
    if (typeof categoryId !== 'number' || isNaN(categoryId)) {
      console.error('❌ ID de categoría inválido para remover:', categoryId);
      return;
    }
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(id => id !== categoryId)
    }))
  }

  const removeSubcategory = (subcategoryId: number) => {
    if (typeof subcategoryId !== 'number' || isNaN(subcategoryId)) {
      console.error('❌ ID de subcategoría inválido para remover:', subcategoryId);
      return;
    }
    setFormData(prev => ({
      ...prev,
      subcategories: prev.subcategories.filter(id => id !== subcategoryId)
    }))
  }

  const removeProduct = (productId: number) => {
    if (typeof productId !== 'number' || isNaN(productId)) {
      console.error('❌ ID de producto inválido para remover:', productId);
      return;
    }
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter(id => id !== productId)
    }))
  }

  // Inicializar selecciones cuando se abre el diálogo
  const openCategoryDialog = () => {
    console.log('📂 Abriendo diálogo categorías con:', formData.categories);
    setSelectedCategories([...formData.categories])
    setShowCategoryDialog(true)
  }

  const openSubcategoryDialog = () => {
    console.log('📂 Abriendo diálogo subcategorías con:', formData.subcategories);
    setSelectedSubcategories([...formData.subcategories])
    setShowSubcategoryDialog(true)
  }

  const openProductDialog = () => {
    console.log('📂 Abriendo diálogo productos con:', formData.products);
    setSelectedProducts([...formData.products])
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

  // Debug: Verificar cuando se cargan los datos
  useEffect(() => {
    if (currentCoupon && categories.length > 0 && products.length > 0) {
      console.log('✅ Datos cargados completamente:');
      console.log('📦 Cupón actual:', currentCoupon);
      console.log('📂 Categorías:', categories.length);
      console.log('📦 Productos:', products.length);
      console.log('🎯 Subcategorías del cupón:', formData.subcategories);
      
      // Verificar nombres de subcategorías seleccionadas
      formData.subcategories.forEach(id => {
        const name = getSubcategoryName(id);
        console.log(`🔍 Subcategoría ${id}: ${name}`);
      });
    }
  }, [currentCoupon, categories, products, formData.subcategories])

  // Mostrar loading mientras se resuelven los params
  if (!resolvedParams || !couponId || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!currentCoupon) {
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
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-red-500 mb-4">
                <X className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Cupón no encontrado
              </h3>
              <p className="text-gray-600 mb-4">
                El cupón que intentas editar no existe o ha sido eliminado.
              </p>
              <Link href="/admin/coupons">
                <Button>
                  Volver a la lista de cupones
                </Button>
              </Link>
            </CardContent>
          </Card>
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
          <Link href="/admin/coupons">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Cupones
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Editar Cupón: {currentCoupon.code}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Modifica la información del cupón de descuento
            </p>
          </div>
        </div>

        {/* Botón de debug temporal 
        <Button 
          type="button" 
          variant="outline" 
          className="mb-4"
          onClick={() => {
            console.log('🔍 DEBUG COMPLETO:');
            console.log('formData.categories:', formData.categories);
            console.log('formData.subcategories:', formData.subcategories);
            console.log('formData.products:', formData.products);
            console.log('Tipos de IDs:', {
              categories: formData.categories.map(id => ({id, type: typeof id})),
              subcategories: formData.subcategories.map(id => ({id, type: typeof id})),
              products: formData.products.map(id => ({id, type: typeof id}))
            });
            console.log('allSubcategories:', allSubcategories);
          }}
        >
          Debug Estado
        </Button>*/}

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Información del Cupón</CardTitle>
              <CardDescription>
                Actualiza los datos básicos del cupón de descuento
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
                        {formData.categories.map((categoryId: number) => {
                          if (typeof categoryId !== 'number' || isNaN(categoryId)) {
                            console.error('❌ ID de categoría inválido:', categoryId);
                            return null;
                          }
                          
                          const categoryName = getCategoryName(categoryId);
                          return (
                            <Badge key={categoryId} variant="secondary" className="flex items-center gap-1 bg-orange-100 text-orange-800">
                              {categoryName}
                              <X 
                                className="w-3 h-3 cursor-pointer hover:text-orange-600" 
                                onClick={() => removeCategory(categoryId)}
                              />
                            </Badge>
                          );
                        })}
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
                          {formData.type === 'subcategory' 
                            ? 'Selecciona las subcategorías a las que aplicará el cupón' 
                            : 'Selecciona subcategorías (opcional)'}
                        </p>
                      </div>
                      <Button type="button" variant="outline" onClick={openSubcategoryDialog}>
                        Seleccionar Subcategorías
                      </Button>
                    </div>
                    
                    {formData.subcategories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {formData.subcategories.map((subcategoryId: number) => {
                          console.log('🎯 Mostrando subcategoría ID:', subcategoryId, 'Tipo:', typeof subcategoryId);
                          
                          if (typeof subcategoryId !== 'number' || isNaN(subcategoryId)) {
                            console.error('❌ ID de subcategoría inválido:', subcategoryId);
                            return null;
                          }
                          
                          const subcategoryName = getSubcategoryName(subcategoryId);
                          const subcategory = allSubcategories.find((s: Subcategory) => s.id === subcategoryId);
                          const category = categories.find((c: Category) => c.id === subcategory?.category_id);
                          
                          return (
                            <Badge key={subcategoryId} variant="secondary" className="flex items-center gap-1 bg-blue-100 text-blue-800">
                              {subcategoryName}
                              {category && (
                                <span className="text-xs ml-1 text-blue-600">({category.name})</span>
                              )}
                              <X 
                                className="w-3 h-3 cursor-pointer hover:text-blue-600" 
                                onClick={() => removeSubcategory(subcategoryId)}
                              />
                            </Badge>
                          );
                        })}
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
                        {formData.products.map((productId: number) => {
                          if (typeof productId !== 'number' || isNaN(productId)) {
                            console.error('❌ ID de producto inválido:', productId);
                            return null;
                          }
                          
                          const productName = getProductName(productId);
                          const product = products.find((p: Product) => p.id === productId);
                          
                          return (
                            <Badge key={productId} variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 max-w-[200px]">
                              <span className="truncate">{productName}</span>
                              {product && (
                                <span className="text-xs ml-1">(${product.price})</span>
                              )}
                              <X 
                                className="w-3 h-3 cursor-pointer hover:text-green-600 flex-shrink-0" 
                                onClick={() => removeProduct(productId)}
                              />
                            </Badge>
                          );
                        })}
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
                    disabled={saving}
                    className="bg-[#C2410C] hover:bg-[#9A3412]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Guardar Cambios
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
              <AlertDialogTitle>¡Cupón Actualizado!</AlertDialogTitle>
              <AlertDialogDescription>
                El cupón ha sido actualizado exitosamente. Los cambios se han guardado correctamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleSuccessConfirm}>
                Volver a la lista
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Diálogos para seleccionar categorías, subcategorías y productos */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Seleccionar Categorías</DialogTitle>
              <DialogDescription>
                Elige las categorías a las que aplicará el cupón. {selectedCategories.length} seleccionadas
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
                          ? 'bg-orange-100 border-orange-300 text-orange-900'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleCategorySelect(category.id)}
                    >
                      <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${
                        selectedCategories.includes(category.id)
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-gray-300'
                      }`}>
                        {selectedCategories.includes(category.id) && (
                          <span className="text-xs font-bold">✓</span>
                        )}
                      </div>
                      <span className="font-medium">{category.name}</span>
                      {selectedCategories.includes(category.id) && (
                        <Badge variant="secondary" className="ml-auto">
                          Seleccionada
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <div className="flex-1 text-sm text-muted-foreground">
                {selectedCategories.length} categorías seleccionadas
              </div>
              <Button onClick={applyCategorySelection}>
                Aplicar Selección
              </Button>
              <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showSubcategoryDialog} onOpenChange={setShowSubcategoryDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Seleccionar Subcategorías</DialogTitle>
              <DialogDescription>
                Elige las subcategorías a las que aplicará el cupón. {selectedSubcategories.length} seleccionadas
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {allSubcategories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay subcategorías disponibles
                </div>
              ) : (
                <div className="grid gap-2">
                  {allSubcategories.map((subcategory: Subcategory) => {
                    const category = categories.find((c: Category) => c.id === subcategory.category_id);
                    const isSelected = selectedSubcategories.includes(subcategory.id);
                    
                    return (
                      <div
                        key={subcategory.id}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-orange-100 border-orange-300 text-orange-900'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => handleSubcategorySelect(subcategory.id)}
                      >
                        <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${
                          isSelected
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'border-gray-300'
                        }`}>
                          {isSelected && (
                            <span className="text-xs font-bold">✓</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{subcategory.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {category?.name || 'Categoría no encontrada'}
                          </div>
                        </div>
                        {isSelected && (
                          <Badge variant="secondary" className="ml-2">
                            Seleccionada
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <div className="flex-1 text-sm text-muted-foreground">
                {selectedSubcategories.length} subcategorías seleccionadas
              </div>
              <Button onClick={applySubcategorySelection}>
                Aplicar Selección
              </Button>
              <Button variant="outline" onClick={() => setShowSubcategoryDialog(false)}>
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Seleccionar Productos</DialogTitle>
              <DialogDescription>
                Elige los productos a los que aplicará el cupón. {selectedProducts.length} seleccionados
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
                          ? 'bg-orange-100 border-orange-300 text-orange-900'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleProductSelect(product.id)}
                    >
                      <div className="flex items-center flex-1">
                        <div className={`w-4 h-4 border rounded mr-3 flex items-center justify-center ${
                          selectedProducts.includes(product.id)
                            ? 'bg-orange-500 border-orange-500 text-white'
                            : 'border-gray-300'
                        }`}>
                          {selectedProducts.includes(product.id) && (
                            <span className="text-xs font-bold">✓</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium truncate block">{product.name}</span>
                          <div className="text-xs text-muted-foreground">
                            {getCategoryName(product.categoryId)} • {getSubcategoryName(product.subcategoryId)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="outline" className="flex-shrink-0">
                          ${product.price}
                        </Badge>
                        {selectedProducts.includes(product.id) && (
                          <Badge variant="secondary" className="flex-shrink-0">
                            Seleccionado
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <div className="flex-1 text-sm text-muted-foreground">
                {selectedProducts.length} productos seleccionados
              </div>
              <Button onClick={applyProductSelection}>
                Aplicar Selección
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