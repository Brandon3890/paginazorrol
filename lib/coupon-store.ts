import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Coupon {
  id: number;
  code: string;
  discountPercentage: number;
  expirationDate: string;
  maxUses: number;
  currentUses: number;
  type: 'global' | 'category' | 'subcategory' | 'product' | 'multiple';
  isActive: boolean;
  categories?: number[];
  subcategories?: number[];
  products?: number[];
  categoryNames?: string[];
  subcategoryNames?: string[];
  productNames?: string[];
  createdAt: string;
  updatedAt: string;
}

// CORRECCIÓN: Agregar useCoupon a la interfaz
interface CouponStore {
  coupons: Coupon[];
  loading: boolean;
  error: string | null;
  fetchCoupons: () => Promise<void>;
  addCoupon: (coupon: Omit<Coupon, 'id' | 'currentUses' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateCoupon: (id: number, coupon: Partial<Coupon>) => Promise<void>;
  deleteCoupon: (id: number) => Promise<void>;
  validateCoupon: (code: string, productId?: number, categoryId?: number, subcategoryId?: number) => { valid: boolean; coupon?: Coupon; message?: string } | null;
  getHighestDiscountCoupon: () => Coupon | null;
  useCoupon: (couponId: number) => Promise<void>; // AGREGAR ESTA LÍNEA
  clearError: () => void;
}

export const useCouponStore = create<CouponStore>()(
  persist(
    (set, get) => ({
      coupons: [],
      loading: false,
      error: null,

      fetchCoupons: async () => {
        set({ loading: true, error: null });
        try {
          console.log('🔄 Fetching coupons from API...');
          const response = await fetch('/api/coupons');
          
          if (!response.ok) {
            throw new Error(`Error fetching coupons: ${response.status}`);
          }
          
          const coupons = await response.json();
          
          set({ 
            coupons: coupons, 
            loading: false, 
            error: null 
          });
        } catch (error) {
          console.error('❌ Error in fetchCoupons:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Error al cargar cupones', 
            loading: false 
          });
        }
      },

    useCoupon: async (couponId: number) => {
      try {
        
        const response = await fetch(`/api/coupons/${couponId}/use`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { error: `HTTP error ${response.status}` };
          }
          
          console.error('❌ API Error using coupon:', errorData);
          throw new Error(errorData.error || errorData.details || 'Error using coupon');
        }

        const result = await response.json();
        
        // Actualizar el estado local incrementando currentUses
        set(state => ({
          coupons: state.coupons.map(coupon => 
            coupon.id === couponId 
              ? { ...coupon, currentUses: coupon.currentUses + 1 }
              : coupon
          )
        }));
        
        return result;
        
      } catch (error) {
        console.error('❌ Error in useCoupon:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error al usar el cupón';
        set({ error: errorMessage });
        throw error;
      }
    },

      addCoupon: async (couponData) => {
        try {
          const response = await fetch('/api/coupons', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(couponData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error creating coupon');
          }
          
          const newCoupon = await response.json();
          
          set(state => ({
            coupons: [...state.coupons, newCoupon]
          }));
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear el cupón';
          set({ error: errorMessage });
          throw error;
        }
      },

      updateCoupon: async (id: number, couponData: Partial<Coupon>) => {
        try {
          
          const response = await fetch(`/api/coupons/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(couponData),
          });

          if (!response.ok) {
            let errorData;
            try {
              errorData = await response.json();
            } catch {
              errorData = { error: `HTTP error ${response.status}` };
            }
            
            console.error('❌ API Error response:', errorData);
            throw new Error(errorData.error || errorData.details || 'Error updating coupon');
          }
          
          const updatedCoupon = await response.json();
          
          set(state => ({
            coupons: state.coupons.map(coupon => 
              coupon.id === id ? { ...coupon, ...updatedCoupon } : coupon
            )
          }));
          
        } catch (error) {
          console.error('❌ Error in updateCoupon:', error);
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar el cupón';
          set({ error: errorMessage });
          throw error;
        }
      },

      deleteCoupon: async (id: number) => {
        try {
          const response = await fetch(`/api/coupons/${id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error deleting coupon');
          }
          
          set(state => ({
            coupons: state.coupons.filter(coupon => coupon.id !== id)
          }));
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar el cupón';
          set({ error: errorMessage });
          throw error;
        }
      },

      validateCoupon: (code: string, productId?: number, categoryId?: number, subcategoryId?: number) => {
        const { coupons } = get();
        const now = new Date();
        
        const coupon = coupons.find(c => 
          c.code === code.toUpperCase() && 
          c.isActive && 
          new Date(c.expirationDate) > now &&
          c.currentUses < c.maxUses
        );

        if (!coupon) {
          return { valid: false, message: "Cupón no encontrado o expirado" };
        }

        // Validar según el tipo de cupón
        let isValid = false;
        
        switch (coupon.type) {
          case 'global':
            isValid = true;
            break;
            
          case 'category':
            isValid = !!(categoryId && coupon.categories?.includes(categoryId));
            break;
            
          case 'subcategory':
            isValid = !!(subcategoryId && coupon.subcategories?.includes(subcategoryId));
            break;
            
          case 'product':
            isValid = !!(productId && coupon.products?.includes(productId));
            break;
            
          case 'multiple':
            // Para múltiples, en checkout asumimos que es válido
            // La validación específica se hará con los productos del carrito
            isValid = true;
            break;
            
          default:
            isValid = false;
        }

        if (!isValid) {
          return { valid: false, message: "Cupón no válido para este producto" };
        }

        return { valid: true, coupon };
      },

      getHighestDiscountCoupon: () => {
        const { coupons } = get();
        const now = new Date();
        
        const activeCoupons = coupons.filter(coupon => 
          coupon.isActive && 
          new Date(coupon.expirationDate) > now &&
          coupon.currentUses < coupon.maxUses
        );

        if (activeCoupons.length === 0) return null;

        const highestCoupon = activeCoupons.reduce((max, current) => 
          current.discountPercentage > max.discountPercentage ? current : max
        );

        return highestCoupon;
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'coupon-store',
      version: 1,
      partialize: (state) => ({ 
        coupons: state.coupons,
      }),
    }
  )
);