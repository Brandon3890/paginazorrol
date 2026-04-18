// components/banner.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"

interface Banner {
  id: number
  title: string | null
  subtitle: string | null
  text: string | null
  image: string
  link: string | null
  is_active: number
  order: number
  show_text: number
  overlay_color: string
  text_color: string
  overlay_opacity: number
  text_position: "left" | "center" | "right"
  text_size: "small" | "medium" | "large"
}

const hexToRgba = (hex: string, opacity: number): string => {
  if (!hex) return `rgba(0,0,0,${opacity / 100})`
  if (hex.startsWith('rgba')) {
    return hex.replace(/[\d\.]+\)$/g, `${opacity / 100})`)
  }
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
}

const getPositionClass = (position: string) => {
  switch (position) {
    case "center": return "justify-center text-center"
    case "right": return "justify-end text-right"
    default: return "justify-start text-left"
  }
}

const getTextSizeClasses = (size: string) => {
  switch (size) {
    case "small":
      return {
        title: "text-xl md:text-2xl",
        subtitle: "text-sm md:text-base",
        text: "text-xs md:text-sm"
      }
    case "large":
      return {
        title: "text-3xl md:text-4xl",
        subtitle: "text-lg md:text-xl",
        text: "text-base md:text-lg"
      }
    default:
      return {
        title: "text-2xl md:text-3xl",
        subtitle: "text-base md:text-lg",
        text: "text-sm md:text-base"
      }
  }
}

export function Banner() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [index, setIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchBanners = useCallback(async () => {
    try {
      // Agregar timestamp para evitar cache
      const response = await fetch(`/api/banners?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      const data = await response.json()
      if (data.success) {
        setBanners(data.banners)
      }
    } catch (error) {
      console.error('Error fetching banners:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Polling cada 5 segundos para detectar cambios
  useEffect(() => {
    fetchBanners()
    
    const pollingInterval = setInterval(() => {
      fetchBanners()
    }, 5000) // Verificar cambios cada 5 segundos
    
    return () => clearInterval(pollingInterval)
  }, [fetchBanners])

  // Auto-rotación
  useEffect(() => {
    if (banners.length <= 1 || isHovered) return
    
    if (intervalRef.current) clearInterval(intervalRef.current)
    
    intervalRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % banners.length)
    }, 5000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [banners.length, isHovered])

  // Resetear índice si cambian los banners
  useEffect(() => {
    setIndex(0)
  }, [banners.length])

  if (loading) {
    return (
      <div className="w-full px-4 mt-4">
        <div className="h-[250px] md:h-[345px] lg:h-[400px] bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (banners.length === 0) {
    return null
  }

  const prevSlide = () => {
    setIndex((prev) => (prev - 1 + banners.length) % banners.length)
  }

  const nextSlide = () => {
    setIndex((prev) => (prev + 1) % banners.length)
  }

  const currentBanner = banners[index]
  const overlayRgba = hexToRgba(currentBanner.overlay_color, currentBanner.overlay_opacity)
  const positionClass = getPositionClass(currentBanner.text_position)
  const textSizes = getTextSizeClasses(currentBanner.text_size)

  const BannerContent = () => (
    <div className="relative w-full h-[250px] md:h-[345px] lg:h-[400px] overflow-hidden bg-gray-100">
      <Image
        src={currentBanner.image}
        alt={currentBanner.title || "Banner"}
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />
      
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: overlayRgba }}
      />
      
      {currentBanner.show_text === 1 && currentBanner.title && (
        <div className={`absolute inset-0 flex items-center px-6 md:px-12 ${positionClass} pointer-events-none`}>
          <div className="max-w-md space-y-3">
            <p 
              className="text-xs tracking-widest uppercase"
              style={{ color: currentBanner.text_color, opacity: 0.7 }}
            >
              NOVEDADES
            </p>
            <h2 
              className={`font-bold leading-tight ${textSizes.title}`}
              style={{ color: currentBanner.text_color }}
            >
              {currentBanner.title}
            </h2>
            {currentBanner.subtitle && (
              <p 
                className={textSizes.subtitle}
                style={{ color: currentBanner.text_color }}
              >
                {currentBanner.subtitle}
              </p>
            )}
            {currentBanner.text && (
              <p 
                className={`font-medium ${textSizes.text}`}
                style={{ color: currentBanner.text_color }}
              >
                {currentBanner.text}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div 
      className="w-full px-4 mt-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-md">
        
        <AnimatePresence mode="wait">
          <motion.div
            key={`${index}-${currentBanner.id}`}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            <BannerContent />
          </motion.div>
        </AnimatePresence>

        {banners.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all hover:scale-110 z-10"
              aria-label="Anterior"
            >
              <ChevronLeft size={18} />
            </button>
            
            <button
              onClick={nextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow-md transition-all hover:scale-110 z-10"
              aria-label="Siguiente"
            >
              <ChevronRight size={18} />
            </button>
            
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`transition-all duration-200 rounded-full ${
                    i === index 
                      ? "w-6 sm:w-8 h-1.5 sm:h-2 bg-gray-800" 
                      : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gray-400 hover:bg-gray-600"
                  }`}
                  aria-label={`Ir al banner ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}