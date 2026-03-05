"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  X, 
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

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
  payment_method: string
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  notes?: string
  coupon_code?: string
  coupon_info?: any
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
    delivery_instructions?: string
    title?: string
  }
  transbank_info?: {
    authorization_code?: string
    payment_type?: string
    installments?: number
    card_number?: string
    transaction_date?: string
  }
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800 border-blue-200" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800 border-purple-200" },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800 border-red-200" },
}

export default function AdminOrderDetailPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    if (user?.role !== 'admin') {
      router.push("/orders")
      return
    }

    fetchOrder()
  }, [isAuthenticated, authLoading, router, user, orderId])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📦 Fetching order details for admin')
      const response = await fetch(`/api/admin/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        console.log('✅ Order details received:', orderData)
        setOrder(orderData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar los detalles del pedido')
      }
    } catch (error) {
      console.error('❌ Error fetching order details:', error)
      setError('No se pudieron cargar los detalles del pedido. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "/placeholder.svg"
    
    if (imagePath.startsWith('http')) {
      return imagePath
    }
    
    if (imagePath.startsWith('/uploads/')) {
      return `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${imagePath}`
    }
    
    if (imagePath.startsWith('/')) {
      return `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${imagePath}`
    }
    
    return "/placeholder.svg"
  }

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'transbank': return 'Transbank'
      case 'cash': return 'Efectivo'
      default: return method
    }
  }

  const formatPaymentType = (type: string) => {
    switch (type) {
      case 'VN': return 'Débito'
      case 'VC': return 'Crédito'
      case 'SI': return 'Cuotas'
      default: return type
    }
  }

  const formatInstallments = (installments: number | undefined) => {
    if (installments === undefined || installments === null) return 'No especificado'
    return installments === 0 ? 'Sin cuotas' : `${installments} cuota(s)`
  }

  const formatTransactionDate = (dateString: string | undefined) => {
    if (!dateString) return 'No disponible'
    
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch (error) {
      return 'Fecha inválida'
    }
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (user?.role !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando detalles del pedido...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-600 mb-6">{error}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button onClick={fetchOrder}>
              Reintentar
            </Button>
            <Link href="/admin/orders">
              <Button variant="outline">
                Volver a Pedidos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <Package className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-yellow-800 mb-2">Pedido no encontrado</h1>
            <p className="text-yellow-600 mb-6">El pedido solicitado no existe o no tienes permisos para verlo.</p>
            <Link href="/admin/orders">
              <Button variant="outline">
                Volver a Pedidos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = statusInfo.icon

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a todos los pedidos
          </Link>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Pedido #{order.order_number}</h1>
              <p className="text-muted-foreground">
                Realizado el {new Date(order.created_at).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Badge className={`${statusInfo.color} border text-sm`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {order.payment_status === 'paid' ? 'Pagado' : 
                 order.payment_status === 'pending' ? 'Pago pendiente' :
                 order.payment_status === 'failed' ? 'Pago fallido' : 
                 order.payment_status === 'refunded' ? 'Reembolsado' :
                 order.payment_status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* Columna izquierda - Información del cliente y envío */}
          <div className="xl:col-span-1 space-y-6">
            {/* Información del Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{order.customer_first_name} {order.customer_last_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm">{order.customer_email}</p>
                </div>
                {order.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm">{order.customer_phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dirección de Envío */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  Dirección de Envío
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.shipping_address ? (
                  <div className="space-y-2 text-sm">
                    {order.shipping_address.title && (
                      <p className="font-medium">{order.shipping_address.title}</p>
                    )}
                    <p>{order.shipping_address.street}</p>
                    <p>
                      {order.shipping_address.commune_name}, {order.shipping_address.region_name}
                    </p>
                    <p>Código Postal: {order.shipping_address.postal_code}</p>
                    {order.shipping_address.department && (
                      <p>Departamento: {order.shipping_address.department}</p>
                    )}
                    {order.shipping_address.delivery_instructions && (
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs font-medium text-blue-800">Instrucciones de entrega:</p>
                        <p className="text-xs text-blue-700">{order.shipping_address.delivery_instructions}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Dirección no especificada</p>
                )}
              </CardContent>
            </Card>

            {/* Información de Pago */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5" />
                  Información de Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método:</span>
                  <span>{formatPaymentMethod(order.payment_method)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className={
                    order.payment_status === 'paid' ? 'text-green-600 font-medium' :
                    order.payment_status === 'pending' ? 'text-yellow-600 font-medium' :
                    order.payment_status === 'failed' ? 'text-red-600 font-medium' :
                    'text-muted-foreground'
                  }>
                    {order.payment_status === 'paid' ? 'Pagado' : 
                     order.payment_status === 'pending' ? 'Pendiente' :
                     order.payment_status === 'failed' ? 'Fallido' : 
                     order.payment_status === 'refunded' ? 'Reembolsado' :
                     order.payment_status}
                  </span>
                </div>

                {order.transbank_info && (
                  <>
                    {order.transbank_info.authorization_code && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Código de autorización:</span>
                        <span className="font-mono">{order.transbank_info.authorization_code}</span>
                      </div>
                    )}
                    {order.transbank_info.payment_type && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo de pago:</span>
                        <span>{formatPaymentType(order.transbank_info.payment_type)}</span>
                      </div>
                    )}
                    {(order.transbank_info.installments !== undefined && order.transbank_info.installments !== null) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cuotas:</span>
                        <span>{formatInstallments(order.transbank_info.installments)}</span>
                      </div>
                    )}
                    {order.transbank_info.card_number && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tarjeta:</span>
                        <span className="font-mono">****{order.transbank_info.card_number}</span>
                      </div>
                    )}
                    {order.transbank_info.transaction_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha transacción:</span>
                        <span className="text-xs">{formatTransactionDate(order.transbank_info.transaction_date)}</span>
                      </div>
                    )}
                  </>
                )}

                {order.coupon_info && (
                  <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-xs font-medium text-green-800">Cupón aplicado:</p>
                    <p className="text-xs text-green-700">{order.coupon_info.code} ({order.coupon_info.discount_percentage}% descuento)</p>
                    <p className="text-xs text-green-600">Tipo: {order.coupon_info.type}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha - Productos y resumen */}
          <div className="xl:col-span-2 space-y-6">
            {/* Productos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Productos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <div key={item.id} className="flex gap-4 p-3 bg-muted/30 rounded-lg">
                        <div className="relative w-16 h-16 flex-shrink-0">
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
                          <h4 className="font-medium text-sm lg:text-base line-clamp-2">{item.product_name}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {item.category || "General"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">Cantidad: {item.quantity}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-sm lg:text-base">
                            ${(item.product_price * item.quantity).toLocaleString('es-CL')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${item.product_price.toLocaleString('es-CL')} c/u
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No hay productos en esta orden</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Resumen del Pedido */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
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
                  <div className="flex justify-between font-medium text-base">
                    <span>Total:</span>
                    <span>${order.total.toLocaleString('es-CL')}</span>
                  </div>
                </div>

                {order.notes && (
                  <div className="mt-6 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs font-medium text-blue-800 mb-1">Notas del pedido:</p>
                    <p className="text-sm text-blue-700">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}