"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Clock, ArrowLeft, Package, Loader2, ShoppingCart, FileText, Download, Mail } from 'lucide-react'
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
  const [emitiendoBoleta, setEmitiendoBoleta] = useState(false)
  const [boletaError, setBoletaError] = useState<string | null>(null)
  const [descargandoPDF, setDescargandoPDF] = useState(false)
  const [resendingEmail, setResendingEmail] = useState(false)

  useEffect(() => {
    if (!status && !orderId) {
      router.push('/')
      return
    }

    if (orderId) {
      fetchOrderFromMySQL(orderId)
    }
  }, [orderId, status, router])

  useEffect(() => {
    if (status === 'success' && !cartClearedLocal && items.length > 0) {
      console.log('Limpiando carrito local - pago exitoso confirmado')
      clearCart()
      setCartClearedLocal(true)
      
      window.dispatchEvent(new CustomEvent('payment-complete'))
      window.dispatchEvent(new CustomEvent('stock-update'))
    }
  }, [status, items.length, clearCart, cartClearedLocal])

  useEffect(() => {
    const emitirBoleta = async () => {
      if (status !== 'success' || !order || boletaInfo || emitiendoBoleta || order.boleta_emitida === 1) {
        return
      }

      const emittedKey = `boleta_${order.id}`
      if (sessionStorage.getItem(emittedKey)) {
        console.log('Boleta ya emitida para esta orden')
        return
      }

      setEmitiendoBoleta(true)
      setBoletaError(null)

      try {
        console.log('Emitiendo boleta para orden:', order.id)
        
        let rutCliente = order.customer_rut || '55555555-5'
        let nombreCliente = order.customer_first_name || 'Consumidor'
        let apellidoCliente = order.customer_last_name || 'Final'
        
        if (rutCliente === '11111111-2' || !rutCliente.match(/^[0-9]+-[0-9Kk]$/)) {
          console.log('RUT invalido, usando consumidor final')
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
          
          sessionStorage.setItem(`boleta_${order.id}`, 'true')
          
          console.log('Boleta emitida con folio:', resultado.folio)
        } else {
          setBoletaError(resultado.error || 'Error al emitir boleta')
          console.error('Error emitiendo boleta:', resultado)
        }
      } catch (error: any) {
        setBoletaError('Error de conexion al emitir boleta')
        console.error('Error:', error)
      } finally {
        setEmitiendoBoleta(false)
      }
    }

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
        console.log('Orden cargada:', {
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
        }
        
        setOrder(orderData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar la orden')
      }
    } catch (error) {
      console.error('Error fetching order:', error)
      setError('No se pudo cargar la informacion del pedido')
    } finally {
      setLoading(false)
    }
  }

  const descargarPDF = async () => {
    const folio = boletaInfo?.folio || order?.boleta_info?.folio
    if (!folio) {
      toast({
        title: "Boleta no disponible",
        description: "Aun no se ha generado la boleta electronica",
        variant: "destructive",
      })
      return
    }
    
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
        description: "No se encontro la informacion de la orden",
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
          description: data.message || "El email de confirmacion ha sido reenviado exitosamente",
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
        description: "No se pudo reenviar el email. Intentalo de nuevo.",
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
            ? 'No se pudo encontrar la informacion de tu pedido.'
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
                <span>Carrito limpiado automaticamente</span>
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
                    <span className="text-muted-foreground">Numero de Pedido:</span>
                    <span className="font-mono">{order.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span>${order.total.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              </div>
            )}

            {status === 'success' && tieneBoleta && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Boleta Electronica
                </h3>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
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
                    className="flex-1"
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
                  </p>
                )}
              </div>
            )}

            {status === 'success' && !tieneBoleta && emitiendoBoleta && (
              <div className="border rounded-lg p-4 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                <p className="text-sm text-muted-foreground">Generando boleta electronica...</p>
              </div>
            )}

            {status === 'success' && !tieneBoleta && !emitiendoBoleta && boletaError && (
              <div className="border rounded-lg p-4 text-center">
                <p className="text-sm text-red-600 mb-2">Error al generar la boleta</p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setBoletaInfo(null)
                    setBoletaError(null)
                    setEmitiendoBoleta(false)
                  }}
                >
                  Reintentar
                </Button>
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