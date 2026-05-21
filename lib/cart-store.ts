// lib/cart-store.ts
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
  // Dimensiones para envío
  weight?: number
  height?: number
  width?: number
  length?: number
}

export type ShippingMethod = "standard" | "express"

// Interfaz para las opciones de envío de Chilexpress
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
  
  // Métodos del carrito
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
  
  // Métodos de envío
  setShippingMethod: (method: ShippingMethod) => void
  setShippingCost: (cost: number) => void
  getShippingCost: () => number
  setChilexpressOptions: (options: ChilexpressShippingOption[]) => void
  setSelectedChilexpressOption: (option: ChilexpressShippingOption | null) => void
  getSelectedShippingPrice: () => number
  
  // Métodos de cupón
  applyCoupon: (code: string, discount: number, couponDetails: any) => void
  removeCoupon: () => void
  getDiscountAmount: () => number
  
  // Métodos de checkout y reserva
  setLoading: (loading: boolean) => void
  startCheckout: (expiresAt: string) => void
  endCheckout: () => void
  hasActiveCheckout: () => boolean
  checkAndClearExpiredCheckout: () => boolean
  resetCartAfterCheckout: () => void
  
  // Métodos para cálculo de dimensiones
  getTotalWeight: () => number
  getMaxDimensions: () => { height: number; width: number; length: number }
  getPackageInfo: () => { weight: number; height: number; width: number; length: number }
  
  // Actualizar reserva
  updateReservationAfterCartChange: (userId: string) => Promise<boolean>
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Estado inicial
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

      // ============ MÉTODOS DEL CARRITO ============
      
      addItem: (product) => {
        console.log('🛒 addItem llamado con:', product)
        
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
          
          // Asegurar que el producto tenga dimensiones por defecto
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
          console.log('✅ Nuevo producto agregado con dimensiones:', newItem)
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
          chilexpressOptions: [],
          selectedChilexpressOption: null,
          shippingCost: 0,
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
          checkoutExpiresAt: null,
          chilexpressOptions: [],
          selectedChilexpressOption: null,
          shippingCost: 0,
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
          shippingMethod: "standard",
          shippingCost: 0,
          chilexpressOptions: [],
          selectedChilexpressOption: null,
        })
        console.log('🔄 Carrito completamente reiniciado después de checkout')
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

      // ============ MÉTODOS DE ENVÍO ============
      
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
        // Envío gratis sobre $50.000
        if (totalPrice >= 50000) return 0
        
        return selected.price
      },

      // ============ MÉTODOS DE CÁLCULO DE DIMENSIONES ============
      
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

      // ============ MÉTODOS DE CUPÓN ============
      
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

      // ============ MÉTODOS DE CHECKOUT ============
      
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
      },

      // ============ ACTUALIZAR RESERVA ============
      
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
    }
  )
)