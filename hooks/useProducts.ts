// hooks/useProducts.ts
import { useProductStore } from '@/lib/product-store';

export const useProducts = (options?: { perPage?: number }) => {
  const { products, loading, error, fetchProducts } = useProductStore();
  
  return {
    products,
    loading,
    error,
    fetchProducts,
    refetch: () => fetchProducts({ includeInactive: false, isAdmin: false })
  };
};