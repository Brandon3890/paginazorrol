// app/admin/products/[id]/page.tsx - COMPLETO
"use client"

import React, { useEffect, useState, use, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useAuthStore } from "@/lib/auth-store"
import { useProductStore } from "@/lib/product-store"
import { useCategories } from "@/hooks/useCategories"
import { useProducts } from "@/hooks/useProducts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ArrowLeft, Upload, X, Loader2, Percent, Youtube, Search, ExternalLink,
  Rocket, Sparkles, Package, AlertCircle, Tag
} from "lucide-react"
import Link from "next/link"

// Función para redimensionar imagen
const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener el contexto del canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(resizedFile);
          } else {
            reject(new Error('Error al crear el blob'));
          }
        }, file.type, 0.8);
      };
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
};

// Función mejorada para extraer ID de YouTube
const extractYoutubeId = (url: string): string | null => {
  if (!url) return null;
  
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&]+)/,
    /(?:youtu\.be\/)([^?]+)/,
    /(?:youtube\.com\/embed\/)([^?]+)/,
    /(?:youtube\.com\/v\/)([^?]+)/,
    /(?:youtube\.com\/shorts\/)([^?]+)/,
    /(?:youtube\.com\/watch\?.*&v=)([^&]+)/,
    /(?:m\.youtube\.com\/watch\?v=)([^&]+)/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  
  if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
    return url;
  }
  
  return null
}

// Funciones auxiliares
const formatCLP = (price: number): string => Math.round(price).toLocaleString('es-CL');
const calculateDiscountPrice = (price: number, discountPercent: number): number => price * (1 - discountPercent / 100);
const safeToString = (value: any): string => value === null || value === undefined ? "" : String(value);
const safeToNumber = (value: any): number => {
  if (value === null || value === undefined) return 0
  const num = parseFloat(String(value))
  return isNaN(num) ? 0 : num
}

// Componente memoizado para subcategorías
const SubcategoryCheckbox = React.memo(({ 
  subcat, 
  isSelected, 
  onToggle 
}: { 
  subcat: any
  isSelected: boolean
  onToggle: (id: string) => void
}) => {
  const id = safeToString(subcat.id);
  
  return (
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        id={`subcat-${id}`}
        checked={isSelected}
        onChange={() => onToggle(id)}
        className="h-4 w-4 rounded border-gray-300 text-[#C2410C] focus:ring-[#C2410C]"
      />
      <label 
        htmlFor={`subcat-${id}`}
        className="text-sm cursor-pointer select-none"
      >
        {subcat.name}
      </label>
    </div>
  );
});

SubcategoryCheckbox.displayName = 'SubcategoryCheckbox';

// Componente memoizado para productos recomendados
const RecommendedProductCard = React.memo(({ 
  product, 
  isSelected, 
  onToggle 
}: { 
  product: any
  isSelected: boolean
  onToggle: (id: number) => void
}) => {
  return (
    <div
      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
        isSelected ? 'bg-green-50 border-green-500' : 'hover:bg-muted/50'
      }`}
      onClick={() => onToggle(product.id)}
    >
      <div className="flex items-start gap-3">
        <img
          src={product.image || "/placeholder.svg"}
          alt={product.name}
          className="w-16 h-16 object-cover rounded"
        />
        <div className="flex-1">
          <p className="font-medium text-sm line-clamp-2">{product.name}</p>
          <p className="text-sm text-muted-foreground">
            ${formatCLP(product.price)} CLP
          </p>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(product.id)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#C2410C] focus:ring-[#C2410C]"
          />
        </div>
      </div>
    </div>
  );
});

RecommendedProductCard.displayName = 'RecommendedProductCard';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { fetchProduct, updateProduct } = useProductStore()
  const { categories, loading: categoriesLoading } = useCategories()
  const { products: allProducts, loading: productsLoading } = useProducts({ perPage: 100 })

  const resolvedParams = use(params)
  const productId = Number.parseInt(resolvedParams.id)

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState<string>("")
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    originalPrice: "",
    image: "",
    youtubeVideoId: "",
    categoryId: "",
    subcategoryIds: [] as string[],
    age: "",
    ageMin: "",
    players: "",
    playersMin: "",
    playersMax: "",
    duration: "",
    durationMin: "",
    description: "",
    stock: "",
    inStock: true,
    isOnSale: false,
    discountPercent: "10",
    recommendedProducts: [] as number[],
    brand: "Devir",
    genre: "Estrategia, Familiar",
  })

  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [youtubeError, setYoutubeError] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  const [existingAdditionalImages, setExistingAdditionalImages] = useState<string[]>([])
  const [newAdditionalImageFiles, setNewAdditionalImageFiles] = useState<File[]>([])
  const [newAdditionalImagePreviews, setNewAdditionalImagePreviews] = useState<string[]>([])
  const [deletedExistingImages, setDeletedExistingImages] = useState<string[]>([])

  const availableSubcategories = useMemo(() => {
    if (!selectedCategory || categories.length === 0) return []
    const category = categories.find((c) => safeToString(c.id) === selectedCategory)
    return category?.subcategories || []
  }, [selectedCategory, categories])

  const totalImages = (imageFile ? 1 : 0) + existingAdditionalImages.length + newAdditionalImageFiles.length
  const MAX_TOTAL_IMAGES = 6

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push("/")
    }
  }, [isAuthenticated, user, router])

  // Función para extraer tag del producto
  const extractProductTag = (productData: any): string => {
    if (productData.tags) {
      if (typeof productData.tags === 'string') {
        return productData.tags // puede ser string vacío ""
      }
      if (Array.isArray(productData.tags) && productData.tags.length > 0) {
        const firstTag = productData.tags[0]
        if (typeof firstTag === 'string') return firstTag
        if (firstTag && typeof firstTag === 'object') return firstTag.name || firstTag.slug || ""
      }
    }
    return "" 
  }

  // Cargar producto
  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) return
      
      setLoading(true)
      try {
        const productData = await fetchProduct(productId)
        
        if (productData) {
          setProduct(productData)
          
          let allSubcategoryIds: string[] = []
          if (productData.subcategoryIds && Array.isArray(productData.subcategoryIds)) {
            allSubcategoryIds = productData.subcategoryIds.map(id => safeToString(id))
          } else if (productData.subcategories && Array.isArray(productData.subcategories)) {
            allSubcategoryIds = productData.subcategories.map((sub: any) => safeToString(sub.id))
          }

          const categoryId = safeToString(productData.categoryId) || "";
          const validSubcategoryIds = allSubcategoryIds.filter(id => {
            const category = categories.find(c => safeToString(c.id) === categoryId);
            return category?.subcategories?.some((s: any) => safeToString(s.id) === id);
          });

          const productTag = extractProductTag(productData)
          setSelectedTag(productTag)

          let price = safeToString(productData.price)
          let originalPrice = ""
          let discountPercent = "10"
          let isOnSale = false
          let stock = safeToString(productData.stock)
          let inStock = Boolean(productData.inStock)

          if (productTag === "descuento") {
            if (productData.originalPrice && safeToNumber(productData.originalPrice) > safeToNumber(productData.price)) {
              const original = safeToNumber(productData.originalPrice)
              const current = safeToNumber(productData.price)
              originalPrice = original.toString()
              price = current.toString()
              discountPercent = Math.round(((original - current) / original) * 100).toString()
              isOnSale = true
            } else {
              originalPrice = ""
              discountPercent = "10"
              isOnSale = true
            }
          } else if (productTag === "agotado") {
            stock = "0"
            inStock = false
          } else if (productTag === "preventa" || productTag === "novedad") {
            originalPrice = ""
            discountPercent = "0"
            isOnSale = false
          } else {
            originalPrice = ""
            discountPercent = "0"
            isOnSale = false
          }

          setFormData({
            name: safeToString(productData.name),
            price: price,
            originalPrice: originalPrice,
            image: safeToString(productData.image),
            youtubeVideoId: productData.youtubeVideoId || '',
            categoryId: categoryId,
            subcategoryIds: validSubcategoryIds,
            age: safeToString(productData.age),
            ageMin: safeToString(productData.ageMin),
            players: safeToString(productData.players),
            playersMin: safeToString(productData.playersMin),
            playersMax: safeToString(productData.playersMax),
            duration: safeToString(productData.duration),
            durationMin: safeToString(productData.durationMin),
            description: safeToString(productData.description),
            stock: stock,
            inStock: inStock,
            isOnSale: isOnSale,
            discountPercent: discountPercent,
            recommendedProducts: productData.recommendedProducts || [],
            brand: productData.brand || "Devir",
            genre: productData.genre || "Estrategia, Familiar",
          })
          
          setSelectedCategory(categoryId)
          setImagePreview(safeToString(productData.image))
          setYoutubeUrl(productData.youtubeVideoId || '')
          
          if (productData.additionalImages && Array.isArray(productData.additionalImages)) {
            setExistingAdditionalImages(productData.additionalImages)
          }
        }
      } catch (error) {
        console.error('Error loading product:', error)
      } finally {
        setLoading(false)
      }
    }

    if (categories.length > 0) {
      loadProduct()
    }
  }, [productId, fetchProduct, categories])

  const handleTagSelect = (tagValue: string) => {
    if (selectedTag === tagValue) {
      setSelectedTag("")
      setFormData(prev => ({ 
        ...prev, 
        originalPrice: "",
        discountPercent: "0",
        isOnSale: false,
        stock: prev.stock === "0" ? "1" : prev.stock,
        inStock: prev.stock !== "0"
      }))
    } else {
      setSelectedTag(tagValue)
      
      if (tagValue === "") {
        // Normal - sin etiqueta
        setFormData(prev => ({ 
          ...prev, 
          originalPrice: "",
          discountPercent: "0",
          isOnSale: false,
          stock: prev.stock === "0" ? "1" : prev.stock,
          inStock: true
        }))
      } else if (tagValue === "agotado") {
        setFormData(prev => ({ 
          ...prev, 
          stock: "0",
          inStock: false,
          originalPrice: "",
          discountPercent: "0",
          isOnSale: false
        }))
      } else if (tagValue === "descuento") {
        setFormData(prev => ({ 
          ...prev, 
          discountPercent: prev.discountPercent !== "0" ? prev.discountPercent : "10",
          isOnSale: true,
          stock: prev.stock === "0" ? "1" : prev.stock,
          inStock: true
        }))
      } else if (tagValue === "preventa" || tagValue === "novedad") {
        setFormData(prev => ({ 
          ...prev, 
          originalPrice: "",
          discountPercent: "0",
          isOnSale: false,
          stock: prev.stock === "0" ? "1" : prev.stock,
          inStock: true
        }))
      }
    }
  }

  const handleSubcategoryToggle = useCallback((subcategoryId: string) => {
    setFormData(prev => ({
      ...prev,
      subcategoryIds: prev.subcategoryIds.includes(subcategoryId)
        ? prev.subcategoryIds.filter(id => id !== subcategoryId)
        : [...prev.subcategoryIds, subcategoryId]
    }));
  }, []);

  const handleDiscountChange = (type: 'originalPrice' | 'discountPercent' | 'price', value: string) => {
    if (selectedTag !== "descuento") return

    setFormData(prev => {
      const newData = { ...prev }
      
      if (type === 'originalPrice') {
        newData.originalPrice = value
        const original = safeToNumber(value)
        const discount = safeToNumber(prev.discountPercent)
        if (original > 0 && discount > 0) {
          newData.price = calculateDiscountPrice(original, discount).toFixed(0)
          newData.isOnSale = true
        }
      } else if (type === 'discountPercent') {
        newData.discountPercent = value
        const original = safeToNumber(prev.originalPrice)
        const discount = safeToNumber(value)
        if (original > 0 && discount > 0) {
          newData.price = calculateDiscountPrice(original, discount).toFixed(0)
          newData.isOnSale = true
        }
      } else if (type === 'price') {
        newData.price = value
        const original = safeToNumber(prev.originalPrice)
        const current = safeToNumber(value)
        if (original > 0 && current > 0 && original > current) {
          const discount = Math.round(((original - current) / original) * 100)
          newData.discountPercent = discount.toString()
          newData.isOnSale = true
        }
      }
      
      return newData
    })
  }

  const handleYoutubeUrlChange = useCallback((url: string) => {
    setYoutubeUrl(url)
    setYoutubeError(false)
    const videoId = extractYoutubeId(url)
    if (videoId) {
      setFormData(prev => ({ ...prev, youtubeVideoId: videoId }))
    } else {
      setFormData(prev => ({ ...prev, youtubeVideoId: url }))
    }
  }, [])

  const handleRecommendedProductToggle = useCallback((productId: number) => {
    setFormData(prev => ({
      ...prev,
      recommendedProducts: prev.recommendedProducts.includes(productId)
        ? prev.recommendedProducts.filter(id => id !== productId)
        : [...prev.recommendedProducts, productId]
    }))
  }, [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (totalImages >= MAX_TOTAL_IMAGES) {
      alert(`Maximo ${MAX_TOTAL_IMAGES} imagenes en total`)
      return
    }
    if (file && (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg")) {
      setIsUploading(true)
      try {
        const resizedFile = await resizeImage(file, 1024, 1024)
        const previewUrl = URL.createObjectURL(resizedFile)
        setImageFile(resizedFile)
        setImagePreview(previewUrl)
      } catch (error) {
        console.error("Error procesando imagen:", error)
        alert("Error al procesar la imagen")
      } finally {
        setIsUploading(false)
      }
    } else {
      alert("Por favor selecciona una imagen PNG, JPG o JPEG")
    }
  }

  const removeMainImage = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview("")
    setFormData(prev => ({ ...prev, image: "" }))
  }, [imagePreview])

  const handleAdditionalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (totalImages >= MAX_TOTAL_IMAGES) {
      alert(`Maximo ${MAX_TOTAL_IMAGES} imagenes en total`)
      return
    }
    if (file && (file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/jpg")) {
      setIsUploading(true)
      try {
        const resizedFile = await resizeImage(file, 1024, 1024)
        const previewUrl = URL.createObjectURL(resizedFile)
        setNewAdditionalImageFiles(prev => [...prev, resizedFile])
        setNewAdditionalImagePreviews(prev => [...prev, previewUrl])
      } catch (error) {
        console.error("Error procesando imagen adicional:", error)
        alert("Error al procesar la imagen")
      } finally {
        setIsUploading(false)
      }
    } else {
      alert("Por favor selecciona una imagen PNG, JPG o JPEG")
    }
  }

  const removeExistingAdditionalImage = useCallback((index: number) => {
    setDeletedExistingImages(prev => [...prev, existingAdditionalImages[index]])
    setExistingAdditionalImages(prev => prev.filter((_, i) => i !== index))
  }, [existingAdditionalImages])

  const removeNewAdditionalImage = useCallback((index: number) => {
    URL.revokeObjectURL(newAdditionalImagePreviews[index])
    setNewAdditionalImageFiles(prev => prev.filter((_, i) => i !== index))
    setNewAdditionalImagePreviews(prev => prev.filter((_, i) => i !== index))
  }, [newAdditionalImagePreviews])

  const filteredProducts = useMemo(() => {
    return allProducts.filter((product: any) => 
      product.id !== productId && 
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [allProducts, productId, searchTerm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.subcategoryIds.length === 0) {
      alert("Por favor selecciona al menos una subcategoria")
      return
    }

    setIsUploading(true)
    try {
      const formDataToSend = new FormData()
      
      formDataToSend.append('name', safeToString(formData.name))
      formDataToSend.append('description', safeToString(formData.description))
      formDataToSend.append('price', safeToString(formData.price))
      formDataToSend.append('categoryId', safeToString(formData.categoryId))
      formDataToSend.append('youtubeVideoId', safeToString(formData.youtubeVideoId))
      formDataToSend.append('brand', safeToString(formData.brand))
      formDataToSend.append('genre', safeToString(formData.genre))
      formDataToSend.append('tags', selectedTag)
      
      if (selectedTag === "descuento" && formData.originalPrice) {
        formDataToSend.append('originalPrice', safeToString(formData.originalPrice))
        formDataToSend.append('isOnSale', 'true')
      } else {
        formDataToSend.append('isOnSale', 'false')
      }
      
      formData.subcategoryIds.forEach(id => formDataToSend.append('subcategoryIds', safeToString(id)))
      formData.recommendedProducts.forEach(id => formDataToSend.append('recommendedProducts', id.toString()))
      
      formDataToSend.append('ageDisplay', safeToString(formData.age))
      formDataToSend.append('ageMin', safeToString(formData.ageMin))
      formDataToSend.append('playersDisplay', safeToString(formData.players))
      formDataToSend.append('playersMin', safeToString(formData.playersMin))
      formDataToSend.append('playersMax', safeToString(formData.playersMax))
      formDataToSend.append('durationDisplay', safeToString(formData.duration))
      formDataToSend.append('durationMin', safeToString(formData.durationMin))
      formDataToSend.append('stock', safeToString(formData.stock))
      formDataToSend.append('inStock', String(formData.inStock))

      deletedExistingImages.forEach(imageUrl => formDataToSend.append('deletedImages', imageUrl))

      if (imageFile) {
        formDataToSend.append('mainImage', imageFile)
      } else {
        formDataToSend.append('image', safeToString(formData.image))
      }

      newAdditionalImageFiles.forEach(file => formDataToSend.append('additionalImages', file))

      await updateProduct(productId, formDataToSend)
      
      if (imageFile) URL.revokeObjectURL(imagePreview)
      newAdditionalImagePreviews.forEach(url => URL.revokeObjectURL(url))
      
      router.push("/admin/products")
    } catch (error) {
      console.error("Error updating product:", error)
      alert("Error al actualizar el producto")
    } finally {
      setIsUploading(false)
    }
  }

  const allAdditionalImagePreviews = [
    ...existingAdditionalImages.map((img, index) => ({ type: 'existing' as const, url: img, index })),
    ...newAdditionalImagePreviews.map((img, index) => ({ type: 'new' as const, url: img, index }))
  ]

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
            <CardDescription>Modifica la informacion del producto</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="name">Nombre del Producto *</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Video YouTube */}
                <div className="space-y-2 md:col-span-2">
                  <Label>Video de YouTube (opcional)</Label>
                  <div className="flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <Input
                      value={youtubeUrl}
                      onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... o ID del video"
                      className="flex-1"
                    />
                  </div>
                  {formData.youtubeVideoId && (
                    <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-green-600 font-medium">
                          Video ID: {formData.youtubeVideoId}
                        </p>
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm"
                          className="h-8 px-3 text-xs gap-1"
                          onClick={() => window.open(`https://www.youtube.com/watch?v=${formData.youtubeVideoId}`, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Ver en YouTube
                        </Button>
                      </div>
                      <div className="aspect-video max-w-2xl bg-black rounded-lg overflow-hidden shadow-lg mb-2">
                        <iframe
                          width="100%"
                          height="100%"
                          src={`https://www.youtube.com/embed/${formData.youtubeVideoId}`}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                          className="w-full h-full"
                          onError={() => setYoutubeError(true)}
                        />
                      </div>
                      {youtubeError && (
                        <p className="text-sm text-red-500 mt-2">
                          El video no se pudo cargar, pero puedes verlo usando el enlace.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Imagenes */}
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Imagenes del Producto</Label>
                    <span className={`text-sm ${totalImages >= MAX_TOTAL_IMAGES ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {totalImages}/{MAX_TOTAL_IMAGES} imagenes
                    </span>
                  </div>

                  <div className="border rounded-lg p-4">
                    <Label className="text-sm font-medium">Imagen Principal</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                            onChange={handleImageUpload}
                            className="cursor-pointer"
                            disabled={isUploading || totalImages >= MAX_TOTAL_IMAGES}
                          />
                          <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={formData.image}
                          onChange={(e) => {
                            setFormData({ ...formData, image: e.target.value })
                            setImagePreview(e.target.value)
                            setImageFile(null)
                          }}
                          placeholder="URL de imagen web"
                        />
                      </div>
                    </div>
                    {imagePreview && (
                      <div className="mt-4 relative inline-block">
                        <img
                          src={imagePreview || "/placeholder.svg"}
                          alt="Preview"
                          className="w-48 h-48 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={removeMainImage}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border rounded-lg p-4">
                    <Label className="text-sm font-medium">Imagenes Adicionales</Label>
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                          onChange={handleAdditionalImageUpload}
                          className="cursor-pointer"
                          disabled={isUploading || totalImages >= MAX_TOTAL_IMAGES}
                        />
                        <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Espacios disponibles: {MAX_TOTAL_IMAGES - totalImages}
                      </p>
                    </div>
                    
                    {allAdditionalImagePreviews.length > 0 && (
                      <div className="mt-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {allAdditionalImagePreviews.map(({ type, url, index }) => (
                            <div key={`${type}-${index}`} className="relative group">
                              <img
                                src={url || "/placeholder.svg"}
                                alt={`Additional ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100"
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
                      </div>
                    )}
                  </div>
                </div>

                {/* Categoria */}
                <div className="space-y-2">
                  <Label htmlFor="category-select">Categoria *</Label>
                  <select
                    id="category-select"
                    value={formData.categoryId || ""}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        categoryId: newValue, 
                        subcategoryIds: [] 
                      }));
                      setSelectedCategory(newValue);
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    required
                  >
                    <option value="">Selecciona una categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={safeToString(cat.id)}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subcategorias */}
                <div className="space-y-2 md:col-span-2">
                  <Label>Subcategorias *</Label>
                  <div className="border rounded-lg p-4 bg-muted/20">
                    {!selectedCategory ? (
                      <p className="text-sm text-muted-foreground">Primero selecciona una categoria</p>
                    ) : availableSubcategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay subcategorias disponibles</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {availableSubcategories.map((subcat) => (
                          <SubcategoryCheckbox
                            key={subcat.id}
                            subcat={subcat}
                            isSelected={formData.subcategoryIds.includes(safeToString(subcat.id))}
                            onToggle={handleSubcategoryToggle}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.subcategoryIds.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      {formData.subcategoryIds.length} subcategoria(s) seleccionada(s)
                    </p>
                  )}
                </div>

                {/* Marca y Género */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca *</Label>
                    <Input
                      id="brand"
                      required
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Ej: Devir"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="genre">Género *</Label>
                    <Input
                      id="genre"
                      required
                      value={formData.genre}
                      onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                      placeholder="Ej: Estrategia, Familiar"
                    />
                  </div>
                </div>

                {/* Etiquetas del Producto */}
                <div className="space-y-2 md:col-span-2 border rounded-lg p-4">
                  <Label className="text-lg font-semibold flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Etiqueta del Producto
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecciona SOLO UNA etiqueta para este producto. <strong className="text-green-600">"Normal" es para productos sin etiqueta especial.</strong>
                  </p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { value: "", label: "NORMAL", icon: Package, description: "Producto sin etiqueta especial", color: "bg-green-500", bgColor: "bg-green-50", borderColor: "border-green-200" },
                      { value: "preventa", label: "PREVENTA", icon: Rocket, description: "Producto en preventa", color: "bg-amber-500", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
                      { value: "descuento", label: "DESCUENTO", icon: Percent, description: "Activar oferta especial", color: "bg-orange-500", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
                      { value: "novedad", label: "NOVEDAD", icon: Sparkles, description: "Producto recien llegado", color: "bg-gray-800", bgColor: "bg-gray-50", borderColor: "border-gray-200" },
                      { value: "agotado", label: "AGOTADO", icon: AlertCircle, description: "Sin stock (stock = 0)", color: "bg-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
                    ].map((tag) => {
                      const IconComponent = tag.icon;
                      const isSelected = selectedTag === tag.value;
                      
                      return (
                        <div
                          key={tag.value || "normal"}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? `${tag.bgColor} ${tag.borderColor} border-2`
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleTagSelect(tag.value)}
                        >
                          <div className={`p-2 rounded-full ${isSelected ? tag.color : 'bg-gray-100'}`}>
                            <IconComponent className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                          </div>
                          <div>
                            <span className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                              {tag.label}
                            </span>
                            <p className="text-xs text-muted-foreground">{tag.description}</p>
                          </div>
                          <input
                            type="radio"
                            name="productTag"
                            checked={isSelected}
                            onChange={() => {}}
                            className="ml-auto h-4 w-4 text-[#C2410C] focus:ring-[#C2410C]"
                          />
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Panel para NORMAL (sin etiqueta) */}
                  {selectedTag === "" && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Producto Normal
                      </h4>
                      <p className="text-sm text-green-700 mb-3">
                        Este producto se mostrará sin etiqueta especial.
                      </p>
                      <div className="p-3 bg-white rounded-lg">
                        <Label className="text-sm">Precio (CLP)</Label>
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="mt-1"
                          placeholder="Ej: 25000"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Panel para DESCUENTO */}
                  {selectedTag === "descuento" && (
                    <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                        <Percent className="w-4 h-4" />
                        Configurar Descuento
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm">Precio Original (CLP) *</Label>
                          <Input
                            type="number"
                            placeholder="Ej: 50000"
                            value={formData.originalPrice}
                            onChange={(e) => handleDiscountChange('originalPrice', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Porcentaje de Descuento (1-99%) *</Label>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="1"
                              max="99"
                              value={formData.discountPercent}
                              onChange={(e) => handleDiscountChange('discountPercent', e.target.value)}
                              className="flex-1"
                            />
                            <span className="text-sm font-bold text-orange-600 min-w-[45px]">
                              {formData.discountPercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        <Label className="text-sm">Precio Final (calculado automáticamente)</Label>
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => handleDiscountChange('price', e.target.value)}
                          className="mt-1 bg-gray-50"
                        />
                      </div>
                      {formData.originalPrice && safeToNumber(formData.originalPrice) > 0 && (
                        <div className="mt-3 p-3 bg-white rounded-lg">
                          <p className="text-sm">
                            <span className="font-semibold">Resumen:</span>{' '}
                            <span className="line-through text-gray-500">${formatCLP(safeToNumber(formData.originalPrice))} CLP</span>{' '}
                            → <span className="text-orange-600 font-bold">${formatCLP(safeToNumber(formData.price))} CLP</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Panel para PREVENTA */}
                  {selectedTag === "preventa" && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <Rocket className="w-4 h-4" />
                        Producto en Preventa
                      </h4>
                      <p className="text-sm text-amber-700 mb-3">
                        Este producto se mostrará con la etiqueta "PREVENTA".
                      </p>
                      <div className="p-3 bg-white rounded-lg">
                        <Label className="text-sm">Precio de Preventa (CLP)</Label>
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="mt-1"
                          placeholder="Ej: 45000"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Panel para NOVEDAD */}
                  {selectedTag === "novedad" && (
                    <div className="mt-4 p-4 bg-gray-100 border border-gray-300 rounded-lg">
                      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Producto Nuevo
                      </h4>
                      <p className="text-sm text-gray-700 mb-3">
                        Este producto se mostrará con la etiqueta "NOVEDAD".
                      </p>
                      <div className="p-3 bg-white rounded-lg">
                        <Label className="text-sm">Precio (CLP)</Label>
                        <Input
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Panel para AGOTADO */}
                  {selectedTag === "agotado" && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Producto Agotado
                      </h4>
                      <p className="text-sm text-red-700">
                        Este producto se mostrará con la etiqueta "AGOTADO". El stock se ha establecido automáticamente a 0.
                      </p>
                      <div className="mt-3 p-3 bg-white rounded-lg">
                        <p className="text-sm">
                          <span className="font-semibold">Stock actual:</span> 0 unidades
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Vista previa del badge - solo mostrar si hay etiqueta seleccionada y no es normal */}
                  {selectedTag && selectedTag !== "" && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Vista previa del badge:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTag === "preventa" && (
                          <span className="px-3 py-1 text-xs font-bold italic rounded-full text-white shadow-md" style={{ backgroundColor: "rgb(251,176,59)" }}>
                            PREVENTA
                          </span>
                        )}
                        {selectedTag === "descuento" && formData.discountPercent !== "0" && (
                          <span className="px-3 py-1 text-xs font-bold italic rounded-full text-white shadow-md" style={{ backgroundColor: "rgba(241,90,36)" }}>
                            {formData.discountPercent}% OFF
                          </span>
                        )}
                        {selectedTag === "novedad" && (
                          <span className="px-3 py-1 text-xs font-bold italic rounded-full text-white shadow-md" style={{ backgroundColor: "rgba(26,26,26)" }}>
                            NOVEDAD
                          </span>
                        )}
                        {selectedTag === "agotado" && (
                          <span className="px-3 py-1 text-xs font-bold italic rounded-full text-white shadow-md" style={{ backgroundColor: "rgba(237,28,36)" }}>
                            AGOTADO
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Productos Recomendados */}
                <div className="space-y-2 md:col-span-2 border rounded-lg p-4">
                  <Label className="text-lg font-semibold flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Productos Recomendados
                  </Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Selecciona los productos que se mostraran como "Tambien te podria gustar"
                  </p>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      placeholder="Buscar productos..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  {productsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span>Cargando productos...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2">
                      {filteredProducts.map((product: any) => (
                        <RecommendedProductCard
                          key={product.id}
                          product={product}
                          isSelected={formData.recommendedProducts.includes(product.id)}
                          onToggle={handleRecommendedProductToggle}
                        />
                      ))}
                    </div>
                  )}
                  {formData.recommendedProducts.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      {formData.recommendedProducts.length} producto(s) recomendado(s) seleccionado(s)
                    </p>
                  )}
                </div>

                {/* Stock y Especificaciones */}
                <div className="space-y-2">
                  <Label htmlFor="stock">Stock *</Label>
                  <Input
                    id="stock"
                    type="number"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    disabled={selectedTag === "agotado"}
                    className={selectedTag === "agotado" ? "bg-gray-100" : ""}
                  />
                  {selectedTag === "agotado" && (
                    <p className="text-xs text-red-500">El stock esta fijado en 0 porque el producto esta agotado</p>
                  )}
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
                  <Label htmlFor="ageMin">Edad Minima *</Label>
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
                  <Label htmlFor="playersMin">Jugadores Minimo *</Label>
                  <Input
                    id="playersMin"
                    type="number"
                    required
                    value={formData.playersMin}
                    onChange={(e) => setFormData({ ...formData, playersMin: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="playersMax">Jugadores Maximo *</Label>
                  <Input
                    id="playersMax"
                    type="number"
                    required
                    value={formData.playersMax}
                    onChange={(e) => setFormData({ ...formData, playersMax: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duracion (ej: 15 min) *</Label>
                  <Input
                    id="duration"
                    required
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="durationMin">Duracion Minima (min) *</Label>
                  <Input
                    id="durationMin"
                    type="number"
                    required
                    value={formData.durationMin}
                    onChange={(e) => setFormData({ ...formData, durationMin: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Descripcion *</Label>
                  <Textarea
                    id="description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isUploading} className="bg-[#C2410C] hover:bg-[#9A3412]">
                  {isUploading ? "Guardando..." : "Guardar Cambios"}
                </Button>
                <Link href="/admin/products">
                  <Button type="button" variant="outline">
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