"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { CategoryNav } from "@/components/category-nav"
import { Footer } from "@/components/footer"
import { useProductStore } from "@/lib/product-store"
import { useCartStore } from "@/lib/cart-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ShoppingCart, ArrowLeft, ZoomIn } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { useCategoryStore } from "@/lib/category-store"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { fetchProduct, products } = useProductStore()
  const { categories: dbCategories, fetchCategories } = useCategoryStore()
  const addItem = useCartStore((state) => state.addItem)
  const { toast } = useToast()

  // Desempaquetar params usando use()
  const resolvedParams = use(params)
  const productId = Number.parseInt(resolvedParams.id)
  
  // Buscar en productos cargados o cargar individualmente
  const productFromStore = products.find((p) => p.id === productId && p.isActive)
  const [product, setProduct] = useState(productFromStore)
  const [loading, setLoading] = useState(!productFromStore)

  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [isZoomed, setIsZoomed] = useState(false)

  // Cargar categorías
  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Función para corregir URLs de imágenes
  const correctImageUrl = (url: string) => {
    if (!url) return '/diverse-products-still-life.png';
    if (url.startsWith('/')) return url;
    if (url.startsWith('uploads/')) return `/${url}`;
    return `/uploads/products/${url}`;
  };

  // Obtener información completa de categorías y subcategorías del producto
  const getProductCategoriesInfo = () => {
    if (!product) return { category: null, subcategories: [] };

    // Buscar la categoría en la base de datos
    const categoryInfo = dbCategories.find(cat => 
      cat.id === product.categoryId || cat.name === product.category
    );

    // Obtener todas las subcategorías del producto
    const allSubcategories = product.subcategories || [];
    
    // Si no hay subcategorías en el producto, usar la subcategoría principal
    if (allSubcategories.length === 0 && product.subcategory) {
      allSubcategories.push({
        id: product.subcategoryId || 0,
        name: product.subcategory,
        slug: product.subcategory.toLowerCase().replace(/\s+/g, '-'),
        isPrimary: true,
        displayOrder: 1
      });
    }

    return {
      category: categoryInfo || { 
        id: product.categoryId, 
        name: product.category,
        slug: product.category.toLowerCase().replace(/\s+/g, '-')
      },
      subcategories: allSubcategories
    };
  };

  const categoriesInfo = getProductCategoriesInfo();

  // Preparar todas las imágenes
  const allImages = product ? [
    correctImageUrl(product.image),
    ...(product.additionalImages?.map(correctImageUrl) || [])
  ].filter(img => img && img !== '/diverse-products-still-life.png') : []

  console.log('📸 Product images:', {
    productId,
    productName: product?.name,
    mainImage: product?.image,
    additionalImages: product?.additionalImages,
    allImagesCount: allImages.length,
    allImages: allImages,
    categoriesInfo
  })

  useEffect(() => {
    const loadProduct = async () => {
      if (!productFromStore) {
        setLoading(true)
        try {
          console.log(`🔄 Loading individual product ${productId}...`)
          const productData = await fetchProduct(productId)
          if (productData) {
            setProduct(productData)
            console.log('✅ Product loaded:', {
              name: productData.name,
              images: {
                main: productData.image,
                additional: productData.additionalImages,
                total: [productData.image, ...(productData.additionalImages || [])].length
              },
              categories: {
                categoryId: productData.categoryId,
                subcategoryIds: productData.subcategoryIds,
                subcategories: productData.subcategories
              },
              stock: productData.stock,
              inStock: productData.inStock
            })
          } else {
            console.error('❌ Product not found')
            router.push("/")
          }
        } catch (error) {
          console.error('Error loading product:', error)
          router.push("/")
        } finally {
          setLoading(false)
        }
      }
    }

    loadProduct()
  }, [productId, productFromStore, fetchProduct, router])

  useEffect(() => {
    if (product && !product.isActive) {
      router.push("/")
    }
  }, [product, router])

  // Función para determinar el texto del stock
  const getStockText = () => {
    if (!product) return "";
    if (!product.inStock) return "Sin Stock";
    if (product.stock <= 5) return `Últimas ${product.stock} unidades`;
    if (product.stock <= 10) return `Stock bajo (${product.stock})`;
    return `En Stock (${product.stock} disponibles)`;
  };

  // Función para determinar el color del badge de stock
  const getStockBadgeVariant = () => {
    if (!product) return "default";
    if (!product.inStock) return "destructive";
    if (product.stock <= 5) return "destructive";
    if (product.stock <= 10) return "secondary";
    return "default";
  };

  // Función para formatear precio en CLP
  const formatCLP = (price: number): string => {
    return Math.round(price).toLocaleString('es-CL');
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg">Cargando producto...</p>
            </div>
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
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold mb-4">Producto no encontrado</h1>
            <Link href="/">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a la tienda
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      inStock: product.inStock,
      stock: product.stock, // ← AGREGADO
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId
    })

    toast({
      title: "Producto agregado",
      description: `${product.name} se agregó al carrito`,
      duration: 5000,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la tienda
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Image and Details */}
          <div className="space-y-4">
            {/* Imagen principal con zoom */}
            <Card className="overflow-hidden border-2 relative">
              <div 
                className="relative aspect-square bg-muted cursor-zoom-in"
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <Image
                  src={allImages[selectedImageIndex] || "/placeholder.svg"}
                  alt={product.name}
                  fill
                  className={`object-cover transition-transform duration-300 ${
                    isZoomed ? 'scale-150' : 'scale-100'
                  }`}
                  priority
                />
                <div className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full">
                  <ZoomIn className="w-5 h-5" />
                </div>
              </div>
            </Card>

            {/* Miniaturas de imágenes */}
            {allImages.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Imágenes ({allImages.length})
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {allImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedImageIndex(index)
                        setIsZoomed(false)
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImageIndex === index
                          ? "border-[#C2410C] ring-2 ring-[#C2410C]/20"
                          : "border-border hover:border-[#C2410C]/50"
                      }`}
                    >
                      <Image
                        src={image || "/placeholder.svg"}
                        alt={`${product.name} - imagen ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      {selectedImageIndex === index && (
                        <div className="absolute inset-0 bg-[#C2410C]/10"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Product Specs */}
            <div className="space-y-3">
              <Card className="p-4 border-2">
                <div className="text-sm font-semibold text-muted-foreground mb-2">EDAD</div>
                <div className="text-xl font-bold">{product.age}</div>
              </Card>

              <Card className="p-4 border-2">
                <div className="text-sm font-semibold text-muted-foreground mb-2">JUGADORES</div>
                <div className="text-xl font-bold">{product.players}</div>
              </Card>

              <Card className="p-4 border-2">
                <div className="text-sm font-semibold text-muted-foreground mb-2">DURACIÓN</div>
                <div className="text-xl font-bold">{product.duration}</div>
              </Card>

              {/* NUEVA SECCIÓN: CATEGORÍAS Y SUBCATEGORÍAS */}
              <Card className="p-4 border-2">
                <div className="text-sm font-semibold text-[#991B1B] mb-2">Categoría</div>
                <div className="space-y-3">
                  {/* Categoría principal */}
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        variant="default" 
                        className="bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FEE2E2]"
                      >
                        {categoriesInfo.category?.name}
                      </Badge>
                    </div>
                  </div>

                  {/* Subcategorías */}
                  {categoriesInfo.subcategories.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-[#991B1B] mb-2">
                        Subcategorías ({categoriesInfo.subcategories.length}):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {categoriesInfo.subcategories.map((subcategory, index) => (
                          <Badge
                            key={subcategory.id}
                            variant={subcategory.isPrimary ? "secondary" : "outline"}
                            className={`
                              text-sm px-3 py-1 cursor-pointer transition-colors
                              ${subcategory.isPrimary 
                                ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FEE2E2] hover:bg-[#FEE2E2]' 
                                : 'bg-[#FEE2E2] text-[#991B1B] border-[#FEE2E2] hover:[#FEE2E2]'
                              }
                            `}
                            
                          >
                            {subcategory.name}
                            {subcategory.isPrimary }
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags del producto */}
                  {product.tags && product.tags.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-[#991B1B] mb-2">Etiquetas:</div>
                      <div className="flex flex-wrap gap-2">
                        {product.tags.map((tag: any) => (
                          <Badge 
                            key={typeof tag === 'object' ? tag.id : tag} 
                            variant="outline" 
                            className="text-sm bg-[#F8FAFC] text-gray-600 border-gray-300"
                          >
                            {typeof tag === 'object' ? tag.name : tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          {/* Right Column - Product Info and Description */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{product.name}</h1>
              <div className="flex items-center gap-2 mb-4">
                <Badge 
                  variant="default" 
                  className="bg-[#F97316] text-white hover:bg-[#EA580C]"
                >
                  {categoriesInfo.category?.name}
                </Badge>
                {categoriesInfo.subcategories.length > 0 && (
                  <Badge variant="secondary" className="bg-[#FEF3F2] text-[#991B1B] border-[#FEE2E2]">
                    {categoriesInfo.subcategories.find(sub => sub.isPrimary)?.name || categoriesInfo.subcategories[0]?.name}
                  </Badge>
                )}
                {product.isOnSale && <Badge className="bg-red-500 text-white">OFERTA</Badge>}
                {/* Badge de stock */}
                <Badge 
                  variant={getStockBadgeVariant()} 
                  className="text-sm font-semibold"
                >
                  {getStockText()}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <Card className="p-6 border-2">
              <p className="text-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
            </Card>

            {/* Price and Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-primary">${formatCLP(product.price)} </span>
                {product.originalPrice && product.originalPrice > product.price && (
                  <span className="text-xl text-muted-foreground line-through">${formatCLP(product.originalPrice!)} </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Badge variant={getStockBadgeVariant()}>
                  {getStockText()}
                </Badge>
              </div>

              <Button 
                className="w-full h-14 text-lg bg-[#C2410C] hover:bg-[#9A3412] text-white" 
                disabled={!product.inStock} 
                onClick={handleAddToCart}
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                {product.inStock ? "Agregar al Carrito" : "Sin Stock"}
              </Button>

              
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}