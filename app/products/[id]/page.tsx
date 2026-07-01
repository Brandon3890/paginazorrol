"use client"

import { use } from "react"
import { ProductDetailView } from "@/components/ProductDetailView"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const identifier = resolvedParams.id
  
  return <ProductDetailView productId={identifier} />
}