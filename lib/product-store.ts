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
  specs: string | null;
  createdAt: string;
  updatedAt: string;
  weight: number;
  height: number;
  width: number;
  length: number;
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
  fetchProduct: (id: number, force?: boolean) => Promise<Product | null>;
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
  getSortedProducts: () => Product[];
  forceRefresh: () => Promise<void>;
}

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

const isProductOutOfStock = (product: Product): boolean => {
  return !product.inStock || product.stock <= 0;
};

const getProductPriority = (product: Product): number => {
  if (isProductOutOfStock(product)) {
    return 100;
  }
  if (product.tags && product.tags.includes('preventa')) {
    return 1;
  }
  if (product.originalPrice && product.originalPrice > product.price) {
    return 2;
  }
  if (product.tags && product.tags.includes('novedad')) {
    return 3;
  }
  return 4;
};

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
    genre: product.genre || 'Estrategia, Familiar',
    specs: product.specs || null,
    weight: product.weight ?? 0.5,
    height: product.height ?? 10,
    width: product.width ?? 15,
    length: product.length ?? 20,
  }));
  
  console.log('Cleaned', cleanedProducts.length, 'valid products');
  
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
    (set, get) => {
      // Set para rastrear productos que están siendo cargados
      const fetchingProductIds = new Set<number>();
      // Set para rastrear si ya hay una solicitud de fetchProducts en curso
      let isFetchingProducts = false;

      return {
        products: [],
        loading: false,
        productsLoaded: false,
        error: null,
        version: 0,
        globalSearchQuery: "",
        
        setGlobalSearchQuery: (query) => {
          set({ globalSearchQuery: query });
        },
        
        forceRefresh: async () => {
          console.log('🔄 Force refresh products...');
          set({ productsLoaded: false });
          await get().fetchProducts({ includeInactive: true, isAdmin: true, force: true });
        },
        
        fetchProducts: async (options = {}) => {
          const { includeInactive = false, isAdmin = false, force = false } = options;
          
          if (get().productsLoaded && !force) {
            console.log('📦 Using cached products (not forcing refresh)');
            return;
          }

          // Evitar múltiples solicitudes simultáneas
          if (isFetchingProducts) {
            console.log('⏳ Ya hay una solicitud de productos en curso, esperando...');
            return new Promise((resolve) => {
              const checkInterval = setInterval(() => {
                if (!isFetchingProducts) {
                  clearInterval(checkInterval);
                  resolve(undefined);
                }
              }, 100);
            });
          }
          
          isFetchingProducts = true;
          set({ loading: true, error: null });
          
          try {
            const params = new URLSearchParams();
            if (isAdmin || includeInactive) {
              params.append('includeInactive', 'true');
            }
            if (isAdmin) {
              params.append('admin', 'true');
            }
            
            const url = `/api/products?${params.toString()}&_=${Date.now()}`;
            console.log('🌐 Fetching products from:', url);
            
            const response = await fetch(url, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
            
            if (!response.ok) {
              if (response.status === 429) {
                console.warn('⚠️ Rate limit exceeded, retrying in 3 seconds...');
                // Esperar 3 segundos y reintentar
                await new Promise(resolve => setTimeout(resolve, 3000));
                return get().fetchProducts({ ...options, force: true });
              }
              throw new Error(`Error fetching products: ${response.status}`);
            }
            
            const productsData = await response.json();
            console.log(`📦 Received ${productsData.length} products from API`);
            
            const normalizedProducts = productsData.map((product: any) => ({
              ...product,
              tags: normalizeTags(product.tags || product.tagsRaw),
              brand: product.brand || 'Devir',
              genre: product.genre || 'Estrategia, Familiar',
              specs: product.specs || null,
              weight: product.weight ?? 0.5,
              height: product.height ?? 10,
              width: product.width ?? 15,
              length: product.length ?? 20,
            }));
            
            const validProducts = Array.isArray(normalizedProducts) ? normalizedProducts : [];
            
            set({ 
              products: validProducts, 
              productsLoaded: true,
              loading: false, 
              error: null 
            });
            
            console.log(`✅ ${validProducts.length} products loaded in store`);
            
          } catch (error) {
            console.error('Error in fetchProducts:', error);
            set({ 
              error: error instanceof Error ? error.message : 'Error al cargar productos', 
              loading: false 
            });
          } finally {
            isFetchingProducts = false;
          }
        },

        fetchProduct: async (id: number, force: boolean = false) => {
          // Si el producto ya está siendo cargado, esperar
          if (fetchingProductIds.has(id)) {
            console.log(`⏳ Producto ${id} ya está siendo cargado, esperando...`);
            return new Promise((resolve) => {
              const checkInterval = setInterval(() => {
                if (!fetchingProductIds.has(id)) {
                  clearInterval(checkInterval);
                  // Intentar obtener el producto del caché después de que termine la carga
                  const cached = get().products.find(p => p.id === id);
                  resolve(cached || null);
                }
              }, 100);
            });
          }

          // Si no se fuerza y el producto existe en caché, devolverlo
          if (!force) {
            const existing = get().products.find(p => p.id === id);
            if (existing) {
              console.log(`📦 Returning cached product: ${existing.name}`);
              return existing;
            }
          }
          
          // Marcar que este producto está siendo cargado
          fetchingProductIds.add(id);
          
          try {
            const url = `/api/products/${id}?_=${Date.now()}`;
            console.log('🌐 Fetching product from:', url);
            
            const response = await fetch(url, {
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            });
            
            if (!response.ok) {
              if (response.status === 429) {
                console.warn(`⚠️ Rate limit exceeded for product ${id}, retrying in 3 seconds...`);
                // Esperar 3 segundos y reintentar
                await new Promise(resolve => setTimeout(resolve, 3000));
                fetchingProductIds.delete(id);
                return get().fetchProduct(id, true);
              }
              const text = await response.text();
              console.error('❌ Error response:', text);
              throw new Error(`Error fetching product: ${response.status}`);
            }
            
            const product = await response.json();
            console.log(`📦 Received product: ${product.name}`);
            console.log(`📸 Image: ${product.image}`);
            console.log(`📸 Additional images: ${product.additionalImages?.length || 0}`);
            console.log(`📋 Specs:`, product.specs);
            
            const normalizedProduct = {
              ...product,
              tags: normalizeTags(product.tags || product.tagsRaw),
              brand: product.brand || 'Devir',
              genre: product.genre || 'Estrategia, Familiar',
              specs: product.specs || null,
              weight: product.weight ?? 0.5,
              height: product.height ?? 10,
              width: product.width ?? 15,
              length: product.length ?? 20,
            };
            
            set(state => {
              const existingProductIndex = state.products.findIndex(p => p.id === id);
              if (existingProductIndex >= 0) {
                const newProducts = [...state.products];
                newProducts[existingProductIndex] = normalizedProduct;
                return { products: newProducts };
              }
              return { products: [...state.products, normalizedProduct] };
            });
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('product-updated', { 
                detail: { productId: id }
              }));
            }
            
            return normalizedProduct;
          } catch (error) {
            console.error('❌ Error fetching product:', error);
            set({ 
              error: error instanceof Error ? error.message : 'Error al cargar el producto' 
            });
            return null;
          } finally {
            fetchingProductIds.delete(id);
          }
        },

        incrementVersion: () => {
          set(state => ({ version: state.version + 1 }));
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

        getSortedProducts: () => {
          const { products } = get();
          const activeProducts = products.filter(p => p.isActive);
          return [...activeProducts].sort((a, b) => {
            const priorityA = getProductPriority(a);
            const priorityB = getProductPriority(b);
            return priorityA - priorityB;
          });
        },

        addProduct: async (formData: FormData) => {
          try {
            console.log('➕ Creating product...');
            const response = await fetch('/api/products', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Error creating product');
            }
            
            const result = await response.json();
            console.log('✅ Product created with ID:', result.id);
            
            // Esperar un poco antes de recargar para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            await get().fetchProducts({ includeInactive: true, isAdmin: true, force: true });
            get().incrementVersion();
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('product-updated'));
            }
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error al crear el producto';
            set({ error: errorMessage });
            throw error;
          }
        },

        updateProduct: async (id: number, formData: FormData) => {
          try {
            console.log(`✏️ Updating product ${id}...`);
            const response = await fetch(`/api/products/${id}`, {
              method: 'PUT',
              body: formData,
            });

            if (!response.ok) {
              const text = await response.text();
              console.error('❌ Error response:', text);
              let errorData;
              try {
                errorData = JSON.parse(text);
              } catch {
                errorData = { error: text || 'Error desconocido' };
              }
              throw new Error(errorData.error || 'Error updating product');
            }
            
            console.log('✅ Product updated successfully');
            
            // Esperar un poco antes de recargar para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            await get().fetchProduct(id, true);
            await get().fetchProducts({ includeInactive: true, isAdmin: true, force: true });
            get().incrementVersion();
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('product-updated', { 
                detail: { productId: id }
              }));
            }
            
          } catch (error) {
            console.error('❌ Error en updateProduct:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error al actualizar el producto';
            set({ error: errorMessage });
            throw error;
          }
        },

        deactivateProduct: async (id: number) => {
          try {
            console.log(`🗑️ Deactivating product ${id}...`);
            const response = await fetch(`/api/products/${id}`, {
              method: 'DELETE',
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Error deactivating product');
            }
            
            console.log('✅ Product deactivated');
            
            // Esperar un poco antes de recargar para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            await get().fetchProducts({ includeInactive: true, isAdmin: true, force: true });
            get().incrementVersion();
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('product-updated'));
            }
            
          } catch (error) {
            console.error(`Error deactivating product ${id}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Error al desactivar el producto';
            set({ error: errorMessage });
            throw error;
          }
        },

        reactivateProduct: async (id: number) => {
          try {
            console.log(`🔄 Reactivating product ${id}...`);
            const response = await fetch(`/api/products/${id}/reactivate`, {
              method: 'PUT',
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Error reactivating product');
            }
            
            console.log('✅ Product reactivated');
            
            // Esperar un poco antes de recargar para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            await get().fetchProducts({ includeInactive: true, isAdmin: true, force: true });
            get().incrementVersion();
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('product-updated'));
            }
            
          } catch (error) {
            console.error(`Error reactivating product ${id}:`, error);
            const errorMessage = error instanceof Error ? error.message : 'Error al reactivar el producto';
            set({ error: errorMessage });
            throw error;
          }
        },

        permanentlyDeleteProduct: async (id: number) => {
          try {
            console.log(`💀 Permanently deleting product ${id}...`);
            const response = await fetch(`/api/products/${id}/permanent`, {
              method: 'DELETE',
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Error deleting product permanently');
            }
            
            console.log('✅ Product permanently deleted');
            
            // Esperar un poco antes de recargar para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            await get().fetchProducts({ includeInactive: true, isAdmin: true, force: true });
            get().incrementVersion();
            
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('product-updated'));
            }
            
          } catch (error) {
            console.error(`Error permanently deleting product ${id}:`, error);
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
      };
    },
    {
      name: 'product-store',
      version: 6,
      migrate: migrateStore,
      partialize: (state) => ({ 
        version: state.version,
        globalSearchQuery: state.globalSearchQuery
      }),
    }
  )
);

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