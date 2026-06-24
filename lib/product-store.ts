import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  subcategory: string;
  categoryId: number;
  subcategoryId: number;
  subcategoryIds: string[];
  subcategories: any[];
  stock: number;
  inStock: boolean;
  isActive: boolean;
  additionalImages: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface ProductStore {
  products: Product[];
  loading: boolean;
  error: string | null;
  version: number;
  globalSearchQuery: string;

  setGlobalSearchQuery: (query: string) => void;
  fetchProducts: (options?: { includeInactive?: boolean; isAdmin?: boolean; force?: boolean }) => Promise<void>;
  fetchProduct: (id: number) => Promise<Product | null>;

  addProduct: (formData: FormData) => Promise<void>;
  updateProduct: (id: number, formData: FormData) => Promise<void>;
  deactivateProduct: (id: number) => Promise<void>;
  reactivateProduct: (id: number) => Promise<void>;
  permanentlyDeleteProduct: (id: number) => Promise<void>;

  clearError: () => void;
  incrementVersion: () => void;
}

const normalizeTags = (tags: any): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(t => String(t).toLowerCase());
  if (typeof tags === 'string') return tags.split(',').map(t => t.trim().toLowerCase());
  return [];
};

/* =========================
   ❌ CACHE DESACTIVADO (IMPORTANTE)
   ========================= */

// Puedes activarlo después si quieres, pero ahora lo dejamos limpio
const CACHE_ENABLED = false;

const CACHE_KEY = 'products_cache';

function getCachedProducts(): any[] | null {
  if (!CACHE_ENABLED || typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function setCachedProducts(products: any[]) {
  if (!CACHE_ENABLED || typeof window === 'undefined') return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(products));
}

function invalidateCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CACHE_KEY);
}

/* ========================= */

export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: [],
      loading: false,
      error: null,
      version: 0,
      globalSearchQuery: "",

      setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),

      /* =========================
         🔥 FIX PRINCIPAL AQUÍ
         ========================= */
      fetchProducts: async (options = {}) => {
        const { includeInactive = false, isAdmin = false, force = true } = options;

        set({ loading: true, error: null });

        try {
          // ❌ cache desactivado por defecto
          if (!force) {
            const cached = getCachedProducts();
            if (cached) {
              set({ products: cached, loading: false });
              return;
            }
          }

          const params = new URLSearchParams();
          if (includeInactive || isAdmin) params.append('includeInactive', 'true');
          if (isAdmin) params.append('admin', 'true');

          const url = `/api/products?${params.toString()}&_=${Date.now()}`;

          const res = await fetch(url, {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache"
            }
          });

          if (!res.ok) throw new Error("Error cargando productos");

          const data = await res.json();

          const products = data.map((p: any) => ({
            ...p,
            tags: normalizeTags(p.tags),
            isActive: p.isActive ?? true
          }));

          set({ products, loading: false });

          setCachedProducts(products);

        } catch (err: any) {
          set({ error: err.message, loading: false });
        }
      },

      fetchProduct: async (id: number) => {
        try {
          const res = await fetch(`/api/products/${id}?_=${Date.now()}`, {
            cache: "no-store"
          });

          if (!res.ok) throw new Error("Error");

          const product = await res.json();

          set(state => {
            const updated = [...state.products];
            const index = updated.findIndex(p => p.id === id);
            if (index >= 0) updated[index] = product;
            return { products: updated };
          });

          return product;
        } catch {
          return null;
        }
      },

      addProduct: async (formData) => {
        await fetch("/api/products", { method: "POST", body: formData });

        invalidateCache();
        await get().fetchProducts({ force: true });
      },

      updateProduct: async (id, formData) => {
        await fetch(`/api/products/${id}`, { method: "PUT", body: formData });

        invalidateCache();
        await get().fetchProducts({ force: true });
      },

      deactivateProduct: async (id) => {
        await fetch(`/api/products/${id}`, { method: "DELETE" });

        invalidateCache();

        set(state => ({
          products: state.products.map(p =>
            p.id === id ? { ...p, isActive: false } : p
          )
        }));
      },

      reactivateProduct: async (id) => {
        await fetch(`/api/products/${id}/reactivate`, { method: "PUT" });

        invalidateCache();

        set(state => ({
          products: state.products.map(p =>
            p.id === id ? { ...p, isActive: true } : p
          )
        }));
      },

      permanentlyDeleteProduct: async (id) => {
        await fetch(`/api/products/${id}/permanent`, { method: "DELETE" });

        invalidateCache();

        set(state => ({
          products: state.products.filter(p => p.id !== id)
        }));
      },

      clearError: () => set({ error: null }),

      incrementVersion: () =>
        set(state => ({ version: state.version + 1 }))
    }),
    {
      name: "product-store",
      partialize: (state) => ({
        globalSearchQuery: state.globalSearchQuery
      })
    }
  )
);