"use client"

import { useEffect, useState } from 'react'
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
  ShoppingCart,
  FileText,
  Download,
  Eye,
  Mail
} from 'lucide-react'
import Link from 'next/link'
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

export default function OrderSuccessContent() {
  const { clearCart, items } = useCartStore()

  const searchParams = useSearchParams()
  const router = useRouter()

  const status = searchParams.get('status')
  const orderId = searchParams.get('orderId')
  const message = searchParams.get('message')

  const [mounted, setMounted] = useState(false)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cartClearedLocal, setCartClearedLocal] = useState(false)

  const [boletaInfo, setBoletaInfo] = useState<BoletaInfo | null>(null)
  const [descargandoPDF, setDescargandoPDF] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (!status && !orderId) {
      router.push('/')
      return
    }

    if (orderId) {
      fetchOrderFromMySQL(orderId)
    }
  }, [mounted, orderId, status, router])

  useEffect(() => {
    if (!mounted) return

    if (status === 'success' && !cartClearedLocal && items.length > 0) {
      console.log('🛒 Limpiando carrito local')

      clearCart()
      setCartClearedLocal(true)

      window.dispatchEvent(new CustomEvent('payment-complete'))
      window.dispatchEvent(new CustomEvent('stock-update'))
    }
  }, [mounted, status, items.length, clearCart, cartClearedLocal])

  const fetchOrderFromMySQL = async (id: string) => {
    try {
      setLoading(true)
      setError(null)

      console.log('📦 Consultando orden:', id)

      const response = await fetch(`/api/orders/${id}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      })

      console.log('📡 Status API:', response.status)

      const contentType = response.headers.get('content-type')

      console.log('📡 Content-Type:', contentType)

      if (!contentType?.includes('application/json')) {
        const text = await response.text()

        console.error('❌ La API devolvió HTML:', text.substring(0, 500))

        throw new Error('La API devolvió HTML en vez de JSON')
      }

      const data = await response.json()

      console.log('📦 Datos orden:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar la orden')
      }

      if (data.boleta_emitida === 1 && data.boleta_info?.folio) {
        setBoletaInfo({
          success: true,
          folio: data.boleta_info.folio,
          data: data.boleta_info
        })
      }

      setOrder(data)
    } catch (err: any) {
      console.error('❌ Error cargando orden:', err)

      setError(err.message || 'No se pudo cargar la orden')
    } finally {
      setLoading(false)
    }
  }

  const descargarPDF = async () => {
    const folio = boletaInfo?.folio || order?.boleta_folio

    if (!folio) return

    try {
      setDescargandoPDF(true)

      const response = await fetch(
        `/api/simplefactura/pdf?folio=${folio}`
      )

      if (!response.ok) {
        throw new Error('No se pudo descargar el PDF')
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
    } catch (err) {
      console.error('❌ Error descargando PDF:', err)

      alert('Error descargando PDF')
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
          badge: (
            <Badge className="bg-green-100 text-green-800">
              Completado
            </Badge>
          )
        }

      case 'cancelled':
        return {
          icon: XCircle,
          title: 'Pago Cancelado',
          description: 'Has cancelado el proceso de pago.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          badge: (
            <Badge className="bg-yellow-100 text-yellow-800">
              Cancelado
            </Badge>
          )
        }

      case 'error':
        return {
          icon: XCircle,
          title: 'Error en el Pago',
          description:
            message === 'payment_failed'
              ? 'El pago no pudo ser procesado.'
              : 'Ha ocurrido un error.',
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          badge: (
            <Badge className="bg-red-100 text-red-800">
              Error
            </Badge>
          )
        }

      default:
        return {
          icon: Clock,
          title: 'Procesando...',
          description: 'Estamos procesando tu pedido.',
          color: 'text-blue-600',
          bgColor: 'bg-blue-100',
          badge: (
            <Badge className="bg-blue-100 text-blue-800">
              Procesando
            </Badge>
          )
        }
    }
  }

  if (!mounted) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
      </div>
    )
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon

  const boletaFolio =
    boletaInfo?.folio || order?.boleta_folio

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div
              className={`mx-auto w-16 h-16 rounded-full ${statusConfig.bgColor} flex items-center justify-center mb-4`}
            >
              <StatusIcon
                className={`w-8 h-8 ${statusConfig.color}`}
              />
            </div>

            <CardTitle className="text-2xl font-bold">
              {statusConfig.title}
            </CardTitle>

            <p className="text-muted-foreground mt-2">
              {statusConfig.description}
            </p>

            {statusConfig.badge}
          </CardHeader>

          <CardContent className="space-y-6">
            {loading && (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p>Cargando pedido...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 text-sm text-center">
                  {error}
                </p>
              </div>
            )}

            {order && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Detalles del Pedido
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Número:</span>
                    <span className="font-mono">
                      {order.order_number}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span>
                      $
                      {order.total.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {status === 'success' && boletaFolio && (
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-blue-800">
                  <FileText className="w-4 h-4" />
                  Boleta Electrónica
                </h3>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Folio:</span>

                    <span className="font-mono font-bold">
                      {boletaFolio}
                    </span>
                  </div>

                  <div className="flex gap-2">
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
                      className="flex-1"
                      onClick={descargarPDF}
                      disabled={descargandoPDF}
                    >
                      {descargandoPDF ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}

                      Descargar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-4 pt-4">
              <Link href="/">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a la tienda
                </Button>
              </Link>

              {(status === 'cancelled' ||
                status === 'error') && (
                <Link href="/checkout">
                  <Button variant="outline">
                    Reintentar Pago
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}