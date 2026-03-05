"use client"

import { useCartStore } from "@/lib/cart-store"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"

export function CartDrawer() {
  const { items, isOpen, setCartOpen, updateQuantity, removeItem, getTotalPrice, clearCart } = useCartStore()
  const router = useRouter()

  const totalPrice = getTotalPrice()

  // Función para formatear números como moneda CLP
  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const handleCheckout = () => {
    setCartOpen(false)
    router.push("/checkout")
  }

  if (items.length === 0) {
    return (
      <Sheet open={isOpen} onOpenChange={setCartOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Carrito de Compras</SheetTitle>
            <SheetDescription>Tu carrito está vacío</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No tienes productos en tu carrito</p>
            <Button onClick={() => setCartOpen(false)}>Continuar Comprando</Button>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setCartOpen}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Carrito de Compras</SheetTitle>
          <SheetDescription>
            {items.length} producto{items.length !== 1 ? "s" : ""} en tu carrito
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <Image src={item.image || "/placeholder.svg"} alt={item.name} fill className="object-cover rounded" />
                </div>

                <div className="flex-1 space-y-2">
                  <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {item.category}
                  </Badge>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary">{formatCLP(item.price)}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-8 h-8 bg-transparent"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-8 h-8 bg-transparent"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-destructive hover:text-destructive"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Total:</span>
            <span className="text-xl font-bold text-primary">{formatCLP(totalPrice)}</span>
          </div>

          <div className="space-y-2">
            <Button className="w-full" size="lg" onClick={handleCheckout}>
              Proceder al Pago
            </Button>
            <Button variant="outline" className="w-full bg-transparent" onClick={() => setCartOpen(false)}>
              Continuar Comprando
            </Button>
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={clearCart}>
              Vaciar Carrito
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}