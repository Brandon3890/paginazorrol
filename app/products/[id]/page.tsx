"use client"

import { useState, useEffect, use } from "react"
import { ProductDetailView } from "@/components/ProductDetailView"
import { useProductStore } from "@/lib/product-store"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const productId = Number.parseInt(resolvedParams.id)
  
  const [imageTimestamp, setImageTimestamp] = useState(Date.now())
  const { fetchProduct } = useProductStore()
  
  useEffect(() => {
    const preloadProduct = async () => {
      try {
        console.log('🔄 Precargando producto ID:', productId)
        const product = await fetchProduct(productId, true)
        if (product) {
          setImageTimestamp(Date.now())
          console.log('✅ Producto precargado:', product.name)
          console.log('📸 Imagen:', product.image)
          console.log('📋 Specs:', product.specs)
        }
      } catch (error) {
        console.error('Error precargando producto:', error)
      }
    }
    
    preloadProduct()
  }, [productId, fetchProduct])
  
  return <ProductDetailView productId={productId} imageTimestamp={imageTimestamp} />
}