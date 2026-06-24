"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ProductDetailView } from "@/components/ProductDetailView"

function ProductPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const productId = searchParams.get('id')
  
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!productId) {
      router.push('/')
      return
    }
    setLoading(false)
  }, [productId, router])
  
  if (loading) return <div>Cargando...</div>
  if (!productId) return null
  
  return <ProductDetailView productId={parseInt(productId)} imageTimestamp={Date.now()} />
}

export default function ProductPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ProductPageContent />
    </Suspense>
  )
}