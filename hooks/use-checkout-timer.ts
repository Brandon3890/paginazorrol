// hooks/use-checkout-timer.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import { useCartStore } from '@/lib/cart-store'
import { useAuthStore } from '@/lib/auth-store'
import { useGuestStore } from '@/lib/guest-store'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

const CHECKOUT_TIME = 10 * 60 * 1000

export const useCheckoutTimer = () => {
  const [timeLeft, setTimeLeft] = useState<number>(CHECKOUT_TIME)
  const [isExpired, setIsExpired] = useState<boolean>(false)
  const [isReserving, setIsReserving] = useState<boolean>(false)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const reservationAttempted = useRef<boolean>(false)
  const purchaseConfirmed = useRef<boolean>(false)
  const expiryProcessed = useRef<boolean>(false)
  const initialExpiresAt = useRef<string | null>(null)
  
  const { 
    items, 
    startCheckout, 
    endCheckout, 
    hasActiveCheckout, 
    checkoutExpiresAt, 
    resetCartAfterCheckout,
    clearCart
  } = useCartStore()
  const { user, isAuthenticated } = useAuthStore()
  const { getGuestSession } = useGuestStore()
  const router = useRouter()
  const { toast } = useToast()

  const getIdentifier = useCallback(() => {
    if (isAuthenticated && user) {
      return `user_${user.id}`
    }
    const guest = getGuestSession()
    if (guest) {
      return `guest_${guest.sessionId}`
    }
    return null
  }, [isAuthenticated, user, getGuestSession])

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0')
  }

  useEffect(() => {
    if (!hasActiveCheckout() || !checkoutExpiresAt) {
      setTimeLeft(CHECKOUT_TIME)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const updateTimeLeft = () => {
      const expiresAtDate = new Date(checkoutExpiresAt.replace(' ', 'T'))
      const now = new Date()
      const diffMs = expiresAtDate.getTime() - now.getTime()
      
      if (diffMs <= 0) {
        setTimeLeft(0)
        setIsExpired(true)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      } else {
        setTimeLeft(diffMs)
      }
    }

    updateTimeLeft()
    timerRef.current = setInterval(updateTimeLeft, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [hasActiveCheckout, checkoutExpiresAt])

  const releaseStockAndClearCart = useCallback(async () => {
    if (expiryProcessed.current || purchaseConfirmed.current) return
    expiryProcessed.current = true
    
    console.log('Liberando stock y limpiando carrito...')
    
    if (items.length === 0) {
      clearCart()
      endCheckout()
      initialExpiresAt.current = null
      return
    }

    const identifier = getIdentifier()
    if (!identifier) {
      console.log('No hay identifier, limpiando carrito sin liberar stock')
      clearCart()
      endCheckout()
      return
    }

    try {
      const response = await fetch('/api/cart/reserve-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            quantity: item.quantity,
            name: item.name
          })),
          action: 'release'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Error liberando stock:', error)
      }
      
      clearCart()
      endCheckout()
      initialExpiresAt.current = null
      
    } catch (error) {
      console.error('Error en releaseStockAndClearCart:', error)
    }
  }, [items, clearCart, endCheckout, getIdentifier])

  const expireCheckout = useCallback(async () => {
    if (expiryProcessed.current || purchaseConfirmed.current) return
    
    setIsExpired(true)
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    await releaseStockAndClearCart()
    
    toast({
      title: "Tiempo agotado",
      description: "El tiempo para completar la compra ha expirado.",
      variant: "destructive",
      duration: 3000,
    })
    
    setTimeout(() => {
      router.push('/')
    }, 2500)
  }, [releaseStockAndClearCart, router, toast])

  const updateReservation = useCallback(async () => {
    if (!hasActiveCheckout() || items.length === 0) return

    const identifier = getIdentifier()
    if (!identifier) return

    try {
      console.log('Actualizando reserva...')
      const response = await fetch('/api/cart/reserve-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            quantity: item.quantity,
            name: item.name
          })),
          action: 'update'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.errors?.map((e: any) => 
          e.name + ': disponible ' + e.disponible + ', solicitado ' + e.solicitado
        ).join(', ') || data.error

        toast({
          title: "Stock insuficiente",
          description: errorMsg,
          variant: "destructive",
          duration: 5000,
        })
        
        setTimeout(() => {
          router.push('/')
        }, 3000)
      }
    } catch (error) {
      console.error('Error actualizando reserva:', error)
    }
  }, [items, hasActiveCheckout, router, toast, getIdentifier])

  const createReservation = useCallback(async () => {
    if (purchaseConfirmed.current || items.length === 0) return
    if (hasActiveCheckout()) return

    const identifier = getIdentifier()
    if (!identifier) {
      console.log('No hay identifier, no se puede reservar stock')
      return
    }

    reservationAttempted.current = true
    setIsReserving(true)

    try {
      console.log('Creando nueva reserva para:', identifier)
      const response = await fetch('/api/cart/reserve-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            quantity: item.quantity,
            name: item.name
          })),
          action: 'reserve'
        })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.errors?.map((e: any) => 
          e.name + ': disponible ' + e.disponible + ', solicitado ' + e.solicitado
        ).join(', ') || data.error

        toast({
          title: "Stock insuficiente",
          description: errorMsg,
          variant: "destructive",
          duration: 7000,
        })
        
        setTimeout(() => {
          router.push('/')
        }, 3000)
        
        reservationAttempted.current = false
      } else {
        startCheckout(data.expiresAt)
        console.log('Reserva creada, expira:', data.expiresAt)
      }
    } catch (error) {
      console.error('Error creando reserva:', error)
      toast({
        title: "Error",
        description: "No se pudo reservar el stock. Intenta nuevamente.",
        variant: "destructive",
      })
      reservationAttempted.current = false
    } finally {
      setIsReserving(false)
    }
  }, [items, router, toast, startCheckout, hasActiveCheckout, getIdentifier])

  useEffect(() => {
    if (hasActiveCheckout() && items.length > 0 && !expiryProcessed.current && !purchaseConfirmed.current) {
      const timeoutId = setTimeout(() => {
        updateReservation()
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
  }, [items, hasActiveCheckout, updateReservation])

  useEffect(() => {
    if (!hasActiveCheckout() && !reservationAttempted.current && items.length > 0 && !purchaseConfirmed.current && !expiryProcessed.current) {
      const identifier = getIdentifier()
      if (identifier) {
        createReservation()
      }
    }
  }, [hasActiveCheckout, items, createReservation, getIdentifier])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && hasActiveCheckout() && checkoutExpiresAt && !purchaseConfirmed.current && !expiryProcessed.current) {
        const expiresAtDate = new Date(checkoutExpiresAt.replace(' ', 'T'))
        const now = new Date()
        const diffMs = expiresAtDate.getTime() - now.getTime()
        
        if (diffMs <= 0) {
          expireCheckout()
        } else {
          setTimeLeft(diffMs)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [hasActiveCheckout, checkoutExpiresAt, expireCheckout])

  const confirmPurchase = useCallback(async () => {
    if (items.length === 0 || purchaseConfirmed.current) return

    const identifier = getIdentifier()
    if (!identifier) return

    purchaseConfirmed.current = true

    try {
      const response = await fetch('/api/cart/reserve-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            quantity: item.quantity
          })),
          action: 'confirm'
        })
      })

      if (response.ok) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        endCheckout()
        resetCartAfterCheckout()
      } else {
        const error = await response.json()
        console.error('Error confirmando compra:', error)
        purchaseConfirmed.current = false
      }
    } catch (error) {
      console.error('Error confirmando compra:', error)
      purchaseConfirmed.current = false
    }
  }, [items, endCheckout, resetCartAfterCheckout, getIdentifier])

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimeLeft(CHECKOUT_TIME)
    setIsExpired(false)
    reservationAttempted.current = false
    purchaseConfirmed.current = false
    expiryProcessed.current = false
    initialExpiresAt.current = null
  }, [])

  const progress = (timeLeft / CHECKOUT_TIME) * 100

  return {
    timeLeft,
    formattedTime: formatTime(timeLeft),
    isExpired,
    resetTimer,
    progress,
    isReserving,
    confirmPurchase
  }
}