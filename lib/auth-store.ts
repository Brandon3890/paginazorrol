// lib/auth-store.ts - ACTUALIZADO CON MÉTODO REGISTER
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserAddress {
  id: number
  title: string
  street: string
  hasNoNumber: boolean
  regionIso: string
  regionName: string
  communeName: string
  postalCode: string
  department?: string
  deliveryInstructions?: string
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  role: 'user' | 'admin'
  addresses?: UserAddress[]
  createdAt: string
  updatedAt: string
}

interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (userData: RegisterData) => Promise<boolean> // NUEVO MÉTODO
  logout: () => void
  verifyToken: () => Promise<boolean>
  updateUser: (userData: Partial<User>) => void
  addUserAddress: (address: Omit<UserAddress, 'id'>) => Promise<void>
  updateUserAddress: (id: number, address: Partial<UserAddress>) => Promise<void>
  deleteUserAddress: (id: number) => Promise<void>
  setDefaultAddress: (id: number) => Promise<void>
  loadUserAddresses: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true })
          
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          })

          const data = await response.json()
          
          if (data.success && data.user) {
            // Cargar direcciones después del login
            const addressesResponse = await fetch('/api/user/addresses', {
              headers: {
                'Authorization': `Bearer ${data.token}`,
              },
            })

            let addresses = []
            if (addressesResponse.ok) {
              addresses = await addressesResponse.json()
            }

            const userWithAddresses = {
              ...data.user,
              addresses: addresses || []
            }

            set({
              user: userWithAddresses,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
            })
            return true
          } else {
            set({ isLoading: false })
            return false
          }
        } catch (error) {
          console.error('Error en login:', error)
          set({ isLoading: false })
          return false
        }
      },

      // NUEVO MÉTODO: Registro de usuario
      register: async (userData: RegisterData) => {
        try {
          set({ isLoading: true })
          
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
          })

          const data = await response.json()
          
          if (data.success && data.user) {
            // Para el registro, también podemos hacer login automáticamente
            const loginResponse = await fetch('/api/auth/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: userData.email,
                password: userData.password
              }),
            })

            const loginData = await loginResponse.json()
            
            if (loginData.success && loginData.user) {
              set({
                user: loginData.user,
                token: loginData.token,
                isAuthenticated: true,
                isLoading: false,
              })
              return true
            }
          }
          
          set({ isLoading: false })
          return false
        } catch (error) {
          console.error('Error en registro:', error)
          set({ isLoading: false })
          return false
        }
      },

      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          })
        }
      },

      verifyToken: async () => {
        const { token } = get()
        if (!token) return false

        try {
          const response = await fetch('/api/auth/verify', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (response.ok) {
            const data = await response.json()
            if (data.valid && data.user) {
              // Cargar direcciones al verificar el token
              const addressesResponse = await fetch('/api/user/addresses', {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              })

              let addresses = []
              if (addressesResponse.ok) {
                addresses = await addressesResponse.json()
              }

              const userWithAddresses = {
                ...data.user,
                addresses: addresses || []
              }

              set({ user: userWithAddresses, isAuthenticated: true })
              return true
            }
          }
        } catch (error) {
          console.error('Token verification failed:', error)
        }

        get().logout()
        return false
      },

      loadUserAddresses: async () => {
        const { token, user } = get()
        if (!token || !user) return

        try {
          const response = await fetch('/api/user/addresses', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (response.ok) {
            const addresses = await response.json()
            set(state => ({
              user: state.user ? {
                ...state.user,
                addresses: addresses || []
              } : null
            }))
          }
        } catch (error) {
          console.error('Error loading user addresses:', error)
        }
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...userData } })
        }
      },

      addUserAddress: async (addressData) => {
        try {
          const { token } = get()
          console.log('🔄 Adding address with token:', token ? 'Present' : 'Missing')
          
          const response = await fetch('/api/user/addresses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(addressData),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('❌ API Error:', errorData)
            throw new Error(errorData.error || 'Error adding address')
          }

          const newAddress = await response.json()
          console.log('✅ Address added successfully:', newAddress)
          
          set(state => ({
            user: state.user ? {
              ...state.user,
              addresses: [...(state.user.addresses || []), newAddress]
            } : null
          }))
        } catch (error) {
          console.error('❌ Error adding address:', error)
          throw error
        }
      },

      updateUserAddress: async (id, addressData) => {
        try {
          const { token } = get()
          const response = await fetch(`/api/user/addresses/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(addressData),
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || 'Error updating address')
          }

          const updatedAddress = await response.json()
          
          set(state => ({
            user: state.user ? {
              ...state.user,
              addresses: state.user.addresses?.map(addr => 
                addr.id === id ? { ...addr, ...updatedAddress } : addr
              ) || []
            } : null
          }))
        } catch (error) {
          console.error('Error updating address:', error)
          throw error
        }
      },

      deleteUserAddress: async (id) => {
        try {
          const { token } = get()
          const response = await fetch(`/api/user/addresses/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (!response.ok) throw new Error('Error deleting address')

          set(state => ({
            user: state.user ? {
              ...state.user,
              addresses: state.user.addresses?.filter(addr => addr.id !== id) || []
            } : null
          }))
        } catch (error) {
          console.error('Error deleting address:', error)
          throw error
        }
      },

      setDefaultAddress: async (id: number) => {
        try {
          const { token } = get()
          const response = await fetch(`/api/user/addresses/${id}/default`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            throw new Error(errorData.error || 'Error setting default address')
          }

          set(state => ({
            user: state.user ? {
              ...state.user,
              addresses: state.user.addresses?.map(addr => ({
                ...addr,
                isDefault: addr.id === id
              })) || []
            } : null
          }))
        } catch (error) {
          console.error('Error setting default address:', error)
          throw error
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        token: state.token, 
        user: state.user,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)