// components/product-card.tsx - ACTUALIZADO CON STOCK
"use client"

import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ShoppingCart } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useCartStore } from "@/lib/cart-store"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

// En components/product-card.tsx - actualizar la interfaz Product
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
}

// Función para formatear precio en CLP
const formatCLP = (price: number): string => {
  return Math.round(price).toLocaleString('es-CL');
};

// Función para calcular porcentaje de descuento
const calculateDiscountPercent = (originalPrice: number, currentPrice: number): number => {
  if (!originalPrice || originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
};

export function ProductCard({ product }: ProductCardProps) {
  const hasDiscount = product.originalPrice && product.originalPrice > product.price
  const discountPercent = hasDiscount 
    ? calculateDiscountPercent(product.originalPrice!, product.price)
    : 0
    
  const addItem = useCartStore((state) => state.addItem)
  const { toast } = useToast()

  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const allImages = [product.image, ...(product.additionalImages || [])]

  // Obtener todas las subcategorías del producto
  const allSubcategories = product.subcategories || []
  
  // Combinar categoría y subcategorías en una sola lista
  const allCategories = [
    { name: product.category, type: 'category' as const },
    ...allSubcategories.map(sub => ({ 
      name: sub.name, 
      type: 'subcategory' as const,
      isPrimary: sub.isPrimary 
    }))
  ]

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

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

  const handleMouseEnter = () => {
    if (allImages.length > 1) {
      let index = 0
      const interval = setInterval(() => {
        index = (index + 1) % allImages.length
        setCurrentImageIndex(index)
      }, 800)

      // Store interval ID to clear on mouse leave
      ;(window as any)[`productImageInterval_${product.id}`] = interval
    }
  }

  const handleMouseLeave = () => {
    const interval = (window as any)[`productImageInterval_${product.id}`]
    if (interval) {
      clearInterval(interval)
      delete (window as any)[`productImageInterval_${product.id}`]
    }
    setCurrentImageIndex(0)
  }

  // Determinar el texto del stock
  const getStockText = () => {
    if (!product.inStock) return "Sin Stock";
    if (product.stock <= 5) return `Últimas ${product.stock} unidades`;
    if (product.stock <= 10) return `Stock bajo (${product.stock})`;
    return `En Stock (${product.stock})`;
  };

  // Determinar el color del badge de stock
  const getStockBadgeVariant = () => {
    if (!product.inStock) return "destructive";
    if (product.stock <= 5) return "destructive";
    if (product.stock <= 10) return "secondary";
    return "default";
  };

  return (
    <Link href={`/products/${product.id}`} className="block h-full">
      <Card
        className="group hover:shadow-lg transition-shadow duration-200 h-full flex flex-col w-full cursor-pointer border-border/50"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Product Image */}
          <div className="relative aspect-square mb-4 overflow-hidden rounded-lg bg-muted">
            <Image
              src={allImages[currentImageIndex] || "/placeholder.svg"}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
            />
            {/* Badges superpuestos */}
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {hasDiscount && (
                <Badge className="bg-[#DC2626] text-white border-0 font-semibold">
                  -{discountPercent}%
                </Badge>
              )}
              {product.isOnSale && !hasDiscount && (
                <Badge className="bg-[#EA580C] text-white border-0 font-semibold">
                  OFERTA
                </Badge>
              )}
            </div>
            
            {/* Badge de stock en la esquina superior derecha */}
            <div className="absolute top-2 right-2">
              <Badge 
                variant={getStockBadgeVariant()} 
                className="text-xs font-semibold"
              >
                {getStockText()}
              </Badge>
            </div>

            {allImages.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {allImages.map((_, index) => (
                  <div
                    key={index}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      index === currentImageIndex ? "bg-white" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-3 flex-1 flex flex-col">
            <h3 className="font-semibold text-foreground line-clamp-2 text-sm leading-tight min-h-[2.5rem] group-hover:text-[#C2410C] transition-colors break-words">
              {product.name}
            </h3>

            {/* Game Details - Fixed text overflow and consistent sizing */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-[#FEF3F2] rounded px-2 py-2 text-center min-h-[3.5rem] flex flex-col justify-center border border-[#FEE2E2]">
                <div className="font-medium text-[9px] uppercase tracking-wide text-[#991B1B] mb-1">EDAD</div>
                <div className="text-foreground text-xs font-semibold break-words">{product.age}</div>
              </div>
              <div className="bg-[#FEF3F2] rounded px-2 py-2 text-center min-h-[3.5rem] flex flex-col justify-center border border-[#FEE2E2]">
                <div className="font-medium text-[9px] uppercase tracking-wide text-[#991B1B] mb-1">JUGADORES</div>
                <div className="text-foreground text-xs font-semibold break-words leading-tight">{product.players}</div>
              </div>
              <div className="bg-[#FEF3F2] rounded px-2 py-2 text-center min-h-[3.5rem] flex flex-col justify-center border border-[#FEE2E2]">
                <div className="font-medium text-[9px] uppercase tracking-wide text-[#991B1B] mb-1">DURACIÓN</div>
                <div className="text-foreground text-xs font-semibold break-words leading-tight hyphens-auto">
                  {product.duration}
                </div>
              </div>
            </div>

            {/* CATEGORÍAS Y SUBCATEGORÍAS - LISTA HORIZONTAL COMPACTA */}
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((item, index) => (
                <Badge
                  key={index}
                  variant={item.type === 'category' ? "default" : "secondary"}
                  className={`
                    text-xs px-2 py-0.5 break-words border-0 font-medium
                    ${item.type === 'category' 
                      ? 'bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FEE2E2]' 
                      : item.isPrimary 
                        ? 'bg-[#FEF3F2] text-[#991B1B] border border-[#FEE2E2] hover:bg-[#FEE2E2]' 
                        : 'bg-[#FEE2E2] text-[#991B1B] border border-[#FEE2E2] hover:bg-[#FEE2E2]'
                    }
                  `}
                >
                  {item.name}
                </Badge>
              ))}
            </div>

            {/* Tags - Fixed height for consistent spacing */}
            <div className="flex flex-wrap gap-1 min-h-[2rem] items-start">
              {product.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-2 py-0.5 break-words bg-[#FEF3F2] text-[#991B1B] border-[#FEE2E2] hover:bg-[#FEE2E2]"
                >
                  {tag}
                </Badge>
              ))}
            </div>

            {/* Price - Push to bottom with margin-top auto */}
            <div className="flex items-center gap-2 mt-auto pt-2">
              <span className="text-lg font-bold text-[#C2410C]">${formatCLP(product.price)} </span>
              {hasDiscount && (
                <span className="text-sm text-muted-foreground line-through">${formatCLP(product.originalPrice!)} </span>
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-4 pt-0 mt-auto">
          <Button
            className="w-full h-10 text-sm bg-[#C2410C] hover:bg-[#9A3412] text-white"
            disabled={!product.inStock}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {product.inStock ? "Agregar al Carrito" : "Sin Stock"}
          </Button>
        </CardFooter>
      </Card>
    </Link>
  )
}