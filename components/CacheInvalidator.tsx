// components/CacheInvalidator.tsx
"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { invalidateProductsCache } from "@/lib/cache-utils"
import { useProductStore } from "@/lib/product-store"

export function CacheInvalidator() {
  const { fetchProducts } = useProductStore()
  
  const handleInvalidateCache = async () => {
    invalidateProductsCache()
    await fetchProducts({ force: true })
  }
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleInvalidateCache}
      className="flex items-center gap-2"
    >
      <RefreshCw className="w-4 h-4" />
      Actualizar
    </Button>
  )
}