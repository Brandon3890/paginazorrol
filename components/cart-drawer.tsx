// components/cart-drawer.tsx
"use client"

import { useCartStore } from "@/lib/cart-store"
import { useProductStore } from "@/lib/product-store"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Trash2, ShoppingBag, Clock, AlertCircle } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useRef, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/lib/auth-store"

export function CartDrawer() {
  const { 
    items, 
    isOpen, 
    setCartOpen, 
    updateQuantity, 
    removeItem, 
    getTotalPrice, 
    clearCart, 
    forceClearCart,
    hasActiveCheckout, 
    endCheckout,
    checkoutExpiresAt
  } = useCartStore()
  
  const { user } = useAuthStore()
  const { incrementVersion } = useProductStore()
  const router = useRouter()
  const { toast } = useToast()
  
  const [removingItemId, setRemovingItemId] = useState<number | null>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [isCancellingCheckout, setIsCancellingCheckout] = useState(false)
  const [isUpdatingStock, setIsUpdatingStock] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  
  const currentItemsRef = useRef(items)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    currentItemsRef.current = items
  }, [items])

  // Actualizar reserva cuando cambian los items (solo si hay checkout activo)
  useEffect(() => {
    if (hasActiveCheckout() && user && items.length > 0) {
      const timeoutId = setTimeout(() => {
        updateFullReservation()
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [items, hasActiveCheckout, user])

  // Temporizador sincronizado con checkoutExpiresAt
  useEffect(() => {
    if (!hasActiveCheckout() || !checkoutExpiresAt) {
      setTimeLeft(null)
      return
    }

    const updateTimeLeft = () => {
      const expiresAtDate = new Date(checkoutExpiresAt.replace(' ', 'T'))
      const now = new Date()
      const diffMs = expiresAtDate.getTime() - now.getTime()
      
      if (diffMs <= 0) {
        setTimeLeft(0)
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

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const totalPrice = getTotalPrice()

  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const releaseSingleProductStock = async (productId: number, quantity: number, productName: string) => {
    if (!user || !hasActiveCheckout()) return false
    
    try {
      console.log(`🔄 Liberando stock de producto: ${productName} (${quantity} unidades)`)
      
      const response = await fetch('/api/cart/reserve-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            id: productId,
            quantity: quantity,
            name: productName
          }],
          action: 'release_single'
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error('❌ Error liberando stock:', error)
        return false
      }
      
      console.log(`✅ Stock liberado correctamente para ${productName}`)
      return true
      
    } catch (error) {
      console.error('❌ Error en releaseSingleProductStock:', error)
      return false
    }
  }

  const updateFullReservation = async () => {
    if (!hasActiveCheckout() || !user || items.length === 0) return
    
    setIsUpdatingStock(true)
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
          action: 'update'
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        if (data.errors) {
          toast({
            title: "⚠️ Stock insuficiente",
            description: data.errors.map((e: any) => `${e.name}: solo ${e.disponible} disponibles`).join(', '),
            variant: "destructive",
            duration: 5000,
          })
          setTimeout(() => window.location.reload(), 2000)
        }
      }
    } catch (error) {
      console.error('Error actualizando reserva:', error)
    } finally {
      setIsUpdatingStock(false)
    }
  }

  const handleRemoveItem = async (id: number) => {
    const itemToRemove = items.find(item => item.id === id)
    if (!itemToRemove) return
    
    setRemovingItemId(id)
    
    if (hasActiveCheckout() && user) {
      await releaseSingleProductStock(id, itemToRemove.quantity, itemToRemove.name)
    }
    
    setTimeout(async () => {
      removeItem(id)
      setRemovingItemId(null)
      
      if (items.length === 1 && hasActiveCheckout()) {
        endCheckout()
      }
    }, 300)
  }

  const handleUpdateQuantity = async (id: number, newQuantity: number) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    
    const oldQuantity = item.quantity
    const quantityDiff = newQuantity - oldQuantity
    
    if (hasActiveCheckout() && user && quantityDiff < 0) {
      const releaseQuantity = Math.abs(quantityDiff)
      await releaseSingleProductStock(id, releaseQuantity, item.name)
    }
    
    updateQuantity(id, newQuantity)
    
    if (hasActiveCheckout() && user && quantityDiff > 0) {
      setTimeout(() => updateFullReservation(), 100)
    }
  }

  // =====================================================
  // NUEVA FUNCIÓN: Vaciar carrito SIN confirmación (sin reserva activa)
  // =====================================================
  const handleClearCartDirect = () => {
    clearCart()
    endCheckout()
    toast({
      title: "Carrito vaciado",
      description: "Todos los productos han sido eliminados",
      duration: 3000,
    })
  }

  // =====================================================
  // Vaciar carrito CON confirmación (cuando hay reserva activa)
  // =====================================================
  const handleClearCartWithReservation = async () => {
    if (!hasActiveCheckout() || !user || items.length === 0) {
      // Si no hay reserva, vaciar directamente
      handleClearCartDirect()
      return
    }

    setShowCancelConfirm(true)
  }

  // Función real para vaciar con reserva (cuando el usuario confirma)
  const handleCancelAndClear = async () => {
    setIsCancellingCheckout(true)
    
    try {
      const itemsToRelease = currentItemsRef.current
      
      console.log('🔄 Cancelando y vaciando carrito. Items a liberar:', itemsToRelease)

      if (itemsToRelease.length > 0) {
        const response = await fetch('/api/cart/reserve-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: itemsToRelease.map(item => ({
              id: item.id,
              quantity: item.quantity,
              name: item.name
            })),
            action: 'release'
          })
        })

        if (!response.ok) {
          throw new Error('Error al liberar stock')
        }
      }

      forceClearCart()
      endCheckout()
      incrementVersion()
      
      toast({
        title: "Proceso cancelado",
        description: "El stock ha sido liberado y el carrito se ha vaciado.",
        duration: 3000,
      })
      
      setShowCancelConfirm(false)
    } catch (error) {
      console.error('❌ Error cancelando:', error)
      toast({
        title: "Error",
        description: "No se pudo liberar el stock. Intenta nuevamente.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsCancellingCheckout(false)
    }
  }

  const handleCheckout = () => {
    setIsCheckingOut(true)
    setCartOpen(false)
    
    setTimeout(() => {
      router.push("/checkout")
      setIsCheckingOut(false)
    }, 300)
  }

  // Carrito vacío
  if (items.length === 0) {
    return (
      <Sheet open={isOpen} onOpenChange={setCartOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Carrito de Compras</SheetTitle>
            <SheetDescription>Tu carrito está vacío</SheetDescription>
          </SheetHeader>
          <motion.div 
            className="flex flex-col items-center justify-center h-[60vh] text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatType: "reverse"
              }}
            >
              <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
            </motion.div>
            <motion.p 
              className="text-muted-foreground mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              No tienes productos en tu carrito
            </motion.p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button onClick={() => setCartOpen(false)}>Continuar Comprando</Button>
            </motion.div>
          </motion.div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setCartOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-6 pb-0">
            <SheetTitle>Carrito de Compras</SheetTitle>
            <SheetDescription>
              {items.length} producto{items.length !== 1 ? "s" : ""} en tu carrito
              {hasActiveCheckout() && (
                <Badge className="ml-2 bg-orange-500 animate-pulse">Pago pendiente</Badge>
              )}
              {isUpdatingStock && (
                <Badge className="ml-2 bg-blue-500 animate-pulse">Actualizando stock...</Badge>
              )}
            </SheetDescription>
          </SheetHeader>

          {/* Banner de temporizador - solo visible cuando hay reserva activa */}
          {hasActiveCheckout() && timeLeft !== null && timeLeft > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-6 mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Clock className="w-5 h-5 text-orange-600" />
                  </motion.div>
                  <div>
                    <p className="text-xs text-orange-800 font-medium">
                      Tienes una compra en proceso
                    </p>
                    <p className="text-lg font-bold text-orange-600 font-mono">
                      {formatTime(timeLeft)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                    onClick={handleClearCartWithReservation}
                    disabled={isCancellingCheckout}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-orange-600 hover:bg-orange-700"
                    onClick={handleCheckout}
                    disabled={isCheckingOut}
                  >
                    Continuar Pago
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Modal de confirmación - SOLO cuando hay reserva activa */}
          {showCancelConfirm && (
            <>
              <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowCancelConfirm(false)} />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-8 h-8" />
                      <div>
                        <h2 className="text-xl font-bold">Cancelar compra</h2>
                        <p className="text-sm opacity-90">¿Estás seguro de que deseas cancelar?</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-gray-600">
                      Si cancelas, el stock será liberado y el carrito se vaciará.
                      Tendrás que volver a agregar los productos si quieres comprar después.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={isCancellingCheckout}
                      >
                        Volver
                      </Button>
                      <Button
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        onClick={handleCancelAndClear}
                        disabled={isCancellingCheckout}
                      >
                        {isCancellingCheckout ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Cancelando...
                          </>
                        ) : (
                          "Sí, cancelar"
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </>
          )}

          <motion.div 
            className="flex-1 overflow-y-auto py-4 px-6"
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 25
                    }
                  }}
                  exit={{ 
                    opacity: 0, 
                    x: -50,
                    transition: {
                      duration: 0.2
                    }
                  }}
                  layout
                  className={`mb-4 transition-opacity duration-300 ${
                    removingItemId === item.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex gap-4 p-4 border rounded-lg relative overflow-hidden">
                    <AnimatePresence>
                      {removingItemId === item.id && (
                        <motion.div
                          className="absolute inset-0 bg-destructive/10 flex items-center justify-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-8 h-8 border-4 border-destructive border-t-transparent rounded-full"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div 
                      className="relative w-16 h-16 flex-shrink-0"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Image 
                        src={item.image || "/placeholder.svg"} 
                        alt={item.name} 
                        fill 
                        className="object-cover rounded" 
                      />
                    </motion.div>

                    <div className="flex-1 space-y-2">
                      <motion.h4 
                        className="font-medium text-sm line-clamp-2"
                        layout
                      >
                        {item.name}
                      </motion.h4>
                      
                      <motion.div layout>
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                      </motion.div>

                      <div className="flex items-center justify-between">
                        <motion.span 
                          className="font-bold text-primary"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 0.3 }}
                        >
                          {formatCLP(item.price)}
                        </motion.span>

                        <div className="flex items-center gap-2">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-8 h-8 bg-transparent"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              disabled={isUpdatingStock}
                            >
                              <motion.div
                                whileHover={{ rotate: 15, scale: 1.1 }}
                                whileTap={{ rotate: 0, scale: 0.9 }}
                              >
                                <Minus className="w-3 h-3" />
                              </motion.div>
                            </Button>
                          </motion.div>

                          <motion.span 
                            key={item.quantity}
                            className="w-8 text-center text-sm"
                            initial={{ scale: 0.8, opacity: 0.5 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            {item.quantity}
                          </motion.span>

                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-8 h-8 bg-transparent"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              disabled={isUpdatingStock}
                            >
                              <motion.div
                                whileHover={{ rotate: 15, scale: 1.1 }}
                                whileTap={{ rotate: 0, scale: 0.9 }}
                              >
                                <Plus className="w-3 h-3" />
                              </motion.div>
                            </Button>
                          </motion.div>

                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                              disabled={isUpdatingStock}
                            >
                              <motion.div
                                whileHover={{ rotate: 15, scale: 1.1 }}
                                whileTap={{ rotate: 0, scale: 0.9 }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </motion.div>
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          <motion.div 
            className="border-t pt-4 px-6 pb-6 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <motion.div 
              className="flex justify-between items-center"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-lg font-semibold">Total:</span>
              <motion.span 
                key={totalPrice}
                className="text-xl font-bold text-primary"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {formatCLP(totalPrice)}
              </motion.span>
            </motion.div>

            <div className="space-y-2">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  className="w-full relative overflow-hidden" 
                  size="lg" 
                  onClick={handleCheckout}
                  disabled={isCheckingOut || isUpdatingStock}
                >
                  <AnimatePresence mode="wait">
                    {isCheckingOut ? (
                      <motion.div
                        key="loading"
                        className="flex items-center justify-center"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                        />
                        <span>Procesando...</span>
                      </motion.div>
                    ) : (
                      <motion.span
                        key="normal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {hasActiveCheckout() ? "Continuar Pago" : "Proceder al Pago"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  variant="outline" 
                  className="w-full bg-transparent" 
                  onClick={() => setCartOpen(false)}
                  disabled={isUpdatingStock}
                >
                  Continuar Comprando
                </Button>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  variant="ghost" 
                  className="w-full text-destructive hover:text-destructive relative overflow-hidden"
                  onClick={handleClearCartWithReservation}
                  disabled={isUpdatingStock}
                >
                  <motion.span
                    animate={items.length > 0 && !hasActiveCheckout() ? {
                      rotate: [0, -5, 5, -5, 5, 0],
                    } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    Vaciar Carrito
                  </motion.span>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </SheetContent>
      </Sheet>
    </>
  )
}