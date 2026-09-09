"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, ArrowLeft, Package, Loader2, ShoppingCart, FileText, Download, Mail, AlertCircle, RefreshCw } from 'lucide-react'
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

// Estados del proceso
type ProcessState = 'loading' | 'emitting' | 'waiting_pdf' | 'sending_email' | 'complete' | 'error'

export default function OrderSuccessPage() {
  const { clearCart, items } = useCartStore()
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const orderId = searchParams.get('orderId')
  const message = searchParams.get('message')
  const isProcessing = searchParams.get('processing') === 'true'
  const router = useRouter()
  const { toast } = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cartClearedLocal, setCartClearedLocal] = useState(false)
  
  const [boletaInfo, setBoletaInfo] = useState<BoletaInfo | null>(null)
  const [boletaError, setBoletaError] = useState<string | null>(null)
  const [boletaEstado, setBoletaEstado] = useState<string | null>(null)
  const [procesoCompletado, setProcesoCompletado] = useState(false)
  const [descargandoPDF, setDescargandoPDF] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)
  
  // Estado del proceso
  const [processState, setProcessState] = useState<ProcessState>('loading')
  const [processMessage, setProcessMessage] = useState('Cargando información...')
  const [processProgress, setProcessProgress] = useState(0)

  // Ej: 12345678-9 Ref para evitar ejecuciones múltiples
  const processingRef = useRef(false)
  const emailSentRef = useRef(false)

  // Limpiar carrito
  useEffect(() => {
    if (status === 'success' && !cartClearedLocal && items.length > 0) {
      clearCart()
      setCartClearedLocal(true)
      window.dispatchEvent(new CustomEvent('payment-complete'))
      window.dispatchEvent(new CustomEvent('stock-update'))
    }
  }, [status, items.length, clearCart, cartClearedLocal])

  // ============================================================
  // PROCESO COMPLETO: Emitir boleta → Enviar email (SOLO UNA VEZ)
  // ============================================================
  const procesarBoletaYEmail = useCallback(async (id: string) => {
    // Ej: 12345678-9 VERIFICAR SI YA SE COMPLETÓ EL PROCESO
    if (procesoCompletado || boletaInfo || emailSentRef.current) {
      console.log('El proceso ya se completó anteriormente, saltando...')
      return
    }

    setProcessState('emitting')
    setProcessMessage('Generando boleta electrónica...')
    setProcessProgress(20)

    try {
      // PASO 1: Emitir boleta
      const boletaResponse = await fetch('/api/orders/emitir-boleta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: parseInt(id) })
      })

      const boletaData = await boletaResponse.json()

      if (!boletaResponse.ok || !boletaData.success) {
        setProcessState('error')
        setProcessMessage('Error al generar la boleta: ' + (boletaData.error || 'Error desconocido'))
        setBoletaError(boletaData.error || 'Error al generar la boleta')
        return
      }

      setProcessProgress(50)
      setProcessMessage(`Boleta generada (Folio: ${boletaData.folio})`)
      
      // Esperar un momento para que el PDF esté disponible en el SII
      setProcessState('waiting_pdf')
      setProcessMessage('Esperando que el PDF esté disponible...')
      setProcessProgress(60)

      // Esperar 3 segundos para que el SII procese
      await new Promise(resolve => setTimeout(resolve, 3000))

      // PASO 2: Enviar email con la boleta (SOLO UNA VEZ)
      setProcessState('sending_email')
      setProcessMessage('Enviando correo electrónico con la boleta...')
      setProcessProgress(80)

      // Ej: 12345678-9 Marcar que el email se está enviando
      emailSentRef.current = true

      const emailResponse = await fetch(`/api/orders/${id}/resend-email?automatico=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const emailData = await emailResponse.json()

      if (emailResponse.ok && emailData.success) {
        setProcessState('complete')
        setProcessMessage('¡Todo listo! Revisa tu correo electrónico.')
        setProcessProgress(100)
        setProcesoCompletado(true)
        setBoletaInfo({
          success: true,
          folio: emailData.boleta?.folio || boletaData.folio,
          data: emailData
        })
        setBoletaEstado('emitida')
        
        toast({
          title: "Ej: 12345678-9 ¡Compra completada!",
          description: `Se ha enviado la boleta a tu correo electrónico.`,
          duration: 5000,
        })
      } else {
        // El email falló pero la boleta está generada
        setProcessState('complete')
        setProcessMessage('Boleta generada, pero no se pudo enviar el email. Puedes reenviarlo manualmente.')
        setProcessProgress(90)
        setProcesoCompletado(true)
        setBoletaInfo({
          success: true,
          folio: boletaData.folio,
          data: boletaData
        })
        setBoletaEstado('emitida')
        setBoletaError('El email no pudo enviarse automáticamente. Usa el botón "Reenviar Email" para intentarlo.')
        
        toast({
          title: "⚠️ Boleta generada",
          description: "La boleta se generó pero el email falló. Puedes reenviarlo manualmente.",
          variant: "destructive",
          duration: 5000,
        })
      }

    } catch (error: any) {
      console.error('Error en proceso:', error)
      setProcessState('error')
      setProcessMessage('Error en el proceso: ' + (error.message || 'Error desconocido'))
      setBoletaError(error.message || 'Error en el proceso')
      // Ej: 12345678-9 Si falla, permitir reintentar
      emailSentRef.current = false
    }
  }, [procesoCompletado, boletaInfo, toast])

  // ============================================================
  // CARGAR ORDEN Y PROCESAR BOLETA
  // ============================================================
  const fetchOrderAndProcess = useCallback(async (id: string) => {
    // Ej: 12345678-9 Evitar ejecución si ya se completó
    if (procesoCompletado || boletaInfo) {
      console.log('Proceso ya completado, no se ejecutará nuevamente')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setProcessState('loading')
      setProcessMessage('Cargando tu pedido...')
      setProcessProgress(10)

      const response = await fetch(`/api/orders/${id}`)
      
      if (response.ok) {
        const orderData = await response.json()
        setOrder(orderData)

        // Verificar si ya tiene boleta
        if (orderData.boleta_emitida === 1 && orderData.boleta_info?.folio) {
          setProcessState('complete')
          setProcessMessage('¡Tu pedido está listo!')
          setProcessProgress(100)
          setProcesoCompletado(true)
          setBoletaInfo({
            success: true,
            folio: orderData.boleta_info.folio,
            data: orderData.boleta_info
          })
          setBoletaEstado(orderData.boleta_info.estado_sii || 'emitida')
          // Ej: 12345678-9 Marcar email como enviado (ya está en la orden)
          emailSentRef.current = true
          setLoading(false)
          return
        }

        // Si no tiene boleta y es un pago exitoso, procesar
        if (status === 'success' && isProcessing) {
          setProcessState('emitting')
          setProcessMessage('Preparando tu boleta...')
          setProcessProgress(15)
          
          // Iniciar el proceso de boleta y email
          await procesarBoletaYEmail(id)
        } else {
          // Si no se requiere procesamiento, mostrar completado
          setProcessState('complete')
          setProcessMessage('¡Tu pedido está listo!')
          setProcessProgress(100)
          setProcesoCompletado(true)
        }

      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar la orden')
        setProcessState('error')
        setProcessMessage('Error al cargar la orden')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      setError('No se pudo cargar la información del pedido')
      setProcessState('error')
      setProcessMessage('Error al cargar la información')
    } finally {
      setLoading(false)
    }
  }, [status, isProcessing, procesarBoletaYEmail, procesoCompletado, boletaInfo])

  // ============================================================
  // Cargar orden al montar (SOLO UNA VEZ)
  // ============================================================
  useEffect(() => {
    if (!status && !orderId) {
      router.push('/')
      return
    }

    if (orderId && status === 'success' && !processingRef.current) {
      processingRef.current = true
      fetchOrderAndProcess(orderId)
    }
  }, [orderId, status, router, fetchOrderAndProcess])

  // ============================================================
  // REENVIAR EMAIL MANUAL (SOLO CUANDO EL USUARIO PRESIONA EL BOTÓN)
  // ============================================================
  const handleResendEmail = async () => {
    if (!order) {
      toast({
        title: "Error",
        description: "No se encontró la información de la orden",
        variant: "destructive",
      })
      return
    }
    
    // Ej: 12345678-9 Verificar si ya se envió el email y la boleta existe
    if (!boletaInfo?.folio && !order.boleta_info?.folio) {
      toast({
        title: "Error",
        description: "No hay una boleta generada para esta orden",
        variant: "destructive",
      })
      return
    }
    
    setResendingEmail(true)
    setProcessState('sending_email')
    setProcessMessage('Reenviando correo electrónico...')
    
    try {
      const response = await fetch(`/api/orders/${order.id}/resend-email?automatico=true`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setProcessState('complete')
        setProcessMessage('¡Email reenviado exitosamente!')
        toast({
          title: "Ej: 12345678-9 Email reenviado",
          description: data.message || "El email de confirmación ha sido reenviado",
          duration: 5000,
        })
      } else {
        setProcessState('error')
        setProcessMessage('Error al reenviar el email: ' + (data.error || 'Error desconocido'))
        toast({
          title: "Error",
          description: data.error || "No se pudo reenviar el email",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error reenviando email:', error)
      setProcessState('error')
      setProcessMessage('Error al reenviar el email')
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

  // ============================================================
  // DESCARGAR PDF
  // ============================================================
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

  // ============================================================
  // RENDERIZADO DE ESTADO DEL PROCESO
  // ============================================================
  const renderProcessStatus = () => {
    if (processState === 'loading') {
      return (
        <div className="text-center py-8 space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-[#C2410C]" />
          <p className="text-lg font-medium">{processMessage}</p>
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5">
            <div className="bg-[#C2410C] h-2.5 rounded-full transition-all duration-500" style={{ width: `${processProgress}%` }}></div>
          </div>
        </div>
      )
    }

    if (processState === 'emitting' || processState === 'waiting_pdf' || processState === 'sending_email') {
      return (
        <div className="text-center py-8 space-y-4">
          <div className="relative">
            <Loader2 className="w-12 h-12 animate-spin mx-auto text-[#C2410C]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-white border-2 border-[#C2410C] border-t-transparent animate-spin"></div>
            </div>
          </div>
          <p className="text-lg font-medium">{processMessage}</p>
          <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5">
            <div className="bg-[#C2410C] h-2.5 rounded-full transition-all duration-500" style={{ width: `${processProgress}%` }}></div>
          </div>
          <p className="text-sm text-muted-foreground">
            {processState === 'emitting' && 'Generando boleta en el SII...'}
            {processState === 'waiting_pdf' && 'El SII está procesando tu boleta, esto puede tomar unos segundos...'}
            {processState === 'sending_email' && 'Enviando el correo electrónico con tu boleta...'}
          </p>
        </div>
      )
    }

    if (processState === 'error') {
      return (
        <div className="text-center py-8 space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
          <p className="text-lg font-medium text-red-600">Error en el proceso</p>
          <p className="text-muted-foreground">{processMessage}</p>
          <Button onClick={() => {
            // Resetear el ref para permitir reintentar
            processingRef.current = false
            emailSentRef.current = false
            if (orderId) fetchOrderAndProcess(orderId)
          }} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </div>
      )
    }

    if (processState === 'complete') {
      return (
        <div className="text-center py-4 space-y-2">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
          <p className="text-lg font-medium text-green-700">{processMessage}</p>
          {boletaInfo?.folio && (
            <p className="text-sm text-muted-foreground">
              Boleta N° <strong>{boletaInfo.folio}</strong>
            </p>
          )}
        </div>
      )
    }

    return null
  }

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
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

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon
  const tieneBoleta = boletaInfo?.folio || order?.boleta_info?.folio
  const isComplete = processState === 'complete'

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
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Estado del proceso */}
            {status === 'success' && renderProcessStatus()}

            {/* Orden */}
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
                </div>
              </div>
            )}

            {/* Boleta */}
            {tieneBoleta && isComplete && (
              <div className="border rounded-lg p-4 bg-white border-gray-200">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-black">
                  <FileText className="w-4 h-4" />
                  Boleta Electrónica
                </h3>

                <div className="flex flex-wrap gap-3 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1 min-w-[140px] bg-white border-gray-300 text-black hover:bg-gray-100 hover:text-black"
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
                    className="flex-1 min-w-[140px] bg-white border-gray-300 text-black hover:bg-gray-100 hover:text-black"
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
            )}

            {/* Error de boleta */}
            {boletaError && !tieneBoleta && (
              <div className="border rounded-lg p-4 border-red-200 bg-red-50">
                <div className="text-center space-y-3">
                  <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
                  <p className="font-medium text-red-700">Error al generar la boleta</p>
                  <p className="text-sm text-red-600">{boletaError}</p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      processingRef.current = false
                      emailSentRef.current = false
                      if (orderId) fetchOrderAndProcess(orderId)
                    }}
                  >
                    Reintentar
                  </Button>
                </div>
              </div>
            )}

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