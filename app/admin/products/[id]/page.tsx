// app/admin/products/[id]/page.tsx - COMPLETO Y CORREGIDO
"use client"

import type React from "react"
import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useAuthStore } from "@/lib/auth-store"
import { useProductStore } from "@/lib/product-store"
import { useCategories } from "@/hooks/useCategories"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Upload, X, Loader2, Percent } from "lucide-react"
import Link from "next/link"

// Función para redimensionar imagen y mantenerla como File
const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let width = img.width
        let height = img.height

        // Calcular nuevas dimensiones manteniendo aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto del canvas"))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        
        // Convertir de nuevo a File en lugar de Data URL
        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            resolve(resizedFile)
          } else {
            reject(new Error("Error al crear el blob"))
          }
        }, file.type, 0.8) // 0.8 es la calidad
      }
      img.onerror = () => reject(new Error("Error al cargar la imagen"))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error("Error al leer el archivo"))
    reader.readAsDataURL(file)
  })
}

// Función auxiliar para convertir cualquier valor a string de forma segura
const safeToString = (value: any): string => {
  if (value === null || value === undefined) return ""
  if (typeof value === 'string') return value
  return String(value)
}

// Función auxiliar para convertir cualquier valor a número de forma segura
const safeToNumber = (value: any): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  const num = parseFloat(value)
  return isNaN(num) ? 0 : num
}

// Función para convertir precio a CLP (pesos chilenos)
const formatCLP = (price: number): string => {
  return Math.round(price).toLocaleString('es-CL')
}

// Función para calcular precio con descuento
const calculateDiscountPrice = (price: number, discountPercent: number): number => {
  return price * (1 - discountPercent / 100)
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { fetchProduct, updateProduct } = useProductStore()
  const { categories, loading: categoriesLoading } = useCategories()

  // Usar use() para desempaquetar params
  const resolvedParams = use(params)
  const productId = Number.parseInt(resolvedParams.id)

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    originalPrice: "",
    image: "",
    categoryId: "",
    subcategoryIds: [] as string[],
    age: "",
    ageMin: "",
    players: "",
    playersMin: "",
    playersMax: "",
    duration: "",
    durationMin: "",
    tags: "",
    description: "",
    stock: "",
    inStock: true,
    isOnSale: false,
    discountPercent: "0", // Nuevo campo para porcentaje de descuento
  })

  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [availableSubcategories, setAvailableSubcategories] = useState<any[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false) // Controlar visibilidad del campo descuento
  
  // Estados separados para imágenes existentes y nuevas
  const [existingAdditionalImages, setExistingAdditionalImages] = useState<string[]>([])
  const [newAdditionalImageFiles, setNewAdditionalImageFiles] = useState<File[]>([])
  const [newAdditionalImagePreviews, setNewAdditionalImagePreviews] = useState<string[]>([])
  
  // Estado para imágenes eliminadas
  const [deletedExistingImages, setDeletedExistingImages] = useState<string[]>([])

  // Calcular precios para mostrar
  const priceCLP = safeToNumber(formData.price)
  const originalPriceCLP = safeToNumber(formData.originalPrice)
  const discountPercent = safeToNumber(formData.discountPercent)
  const finalPriceCLP = discountPercent > 0 
    ? calculateDiscountPrice(priceCLP, discountPercent)
    : priceCLP

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push("/")
    }
  }, [isAuthenticated, user, router])

  useEffect(() => {
    const loadProduct = async () => {
      if (productId) {
        setLoading(true)
        try {
          console.log(`🔄 Loading product ${productId}...`)
          const productData = await fetchProduct(productId)
          console.log('📦 Product data received:', productData)
          
          if (productData) {
            setProduct(productData)
            console.log('✅ Product data loaded successfully:', {
              name: productData.name,
              categoryId: productData.categoryId,
              subcategoryIds: productData.subcategoryIds,
              image: productData.image,
              additionalImages: productData.additionalImages?.length
            })
            
            // Obtener todas las subcategorías (principal + tags)
            let allSubcategoryIds: string[] = []
            
            if (productData.subcategoryIds && Array.isArray(productData.subcategoryIds)) {
              // Si el backend ya proporciona todas las subcategorías
              allSubcategoryIds = productData.subcategoryIds.map(id => safeToString(id))
            } else if (productData.subcategories && Array.isArray(productData.subcategories)) {
              // Usar subcategories array
              allSubcategoryIds = productData.subcategories.map((sub: any) => safeToString(sub.id))
            } else {
              // Fallback: usar subcategoryId principal
              allSubcategoryIds = productData.subcategoryId ? [safeToString(productData.subcategoryId)] : []
            }

            console.log('🎯 Subcategory IDs to load:', allSubcategoryIds)

            // Calcular porcentaje de descuento si hay precio original
            let discountPercent = "0"
            if (productData.originalPrice && productData.price) {
              const original = safeToNumber(productData.originalPrice)
              const current = safeToNumber(productData.price)
              if (original > current) {
                discountPercent = Math.round(((original - current) / original) * 100).toString()
              }
            }

            // Usar safeToString para convertir todos los valores de forma segura
            setFormData({
              name: safeToString(productData.name),
              price: safeToString(productData.price),
              originalPrice: safeToString(productData.originalPrice),
              image: safeToString(productData.image),
              categoryId: safeToString(productData.categoryId),
              subcategoryIds: allSubcategoryIds,
              age: safeToString(productData.age),
              ageMin: safeToString(productData.ageMin),
              players: safeToString(productData.players),
              playersMin: safeToString(productData.playersMin),
              playersMax: safeToString(productData.playersMax),
              duration: safeToString(productData.duration),
              durationMin: safeToString(productData.durationMin),
              tags: Array.isArray(productData.tags) 
                ? productData.tags.map((tag: any) => safeToString(tag.id)).join(",")
                : "",
              description: safeToString(productData.description),
              stock: safeToString(productData.stock),
              inStock: Boolean(productData.inStock),
              isOnSale: Boolean(productData.isOnSale),
              discountPercent: discountPercent
            })
            setSelectedCategory(safeToString(productData.categoryId))
            setImagePreview(safeToString(productData.image))
            setShowDiscount(discountPercent !== "0")
            
            // Cargar imágenes adicionales existentes
            if (productData.additionalImages && Array.isArray(productData.additionalImages)) {
              console.log('🖼️ Loading additional images:', productData.additionalImages)
              setExistingAdditionalImages(productData.additionalImages)
            }
          } else {
            console.error('❌ No product data received')
          }
        } catch (error) {
          console.error('❌ Error loading product:', error)
        } finally {
          setLoading(false)
        }
      }
    }

    loadProduct()
  }, [productId, fetchProduct])

  useEffect(() => {
    if (selectedCategory && categories.length > 0) {
      const category = categories.find((c) => safeToString(c.id) === selectedCategory)
      setAvailableSubcategories(category?.subcategories || [])
    }
  }, [selectedCategory, categories])

  // Función para manejar selección/deselección de subcategorías
  const handleSubcategoryToggle = (subcategoryId: string) => {
    setFormData(prev => {
      const currentIds = prev.subcategoryIds
      const isSelected = currentIds.includes(subcategoryId)
      
      if (isSelected) {
        // Remover si ya está seleccionado
        return {
          ...prev,
          subcategoryIds: currentIds.filter(id => id !== subcategoryId)
        }
      } else {
        // Agregar si no está seleccionado
        return {
          ...prev,
          subcategoryIds: [...currentIds, subcategoryId]
        }
      }
    })
  }

  // Función para verificar si una subcategoría está seleccionada
  const isSubcategorySelected = (subcategoryId: string) => {
    return formData.subcategoryIds.includes(subcategoryId)
  }

  // Función para manejar cambios en el precio y calcular automáticamente el precio con descuento
  const handlePriceChange = (field: 'price' | 'originalPrice' | 'discountPercent', value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }
      
      // Si se cambia el porcentaje de descuento, calcular nuevo precio
      if (field === 'discountPercent' && newData.originalPrice) {
        const originalPrice = safeToNumber(newData.originalPrice)
        const discount = safeToNumber(value)
        if (discount > 0) {
          newData.price = calculateDiscountPrice(originalPrice, discount).toFixed(0)
          newData.isOnSale = true
        }
      }
      
      // Si se cambia el precio original y hay descuento, recalcular precio
      if (field === 'originalPrice' && newData.discountPercent !== "0") {
        const originalPrice = safeToNumber(value)
        const discount = safeToNumber(newData.discountPercent)
        if (discount > 0) {
          newData.price = calculateDiscountPrice(originalPrice, discount).toFixed(0)
          newData.isOnSale = true
        }
      }
      
      return newData
    })
  }

  // Función para activar/desactivar oferta
  const toggleSale = () => {
    if (!formData.isOnSale) {
      // Activar oferta - copiar precio actual a precio original y aplicar descuento
      setFormData(prev => ({
        ...prev,
        isOnSale: true,
        originalPrice: prev.price,
        discountPercent: "10" // Descuento por defecto del 10%
      }))
      setShowDiscount(true)
    } else {
      // Desactivar oferta - mantener el precio actual y limpiar descuento
      setFormData(prev => ({
        ...prev,
        isOnSale: false,
        originalPrice: "",
        discountPercent: "0"
      }))
      setShowDiscount(false)
    }
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">No autorizado</div>
        </main>
        <Footer />
      </div>
    )
  }

  if (loading || categoriesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Cargando...</span>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Producto no encontrado</p>
        </main>
        <Footer />
      </div>
    )
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg")) {
      setIsUploading(true)
      try {
        // Redimensionar imagen y mantener como File
        const resizedFile = await resizeImage(file, 1024, 1024)
        
        // Crear preview temporal
        const previewUrl = URL.createObjectURL(resizedFile)
        
        setImageFile(resizedFile)
        setImagePreview(previewUrl)
        
        console.log('✅ Imagen principal procesada:', {
          nombre: resizedFile.name,
          tamaño: resizedFile.size,
          tipo: resizedFile.type
        })
        
      } catch (error) {
        console.error("Error procesando imagen:", error)
        alert("Error al procesar la imagen. Por favor intenta con otra imagen.")
      } finally {
        setIsUploading(false)
      }
    } else {
      alert("Por favor selecciona una imagen PNG, JPG o JPEG")
    }
  }

  const handleAdditionalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg")) {
      setIsUploading(true)
      try {
        const resizedFile = await resizeImage(file, 1024, 1024)
        const previewUrl = URL.createObjectURL(resizedFile)
        
        setNewAdditionalImageFiles([...newAdditionalImageFiles, resizedFile])
        setNewAdditionalImagePreviews([...newAdditionalImagePreviews, previewUrl])
        
        console.log('✅ Imagen adicional procesada:', {
          número: newAdditionalImageFiles.length + 1,
          nombre: resizedFile.name,
          tamaño: resizedFile.size
        })
        
      } catch (error) {
        console.error("Error procesando imagen adicional:", error)
        alert("Error al procesar la imagen. Por favor intenta con otra imagen.")
      } finally {
        setIsUploading(false)
      }
    } else {
      alert("Por favor selecciona una imagen PNG, JPG o JPEG")
    }
  }

  const removeExistingAdditionalImage = (index: number) => {
    console.log(`🗑️ Removing existing additional image at index ${index}`)
    const imageToDelete = existingAdditionalImages[index]
    
    // Agregar a la lista de imágenes eliminadas
    setDeletedExistingImages([...deletedExistingImages, imageToDelete])
    
    // Remover de las imágenes existentes mostradas
    setExistingAdditionalImages(existingAdditionalImages.filter((_, i) => i !== index))
  }

  const removeNewAdditionalImage = (index: number) => {
    console.log(`🗑️ Removing new additional image at index ${index}`)
    // Liberar URL de objeto
    URL.revokeObjectURL(newAdditionalImagePreviews[index])
    
    setNewAdditionalImageFiles(newAdditionalImageFiles.filter((_, i) => i !== index))
    setNewAdditionalImagePreviews(newAdditionalImagePreviews.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUploading(true)

    // Validar que se haya seleccionado al menos una subcategoría
    if (formData.subcategoryIds.length === 0) {
      alert("Por favor selecciona al menos una subcategoría")
      setIsUploading(false)
      return
    }

    try {
      const formDataToSend = new FormData()
      
      // Agregar campos básicos usando safeToString para asegurar que sean strings
      formDataToSend.append('name', safeToString(formData.name))
      formDataToSend.append('description', safeToString(formData.description))
      formDataToSend.append('price', safeToString(formData.price))
      if (formData.originalPrice) {
        formDataToSend.append('originalPrice', safeToString(formData.originalPrice))
      }
      formDataToSend.append('categoryId', safeToString(formData.categoryId))
      
      // Enviar TODAS las subcategorías seleccionadas
      formData.subcategoryIds.forEach(id => {
        formDataToSend.append('subcategoryIds', safeToString(id))
      })
      
      formDataToSend.append('ageDisplay', safeToString(formData.age))
      formDataToSend.append('ageMin', safeToString(formData.ageMin))
      formDataToSend.append('playersDisplay', safeToString(formData.players))
      formDataToSend.append('playersMin', safeToString(formData.playersMin))
      formDataToSend.append('playersMax', safeToString(formData.playersMax))
      formDataToSend.append('durationDisplay', safeToString(formData.duration))
      formDataToSend.append('durationMin', safeToString(formData.durationMin))
      formDataToSend.append('stock', safeToString(formData.stock))
      formDataToSend.append('inStock', safeToString(formData.inStock))
      formDataToSend.append('isOnSale', safeToString(formData.isOnSale))
      formDataToSend.append('tags', safeToString(formData.tags))

      // Agregar información de imágenes eliminadas
      deletedExistingImages.forEach(imageUrl => {
        formDataToSend.append('deletedImages', imageUrl)
      })

      // Agregar imagen principal si es nueva
      if (imageFile) {
        console.log('📤 Enviando NUEVA imagen principal:', imageFile.name, imageFile.size)
        formDataToSend.append('mainImage', imageFile)
      } else {
        console.log('📤 Usando imagen existente:', formData.image)
        formDataToSend.append('image', safeToString(formData.image))
      }

      // Agregar SOLO las nuevas imágenes adicionales
      console.log(`📤 Enviando ${newAdditionalImageFiles.length} imágenes adicionales NUEVAS`)
      newAdditionalImageFiles.forEach((file, index) => {
        console.log(`📤 Nueva imagen adicional ${index + 1}:`, file.name, file.size)
        formDataToSend.append('additionalImages', file)
      })

      console.log('🔄 Actualizando producto...')
      console.log('📊 Resumen de datos:', {
        subcategoríasSeleccionadas: formData.subcategoryIds.length,
        ids: formData.subcategoryIds,
        subcategoríaPrincipal: formData.subcategoryIds[0],
        imagenPrincipal: imageFile ? 'NUEVA' : 'EXISTENTE',
        imagenesAdicionalesExistentes: existingAdditionalImages.length,
        imagenesAdicionalesNuevas: newAdditionalImageFiles.length,
        imagenesEliminadas: deletedExistingImages.length,
        enOferta: formData.isOnSale,
        descuento: formData.discountPercent + '%'
      })

      await updateProduct(productId, formDataToSend)
      
      // Limpiar URLs de objeto
      if (imageFile) {
        URL.revokeObjectURL(imagePreview)
      }
      newAdditionalImagePreviews.forEach(url => URL.revokeObjectURL(url))
      
      router.push("/admin/products")
    } catch (error) {
      console.error("Error updating product:", error)
      alert("Error al actualizar el producto")
    } finally {
      setIsUploading(false)
    }
  }

  // Todas las imágenes para mostrar en la interfaz
  const allAdditionalImagePreviews = [
    ...existingAdditionalImages.map((img, index) => ({ 
      type: 'existing' as const, 
      url: img, 
      index 
    })),
    ...newAdditionalImagePreviews.map((img, index) => ({ 
      type: 'new' as const, 
      url: img, 
      index 
    }))
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Link href="/admin/products">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Productos
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Editar Producto</CardTitle>
            <CardDescription>Modifica la información del producto</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Nombre del Producto *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Imagen Principal del Producto</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="imageFile" className="text-sm text-muted-foreground">
                        Subir Archivo (PNG, JPG o JPEG - se redimensionará a 1024x1024)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="imageFile"
                          type="file"
                          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                          onChange={handleImageUpload}
                          className="cursor-pointer"
                          disabled={isUploading}
                        />
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      </div>
                      {isUploading && <p className="text-sm text-muted-foreground">Procesando imagen...</p>}
                      {imageFile && (
                        <p className="text-sm text-green-600">
                          ✅ Nueva imagen lista: {imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imageUrl" className="text-sm text-muted-foreground">
                        O ingresar URL de imagen web
                      </Label>
                      <Input
                        id="imageUrl"
                        value={formData.image}
                        onChange={(e) => {
                          setFormData({ ...formData, image: e.target.value })
                          setImagePreview(e.target.value)
                          setImageFile(null)
                        }}
                        placeholder="https://ejemplo.com/imagen.jpg"
                      />
                    </div>
                  </div>
                  {imagePreview && (
                    <div className="mt-2">
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="Preview"
                        className="w-full md:w-48 h-48 object-cover rounded-lg border"
                        onError={(e) => {
                          // Si falla la carga de la imagen, mostrar placeholder
                          const target = e.target as HTMLImageElement
                          target.src = "/placeholder.svg"
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Vista previa de la imagen
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Imágenes Adicionales</Label>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="additionalImageFile" className="text-sm text-muted-foreground">
                        Agregar más imágenes (PNG, JPG o JPEG)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="additionalImageFile"
                          type="file"
                          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                          onChange={handleAdditionalImageUpload}
                          className="cursor-pointer"
                          disabled={isUploading}
                        />
                        <Upload className="w-4 h-4 text-muted-foreground" />
                      </div>
                      {isUploading && <p className="text-sm text-muted-foreground">Procesando imagen...</p>}
                    </div>
                    
                    {allAdditionalImagePreviews.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Imágenes adicionales ({allAdditionalImagePreviews.length}):
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {allAdditionalImagePreviews.map(({ type, url, index }) => (
                            <div key={`${type}-${index}`} className="relative group">
                              <img
                                src={url || "/placeholder.svg"}
                                alt={`Additional ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = "/placeholder.svg"
                                }}
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  if (type === 'existing') {
                                    removeExistingAdditionalImage(index)
                                  } else {
                                    removeNewAdditionalImage(index)
                                  }
                                }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                {type === 'existing' ? 'Existente' : 'Nueva'}
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          💡 Las imágenes marcadas como "Existente" se eliminarán permanentemente al guardar. 
                          Solo se mantendrán las imágenes que no hayas eliminado y las nuevas que agregues.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoría *</Label>
                  <Select
                    required
                    value={formData.categoryId}
                    onValueChange={(value) => {
                      setFormData({ ...formData, categoryId: value, subcategoryIds: [] })
                      setSelectedCategory(value)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={safeToString(cat.id)}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Subcategorías *</Label>
                  <div className="border rounded-lg p-4 bg-muted/20">
                    {!selectedCategory ? (
                      <p className="text-sm text-muted-foreground">
                        Primero selecciona una categoría
                      </p>
                    ) : availableSubcategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No hay subcategorías disponibles para esta categoría
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {availableSubcategories.map((subcat) => (
                          <div key={subcat.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`subcat-${subcat.id}`}
                              checked={isSubcategorySelected(safeToString(subcat.id))}
                              onCheckedChange={() => handleSubcategoryToggle(safeToString(subcat.id))}
                            />
                            <Label 
                              htmlFor={`subcat-${subcat.id}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {subcat.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.subcategoryIds.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      ✅ {formData.subcategoryIds.length} subcategoría(s) seleccionada(s)
                      {formData.subcategoryIds.length > 1 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (La primera será la principal)
                        </span>
                      )}
                    </p>
                  )}
                  {formData.subcategoryIds.length === 0 && selectedCategory && (
                    <p className="text-sm text-red-600 mt-2">
                      ⚠️ Debes seleccionar al menos una subcategoría
                    </p>
                  )}
                </div>

                {/* Sección de Precios y Ofertas */}
                <div className="space-y-4 md:col-span-2 border rounded-lg p-4 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <Label className="text-lg font-semibold">Precios (CLP)</Label>
                    <Button
                      type="button"
                      variant={formData.isOnSale ? "default" : "outline"}
                      onClick={toggleSale}
                      className="flex items-center gap-2"
                    >
                      <Percent className="w-4 h-4" />
                      {formData.isOnSale ? "Oferta Activa" : "Agregar Oferta"}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="originalPrice">
                        {formData.isOnSale ? "Precio Original (CLP)" : "Precio (CLP) *"}
                      </Label>
                      <Input
                        id="originalPrice"
                        type="number"
                        required
                        value={formData.originalPrice || formData.price}
                        onChange={(e) => handlePriceChange(formData.isOnSale ? 'originalPrice' : 'price', e.target.value)}
                        placeholder="20000"
                      />
                      {formData.originalPrice && (
                        <p className="text-sm text-muted-foreground">
                          Precio original: ${formatCLP(safeToNumber(formData.originalPrice))} CLP
                        </p>
                      )}
                    </div>

                    {showDiscount && (
                      <div className="space-y-2">
                        <Label htmlFor="discountPercent">Porcentaje de Descuento *</Label>
                        <Input
                          id="discountPercent"
                          type="number"
                          min="1"
                          max="99"
                          value={formData.discountPercent}
                          onChange={(e) => handlePriceChange('discountPercent', e.target.value)}
                          placeholder="20"
                        />
                        <p className="text-sm text-muted-foreground">
                          Descuento: {formData.discountPercent}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Resumen de precios */}
                  {formData.isOnSale && formData.originalPrice && formData.discountPercent !== "0" && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                      <h4 className="font-semibold text-green-800 mb-2">Resumen de Oferta</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Precio Original:</span>
                          <span className="line-through text-gray-500">
                            ${formatCLP(safeToNumber(formData.originalPrice))} CLP
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Descuento:</span>
                          <span className="text-red-600">-{formData.discountPercent}%</span>
                        </div>
                        <div className="flex justify-between font-bold text-green-800">
                          <span>Precio Final:</span>
                          <span>${formatCLP(finalPriceCLP)} CLP</span>
                        </div>
                        <div className="flex justify-between text-xs text-green-600">
                          <span>Ahorro:</span>
                          <span>${formatCLP(safeToNumber(formData.originalPrice) - finalPriceCLP)} CLP</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock">Stock *</Label>
                  <Input
                    id="stock"
                    type="number"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">Edad (ej: 8+) *</Label>
                  <Input
                    id="age"
                    required
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ageMin">Edad Mínima (número) *</Label>
                  <Input
                    id="ageMin"
                    type="number"
                    required
                    value={formData.ageMin}
                    onChange={(e) => setFormData({ ...formData, ageMin: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="players">Jugadores (ej: 2-5) *</Label>
                  <Input
                    id="players"
                    required
                    value={formData.players}
                    onChange={(e) => setFormData({ ...formData, players: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="playersMin">Jugadores Mínimo *</Label>
                  <Input
                    id="playersMin"
                    type="number"
                    required
                    value={formData.playersMin}
                    onChange={(e) => setFormData({ ...formData, playersMin: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="playersMax">Jugadores Máximo *</Label>
                  <Input
                    id="playersMax"
                    type="number"
                    required
                    value={formData.playersMax}
                    onChange={(e) => setFormData({ ...formData, playersMax: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duración (ej: 15 min) *</Label>
                  <Input
                    id="duration"
                    required
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="durationMin">Duración Mínima (minutos) *</Label>
                  <Input
                    id="durationMin"
                    type="number"
                    required
                    value={formData.durationMin}
                    onChange={(e) => setFormData({ ...formData, durationMin: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Descripción *</Label>
                  <Textarea
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button type="submit" className="w-full sm:w-auto" disabled={isUploading}>
                  {isUploading ? "Guardando..." : "Guardar Cambios"}
                </Button>
                <Link href="/admin/products" className="w-full sm:w-auto">
                  <Button type="button" variant="outline" className="w-full bg-transparent">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}