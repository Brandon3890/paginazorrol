"use client"

import { Suspense } from 'react'
import OrderSuccessContent from './OrderSuccessContent'

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-pulse">
            <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
          <p className="mt-4 text-muted-foreground">Cargando información de tu pedido...</p>
        </div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  )
}