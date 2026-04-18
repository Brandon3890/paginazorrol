// components/cart-drawer.tsx - CORREGIDO
"use client"

import { useCartStore } from "@/lib/cart-store"
import { useProductStore } from "@/lib/product-store"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useRef, useEffect } from "react"
import { CheckoutResumeModal } from "@/components/checkout-resume-modal"
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
    toggleCart 
  } = useCartStore()
  
  const { user } = useAuthStore()
  const { incrementVersion } = useProductStore()
  const router = useRouter()
  const { toast } = useToast()
  
  const [removingItemId, setRemovingItemId] = useState<number | null>(null)
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [isCancellingCheckout, setIsCancellingCheckout] = useState(false)
  const [isUpdatingStock, setIsUpdatingStock] = useState(false)
  
  const currentItemsRef = useRef(items)

  useEffect(() => {
    currentItemsRef.current = items
  }, [items])

  const totalPrice = getTotalPrice()

  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Función para actualizar la reserva después de cambios en el carrito
  const updateStockReservation = async () => {
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
          // Recargar la página para refrescar el stock
          setTimeout(() => window.location.reload(), 2000)
        }
      }
    } catch (error) {
      console.error('Error actualizando reserva:', error)
    } finally {
      setIsUpdatingStock(false)
    }
  }

  const handleCheckout = () => {
    if (hasActiveCheckout()) {
      setShowResumeModal(true)
      return
    }

    proceedToCheckout()
  }

  const proceedToCheckout = () => {
    setIsCheckingOut(true)
    setCartOpen(false)
    
    setTimeout(() => {
      router.push("/checkout")
      setIsCheckingOut(false)
    }, 300)
  }

  const handleCancelCheckout = async () => {
    setIsCancellingCheckout(true)
    
    try {
      const itemsToRelease = currentItemsRef.current
      
      console.log('🔄 Cancelando checkout. Items a liberar:', itemsToRelease)

      if (itemsToRelease.length === 0) {
        setShowResumeModal(false)
        setIsCancellingCheckout(false)
        return
      }

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

      const data = await response.json()

      if (response.ok) {
        console.log('✅ Stock liberado correctamente')
        forceClearCart()
        endCheckout()
        incrementVersion()
        
        toast({
          title: "Proceso cancelado",
          description: "El stock ha sido liberado y el carrito se ha vaciado.",
          duration: 3000,
        })
        
        setShowResumeModal(false)
      } else {
        throw new Error(data.error || 'Error al liberar stock')
      }
    } catch (error) {
      console.error('❌ Error cancelando checkout:', error)
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

  const handleRemoveItem = async (id: number) => {
    setRemovingItemId(id)
    
    setTimeout(async () => {
      removeItem(id)
      setRemovingItemId(null)
      
      // Si hay checkout activo, actualizar reserva
      if (hasActiveCheckout() && user) {
        await updateStockReservation()
      }
    }, 300)
  }

  const handleUpdateQuantity = async (id: number, newQuantity: number) => {
    updateQuantity(id, newQuantity)
    
    // Si hay checkout activo, actualizar reserva
    if (hasActiveCheckout() && user) {
      setTimeout(() => updateStockReservation(), 100)
    }
  }

  const handleClearCart = async () => {
    // Si hay checkout activo, primero liberar stock
    if (hasActiveCheckout() && user && items.length > 0) {
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
        
        if (response.ok) {
          console.log('✅ Stock liberado antes de vaciar carrito')
        }
      } catch (error) {
        console.error('Error liberando stock:', error)
      }
    }

    const itemIds = items.map(item => item.id)
    itemIds.forEach((id, index) => {
      setTimeout(() => {
        setRemovingItemId(id)
        setTimeout(() => {
          if (index === itemIds.length - 1) {
            clearCart()
            endCheckout()
            setRemovingItemId(null)
            
            toast({
              title: "Carrito vaciado",
              description: "Todos los productos han sido eliminados",
              duration: 2000,
            })
          }
        }, 200)
      }, index * 100)
    })
  }

  if (items.length === 0) {
    return (
      <>
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

        <CheckoutResumeModal
          isOpen={showResumeModal}
          onClose={() => setShowResumeModal(false)}
          onConfirm={proceedToCheckout}
          onCancel={handleCancelCheckout}
          isCancelling={isCancellingCheckout}
        />
      </>
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
                  onClick={handleClearCart}
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

      <CheckoutResumeModal
        isOpen={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        onConfirm={proceedToCheckout}
        onCancel={handleCancelCheckout}
        isCancelling={isCancellingCheckout}
      />
    </>
  )
}