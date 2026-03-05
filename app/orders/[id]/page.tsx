// app/orders/[id]/page.tsx - VERSIÓN COMPLETA CON REENVÍO DE EMAIL
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
  MapPin, 
  CreditCard, 
  FileText, 
  Shield, 
  Loader2,
  Mail
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface OrderItem {
  id: number
  product_id: string
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
    delivery_instructions?: string
  }
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800" },
}

// Función para formatear precios en CLP
const formatCLP = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export default function OrderDetailPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const { toast } = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resendingEmail, setResendingEmail] = useState(false)

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!isAuthenticated) {
      console.log('🔐 Usuario no autenticado, redirigiendo a login')
      router.push("/login?from=" + encodeURIComponent(`/orders/${orderId}`))
      return
    }

    fetchOrder()
  }, [isAuthenticated, authLoading, router, orderId])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📦 Fetching order from MySQL:', orderId)
      const response = await fetch(`/api/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        console.log('✅ Order data received:', {
          id: orderData.id,
          order_number: orderData.order_number,
          items_count: orderData.items?.length || 0,
          status: orderData.status,
          payment_status: orderData.payment_status
        })
        setOrder(orderData)
      } else if (response.status === 404) {
        setError('Orden no encontrada')
      } else if (response.status === 401) {
        setError('No tienes permisos para ver esta orden')
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

  const handleResendEmail = async () => {
    setResendingEmail(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/resend-email`, {
        method: 'POST',
      })

      if (response.ok) {
        toast({
          title: "✅ Email reenviado",
          description: "El email de confirmación ha sido reenviado exitosamente",
          duration: 5000,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "❌ Error",
          description: errorData.error || "No se pudo reenviar el email",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error reenviando email:', error)
      toast({
        title: "❌ Error",
        description: "No se pudo reenviar el email. Inténtalo de nuevo.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setResendingEmail(false)
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

  // Mostrar loading mientras verifica autenticación
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
          <div className="flex gap-4 justify-center">
            <Link href="/orders">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Mis Pedidos
              </Button>
            </Link>
            <Button variant="outline" onClick={fetchOrder}>
              <Loader2 className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = statusInfo.icon

  // Preparar datos para mostrar
  const addressInfo = order.shipping_address || {
    street: "Dirección no especificada",
    commune_name: "Ciudad no especificada", 
    region_name: "Región no especificada",
    postal_code: "000000",
    department: "",
    delivery_instructions: ""
  }

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
                          src={getImageUrl(item.image_url)}
                          alt={item.product_name}
                          fill
                          className="object-cover rounded"
                          onError={(e) => {
                            // Fallback si la imagen no carga
                            const target = e.target as HTMLImageElement
                            target.src = "/placeholder.svg"
                          }}
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium">{item.product_name}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {item.category || "General"}
                        </Badge>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Cantidad: {item.quantity}</span>
                          <div className="text-right">
                            <div className="font-medium">{formatCLP(item.product_price * item.quantity)}</div>
                            <div className="text-xs text-muted-foreground">{formatCLP(item.product_price)} c/u</div>
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
                    <span>{formatCLP(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="text-muted-foreground">Descuento:</span>
                      <span>-{formatCLP(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envío:</span>
                    <span>{order.shipping === 0 ? "Gratis" : formatCLP(order.shipping)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA (19%):</span>
                    <span>{formatCLP(order.tax)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCLP(order.total)}</span>
                  </div>
                </div>

                {order.coupon_code && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
                    <p className="text-sm text-green-800">
                      <strong>Cupón aplicado:</strong> {order.coupon_code}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Dirección de Envío
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="font-medium">
                  {order.customer_first_name} {order.customer_last_name}
                </div>
                <div className="text-muted-foreground space-y-1">
                  <p>{addressInfo.street}</p>
                  <p>
                    {addressInfo.commune_name}, {addressInfo.region_name}
                  </p>
                  <p>Código Postal: {addressInfo.postal_code}</p>
                  <p>Teléfono: {order.customer_phone}</p>
                  <p>Email: {order.customer_email}</p>
                  {addressInfo.department && (
                    <p>Departamento: {addressInfo.department}</p>
                  )}
                  {addressInfo.delivery_instructions && (
                    <p className="text-sm mt-2">
                      <strong>Indicaciones:</strong> {addressInfo.delivery_instructions}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Método de Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">TB</span>
                  </div>
                  <div>
                    <div className="font-medium">Transbank Webpay</div>
                    <div className="text-sm text-muted-foreground">
                      {order.payment_status === 'paid' ? 'Pago completado' : 
                       order.payment_status === 'pending' ? 'Pago pendiente' :
                       order.payment_status === 'failed' ? 'Pago fallido' : 
                       'Estado del pago'}
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

            {/* Action Buttons */}
            <div className="space-y-3">
              {order.status === "delivered" && (
                <Link href="/">
                  <Button className="w-full">
                    Comprar de Nuevo
                  </Button>
                </Link>
              )}
              
              {/* Botón para reenviar email */}
              <Button 
                variant="outline" 
                className="w-full bg-transparent"
                onClick={handleResendEmail}
                disabled={resendingEmail}
              >
                {resendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Reenviar Email de Confirmación
                  </>
                )}
              </Button>
              
              <Button variant="outline" className="w-full bg-transparent">
                <FileText className="w-4 h-4 mr-2" />
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