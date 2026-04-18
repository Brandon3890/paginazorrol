import { useState, useEffect, useCallback, useRef } from 'react'
import { useCartStore } from '@/lib/cart-store'
import { useAuthStore } from '@/lib/auth-store'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

const CHECKOUT_TIME = 10 * 60 * 1000 // 10 minutos en milisegundos

export const useCheckoutTimer = () => {
  const [timeLeft, setTimeLeft] = useState<number>(CHECKOUT_TIME)
  const [isExpired, setIsExpired] = useState<boolean>(false)
  const [isActive, setIsActive] = useState<boolean>(true)
  const [isReserving, setIsReserving] = useState<boolean>(false)
  const [reservationExpiresAt, setReservationExpiresAt] = useState<string | null>(null)
  const [hasReserved, setHasReserved] = useState<boolean>(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const reservationAttempted = useRef<boolean>(false)
  const purchaseConfirmed = useRef<boolean>(false)
  const isUpdatingReservation = useRef<boolean>(false)
  
  const { 
    items, 
    startCheckout, 
    endCheckout, 
    hasActiveCheckout, 
    checkoutExpiresAt, 
    resetCartAfterCheckout,
    updateReservationAfterCartChange
  } = useCartStore()
  const { user } = useAuthStore()
  const router = useRouter()
  const { toast } = useToast()

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    if (checkoutExpiresAt && hasActiveCheckout()) {
      const expiresAtDate = new Date(checkoutExpiresAt.replace(' ', 'T'))
      const now = new Date()
      const timeLeftMs = Math.max(0, expiresAtDate.getTime() - now.getTime())
      
      setTimeLeft(timeLeftMs)
      setReservationExpiresAt(checkoutExpiresAt)
      setHasReserved(true)
      reservationAttempted.current = true
      
      console.log('⏰ Checkout existente detectado, tiempo restante:', Math.floor(timeLeftMs/1000), 'segundos')
    }
  }, [checkoutExpiresAt, hasActiveCheckout])

  // Función para actualizar la reserva cuando cambia el carrito
  const updateReservation = useCallback(async () => {
    if (!user || items.length === 0 || !hasActiveCheckout() || isUpdatingReservation.current) {
      return
    }

    isUpdatingReservation.current = true
    
    try {
      const success = await updateReservationAfterCartChange(user.id)
      if (success && checkoutExpiresAt) {
        const expiresAtDate = new Date(checkoutExpiresAt.replace(' ', 'T'))
        const now = new Date()
        const timeLeftMs = Math.max(0, expiresAtDate.getTime() - now.getTime())
        setTimeLeft(timeLeftMs)
        setReservationExpiresAt(checkoutExpiresAt)
      }
    } catch (error) {
      console.error('Error actualizando reserva:', error)
    } finally {
      isUpdatingReservation.current = false
    }
  }, [user, items, hasActiveCheckout, updateReservationAfterCartChange, checkoutExpiresAt])

  // Escuchar cambios en el carrito para actualizar la reserva
  useEffect(() => {
    if (hasActiveCheckout() && user && items.length > 0) {
      const timeoutId = setTimeout(() => {
        updateReservation()
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
  }, [items, hasActiveCheckout, user, updateReservation])

  const releaseStock = useCallback(async () => {
    if (items.length === 0 || !user || purchaseConfirmed.current) return

    try {
      const response = await fetch('/api/cart/reserve-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            quantity: item.quantity
          })),
          action: 'release'
        })
      })

      if (response.ok) {
        console.log('✅ Stock liberado para usuario:', user.id)
        setHasReserved(false)
        reservationAttempted.current = false
        endCheckout()
      }
    } catch (error) {
      console.error('Error liberando stock:', error)
    }
  }, [items, user, endCheckout])

  const confirmPurchase = useCallback(async () => {
    if (items.length === 0 || !user || purchaseConfirmed.current) return

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
        console.log('✅ Compra confirmada para usuario:', user.id)
        setHasReserved(false)
        reservationAttempted.current = false
        endCheckout()
        resetCartAfterCheckout()
      }
    } catch (error) {
      console.error('Error confirmando compra:', error)
      purchaseConfirmed.current = false
    }
  }, [items, user, endCheckout, resetCartAfterCheckout])

  const expireCheckout = useCallback(async () => {
    if (purchaseConfirmed.current) return

    setIsActive(false)
    setIsExpired(true)
    
    await releaseStock()
    
    endCheckout()
    
    toast({
      title: "⏰ Tiempo agotado",
      description: "El tiempo para completar la compra ha expirado. Puedes volver a intentarlo cuando quieras.",
      variant: "destructive",
      duration: 5000,
    })
    
    setTimeout(() => {
      router.push('/cart')
    }, 2000)
  }, [releaseStock, endCheckout, router, toast])

  const resetTimer = useCallback(() => {
    setTimeLeft(CHECKOUT_TIME)
    setIsExpired(false)
    setIsActive(true)
    setHasReserved(false)
    reservationAttempted.current = false
    purchaseConfirmed.current = false
  }, [])

  // Crear reserva al iniciar
  useEffect(() => {
    const createReservation = async () => {
      if (purchaseConfirmed.current) {
        console.log('⏭️ Compra ya confirmada, omitiendo nueva reserva')
        return
      }

      if (hasActiveCheckout()) {
        console.log('⏭️ Checkout ya activo, omitiendo nueva reserva')
        return
      }

      if (reservationAttempted.current || hasReserved || items.length === 0 || !user) {
        return
      }

      reservationAttempted.current = true
      setIsReserving(true)

      try {
        console.log('🔄 Creando reserva de stock...')
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
            `${e.name}: disponible ${e.disponible || e.available}, solicitado ${e.solicitado || e.requested}`
          ).join(', ') || data.error

          toast({
            title: "⚠️ Stock insuficiente",
            description: errorMsg,
            variant: "destructive",
            duration: 7000,
          })
          
          setTimeout(() => {
            router.push('/')
          }, 3000)
          
          reservationAttempted.current = false
        } else {
          setReservationExpiresAt(data.expiresAt)
          setHasReserved(true)
          
          startCheckout(data.expiresAt)
          
          if (data.expiresAt) {
            const expiresAtDate = new Date(data.expiresAt.replace(' ', 'T'))
            const now = new Date()
            const timeLeftMs = Math.max(0, expiresAtDate.getTime() - now.getTime())
            setTimeLeft(timeLeftMs)
            console.log('✅ Stock reservado hasta:', data.expiresAt)
          }
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
    }

    createReservation()
  }, [items, user, router, toast, startCheckout, hasReserved, hasActiveCheckout])

  // Temporizador
  useEffect(() => {
    if (!isActive || isExpired || purchaseConfirmed.current) return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1000) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
          }
          expireCheckout()
          return 0
        }
        return prev - 1000
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isActive, isExpired, expireCheckout])

  // Liberar stock al salir de la página
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (items.length > 0 && !isExpired && user && hasReserved && !purchaseConfirmed.current) {
        const blob = new Blob(
          [JSON.stringify({
            items: items.map(item => ({
              id: item.id,
              quantity: item.quantity
            })),
            action: 'release'
          })], 
          { type: 'application/json' }
        )
        navigator.sendBeacon('/api/cart/reserve-stock', blob)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [items, isExpired, user, hasReserved])

  // Verificar tiempo restante periódicamente
  useEffect(() => {
    if (!reservationExpiresAt || isExpired || !hasReserved || purchaseConfirmed.current) return

    const checkExpiration = setInterval(() => {
      const expiresAtDate = new Date(reservationExpiresAt.replace(' ', 'T'))
      const now = new Date()
      
      if (now >= expiresAtDate && !isExpired) {
        expireCheckout()
      }
    }, 1000)

    return () => clearInterval(checkExpiration)
  }, [reservationExpiresAt, isExpired, expireCheckout, hasReserved])

  return {
    timeLeft,
    formattedTime: formatTime(timeLeft),
    isExpired,
    resetTimer,
    progress: (timeLeft / CHECKOUT_TIME) * 100,
    isReserving,
    hasReserved,
    reservationExpiresAt,
    releaseStock,
    confirmPurchase,
    updateReservation
  }
}