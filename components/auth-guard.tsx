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

  useEffect(() => {
    const init = async () => {
      if (_hydrated) {
        if (isAuthenticated) {
          clearGuestSession()
          const isValid = await verifyToken()
          if (!isValid) {
            if (!pathname.includes('/checkout') && !pathname.includes('/order-success')) {
              router.push('/login')
            }
          }
        }
        setIsVerifying(false)
      }
    }
    
    init()
  }, [_hydrated, isAuthenticated, verifyToken, clearGuestSession, router, pathname])

  if (!_hydrated || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return <>{children}</>
}