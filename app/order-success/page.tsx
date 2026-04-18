// app/order-success/page.tsx - CON EMISIÓN DE BOLETA EN TIEMPO REAL Y DESCARGA PDF
"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, ArrowLeft, Package, Loader2, ShoppingCart, FileText, Download, Eye, Mail } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/lib/cart-store'

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
  pdfUrl?: string
}

export default function OrderSuccessPage() {
  const { clearCart, items } = useCartStore()
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const orderId = searchParams.get('orderId')
  const message = searchParams.get('message')
  const router = useRouter()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cartClearedLocal, setCartClearedLocal] = useState(false)
  
  // Estados para la boleta
  const [boletaInfo, setBoletaInfo] = useState<BoletaInfo | null>(null)
  const [emitiendoBoleta, setEmitiendoBoleta] = useState(false)
  const [boletaError, setBoletaError] = useState<string | null>(null)
  const [descargandoPDF, setDescargandoPDF] = useState(false)

  useEffect(() => {
    if (!status && !orderId) {
      router.push('/')
      return
    }

    if (orderId) {
      fetchOrderFromMySQL(orderId)
    }
  }, [orderId, status, router])

  // EFECTO PARA LIMPIAR CARRITO
  useEffect(() => {
    if (status === 'success' && !cartClearedLocal && items.length > 0) {
      console.log('🛒 Limpiando carrito local - pago exitoso confirmado')
      clearCart()
      setCartClearedLocal(true)
      
      window.dispatchEvent(new CustomEvent('payment-complete'))
      window.dispatchEvent(new CustomEvent('stock-update'))
    }
  }, [status, items.length, clearCart, cartClearedLocal])

  // EFECTO PARA EMITIR BOLETA AUTOMÁTICAMENTE
  useEffect(() => {
    const emitirBoleta = async () => {
      // Solo emitir si:
      // 1. El pago fue exitoso
      // 2. Tenemos la orden cargada
      // 3. No hemos emitido la boleta aún
      // 4. No estamos en proceso de emisión
      // 5. La orden no tiene boleta ya emitida
      if (status !== 'success' || !order || boletaInfo || emitiendoBoleta || order.boleta_emitida === 1) {
        return
      }

      // Verificar si ya se emitió para esta orden (evitar duplicados)
      const emittedKey = `boleta_${order.id}`
      if (sessionStorage.getItem(emittedKey)) {
        console.log('⏭️ Boleta ya emitida para esta orden')
        return
      }

      setEmitiendoBoleta(true)
      setBoletaError(null)

      try {
        console.log('📄 Emitiendo boleta para orden:', order.id)
        
        // Limpiar RUT - si es inválido, usar consumidor final
        let rutCliente = order.customer_rut || '55555555-5'
        let nombreCliente = order.customer_first_name || 'Consumidor'
        let apellidoCliente = order.customer_last_name || 'Final'
        
        // Si el RUT no es válido, usar consumidor final
        if (rutCliente === '11111111-2' || !rutCliente.match(/^[0-9]+-[0-9Kk]$/)) {
          console.log('⚠️ RUT inválido, usando consumidor final')
          rutCliente = '55555555-5'
          nombreCliente = 'Consumidor'
          apellidoCliente = 'Final'
        }
        
        const datosBoleta = {
          cliente: {
            rut: rutCliente,
            nombre: `${nombreCliente} ${apellidoCliente}`.trim(),
            direccion: order.shipping_address?.street || 'Santiago',
            comuna: order.shipping_address?.commune_name || 'Santiago',
            ciudad: 'Santiago'
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

        const respuesta = await fetch('/api/simplefactura/emitir-boleta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datosBoleta)
        })

        const resultado = await respuesta.json()

        if (resultado.success) {
          setBoletaInfo({
            success: true,
            folio: resultado.folio,
            data: resultado.data
          })
          
          // Marcar como emitida
          sessionStorage.setItem(`boleta_${order.id}`, 'true')
          
          console.log('✅ Boleta emitida con folio:', resultado.folio)
        } else {
          setBoletaError(resultado.error || 'Error al emitir boleta')
          console.error('Error emitiendo boleta:', resultado)
        }
      } catch (error: any) {
        setBoletaError('Error de conexión al emitir boleta')
        console.error('Error:', error)
      } finally {
        setEmitiendoBoleta(false)
      }
    }

    // Pequeño delay para evitar rate limit
    const timer = setTimeout(() => {
      emitirBoleta()
    }, 1000)

    return () => clearTimeout(timer)
  }, [status, order, boletaInfo, emitiendoBoleta])

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
          boleta_folio: orderData.boleta_info?.folio
        })
        
        // Si ya tiene boleta, mostrarla
        if (orderData.boleta_emitida === 1 && orderData.boleta_info?.folio) {
          setBoletaInfo({
            success: true,
            folio: orderData.boleta_info.folio,
            data: orderData.boleta_info
          })
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
    const folio = boletaInfo?.folio || order?.boleta_folio
    if (!folio) return
    
    setDescargandoPDF(true)
    try {
      const response = await fetch(`/api/simplefactura/pdf?folio=${folio}`)
      
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
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Error al descargar PDF')
      }
    } catch (error) {
      console.error('Error descargando PDF:', error)
      alert('Error al descargar el PDF')
    } finally {
      setDescargandoPDF(false)
    }
  }

  const verPDF = () => {
    const folio = boletaInfo?.folio || order?.boleta_folio
    if (!folio) return
    window.open(`/api/simplefactura/pdf?folio=${folio}`, '_blank')
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'success':
        return {
          icon: CheckCircle,
          title: '¡Pago Exitoso!',
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

  const boletaFolio = boletaInfo?.folio || order?.boleta_folio

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

            {/* SECCIÓN DE BOLETA ELECTRÓNICA */}
            {status === 'success' && (
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-800">
                  <FileText className="w-4 h-4" />
                  Boleta Electrónica SII
                </h3>
                
                {emitiendoBoleta && (
                  <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700">Generando boleta electrónica...</span>
                  </div>
                )}

                {boletaError && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-xs text-yellow-800 mb-2">
                      ⚠️ {boletaError}
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setBoletaInfo(null)
                          setBoletaError(null)
                        }}
                      >
                        Reintentar
                      </Button>
                      {order && (
                        <Button 
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            window.location.href = `/orders/${order.id}`
                          }}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Reenviar Email
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {boletaFolio && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700 font-medium">Folio:</span>
                      <span className="font-mono font-bold text-blue-800 text-lg">
                        {boletaFolio}
                      </span>
                    </div>

                    {boletaInfo?.data && (
                      <div className="text-sm text-blue-700 border-t border-blue-200 pt-2">
                        <p>📅 Fecha: {boletaInfo.data.fechaEmision}</p>
                        <p>💰 Total: ${boletaInfo.data.total?.toLocaleString('es-CL')}</p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={verPDF}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={descargarPDF}
                        disabled={descargandoPDF}
                      >
                        {descargandoPDF ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Descargar PDF
                      </Button>
                      {order && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            window.location.href = `/orders/${order.id}`
                          }}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Reenviar
                        </Button>
                      )}
                    </div>
                    
                    <p className="text-xs text-blue-600 text-center mt-2">
                      ✅ También recibirás este PDF por correo electrónico
                    </p>
                  </div>
                )}

                {!boletaFolio && !emitiendoBoleta && !boletaError && (
                  <p className="text-sm text-blue-700">
                    Generando boleta electrónica automáticamente...
                  </p>
                )}
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