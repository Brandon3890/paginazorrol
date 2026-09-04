// app/admin/orders/[id]/page.tsx
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
  CreditCard,
  Users,
  Store,
  FileText,
  Download,
  Eye,
  AlertCircle,
  Search
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

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
  customer_rut?: string
  is_guest?: boolean
  shipping_type?: string
  shipping_details?: any
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
  boleta_info?: {
    folio: string
    monto_total: number
    fecha_emision: string
    estado_sii: string
  }
  boleta_emitida?: number
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800" },
}

// Función para calcular Neto e IVA desde un monto que ya incluye IVA
const calculateTaxBreakdown = (amountWithIVA: number) => {
  const neto = Math.round(amountWithIVA / 1.19)
  const iva = amountWithIVA - neto
  return { neto, iva }
}

export default function AdminOrderDetailPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const { toast } = useToast()
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estado para la boleta
  const [consultandoBoleta, setConsultandoBoleta] = useState(false)
  const [boletaEstado, setBoletaEstado] = useState<string | null>(null)
  const [boletaFolio, setBoletaFolio] = useState<string | null>(null)
  const [boletaError, setBoletaError] = useState<string | null>(null)
  const [descargandoPDF, setDescargandoPDF] = useState(false)

  const formatPrice = (price: number) => {
    if (isNaN(price) || price === undefined || price === null) return '$0'
    return '$' + price.toLocaleString('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  }

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
      
      const response = await fetch(`/api/admin/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        console.log('Order data received:', orderData)
        setOrder(orderData)
        
        // Si ya tiene boleta, mostrar el estado
        if (orderData.boleta_emitida === 1 && orderData.boleta_info?.folio) {
          setBoletaFolio(orderData.boleta_info.folio)
          setBoletaEstado(orderData.boleta_info.estado_sii || 'emitida')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar los detalles del pedido')
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
      setError('No se pudieron cargar los detalles del pedido. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  //  FUNCIÓN PARA CONSULTAR LA BOLETA POR FOLIO
  const consultarBoleta = async () => {
    const folio = order?.boleta_info?.folio || boletaFolio
    
    if (!folio) {
      toast({
        title: "Sin folio",
        description: "No se encontró el folio de la boleta",
        variant: "destructive",
      })
      return
    }

    setConsultandoBoleta(true)
    setBoletaError(null)
    
    try {
      const response = await fetch(`/api/apigateway/consultar?folio=${folio}`)
      const data = await response.json()
      
      
      if (data.success && data.data) {
        const estado = data.data.estado || data.data.estado_boleta || 'desconocido'
        setBoletaEstado(estado)
        setBoletaFolio(folio)
        
        toast({
          title: " Estado consultado",
          description: `Boleta N° ${folio} está en estado: ${estado}`,
          duration: 5000,
        })
      } else {
        setBoletaError(data.error || 'Error al consultar la boleta')
        toast({
          title: " Error",
          description: data.error || 'No se pudo consultar la boleta',
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error(' Error consultando boleta:', error)
      setBoletaError(error.message || 'Error de conexión')
      toast({
        title: " Error",
        description: error.message || 'Error al consultar la boleta',
        variant: "destructive",
      })
    } finally {
      setConsultandoBoleta(false)
    }
  }

  //  FUNCIÓN PARA BUSCAR BOLETA POR ORDEN (cuando NO tiene folio)
  const consultarBoletaPorOrden = async () => {
    if (!order) {
      toast({
        title: "Error",
        description: "No hay información de la orden",
        variant: "destructive",
      })
      return
    }

    setConsultandoBoleta(true)
    setBoletaError(null)
    setBoletaEstado(null)
    
    try {
      const rutCliente = order.customer_rut || '55555555-5'
      
      
      const fechaFin = new Date().toISOString().split('T')[0]
      const fechaInicio = new Date()
      fechaInicio.setDate(fechaInicio.getDate() - 90)
      const fechaInicioStr = fechaInicio.toISOString().split('T')[0]
      
      const response = await fetch('/api/apigateway/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_from: fechaInicioStr,
          date_to: fechaFin,
          page: 1,
          items_per_page: 100,
          estado: 'aceptada,rechazada,en_proceso'
        })
      })
      
      const data = await response.json()
      console.log(' Documentos encontrados:', data)
      
      if (data.success && data.data && data.data.length > 0) {
        const montoOrden = Math.round(order.total)
        
        // Buscar por monto exacto
        let boletaEncontrada = data.data.find((doc: any) => {
          const montoDoc = Math.round(doc.total || 0)
          return montoDoc === montoOrden
        })
        
        // Si no se encuentra por monto, buscar la más reciente
        if (!boletaEncontrada && data.data.length > 0) {
          const sorted = [...data.data].sort((a, b) => 
            new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
          )
          boletaEncontrada = sorted[0]
        }
        
        if (boletaEncontrada) {
          const folio = boletaEncontrada.folio
          setBoletaFolio(folio)
          setBoletaEstado(boletaEncontrada.estado_boleta || 'Aceptada')
          
          toast({
            title: " Boleta encontrada",
            description: `Folio: ${folio} - Estado: ${boletaEncontrada.estado_boleta || 'Aceptada'}`,
            duration: 5000,
          })
        } else {
          setBoletaError('No se encontró una boleta que coincida con esta orden')
          toast({
            title: " No encontrada",
            description: "No se encontró una boleta para esta orden",
            variant: "default",
          })
        }
      } else {
        setBoletaError('No se encontraron boletas para este cliente')
        toast({
          title: " Sin boletas",
          description: "No se encontraron boletas en el SII para este cliente",
          variant: "default",
        })
      }
    } catch (error: any) {
      console.error(' Error buscando boleta:', error)
      setBoletaError(error.message || 'Error de conexión')
      toast({
        title: " Error",
        description: error.message || 'Error al buscar la boleta',
        variant: "destructive",
      })
    } finally {
      setConsultandoBoleta(false)
    }
  }

  //  FUNCIÓN PARA DESCARGAR LA BOLETA
  const descargarBoleta = async () => {
    const folio = order?.boleta_info?.folio || boletaFolio
    
    if (!folio) {
      toast({
        title: "Sin boleta",
        description: "Esta orden no tiene una boleta asociada",
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
          title: " PDF descargado",
          description: `Boleta N° ${folio} descargada exitosamente`,
          duration: 3000,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: " Error",
          description: errorData.error || "Error al descargar PDF",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error descargando PDF:', error)
      toast({
        title: " Error",
        description: "No se pudo descargar el PDF",
        variant: "destructive",
      })
    } finally {
      setDescargandoPDF(false)
    }
  }

  //  FUNCIÓN MEJORADA PARA OBTENER LA URL DE LA IMAGEN
  const getImageUrl = (imagePath: string | undefined) => {
    // Si no hay imagen, usar placeholder
    if (!imagePath) {
      return "/placeholder.svg"
    }
    
    // Si ya es una URL completa (http o https)
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath
    }
    
    // Si es una ruta que comienza con /uploads/ (ruta absoluta desde la raíz)
    if (imagePath.startsWith('/uploads/')) {
      return imagePath
    }
    
    // Si es una ruta que comienza con uploads/ (sin slash inicial)
    if (imagePath.startsWith('uploads/')) {
      return `/${imagePath}`
    }
    
    // Si es una ruta que comienza con / (ruta absoluta)
    if (imagePath.startsWith('/')) {
      return imagePath
    }
    
    // Para cualquier otro caso, asumimos que está en /uploads/products/
    return `/uploads/products/${imagePath}`
  }

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'transbank': return 'Transbank Webpay'
      case 'cash': return 'Efectivo'
      default: return method || 'Transbank Webpay'
    }
  }

  const formatPaymentType = (type: string) => {
    switch (type) {
      case 'VN': return 'Débito'
      case 'VC': return 'Crédito'
      case 'SI': return 'Cuotas'
      default: return type || 'No especificado'
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

  //  FUNCIÓN PARA OBTENER LA DIRECCIÓN DE ENVÍO MOSTRADA
  const getShippingDisplay = () => {
    if (!order) return null
    
    const shippingType = order.shipping_type || ''
    const shippingDetails = order.shipping_details
    
    // Caso 1: Retiro en Bodega
    if (shippingType === 'bodega_pickup' || shippingDetails?.type === 'bodega_pickup') {
      const branch = shippingDetails?.selectedBranch || {
        address: 'Arcangel 1200, San Miguel'
      }
      return {
        type: 'bodega',
        title: 'Retiro en Bodega',
        address: branch.address || 'Arcangel 1200, San Miguel',
        details: '',
        icon: Store
      }
    }
    
    // Caso 2: Retiro en Sucursal
    if (shippingType === 'branch_pickup' || shippingDetails?.selectedBranch) {
      const branch = shippingDetails?.selectedBranch
      return {
        type: 'branch',
        title: 'Retiro en Sucursal',
        address: branch?.address || 'Sucursal Chilexpress',
        details: branch?.name ? `Sucursal: ${branch.name}` : '',
        icon: Store
      }
    }
    
    // Caso 3: Envío a Domicilio
    if (shippingType === 'home_delivery' || shippingType === 'standard' || shippingType === 'express') {
      return {
        type: 'home',
        title: 'Envío a Domicilio',
        address: order.shipping_address?.street || 'Dirección no especificada',
        details: `${order.shipping_address?.commune_name || ''} ${order.shipping_address?.region_name ? `, ${order.shipping_address.region_name}` : ''}`,
        icon: Truck
      }
    }
    
    return null
  }

  const shippingDisplay = getShippingDisplay()

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
  const { neto: subtotalNeto, iva: subtotalIVA } = calculateTaxBreakdown(order.subtotal)
  const tieneBoleta = order.boleta_emitida === 1 && order.boleta_info?.folio

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/admin/orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a todos los pedidos
          </Link>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-bold">Pedido #{order.order_number}</h1>
                {order.is_guest ? (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
                    <User className="w-3 h-3 mr-1" />
                    Invitado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                    <Users className="w-3 h-3 mr-1" />
                    Cliente Registrado
                  </Badge>
                )}
              </div>
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
          <div className="xl:col-span-1 space-y-6">
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
                    <p className="font-medium">
                      {order.customer_first_name} {order.customer_last_name}
                    </p>
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  Dirección de Envío
                </CardTitle>
              </CardHeader>
              <CardContent>
                {shippingDisplay ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <shippingDisplay.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{shippingDisplay.title}</span>
                    </div>
                    <p className="text-sm">{shippingDisplay.address}</p>
                    {shippingDisplay.details && (
                      <p className="text-sm text-muted-foreground">{shippingDisplay.details}</p>
                    )}

                    {shippingDisplay.type === 'branch' && order.shipping_details?.selectedBranch?.telephone && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">📞 {order.shipping_details.selectedBranch.telephone}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Dirección no especificada</p>
                )}
              </CardContent>
            </Card>

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
                        <span className="text-muted-foreground">Código autorización:</span>
                        <span className="font-mono text-xs">{order.transbank_info.authorization_code}</span>
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
                        <span className="font-mono text-xs">**** {order.transbank_info.card_number}</span>
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

            {/*  SECCIÓN DE BOLETA - COMPLETA */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  Boleta Electrónica
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/*  SI TIENE BOLETA EN LA BD */}
                {tieneBoleta ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Folio:</span>
                      <span className="font-mono font-medium">{order.boleta_info?.folio}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estado:</span>
                      <Badge variant={order.boleta_info?.estado_sii === 'emitida' ? 'default' : 'outline'}>
                        {order.boleta_info?.estado_sii || 'emitida'}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={consultarBoleta}
                        disabled={consultandoBoleta}
                      >
                        {consultandoBoleta ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4 mr-2" />
                        )}
                        Consultar estado en el SII
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={descargarBoleta}
                        disabled={descargandoPDF}
                      >
                        {descargandoPDF ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Descargar PDF
                      </Button>
                    </div>
                    {boletaEstado && boletaEstado !== order.boleta_info?.estado_sii && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">
                          Estado actualizado: <strong>{boletaEstado}</strong>
                        </p>
                      </div>
                    )}
                    {boletaError && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-600">{boletaError}</p>
                      </div>
                    )}
                  </>
                ) : (
                  //  NO TIENE BOLETA - BOTÓN PARA VERIFICAR
                  <>
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Esta orden no tiene una boleta asociada en la base de datos
                    </p>
                    <div className="flex flex-col gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={consultarBoletaPorOrden}
                        disabled={consultandoBoleta}
                      >
                        {consultandoBoleta ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4 mr-2" />
                        )}
                        Verificar si existe en el SII
                      </Button>
                    </div>
                    {boletaEstado && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs text-green-700">
                           Boleta encontrada - Folio: <strong>{boletaFolio}</strong>
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          Estado: <strong>{boletaEstado}</strong>
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={descargarBoleta}
                          disabled={descargandoPDF}
                        >
                          {descargandoPDF ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          Descargar PDF
                        </Button>
                      </div>
                    )}
                    {boletaError && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-600">{boletaError}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Productos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => {
                      const itemTotal = item.product_price * item.quantity
                      const imageUrl = getImageUrl(item.image_url)
                      
                      return (
                        <div key={item.id} className="flex gap-4 p-3 bg-muted/30 rounded-lg">
                          <div className="relative w-16 h-16 flex-shrink-0">
                            <Image
                              src={imageUrl}
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
                              {formatPrice(itemTotal)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatPrice(item.product_price)} c/u
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No hay productos en esta orden</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                    <span>Neto (sin IVA):</span>
                    <span>{formatPrice(subtotalNeto)}</span>
                  </div>
                  <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                    <span>IVA (19%):</span>
                    <span>{formatPrice(subtotalIVA)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="text-muted-foreground">Descuento:</span>
                      <span>-{formatPrice(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envío:</span>
                    <span>
                      {order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium text-base">
                    <span>Total:</span>
                    <span>{formatPrice(order.total)}</span>
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