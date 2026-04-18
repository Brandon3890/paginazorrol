"use client"

import { useEffect, useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Package, Truck, CheckCircle, Clock, X, Loader2, Sparkles } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

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

export default function OrdersPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    fetchOrders()
  }, [isAuthenticated, authLoading, router])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('📦 Fetching orders from MySQL for user')
      const response = await fetch('/api/orders')
      
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
    }
  }

  // Función para construir URLs completas de imágenes
  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "/placeholder.svg"
    
    // Si ya es una URL completa, usarla tal cual
    if (imagePath.startsWith('http')) {
      return imagePath
    }
    
    // Si es una ruta relativa que empieza con /uploads/, construir la URL completa
    if (imagePath.startsWith('/uploads/')) {
      return `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${imagePath}`
    }
    
    // Si es una ruta relativa sin /uploads/, agregar /uploads/
    if (imagePath.startsWith('/')) {
      return `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}${imagePath}`
    }
    
    // Para cualquier otro caso, usar placeholder
    return "/placeholder.svg"
  }

  if (authLoading) {
    return (
      <motion.div 
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <motion.p 
            className="text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Verificando autenticación...
          </motion.p>
        </div>
      </motion.div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (loading) {
    return (
      <motion.div 
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <motion.p 
            className="text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Cargando pedidos...
          </motion.p>
        </div>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div 
        className="container mx-auto px-4 py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6"
          >
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-600 mb-6">{error}</p>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button onClick={fetchOrders}>
              Reintentar
            </Button>
          </motion.div>
        </div>
      </motion.div>
    )
  }

  const sortedOrders = orders.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <motion.div 
      className="container mx-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-4xl mx-auto">
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Volver a la tienda
          </Link>
        </motion.div>

        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold flex items-center gap-2">
            Mis Pedidos
            <Sparkles className="w-6 h-6 text-orange-500" />
          </h1>
          <p className="text-muted-foreground">Revisa el estado de tus pedidos y el historial de compras</p>
        </motion.div>

        {sortedOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="text-center py-12">
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                </motion.div>
                <h3 className="text-lg font-semibold mb-2">No tienes pedidos aún</h3>
                <p className="text-muted-foreground mb-6">Cuando realices tu primera compra, aparecerá aquí</p>
                <Link href="/">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button>Explorar Productos</Button>
                  </motion.div>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div 
            className="space-y-6"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.15 }
              }
            }}
            initial="hidden"
            animate="visible"
          >
            {sortedOrders.map((order) => {
              const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
              const StatusIcon = statusInfo.icon

              return (
                <motion.div
                  key={order.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { 
                      opacity: 1, 
                      y: 0,
                      transition: { type: "spring", stiffness: 100 }
                    }
                  }}
                  whileHover={{ scale: 1.01, y: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Card className="overflow-hidden">
                    <motion.div 
                      className={`h-1 bg-gradient-to-r ${
                        order.status === 'delivered' ? 'from-green-500 to-green-400' :
                        order.status === 'cancelled' ? 'from-red-500 to-red-400' :
                        order.status === 'shipped' ? 'from-purple-500 to-purple-400' :
                        order.status === 'processing' ? 'from-blue-500 to-blue-400' :
                        'from-yellow-500 to-yellow-400'
                      }`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.6 }}
                    />

                    <CardHeader>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <CardTitle className="text-lg">Pedido #{order.order_number}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Realizado el{" "}
                            {new Date(order.created_at).toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </motion.div>
                        <motion.div 
                          className="flex flex-col items-end gap-2"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            <Badge className={`${statusInfo.color} border`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </motion.div>
                          <Badge variant="outline" className="text-xs">
                            {order.payment_status === 'paid' ? 'Pagado' : 
                             order.payment_status === 'pending' ? 'Pago pendiente' :
                             order.payment_status === 'failed' ? 'Pago fallido' : 
                             order.payment_status}
                          </Badge>
                        </motion.div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Order Items */}
                      <motion.div 
                        className="space-y-3"
                        variants={{
                          hidden: { opacity: 0 },
                          visible: {
                            opacity: 1,
                            transition: { staggerChildren: 0.1 }
                          }
                        }}
                        initial="hidden"
                        animate="visible"
                      >
                        {order.items && order.items.length > 0 ? (
                          order.items.map((item, index) => (
                            <motion.div
                              key={item.id}
                              variants={{
                                hidden: { opacity: 0, x: -10 },
                                visible: { opacity: 1, x: 0 }
                              }}
                              className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <motion.div 
                                className="relative w-12 h-12 flex-shrink-0"
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                transition={{ type: "spring", stiffness: 300 }}
                              >
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
                              </motion.div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm line-clamp-2">{item.product_name}</h4>
                                <div className="flex items-center gap-2 mt-1">
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
                            </motion.div>
                          ))
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-muted-foreground">No hay productos en esta orden</p>
                          </div>
                        )}
                      </motion.div>

                      <Separator />

                      {/* Order Summary */}
                      <motion.div 
                        className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <div>
                          <h4 className="font-medium mb-2">Información de Envío</h4>
                          <motion.div 
                            className="text-sm text-muted-foreground space-y-1"
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: { opacity: 0 },
                              visible: {
                                opacity: 1,
                                transition: { staggerChildren: 0.05 }
                              }
                            }}
                          >
                            <motion.p variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}>
                              {order.customer_first_name} {order.customer_last_name}
                            </motion.p>
                            {order.shipping_address ? (
                              <>
                                <motion.p variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}>
                                  {order.shipping_address.street}
                                </motion.p>
                                <motion.p variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}>
                                  {order.shipping_address.commune_name}, {order.shipping_address.region_name}
                                </motion.p>
                                <motion.p variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}>
                                  Código Postal: {order.shipping_address.postal_code}
                                </motion.p>
                              </>
                            ) : (
                              <p className="text-yellow-600">Dirección no especificada</p>
                            )}
                            <motion.p variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}>
                              {order.customer_phone}
                            </motion.p>
                          </motion.div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium mb-2">Resumen del Pedido</h4>
                          <motion.div 
                            className="text-sm space-y-1"
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: { opacity: 0 },
                              visible: {
                                opacity: 1,
                                transition: { staggerChildren: 0.05 }
                              }
                            }}
                          >
                            <motion.div 
                              className="flex justify-between"
                              variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}
                            >
                              <span className="text-muted-foreground">Subtotal:</span>
                              <span>${order.subtotal.toLocaleString('es-CL')}</span>
                            </motion.div>
                            {order.discount > 0 && (
                              <motion.div 
                                className="flex justify-between text-green-600"
                                variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}
                              >
                                <span className="text-muted-foreground">Descuento:</span>
                                <span>-${order.discount.toLocaleString('es-CL')}</span>
                              </motion.div>
                            )}
                            <motion.div 
                              className="flex justify-between"
                              variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}
                            >
                              <span className="text-muted-foreground">Envío:</span>
                              <span>
                                {order.shipping === 0 ? "Gratis" : `$${order.shipping.toLocaleString('es-CL')}`}
                              </span>
                            </motion.div>
                            <motion.div 
                              className="flex justify-between"
                              variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}
                            >
                              <span className="text-muted-foreground">IVA (19%):</span>
                              <span>${order.tax.toLocaleString('es-CL')}</span>
                            </motion.div>
                            <Separator />
                            <motion.div 
                              className="flex justify-between font-medium"
                              variants={{ hidden: { opacity: 0, x: -5 }, visible: { opacity: 1, x: 0 } }}
                            >
                              <span>Total:</span>
                              <motion.span
                                key={order.total}
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 0.3 }}
                              >
                                ${order.total.toLocaleString('es-CL')}
                              </motion.span>
                            </motion.div>
                          </motion.div>
                        </div>
                      </motion.div>

                      {order.notes && (
                        <>
                          <Separator />
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                          >
                            <h4 className="font-medium mb-2">Notas del Pedido</h4>
                            <p className="text-sm text-muted-foreground">{order.notes}</p>
                          </motion.div>
                        </>
                      )}

                      {order.coupon_code && (
                        <>
                          <Separator />
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                          >
                            <h4 className="font-medium mb-2">Cupón Aplicado</h4>
                            <motion.p 
                              className="text-sm text-green-600"
                              whileHover={{ scale: 1.05 }}
                            >
                              {order.coupon_code}
                            </motion.p>
                          </motion.div>
                        </>
                      )}

                      <Separator />

                      <motion.div 
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        <div className="text-xs text-muted-foreground">
                          Última actualización: {new Date(order.updated_at).toLocaleDateString("es-ES")}
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Link href={`/orders/${order.id}`} className="flex-1 sm:flex-initial">
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                Ver Detalles
                              </Button>
                            </motion.div>
                          </Link>
                          {order.status === "delivered" && (
                            <Link href="/" className="flex-1 sm:flex-initial">
                              
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}