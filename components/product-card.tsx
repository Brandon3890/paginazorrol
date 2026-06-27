// components/product-card.tsx - VERSIÓN CORREGIDA

"use client"

import type React from "react"
import { useState, useEffect } from "react"
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

const getImageUrl = (url: string): string => {
  if (!url) return '/api/images/diverse-products-still-life.png';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/images/')) return url;
  
  let filename = url;
  
  // Si la URL ya es /uploads/products/algo.jpg, extraer solo el nombre
  if (url.startsWith('/uploads/products/')) {
    filename = url.replace('/uploads/products/', '');
  } else if (url.startsWith('uploads/products/')) {
    filename = url.replace('uploads/products/', '');
  } else if (url.startsWith('/uploads/')) {
    filename = url.replace('/uploads/products/', '');
  } else if (url.startsWith('uploads/')) {
    filename = url.replace('uploads/products/', '');
  } else if (url.includes('/uploads/products/')) {
    filename = url.split('/uploads/products/')[1];
  }
  
  // Si el filename tiene espacios o caracteres especiales, codificarlos
  const encoded = encodeURIComponent(filename);
  return `/api/images/${encoded}`;
};

const formatCLP = (price: number): string => {
  return Math.round(price).toLocaleString('es-CL');
};

const calculateDiscountPercent = (originalPrice: number, currentPrice: number): number => {
  if (!originalPrice || originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
};

const hasTag = (tags: string[], tagName: string): boolean => {
  if (!tags || !Array.isArray(tags)) return false;
  return tags.some(tag => tag.toLowerCase().includes(tagName.toLowerCase()));
};

const isProductOutOfStock = (product: Product): boolean => {
  return !product.inStock || product.stock <= 0;
};

interface BadgeConfig {
  text: string | ((product: Product) => string);
  color: string;
  priority: number;
  condition: (product: Product) => boolean;
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
      if (!product.originalPrice || product.originalPrice <= product.price) return "";
      const discountPercent = calculateDiscountPercent(product.originalPrice, product.price);
      return `-${discountPercent}%`;
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
];

const getAllBadges = (product: Product): Array<{ text: string; color: string; priority: number }> => {
  const badges: Array<{ text: string; color: string; priority: number }> = [];
  
  for (const config of BADGE_CONFIGS) {
    if (config.condition(product)) {
      const text = typeof config.text === 'function' ? config.text(product) : config.text;
      if (text) {
        badges.push({
          text,
          color: config.color,
          priority: config.priority
        });
      }
      if (config.priority === 1) break;
    }
  }
  
  return badges.sort((a, b) => a.priority - b.priority);
};

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const outOfStock = isProductOutOfStock(product);
  const hasDiscount = !outOfStock && product.originalPrice && product.originalPrice > product.price;
  const badges = getAllBadges(product);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
  // 🔥 CORREGIDO: Usar getImageUrl para todas las imágenes
  const allImages = [
    getImageUrl(product.image),
    ...(product.additionalImages || []).map(img => getImageUrl(img))
  ].filter(url => url && url !== '/uploads/products/diverse-products-still-life.png');

  // Si no hay imágenes, usar la imagen por defecto
  const imagesToShow = allImages.length > 0 ? allImages : ['/api/images/diverse-products-still-life.png'];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isHovered && imagesToShow.length > 1 && !outOfStock) {
      interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % imagesToShow.length);
      }, 2000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isHovered, imagesToShow.length, outOfStock]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, type: "spring", stiffness: 100 }}
      whileHover={{ y: -5 }}
      className="h-full"
    >
      <Link href={`/products/${product.id}`} className="block h-full">
        <Card
          className="group hover:shadow-xl transition-all duration-300 h-full flex flex-col w-full cursor-pointer border-border/50 relative overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => { setIsHovered(false); setCurrentImageIndex(0); }}
        >
          <CardContent className="p-4 flex-1 flex flex-col relative z-10">
            <motion.div 
              className="relative aspect-square mb-4 overflow-hidden rounded-lg bg-muted"
              animate={{ scale: isHovered ? 1.02 : 1 }}
              transition={{ duration: 0.3 }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentImageIndex}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="relative w-full h-full"
                >
                  <Image
                    src={imagesToShow[currentImageIndex] || "/api/images/diverse-products-still-life.png"}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    unoptimized={true}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/api/images/diverse-products-still-life.png';
                    }}
                  />
                </motion.div>
              </AnimatePresence>

              {imagesToShow.length > 1 && !outOfStock && (
                <motion.div 
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {imagesToShow.map((_, idx) => (
                    <motion.div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        idx === currentImageIndex ? "bg-white" : "bg-white/50"
                      }`}
                    />
                  ))}
                </motion.div>
              )}

              {badges.length > 0 && (
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                  className="absolute top-2 right-2 z-10 flex flex-col gap-1.5"
                >
                  {badges.map((badge, idx) => (
                    <motion.div key={badge.text} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 + idx * 0.05 }}>
                      <Badge className="border-0 font-bold italic text-sm px-3 py-1 shadow-md whitespace-nowrap" style={{ backgroundColor: badge.color, color: "white" }}>
                        {badge.text}
                      </Badge>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>

            <div className="space-y-2 flex-1 flex flex-col">
              <motion.h3 
                className="font-semibold text-foreground line-clamp-2 text-sm leading-tight min-h-[2.5rem] break-words"
                animate={{ color: isHovered && !outOfStock ? "#C2410C" : "#000000" }}
                transition={{ duration: 0.3 }}
              >
                {product.name}
              </motion.h3>

              <motion.div 
                className="flex items-center gap-2 mt-auto pt-2 flex-wrap"
                animate={isHovered ? { scale: 1.05, x: 5 } : { scale: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {outOfStock ? (
                  <span className="text-lg font-bold text-red-600">Sin stock</span>
                ) : (
                  <>
                    <span className="text-lg font-bold text-[#C2410C]">${formatCLP(product.price)}</span>
                    {hasDiscount && product.originalPrice && (
                      <motion.span className="text-sm text-muted-foreground line-through" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                        ${formatCLP(product.originalPrice)}
                      </motion.span>
                    )}
                  </>
                )}
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}