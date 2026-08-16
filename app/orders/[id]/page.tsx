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
  Mail,
  Download,
  Eye,
  Check,
  Store
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"

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
  shipping_type?: 'home_delivery' | 'branch_pickup' | 'cash_on_delivery' | 'standard'
  shipping_details?: {
    type?: string
    carrier?: string
    serviceName?: string
    serviceCode?: number
    finalWeight?: number
    selectedBranch?: {
      id?: string | number
      name: string
      address: string
      telephone?: string
    }
    isCashOnDelivery?: boolean
    actualShippingCost?: number
  }
  created_at: string
  updated_at: string
  status_dates?: Record<string, string>
  items: OrderItem[]
  customer_email: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  boleta_id?: number
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
    postal_code: string
    department?: string
    delivery_instructions?: string
  }
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800 border-yellow-200", step: 0 },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800 border-blue-200", step: 1 },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800 border-purple-200", step: 2 },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800 border-green-200", step: 3 },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800 border-red-200", step: -1 },
}

const orderSteps = [
  {
    key: "pending",
    label: "Pedido Recibido",
    description: "Hemos recibido tu pedido. Estamos revisando tu pago.",
    icon: Clock,
  },
  {
    key: "processing",
    label: "Validando Compra",
    description: "Estamos emitiendo tu boleta y preparando tu pedido.",
    icon: Package,
  },
  {
    key: "shipped",
    label: "En Camino",
    description: "Tu pedido está en camino.",
    icon: Truck,
  },
  {
    key: "delivered",
    label: "Entrega",
    description: "Tu pedido ha sido entregado con éxito.",
    icon: CheckCircle,
  },
]

// FUNCIÓN PARA OBTENER EL MÉTODO DE ENVÍO MOSTRADO
const getShippingMethodDisplay = (order: Order | null) => {
  if (!order) return 'Método no especificado'
  
  const shippingDetails = order.shipping_details
  const shippingType = order.shipping_type || ''
  
  // 1. Si tiene detalles de envío con sucursal seleccionada
  if (shippingDetails?.selectedBranch) {
    return `Retiro en Sucursal - ${shippingDetails.selectedBranch.name}`
  }
  
  // 2. Si tiene detalles de envío con envío por pagar
  if (shippingDetails?.isCashOnDelivery) {
    return 'Envío por Pagar - Paga al momento de la entrega'
  }
  
  // 3. Si tiene nombre del servicio en detalles
  if (shippingDetails?.serviceName) {
    return shippingDetails.serviceName
  }
  
  // 4. Si tiene tipo de envío
  if (shippingType) {
    switch (shippingType) {
      case 'branch_pickup':
        return 'Retiro en Sucursal'
      case 'cash_on_delivery':
        return 'Envío por Pagar - Paga al momento de la entrega'
      case 'home_delivery':
        if (order.shipping_address?.street) {
          return `Envío a Domicilio - ${order.shipping_address.street}, ${order.shipping_address.commune_name}`
        }
        return 'Envío a Domicilio'
      default:
        break
    }
  }
  
  // 5. Si tiene shipping_method y no es "transbank"
  if (order.shipping_method && order.shipping_method.toLowerCase() !== 'transbank') {
    return order.shipping_method
  }
  
  // 6. Si tiene costo de envío, asumimos que es a domicilio
  if (order.shipping > 0) {
    if (order.shipping_address?.street) {
      return `Envío a Domicilio - ${order.shipping_address.street}, ${order.shipping_address.commune_name}`
    }
    return 'Envío a Domicilio'
  }
  
  return 'Método no especificado'
}

const calculateTaxBreakdown = (amountWithIVA: number) => {
  const neto = Math.round(amountWithIVA / 1.19)
  const iva = amountWithIVA - neto
  return { neto, iva }
}

const formatCLP = (amount: number): string => {
  if (isNaN(amount) || amount === undefined || amount === null) return '$0'
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
  const [descargandoPDF, setDescargandoPDF] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.push("/login?from=" + encodeURIComponent(`/orders/${orderId}`))
      return
    }

    fetchOrder()
  }, [isAuthenticated, authLoading, router, orderId])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        setOrder(orderData)
      } else if (response.status === 404) {
        setError('Orden no encontrada')
      } else if (response.status === 401) {
        setError('No tienes permisos para ver esta orden')
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

  const handleResendEmail = async () => {
    setResendingEmail(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/resend-email`, {
        method: 'POST',
      })

      if (response.ok) {
        toast({
          title: "Email reenviado",
          description: "El email de confirmacion ha sido reenviado exitosamente",
          duration: 5000,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "No se pudo reenviar el email",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error reenviando email:', error)
      toast({
        title: "Error",
        description: "No se pudo reenviar el email. Intentelo de nuevo.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setResendingEmail(false)
    }
  }

  const descargarBoleta = async () => {
    const folio = order?.boleta_info?.folio
    if (!folio) {
      toast({
        title: "Boleta no disponible",
        description: "Aun no se ha generado la boleta electronica para este pedido",
        variant: "destructive",
        duration: 5000,
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
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error descargando PDF:', error)
      toast({
        title: "Error",
        description: "No se pudo descargar el PDF. Intentelo nuevamente.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setDescargandoPDF(false)
    }
  }

  const verBoleta = async () => {
    const folio = order?.boleta_info?.folio
    if (!folio) {
      toast({
        title: "Boleta no disponible",
        description: "Aun no se ha generado la boleta electronica para este pedido",
        variant: "destructive",
        duration: 5000,
      })
      return
    }
    window.open(`/api/simplefactura/pdf?folio=${folio}`, '_blank')
  }

  const getImageUrl = (url?: string) => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith("http")) return url
    if (url.startsWith("/")) return url
    if (url.startsWith("uploads/")) return `/${url}`
    return `/uploads/products/${url}`
  }

  const getCurrentStep = () => {
    if (!order) return -1
    const status = order.status as keyof typeof statusConfig
    const config = statusConfig[status]
    if (!config) return -1
    if (status === 'cancelled') return -1
    return config.step
  }

  const currentStep = getCurrentStep()
  const isCancelled = order?.status === 'cancelled'

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando autenticacion...</p>
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
  const addressInfo = order.shipping_address || {
    street: "Direccion no especificada",
    commune_name: "Ciudad no especificada", 
    region_name: "Region no especificada",
    postal_code: "000000",
    department: "",
    delivery_instructions: ""
  }
  const tieneBoleta = order.boleta_emitida === 1 && order.boleta_info?.folio
  
  const { neto: subtotalNeto, iva: subtotalIVA } = calculateTaxBreakdown(order.subtotal)

  // OBTENER EL MÉTODO DE ENVÍO PARA MOSTRAR
  const shippingMethodDisplay = getShippingMethodDisplay(order)
  
  // DETERMINAR SI ES RETIRO EN SUCURSAL O DOMICILIO
  const isBranchPickup = order.shipping_type === 'branch_pickup' || order.shipping_details?.selectedBranch !== undefined
  const isHomeDelivery = order.shipping_type === 'home_delivery'
  const isCashOnDelivery = order.shipping_type === 'cash_on_delivery' || order.shipping_details?.isCashOnDelivery === true

  // OBTENER LA SUCURSAL SELECCIONADA
  const selectedBranch = order.shipping_details?.selectedBranch

  // DETERMINAR SI EL PEDIDO ESTÁ ENTREGADO
  const isDelivered = order.status === 'delivered'

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Link href="/orders">
            <span className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Mis Pedidos
            </span>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Pedido #{order.order_number}
              </h1>
              <p className="text-muted-foreground mt-1">
                Realizado el {new Date(order.created_at).toLocaleDateString("es-CL", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <Badge 
              className={`${statusInfo.color} border text-base px-4 py-1.5 font-semibold`}
            >
              <StatusIcon className="w-4 h-4 mr-2" />
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">

            {/* PRODUCTOS */}
            <Card className="shadow-sm gap-1">
              <CardHeader className="pb-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Productos
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2 pt-0">
                {order.items && order.items.length > 0 ? (
                  order.items.map((item) => {
                    const itemTotal = item.product_price * item.quantity

                    return (
                      <div
                        key={item.id}
                        className="flex gap-2 p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="relative w-14 h-14 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
                          <Image
                            src={getImageUrl(item.image_url)}
                            alt={item.product_name}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/placeholder.svg"
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {item.product_name}
                          </h4>

                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {item.category || "General"}
                            </Badge>

                            <span className="text-xs text-muted-foreground">
                              Cantidad: {item.quantity}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="font-medium text-sm">
                            {formatCLP(itemTotal)}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            {formatCLP(item.product_price)} c/u
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No hay productos en esta orden
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SEGUIMIENTO DEL PEDIDO */}
            {!isCancelled && (
              <Card className="shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Seguimiento del pedido
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <div className="relative">
                    <div className="relative">
                      {orderSteps.map((step, index) => {
                        const isCompleted = currentStep > index
                        const isActive = currentStep === index

                        let stepStatus = "pending"
                        if (step.key === "delivered" && isActive) {
                          stepStatus = "completed"
                        } else if (isCompleted) {
                          stepStatus = "completed"
                        } else if (isActive) {
                          stepStatus = "active"
                        }

                        const StepIcon = step.icon

                        let stepDescription = step.description
                        if (step.key === "shipped" && (isCompleted || isActive)) {
                          stepDescription = shippingMethodDisplay
                        }
                        if (step.key === "delivered" && (isCompleted || isActive)) {
                          if (isBranchPickup) {
                            const branch = order.shipping_details?.selectedBranch
                            if (branch) {
                              stepDescription = `Disponible para retiro en ${branch.name}`
                            } else {
                              stepDescription = 'Disponible para retiro'
                            }
                          } else if (isHomeDelivery) {
                            stepDescription = `Entregado en tu domicilio: ${order.shipping_address?.street || ''}`
                          } else if (isCashOnDelivery) {
                            stepDescription = 'Entrega realizada - Pago del envío completado'
                          }
                        }

                        const getColors = () => {
                          if (stepStatus === "completed") {
                            return {
                              circle: "bg-green-500 border-green-500 text-white",
                              line: "bg-green-400",
                              title: "text-green-700",
                              description: "text-green-600",
                              badge: "bg-green-100 text-green-700 border-green-200",
                            }
                          } else if (stepStatus === "active") {
                            return {
                              circle: "bg-blue-500 border-blue-500 text-white ring-4 ring-blue-100",
                              line: "bg-blue-400",
                              title: "text-blue-700",
                              description: "text-blue-600",
                              badge: "bg-blue-100 text-blue-700 border-blue-200",
                            }
                          } else {
                            return {
                              circle: "bg-gray-100 border-gray-300 text-gray-400",
                              line: "bg-gray-200",
                              title: "text-gray-500",
                              description: "text-gray-400",
                              badge: "bg-gray-100 text-gray-500 border-gray-200",
                            }
                          }
                        }

                        const colors = getColors()

                        return (
                          <motion.div
                            key={step.key}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="relative flex items-start gap-5 pb-8 last:pb-0"
                          >
                            <div className="relative flex flex-col items-center">
                              <div
                                className={`
                                  w-10 h-10 rounded-full flex items-center justify-center border-2
                                  ${colors.circle}
                                  transition-all duration-300
                                  ${stepStatus === "active" ? "shadow-lg shadow-blue-200" : ""}
                                `}
                              >
                                {stepStatus === "completed" ? (
                                  <Check className="w-5 h-5" />
                                ) : (
                                  <StepIcon className="w-5 h-5" />
                                )}
                              </div>

                              {index < orderSteps.length - 1 && stepStatus !== "pending" && (
                                <div
                                  className={`
                                    absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-8
                                    ${stepStatus === "pending" ? "bg-gray-200" : colors.line}
                                    transition-colors duration-300
                                  `}
                                />
                              )}
                            </div>

                            <div className="flex-1 pt-0.5">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                  <h4
                                    className={`
                                      font-semibold text-base
                                      ${colors.title}
                                      transition-colors duration-300
                                    `}
                                  >
                                    {step.label}
                                  </h4>

                                  {/* DESCRIPCIÓN CON EL MÉTODO DE ENVÍO */}
                                  <p
                                    className={`
                                      text-sm mt-0.5
                                      ${colors.description}
                                      transition-colors duration-300
                                    `}
                                  >
                                    {stepDescription}
                                  </p>

                                  {/* INFORMACIÓN DETALLADA DE ENVÍO - SE MUESTRA CUANDO EL ESTADO ES "shipped" (En Camino) */}
                                  {step.key === "shipped" && (isActive || isCompleted) && (
                                    <div className="mt-3 space-y-2">
                                      <div className="flex flex-wrap gap-2">
                                        {isBranchPickup && (
                                          <Badge variant="outline" className={`text-xs ${isDelivered ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                            <Store className="w-3 h-3 mr-1" />
                                            Retiro en Sucursal
                                          </Badge>
                                        )}
                                        {isHomeDelivery && (
                                          <Badge variant="outline" className={`text-xs ${isDelivered ? 'bg-green-50 border-green-200 text-green-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                                            <Truck className="w-3 h-3 mr-1" />
                                            Envío a Domicilio
                                          </Badge>
                                        )}
                                        {isCashOnDelivery && (
                                          <Badge variant="outline" className={`text-xs ${isDelivered ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                            <CreditCard className="w-3 h-3 mr-1" />
                                            Envío por Pagar
                                          </Badge>
                                        )}
                                        {order.shipping === 0 && order.total > 0 && (
                                          <Badge variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                                            Envío Gratis
                                          </Badge>
                                        )}
                                      </div>

                                      {/* DETALLE DE SUCURSAL - SOLO PARA RETIRO EN SUCURSAL */}
                                      {isBranchPickup && selectedBranch && (
                                        <div className={`p-3 rounded-lg ${isDelivered ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
                                          <p className={`text-sm ${isDelivered ? 'text-green-700' : 'text-blue-700'} flex items-start gap-2`}>
                                            <Store className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>
                                              <strong>Sucursal de retiro:</strong><br />
                                              {selectedBranch.name}<br />
                                              {selectedBranch.address}
                                            </span>
                                          </p>
                                        </div>
                                      )}

                                      {/*  DETALLE DE DOMICILIO - SOLO PARA ENVÍO A DOMICILIO */}
                                      {isHomeDelivery && order.shipping_address && (
                                        <div className={`p-3 rounded-lg ${isDelivered ? 'bg-green-50 border border-green-200' : 'bg-green-50 border border-green-200'}`}>
                                          <p className={`text-sm ${isDelivered ? 'text-green-700' : 'text-green-700'} flex items-start gap-2`}>
                                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>
                                              <strong>Dirección de entrega:</strong>
                                              <br />
                                              {order.shipping_address.street}
                                              <br />
                                              {order.shipping_address.commune_name},{" "}
                                              {order.shipping_address.region_name}
                                              {order.shipping_address.department && (
                                                <>
                                                  <br />
                                                  Depto: {order.shipping_address.department}
                                                </>
                                              )}
                                            </span>
                                          </p>
                                          {order.shipping_details?.serviceName && (
                                            <p className={`text-xs ${isDelivered ? 'text-green-600' : 'text-green-600'} mt-1 pl-6`}>
                                              {order.shipping_details.serviceName}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* DETALLE PARA ENVÍO POR PAGAR */}
                                      {isCashOnDelivery && (
                                        <div className={`p-3 rounded-lg ${isDelivered ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                                          <p className={`text-sm ${isDelivered ? 'text-green-700' : 'text-amber-700'} flex items-start gap-2`}>
                                            <CreditCard className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>
                                              <strong>Envío por Pagar</strong><br />
                                              El costo del envío se pagará al momento de la entrega.
                                              {order.shipping > 0 && (
                                                <> Monto a pagar: {formatCLP(order.shipping)}</>
                                              )}
                                            </span>
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/*  INFORMACIÓN DE ENTREGA - SOLO CUANDO ESTÁ ENTREGADO */}
                                  {step.key === "delivered" && (isActive || isCompleted) && (
                                    <div className="mt-3">
                                      {isBranchPickup && selectedBranch && (
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                          <p className="text-sm text-green-700 flex items-start gap-2">
                                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>
                                              <strong>¡Pedido listo para retirar!</strong>
                                            </span>
                                          </p>
                                        </div>
                                      )}
                                      {isHomeDelivery && order.shipping_address && (
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                          <p className="text-sm text-green-700 flex items-start gap-2">
                                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>
                                              <strong>¡Pedido entregado!</strong><br />
                                            </span>
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {stepStatus !== "pending" && (
                                  <Badge
                                    variant="outline"
                                    className={`text-xs font-medium ${colors.badge} border`}
                                  >
                                    {stepStatus === "completed" ? (
                                      <>
                                        <Check className="w-3 h-3 mr-1" />
                                        Completado
                                      </>
                                    ) : (
                                      <>
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                        En proceso
                                      </>
                                    )}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* NOTAS */}
            {order.notes && (
              <Card className="shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Notas del pedido
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    {order.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* COLUMNA DERECHA */}
          <div className="space-y-3">

            {/* RESUMEN */}
            <Card className="shadow-sm gap-1">
              <CardHeader className="pb-1">
                <CardTitle className="text-lg">
                  Resumen
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Subtotal
                    </span>

                    <span className="font-medium">
                      {formatCLP(order.subtotal)}
                    </span>
                  </div>

                  <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                    <span>Neto (sin IVA)</span>
                    <span>{formatCLP(subtotalNeto)}</span>
                  </div>

                  <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                    <span>IVA (19%)</span>
                    <span>{formatCLP(subtotalIVA)}</span>
                  </div>

                  {order.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="text-muted-foreground">
                        Descuento
                      </span>

                      <span>
                        -{formatCLP(order.discount)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Envío
                    </span>

                    <span className="font-medium">
                      {order.shipping === 0
                        ? "Gratis"
                        : formatCLP(order.shipping)}
                    </span>
                  </div>

                  <Separator className="my-2" />

                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>

                    <span className="text-primary">
                      {formatCLP(order.total)}
                    </span>
                  </div>
                </div>

                {order.coupon_code && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      <span className="font-medium">
                        Cupón aplicado:
                      </span>{" "}
                      {order.coupon_code}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DIRECCIÓN DE ENVÍO */}
            <Card className="shadow-sm gap-1">
              <CardHeader className="pb-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Dirección de envío
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2 text-sm pt-0">
                <div className="font-medium">
                  {order.customer_first_name}{" "}
                  {order.customer_last_name}
                </div>

                <div className="text-muted-foreground space-y-1">
                  <p>{addressInfo.street}</p>

                  <p>
                    {addressInfo.commune_name},{" "}
                    {addressInfo.region_name}
                  </p>

                  <p>
                    Código postal: {addressInfo.postal_code}
                  </p>

                  {addressInfo.department && (
                    <p>
                      Departamento: {addressInfo.department}
                    </p>
                  )}

                  {addressInfo.delivery_instructions && (
                    <p className="text-sm mt-2 text-foreground">
                      <span className="font-medium">
                        Instrucciones:
                      </span>{" "}
                      {addressInfo.delivery_instructions}
                    </p>
                  )}
                </div>

                <Separator className="my-2" />

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Teléfono: {order.customer_phone}
                  </p>

                  <p>
                    Email: {order.customer_email}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* MÉTODO DE PAGO */}
            <Card className="shadow-sm gap-1">
              <CardHeader className="pb-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Método de pago
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-6 rounded flex items-center justify-center flex-shrink-0 bg-blue-600">
                    <span className="text-white text-xs font-bold">
                      TB
                    </span>
                  </div>

                  <div>
                    <div className="font-medium text-sm">
                      Transbank Webpay
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {order.payment_status === "paid"
                        ? "Pago verificado y confirmado"
                        : order.payment_status === "pending"
                        ? "Pago pendiente"
                        : order.payment_status === "failed"
                        ? "Pago fallido"
                        : "Estado del pago"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* BOTONES */}
            <div className="space-y-2">
              {order.status === "delivered" && (
                <Link href="/">
                  <Button className="w-full">
                    Comprar de nuevo
                  </Button>
                </Link>
              )}

              <Button
                variant="outline"
                className="w-full"
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
                    Reenviar email de confirmación
                  </>
                )}
              </Button>

              {tieneBoleta && (
                <>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={verBoleta}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver boleta
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={descargarBoleta}
                    disabled={descargandoPDF}
                  >
                    {descargandoPDF ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}

                    Descargar boleta
                  </Button>
                </>
              )}

              <Link href="/orders">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Ver todos mis pedidos
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}