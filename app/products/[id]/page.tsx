"use client"

import { useState, useEffect, use } from "react"
import { ProductDetailView } from "@/components/ProductDetailView"
import { useProductStore } from "@/lib/product-store"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const productId = Number.parseInt(resolvedParams.id)
  
  // Estado para forzar recarga de imagen
  const [imageTimestamp, setImageTimestamp] = useState(Date.now())
  const { fetchProduct } = useProductStore()
  
  // Precargar el producto y forzar actualización de imagen
  useEffect(() => {
    const preloadProduct = async () => {
      try {
        // Forzar recarga del producto con timestamp
        const product = await fetchProduct(productId)
        if (product) {
          // Actualizar timestamp para forzar recarga de imagen
          setImageTimestamp(Date.now())
          console.log('✅ Producto precargado con imagen:', product.image)
        }
      } catch (error) {
        console.error('Error precargando producto:', error)
      }
    }
    
    preloadProduct()
  }, [productId, fetchProduct])
  
  return <ProductDetailView productId={productId} imageTimestamp={imageTimestamp} />
}