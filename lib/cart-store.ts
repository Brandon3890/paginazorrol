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
  weight?: number
  height?: number
  width?: number
  length?: number
}

export type ShippingMethod = "standard" | "express"

export interface ChilexpressShippingOption {
  typeCode: number
  name: string
  price: number
  finalWeight: number
  didUseVolumetricWeight: boolean
}

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  shippingMethod: ShippingMethod
  shippingCost: number
  chilexpressOptions: ChilexpressShippingOption[]
  selectedChilexpressOption: ChilexpressShippingOption | null
  appliedCoupon: string | null
  couponDiscount: number
  couponDetails: any | null
  isLoading: boolean
  checkoutActive: boolean
  checkoutExpiresAt: string | null
  guestSessionId: string | null
  
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
  setShippingCost: (cost: number) => void
  getShippingCost: () => number
  setChilexpressOptions: (options: ChilexpressShippingOption[]) => void
  setSelectedChilexpressOption: (option: ChilexpressShippingOption | null) => void
  getSelectedShippingPrice: () => number
  
  applyCoupon: (code: string, discount: number, couponDetails: any) => void
  removeCoupon: () => void
  getDiscountAmount: () => number
  
  setLoading: (loading: boolean) => void
  startCheckout: (expiresAt: string) => void
  endCheckout: () => void
  hasActiveCheckout: () => boolean
  checkAndClearExpiredCheckout: () => boolean
  resetCartAfterCheckout: () => void
  
  getTotalWeight: () => number
  getMaxDimensions: () => { height: number; width: number; length: number }
  getPackageInfo: () => { weight: number; height: number; width: number; length: number }
  
  updateReservationAfterCartChange: (userId: string) => Promise<boolean>
  setGuestSessionId: (sessionId: string | null) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      shippingMethod: "standard",
      shippingCost: 0,
      chilexpressOptions: [],
      selectedChilexpressOption: null,
      appliedCoupon: null,
      couponDiscount: 0,
      couponDetails: null,
      isLoading: true,
      checkoutActive: false,
      checkoutExpiresAt: null,
      guestSessionId: null,

      addItem: (product) => {
        const hasCheckout = get().checkoutActive && get().checkoutExpiresAt
        const hasExpired = get().checkAndClearExpiredCheckout()
        
        if (hasCheckout && !hasExpired) {
          console.log('Checkout activo detectado, se actualizara la reserva despues')
        }

        const items = get().items
        const existingItem = items.find((item) => item.id === product.id)

        if (existingItem) {
          const newQuantity = existingItem.quantity + 1
          if (newQuantity > product.stock) {
            console.warn('No hay suficiente stock para', product.name, '. Stock disponible:', product.stock)
            return
          }
          
          set({
            items: items.map((item) => 
              item.id === product.id ? { ...item, quantity: newQuantity } : item
            ),
          })
        } else {
          if (product.stock < 1) {
            console.warn('No hay stock disponible para', product.name)
            return
          }
          
          const newItem: CartItem = {
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.image,
              quantity: 1,
              category: product.category,
              inStock: product.inStock,
              stock: product.stock,
              categoryId: product.categoryId,
              subcategoryId: product.subcategoryId,
              weight: product.weight || 0.5,
              height: product.height || 10,
              width: product.width || 15,
              length: product.length || 20,
            };
          
          set({
            items: [...items, newItem],
          })
        }
      },

      removeItem: (id) => {
        const hasCheckout = get().checkoutActive && get().checkoutExpiresAt
        const hasExpired = get().checkAndClearExpiredCheckout()
        
        if (hasCheckout && !hasExpired) {
          console.log('Checkout activo detectado, se actualizara la reserva despues')
        }
        
        set({
          items: get().items.filter((item) => item.id !== id),
        })
      },

      updateQuantity: (id, quantity) => {
        const hasCheckout = get().checkoutActive && get().checkoutExpiresAt
        const hasExpired = get().checkAndClearExpiredCheckout()
        
        if (hasCheckout && !hasExpired) {
          console.log('Checkout activo detectado, se actualizara la reserva despues')
        }

        if (quantity <= 0) {
          get().removeItem(id)
          return
        }

        const items = get().items
        const item = items.find(i => i.id === id)
        if (item && quantity > item.stock) {
          console.warn('No hay suficiente stock para', item.name, '. Stock disponible:', item.stock)
          return
        }

        set({
          items: items.map((item) => 
            item.id === id ? { ...item, quantity } : item
          ),
        })
      },

      clearCart: () => {
        set({ 
          items: [], 
          appliedCoupon: null, 
          couponDiscount: 0, 
          couponDetails: null,
          chilexpressOptions: [],
          selectedChilexpressOption: null,
          shippingCost: 0,
        })
        
        if (get().checkoutActive) {
          set({ checkoutActive: false, checkoutExpiresAt: null })
        }
      },

      forceClearCart: () => {
        set({ 
          items: [], 
          appliedCoupon: null, 
          couponDiscount: 0, 
          couponDetails: null,
          checkoutActive: false,
          checkoutExpiresAt: null,
          chilexpressOptions: [],
          selectedChilexpressOption: null,
          shippingCost: 0,
        })
      },

      resetCartAfterCheckout: () => {
        set({ 
          items: [], 
          appliedCoupon: null, 
          couponDiscount: 0, 
          couponDetails: null,
          checkoutActive: false,
          checkoutExpiresAt: null,
          shippingMethod: "standard",
          shippingCost: 0,
          chilexpressOptions: [],
          selectedChilexpressOption: null,
        })
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

      setShippingCost: (cost) => {
        set({ shippingCost: cost })
      },

      getShippingCost: () => {
        return get().shippingCost
      },

      setChilexpressOptions: (options) => {
        set({ chilexpressOptions: options })
      },

      setSelectedChilexpressOption: (option) => {
        if (option) {
          set({ 
            selectedChilexpressOption: option,
            shippingCost: option.price
          })
        } else {
          set({ 
            selectedChilexpressOption: null,
            shippingCost: 0
          })
        }
      },

      getSelectedShippingPrice: () => {
        const selected = get().selectedChilexpressOption
        if (!selected) return 0
        
        const totalPrice = get().getTotalPrice()
        if (totalPrice >= 50000) return 0
        
        return selected.price
      },

      getTotalWeight: () => {
        const items = get().items
        return items.reduce((total, item) => {
          const weight = item.weight || 0.5
          return total + (weight * item.quantity)
        }, 0)
      },

      getMaxDimensions: () => {
        const items = get().items
        let maxHeight = 0
        let maxWidth = 0
        let maxLength = 0
        
        for (const item of items) {
          maxHeight = Math.max(maxHeight, item.height || 10)
          maxWidth = Math.max(maxWidth, item.width || 15)
          maxLength = Math.max(maxLength, item.length || 20)
        }
        
        return { height: maxHeight, width: maxWidth, length: maxLength }
      },

      getPackageInfo: () => {
        const totalWeight = get().getTotalWeight()
        const dimensions = get().getMaxDimensions()
        
        return {
          weight: Math.max(0.5, totalWeight),
          height: dimensions.height,
          width: dimensions.width,
          length: dimensions.length,
        }
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
      },

      endCheckout: () => {
        set({ 
          checkoutActive: false, 
          checkoutExpiresAt: null 
        })
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
            console.error('Error actualizando reserva:', data.error)
            if (data.errors) {
              console.error('Detalles:', data.errors)
            }
            return false
          }
          
          if (data.expiresAt) {
            set({ checkoutExpiresAt: data.expiresAt })
          }
          
          return true
        } catch (error) {
          console.error('Error en updateReservationAfterCartChange:', error)
          return false
        }
      },

      setGuestSessionId: (sessionId) => {
        set({ guestSessionId: sessionId })
      },
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
            }
          }
        }
      },
    }
  )
)