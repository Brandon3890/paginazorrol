// app/products/[id]/page.tsx
"use client"

import { use } from "react"
import { ProductDetailView } from "@/components/ProductDetailView"

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const productId = Number.parseInt(resolvedParams.id)
  
  return <ProductDetailView productId={productId} />
}