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
  Filter,
  Users,
  Search,
  Download,
  RefreshCw
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
  created_at: string
  updated_at: string
  items: OrderItem[]
  customer_email: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  shipping_address?: {
    street: string
    commune_name: string
    region_name: string
    postal_code: string
    department?: string
  }
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800 border-blue-200" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800 border-purple-200" },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800 border-red-200" },
}

const statusOptions = [
  { value: "all", label: "Todos los estados" },
  { value: "pending", label: "Pendiente" },
  { value: "processing", label: "Procesando" },
  { value: "shipped", label: "Enviado" },
  { value: "delivered", label: "Entregado" },
  { value: "cancelled", label: "Cancelado" },
]

const paymentStatusOptions = [
  { value: "all", label: "Todos los pagos" },
  { value: "pending", label: "Pago pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "failed", label: "Pago fallido" },
  { value: "refunded", label: "Reembolsado" },
]

export default function AdminOrdersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [refreshing, setRefreshing] = useState(false)

  const isAdmin = user?.role === "admin"

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
      
      console.log('📦 Fetching all orders for admin')
      const response = await fetch('/api/admin/orders/all')
      
      if (response.ok) {
        const ordersData = await response.json()
        console.log('✅ Orders data received:', ordersData.length, 'orders')
        setOrders(ordersData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar las órdenes')
      }
    } catch (error) {
      console.error('❌ Error fetching orders:', error)
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
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (response.ok) {
        // Actualizar el estado local
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        )
        setEditingOrderId(null)
        setSelectedStatus("")
      } else {
        throw new Error('Error al actualizar el estado')
      }
    } catch (error) {
      console.error('Error updating order status:', error)
      setError('Error al actualizar el estado del pedido')
    }
  }

  // Función para construir URLs completas de imágenes
  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "/placeholder.svg"
    
    if (imagePath.startsWith('http')) {
      return imagePath
    }
    
    if (imagePath.startsWith('/uploads/')) {
      return `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${imagePath}`
    }
    
    if (imagePath.startsWith('/')) {
      return `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${imagePath}`
    }
    
    return "/placeholder.svg"
  }

  // Filtrar y buscar órdenes
  const filteredOrders = orders.filter(order => {
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesPaymentStatus = paymentStatusFilter === "all" || order.payment_status === paymentStatusFilter
    const matchesSearch = searchTerm === "" || 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${order.customer_first_name} ${order.customer_last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer_phone?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesStatus && matchesPaymentStatus && matchesSearch
  })

  const sortedOrders = filteredOrders.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // Estadísticas
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
  const pendingOrders = orders.filter(order => order.status === 'pending').length
  const paidOrders = orders.filter(order => order.payment_status === 'paid').length

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
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
            <p className="text-red-600 mb-6">No tienes permisos para acceder a esta página.</p>
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
        <div className="max-w-7xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-600 mb-6">{error}</p>
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
        {/* Header */}
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
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Pedidos</p>
                  <p className="text-2xl font-bold">{totalOrders}</p>
                </div>
                <Package className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ingresos Totales</p>
                  <p className="text-2xl font-bold">${totalRevenue.toLocaleString('es-CL')}</p>
                </div>
                <Users className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendientes</p>
                  <p className="text-2xl font-bold">{pendingOrders}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pagados</p>
                  <p className="text-2xl font-bold">{paidOrders}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros y Búsqueda */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Búsqueda */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por número de pedido, cliente, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>

            {/* Filtros */}
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

        {/* Orders List */}
        {sortedOrders.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No hay pedidos
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || statusFilter !== "all" || paymentStatusFilter !== "all" 
                  ? "No se encontraron pedidos que coincidan con los filtros aplicados." 
                  : "Cuando los usuarios realicen compras, aparecerán aquí"}
              </p>
              {(searchTerm || statusFilter !== "all" || paymentStatusFilter !== "all") && (
                <Button 
                  onClick={() => {
                    setSearchTerm("")
                    setStatusFilter("all")
                    setPaymentStatusFilter("all")
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

              return (
                <Card key={order.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg lg:text-xl truncate">
                          Pedido #{order.order_number}
                        </CardTitle>
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
                            Cliente: {order.customer_first_name} {order.customer_last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Email: {order.customer_email}
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
                           order.payment_status === 'pending' ? 'Pago pendiente' :
                           order.payment_status === 'failed' ? 'Pago fallido' : 
                           order.payment_status === 'refunded' ? 'Reembolsado' :
                           order.payment_status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0 space-y-4 lg:space-y-6">
                    {/* Order Items */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">Productos</h4>
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item) => (
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
                              <div className="font-medium">${(item.product_price * item.quantity).toLocaleString('es-CL')}</div>
                              <div className="text-xs text-muted-foreground">${item.product_price.toLocaleString('es-CL')} c/u</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-muted-foreground">No hay productos en esta orden</p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Order Summary and Actions */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                      {/* Customer and Shipping Info */}
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">Información de Envío</h4>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p className="font-medium text-foreground">
                              {order.customer_first_name} {order.customer_last_name}
                            </p>
                            <p>{order.customer_email}</p>
                            <p>{order.customer_phone}</p>
                            {order.shipping_address ? (
                              <>
                                <p>{order.shipping_address.street}</p>
                                <p>
                                  {order.shipping_address.commune_name}, {order.shipping_address.region_name}
                                </p>
                                <p>Código Postal: {order.shipping_address.postal_code}</p>
                              </>
                            ) : (
                              <p className="text-yellow-600">Dirección no especificada</p>
                            )}
                          </div>
                        </div>

                        {/* Status Editor */}
                        <div>
                          <h4 className="font-medium mb-2">Cambiar Estado</h4>
                          {editingOrderId === order.id ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="border rounded-lg px-3 py-2 text-sm flex-1"
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
                                  disabled={!selectedStatus}
                                >
                                  Guardar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingOrderId(null)
                                    setSelectedStatus("")
                                  }}
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
                            >
                              <Edit className="w-4 h-4" />
                              Editar Estado
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Order Summary */}
                      <div>
                        <h4 className="font-medium mb-2">Resumen del Pedido</h4>
                        <div className="text-sm space-y-2 bg-muted/30 rounded-lg p-4">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>${order.subtotal.toLocaleString('es-CL')}</span>
                          </div>
                          {order.discount > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span className="text-muted-foreground">Descuento:</span>
                              <span>-${order.discount.toLocaleString('es-CL')}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Envío:</span>
                            <span>
                              {order.shipping === 0 ? "Gratis" : `$${order.shipping.toLocaleString('es-CL')}`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">IVA (19%):</span>
                            <span>${order.tax.toLocaleString('es-CL')}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-medium text-base">
                            <span>Total:</span>
                            <span>${order.total.toLocaleString('es-CL')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Information */}
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

                    {/* Footer Actions */}
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