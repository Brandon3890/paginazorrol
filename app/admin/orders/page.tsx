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
  Edit,
  Users,
  Search,
  RefreshCw,
  User,
  Circle,
  Store,
  CreditCard,
  AlertCircle
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  notes?: string
  coupon_code?: string
  shipping_method?: string
  shipping_type?: 'home_delivery' | 'branch_pickup' | 'cash_on_delivery' | 'standard' | 'bodega_pickup'
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
  items: OrderItem[]
  customer_email: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  is_guest?: boolean
  shipping_address?: {
    street: string
    commune_name: string
    region_name: string
    postal_code: string
    department?: string
  }
}

//  NUEVOS ESTADOS - Coinciden con el flujo de seguimiento
const statusConfig = {
  pending: { label: "Pago Recibido", icon: CheckCircle, color: "bg-green-100 text-green-800 border-green-200", step: 0 },
  processing: { label: "Validando Compra", icon: Clock, color: "bg-yellow-100 text-yellow-800 border-yellow-200", step: 1 },
  confirmed: { label: "Compra Confirmada", icon: Package, color: "bg-blue-100 text-blue-800 border-blue-200", step: 2 },
  shipped: { label: "En Camino", icon: Truck, color: "bg-purple-100 text-purple-800 border-purple-200", step: 3 },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800 border-green-200", step: 4 },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800 border-red-200", step: -1 },
}

//  NUEVO FLUJO DE ESTADOS - Coincide con el orden de seguimiento
const orderSteps = [
  { key: "pending", label: "Pago Recibido", description: "Pago confirmado correctamente." },
  { key: "processing", label: "Validando Compra", description: "Revisando detalles del pedido." },
  { key: "confirmed", label: "Compra Confirmada", description: "Emisión de boleta y preparación." },
  { key: "shipped", label: "En Camino", description: "Pedido en ruta hacia el destino." },
  { key: "delivered", label: "Entregado", description: "Pedido recibido por el cliente." },
]

//  OPCIONES DE ESTADOS PARA EL ADMIN
const statusOptions = [
  { value: "all", label: "Todos los estados" },
  { value: "pending", label: "Pago Recibido" },
  { value: "processing", label: "Validando Compra" },
  { value: "confirmed", label: "Compra Confirmada" },
  { value: "shipped", label: "En Camino" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
]

//  MAPEO DE PASOS PARA EL TIMELINE
const statusToStepMap: Record<string, number> = {
  'pending': 0,
  'processing': 1,
  'confirmed': 2,
  'shipped': 3,
  'delivered': 4,
  'cancelled': -1,
}

// Función para calcular Neto e IVA desde un monto que ya incluye IVA
const calculateTaxBreakdown = (amountWithIVA: number) => {
  const neto = Math.round(amountWithIVA / 1.19)
  const iva = amountWithIVA - neto
  return { neto, iva }
}

//  FUNCIÓN MEJORADA PARA OBTENER EL MÉTODO DE ENVÍO MOSTRADO
const getShippingMethodDisplay = (order: Order | null) => {
  if (!order) return 'Método no especificado'
  
  const shippingDetails = order.shipping_details
  const shippingType = order.shipping_type || ''
  
  // 1. Si tiene sucursal seleccionada en detalles (NO bodega)
  if (shippingDetails?.selectedBranch && shippingType !== 'bodega_pickup') {
    return `Retiro en Sucursal - ${shippingDetails.selectedBranch.name}`
  }
  
  // 2. Si es envío por pagar
  if (shippingDetails?.isCashOnDelivery) {
    return 'Envío por Pagar'
  }
  
  // 3. Si tiene nombre del servicio
  if (shippingDetails?.serviceName) {
    return shippingDetails.serviceName
  }
  
  // 4. Determinar por shipping_type
  if (shippingType) {
    switch (shippingType) {
      case 'branch_pickup':
        return 'Retiro en Sucursal'
      case 'cash_on_delivery':
        return 'Envío por Pagar'
      case 'home_delivery':
        return 'Envío a Domicilio'
      case 'standard':
        return 'Envío Estándar'
      case 'bodega_pickup':
        return 'Retiro en Bodega'
      default:
        break
    }
  }
  
  // 5. Si tiene shipping_method y no es "transbank"
  if (order.shipping_method && order.shipping_method.toLowerCase() !== 'transbank') {
    return order.shipping_method
  }
  
  // 6. Si tiene costo de envío, asumimos que es a domicilio (fallback)
  if (order.shipping > 0) {
    return 'Envío a Domicilio'
  }
  
  return 'Método no especificado'
}

//  FUNCIÓN PARA DETERMINAR SI ES RETIRO EN BODEGA
const isBodegaPickup = (order: Order | null) => {
  if (!order) return false
  return order.shipping_type === 'bodega_pickup'
}

//  FUNCIÓN PARA DETERMINAR SI ES RETIRO EN SUCURSAL
const isBranchPickup = (order: Order | null) => {
  if (!order) return false
  return order.shipping_type === 'branch_pickup' || 
         order.shipping_details?.selectedBranch !== undefined
}

//  FUNCIÓN PARA DETERMINAR SI ES ENVÍO A DOMICILIO
const isHomeDelivery = (order: Order | null) => {
  if (!order) return false
  return order.shipping_type === 'home_delivery'
}

//  FUNCIÓN PARA DETERMINAR SI ES ENVÍO POR PAGAR
const isCashOnDelivery = (order: Order | null) => {
  if (!order) return false
  return order.shipping_type === 'cash_on_delivery' || 
         order.shipping_details?.isCashOnDelivery === true
}

//  FUNCIÓN PARA OBTENER LA SUCURSAL SELECCIONADA
const getSelectedBranch = (order: Order | null) => {
  if (!order) return null
  return order.shipping_details?.selectedBranch || null
}

export default function AdminOrdersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  const { toast } = useToast()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [refreshing, setRefreshing] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)

  const isAdmin = user?.role === "admin"

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

    if (!isAdmin) {
      router.push("/orders")
      return
    }

    fetchOrders()
  }, [isAuthenticated, authLoading, router, isAdmin])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/orders/all')
      
      if (response.ok) {
        const ordersData = await response.json()
        setOrders(ordersData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar las ordenes')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      setError('No se pudieron cargar los pedidos. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refreshOrders = () => {
    setRefreshing(true)
    fetchOrders()
  }

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    const validStatuses = ['pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled']
    if (!validStatuses.includes(newStatus)) {
      toast({
        title: "Error",
        description: "Estado no válido",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    setUpdatingStatus(orderId)
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        )
        setEditingOrderId(null)
        setSelectedStatus("")
        setError(null)
        
        const statusLabel = statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus
        toast({
          title: " Estado actualizado",
          description: `Pedido #${orderId} actualizado a: ${statusLabel}`,
          duration: 3000,
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al actualizar el estado')
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Error al actualizar el estado del pedido',
        variant: "destructive",
        duration: 5000,
      })
      setEditingOrderId(null)
      setSelectedStatus("")
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getImageUrl = (url?: string) => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith("http")) return url
    if (url.startsWith("/")) return url
    if (url.startsWith("uploads/")) return `/${url}`
    return `/uploads/products/${url}`
  }

  const getCurrentStep = (order: Order) => {
    if (order.status === 'cancelled') return -1
    return statusToStepMap[order.status] ?? 0
  }

  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesSearch = searchTerm === "" || 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${order.customer_first_name} ${order.customer_last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesSearch
  })

  const sortedOrders = filteredOrders.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0)
  const pendingOrders = orders.filter(order => order.status === 'pending').length
  const processingOrders = orders.filter(order => order.status === 'processing').length
  const confirmedOrders = orders.filter(order => order.status === 'confirmed').length
  const shippedOrders = orders.filter(order => order.status === 'shipped').length
  const deliveredOrders = orders.filter(order => order.status === 'delivered').length
  const paidOrders = orders.filter(order => order.payment_status === 'paid').length

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando autenticacion...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-800 mb-2">Acceso Denegado</h1>
            <p className="text-red-600 mb-6">No tienes permisos para acceder a esta pagina.</p>
            <Link href="/orders">
              <Button>
                Volver a Mis Pedidos
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando pedidos...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-3">
              <X className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-600 mt-1">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => setError(null)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
          <Button onClick={fetchOrders}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin">
              <Button variant="ghost" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Dashboard
              </Button>
            </Link>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">Gestión de Pedidos</h1>
              <p className="text-muted-foreground">Administra y revisa todos los pedidos del sistema</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                onClick={refreshOrders} 
                disabled={refreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </div>
        </div>

        {/* ESTADÍSTICAS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pagos Recibidos</p>
                  <p className="text-xl font-bold text-green-600">{pendingOrders}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Validando</p>
                  <p className="text-xl font-bold text-yellow-600">{processingOrders}</p>
                </div>
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Confirmados</p>
                  <p className="text-xl font-bold text-blue-600">{confirmedOrders}</p>
                </div>
                <Package className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">En Camino</p>
                  <p className="text-xl font-bold text-purple-600">{shippedOrders}</p>
                </div>
                <Truck className="w-5 h-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Entregados</p>
                  <p className="text-xl font-bold text-green-600">{deliveredOrders}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Ingresos</p>
                  <p className="text-xl font-bold">{formatPrice(totalRevenue)}</p>
                </div>
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por numero de pedido, cliente, email o telefono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Mostrando {sortedOrders.length} de {orders.length} pedidos
          </div>
        </div>

        {sortedOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No hay pedidos
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || statusFilter !== "all" 
                  ? "No se encontraron pedidos que coincidan con los filtros aplicados." 
                  : "Cuando los usuarios realicen compras, apareceran aqui"}
              </p>
              {(searchTerm || statusFilter !== "all") && (
                <Button 
                  onClick={() => {
                    setSearchTerm("")
                    setStatusFilter("all")
                  }}
                >
                  Limpiar Filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 lg:space-y-6">
            {sortedOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
              const StatusIcon = statusInfo.icon
              const { neto: subtotalNeto, iva: subtotalIVA } = calculateTaxBreakdown(order.subtotal)
              const currentStep = getCurrentStep(order)
              const isCancelled = order.status === 'cancelled'

              //  USAR LAS NUEVAS FUNCIONES PARA OBTENER LA INFORMACIÓN DE ENVÍO
              const shippingMethodDisplay = getShippingMethodDisplay(order)
              const bodegaPickup = isBodegaPickup(order)
              const branchPickup = isBranchPickup(order)
              const homeDelivery = isHomeDelivery(order)
              const cashOnDelivery = isCashOnDelivery(order)
              const selectedBranch = getSelectedBranch(order)

              return (
                <Card key={order.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-lg lg:text-xl truncate">
                            Pedido #{order.order_number}
                          </CardTitle>
                          {order.is_guest ? (
                            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                              <User className="w-3 h-3 mr-1" />
                              Invitado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs">
                              <Users className="w-3 h-3 mr-1" />
                              Cliente
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {order.customer_first_name} {order.customer_last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {order.customer_email}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <Badge className={`${statusInfo.color} border`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {order.payment_status === 'paid' ? 'Pagado' : 
                           order.payment_status === 'pending' ? 'Pago Recibido' :
                           order.payment_status === 'failed' ? 'Pago fallido' : 
                           order.payment_status === 'refunded' ? 'Reembolsado' :
                           order.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0 space-y-4 lg:space-y-6">
                    {/* TIMELINE DE ESTADOS */}
                    {!isCancelled ? (
                      <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
                        <div className="flex items-center justify-between relative min-w-[600px]">
                          {orderSteps.map((step, index) => {
                            const isCompleted = currentStep > index
                            const isActive = currentStep === index

                            let stepStatus = 'pending'
                            if (isCompleted) stepStatus = 'completed'
                            else if (isActive) stepStatus = 'active'

                            const getStepColor = () => {
                              if (stepStatus === 'completed') return 'bg-green-500 border-green-500 text-white'
                              if (stepStatus === 'active') return 'bg-blue-500 border-blue-500 text-white ring-2 ring-blue-200'
                              return 'bg-gray-300 border-gray-300 text-gray-400'
                            }

                            const getLineColor = () => {
                              if (stepStatus === 'completed' || stepStatus === 'active') return 'bg-green-400'
                              return 'bg-gray-300'
                            }

                            let stepDescription = step.description
                            if (step.key === 'pending' && (isActive || isCompleted)) {
                              if (order.payment_status === 'paid') {
                                stepDescription = ' Pago aprobado'
                              } else if (order.payment_status === 'failed') {
                                stepDescription = '❌ Pago rechazado'
                              }
                            }
                            if (step.key === 'shipped' && (isActive || isCompleted)) {
                              if (bodegaPickup) {
                                stepDescription = ' Listo para retirar en bodega'
                              } else if (branchPickup) {
                                stepDescription = ' Listo para retirar'
                              } else if (homeDelivery) {
                                stepDescription = ' En ruta'
                              } else {
                                stepDescription = shippingMethodDisplay
                              }
                            }
                            if (step.key === 'delivered' && (isActive || isCompleted)) {
                              if (bodegaPickup) {
                                stepDescription = ' Retirado por cliente'
                              } else if (branchPickup) {
                                stepDescription = ' Retirado por cliente'
                              } else if (homeDelivery) {
                                stepDescription = ' Entregado en domicilio'
                              } else {
                                stepDescription = ' Entregado con éxito'
                              }
                            }

                            return (
                              <div key={step.key} className="flex-1 flex items-center">
                                <div className="flex flex-col items-center flex-1">
                                  <div className={`
                                    w-7 h-7 rounded-full flex items-center justify-center border-2
                                    ${getStepColor()}
                                    transition-all duration-300
                                    ${stepStatus === 'active' ? 'animate-pulse' : ''}
                                  `}>
                                    {stepStatus === 'completed' ? (
                                      <CheckCircle className="w-4 h-4" />
                                    ) : stepStatus === 'active' ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Circle className="w-3.5 h-3.5" />
                                    )}
                                  </div>
                                  <span className={`
                                    text-[10px] font-medium mt-1 text-center
                                    ${stepStatus === 'completed' ? 'text-green-600' :
                                      stepStatus === 'active' ? 'text-blue-600' :
                                      'text-gray-400'}
                                  `}>
                                    {step.label}
                                  </span>
                                  <span className={`
                                    text-[8px] text-center mt-0.5 max-w-[80px] leading-tight
                                    ${stepStatus === 'completed' ? 'text-green-500' :
                                      stepStatus === 'active' ? 'text-blue-500' :
                                      'text-gray-400'}
                                  `}>
                                    {stepDescription}
                                  </span>
                                </div>
                                {index < orderSteps.length - 1 && (
                                  <div className={`flex-1 h-0.5 ${getLineColor()} transition-colors duration-300`} />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                        <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                          <X className="w-3.5 h-3.5" />
                          Pedido cancelado
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Productos</h4>
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item) => {
                          const itemTotal = item.product_price * item.quantity
                          
                          return (
                            <div key={item.id} className="flex gap-3 p-2 bg-muted/50 rounded-lg">
                              <div className="relative w-12 h-12 flex-shrink-0">
                                <Image
                                  src={getImageUrl(item.image_url)}
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
                                <h4 className="font-medium text-sm line-clamp-2">{item.product_name}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {item.category || "General"}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">Cantidad: {item.quantity}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{formatPrice(itemTotal)}</div>
                                <div className="text-xs text-muted-foreground">{formatPrice(item.product_price)} c/u</div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground">No hay productos en esta orden</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Información de Envío</h4>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p className="font-medium text-foreground">
                              {order.customer_first_name} {order.customer_last_name}
                            </p>
                            <p>{order.customer_email}</p>
                            <p>{order.customer_phone}</p>
                            
                            {/*  MOSTRAR EL MÉTODO DE ENVÍO CORRECTO */}
                            <p className="text-xs font-medium text-foreground mt-2">
                              Método: {shippingMethodDisplay}
                            </p>
                            
                            {/* 🔥 DETALLE DE RETIRO EN BODEGA */}
                            {bodegaPickup && (
                              <div className="border rounded p-2 mt-2">
                                <p className="text-xs flex items-start gap-1.5">
                                  <Store className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span>
                                    <strong>Retiro en Bodega:</strong><br />
                                    Arcangel 1200, San Miguel
                                  </span>
                                </p>
                              </div>
                            )}
                            
                            {/*  DETALLE DE RETIRO EN SUCURSAL */}
                            {branchPickup && selectedBranch && !bodegaPickup && (
                              <div className="border rounded p-2 mt-2">
                                <p className="text-xs flex items-start gap-1.5">
                                  <Store className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span>
                                    <strong>Retiro en Sucursal:</strong><br />
                                    {selectedBranch.name}<br />
                                    {selectedBranch.address}
                                    {selectedBranch.telephone && (
                                      <> <br /> {selectedBranch.telephone}</>
                                    )}
                                  </span>
                                </p>
                              </div>
                            )}
                            
                            {/*  DETALLE DE ENVÍO A DOMICILIO */}
                            {homeDelivery && order.shipping_address && (
                              <div className="border rounded p-2 mt-2">
                                <p className="text-xs flex items-start gap-1.5">
                                  <Truck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span>
                                    <strong>Envío a Domicilio:</strong><br />
                                    {order.shipping_address.street}<br />
                                    {order.shipping_address.commune_name}, {order.shipping_address.region_name}
                                    {order.shipping_address.department && (
                                      <> <br />Depto: {order.shipping_address.department}</>
                                    )}
                                  </span>
                                </p>
                              </div>
                            )}
                            
                            {/*  DETALLE DE ENVÍO POR PAGAR */}
                            {cashOnDelivery && (
                              <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                                <p className="text-xs text-amber-700 flex items-start gap-1.5">
                                  <CreditCard className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                                  <span>
                                    <strong>Envío por Pagar</strong><br />
                                    El costo del envío se pagará al momento de la entrega.
                                    {order.shipping > 0 && (
                                      <> Monto: {formatPrice(order.shipping)}</>
                                    )}
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Cambiar Estado</h4>
                          {editingOrderId === order.id ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-sm flex-1"
                                disabled={updatingStatus === order.id}
                              >
                                <option value="">Seleccionar estado</option>
                                {statusOptions.filter(opt => opt.value !== 'all').map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateOrderStatus(order.id, selectedStatus)}
                                  disabled={!selectedStatus || updatingStatus === order.id}
                                >
                                  {updatingStatus === order.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Guardando...
                                    </>
                                  ) : (
                                    'Guardar'
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingOrderId(null)
                                    setSelectedStatus("")
                                  }}
                                  disabled={updatingStatus === order.id}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingOrderId(order.id)
                                setSelectedStatus(order.status)
                              }}
                              className="flex items-center gap-2"
                              disabled={updatingStatus === order.id}
                            >
                              <Edit className="w-4 h-4" />
                              Editar Estado
                            </Button>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Resumen del Pedido</h4>
                        <div className="text-sm space-y-2 bg-muted/30 rounded-lg p-4">
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
                      </div>
                    </div>

                    {(order.notes || order.coupon_code) && (
                      <>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {order.notes && (
                            <div>
                              <h4 className="font-medium mb-2">Notas del Pedido</h4>
                              <p className="text-sm text-muted-foreground">{order.notes}</p>
                            </div>
                          )}
                          {order.coupon_code && (
                            <div>
                              <h4 className="font-medium mb-2">Cupón Aplicado</h4>
                              <p className="text-sm text-green-600">{order.coupon_code}</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                      <div className="text-xs text-muted-foreground">
                        Última actualización: {new Date(order.updated_at).toLocaleDateString("es-ES", {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            Ver Detalles Completos
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}