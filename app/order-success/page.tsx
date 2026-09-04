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
  
  // Estado de la boleta - SIMPLIFICADO
  const [boletaInfo, setBoletaInfo] = useState<BoletaInfo | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [boletaError, setBoletaError] = useState<string | null>(null)
  const [boletaEstado, setBoletaEstado] = useState<string | null>(null)
  const [boletaRechazada, setBoletaRechazada] = useState(false)
  const [procesoCompletado, setProcesoCompletado] = useState(false)
  const [intentos, setIntentos] = useState(0)
  const [consultando, setConsultando] = useState(false)
  
  const [descargandoPDF, setDescargandoPDF] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)

  // Limpiar carrito
  useEffect(() => {
    if (status === 'success' && !cartClearedLocal && items.length > 0) {
      console.log('🧹 Limpiando carrito local - pago exitoso confirmado')
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

  // ✅ FUNCIÓN PRINCIPAL: EMITIR Y VERIFICAR BOLETA (SIMPLIFICADA)
  useEffect(() => {
    const iniciarProceso = async () => {
      // Condiciones para ejecutar
      if (status !== 'success' || !order || boletaInfo || procesando || order.boleta_emitida === 1 || procesoCompletado) {
        return
      }

      const emittedKey = `boleta_${order.id}`
      if (sessionStorage.getItem(emittedKey)) {
        console.log('📌 Boleta ya emitida para esta orden (sessionStorage)')
        return
      }

      setProcesando(true)
      setBoletaError(null)
      setBoletaRechazada(false)
      setConsultando(false)

      try {
        // ============================================================
        // PASO 1: PREPARAR DATOS DEL CLIENTE
        // ============================================================
        const rutCliente = order.customer_rut || '66666666-6'
        let nombreCliente = 'Consumidor Final'
        
        if (order.customer_first_name && order.customer_last_name) {
          nombreCliente = `${order.customer_first_name} ${order.customer_last_name}`.trim()
        } else if (order.customer_first_name) {
          nombreCliente = order.customer_first_name
        } else if (order.customer_last_name) {
          nombreCliente = order.customer_last_name
        }
        
        const direccion = order.shipping_address?.street || 'Santiago'
        const comuna = order.shipping_address?.commune_name || 'Santiago'
        const ciudad = order.shipping_address?.region_name || 'Santiago'
        const telefono = order.customer_phone || undefined
        const email = order.customer_email || undefined

        console.log('📤 Datos del cliente:', { rutCliente, nombreCliente, direccion, comuna, ciudad })

        const datosBoleta = {
          cliente: {
            rut: rutCliente,
            nombre: nombreCliente || 'Consumidor Final',
            direccion: direccion,
            comuna: comuna,
            ciudad: ciudad,
            telefono: telefono,
            email: email
          },
          productos: order.items?.map(item => ({
            nombre: item.product_name,
            cantidad: item.quantity,
            precio: item.product_price
          })) || [],
          total: order.total,
          ordenId: order.id,
          ordenNumero: order.order_number
        }

        // ============================================================
        // PASO 2: EMITIR BOLETA (1 sola vez)
        // ============================================================
        console.log('📄 Emitiendo boleta...')
        
        const respuesta = await fetch('/api/apigateway/emitir-boleta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datosBoleta)
        })

        const resultado = await respuesta.json()

        if (!resultado.success) {
          throw new Error(resultado.error || 'Error al emitir boleta')
        }

        const folio = resultado.folio
        console.log('✅ Boleta emitida. Folio:', folio)

        // ============================================================
        // PASO 3: CONSULTAR ESTADO (con reintentos limitados)
        // ============================================================
        setConsultando(true)
        console.log('🔍 Consultando estado de la boleta...')

        let estadoFinal = 'En Proceso'
        let boletaRechazadaFlag = false
        let boletaEncontrada = false
        let intentoActual = 0
        const maxIntentos = 5 // Máximo 5 intentos

        while (!boletaEncontrada && intentoActual < maxIntentos) {
          intentoActual++
          setIntentos(intentoActual)

          // Esperar 3 segundos entre intentos (excepto el primero)
          if (intentoActual > 1) {
            console.log(`⏳ Esperando 3 segundos antes del intento ${intentoActual}...`)
            await new Promise(resolve => setTimeout(resolve, 3000))
          }

          try {
            const estadoResponse = await fetch(`/api/apigateway/consultar?folio=${folio}`)
            const estadoData = await estadoResponse.json()
            
            if (estadoData.success && estadoData.data) {
              const estado = estadoData.data.estado || estadoData.data.estado_boleta || 'En Proceso'
              estadoFinal = estado
              boletaEncontrada = true
              setBoletaEstado(estado)
              
              console.log(`📊 Estado encontrado: ${estado}`)
              
              // ✅ Si está Aceptada o En Proceso → Enviar email
              if (estado === 'Aceptada' || estado === 'En Proceso') {
                console.log(`✅ Boleta en estado "${estado}" - Enviando email...`)
                break
              }
              
              // ❌ Si está Rechazada → Error
              if (estado === 'Rechazada') {
                boletaRechazadaFlag = true
                console.log('❌ Boleta RECHAZADA')
                break
              }
            } else {
              console.log(`⚠️ Boleta no encontrada (intento ${intentoActual}/${maxIntentos})`)
            }
          } catch (error) {
            console.warn(`⚠️ Error consultando (intento ${intentoActual}):`, error)
          }
        }

        // ============================================================
        // PASO 4: DECISIÓN FINAL
        // ============================================================

        // ❌ Caso 1: Rechazada
        if (boletaRechazadaFlag) {
          setBoletaRechazada(true)
          setBoletaError('La boleta fue rechazada por el SII')
          toast({
            title: "❌ Boleta Rechazada",
            description: "La boleta electrónica fue rechazada por el SII. Contacta a soporte.",
            variant: "destructive",
            duration: 8000,
          })
          setProcesando(false)
          setConsultando(false)
          return
        }

        // ✅ Caso 2: Aceptada o En Proceso (o no encontrada)
        const estadoFinalMostrar = boletaEncontrada ? estadoFinal : 'En Proceso'
        
        if (!boletaEncontrada) {
          console.log(`⚠️ No se encontró la boleta después de ${maxIntentos} intentos, enviando igual...`)
        }

        // Guardar información de la boleta
        setBoletaInfo({
          success: true,
          folio: folio,
          data: resultado.data
        })
        
        sessionStorage.setItem(`boleta_${order.id}`, 'true')
        setBoletaEstado(estadoFinalMostrar)
        
        toast({
          title: "✅ Boleta generada",
          description: `Boleta N° ${folio} generada correctamente`,
          duration: 5000,
        })

        // ============================================================
        // PASO 5: ENVIAR EMAIL AUTOMÁTICAMENTE (1 sola vez)
        // ============================================================
        if (order.customer_email) {
          console.log('📧 Enviando email automático...')
          try {
            const emailResponse = await fetch(`/api/orders/${order.id}/resend-email`, {
              method: 'POST',
            })
            const emailData = await emailResponse.json()
            if (emailResponse.ok && emailData.success) {
              console.log('✅ Email enviado a:', order.customer_email)
              toast({
                title: "📧 Email enviado",
                description: `La boleta fue enviada a ${order.customer_email}`,
                duration: 4000,
              })
            } else {
              console.warn('⚠️ Error enviando email:', emailData.error)
            }
          } catch (emailError) {
            console.warn('⚠️ Error enviando email:', emailError)
          }
        }

        setProcesoCompletado(true)
        console.log('✅ Proceso completado. Folio:', folio, 'Estado:', estadoFinalMostrar)

      } catch (error: any) {
        console.error('❌ Error en proceso:', error)
        setBoletaError(error.message || 'Error al generar la boleta')
      } finally {
        setProcesando(false)
        setConsultando(false)
      }
    }

    if (order && status === 'success') {
      const timer = setTimeout(() => {
        iniciarProceso()
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [order, status, boletaInfo, procesando, procesoCompletado, toast])

  const fetchOrderFromMySQL = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/orders/${id}`)
      
      if (response.ok) {
        const orderData = await response.json()
        console.log('📦 Orden cargada:', {
          id: orderData.id,
          boleta_emitida: orderData.boleta_emitida,
          boleta_info: orderData.boleta_info
        })
        
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

  // ✅ Renderizar estado de la boleta - SIMPLIFICADO
  const renderBoletaStatus = () => {
    if (!status || status !== 'success') return null

    // ✅ Rechazada
    if (boletaRechazada) {
      return (
        <div className="border rounded-lg p-4 border-red-200 bg-red-50">
          <div className="text-center space-y-3">
            <XCircle className="w-8 h-8 mx-auto text-red-500" />
            <p className="font-medium text-red-700">Boleta Rechazada</p>
            <p className="text-sm text-red-600">
              La boleta electrónica fue rechazada por el SII. 
              Por favor contacta a soporte para resolver este problema.
            </p>
            <Button 
              size="sm" 
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => {
                setBoletaRechazada(false)
                setBoletaError(null)
                setProcesando(false)
                setProcesoCompletado(false)
                setBoletaInfo(null)
                setIntentos(0)
              }}
            >
              Reintentar
            </Button>
          </div>
        </div>
      )
    }

    // ✅ Ya tiene boleta
    if (tieneBoleta) {
      const mostrarEstado = boletaEstado && boletaEstado !== 'En Proceso' ? boletaEstado : null
      
      return (
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Boleta Electrónica
          </h3>
          
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="flex-1 min-w-[140px]"
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
              className="flex-1 min-w-[140px]"
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
          
          {boletaInfo?.folio && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Boleta N° {boletaInfo.folio}
              {mostrarEstado && ` - ${mostrarEstado}`}
            </p>
          )}
        </div>
      )
    }

    // ⏳ Procesando
    if (procesando || consultando) {
      let texto = 'Generando boleta electrónica...'
      let descripcion = 'Estamos emitiendo tu boleta en el SII'
      
      if (consultando) {
        texto = `Consultando estado (intento ${intentos}/5)`
        descripcion = 'Verificando el estado de tu boleta...'
      }
      
      return (
        <div className="border rounded-lg p-4">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="font-medium">{texto}</p>
            <p className="text-sm text-muted-foreground">{descripcion}</p>
            {consultando && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Por favor espera...</span>
              </div>
            )}
          </div>
        </div>
      )
    }

    // ❌ Error
    if (boletaError && !boletaRechazada) {
      return (
        <div className="border rounded-lg p-4 border-red-200 bg-red-50">
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
            <p className="font-medium text-red-700">Error al generar la boleta</p>
            <p className="text-sm text-red-600">{boletaError}</p>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => {
                setBoletaInfo(null)
                setBoletaError(null)
                setProcesando(false)
                setProcesoCompletado(false)
                setIntentos(0)
              }}
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
                </div>
              </div>
            )}

            {/* ✅ Estado de la boleta */}
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