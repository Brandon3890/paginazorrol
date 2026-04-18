"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface CartItem {
  id: number
  name: string
  price: number
  image: string
  quantity: number
  category: string
  inStock: boolean
  stock: number 
  categoryId?: number 
  subcategoryId?: number 
}

export type ShippingMethod = "standard" | "express"

export interface ShippingOption {
  id: ShippingMethod
  name: string
  description: string
  price: number
  estimatedDays: string
}

export const shippingOptions: ShippingOption[] = [
  {
    id: "standard",
    name: "Envío Estándar",
    description: "Entrega en 2-3 días hábiles",
    price: 2000,
    estimatedDays: "2-3 días",
  },
  {
    id: "express",
    name: "Envío Express",
    description: "Entrega al día siguiente",
    price: 3000,
    estimatedDays: "1 día",
  },
]

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  shippingMethod: ShippingMethod
  appliedCoupon: string | null
  couponDiscount: number
  couponDetails: any | null
  isLoading: boolean
  checkoutActive: boolean
  checkoutExpiresAt: string | null
  addItem: (product: Omit<CartItem, "quantity">) => void
  removeItem: (id: number) => void
  updateQuantity: (id: number, quantity: number) => void
  clearCart: () => void
  forceClearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
  getSubtotalPrice: () => number
  toggleCart: () => void
  setCartOpen: (open: boolean) => void
  setShippingMethod: (method: ShippingMethod) => void
  getShippingCost: () => number
  applyCoupon: (code: string, discount: number, couponDetails: any) => void
  removeCoupon: () => void
  getDiscountAmount: () => number
  setLoading: (loading: boolean) => void
  startCheckout: (expiresAt: string) => void
  endCheckout: () => void
  hasActiveCheckout: () => boolean
  checkAndClearExpiredCheckout: () => boolean
  resetCartAfterCheckout: () => void
  // NUEVAS FUNCIONES PARA ACTUALIZAR RESERVA
  updateReservationAfterCartChange: (userId: string) => Promise<boolean>
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      shippingMethod: "standard",
      appliedCoupon: null,
      couponDiscount: 0,
      couponDetails: null,
      isLoading: true,
      checkoutActive: false,
      checkoutExpiresAt: null,

      addItem: (product) => {
        console.log('🛒 addItem llamado con:', product)
        
        // Verificar si hay checkout activo
        const hasCheckout = get().checkoutActive && get().checkoutExpiresAt
        const hasExpired = get().checkAndClearExpiredCheckout()
        
        if (hasCheckout && !hasExpired) {
          console.log('⚠️ Checkout activo detectado, se actualizará la reserva después')
        }

        const items = get().items
        const existingItem = items.find((item) => item.id === product.id)

        if (existingItem) {
          const newQuantity = existingItem.quantity + 1
          if (newQuantity > product.stock) {
            console.warn(`⚠️ No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`)
            return
          }
          
          set({
            items: items.map((item) => 
              item.id === product.id ? { ...item, quantity: newQuantity } : item
            ),
          })
          console.log('✅ Producto existente, cantidad actualizada a:', newQuantity)
        } else {
          if (product.stock < 1) {
            console.warn(`⚠️ No hay stock disponible para ${product.name}`)
            return
          }
          
          set({
            items: [...items, { ...product, quantity: 1 }],
          })
          console.log('✅ Nuevo producto agregado')
        }
        
        console.log('📦 Estado actual del carrito:', get().items)
      },

      removeItem: (id) => {
        const hasCheckout = get().checkoutActive && get().checkoutExpiresAt
        const hasExpired = get().checkAndClearExpiredCheckout()
        
        if (hasCheckout && !hasExpired) {
          console.log('⚠️ Checkout activo detectado, se actualizará la reserva después')
        }
        
        set({
          items: get().items.filter((item) => item.id !== id),
        })
        console.log('🗑️ Producto eliminado')
      },

      updateQuantity: (id, quantity) => {
        const hasCheckout = get().checkoutActive && get().checkoutExpiresAt
        const hasExpired = get().checkAndClearExpiredCheckout()
        
        if (hasCheckout && !hasExpired) {
          console.log('⚠️ Checkout activo detectado, se actualizará la reserva después')
        }

        if (quantity <= 0) {
          get().removeItem(id)
          return
        }

        const items = get().items
        const item = items.find(i => i.id === id)
        if (item && quantity > item.stock) {
          console.warn(`⚠️ No hay suficiente stock para ${item.name}. Stock disponible: ${item.stock}`)
          return
        }

        set({
          items: items.map((item) => 
            item.id === id ? { ...item, quantity } : item
          ),
        })
        console.log(`🔄 Cantidad actualizada para producto ${id}: ${quantity}`)
      },

      clearCart: () => {
        set({ 
          items: [], 
          appliedCoupon: null, 
          couponDiscount: 0, 
          couponDetails: null,
        })
        
        if (get().checkoutActive) {
          set({ checkoutActive: false, checkoutExpiresAt: null })
          console.log('🛒 Checkout desactivado porque se vació el carrito')
        }
        
        console.log('🗑️ Carrito vaciado')
      },

      forceClearCart: () => {
        set({ 
          items: [], 
          appliedCoupon: null, 
          couponDiscount: 0, 
          couponDetails: null,
          checkoutActive: false,
          checkoutExpiresAt: null
        })
        console.log('🗑️ Carrito forzado a vaciarse y checkout reiniciado')
      },

      resetCartAfterCheckout: () => {
        set({ 
          items: [], 
          appliedCoupon: null, 
          couponDiscount: 0, 
          couponDetails: null,
          checkoutActive: false,
          checkoutExpiresAt: null,
          shippingMethod: "standard"
        })
        console.log('🔄 Carrito completamente reiniciado después de checkout')
      },

      updateReservationAfterCartChange: async (userId: string) => {
        const { items, checkoutActive, checkoutExpiresAt } = get()
        
        if (!checkoutActive || !userId || items.length === 0) {
          return true
        }
        
        if (checkoutExpiresAt) {
          const expiresAtDate = new Date(checkoutExpiresAt.replace(' ', 'T'))
          const now = new Date()
          if (now > expiresAtDate) {
            get().endCheckout()
            return true
          }
        }
        
        try {
          console.log('🔄 Actualizando reserva de stock después de cambio en carrito...')
          
          const response = await fetch('/api/cart/reserve-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: items.map(item => ({
                id: item.id,
                quantity: item.quantity,
                name: item.name
              })),
              action: 'update'
            })
          })
          
          const data = await response.json()
          
          if (!response.ok) {
            console.error('❌ Error actualizando reserva:', data.error)
            if (data.errors) {
              console.error('Detalles:', data.errors)
            }
            return false
          }
          
          if (data.expiresAt) {
            set({ checkoutExpiresAt: data.expiresAt })
            console.log('✅ Reserva actualizada, nueva expiración:', data.expiresAt)
          }
          
          return true
        } catch (error) {
          console.error('❌ Error en updateReservationAfterCartChange:', error)
          return false
        }
      },

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },

      getSubtotalPrice: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0)
      },

      getTotalPrice: () => {
        const subtotal = get().getSubtotalPrice()
        const discount = get().couponDiscount
        return Math.max(0, subtotal - discount)
      },

      getDiscountAmount: () => {
        return get().couponDiscount
      },

      toggleCart: () => {
        set({ isOpen: !get().isOpen })
      },

      setCartOpen: (open) => {
        set({ isOpen: open })
      },

      setShippingMethod: (method) => {
        set({ shippingMethod: method })
      },

      getShippingCost: () => {
        const totalPrice = get().getTotalPrice()
        if (totalPrice >= 50000) {
          return 0
        }
        const selectedOption = shippingOptions.find((opt) => opt.id === get().shippingMethod)
        return selectedOption?.price || 0
      },

      applyCoupon: (code, discount, couponDetails) => {
        set({ 
          appliedCoupon: code, 
          couponDiscount: discount,
          couponDetails: couponDetails 
        })
      },

      removeCoupon: () => {
        set({ 
          appliedCoupon: null, 
          couponDiscount: 0,
          couponDetails: null 
        })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      startCheckout: (expiresAt) => {
        set({ 
          checkoutActive: true, 
          checkoutExpiresAt: expiresAt,
          isOpen: false 
        })
        console.log('🛒 Checkout iniciado, expira:', expiresAt)
      },

      endCheckout: () => {
        set({ 
          checkoutActive: false, 
          checkoutExpiresAt: null 
        })
        console.log('🛒 Checkout finalizado')
      },

      checkAndClearExpiredCheckout: () => {
        const { checkoutActive, checkoutExpiresAt } = get()
        
        if (!checkoutActive || !checkoutExpiresAt) return false

        const now = new Date()
        const expiresAt = new Date(checkoutExpiresAt)
        
        if (now > expiresAt) {
          set({ 
            checkoutActive: false, 
            checkoutExpiresAt: null,
          })
          console.log('⏰ Checkout expirado y limpiado')
          return true
        }
        
        return false
      },

      hasActiveCheckout: () => {
        const { checkoutActive, checkoutExpiresAt } = get()
        
        if (!checkoutActive || !checkoutExpiresAt) return false

        const now = new Date()
        const expiresAt = new Date(checkoutExpiresAt)
        
        return now <= expiresAt
      }
    }),
    {
      name: "cart-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false
          if (state.checkoutActive && state.checkoutExpiresAt) {
            const now = new Date()
            const expiresAt = new Date(state.checkoutExpiresAt)
            if (now > expiresAt) {
              state.checkoutActive = false
              state.checkoutExpiresAt = null
              console.log('🔄 Checkout expirado limpiado durante hidratación')
            }
          }
          console.log('🛒 Carrito hidratado desde localStorage:', state.items)
        }
      },
    },
  ),
)