"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, Ticket, ShoppingCart, Tags, Loader2 } from "lucide-react"
import Link from "next/link"

interface DashboardStats {
  products: {
    total: number
    active: number
    inactive: number
  }
  categories: {
    total: number
    active: number
    totalSubcategories: number
    activeSubcategories: number
  }
  coupons: {
    total: number
    active: number
    expired: number
  }
  orders: {
    total: number
    pending: number
    processing: number
    shipped: number
    delivered: number
    cancelled: number
  }
}

export default function AdminPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push("/")
      return
    }

    fetchDashboardStats()
  }, [isAuthenticated, user, router])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/admin/dashboard-stats')
      
      if (!response.ok) {
        throw new Error('Error al cargar las estadísticas')
      }
      
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      setError('No se pudieron cargar las estadísticas')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Cargando estadísticas...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <h1 className="text-xl font-bold text-red-800 mb-2">Error</h1>
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={fetchDashboardStats}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Reintentar
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Panel de Administración</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gestiona tu tienda desde un solo lugar</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Productos Card */}
          <Link href="/admin/products">
            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Package className="w-8 h-8 text-[#C2410C]" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Productos</CardTitle>
                    <CardDescription className="text-sm">Gestión del catálogo</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Productos activos</span>
                  <Badge variant="secondary" className="text-base">
                    {stats?.products.active || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Productos inactivos</span>
                  <Badge variant="outline" className="text-base">
                    {stats?.products.inactive || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total productos</span>
                  <Badge variant="outline" className="text-base">
                    {stats?.products.total || 0}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-2">Crea, edita y elimina productos de tu catálogo</p>
              </CardContent>
            </Card>
          </Link>

          {/* Categorías Card */}
          <Link href="/admin/categories">
            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Tags className="w-8 h-8 text-[#C2410C]" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Categorías</CardTitle>
                    <CardDescription className="text-sm">Organización del catálogo</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total categorías</span>
                  <Badge variant="secondary" className="text-base">
                    {stats?.categories.total || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total subcategorías</span>
                  <Badge variant="outline" className="text-base">
                    {stats?.categories.totalSubcategories || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Categorías activas</span>
                  <Badge variant="outline" className="text-base bg-green-100 text-green-800">
                    {stats?.categories.active || 0}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-2">Gestiona la organización de tus productos</p>
              </CardContent>
            </Card>
          </Link>

          {/* Cupones Card */}
          <Link href="/admin/coupons">
            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Ticket className="w-8 h-8 text-[#C2410C]" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Cupones</CardTitle>
                    <CardDescription className="text-sm">Descuentos y promociones</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cupones activos</span>
                  <Badge variant="secondary" className="text-base">
                    {stats?.coupons.active || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total cupones</span>
                  <Badge variant="outline" className="text-base">
                    {stats?.coupons.total || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cupones expirados</span>
                  <Badge variant="outline" className="text-base">
                    {stats?.coupons.expired || 0}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-2">Crea cupones para productos, categorías o globales</p>
              </CardContent>
            </Card>
          </Link>

          {/* Pedidos Card */}
          <Link href="/admin/orders">
            <Card className="hover:shadow-lg transition-all hover:scale-105 cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <ShoppingCart className="w-8 h-8 text-[#C2410C]" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Pedidos</CardTitle>
                    <CardDescription className="text-sm">Gestión de órdenes</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pedidos pendientes</span>
                  <Badge variant="secondary" className="text-base">
                    {stats?.orders.pending || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total pedidos</span>
                  <Badge variant="outline" className="text-base">
                    {stats?.orders.total || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pedidos completados</span>
                  <Badge variant="outline" className="text-base bg-green-100 text-green-800">
                    {stats?.orders.delivered || 0}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground pt-2">Administra y actualiza el estado de los pedidos</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Resumen General */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Resumen General</CardTitle>
              <CardDescription>
                Vista general del estado de tu tienda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{stats?.products.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Productos</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{stats?.categories.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Categorías</p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{stats?.orders.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Pedidos Totales</p>
                </div>
                <div className="text-center p-4 border rounded-lg"> 
                  <p className="text-2xl font-bold text-purple-600">{stats?.coupons.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Cupones totales</p>
                </div>
              </div>
              
              {/* Detalles de Pedidos */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-4">Distribución de Pedidos</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 border rounded-lg bg-yellow-50">
                    <p className="text-lg font-bold text-yellow-700">{stats?.orders.pending || 0}</p>
                    <p className="text-xs text-yellow-600">Pendientes</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg bg-blue-50">
                    <p className="text-lg font-bold text-blue-700">{stats?.orders.processing || 0}</p>
                    <p className="text-xs text-blue-600">Procesando</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg bg-purple-50">
                    <p className="text-lg font-bold text-purple-700">{stats?.orders.shipped || 0}</p>
                    <p className="text-xs text-purple-600">Enviados</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg bg-green-50">
                    <p className="text-lg font-bold text-green-700">{stats?.orders.delivered || 0}</p>
                    <p className="text-xs text-green-600">Entregados</p>
                  </div>
                  <div className="text-center p-3 border rounded-lg bg-red-50">
                    <p className="text-lg font-bold text-red-700">{stats?.orders.cancelled || 0}</p>
                    <p className="text-xs text-red-600">Cancelados</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}