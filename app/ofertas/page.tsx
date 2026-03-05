"use client"

import { Header } from "@/components/header"
import { CategoryNav } from "@/components/category-nav"
import { ProductGrid } from "@/components/product-grid"
import { CategoryBreadcrumb } from "@/components/category-breadcrumb"
import { Footer } from "@/components/footer"
import { useCouponStore } from "@/lib/coupon-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Copy, Calendar, Users, Tag, Zap, ChevronDown, ChevronUp } from "lucide-react"
import { useEffect, useState } from "react"

export default function OfertasPage() {
  const { coupons, fetchCoupons } = useCouponStore()
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCoupons, setExpandedCoupons] = useState<Set<number>>(new Set())

  useEffect(() => {
    const loadCoupons = async () => {
      try {
        await fetchCoupons()
      } catch (error) {
        console.error('Error loading coupons:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadCoupons()
  }, [fetchCoupons])

  // Filtrar cupones activos y no expirados
  const activeCoupons = coupons.filter(coupon => {
    const now = new Date()
    const expirationDate = new Date(coupon.expirationDate)
    return coupon.isActive && expirationDate > now && coupon.currentUses < coupon.maxUses
  })

  // Ordenar cupones por porcentaje de descuento (mayor primero)
  const sortedCoupons = [...activeCoupons].sort((a, b) => b.discountPercentage - a.discountPercentage)

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const toggleCouponExpansion = (couponId: number) => {
    setExpandedCoupons(prev => {
      const newSet = new Set(prev)
      if (newSet.has(couponId)) {
        newSet.delete(couponId)
      } else {
        newSet.add(couponId)
      }
      return newSet
    })
  }

  const getCouponTypeLabel = (type: string) => {
    switch (type) {
      case 'global': return 'Todos los productos'
      case 'category': return 'Categorías específicas'
      case 'subcategory': return 'Subcategorías específicas'
      case 'product': return 'Productos específicos'
      case 'multiple': return 'Múltiples categorías y productos'
      default: return type
    }
  }

  const getCouponScope = (coupon: any) => {
    switch (coupon.type) {
      case 'global':
        return 'Aplica a todos los productos'
      case 'category':
        return coupon.categoryNames && coupon.categoryNames.length > 0 
          ? `Categorías: ${coupon.categoryNames.join(', ')}`
          : 'Categorías específicas'
      case 'subcategory':
        return coupon.subcategoryNames && coupon.subcategoryNames.length > 0
          ? `Subcategorías: ${coupon.subcategoryNames.join(', ')}`
          : 'Subcategorías específicas'
      case 'product':
        return coupon.productNames && coupon.productNames.length > 0
          ? `Productos: ${coupon.productNames.slice(0, 3).join(', ')}${coupon.productNames.length > 3 ? ` y ${coupon.productNames.length - 3} más` : ''}`
          : 'Productos específicos'
      case 'multiple':
        const scopes = []
        if (coupon.categoryNames?.length > 0) scopes.push(`${coupon.categoryNames.length} categorías`)
        if (coupon.subcategoryNames?.length > 0) scopes.push(`${coupon.subcategoryNames.length} subcategorías`)
        if (coupon.productNames?.length > 0) scopes.push(`${coupon.productNames.length} productos`)
        return scopes.length > 0 ? `Aplica a: ${scopes.join(', ')}` : 'Múltiples categorías'
      default:
        return getCouponTypeLabel(coupon.type)
    }
  }

  // NUEVA FUNCIÓN: Mostrar detalles expandidos para cupones múltiples
  const renderCouponDetails = (coupon: any) => {
    const isExpanded = expandedCoupons.has(coupon.id)
    const hasMultipleItems = coupon.type === 'multiple' && (
      (coupon.categoryNames?.length > 0) || 
      (coupon.subcategoryNames?.length > 0) || 
      (coupon.productNames?.length > 0)
    )

    if (!hasMultipleItems) return null

    return (
      <div className="mt-3 space-y-2">
        {/* Botón para expandir/contraer */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-800"
          onClick={() => toggleCouponExpansion(coupon.id)}
        >
          <span>Ver {isExpanded ? 'menos' : 'más'} detalles</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>

        {/* Detalles expandidos */}
        {isExpanded && (
          <div className="bg-white/50 rounded-lg p-3 space-y-2 text-xs border">
            {/* Categorías */}
            {coupon.categoryNames?.length > 0 && (
              <div>
                <strong className="text-gray-700">Categorías ({coupon.categoryNames.length}):</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {coupon.categoryNames.map((name: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Subcategorías */}
            {coupon.subcategoryNames?.length > 0 && (
              <div>
                <strong className="text-gray-700">Subcategorías ({coupon.subcategoryNames.length}):</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {coupon.subcategoryNames.map((name: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Productos */}
            {coupon.productNames?.length > 0 && (
              <div>
                <strong className="text-gray-700">Productos ({coupon.productNames.length}):</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {coupon.productNames.slice(0, 10).map((name: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 max-w-[120px] truncate">
                      {name}
                    </Badge>
                  ))}
                  {coupon.productNames.length > 10 && (
                    <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
                      +{coupon.productNames.length - 10} más
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // MEJORADA: Función para mostrar resumen mejorado en la tarjeta principal
  const getEnhancedCouponScope = (coupon: any) => {
    switch (coupon.type) {
      case 'global':
        return '🎁 Aplica a todos los productos'
      
      case 'category':
        if (coupon.categoryNames?.length > 0) {
          const mainCategories = coupon.categoryNames.slice(0, 2)
          const remaining = coupon.categoryNames.length - 2
          return `📂 ${mainCategories.join(', ')}${remaining > 0 ? ` +${remaining} más` : ''}`
        }
        return '📂 Categorías específicas'
      
      case 'subcategory':
        if (coupon.subcategoryNames?.length > 0) {
          const mainSubcategories = coupon.subcategoryNames.slice(0, 2)
          const remaining = coupon.subcategoryNames.length - 2
          return `📁 ${mainSubcategories.join(', ')}${remaining > 0 ? ` +${remaining} más` : ''}`
        }
        return '📁 Subcategorías específicas'
      
      case 'product':
        if (coupon.productNames?.length > 0) {
          const mainProducts = coupon.productNames.slice(0, 2)
          const remaining = coupon.productNames.length - 2
          return `📦 ${mainProducts.join(', ')}${remaining > 0 ? ` +${remaining} más` : ''}`
        }
        return '📦 Productos específicos'
      
      case 'multiple':
        const parts = []
        if (coupon.categoryNames?.length > 0) parts.push(`📂 ${coupon.categoryNames.length} cat.`)
        if (coupon.subcategoryNames?.length > 0) parts.push(`📁 ${coupon.subcategoryNames.length} sub.`)
        if (coupon.productNames?.length > 0) parts.push(`📦 ${coupon.productNames.length} prod.`)
        
        if (parts.length > 0) {
          return `🎯 ${parts.join(' • ')}`
        }
        return '🎯 Múltiples categorías'
      
      default:
        return getCouponTypeLabel(coupon.type)
    }
  }

  const getDiscountColor = (percentage: number) => {
    if (percentage >= 50) return 'from-red-500 to-pink-500'
    if (percentage >= 30) return 'from-orange-500 to-red-500'
    if (percentage >= 20) return 'from-amber-500 to-orange-500'
    return 'from-green-500 to-emerald-500'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <CategoryBreadcrumb
            items={[
              { name: "Inicio", href: "/" },
              { name: "Ofertas", href: "/ofertas" },
            ]}
          />
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
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
        <CategoryBreadcrumb
          items={[
            { name: "Inicio", href: "/" },
            { name: "Ofertas", href: "/ofertas" },
          ]}
        />
        
        <div className="mt-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Ofertas Especiales</h1>
          <p className="text-muted-foreground mb-8">
            Descubre todos nuestros productos en oferta y cupones de descuento disponibles
          </p>

          {/* Sección de Cupones */}
          {sortedCoupons.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-6">
                <Zap className="w-6 h-6 text-orange-500" />
                <h2 className="text-2xl font-bold text-foreground">Cupones de Descuento Activos</h2>
                <Badge variant="secondary" className="ml-2">
                  {sortedCoupons.length} disponibles
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {sortedCoupons.map((coupon) => (
                  <Card key={coupon.id} className="relative overflow-hidden border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 hover:shadow-lg transition-shadow">
                    {/* Ribbon de descuento */}
                    <div className="absolute top-4 right-4">
                      <Badge className={`bg-gradient-to-r ${getDiscountColor(coupon.discountPercentage)} text-white text-sm px-3 py-1 font-bold`}>
                        {coupon.discountPercentage}% OFF
                      </Badge>
                    </div>

                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl font-mono text-gray-900 font-bold">
                            {coupon.code}
                          </CardTitle>
                          <CardDescription className="text-gray-600 mt-1">
                            {getCouponTypeLabel(coupon.type)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Alcance MEJORADO del cupón */}
                      <div className="text-sm text-gray-700">
                        <p className="font-medium">{getEnhancedCouponScope(coupon)}</p>
                      </div>

                      {/* Detalles expandibles para cupones múltiples */}
                      {renderCouponDetails(coupon)}

                      {/* Información adicional */}
                      <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>Válido hasta: {new Date(coupon.expirationDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Usados: {coupon.currentUses} de {coupon.maxUses}</span>
                        </div>
                      </div>

                      {/* Botón para copiar código */}
                      <Button
                        onClick={() => copyToClipboard(coupon.code)}
                        className={`w-full font-semibold ${
                          copiedCode === coupon.code 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                        } text-white`}
                      >
                        {copiedCode === coupon.code ? (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            ¡Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar Código
                          </>
                        )}
                      </Button>

                      {/* Términos y condiciones */}
                      <div className="text-xs text-gray-500 text-center">
                        <p>Usos limitados • No acumulable con otras promociones</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Sección de Productos en Oferta */}
          <section id="productos-oferta">
            <div className="flex items-center gap-2 mb-6">
              <Tag className="w-6 h-6 text-orange-500" />
              <h2 className="text-2xl font-bold text-foreground">Productos en Oferta</h2>
            </div>
            <ProductGrid onSale={true} />
          </section>

          {/* Mensaje si no hay ofertas */}
          {sortedCoupons.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No hay cupones disponibles en este momento
                </h3>
                <p className="text-gray-600 mb-4">
                  Pero no te preocupes, tenemos muchos productos en oferta para ti.
                </p>
                <Button 
                  onClick={() => window.scrollTo({ top: document.getElementById('productos-oferta')?.offsetTop || 0, behavior: 'smooth' })}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Ver Productos en Oferta
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}