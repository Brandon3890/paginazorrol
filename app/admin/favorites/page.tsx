"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Heart, Loader2, User, Mail, Package } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"

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

export default function AdminFavoritesPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [favorites, setFavorites] = useState<FavoriteWithUser[]>([])
  const [totalFavorites, setTotalFavorites] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    } catch (error) {
      console.error('Error:', error)
      setError('No se pudieron cargar los favoritos')
    } finally {
      setLoading(false)
    }
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

      <div className="flex items-center gap-3 mb-8">
        <Heart className="w-8 h-8 text-red-500 fill-red-500" />
        <h1 className="text-2xl md:text-3xl font-bold">Productos Favoritos</h1>
        <Badge variant="secondary" className="ml-2">
          {totalFavorites} favoritos
        </Badge>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchFavorites} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Heart className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay favoritos aún</h3>
            <p className="text-muted-foreground">Cuando los usuarios agreguen productos a favoritos, aparecerán aquí</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {favorites.map((fav) => (
            <Card key={fav.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  {/* Producto */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={getImageUrl(fav.product.image)}
                        alt={fav.product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/products/${fav.product.id}`} className="font-semibold hover:text-orange-600 truncate block">
                        {fav.product.name}
                      </Link>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <Badge variant="outline" className="text-xs">{fav.product.category || 'Sin categoría'}</Badge>
                        <span>{formatPrice(fav.product.price)}</span>
                        <span>•</span>
                        <span className={fav.product.in_stock ? 'text-green-600' : 'text-red-600'}>
                          {fav.product.in_stock ? 'Stock: ' + fav.product.stock : 'Agotado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Usuario */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm w-full md:w-auto">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{fav.user.first_name} {fav.user.last_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground truncate max-w-[150px]">{fav.user.email}</span>
                    </div>
                  </div>

                  {/* Fecha */}
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(fav.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}