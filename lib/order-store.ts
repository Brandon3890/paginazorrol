// lib/order-store.ts - INTERFACES CORREGIDAS
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 🧩 Interfaces de datos actualizadas y corregidas
interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
  category: string
}

interface CustomerInfo {
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  region?: string // Agregado para compatibilidad
  postalCode: string
  department?: string // Agregado
  deliveryInstructions?: string // Agregado
}

interface PaymentInfo {
  method: 'transbank' | 'cash'
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  cardName?: string
  cardNumber?: string
}

interface OrderTotals {
  subtotal: number
  discount: number 
  shipping: number
  tax: number
  total: number
}

interface ShippingAddress {
  title: string
  street: string
  hasNoNumber: boolean
  regionIso: string
  regionName: string
  communeName: string
  postalCode: string
  department?: string
  deliveryInstructions?: string
}

interface Order {
  id: string
  userId?: string
  items: OrderItem[]
  customerInfo: CustomerInfo
  shippingAddress?: ShippingAddress
  paymentInfo: PaymentInfo
  totals: OrderTotals 
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  notes?: string
  couponId?: number | null
  couponCode?: string | null
  shippingMethod?: string
  createdAt: string
  updatedAt: string
}

// 🧠 Estado global con Zustand
interface OrderStore {
  orders: Order[]
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => string
  getOrder: (id: string) => Order | undefined
  getOrderById: (id: string) => Order | undefined
  getUserOrders: (userId: string) => Order[]
  getOrdersByUserId: (userId: string) => Order[]
  getAllOrders: () => Order[]
  updateOrderStatus: (id: string, status: Order['status']) => void
}

// 🪣 Persistencia local + funciones del store
export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: [],

      // 🆕 Crear una nueva orden
      addOrder: (orderData) => {
        const newOrder: Order = {
          ...orderData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((state) => ({
          orders: [...state.orders, newOrder],
        }))

        return newOrder.id
      },

      // 🔍 Obtener una orden específica
      getOrder: (id) => {
        const { orders } = get()
        return orders.find((order) => order.id === id)
      },

      // 🔍 Obtener una orden específica (alias)
      getOrderById: (id) => {
        const { orders } = get()
        return orders.find((order) => order.id === id)
      },

      // 👤 Obtener órdenes de un usuario
      getUserOrders: (userId) => {
        const { orders } = get()
        return orders.filter((order) => order.userId === userId)
      },

      // 👤 Obtener órdenes de un usuario (alias)
      getOrdersByUserId: (userId) => {
        const { orders } = get()
        return orders.filter((order) => order.userId === userId)
      },

      // 🔍 Obtener todas las órdenes
      getAllOrders: () => {
        const { orders } = get()
        return orders
      },

      // 🔄 Actualizar estado de una orden
      updateOrderStatus: (id, status) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === id
              ? {
                  ...order,
                  status,
                  updatedAt: new Date().toISOString(),
                }
              : order
          ),
        }))
      },
    }),
    {
      name: 'order-store',
    }
  )
)