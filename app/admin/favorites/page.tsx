"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  Heart, 
  Loader2, 
  User, 
  Mail, 
  Package,
  Users,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface FavoriteWithUser {
  id: number
  user_id: number
  product_id: number
  created_at: string
  user: {
    id: number
    email: string
    first_name: string
    last_name: string
    phone: string
  }
  product: {
    id: number
    name: string
    price: number
    image: string
    stock: number
    in_stock: boolean
    is_active: boolean
    category: string
  }
}

interface GroupedProduct {
  productId: number
  productName: string
  productPrice: number
  productImage: string
  productStock: number
  productInStock: boolean
  productCategory: string
  totalFavorites: number
  users: {
    id: number
    email: string
    first_name: string
    last_name: string
    phone: string
    favoriteId: number
    createdAt: string
  }[]
}

export default function AdminFavoritesPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [favorites, setFavorites] = useState<FavoriteWithUser[]>([])
  const [groupedFavorites, setGroupedFavorites] = useState<GroupedProduct[]>([])
  const [totalFavorites, setTotalFavorites] = useState(0)
  const [totalProducts, setTotalProducts] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push("/")
      return
    }
    fetchFavorites()
  }, [isAuthenticated, user, router])

  const fetchFavorites = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/favorites')
      if (!response.ok) throw new Error('Error al cargar favoritos')
      const data = await response.json()
      setFavorites(data.favorites || [])
      setTotalFavorites(data.totalFavorites || 0)
      groupFavorites(data.favorites || [])
    } catch (error) {
      console.error('Error:', error)
      setError('No se pudieron cargar los favoritos')
    } finally {
      setLoading(false)
    }
  }

  const groupFavorites = (favoritesData: FavoriteWithUser[]) => {
    const grouped = new Map<number, GroupedProduct>()

    favoritesData.forEach(fav => {
      const productId = fav.product_id
      if (!grouped.has(productId)) {
        grouped.set(productId, {
          productId: fav.product.id,
          productName: fav.product.name,
          productPrice: fav.product.price,
          productImage: fav.product.image,
          productStock: fav.product.stock,
          productInStock: fav.product.in_stock,
          productCategory: fav.product.category || 'Sin categoría',
          totalFavorites: 0,
          users: []
        })
      }

      const group = grouped.get(productId)!
      group.totalFavorites += 1
      group.users.push({
        id: fav.user.id,
        email: fav.user.email,
        first_name: fav.user.first_name,
        last_name: fav.user.last_name,
        phone: fav.user.phone,
        favoriteId: fav.id,
        createdAt: fav.created_at
      })
    })

    // Ordenar por cantidad de favoritos (descendente)
    const sortedGroups = Array.from(grouped.values())
      .sort((a, b) => b.totalFavorites - a.totalFavorites)

    setGroupedFavorites(sortedGroups)
    setTotalProducts(sortedGroups.length)
  }

  const formatPrice = (price: number) => {
    return '$' + price.toLocaleString('es-CL')
  }

  const getImageUrl = (url?: string) => {
    if (!url) return "/placeholder.svg"
    if (url.startsWith("http")) return url
    if (url.startsWith("/")) return url
    if (url.startsWith("uploads/")) return `/${url}`
    return `/uploads/products/${url}`
  }

  const toggleExpand = (productId: number) => {
    setExpandedProduct(expandedProduct === productId ? null : productId)
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Cargando favoritos...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Heart className="w-8 h-8 text-red-500 fill-red-500" />
        <h1 className="text-2xl md:text-3xl font-bold">Productos Favoritos</h1>
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary">
            {totalProducts} productos
          </Badge>
          <Badge variant="secondary">
            {totalFavorites} favoritos totales
          </Badge>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchFavorites} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {groupedFavorites.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay favoritos aún</h3>
            <p className="text-muted-foreground">Cuando los usuarios agreguen productos a favoritos, aparecerán aquí</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {groupedFavorites.map((group) => (
            <Card key={group.productId} className="overflow-hidden hover:shadow-lg transition-shadow">
              <Collapsible
                open={expandedProduct === group.productId}
                onOpenChange={() => toggleExpand(group.productId)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    {/* Producto */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={getImageUrl(group.productImage)}
                          alt={group.productName}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link href={`/products/${group.productId}`} className="font-semibold hover:text-orange-600 truncate block">
                          {group.productName}
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Badge variant="outline" className="text-xs">{group.productCategory}</Badge>
                          <span>{formatPrice(group.productPrice)}</span>
                          <span>•</span>
                          <span className={group.productInStock ? 'text-green-600' : 'text-red-600'}>
                            {group.productInStock ? `Stock: ${group.productStock}` : 'Agotado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Estadísticas */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm w-full md:w-auto">
                      <div className="flex items-center gap-2 bg-orange-50 px-3 py-1 rounded-full">
                        <Users className="w-4 h-4 text-orange-600" />
                        <span className="font-semibold text-orange-600">
                          {group.totalFavorites} {group.totalFavorites === 1 ? 'usuario' : 'usuarios'}
                        </span>
                      </div>
                    </div>

                    {/* Botón expandir */}
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="ml-auto">
                        {expandedProduct === group.productId ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        <span className="ml-2 text-xs">
                          {expandedProduct === group.productId ? 'Ocultar' : 'Ver usuarios'}
                        </span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  {/* Contenido expandido: Lista de usuarios */}
                  <CollapsibleContent>
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Usuarios que marcaron este producto como favorito
                      </h4>
                      <div className="grid gap-2">
                        {group.users.map((user) => (
                          <div
                            key={user.favoriteId}
                            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {user.first_name} {user.last_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="w-4 h-4" />
                                <span>{user.email}</span>
                              </div>
                              {user.phone && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>📱</span>
                                  <span>{user.phone}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2 sm:mt-0">
                              Favorito desde: {format(new Date(user.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}