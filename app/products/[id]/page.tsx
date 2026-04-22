// app/products/[id]/page.tsx - COMPLETO CON BOTÓN ANIMADO
"use client"

import { useEffect, useState, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useProductStore } from "@/lib/product-store"
import { useCartStore } from "@/lib/cart-store"
import { Button } from "@/components/ui/button"
import { ShoppingCart, ArrowLeft, Check, ChevronLeft, ChevronRight, Youtube, Play } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { useCategoryStore } from "@/lib/category-store"
import { motion, AnimatePresence } from "framer-motion"

interface ProductType {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  youtubeVideoId?: string;
  category: string;
  subcategory: string;
  categoryId: number;
  subcategoryId: number;
  subcategoryIds: string[];
  subcategories: Array<{
    id: number;
    name: string;
    slug: string;
    isPrimary: boolean;
    displayOrder: number;
  }>;
  recommendedProducts?: number[];
  ageMin: number;
  age: string;
  playersMin: number;
  playersMax: number;
  players: string;
  durationMin: number;
  duration: string;
  stock: number;
  inStock: boolean;
  isOnSale: boolean;
  isActive: boolean;
  additionalImages: string[];
  tags: string[];
  brand: string;
  genre: string;
  createdAt: string;
  updatedAt: string;
}

type MediaItem = {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { products, fetchProduct, fetchProducts } = useProductStore()
  const { categories: dbCategories, fetchCategories } = useCategoryStore()
  const addItem = useCartStore((state) => state.addItem)
  const { toast } = useToast()

  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [showCheckmark, setShowCheckmark] = useState(false)
  const [isHoveringBack, setIsHoveringBack] = useState(false)
  const hasLoaded = useRef(false)
  
  const [product, setProduct] = useState<ProductType | null>(null)
  const [loading, setLoading] = useState(true)
  const [recommendedProducts, setRecommendedProducts] = useState<ProductType[]>([])
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [showVideo, setShowVideo] = useState(false)

  const resolvedParams = use(params)
  const productId = Number.parseInt(resolvedParams.id)

  useEffect(() => {
    const checkScreenSize = () => setIsMobileOrTablet(window.innerWidth < 1024)
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  useEffect(() => { fetchCategories() }, [fetchCategories])

  useEffect(() => {
    if (hasLoaded.current) return;
    const loadEverything = async () => {
      hasLoaded.current = true;
      setLoading(true);
      try {
        const productData = await fetchProduct(productId);
        if (!productData) { router.push("/"); return; }
        setProduct(productData);
        if (productData.recommendedProducts?.length) {
          if (products.length > 0) {
            setRecommendedProducts(products.filter(p => productData.recommendedProducts?.includes(p.id) && p.isActive));
          } else {
            await fetchProducts({ force: true });
            const updatedProducts = useProductStore.getState().products;
            setRecommendedProducts(updatedProducts.filter(p => productData.recommendedProducts?.includes(p.id) && p.isActive));
          }
        }
      } catch (error) { console.error('Error:', error); router.push("/"); }
      finally { setLoading(false); }
    };
    if (productId) loadEverything();
  }, [productId]);

  useEffect(() => {
    if (product && product.recommendedProducts?.length && products.length) {
      setRecommendedProducts(products.filter(p => product.recommendedProducts?.includes(p.id) && p.isActive));
    }
  }, [product, products]);

  const correctImageUrl = (url: string) => {
    if (!url) return '/diverse-products-still-life.png';
    if (url.startsWith('/')) return url;
    if (url.startsWith('uploads/')) return `/${url}`;
    return `/uploads/products/${url}`;
  };

  const getProductCategoriesInfo = () => {
    if (!product) return { category: null, subcategories: [] };
    const categoryInfo = dbCategories.find(cat => cat.id === product.categoryId || cat.name === product.category);
    const allSubcategories = product.subcategories || [];
    if (!allSubcategories.length && product.subcategory) {
      allSubcategories.push({ id: product.subcategoryId || 0, name: product.subcategory, slug: product.subcategory.toLowerCase().replace(/\s+/g, '-'), isPrimary: true, displayOrder: 1 });
    }
    return { category: categoryInfo || { id: product.categoryId, name: product.category, slug: product.category.toLowerCase().replace(/\s+/g, '-') }, subcategories: allSubcategories };
  };

  const categoriesInfo = getProductCategoriesInfo();

  const allMedia: MediaItem[] = [
    ...(product ? [{ type: 'image' as const, url: correctImageUrl(product.image) }] : []),
    ...(product?.additionalImages?.map(img => ({ type: 'image' as const, url: correctImageUrl(img) })) || []),
    ...(product?.youtubeVideoId ? [{ type: 'video' as const, url: `https://img.youtube.com/vi/${product.youtubeVideoId}/maxresdefault.jpg`, thumbnail: `https://img.youtube.com/vi/${product.youtubeVideoId}/mqdefault.jpg` }] : [])
  ];

  const hasStock = () => product && product.inStock && product.stock > 0;
  const formatCLP = (price: number) => Math.round(price).toLocaleString('es-CL');

  const nextMedia = () => { if (allMedia.length > 1) { setSelectedMediaIndex((prev) => (prev + 1) % allMedia.length); setShowVideo(false); } };
  const prevMedia = () => { if (allMedia.length > 1) { setSelectedMediaIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length); setShowVideo(false); } };
  const handleMediaClick = () => { if (allMedia[selectedMediaIndex].type === 'video' && product?.youtubeVideoId) setShowVideo(true); };

  const handleAddToCart = () => {
    if (!product || !hasStock()) return;
    setIsAddingToCart(true);
    addItem({ id: product.id, name: product.name, price: product.price, image: product.image, category: product.category, inStock: product.inStock, stock: product.stock, categoryId: product.categoryId, subcategoryId: product.subcategoryId });
    toast({ description: (<motion.div className="flex items-center gap-3 w-full" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }} className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0"><Check className="w-4 h-4 text-white" /></motion.div><div className="flex flex-col flex-1"><span className="font-semibold text-sm">Producto agregado</span><span className="text-xs text-muted-foreground line-clamp-1">{product.name}</span></div><motion.div className="w-10 h-10 relative flex-shrink-0 overflow-hidden rounded-md border border-border/50" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}><Image src={correctImageUrl(product.image)} alt={product.name} fill className="object-cover" sizes="40px" /></motion.div></motion.div>), duration: 3000, className: isMobileOrTablet ? "fixed top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md shadow-lg z-50" : "fixed bottom-6 right-6 w-auto max-w-md shadow-lg z-50" });
    setShowCheckmark(true);
    setTimeout(() => setIsAddingToCart(false), 800);
    setTimeout(() => setShowCheckmark(false), 1500);
  }

  // Función para comprar directamente
  const handleBuyNow = () => {
    if (!product || !hasStock()) return;
    
    // Agregar el producto al carrito
    addItem({ 
      id: product.id, 
      name: product.name, 
      price: product.price, 
      image: product.image, 
      category: product.category, 
      inStock: product.inStock, 
      stock: product.stock, 
      categoryId: product.categoryId, 
      subcategoryId: product.subcategoryId 
    });
    
    // Mostrar toast de confirmación
    toast({ 
      description: (
        <motion.div 
          className="flex items-center gap-3 w-full" 
          initial={{ opacity: 0, x: 20 }} 
          animate={{ opacity: 1, x: 0 }} 
          exit={{ opacity: 0, x: -20 }}
        >
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            transition={{ type: "spring", stiffness: 200, damping: 10 }} 
            className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0"
          >
            <Check className="w-4 h-4 text-white" />
          </motion.div>
          <div className="flex flex-col flex-1">
            <span className="font-semibold text-sm">Redirigiendo al checkout</span>
            <span className="text-xs text-muted-foreground line-clamp-1">{product.name}</span>
          </div>
        </motion.div>
      ), 
      duration: 2000 
    });
    
    // Redirigir directamente al checkout después de un pequeño delay
    setTimeout(() => {
      router.push('/checkout');
    }, 500);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="font-poppins text-gray-600">Cargando producto...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-semibold font-poppins mb-4">Producto no encontrado</h1>
            <Link href="/">
              <Button className="bg-orange-600 hover:bg-orange-700 font-poppins font-normal">
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

  const discountPercent = product.originalPrice && product.originalPrice > product.price ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
  const currentMedia = allMedia[selectedMediaIndex];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Botón volver con animación mejorada */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.button
            onClick={() => router.push("/")}
            onMouseEnter={() => setIsHoveringBack(true)}
            onMouseLeave={() => setIsHoveringBack(false)}
            className="group relative flex items-center gap-2 px-4 py-2 rounded-lg font-poppins font-normal text-gray-600 transition-all duration-300 overflow-hidden"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Fondo animado */}
            <motion.div 
              className="absolute inset-0 bg-orange-600 rounded-lg"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: isHoveringBack ? 1 : 0,
                opacity: isHoveringBack ? 1 : 0
              }}
              transition={{ duration: 0.3 }}
            />
            
            {/* Icono animado */}
            <motion.div
              animate={{ 
                x: isHoveringBack ? -5 : 0,
              }}
              transition={{ duration: 0.2 }}
              className="relative z-10"
            >
              <ArrowLeft className={`w-4 h-4 transition-colors duration-300 ${isHoveringBack ? 'text-white' : 'text-gray-600'}`} />
            </motion.div>
            
            {/* Texto animado */}
            <motion.span 
              className={`relative z-10 transition-colors duration-300 ${isHoveringBack ? 'text-white' : 'text-gray-600'}`}
              animate={{
                x: isHoveringBack ? 3 : 0
              }}
              transition={{ duration: 0.2 }}
            >
              Volver a la tienda
            </motion.span>
          </motion.button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* IZQUIERDA - GALERÍA CON CARRUSEL */}
          <div className="space-y-4">
            {/* Imagen principal con borde */}
            <motion.div 
              className="border-2 border-gray-200 rounded-2xl p-2 relative bg-white shadow-sm"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {product.stock <= 10 && hasStock() && (
                <motion.div 
                  className="absolute top-4 left-4 bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-poppins font-bold italic z-10"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, delay: 0.3 }}
                >
                  🔥 POCAS UNIDADES
                </motion.div>
              )}
              
              <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                <div className="relative w-full h-full cursor-pointer" onClick={handleMediaClick}>
                  <AnimatePresence mode="wait">
                    {showVideo && product.youtubeVideoId ? (
                      <motion.div
                        key="video"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="w-full h-full"
                      >
                        <iframe
                          src={`https://www.youtube.com/embed/${product.youtubeVideoId}?autoplay=1&rel=0`}
                          title="YouTube video player"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="w-full h-full"
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="image"
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        className="relative w-full h-full"
                      >
                        <Image
                          src={currentMedia.url}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          priority
                        />
                        {currentMedia.type === 'video' && !showVideo && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/50 transition-all">
                            <motion.div 
                              className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Play className="w-8 h-8 text-white ml-1" />
                            </motion.div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Botones de navegación */}
                {allMedia.length > 1 && (
                  <>
                    <motion.button
                      onClick={prevMedia}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all z-10"
                      whileHover={{ scale: 1.1, x: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      onClick={nextMedia}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all z-10"
                      whileHover={{ scale: 1.1, x: 2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                    <motion.div 
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-poppins"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      {selectedMediaIndex + 1} / {allMedia.length}
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Miniaturas con borde separado */}
            <motion.div 
              className="border border-gray-200 rounded-xl p-3 bg-gray-50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300">
                {allMedia.map((media, i) => (
                  <motion.div
                    key={i}
                    onClick={() => { setSelectedMediaIndex(i); setShowVideo(false); }}
                    className={`relative w-20 h-20 rounded-lg border-2 cursor-pointer overflow-hidden flex-shrink-0 transition-all ${
                      selectedMediaIndex === i 
                        ? "border-orange-500 ring-2 ring-orange-200" 
                        : "border-gray-300 hover:border-orange-400"
                    }`}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Image 
                      src={media.type === 'video' ? media.thumbnail || media.url : media.url} 
                      alt={`Media ${i + 1}`} 
                      width={80} 
                      height={80} 
                      className="object-cover w-full h-full"
                    />
                    {media.type === 'video' && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Youtube className="text-white w-5 h-5" />
                      </div>
                    )}
                    {media.type === 'video' && selectedMediaIndex === i && !showVideo && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <Play className="text-white w-4 h-4" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* DERECHA - INFO */}
            <motion.div 
              className="border-2 border-gray-200 rounded-2xl p-6 flex flex-col h-full"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {/* Marca */}
              <motion.p 
                className="text-sm font-bold font-poppins tracking-wide text-gray-700"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {product.brand || "DEVIR"}
              </motion.p>

              {/* Nombre */}
              <motion.h1 
                className="text-2xl font-semibold font-poppins leading-tight text-gray-900 mt-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {product.name}
              </motion.h1>

              {/* Tags */}
              <motion.div 
                className="flex gap-2 flex-wrap mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {categoriesInfo.subcategories.map((sub, idx) => (
                  <motion.span
                    key={idx}
                    className="text-xs font-light italic font-poppins bg-gray-100 px-2 py-1 rounded text-gray-700"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 + idx * 0.05 }}
                  >
                    {sub.name}
                  </motion.span>
                ))}
              </motion.div>

              {/* Stock */}
              <motion.p 
                className="text-sm font-normal font-poppins text-gray-700 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span className="font-semibold">Stock disponible:</span> {product.stock}
              </motion.p>

              {/* Descripción */}
              <motion.p 
                className="text-sm font-normal font-poppins leading-relaxed text-gray-600 mt-6"
                style={{ fontWeight: 500 }} 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 }}
              >
                {product.description}
              </motion.p>

              {/* Datos del juego */}
              <motion.div 
                className="text-xs space-y-2 text-gray-700 mt-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="font-normal font-poppins"><strong className="font-bold">Jugadores:</strong> {product.players}</p>
                <p className="font-normal font-poppins"><strong className="font-bold">Edad:</strong> {product.age}</p>
                <p className="font-normal font-poppins"><strong className="font-bold">Duración:</strong> {product.duration}</p>
              </motion.div>

              {/* Separador visual antes del precio */}
              <div className="mt-8 border-t border-gray-100"></div>

              {/* Contenedor para precio y botones (juntos abajo) */}
              <div className="mt-auto pt-4">
                {/* PRECIO */}
                <motion.div 
                  className="mb-6"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 }}
                >
                  {product.originalPrice && product.originalPrice > product.price ? (
                    <div className="flex items-start gap-3">
                      {/* % DESCUENTO */}
                      <span 
                        className="text-white text-xs px-3 py-1 rounded-full font-bold font-poppins"
                        style={{ backgroundColor: "rgba(228, 78, 43)" }}
                      >
                        {discountPercent}%
                      </span>

                      {/* PRECIOS */}
                      <div className="flex flex-col">
                        {/* PRECIO ACTUAL */}
                        <span className="text-3xl font-semibold font-poppins text-black">
                          ${formatCLP(product.price)}
                        </span>

                        {/* PRECIO ANTIGUO */}
                        <span className="text-xl font-extralight italic font-poppins line-through text-gray-400 mt-1">
                          ${formatCLP(product.originalPrice)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-3xl font-semibold font-poppins text-black">
                      ${formatCLP(product.price)}
                    </span>
                  )}
                </motion.div>

                {/* Botones */}
                <div className="flex gap-3">
                  <motion.div 
                    whileHover={{ scale: hasStock() ? 1.02 : 1 }} 
                    whileTap={{ scale: hasStock() ? 0.98 : 1 }} 
                    className="flex-1"
                  >
                    <Button 
                      onClick={handleBuyNow}
                      disabled={!hasStock()}
                      className="text-white w-full font-normal font-poppins disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: "rgba(228, 78, 43)" }}
                    >
                      {!hasStock() ? "Sin Stock" : "Comprar"}
                    </Button>
                  </motion.div>
                  
                  <motion.div 
                    whileHover={{ scale: hasStock() ? 1.02 : 1 }} 
                    whileTap={{ scale: hasStock() ? 0.98 : 1 }} 
                    className="flex-1"
                  >
                    <Button
                      onClick={handleAddToCart}
                      disabled={!hasStock()}
                      className="text-white w-full font-normal font-poppins disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
                      style={{ backgroundColor: "rgba(228, 78, 43)" }}
                    >
                      <AnimatePresence mode="wait">
                        {isAddingToCart ? (
                          <motion.div key="adding" className="flex items-center justify-center">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                            />
                            <span>Agregando...</span>
                          </motion.div>
                        ) : showCheckmark ? (
                          <motion.div key="success" className="flex items-center justify-center">
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 400 }}
                            >
                              <Check className="w-4 h-4 mr-2" />
                            </motion.div>
                            <span>¡Agregado!</span>
                          </motion.div>
                        ) : (
                          <motion.div key="normal" className="flex items-center justify-center">
                            <motion.div
                              animate={hasStock() ? {
                                rotate: [0, -10, 10, -5, 5, 0],
                              } : {}}
                              transition={{ duration: 0.5 }}
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                            </motion.div>
                            {!hasStock() ? "Sin Stock" : "Agregar al Carro"}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Efecto de onda al hacer click */}
                      <AnimatePresence>
                        {isAddingToCart && (
                          <motion.div
                            className="absolute inset-0 pointer-events-none"
                            initial={{ scale: 0, opacity: 0.5 }}
                            animate={{ scale: 2, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                          >
                            <div className="w-full h-full bg-white/20 rounded-full" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
        </div>

        {/* SECCIÓN - TODAS LAS CARACTERÍSTICAS */}
        <motion.div 
          className="mt-10 border-2 border-gray-200 rounded-2xl p-6"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <h2 className="font-semibold font-poppins mb-4 text-gray-900">
            TODAS LAS CARACTERÍSTICAS
          </h2>
          
          <div className="space-y-2 text-sm">
            <div className="flex bg-gray-100 p-2 rounded">
              <span className="font-bold font-poppins text-gray-700 w-1/2">
                MARCA
              </span>
              <span className="font-normal font-poppins text-gray-600 w-1/2 text-left">
                {product.brand || "Devir"}
              </span>
            </div>

            <div className="flex bg-gray-100 p-2 rounded">
              <span className="font-bold font-poppins text-gray-700 w-1/2">
                GÉNERO
              </span>
              <span className="font-normal font-poppins text-gray-600 w-1/2 text-left">
                {product.genre || categoriesInfo.subcategories.map(s => s.name).join(", ")}
              </span>
            </div>
            
            <div className="mt-4 font-medium font-poppins text-gray-800">Especificaciones</div>

            <div className="flex bg-gray-100 p-2 rounded">
              <span className="font-bold font-poppins text-gray-700 w-1/2">
                JUGADORES
              </span>
              <span className="font-normal font-poppins text-gray-600 w-1/2 text-left">
                {product.players}
              </span>
            </div>

            <div className="flex bg-gray-100 p-2 rounded">
              <span className="font-bold font-poppins text-gray-700 w-1/2">
                EDAD
              </span>
              <span className="font-normal font-poppins text-gray-600 w-1/2 text-left">
                {product.genre || categoriesInfo.subcategories.map(s => s.name).join(", ")}
              </span>
            </div>
            
          </div>
        </motion.div>

        {/* Productos Recomendados */}
        {recommendedProducts.length > 0 && (
          <motion.div 
            className="mt-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >

            <div className="flex items-center gap-4 mb-8">
              <motion.h2 
                className="text-2xl md:text-3xl font-semibold font-poppins mb-4 text-gray-900"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 1.4 }}
              >
                PODRÍA GUSTARTE
              </motion.h2>

              <motion.div 
                className="flex-1 h-px bg-gradient-to-r from-[#C2410C] to-transparent"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 1.5 }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recommendedProducts.map((recProduct, idx) => (
                <motion.div
                  key={recProduct.id}
                  className="group cursor-pointer border border-gray-200 rounded-xl overflow-hidden hover:border-orange-500 hover:shadow-lg transition-all duration-300"
                  onClick={() => { router.push(`/products/${recProduct.id}`); window.scrollTo(0, 0); }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 + idx * 0.1 }}
                  whileHover={{ y: -5 }}
                >
                  <div className="relative aspect-square bg-gray-100">
                    <Image
                      src={correctImageUrl(recProduct.image)}
                      alt={recProduct.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {recProduct.isOnSale && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded font-bold font-poppins">
                        OFERTA
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold font-poppins text-gray-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                      {recProduct.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold font-poppins text-orange-600">
                        ${formatCLP(recProduct.price)}
                      </span>
                      {recProduct.originalPrice && recProduct.originalPrice > recProduct.price && (
                        <span className="text-xs font-extralight italic font-poppins line-through text-gray-400">
                          ${formatCLP(recProduct.originalPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
      <Footer />
    </div>
  )
}