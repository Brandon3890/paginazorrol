import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Product {
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
  subcategories: Array<{
    id: number;
    name: string;
    slug: string;
    isPrimary: boolean;
    displayOrder: number;
  }>;
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
  tags: { id: number; name: string; slug: string }[];
  createdAt: string;
  updatedAt: string;
}

interface ProductStore {
  products: Product[];
  loading: boolean;
  error: string | null;
  fetchProducts: (options?: { includeInactive?: boolean; isAdmin?: boolean }) => Promise<void>;
  fetchProduct: (id: number) => Promise<Product | null>;
  addProduct: (formData: FormData) => Promise<void>;
  updateProduct: (id: number, formData: FormData) => Promise<void>;
  deactivateProduct: (id: number) => Promise<void>;
  reactivateProduct: (id: number) => Promise<void>;
  permanentlyDeleteProduct: (id: number) => Promise<void>;
  clearError: () => void;
  getProductCategories: (productId: number) => {
    category: string;
    subcategories: string[];
    primarySubcategory: string;
  } | null;
  getProductsByCategory: (categoryId: number) => Product[];
  getProductsBySubcategory: (subcategoryId: number) => Product[];
}

// Función de migración para limpiar datos corruptos
const migrateStore = (persistedState: any, version: number) => {
  console.log('🔄 Migrating store from version:', version);
  
  if (!persistedState || typeof persistedState !== 'object') {
    console.log('🔄 No persisted state or corrupted, returning initial state');
    return { products: [] };
  }
  
  if (!Array.isArray(persistedState.products)) {
    console.log('🔄 Products is not an array, cleaning...');
    return { 
      ...persistedState,
      products: [] 
    };
  }
  
  const cleanedProducts = persistedState.products.filter((product: any) => {
    return product && 
           typeof product === 'object' && 
           product.id && 
           product.name;
  });
  
  console.log(`🔄 Cleaned ${cleanedProducts.length} valid products`);
  
  return {
    ...persistedState,
    products: cleanedProducts
  };
};

export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: [],
      loading: false,
      error: null,

      fetchProducts: async (options = {}) => {
        const { includeInactive = false, isAdmin = false } = options;
        
        set({ loading: true, error: null });
        try {
          console.log('🔄 Fetching products from API...', { includeInactive, isAdmin });
          
          // Construir URL con parámetros - FIX: Siempre incluir includeInactive=true para admin
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
          
          const products = await response.json();
          console.log('✅ Products fetched successfully:', products.length, 'products');
          
          const validProducts = Array.isArray(products) ? products : [];
          console.log('✅ Valid products:', validProducts.length);
          
          // Contar productos activos e inactivos para debug
          const activeProducts = validProducts.filter(p => p.isActive);
          const inactiveProducts = validProducts.filter(p => !p.isActive);
          console.log(`📊 Active: ${activeProducts.length}, Inactive: ${inactiveProducts.length}`);
          
          // Debug: mostrar IDs de productos inactivos
          if (inactiveProducts.length > 0) {
            console.log('📋 Inactive product IDs:', inactiveProducts.map(p => p.id));
          }
          
          set({ 
            products: validProducts, 
            loading: false, 
            error: null 
          });
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
          console.log(`✅ Product ${id} fetched successfully:`, {
            name: product.name,
            categoryId: product.categoryId,
            subcategoryIds: product.subcategoryIds,
            mainImage: product.image,
            additionalImagesCount: product.additionalImages?.length || 0,
            isActive: product.isActive
          });
          
          return product;
        } catch (error) {
          console.error('Error fetching product:', error);
          set({ 
            error: error instanceof Error ? error.message : 'Error al cargar el producto' 
          });
          return null;
        }
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
          
          // Recargar productos después de crear uno nuevo - FIX: Usar parámetros para admin
          await get().fetchProducts({ includeInactive: true, isAdmin: true });
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
          
          // Recargar TODOS los productos para asegurar consistencia - FIX: Usar parámetros para admin
          console.log('🔄 Recargando productos después de actualizar...');
          await get().fetchProducts({ includeInactive: true, isAdmin: true });
          
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
        
        // Actualizar estado local inmediatamente
        console.log(`🔄 Updating local state for product ${id}...`);
        set(state => ({
          products: state.products.map(p =>
            p.id === id ? { ...p, isActive: false } : p
          )
        }));
        
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
        
        // Actualizar estado local inmediatamente
        console.log(`🔄 Updating local state for product ${id}...`);
        set(state => ({
          products: state.products.map(p =>
            p.id === id ? { ...p, isActive: true } : p
          )
        }));
        
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
          
          // Eliminar del estado local inmediatamente
          console.log(`🔄 Removing product ${id} from local state...`);
          set(state => ({
            products: state.products.filter(p => p.id !== id)
          }));
          
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

        // Obtener todas las subcategorías del producto
        const subcategories = product.subcategoriesData || product.subcategories || [];
        const subcategoryNames = subcategories.map(sub => sub.name);
        
        // Encontrar la subcategoría principal
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
      version: 1,
      migrate: migrateStore,
      partialize: (state) => ({ 
        products: state.products,
      }),
    }
  )
);

// Hook personalizado para usar las categorías y subcategorías de productos
export const useProductCategories = () => {
  const { products, getProductCategories, getProductsByCategory, getProductsBySubcategory } = useProductStore();

  // Obtener todas las categorías únicas de los productos ACTIVOS
  const getAllCategories = () => {
    const categories = products
      .filter(product => product.isActive)
      .map(product => ({
        id: product.categoryId,
        name: product.category,
        productCount: products.filter(p => p.categoryId === product.categoryId && p.isActive).length
      }));

    // Eliminar duplicados
    return categories.filter((category, index, self) => 
      index === self.findIndex(c => c.id === category.id)
    );
  };

  // Obtener todas las subcategorías únicas de los productos ACTIVOS
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

  // Obtener productos con información completa de categorías y subcategorías
  const getProductsWithCategoryInfo = () => {
    return products.map(product => ({
      ...product,
      // Información completa de categoría
      categoryInfo: {
        id: product.categoryId,
        name: product.category
      },
      // Información completa de subcategorías
      subcategoriesInfo: (product.subcategoriesData || product.subcategories || []).map(sub => ({
        id: sub.id,
        name: sub.name,
        isPrimary: sub.isPrimary,
        displayOrder: sub.displayOrder
      })),
      // Subcategoría principal
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