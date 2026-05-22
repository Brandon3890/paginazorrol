// app/order-success/OrderSuccessContent.tsx
"use client"

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Package,
  Loader2,
  FileText,
  Download,
  Eye,
  Mail,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { useCartStore } from '@/lib/cart-store'
import { useToast } from '@/hooks/use-toast'

interface Order {
  id: number
  order_number: string
  status: string
  total: number
  created_at: string
  payment_status: string
  customer_email?: string
  customer_first_name?: string
  customer_last_name?: string
  customer_phone?: string
  customer_rut?: string
  boleta_folio?: string
  boleta_emitida?: number
  items?: Array<{
    id: number
    product_name: string
    product_price: number
    quantity: number
    subtotal: number
    image_url?: string
  }>
}

export default function OrderSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { clearCart, items, resetCartAfterCheckout } = useCartStore()

  // Estados
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [cartCleared, setCartCleared] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  // Obtener parámetros de URL
  const status = searchParams.get('status')
  const orderId = searchParams.get('orderId')
  const message = searchParams.get('message')
  const reason = searchParams.get('reason')

  // Función para obtener la orden
  const fetchOrder = useCallback(async (id: string, attempt = 0) => {
    const maxRetries = 3
    const delay = (attempt: number) => new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))

    try {
      setLoading(true)
      setError(null)

      console.log(`📡 Fetching order ${id} (attempt ${attempt + 1}/${maxRetries + 1})...`)

      const response = await fetch(`/api/orders/${id}`, {
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log(`📡 Response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Error response: ${response.status} - ${errorText}`)
        
        // Reintentar si es error 5xx o 429
        if (response.status >= 500 || response.status === 429) {
          if (attempt < maxRetries) {
            console.log(`🔄 Retrying in ${delay}ms...`)
            await delay(attempt)
            return fetchOrder(id, attempt + 1)
          }
        }
        
        throw new Error(`Error ${response.status}: ${errorText.substring(0, 100)}`)
      }

      const data = await response.json()
      console.log('✅ Order fetched successfully:', data)
      
      setOrder(data)
      
      // Limpiar carrito solo una vez y solo en caso de éxito
      if (!cartCleared && status === 'success') {
        console.log('🧹 Clearing cart after successful order...')
        resetCartAfterCheckout()
        setCartCleared(true)
      }
      
    } catch (err: any) {
      console.error('❌ Error fetching order:', err)
      
      // Reintentar si es posible
      if (attempt < maxRetries) {
        console.log(`🔄 Retrying fetch in ${delay}ms...`)
        await delay(attempt)
        return fetchOrder(id, attempt + 1)
      }
      
      setError(err.message || 'No se pudo cargar la información del pedido')
    } finally {
      setLoading(false)
    }
  }, [status, cartCleared, resetCartAfterCheckout])

  // Efecto para cargar la orden
  useEffect(() => {
    // Validar parámetros requeridos
    if (!orderId) {
      if (!status) {
        // Sin parámetros, redirigir al inicio
        router.push('/')
        return
      }
      // Tiene status pero no orderId (caso de cancelación sin orden)
      setLoading(false)
      return
    }

    // Cargar la orden
    fetchOrder(orderId, retryCount)
  }, [orderId, fetchOrder, retryCount, router, status])

  // Efecto para limpiar el carrito solo cuando es necesario
  useEffect(() => {
    // Solo limpiar si es pago exitoso y el carrito tiene items
    if (status === 'success' && !cartCleared && items.length > 0) {
      console.log('🧹 Limpiando carrito después de compra exitosa...')
      resetCartAfterCheckout()
      setCartCleared(true)
    }
  }, [status, items.length, cartCleared, resetCartAfterCheckout])

  // Función para reintentar
  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
  }

  // Función para descargar PDF
  const handleDownloadPDF = async () => {
    const folio = order?.boleta_folio
    if (!folio) {
      toast({
        title: "Error",
        description: "No hay boleta disponible para descargar",
        variant: "destructive"
      })
      return
    }

    try {
      setDownloadLoading(true)
      console.log(`📄 Descargando PDF para folio: ${folio}`)
      
      const response = await fetch(`/api/simplefactura/pdf?folio=${folio}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Error ${response.status}: ${errorText}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `boleta-${folio}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Éxito",
        description: "PDF descargado correctamente",
      })
    } catch (error: any) {
      console.error('Error descargando PDF:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo descargar el PDF",
        variant: "destructive"
      })
    } finally {
      setDownloadLoading(false)
    }
  }

  // Función para ver PDF
  const handleViewPDF = () => {
    const folio = order?.boleta_folio
    if (!folio) {
      toast({
        title: "Error",
        description: "No hay boleta disponible para visualizar",
        variant: "destructive"
      })
      return
    }
    
    window.open(`/api/simplefactura/pdf?folio=${folio}`, '_blank')
  }

  // Función para reenviar email
  const handleResendEmail = async () => {
    if (!order?.id) return

    try {
      setResendLoading(true)
      console.log(`📧 Reenviando email para orden: ${order.id}`)
      
      const response = await fetch(`/api/orders/${order.id}/resend-email`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast({
          title: "Email reenviado",
          description: data.message || "El email ha sido reenviado correctamente",
        })
      } else {
        throw new Error(data.error || "Error al reenviar el email")
      }
    } catch (error: any) {
      console.error('Error reenviando email:', error)
      toast({
        title: "Error",
        description: error.message || "No se pudo reenviar el email",
        variant: "destructive"
      })
    } finally {
      setResendLoading(false)
    }
  }

  // Configuración según el estado
  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: CheckCircle,
          title: '¡Pago Exitoso!',
          description: 'Tu pedido ha sido procesado correctamente. Te hemos enviado un email con los detalles.',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-200',
          badge: <Badge className="bg-green-100 text-green-800 border-green-200">Completado</Badge>
        }
      case 'cancelled':
        return {
          icon: XCircle,
          title: 'Pago Cancelado',
          description: message === 'order_not_found' 
            ? 'No se encontró la orden asociada a esta transacción.'
            : 'Has cancelado el proceso de pago. Puedes intentar nuevamente cuando desees.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-200',
          badge: <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Cancelado</Badge>
        }
      case 'error':
        return {
          icon: XCircle,
          title: 'Error en el Pago',
          description: reason 
            ? `El pago fue rechazado: ${reason}`
            : message === 'payment_rejected'
            ? 'El pago fue rechazado. Por favor intenta con otro método de pago.'
            : 'Ocurrió un error procesando tu pago. Por favor contacta a soporte.',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-200',
          badge: <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>
        }
      default:
        return {
          icon: Clock,
          title: 'Procesando',
          description: 'Estamos verificando el estado de tu pago. Esto puede tomar unos segundos.',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-200',
          badge: <Badge className="bg-blue-100 text-blue-800 border-blue-200">Procesando</Badge>
        }
    }
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon

  // Si no hay orderId y no es éxito
  if (!orderId && status !== 'success') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-xl font-semibold">Parámetros inválidos</h2>
              <p className="text-muted-foreground">
                No se proporcionó información de la orden.
              </p>
              <Link href="/">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a la tienda
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Estado de carga
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando información de tu pedido...</p>
          <p className="text-xs text-muted-foreground mt-2">Esto puede tomar unos segundos</p>
        </div>
      </div>
    )
  }

  // Estado de error con reintento
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold">Error al cargar el pedido</h2>
              <p className="text-muted-foreground">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleRetry} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reintentar
                </Button>
                <Link href="/">
                  <Button>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver a la tienda
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card className={`border ${statusConfig.borderColor}`}>
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full ${statusConfig.bgColor} flex items-center justify-center mb-4`}>
              <StatusIcon className={`w-8 h-8 ${statusConfig.color}`} />
            </div>
            <CardTitle className="text-2xl">
              {statusConfig.title}
            </CardTitle>
            <p className="text-muted-foreground">
              {statusConfig.description}
            </p>
            {statusConfig.badge}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Mostrar orden solo si existe */}
            {order && (
              <>
                {/* Información del pedido */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Package className="w-4 h-4" />
                    Detalles del Pedido
                  </h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Número de orden:</span>
                      <span className="font-medium">{order.order_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fecha:</span>
                      <span>{new Date(order.created_at).toLocaleDateString('es-CL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total pagado:</span>
                      <span className="font-bold text-lg">
                        ${(order.total || 0).toLocaleString('es-CL')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista de productos */}
                {order.items && order.items.length > 0 && (
                    <div className="border rounded-lg p-4">
                        <h3 className="font-semibold flex items-center gap-2 mb-4">
                        <Package className="w-4 h-4" />
                        Productos
                        </h3>
                        <div className="space-y-3">
                        {order.items.map((item) => (
                            <div key={item.id} className="flex gap-3 items-center">
                            {/* Imagen del producto */}
                            {item.image_url && (
                                <div className="w-12 h-12 relative flex-shrink-0">
                                <img 
                                    src={item.image_url} 
                                    alt={item.product_name}
                                    className="w-full h-full object-cover rounded"
                                    onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                                </div>
                            )}
                            <div className="flex-1">
                                <div className="flex justify-between">
                                <span className="font-medium">{item.product_name}</span>
                                <span>${(item.product_price * item.quantity).toLocaleString('es-CL')}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                Cantidad: {item.quantity} × ${item.product_price.toLocaleString('es-CL')}
                                </div>
                            </div>
                            </div>
                        ))}
                        </div>
                    </div>
                    )}

                {/* Boleta electrónica */}
                {order.boleta_folio && (
                  <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                    <h3 className="font-semibold flex items-center gap-2 mb-4">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Boleta Electrónica
                    </h3>

                    <div className="flex justify-between items-center mb-4">
                      <span className="text-muted-foreground">Folio:</span>
                      <span className="font-bold text-lg">{order.boleta_folio}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleViewPDF}
                        disabled={downloadLoading}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver PDF
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleDownloadPDF}
                        disabled={downloadLoading}
                      >
                        {downloadLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Descargar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Botón para reenviar email (solo en éxito) */}
                {status === 'success' && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleResendEmail}
                    disabled={resendLoading}
                  >
                    {resendLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Reenviar email de confirmación
                  </Button>
                )}
              </>
            )}

            {/* Caso de cancelación sin orden */}
            {!order && status === 'cancelled' && (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  No se encontró información de la orden.
                </p>
              </div>
            )}

            {/* Botón de volver */}
            <div className="flex justify-center pt-4">
              <Link href="/">
                <Button size="lg">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a la tienda
                </Button>
              </Link>
            </div>

            {/* Mensaje de ayuda */}
            {status === 'success' && (
              <p className="text-xs text-center text-muted-foreground">
                Se ha enviado un email de confirmación a tu correo electrónico.
                {!order?.boleta_folio && ' La boleta electrónica se generará en los próximos minutos.'}
              </p>
            )}

            {status === 'error' && (
              <p className="text-xs text-center text-muted-foreground">
                Si el problema persiste, por favor contacta a nuestro soporte.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}