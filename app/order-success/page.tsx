"use client"

import dynamic from 'next/dynamic'

const OrderSuccessContent = dynamic(
  () => import('./OrderSuccessContent'),
  {
    ssr: false,
    loading: () => (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <p>Cargando pedido...</p>
        </div>
      </div>
    )
  }
)

export default function OrderSuccessPage() {
  return <OrderSuccessContent />
}