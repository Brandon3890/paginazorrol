"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { ProductDetailView } from "@/components/ProductDetailView"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const productId = Number.parseInt(resolvedParams.id)
  const [imageTimestamp, setImageTimestamp] = useState(Date.now())

  useEffect(() => {
    // Forzar recarga al montar
    setImageTimestamp(Date.now())
  }, [productId])

  return <ProductDetailView productId={productId} imageTimestamp={imageTimestamp} />
}