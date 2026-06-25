// lib/normalize-filename.ts

/**
 * Normaliza un nombre de archivo eliminando caracteres especiales
 * Convierte: "Camión" → "camion", "Niño" → "nino", "España" → "espana"
 * Mantiene solo letras (a-z), números (0-9), guiones y puntos
 */
export function normalizeFilename(filename: string): string {
  if (!filename) return '';
  
  // 1. Descomponer caracteres Unicode (ñ → n + ̃, á → a + ́)
  const normalized = filename.normalize('NFD');
  
  // 2. Eliminar los diacríticos (tildes, virgulillas, etc.)
  const withoutDiacritics = normalized.replace(/[\u0300-\u036f]/g, '');
  
  // 3. Convertir a minúsculas
  const lowercased = withoutDiacritics.toLowerCase();
  
  // 4. Reemplazar caracteres no permitidos por guiones
  // Permite: letras (a-z), números (0-9), guiones (-), puntos (.), guiones bajos (_)
  const clean = lowercased.replace(/[^a-z0-9._-]/g, '-');
  
  // 5. Eliminar guiones múltiples y guiones al inicio/final
  const final = clean
    .replace(/-+/g, '-')      // Múltiples guiones → un solo guión
    .replace(/^[-_]+/, '')    // Eliminar guiones al inicio
    .replace(/[-_]+$/, '');   // Eliminar guiones al final
  
  return final || 'unknown';
}

/**
 * Normaliza un nombre de producto para usarlo como slug y en nombres de archivos
 */
export function normalizeProductName(name: string): string {
  if (!name) return 'producto';
  
  // Normalizar y luego reemplazar espacios
  const normalized = normalizeFilename(name);
  
  // Reemplazar espacios con guiones (por si quedaron)
  return normalized.replace(/\s+/g, '-');
}

/**
 * Obtiene la extensión de un archivo
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot + 1);
}

/**
 * Genera un nombre de archivo único con timestamp
 */
export function generateUniqueFilename(baseName: string, extension: string): string {
  const normalized = normalizeFilename(baseName);
  const timestamp = Date.now();
  return `${normalized}-${timestamp}.${extension}`;
}