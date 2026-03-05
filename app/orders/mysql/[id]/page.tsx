// app/orders/mysql/[id]/page.tsx - COMPLETO Y CORREGIDO
"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Package, Truck, CheckCircle, Clock, X, MapPin, CreditCard, FileText, Shield, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"

interface OrderItem {
  id: number
  product_name: string
  product_price: number
  quantity: number
  subtotal: number
  image?: string
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
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800" },
}

export default function MySQLOrderDetailPage() {
  const { user, isAuthenticated, isLoading } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Esperar a que la verificación de autenticación termine
    if (isLoading) {
      return
    }

    if (!isAuthenticated) {
      console.log('🔐 Usuario no autenticado, redirigiendo a login')
      router.push('/login?from=' + encodeURIComponent(`/orders/mysql/${orderId}`))
      return
    }

    fetchOrder()
  }, [isAuthenticated, isLoading, router, orderId])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📦 Fetching order from MySQL:', orderId)
      const response = await fetch(`/api/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        console.log('✅ Order data received:', orderData)
        setOrder(orderData)
      } else if (response.status === 404) {
        setError('Orden no encontrada')
      } else if (response.status === 401) {
        setError('No tienes permisos para ver esta orden')
        // El middleware ya debería haber redirigido, pero por si acaso
        router.push('/login')
      } else if (response.status === 403) {
        setError('No tienes acceso a esta orden')
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar la orden')
      }
    } catch (error) {
      console.error('❌ Error fetching order:', error)
      setError('No se pudo cargar la información del pedido. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // Mostrar loading mientras verifica autenticación
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Redirigiendo al login...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando orden...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-600 mb-6">{error || 'Orden no encontrada'}</p>
          </div>
          <Link href="/orders">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Mis Pedidos
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = statusInfo.icon

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Mis Pedidos
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Pedido #{order.order_number}</h1>
              <p className="text-muted-foreground">
                Realizado el{" "}
                {new Date(order.created_at).toLocaleDateString("es-CL", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Badge className={`${statusInfo.color} text-base px-3 py-1`}>
              <StatusIcon className="w-4 h-4 mr-2" />
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Productos Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 border rounded-lg">
                      <div className="relative w-16 h-16 flex-shrink-0">
                        <Image
                          src={item.image || "/placeholder.svg"}
                          alt={item.product_name}
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium">{item.product_name}</h4>
                        {item.category && (
                          <Badge variant="secondary" className="text-xs">
                            {item.category}
                          </Badge>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Cantidad: {item.quantity}</span>
                          <div className="text-right">
                            <div className="font-medium">${(item.product_price * item.quantity).toLocaleString('es-CL')}</div>
                            <div className="text-xs text-muted-foreground">${item.product_price.toLocaleString('es-CL')} c/u</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay productos en esta orden</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {order.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Notas del Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{order.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
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
                    <span>{order.shipping === 0 ? "Gratis" : `$${order.shipping.toLocaleString('es-CL')}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA (19%):</span>
                    <span>${order.tax.toLocaleString('es-CL')}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>${order.total.toLocaleString('es-CL')}</span>
                  </div>
                </div>

                {order.coupon_code && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                    <p className="text-sm text-green-800">
                      <strong>Cupón aplicado:</strong> {order.coupon_code}
                    </p>
                  </div>
                )}

                {order.shipping_method && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                    <p className="text-sm text-blue-800">
                      <strong>Método de envío:</strong> {order.shipping_method}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Estado del Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">TB</span>
                  </div>
                  <div>
                    <div className="font-medium">Transbank Webpay</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {order.payment_status === 'paid' ? 'Pago completado' : 
                       order.payment_status === 'pending' ? 'Pago pendiente' :
                       order.payment_status === 'failed' ? 'Pago fallido' : 
                       order.payment_status}
                    </div>
                  </div>
                </div>
                {order.payment_status === 'paid' && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2">
                    <p className="text-xs text-green-800 text-center">
                      ✅ Pago verificado y confirmado
                    </p>
                  </div>
                )}
                {order.payment_status === 'pending' && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                    <p className="text-xs text-yellow-800 text-center">
                      ⏳ Pago pendiente de confirmación
                    </p>
                  </div>
                )}
                {order.payment_status === 'failed' && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs text-red-800 text-center">
                      ❌ Pago fallido o cancelado
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Información de la Orden
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Número de orden:</span>
                  <span className="font-mono">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className="capitalize">{order.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Creado:</span>
                  <span>{new Date(order.created_at).toLocaleDateString('es-CL')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actualizado:</span>
                  <span>{new Date(order.updated_at).toLocaleDateString('es-CL')}</span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {order.status === "delivered" && (
                <Link href="/">
                  <Button className="w-full">
                    Comprar de Nuevo
                  </Button>
                </Link>
              )}
              <Button variant="outline" className="w-full bg-transparent">
                Descargar Factura
              </Button>
              <Link href="/orders">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Ver Todos mis Pedidos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}