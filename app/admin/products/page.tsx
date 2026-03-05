// app/admin/products/page.tsx - COMPLETO Y CORREGIDO
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useProductStore } from "@/lib/product-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Pencil, Trash2, Plus, RotateCcw, Trash, ArrowLeft, RefreshCw, ImageOff, Percent } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  subcategory: string;
  categoryId: number;
  subcategoryId: number;
  ageMin: number;
  age: string;
  playersMin: number;
  playersMax: number;
  players: string;
  durationMin: number;
  duration: string;
  stock: number;
  inStock: boolean;
  isOnSale: boolean;
  isActive: boolean;
  additionalImages: string[];
  tags: { id: number; name: string; slug: string }[];
  createdAt: string;
  updatedAt: string;
}

// Función auxiliar para asegurar que el precio sea número
const ensureNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Función para formatear precio en CLP
const formatCLP = (price: number): string => {
  return Math.round(price).toLocaleString('es-CL');
};

// Función para calcular porcentaje de descuento
const calculateDiscountPercent = (originalPrice: number, currentPrice: number): number => {
  if (!originalPrice || originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
};

// Componente de imagen con manejo de errores
const ProductImage = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Corregir la URL de la imagen
  const getCorrectedImageUrl = (url: string) => {
    if (!url) return '/diverse-products-still-life.png';
    
    // Si ya es una URL correcta
    if (url.startsWith('/') || url.startsWith('http')) {
      return url;
    }
    
    // Si es una ruta relativa, hacerla absoluta
    return `/${url}`;
  };

  const correctedSrc = getCorrectedImageUrl(src);

  const handleLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleError = () => {
    console.warn(`❌ Failed to load image: ${correctedSrc}`);
    setImageError(true);
    setImageLoading(false);
  };

  return (
    <div className="relative">
      {imageLoading && (
        <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
          <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
        </div>
      )}
      
      {imageError ? (
        <div className={`${className} bg-gray-200 rounded-lg flex items-center justify-center`}>
          <ImageOff className="w-6 h-6 text-gray-500" />
        </div>
      ) : (
        <img
          src={correctedSrc}
          alt={alt}
          className={className}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
    </div>
  );
};

export default function AdminProductsPage() {
  const router = useRouter()
  const { 
    products, 
    loading, 
    error, 
    fetchProducts, 
    deactivateProduct, 
    reactivateProduct, 
    permanentlyDeleteProduct,
    clearError 
  } = useProductStore()
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [permanentDeleteDialogOpen, setPermanentDeleteDialogOpen] = useState(false)
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<number | null>(null)
  const [productToPermanentlyDelete, setProductToPermanentlyDelete] = useState<number | null>(null)
  const [productToReactivate, setProductToReactivate] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Cargar productos al montar el componente - FIX: Usar parámetros para admin
  useEffect(() => {
    console.log('🔄 AdminProductsPage mounted, fetching products with admin parameters...');
    fetchProducts({ includeInactive: true, isAdmin: true });
  }, [fetchProducts]);

  // Debug del estado actual
  useEffect(() => {
    if (products.length > 0) {
      console.log('📦 Current products state:', {
        total: products.length,
        active: products.filter(p => p.isActive).length,
        inactive: products.filter(p => !p.isActive).length,
        inactiveIds: products.filter(p => !p.isActive).map(p => p.id),
        products: products.map(p => ({ 
          id: p.id, 
          name: p.name, 
          isActive: p.isActive 
        }))
      });
    }
  }, [products]);

  const handleDeactivate = (id: number) => {
    setProductToDelete(id)
    setDeleteDialogOpen(true)
  }

  const confirmDeactivate = async () => {
    if (productToDelete) {
      setActionLoading(true);
      try {
        console.log(`🗑️ Confirming deactivation for product ${productToDelete}`);
        await deactivateProduct(productToDelete)
        setDeleteDialogOpen(false)
        setProductToDelete(null)
      } catch (error) {
        console.error('Error deactivating product:', error)
      } finally {
        setActionLoading(false);
      }
    }
  }

  const handleReactivate = (id: number) => {
    setProductToReactivate(id)
    setReactivateDialogOpen(true)
  }

  const confirmReactivate = async () => {
    if (productToReactivate) {
      setActionLoading(true);
      try {
        console.log(`🔄 Confirming reactivation for product ${productToReactivate}`);
        await reactivateProduct(productToReactivate)
        setReactivateDialogOpen(false)
        setProductToReactivate(null)
      } catch (error) {
        console.error('Error reactivating product:', error)
      } finally {
        setActionLoading(false);
      }
    }
  }

  const handlePermanentDelete = (id: number) => {
    setProductToPermanentlyDelete(id)
    setPermanentDeleteDialogOpen(true)
  }

  const confirmPermanentDelete = async () => {
    if (productToPermanentlyDelete) {
      setActionLoading(true);
      try {
        console.log(`💀 Confirming permanent deletion for product ${productToPermanentlyDelete}`);
        await permanentlyDeleteProduct(productToPermanentlyDelete)
        setPermanentDeleteDialogOpen(false)
        setProductToPermanentlyDelete(null)
      } catch (error) {
        console.error('Error permanently deleting product:', error)
      } finally {
        setActionLoading(false);
      }
    }
  }

  const handleRetry = () => {
    clearError()
    fetchProducts({ includeInactive: true, isAdmin: true })
  }

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    fetchProducts({ includeInactive: true, isAdmin: true })
  }

  const ProductCard = ({ product, isInactive = false }: { product: Product; isInactive?: boolean }) => {
    // Asegurar que los precios sean números
    const price = ensureNumber(product.price);
    const originalPrice = product.originalPrice ? ensureNumber(product.originalPrice) : undefined;
    const discountPercent = originalPrice ? calculateDiscountPercent(originalPrice, price) : 0;

    return (
      <Card key={product.id} className="mb-4">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <ProductImage
                src={product.image}
                alt={product.name}
                className="w-full sm:w-20 h-48 sm:h-20 object-cover rounded-lg"
              />
              <div className="flex-1">
                <CardTitle className="text-base md:text-lg">{product.name}</CardTitle>
                <CardDescription className="mt-1 text-sm">
                  {product.category} - {product.subcategory}
                </CardDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant={product.inStock ? "default" : "destructive"} className="text-xs">
                    {product.inStock ? `Stock: ${product.stock}` : "Sin Stock"}
                  </Badge>
                  {product.isOnSale && discountPercent > 0 && (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      {discountPercent}% OFF
                    </Badge>
                  )}
                  {isInactive && (
                    <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                      Inactivo
                    </Badge>
                  )}
                  {!isInactive && (
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                      Activo
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              {!isInactive ? (
                <>
                  <Link href={`/admin/products/${product.id}`}>
                    <Button variant="outline" size="icon" disabled={actionLoading}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleDeactivate(product.id)}
                    disabled={actionLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Link href={`/admin/products/${product.id}`}>
                    <Button variant="outline" size="icon" title="Editar" disabled={actionLoading}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleReactivate(product.id)} 
                    title="Reactivar"
                    disabled={actionLoading}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  {/* Boton de elimnar permanente 
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handlePermanentDelete(product.id)}
                    title="Eliminar permanentemente"
                    disabled={actionLoading}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>*/}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span>Edad: {product.age}</span>
              <span>Jugadores: {product.players}</span>
              <span>Duración: {product.duration}</span>
            </div>
            <div className="text-left sm:text-right">
              {originalPrice && originalPrice > price && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground line-through">
                    ${formatCLP(originalPrice)} CLP
                  </span>
                  <Badge variant="outline" className="text-xs text-red-600">
                    -{discountPercent}%
                  </Badge>
                </div>
              )}
              <div className="text-lg font-bold text-primary">
                ${formatCLP(price)} CLP
              </div>
              {product.isOnSale && discountPercent > 0 && (
                <div className="text-xs text-green-600 mt-1">
                  ¡En oferta!
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const activeProducts = products.filter((p) => p.isActive)
  const inactiveProducts = products.filter((p) => !p.isActive)

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Cargando productos...</span>
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
        <div className="mb-6">
          <Link href="/admin">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gestión de Productos</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {products.length} productos en total ({activeProducts.length} activos, {inactiveProducts.length} inactivos)
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={actionLoading || loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Link href="/admin/products/new">
                <Button className="flex items-center gap-2 bg-[#C2410C] hover:bg-[#9A3412]" disabled={actionLoading}>
                  <Plus className="w-4 h-4" />
                  Añadir Producto
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/15 text-destructive p-4 rounded-md mb-6">
            <div className="flex justify-between items-center">
              <span>Error: {error}</span>
              <Button variant="outline" size="sm" onClick={handleRetry} disabled={actionLoading}>
                Reintentar
              </Button>
            </div>
          </div>
        )}

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="active">Productos Activos ({activeProducts.length})</TabsTrigger>
            <TabsTrigger value="inactive">Productos Inactivos ({inactiveProducts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeProducts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay productos activos
                </CardContent>
              </Card>
            ) : (
              activeProducts.map((product) => <ProductCard key={product.id} product={product} />)
            )}
          </TabsContent>

          <TabsContent value="inactive" className="space-y-4">
            {inactiveProducts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No hay productos inactivos
                </CardContent>
              </Card>
            ) : (
              inactiveProducts.map((product) => <ProductCard key={product.id} product={product} isInactive />)
            )}
          </TabsContent>
        </Tabs>

        {/* Diálogo de Desactivar */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Desactivar Producto</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres desactivar este producto? El producto no aparecerá en la tienda pero podrás
                reactivarlo más tarde desde la pestaña de productos inactivos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(false)} 
                disabled={actionLoading}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDeactivate} 
                disabled={actionLoading}
                className="w-full sm:w-auto"
              >
                {actionLoading ? 'Desactivando...' : 'Desactivar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Reactivar */}
        <Dialog open={reactivateDialogOpen} onOpenChange={setReactivateDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reactivar Producto</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres reactivar este producto? El producto volverá a aparecer en la tienda.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={() => setReactivateDialogOpen(false)} 
                disabled={actionLoading}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                onClick={confirmReactivate} 
                disabled={actionLoading}
                className="w-full sm:w-auto"
              >
                {actionLoading ? 'Reactivando...' : 'Reactivar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Eliminar Permanentemente */}
        <Dialog open={permanentDeleteDialogOpen} onOpenChange={setPermanentDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Eliminar Producto Permanentemente</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que quieres eliminar este producto PERMANENTEMENTE? Esta acción no se puede deshacer y
                el producto será eliminado completamente de la base de datos.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setPermanentDeleteDialogOpen(false)}
                disabled={actionLoading}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmPermanentDelete} 
                disabled={actionLoading}
                className="w-full sm:w-auto"
              >
                {actionLoading ? 'Eliminando...' : 'Eliminar Permanentemente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  )
}