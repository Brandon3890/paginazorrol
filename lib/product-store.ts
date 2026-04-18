// lib/product-store.ts
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
  youtubeVideoId?: string;
  category: string;
  subcategory: string;
  categoryId: number;
  subcategoryId: number;
  subcategoryIds: string[];
  subcategories: Array<{
    id: number;
    name: string;
    slug: string;
    isPrimary: boolean;
    displayOrder: number;
  }>;
  recommendedProducts?: number[];
  ageMin: number;
  age: string;
  playersMin: number;
  playersMax: number;
  players: string;
  durationMin: number;
  duration: string;
  categoryData?: {
    id: number;
    name: string;
    slug: string;
    description?: string;
  };
  subcategoriesData?: Array<{
    id: number;
    name: string;
    slug: string;
    description?: string;
    isPrimary: boolean;
    displayOrder: number;
  }>;
  stock: number;
  inStock: boolean;
  isOnSale: boolean;
  isActive: boolean;
  additionalImages: string[];
  tags: string[];
  tagsRaw?: string;
  brand: string;
  genre: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductStore {
  products: Product[];
  loading: boolean;
  productsLoaded: boolean;
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
  getProductCategories: (productId: number) => {
    category: string;
    subcategories: string[];
    primarySubcategory: string;
  } | null;
  getProductsByCategory: (categoryId: number) => Product[];
  getProductsBySubcategory: (subcategoryId: number) => Product[];
  getRecommendedProducts: (productId: number) => Product[];  
}

// Función para normalizar tags desde la DB
const normalizeTags = (tags: any): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map(t => {
      if (typeof t === 'string') return t.toLowerCase();
      if (t && typeof t === 'object') return (t.name || t.slug || '').toLowerCase();
      return '';
    }).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }
  if (typeof tags === 'object' && tags !== null) {
    if (tags.name) return [tags.name.toLowerCase()];
    if (tags.slug) return [tags.slug.toLowerCase()];
  }
  return [];
};

// Función de migración para limpiar datos corruptos
const migrateStore = (persistedState: any, version: number) => {
  console.log('Migrating store from version:', version);
  
  if (!persistedState || typeof persistedState !== 'object') {
    console.log('No persisted state or corrupted, returning initial state');
    return { products: [], productsLoaded: false, version: 0, globalSearchQuery: "" };
  }
  
  if (!Array.isArray(persistedState.products)) {
    console.log('Products is not an array, cleaning...');
    return { 
      ...persistedState,
      products: [],
      productsLoaded: false,
      version: persistedState.version || 0,
      globalSearchQuery: persistedState.globalSearchQuery || ""
    };
  }
  
  const cleanedProducts = persistedState.products.filter((product: any) => {
    return product && 
           typeof product === 'object' && 
           product.id && 
           product.name;
  }).map((product: any) => ({
    ...product,
    tags: normalizeTags(product.tags || product.tagsRaw),
    brand: product.brand || 'Devir',
    genre: product.genre || 'Estrategia, Familiar'
  }));
  
  console.log(`🔄 Cleaned ${cleanedProducts.length} valid products`);
  
  return {
    ...persistedState,
    products: cleanedProducts,
    productsLoaded: persistedState.productsLoaded || false,
    version: persistedState.version || 0,
    globalSearchQuery: persistedState.globalSearchQuery || ""
  };
};

export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: [],
      loading: false,
      productsLoaded: false,
      error: null,
      version: 0,
      globalSearchQuery: "",
      
      setGlobalSearchQuery: (query) => {
        set({ globalSearchQuery: query });
        console.log('🔍 Búsqueda global actualizada:', query);
      },
      
      fetchProducts: async (options = {}) => {
        const { includeInactive = false, isAdmin = false, force = false } = options;
        
        if (get().productsLoaded && !force) {
          console.log('Products already loaded, skipping fetch');
          return;
        }
        
        set({ loading: true, error: null });
        try {
          console.log('Fetching products from API...', { includeInactive, isAdmin, force });
          
          const params = new URLSearchParams();
          if (isAdmin || includeInactive) {
            params.append('includeInactive', 'true');
          }
          if (isAdmin) {
            params.append('admin', 'true');
          }
          
          const url = `/api/products?${params.toString()}`;
          console.log('📡 Fetching from:', url);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ API response not OK:', response.status, errorText);
            throw new Error(`Error fetching products: ${response.status} ${response.statusText}`);
          }
          
          const productsData = await response.json();
          console.log('✅ Products fetched successfully:', productsData.length, 'products');
          
          // Normalizar los tags y añadir brand/genre de cada producto
          const normalizedProducts = productsData.map((product: any) => ({
            ...product,
            tags: normalizeTags(product.tags || product.tagsRaw),
            brand: product.brand || 'Devir',
            genre: product.genre || 'Estrategia, Familiar'
          }));
          
          console.log('🏷️ Tags normalizados:', normalizedProducts.map((p: any) => ({ name: p.name, tags: p.tags })));
          
          const validProducts = Array.isArray(normalizedProducts) ? normalizedProducts : [];
          
          set({ 
            products: validProducts, 
            productsLoaded: true,
            loading: false, 
            error: null 
          });
          
          console.log('📦 Store updated with', validProducts.length, 'products');
        } catch (error) {
          console.error('❌ Error in fetchProducts:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Error al cargar productos', 
            loading: false 
          });
        }
      },

      fetchProduct: async (id: number) => {
        try {
          console.log(`🔄 Fetching individual product ${id} from API...`);
          const response = await fetch(`/api/products/${id}`);
          if (!response.ok) {
            throw new Error(`Error fetching product: ${response.status}`);
          }
          
          const product = await response.json();
          // Normalizar tags del producto individual
          const normalizedProduct = {
            ...product,
            tags: normalizeTags(product.tags || product.tagsRaw),
            brand: product.brand || 'Devir',
            genre: product.genre || 'Estrategia, Familiar'
          };
          
          console.log(`✅ Product ${id} fetched successfully:`, {
            name: normalizedProduct.name,
            tags: normalizedProduct.tags,
            brand: normalizedProduct.brand,
            genre: normalizedProduct.genre
          });
          
          set(state => {
            const existingProductIndex = state.products.findIndex(p => p.id === id);
            if (existingProductIndex >= 0) {
              const newProducts = [...state.products];
              newProducts[existingProductIndex] = normalizedProduct;
              return { products: newProducts };
            }
            return state;
          });
          
          return normalizedProduct;
        } catch (error) {
          console.error('Error fetching product:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Error al cargar el producto' 
          });
          return null;
        }
      },

      incrementVersion: () => {
        set(state => ({ version: state.version + 1 }));
        console.log('📢 Versión incrementada:', get().version);
      },

      getRecommendedProducts: (productId: number) => {
        const { products } = get();
        const product = products.find(p => p.id === productId);
        
        if (!product || !product.recommendedProducts || product.recommendedProducts.length === 0) {
          return [];
        }
        
        return products.filter(p => 
          product.recommendedProducts?.includes(p.id) && p.isActive
        );
      },

      addProduct: async (formData: FormData) => {
        try {
          const response = await fetch('/api/products', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error creating product');
          }
          
          await get().fetchProducts({ includeInactive: true, isAdmin: true, force: true });
          get().incrementVersion();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al crear el producto';
          set({ error: errorMessage });
          throw error;
        }
      },

      updateProduct: async (id: number, formData: FormData) => {
        try {
          const response = await fetch(`/api/products/${id}`, {
            method: 'PUT',
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error updating product');
          }
          
          console.log('🔄 Recargando productos después de actualizar...');
          await get().fetchProducts({ includeInactive: true, isAdmin: true, force: true });
          get().incrementVersion();
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error al actualizar el producto';
          set({ error: errorMessage });
          throw error;
        }
      },

      deactivateProduct: async (id: number) => {
        try {
          console.log(`🗑️ Attempting to deactivate product ${id}...`);
          const response = await fetch(`/api/products/${id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error deactivating product');
          }
          
          set(state => ({
            products: state.products.map(p =>
              p.id === id ? { ...p, isActive: false } : p
            )
          }));
          
          get().incrementVersion();
          console.log(`✅ Product ${id} deactivated successfully`);
          
        } catch (error) {
          console.error(`❌ Error deactivating product ${id}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Error al desactivar el producto';
          set({ error: errorMessage });
          throw error;
        }
      },

      reactivateProduct: async (id: number) => {
        try {
          console.log(`🔄 Attempting to reactivate product ${id}...`);
          const response = await fetch(`/api/products/${id}/reactivate`, {
            method: 'PUT',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error reactivating product');
          }
          
          set(state => ({
            products: state.products.map(p =>
              p.id === id ? { ...p, isActive: true } : p
            )
          }));
          
          get().incrementVersion();
          console.log(`✅ Product ${id} reactivated successfully`);
          
        } catch (error) {
          console.error(`❌ Error reactivating product ${id}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Error al reactivar el producto';
          set({ error: errorMessage });
          throw error;
        }
      },

      permanentlyDeleteProduct: async (id: number) => {
        try {
          console.log(`💀 Attempting to permanently delete product ${id}...`);
          const response = await fetch(`/api/products/${id}/permanent`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error deleting product permanently');
          }
          
          set(state => ({
            products: state.products.filter(p => p.id !== id)
          }));
          
          get().incrementVersion();
          console.log(`✅ Product ${id} permanently deleted from local state`);
          
        } catch (error) {
          console.error(`❌ Error permanently deleting product ${id}:`, error);
          const errorMessage = error instanceof Error ? error.message : 'Error al eliminar el producto';
          set({ error: errorMessage });
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      getProductCategories: (productId: number) => {
        const { products } = get();
        const product = products.find(p => p.id === productId);
        
        if (!product) {
          return null;
        }

        const subcategories = product.subcategoriesData || product.subcategories || [];
        const subcategoryNames = subcategories.map(sub => sub.name);
        
        const primarySubcategory = subcategories.find(sub => sub.isPrimary)?.name || 
                                 subcategories[0]?.name || 
                                 product.subcategory;

        return {
          category: product.category,
          subcategories: subcategoryNames,
          primarySubcategory: primarySubcategory
        };
      },

      getProductsByCategory: (categoryId: number) => {
        const { products } = get();
        return products.filter(product => product.categoryId === categoryId && product.isActive);
      },

      getProductsBySubcategory: (subcategoryId: number) => {
        const { products } = get();
        return products.filter(product => 
          product.subcategoryIds.includes(subcategoryId.toString()) && 
          product.isActive
        );
      }
    }),
    {
      name: 'product-store',
      version: 2,
      migrate: migrateStore,
      partialize: (state) => ({ 
        products: state.products,
        productsLoaded: state.productsLoaded,
        version: state.version,
        globalSearchQuery: state.globalSearchQuery
      }),
    }
  )
);

// Hook personalizado para categorías
export const useProductCategories = () => {
  const { products, getProductCategories, getProductsByCategory, getProductsBySubcategory } = useProductStore();

  const getAllCategories = () => {
    const categories = products
      .filter(product => product.isActive)
      .map(product => ({
        id: product.categoryId,
        name: product.category,
        productCount: products.filter(p => p.categoryId === product.categoryId && p.isActive).length
      }));

    return categories.filter((category, index, self) => 
      index === self.findIndex(c => c.id === category.id)
    );
  };

  const getAllSubcategories = () => {
    const allSubcategories: Array<{
      id: number;
      name: string;
      categoryId: number;
      categoryName: string;
      productCount: number;
    }> = [];

    products
      .filter(product => product.isActive)
      .forEach(product => {
        const subcategories = product.subcategoriesData || product.subcategories || [];
        
        subcategories.forEach(sub => {
          const existing = allSubcategories.find(s => s.id === sub.id);
          if (!existing) {
            allSubcategories.push({
              id: sub.id,
              name: sub.name,
              categoryId: product.categoryId,
              categoryName: product.category,
              productCount: products.filter(p => 
                p.subcategoryIds.includes(sub.id.toString()) && p.isActive
              ).length
            });
          }
        });
      });

    return allSubcategories;
  };

  const getProductsWithCategoryInfo = () => {
    return products.map(product => ({
      ...product,
      categoryInfo: {
        id: product.categoryId,
        name: product.category
      },
      subcategoriesInfo: (product.subcategoriesData || product.subcategories || []).map(sub => ({
        id: sub.id,
        name: sub.name,
        isPrimary: sub.isPrimary,
        displayOrder: sub.displayOrder
      })),
      primarySubcategory: (product.subcategoriesData || product.subcategories || [])
        .find(sub => sub.isPrimary)?.name || 
        (product.subcategoriesData || product.subcategories || [])[0]?.name || 
        product.subcategory
    }));
  };

  return {
    getAllCategories,
    getAllSubcategories,
    getProductsWithCategoryInfo,
    getProductCategories,
    getProductsByCategory,
    getProductsBySubcategory
  };
};