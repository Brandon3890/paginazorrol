import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface GuestInfo {
  email: string
  firstName: string
  lastName: string
  phone: string
  rut?: string
  sessionId: string
  createdAt: string
  expiresAt: string
}

interface GuestStore {
  guest: GuestInfo | null
  isGuest: boolean
  createGuestSession: (data: Omit<GuestInfo, 'sessionId' | 'createdAt' | 'expiresAt'>) => string
  getGuestSession: () => GuestInfo | null
  clearGuestSession: () => void
  isValidSession: () => boolean
  checkAndClearIfUserLoggedIn: () => void
}

const generateSessionId = (): string => {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const useGuestStore = create<GuestStore>()(
  persist(
    (set, get) => ({
      guest: null,
      isGuest: false,

      createGuestSession: (data) => {
        const sessionId = generateSessionId()
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        
        const guest: GuestInfo = {
          ...data,
          sessionId,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString()
        }
        
        set({ guest, isGuest: true })
        
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('guest_session_id', sessionId)
        }
        
        return sessionId
      },

      getGuestSession: () => {
        const { guest, isValidSession } = get()
        if (guest && isValidSession()) {
          return guest
        }
        return null
      },

      clearGuestSession: () => {
        set({ guest: null, isGuest: false })
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('guest_session_id')
        }
      },

      isValidSession: () => {
        const { guest } = get()
        if (!guest) return false
        
        const now = new Date()
        const expiresAt = new Date(guest.expiresAt)
        return now < expiresAt
      },

      checkAndClearIfUserLoggedIn: () => {
        if (typeof window !== 'undefined') {
          const authToken = localStorage.getItem('auth-storage')
          if (authToken) {
            try {
              const parsed = JSON.parse(authToken)
              if (parsed.state && parsed.state.isAuthenticated) {
                get().clearGuestSession()
              }
            } catch (e) {
              console.error('Error checking auth storage:', e)
            }
          }
        }
      }
    }),
    {
      name: 'guest-storage',
      partialize: (state) => ({ guest: state.guest, isGuest: state.isGuest })
    }
  )
)