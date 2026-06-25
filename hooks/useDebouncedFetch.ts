// hooks/useDebouncedFetch.ts
import { useRef, useCallback } from 'react';

export function useDebouncedFetch<T>(
  fetchFn: () => Promise<T>,
  delay: number = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPendingRef = useRef(false);

  const debouncedFetch = useCallback(() => {
    if (isPendingRef.current) {
      console.log('⏳ Solicitud ya en progreso, ignorando...');
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    isPendingRef.current = true;

    timeoutRef.current = setTimeout(async () => {
      try {
        await fetchFn();
      } catch (error) {
        console.error('Error en fetch:', error);
      } finally {
        isPendingRef.current = false;
        timeoutRef.current = null;
      }
    }, delay);
  }, [fetchFn, delay]);

  return debouncedFetch;
}