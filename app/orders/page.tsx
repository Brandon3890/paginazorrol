"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Package, Truck, CheckCircle, Clock, X, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface OrderItem {
  id: number
  product_name: string
  product_price: number
  quantity: number
  subtotal: number
  image_url?: string
  category?: string
}

interface Order {
  id: number
  order_number: string
  status: string
  payment_status: string
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  notes?: string
  coupon_code?: string
  shipping_method?: string
  created_at: string
  updated_at: string
  items: OrderItem[]
  customer_email: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  shipping_address?: {
    street: string
    commune_name: string
    region_name: string
    postal_code: string
    department?: string
  }
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800" },
}

export default function OrdersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    fetchOrders()
  }, [isAuthenticated, authLoading, router])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📦 Fetching orders from MySQL for user')
      const response = await fetch('/api/orders')
      
      if (response.ok) {
        const ordersData = await response.json()
        console.log('✅ Orders data received:', ordersData.length, 'orders')
        setOrders(ordersData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar las órdenes')
      }
    } catch (error) {
      console.error('❌ Error fetching orders:', error)
      setError('No se pudieron cargar los pedidos. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // Función para construir URLs completas de imágenes
  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "/placeholder.svg"
    
    // Si ya es una URL completa, usarla tal cual
    if (imagePath.startsWith('http')) {
      return imagePath
    }
    
    // Si es una ruta relativa que empieza con /uploads/, construir la URL completa
    if (imagePath.startsWith('/uploads/')) {
      return `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${imagePath}`
    }
    
    // Si es una ruta relativa sin /uploads/, agregar /uploads/
    if (imagePath.startsWith('/')) {
      return `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${imagePath}`
    }
    
    // Para cualquier otro caso, usar placeholder
    return "/placeholder.svg"
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando pedidos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-600 mb-6">{error}</p>
          </div>
          <Button onClick={fetchOrders}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const sortedOrders = orders.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a la tienda
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">Mis Pedidos</h1>
          <p className="text-muted-foreground">Revisa el estado de tus pedidos y el historial de compras</p>
        </div>

        {sortedOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tienes pedidos aún</h3>
              <p className="text-muted-foreground mb-6">Cuando realices tu primera compra, aparecerá aquí</p>
              <Link href="/">
                <Button>Explorar Productos</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
              const StatusIcon = statusInfo.icon

              return (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Pedido #{order.order_number}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Realizado el{" "}
                          {new Date(order.created_at).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {order.payment_status === 'paid' ? 'Pagado' : 
                           order.payment_status === 'pending' ? 'Pago pendiente' :
                           order.payment_status === 'failed' ? 'Pago fallido' : 
                           order.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Order Items */}
                    <div className="space-y-3">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item) => (
                          <div key={item.id} className="flex gap-3">
                            <div className="relative w-12 h-12 flex-shrink-0">
                              <Image
                                src={getImageUrl(item.image_url)}
                                alt={item.product_name}
                                fill
                                className="object-cover rounded"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = "/placeholder.svg"
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm line-clamp-2">{item.product_name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {item.category || "General"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">Cantidad: {item.quantity}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">${(item.product_price * item.quantity).toLocaleString('es-CL')}</div>
                              <div className="text-xs text-muted-foreground">${item.product_price.toLocaleString('es-CL')} c/u</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground">No hay productos en esta orden</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Order Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-2">Información de Envío</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            {order.customer_first_name} {order.customer_last_name}
                          </p>
                          {order.shipping_address ? (
                            <>
                              <p>{order.shipping_address.street}</p>
                              <p>
                                {order.shipping_address.commune_name}, {order.shipping_address.region_name}
                              </p>
                              <p>Código Postal: {order.shipping_address.postal_code}</p>
                            </>
                          ) : (
                            <p className="text-yellow-600">Dirección no especificada</p>
                          )}
                          <p>{order.customer_phone}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Resumen del Pedido</h4>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>${order.subtotal.toLocaleString('es-CL')}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span className="text-muted-foreground">Descuento:</span>
                              <span>-${order.discount.toLocaleString('es-CL')}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Envío:</span>
                            <span>
                              {order.shipping === 0 ? "Gratis" : `$${order.shipping.toLocaleString('es-CL')}`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">IVA (19%):</span>
                            <span>${order.tax.toLocaleString('es-CL')}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-medium">
                            <span>Total:</span>
                            <span>${order.total.toLocaleString('es-CL')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {order.notes && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Notas del Pedido</h4>
                          <p className="text-sm text-muted-foreground">{order.notes}</p>
                        </div>
                      </>
                    )}

                    {order.coupon_code && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-2">Cupón Aplicado</h4>
                          <p className="text-sm text-green-600">{order.coupon_code}</p>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between items-center pt-2">
                      <div className="text-xs text-muted-foreground">
                        Última actualización: {new Date(order.updated_at).toLocaleDateString("es-ES")}
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            Ver Detalles
                          </Button>
                        </Link>
                        {order.status === "delivered" && (
                          <Link href="/">
                            <Button size="sm">Comprar de Nuevo</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}