"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Package, Truck, CheckCircle, Clock, X, Loader2, Sparkles, Store } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

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
  shipping_type?: 'standard' | 'express' | 'home_delivery' | 'branch_pickup' | 'cash_on_delivery' | 'bodega_pickup'
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
    isBodega?: boolean
  }
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800 border-blue-200" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800 border-purple-200" },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800 border-red-200" },
}

//  Función para obtener el método de envío mostrado
const getShippingMethodDisplay = (order: Order) => {
  const shippingType = order.shipping_type || ''
  
  switch (shippingType) {
    case 'bodega_pickup':
      return 'Retiro en Bodega'
    case 'branch_pickup':
      return 'Retiro en Sucursal'
    case 'home_delivery':
      return 'Envío a Domicilio'
    case 'cash_on_delivery':
      return 'Envío por Pagar'
    case 'express':
      return 'Envío Express'
    case 'standard':
      return 'Envío Estándar'
    default:
      return order.shipping_method || 'Método no especificado'
  }
}

//  Función para obtener el título de la sección de envío
const getShippingTitle = (order: Order) => {
  const shippingType = order.shipping_type || ''
  
  switch (shippingType) {
    case 'bodega_pickup':
      return 'Información de Bodega'
    case 'branch_pickup':
      return 'Información de Sucursal'
    case 'home_delivery':
      return 'Información de Envío'
    case 'cash_on_delivery':
      return 'Información de Envío'
    case 'express':
      return 'Información de Envío'
    case 'standard':
      return 'Información de Envío'
    default:
      return 'Información de Envío'
  }
}

// Función para calcular Neto e IVA desde un monto que ya incluye IVA
const calculateTaxBreakdown = (amountWithIVA: number) => {
  const neto = Math.round(amountWithIVA / 1.19)
  const iva = amountWithIVA - neto
  return { neto, iva }
}

export default function OrdersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const formatPrice = (price: number) => {
    if (isNaN(price) || price === undefined || price === null) return '$0'
    return '$' + price.toLocaleString('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  }

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
      
      const response = await fetch('/api/orders')
      
      if (response.ok) {
        const ordersData = await response.json()
        setOrders(ordersData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar las ordenes')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      setError('No se pudieron cargar los pedidos. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const getImageUrl = (url?: string) => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith("http")) return url
    if (url.startsWith("/")) return url
    if (url.startsWith("uploads/")) return `/${url}`
    return `/uploads/products/${url}`
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando autenticacion...</p>
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            Mis Pedidos
            <Sparkles className="w-6 h-6 text-orange-500" />
          </h1>
          <p className="text-muted-foreground">Revisa el estado de tus pedidos y el historial de compras</p>
        </div>

        {sortedOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tienes pedidos aun</h3>
              <p className="text-muted-foreground mb-6">Cuando realices tu primera compra, aparecera aqui</p>
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
              const { neto: subtotalNeto, iva: subtotalIVA } = calculateTaxBreakdown(order.subtotal)
              
              //  OBTENER MÉTODO DE ENVÍO Y TÍTULO
              const shippingMethodDisplay = getShippingMethodDisplay(order)
              const shippingTitle = getShippingTitle(order)
              const isBodega = order.shipping_type === 'bodega_pickup'
              const isBranch = order.shipping_type === 'branch_pickup'
              const isHomeDelivery = order.shipping_type === 'home_delivery'

              return (
                <Card key={order.id} className="overflow-hidden">
                  <div className={`h-1 bg-gradient-to-r ${
                    order.status === 'delivered' ? 'from-green-500 to-green-400' :
                    order.status === 'cancelled' ? 'from-red-500 to-red-400' :
                    order.status === 'shipped' ? 'from-purple-500 to-purple-400' :
                    order.status === 'processing' ? 'from-blue-500 to-blue-400' :
                    'from-yellow-500 to-yellow-400'
                  }`} />

                  <CardHeader>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
                        <Badge className={`${statusInfo.color} border`}>
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
                    <div className="space-y-3">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item) => {
                          const itemTotal = item.product_price * item.quantity
                          
                          return (
                            <div key={item.id} className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
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
                                <div className="font-medium">{formatPrice(itemTotal)}</div>
                                <div className="text-xs text-muted-foreground">{formatPrice(item.product_price)} c/u</div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground">No hay productos en esta orden</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        {/*  TÍTULO DINÁMICO SEGÚN EL TIPO DE ENVÍO */}
                        <h4 className="font-medium mb-2">{shippingTitle}</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p className="font-medium text-foreground">
                            {order.customer_first_name} {order.customer_last_name}
                          </p>
                          
                          {/*  MOSTRAR MÉTODO DE ENVÍO */}
                          <p className="text-xs text-muted-foreground">
                             {shippingMethodDisplay}
                          </p>
                          
                          {order.shipping_address ? (
                            <>
                              {isBodega ? (
                                //  DIRECCIÓN DE BODEGA - MISMO FORMATO
                                <>
                                  <p>Arcangel 1200, San Miguel</p>
                                  <p>San Miguel, Región Metropolitana</p>
                                  <p>Código Postal: 8900000</p>
                                  <p className="text-xs text-muted-foreground">Horario: Lunes a Viernes 10:00 - 18:00 hrs</p>
                                </>
                              ) : isBranch ? (
                                //  DIRECCIÓN DE SUCURSAL - MISMO FORMATO
                                <>
                                  <p>{order.shipping_address.street}</p>
                                  <p>
                                    {order.shipping_address.commune_name}, {order.shipping_address.region_name}
                                  </p>
                                  <p>Código Postal: {order.shipping_address.postal_code}</p>
                                </>
                              ) : (
                                //  DIRECCIÓN NORMAL - MISMO FORMATO
                                <>
                                  <p>{order.shipping_address.street}</p>
                                  <p>
                                    {order.shipping_address.commune_name}, {order.shipping_address.region_name}
                                  </p>
                                  <p>Código Postal: {order.shipping_address.postal_code}</p>
                                </>
                              )}
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
                            <span>{formatPrice(order.subtotal)}</span>
                          </div>
                          <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                            <span>Neto (sin IVA):</span>
                            <span>{formatPrice(subtotalNeto)}</span>
                          </div>
                          <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                            <span>IVA (19%):</span>
                            <span>{formatPrice(subtotalIVA)}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span className="text-muted-foreground">Descuento:</span>
                              <span>-{formatPrice(order.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Envío:</span>
                            <span>
                              {order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}
                            </span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-medium">
                            <span>Total:</span>
                            <span>{formatPrice(order.total)}</span>
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

                    <Separator />

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
                      <div className="text-xs text-muted-foreground">
                        Última actualización: {new Date(order.updated_at).toLocaleDateString("es-ES")}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Link href={`/orders/${order.id}`} className="flex-1 sm:flex-initial">
                          <Button variant="outline" size="sm" className="w-full sm:w-auto">
                            Ver Detalles
                          </Button>
                        </Link>
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