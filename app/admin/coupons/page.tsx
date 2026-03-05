// app/admin/coupons/page.tsx - VERSIÓN CORREGIDA
"use client"

import { useState, useEffect } from "react" // ← Agregar useEffect
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useCouponStore } from "@/lib/coupon-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, ArrowLeft, Edit, RefreshCw } from "lucide-react" // ← Agregar RefreshCw
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AdminCouponsPage() {
  const coupons = useCouponStore((state) => state.coupons)
  const fetchCoupons = useCouponStore((state) => state.fetchCoupons)
  const deleteCoupon = useCouponStore((state) => state.deleteCoupon)
  const loading = useCouponStore((state) => state.loading)

  const [couponToDelete, setCouponToDelete] = useState<number | null>(null)
  const [deleteCouponDialogOpen, setDeleteCouponDialogOpen] = useState(false)

  // Cargar cupones al montar el componente
  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const handleDeleteCoupon = (id: number) => {
    setCouponToDelete(id)
    setDeleteCouponDialogOpen(true)
  }

  const confirmDeleteCoupon = async () => {
    if (couponToDelete) {
      try {
        await deleteCoupon(couponToDelete)
        // Recargar cupones después de eliminar
        await fetchCoupons()
      } catch (error) {
        console.error('Error deleting coupon:', error)
      } finally {
        setDeleteCouponDialogOpen(false)
        setCouponToDelete(null)
      }
    }
  }

  const handleRefreshCoupons = async () => {
    await fetchCoupons()
  }

  const CouponCard = ({ coupon }: { coupon: any }) => {
    const isExpired = new Date(coupon.expirationDate) <= new Date()
    const isExhausted = coupon.currentUses >= coupon.maxUses

    const getTypeLabel = (type: string) => {
      switch (type) {
        case 'global': return 'Global'
        case 'category': return 'Categorías'
        case 'subcategory': return 'Subcategorías'
        case 'product': return 'Productos'
        case 'multiple': return 'Múltiple'
        default: return type
      }
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-base md:text-lg font-mono">{coupon.code}</CardTitle>
              <CardDescription className="mt-1 text-sm">{coupon.discountPercentage}% de descuento</CardDescription>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge
                  variant={coupon.isActive && !isExpired && !isExhausted ? "default" : "secondary"}
                  className="text-xs"
                >
                  {coupon.isActive && !isExpired && !isExhausted ? "Activo" : "Inactivo"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getTypeLabel(coupon.type)}
                </Badge>
                {isExpired && (
                  <Badge variant="destructive" className="text-xs">
                    Expirado
                  </Badge>
                )}
                {isExhausted && (
                  <Badge variant="destructive" className="text-xs">
                    Agotado
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Link href={`/admin/coupons/edit/${coupon.id}`}>
                <Button variant="outline" size="icon">
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
              <Button variant="destructive" size="icon" onClick={() => handleDeleteCoupon(coupon.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Expira:</span>
              <div className="font-medium">{new Date(coupon.expirationDate).toLocaleDateString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Usos:</span>
              <div className="font-medium">
                {coupon.currentUses} / {coupon.maxUses}
              </div>
            </div>
          </div>
          
          {/* Mostrar información de categorías, subcategorías y productos */}
          {coupon.type !== 'global' && (
            <div className="mt-3 space-y-2">
              {coupon.categoryNames && coupon.categoryNames.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs">Categorías:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {coupon.categoryNames.map((name: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {coupon.subcategoryNames && coupon.subcategoryNames.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs">Subcategorías:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {coupon.subcategoryNames.map((name: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {coupon.productNames && coupon.productNames.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs">Productos:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {coupon.productNames.slice(0, 3).map((name: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs max-w-[100px] truncate">
                        {name}
                      </Badge>
                    ))}
                    {coupon.productNames.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{coupon.productNames.length - 3} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gestión de Cupones</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Crea y administra cupones de descuento para tu tienda
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRefreshCoupons}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Link href="/admin/coupons/new">
                <Button className="flex items-center gap-2 bg-[#C2410C] hover:bg-[#9A3412]">
                  <Plus className="w-4 h-4" />
                  Crear Cupón
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando cupones...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {coupons.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay cupones creados. Crea tu primer cupón para ofrecer descuentos a tus clientes.
                </CardContent>
              </Card>
            ) : (
              coupons.map((coupon) => <CouponCard key={coupon.id} coupon={coupon} />)
            )}
          </div>
        )}

        <Dialog open={deleteCouponDialogOpen} onOpenChange={setDeleteCouponDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar Cupón</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres eliminar este cupón? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDeleteCouponDialogOpen(false)} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button variant="destructive" onClick={confirmDeleteCoupon} className="w-full sm:w-auto">
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  )
}