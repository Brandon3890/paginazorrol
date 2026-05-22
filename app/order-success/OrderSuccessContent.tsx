// app/order-success/OrderSuccessContent.tsx
"use client"

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
}

interface BoletaInfo {
  success: boolean
  folio?: string
  data?: any
}

export default function OrderSuccessContent() {
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

  const [boletaInfo, setBoletaInfo] = useState<BoletaInfo | null>(null)
  const [descargandoPDF, setDescargandoPDF] = useState(false)

  useEffect(() => {
    if (!status && !orderId) {
      router.push('/')
      return
    }

    if (orderId) {
      fetchOrder(orderId)
    }
  }, [orderId, status])

  useEffect(() => {
    if (status === 'success' && !cartClearedLocal && items.length > 0) {
      clearCart()
      setCartClearedLocal(true)
    }
  }, [status, items.length])

  const fetchOrder = async (id: string) => {
    try {
      setLoading(true)

      const response = await fetch(`/api/orders/${id}`)

      if (!response.ok) {
        throw new Error('Error cargando orden')
      }

      const data = await response.json()

      setOrder(data)

      if (data.boleta_emitida === 1 && data.boleta_folio) {
        setBoletaInfo({
          success: true,
          folio: data.boleta_folio,
          data: data.boleta_info
        })
      }

    } catch (err) {
      console.error(err)
      setError('No se pudo cargar la orden')
    } finally {
      setLoading(false)
    }
  }

  const descargarPDF = async () => {
    const folio = boletaInfo?.folio || order?.boleta_folio

    if (!folio) return

    try {
      setDescargandoPDF(true)

      const response = await fetch(`/api/simplefactura/pdf?folio=${folio}`)

      if (!response.ok) {
        throw new Error('Error descargando PDF')
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

    } catch (error) {
      console.error(error)
      alert('No se pudo descargar el PDF')
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
          description: 'Tu pedido fue procesado correctamente.',
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
          description: 'Has cancelado el pago.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          badge: (
            <Badge className="bg-yellow-100 text-yellow-800">
              Cancelado
            </Badge>
          )
        }

      default:
        return {
          icon: Clock,
          title: 'Procesando',
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

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>

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

            {loading && (
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            )}

            {error && (
              <div className="text-red-500 text-center">
                {error}
              </div>
            )}

            {order && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4" />
                  Pedido
                </h3>

                <div className="space-y-2 text-sm">

                  <div className="flex justify-between">
                    <span>Número:</span>
                    <span>{order.order_number}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span>${order.total.toLocaleString('es-CL')}</span>
                  </div>

                </div>
              </div>
            )}

            {boletaInfo?.folio && (
              <div className="border rounded-lg p-4 bg-blue-50">

                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4" />
                  Boleta Electrónica
                </h3>

                <div className="flex justify-between mb-4">
                  <span>Folio:</span>
                  <span className="font-bold">{boletaInfo.folio}</span>
                </div>

                <div className="flex gap-2">

                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={verPDF}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver PDF
                  </Button>

                  <Button
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
            )}

            <div className="flex justify-center">
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
    </div>
  )
}