// components/product-card.tsx - VERSIÓN OPTIMIZADA PARA CARGA RÁPIDA

"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

interface Product {
  id: number
  name: string
  price: number
  originalPrice?: number
  image: string
  additionalImages?: string[]
  category: string
  subcategory: string
  categoryId: number
  subcategoryId: number
  subcategoryIds: string[]
  subcategories: Array<{
    id: number
    name: string
    slug: string
    isPrimary: boolean
    displayOrder: number
  }>
  age: string
  players: string
  duration: string
  tags: string[]
  description: string
  inStock: boolean
  stock: number 
  isOnSale?: boolean
}

interface ProductCardProps {
  product: Product
  index?: number
}

// 🔥 CACHE DE IMÁGENES para evitar recargas
const imageCache = new Map<string, string>()

const getImageUrl = (url: string): string => {
  if (!url) return '/api/images/diverse-products-still-life.png'
  
  // Si ya está en caché, devolverla
  if (imageCache.has(url)) {
    return imageCache.get(url)!
  }
  
  let result: string
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    result = url
  } else if (url.startsWith('/api/images/')) {
    result = url
  } else {
    let filename = url
    
    if (url.startsWith('/uploads/products/')) {
      filename = url.replace('/uploads/products/', '')
    } else if (url.startsWith('uploads/products/')) {
      filename = url.replace('uploads/products/', '')
    } else if (url.startsWith('/uploads/')) {
      filename = url.replace('/uploads/products/', '')
    } else if (url.startsWith('uploads/')) {
      filename = url.replace('uploads/products/', '')
    } else if (url.includes('/uploads/products/')) {
      filename = url.split('/uploads/products/')[1]
    }
    
    const encoded = encodeURIComponent(filename)
    result = `/api/images/${encoded}`
  }
  
  // Guardar en caché
  imageCache.set(url, result)
  return result
}

// 🔥 PRECARGA DE IMÁGENES - carga las imágenes en segundo plano
const preloadImage = (src: string) => {
  if (!src || src.startsWith('blob:')) return
  const img = new window.Image()
  img.src = src
}

const formatCLP = (price: number): string => {
  return Math.round(price).toLocaleString('es-CL')
}

const calculateDiscountPercent = (originalPrice: number, currentPrice: number): number => {
  if (!originalPrice || originalPrice <= currentPrice) return 0
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
}

const hasTag = (tags: string[], tagName: string): boolean => {
  if (!tags || !Array.isArray(tags)) return false
  return tags.some(tag => tag.toLowerCase().includes(tagName.toLowerCase()))
}

const isProductOutOfStock = (product: Product): boolean => {
  return !product.inStock || product.stock <= 0
}

interface BadgeConfig {
  text: string | ((product: Product) => string)
  color: string
  priority: number
  condition: (product: Product) => boolean
}

const BADGE_CONFIGS: BadgeConfig[] = [
  {
    text: "AGOTADO",
    color: "rgba(237, 28, 36)",
    priority: 1,
    condition: (product) => isProductOutOfStock(product)
  },
  {
    text: "PREVENTA",
    color: "rgb(251, 176, 59)",
    priority: 2,
    condition: (product) => hasTag(product.tags, "preventa") && !isProductOutOfStock(product)
  },
  {
    text: (product) => {
      if (!product.originalPrice || product.originalPrice <= product.price) return ""
      const discountPercent = calculateDiscountPercent(product.originalPrice, product.price)
      return `-${discountPercent}%`
    },
    color: "rgba(241, 90, 36)",
    priority: 3,
    condition: (product) => product.originalPrice !== undefined && product.originalPrice > product.price && !isProductOutOfStock(product)
  },
  {
    text: "NOVEDAD",
    color: "rgba(26, 26, 26)",
    priority: 4,
    condition: (product) => hasTag(product.tags, "novedad") && !isProductOutOfStock(product)
  }
]

const getAllBadges = (product: Product): Array<{ text: string; color: string; priority: number }> => {
  const badges: Array<{ text: string; color: string; priority: number }> = []
  
  for (const config of BADGE_CONFIGS) {
    if (config.condition(product)) {
      const text = typeof config.text === 'function' ? config.text(product) : config.text
      if (text) {
        badges.push({
          text,
          color: config.color,
          priority: config.priority
        })
      }
      if (config.priority === 1) break
    }
  }
  
  return badges.sort((a, b) => a.priority - b.priority)
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const outOfStock = isProductOutOfStock(product)
  const hasDiscount = !outOfStock && product.originalPrice && product.originalPrice > product.price
  const badges = getAllBadges(product)

  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [imagesLoaded, setImagesLoaded] = useState<boolean[]>([])
  
  // 🔥 MEMOIZAR URLs de imágenes - solo se recalcula cuando cambia el producto
  const imageUrls = useMemo(() => {
    const urls = [
      getImageUrl(product.image),
      ...(product.additionalImages || []).map(img => getImageUrl(img))
    ].filter(url => url && url !== '/uploads/products/diverse-products-still-life.png')
    
    return urls.length > 0 ? urls : ['/api/images/diverse-products-still-life.png']
  }, [product.image, product.additionalImages])

  // 🔥 PRECARGAR IMÁGENES en segundo plano (sin bloquear el renderizado)
  useEffect(() => {
    // Pre-cargar todas las imágenes de este producto
    imageUrls.forEach((url, index) => {
      // No pre-cargar la primera imagen ya que se carga con el componente
      if (index > 0) {
        preloadImage(url)
      }
    })
    
    // Inicializar estado de carga
    setImagesLoaded(new Array(imageUrls.length).fill(false))
  }, [imageUrls])

  // 🔥 MANEJAR CARGA DE IMÁGENES
  const handleImageLoad = (index: number) => {
    setImagesLoaded(prev => {
      const newState = [...prev]
      newState[index] = true
      return newState
    })
  }

  // Carrusel automático (solo cuando el mouse está encima y hay más de 1 imagen)
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isHovered && imageUrls.length > 1 && !outOfStock) {
      interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % imageUrls.length)
      }, 2000)
    }
    return () => { if (interval) clearInterval(interval) }
  }, [isHovered, imageUrls.length, outOfStock])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, type: "spring", stiffness: 100 }}
      className="h-full"
    >
      <Link href={`/products/${product.id}`} className="block h-full">
        <Card
          className="group hover:shadow-xl transition-all duration-300 h-full flex flex-col w-full cursor-pointer border-border/50 relative overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => { setIsHovered(false); setCurrentImageIndex(0) }}
        >
          <CardContent className="p-4 flex-1 flex flex-col relative z-10">
            {/* Contenedor de imagen con carga optimizada */}
            <motion.div 
              className="relative aspect-square mb-4 overflow-hidden rounded-lg bg-muted"
              animate={{ scale: isHovered ? 1.02 : 1 }}
              transition={{ duration: 0.4 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentImageIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="relative w-full h-full"
                >
                  <Image
                    src={imageUrls[currentImageIndex] || "/api/images/diverse-products-still-life.png"}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority={index < 6} // 🔥 Las primeras 6 imágenes son prioritarias
                    loading={index < 6 ? "eager" : "lazy"} // 🔥 Carga eager para las primeras, lazy para el resto
                    quality={75} // 🔥 Calidad reducida para cargar más rápido
                    unoptimized={true}
                    onLoad={() => handleImageLoad(currentImageIndex)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = '/api/images/diverse-products-still-life.png'
                    }}
                  />
                  
                  {/* 🔥 SKELETON LOADER - Mientras la imagen carga */}
                  {!imagesLoaded[currentImageIndex] && (
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Indicadores de carrusel */}
              {imageUrls.length > 1 && !outOfStock && (
                <motion.div 
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {imageUrls.map((_, idx) => (
                    <motion.div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        idx === currentImageIndex ? "bg-white" : "bg-white/50"
                      }`}
                    />
                  ))}
                </motion.div>
              )}

              {/* Badges */}
              {badges.length > 0 && (
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                  className="absolute top-2 right-2 z-10 flex flex-col gap-1.5"
                >
                  {badges.map((badge, idx) => (
                    <motion.div 
                      key={badge.text} 
                      initial={{ x: 30, opacity: 0 }} 
                      animate={{ x: 0, opacity: 1 }} 
                      transition={{ delay: 0.1 + idx * 0.05 }}
                    >
                      <Badge 
                        className="border-0 font-bold italic text-sm px-3 py-1 shadow-md whitespace-nowrap" 
                        style={{ backgroundColor: badge.color, color: "white" }}
                      >
                        {badge.text}
                      </Badge>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            {/* Información del producto */}
            <div className="space-y-2 flex-1 flex flex-col">
              <h3 className="font-semibold text-foreground line-clamp-2 text-sm leading-tight min-h-[2.5rem] break-words">
                {product.name}
              </h3>

              <div className="flex items-center gap-2 mt-auto pt-2 flex-wrap">
                {outOfStock ? (
                  <span className="text-lg font-bold text-red-600">Sin stock</span>
                ) : (
                  <>
                    <span className="text-lg font-bold text-[#C2410C]">${formatCLP(product.price)}</span>
                    {hasDiscount && product.originalPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        ${formatCLP(product.originalPrice)}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
} 