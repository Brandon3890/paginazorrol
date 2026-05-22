import { Suspense } from 'react'
import OrderSuccessContent from './OrderSuccessContent'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <p>Cargando...</p>
          </div>
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  )
}