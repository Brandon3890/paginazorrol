// lib/cart-store.ts - VERSIÓN ACTUALIZADA Y COMPATIBLE
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

export type ShippingMethod = "standard" | "express" | "overnight"

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
    description: "Entrega al dia siguiente por en estacion de metro",
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
  addItem: (product: Omit<CartItem, "quantity">) => void
  removeItem: (id: number) => void
  updateQuantity: (id: number, quantity: number) => void
  clearCart: () => void
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

      addItem: (product) => {
        const items = get().items
        const existingItem = items.find((item) => item.id === product.id)

        if (existingItem) {
          // Verificar stock disponible antes de agregar
          const newQuantity = existingItem.quantity + 1
          if (newQuantity > product.stock) {
            console.warn(`No hay suficiente stock para ${product.name}. Stock disponible: ${product.stock}`)
            return
          }
          
          set({
            items: items.map((item) => 
              item.id === product.id ? { ...item, quantity: newQuantity } : item
            ),
          })
        } else {
          // Verificar que haya stock para agregar el primer item
          if (product.stock < 1) {
            console.warn(`No hay stock disponible para ${product.name}`)
            return
          }
          
          set({
            items: [...items, { ...product, quantity: 1 }],
          })
        }
      },

      removeItem: (id) => {
        set({
          items: get().items.filter((item) => item.id !== id),
        })
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id)
          return
        }

        // Verificar stock disponible
        const items = get().items
        const item = items.find(i => i.id === id)
        if (item && quantity > item.stock) {
          console.warn(`No hay suficiente stock para ${item.name}. Stock disponible: ${item.stock}`)
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
          couponDetails: null 
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
    }),
    {
      name: "cart-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isLoading = false
          console.log('🛒 Carrito hidratado desde localStorage')
        }
      },
    },
  ),
)