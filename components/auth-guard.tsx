'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useGuestStore } from '@/lib/guest-store'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, _hydrated, verifyToken } = useAuthStore()
  const { clearGuestSession } = useGuestStore()
  const pathname = usePathname()
  const router = useRouter()
  const [isVerifying, setIsVerifying] = useState(true)

  // Rutas públicas que no requieren autenticación
  const publicRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/checkout',
    '/order-success',
    '/api/orders/create-guest',
    '/api/payment'
  ]

  const isPublicRoute = publicRoutes.some(route => pathname?.startsWith(route))

  useEffect(() => {
    const init = async () => {
      // Si no está hidratado, esperar
      if (!_hydrated) {
        return
      }

      // Si es una ruta pública, no hacer verificación
      if (isPublicRoute) {
        setIsVerifying(false)
        return
      }

      if (isAuthenticated) {
        clearGuestSession()
        const isValid = await verifyToken()
        if (!isValid && !isPublicRoute) {
          router.push('/login')
        }
      } else {
        // Si no está autenticado y no es ruta pública, redirigir a login
        if (!isPublicRoute) {
          router.push('/login')
        }
      }
      
      setIsVerifying(false)
    }
    
    init()
  }, [_hydrated, isAuthenticated, verifyToken, clearGuestSession, router, pathname, isPublicRoute])

  // Mostrar loading solo si no está hidratado o está verificando
  if (!_hydrated || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}