"use client"

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/lib/auth-store'
import { useToast } from '@/hooks/use-toast'

interface FavoriteButtonProps {
  productId: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function FavoriteButton({ productId, className = '', size = 'md' }: FavoriteButtonProps) {
  const { isAuthenticated } = useAuthStore()
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  // Verificar si el producto está en favoritos
  useEffect(() => {
    if (!isAuthenticated) return

    const checkFavorite = async () => {
      try {
        const response = await fetch(`/api/user/favorites/check?productId=${productId}`)
        if (response.ok) {
          const data = await response.json()
          setIsFavorite(data.isFavorite)
        }
      } catch (error) {
        console.error('Error checking favorite:', error)
      }
    }

    checkFavorite()
  }, [productId, isAuthenticated])

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Inicia sesión",
        description: "Debes iniciar sesión para agregar favoritos",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    setLoading(true)
    const action = isFavorite ? 'remove' : 'add'

    try {
      const response = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action })
      })

      const data = await response.json()

      if (response.ok) {
        setIsFavorite(!isFavorite)
        toast({
          title: isFavorite ? 'Eliminado de favoritos' : 'Agregado a favoritos',
          description: isFavorite 
            ? 'Producto eliminado de tu lista de favoritos' 
            : 'Producto agregado a tu lista de favoritos',
          duration: 2000,
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo procesar la solicitud',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast({
        title: 'Error',
        description: 'Ocurrió un error al procesar tu solicitud',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Si no está autenticado, no mostrar el botón
  if (!isAuthenticated) return null

  return (
    <motion.button
      onClick={toggleFavorite}
      disabled={loading}
      className={`relative flex items-center justify-center rounded-full transition-colors ${sizeClasses[size]} ${className}`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", stiffness: 400 }}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, rotate: 0 }}
            animate={{ opacity: 1, rotate: 360 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
            className={`border-2 border-gray-400 border-t-transparent rounded-full ${iconSizes[size]}`}
          />
        ) : (
          <motion.div
            key={isFavorite ? 'filled' : 'empty'}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Heart 
              className={`${iconSizes[size]} transition-colors ${
                isFavorite 
                  ? 'fill-red-500 text-red-500' 
                  : 'text-gray-400 hover:text-red-500'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}