// lib/cache-utils.ts

const CACHE_KEY = 'products_cache';
const CACHE_TIMESTAMP_KEY = 'products_cache_timestamp';
const CACHE_DURATION = 2 * 60 * 1000; 

interface CacheData {
  products: any[];
  timestamp: number;
}

export function getCachedProducts(): any[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (!cached || !timestamp) return null;
    
    const now = Date.now();
    const cacheTime = parseInt(timestamp);
    
    // Si la caché expiró (más de 2 minutos)
    if (now - cacheTime > CACHE_DURATION) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      return null;
    }
    
    const data = JSON.parse(cached);
    console.log(` Usando caché de productos (${Math.round((now - cacheTime) / 1000)}s de antigüedad)`);
    return data;
  } catch (error) {
    console.error('Error leyendo caché:', error);
    return null;
  }
}

export function setCachedProducts(products: any[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(products));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, String(Date.now()));
    console.log('Productos guardados en caché');
  } catch (error) {
    console.error('Error guardando caché:', error);
  }
}

export function invalidateProductsCache(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  console.log('Caché de productos invalidada');
}

export function getCacheAge(): number | null {
  if (typeof window === 'undefined') return null;
  
  const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
  if (!timestamp) return null;
  
  return Date.now() - parseInt(timestamp);
}