"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, ArrowLeft, Package, Loader2, ShoppingCart, FileText, Download, Mail, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  boleta_emitida?: number
  boleta_info?: {
    folio: string
    monto_total: number
    fecha_emision: string
    estado_sii: string
  }
  shipping_address?: {
    street: string
    commune_name: string
    region_name: string
  }
  items?: Array<{
    id: number
    product_name: string
    product_price: number
    quantity: number
    subtotal: number
  }>
}

interface BoletaInfo {
  success: boolean
  folio?: string
  data?: any
}

export default function OrderSuccessPage() {
  const { clearCart, items } = useCartStore()
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const orderId = searchParams.get('orderId')
  const message = searchParams.get('message')
  const router = useRouter()
  const { toast } = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cartClearedLocal, setCartClearedLocal] = useState(false)
  
  const [boletaInfo, setBoletaInfo] = useState<BoletaInfo | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [boletaError, setBoletaError] = useState<string | null>(null)
  const [boletaEstado, setBoletaEstado] = useState<string | null>(null)
  const [procesoCompletado, setProcesoCompletado] = useState(false)
  const [descargandoPDF, setDescargandoPDF] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)

  // Limpiar carrito
  useEffect(() => {
    if (status === 'success' && !cartClearedLocal && items.length > 0) {
      clearCart()
      setCartClearedLocal(true)
      
      window.dispatchEvent(new CustomEvent('payment-complete'))
      window.dispatchEvent(new CustomEvent('stock-update'))
    }
  }, [status, items.length, clearCart, cartClearedLocal])

  // Cargar orden
  useEffect(() => {
    if (!status && !orderId) {
      router.push('/')
      return
    }

    if (orderId && status === 'success') {
      fetchOrderFromMySQL(orderId)
    }
  }, [orderId, status, router])

  //  Emitir boleta desde el servidor (API)
  const emitirBoleta = async () => {
    if (!order || !orderId) return

    // Ya tiene boleta o ya se emitió
    if (order.boleta_emitida === 1 || boletaInfo) {
      return
    }

    setProcesando(true)
    setBoletaError(null)

    try {
      const response = await fetch('/api/orders/emitir-boleta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: parseInt(orderId) })
      })

      const data = await response.json()

      if (data.success) {
        setBoletaInfo({
          success: true,
          folio: data.folio,
          data: data
        })
        setBoletaEstado(data.estado || 'emitida')
        setProcesoCompletado(true)
        
        toast({
          title: " Boleta generada",
          description: `Boleta N° ${data.folio} generada correctamente`,
          duration: 5000,
        })

        // Recargar la orden para actualizar los datos
        fetchOrderFromMySQL(orderId)
      } else {
        setBoletaError(data.error || 'Error al generar la boleta')
        toast({
          title: "❌ Error",
          description: data.error || 'Error al generar la boleta',
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('Error emitir boleta:', error)
      setBoletaError(error.message || 'Error al generar la boleta')
      toast({
        title: "❌ Error",
        description: error.message || 'Error al generar la boleta',
        variant: "destructive",
      })
    } finally {
      setProcesando(false)
    }
  }

  //  Auto-emitir boleta cuando se carga la orden
  useEffect(() => {
    if (order && status === 'success' && !procesando && !procesoCompletado && order.boleta_emitida !== 1 && !boletaInfo) {
      const timer = setTimeout(() => {
        emitirBoleta()
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [order, status, procesando, procesoCompletado, boletaInfo])

  const fetchOrderFromMySQL = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/orders/${id}`)
      
      if (response.ok) {
        const orderData = await response.json()
        
        if (orderData.boleta_emitida === 1 && orderData.boleta_info?.folio) {
          setBoletaInfo({
            success: true,
            folio: orderData.boleta_info.folio,
            data: orderData.boleta_info
          })
          setBoletaEstado(orderData.boleta_info.estado_sii || 'emitida')
          setProcesoCompletado(true)
        }
        
        setOrder(orderData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar la orden')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      setError('No se pudo cargar la información del pedido')
    } finally {
      setLoading(false)
    }
  }

  const descargarPDF = async () => {
    const folio = boletaInfo?.folio || order?.boleta_info?.folio
    if (!folio) {
      toast({
        title: "Boleta no disponible",
        description: "Aún no se ha generado la boleta electrónica",
        variant: "destructive",
      })
      return
    }
    
    setDescargandoPDF(true)
    try {
      const response = await fetch(`/api/apigateway/pdf?folio=${folio}`)
      
      if (response.ok) {
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
          title: "PDF descargado",
          description: `Boleta N° ${folio} descargada exitosamente`,
          duration: 3000,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Error al descargar PDF",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error descargando PDF:', error)
      toast({
        title: "Error",
        description: "No se pudo descargar el PDF",
        variant: "destructive",
      })
    } finally {
      setDescargandoPDF(false)
    }
  }

  const handleResendEmail = async () => {
    if (!order) {
      toast({
        title: "Error",
        description: "No se encontró la información de la orden",
        variant: "destructive",
      })
      return
    }
    
    setResendingEmail(true)
    try {
      const response = await fetch(`/api/orders/${order.id}/resend-email`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "Email reenviado",
          description: data.message || "El email de confirmación ha sido reenviado exitosamente",
          duration: 5000,
        })
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo reenviar el email",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error reenviando email:', error)
      toast({
        title: "Error",
        description: "No se pudo reenviar el email. Inténtalo de nuevo.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setResendingEmail(false)
    }
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: CheckCircle,
          title: 'Pago Exitoso',
          description: 'Tu pedido ha sido procesado correctamente.',
          color: 'text-green-600',
          bgColor: 'bg-green-100',
          badge: <Badge className="bg-green-100 text-green-800">Completado</Badge>
        }
      case 'cancelled':
        return {
          icon: XCircle,
          title: 'Pago Cancelado',
          description: 'Has cancelado el proceso de pago.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          badge: <Badge className="bg-yellow-100 text-yellow-800">Cancelado</Badge>
        }
      case 'error':
        return {
          icon: XCircle,
          title: 'Error en el Pago',
          description: message === 'payment_failed' 
            ? 'El pago no pudo ser procesado. Por favor intenta nuevamente.'
            : message === 'order_not_found'
            ? 'No se pudo encontrar la información de tu pedido.'
            : 'Ha ocurrido un error inesperado.',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          badge: <Badge className="bg-red-100 text-red-800">Error</Badge>
        }
      default:
        return {
          icon: Clock,
          title: 'Procesando...',
          description: 'Estamos procesando tu pedido.',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          badge: <Badge className="bg-blue-100 text-blue-800">Procesando</Badge>
        }
    }
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon
  const tieneBoleta = boletaInfo?.folio || order?.boleta_info?.folio

  const renderBoletaStatus = () => {
    if (!status || status !== 'success') return null

    //  Ya tiene boleta
    if (tieneBoleta) {
      return (
        <div className="border rounded-lg p-4 bg-green-50 border-green-200">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-800">
            <FileText className="w-4 h-4" />
            Boleta Electrónica
          </h3>
          
          <div className="space-y-2">
            <p className="text-sm text-green-700">
              Folio: <strong>{boletaInfo?.folio || order?.boleta_info?.folio}</strong>
            </p>
            <p className="text-sm text-green-700">
              Estado: <Badge className="bg-green-100 text-green-800">{boletaEstado || 'emitida'}</Badge>
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              variant="outline"
              className="flex-1 min-w-[140px] border-green-300 text-green-700 hover:bg-green-100"
              onClick={descargarPDF}
              disabled={descargandoPDF}
            >
              {descargandoPDF ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Descargar Boleta
            </Button>
            
            <Button
              variant="outline"
              className="flex-1 min-w-[140px] border-green-300 text-green-700 hover:bg-green-100"
              onClick={handleResendEmail}
              disabled={resendingEmail}
            >
              {resendingEmail ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Reenviar Email
            </Button>
          </div>
        </div>
      )
    }

    // ⏳ Procesando
    if (procesando) {
      return (
        <div className="border rounded-lg p-4">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="font-medium">Generando boleta electrónica...</p>
            <p className="text-sm text-muted-foreground">Estamos emitiendo tu boleta en el SII</p>
          </div>
        </div>
      )
    }

    // ❌ Error
    if (boletaError) {
      return (
        <div className="border rounded-lg p-4 border-red-200 bg-red-50">
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
            <p className="font-medium text-red-700">Error al generar la boleta</p>
            <p className="text-sm text-red-600">{boletaError}</p>
            <Button 
              size="sm" 
              variant="outline"
              onClick={emitirBoleta}
              disabled={procesando}
            >
              Reintentar
            </Button>
          </div>
        </div>
      )
    }

    return null
  }

  if (!status) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full ${statusConfig.bgColor} flex items-center justify-center mb-4`}>
              <StatusIcon className={`w-8 h-8 ${statusConfig.color}`} />
            </div>
            <CardTitle className="text-2xl font-bold">{statusConfig.title}</CardTitle>
            <p className="text-muted-foreground mt-2">{statusConfig.description}</p>
            {statusConfig.badge}
            
            {status === 'success' && cartClearedLocal && (
              <div className="mt-2 flex items-center justify-center gap-2 text-sm text-green-600">
                <ShoppingCart className="w-4 h-4" />
                <span>Carrito limpiado automáticamente</span>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {order && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Detalles del Pedido
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Número de Pedido:</span>
                    <span className="font-mono">{order.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span>${order.total.toLocaleString('es-CL')}</span>
                  </div>
                  {order.customer_rut && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RUT:</span>
                      <span className="font-mono">{order.customer_rut}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {renderBoletaStatus()}

            {loading && (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-muted-foreground">Cargando detalles del pedido...</p>
              </div>
            )}

            {error && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 text-center">{error}</p>
              </div>
            )}

            <div className="flex gap-4 justify-center pt-4">
              <Link href="/">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a la Tienda
                </Button>
              </Link>
              
              {status === 'cancelled' && (
                <Link href="/checkout">
                  <Button variant="outline">Reintentar Pago</Button>
                </Link>
              )}

              {status === 'error' && (
                <Link href="/checkout">
                  <Button variant="outline">Intentar Nuevamente</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}