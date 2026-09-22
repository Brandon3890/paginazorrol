export function normalizeFilename(filename: string): string {
  if (!filename) return '';
  
  // Descomponer caracteres Unicode (ñ → n + ̃, á → a + ́)
  const normalized = filename.normalize('NFD');
  
  // Eliminar los diacríticos (tildes, virgulillas, etc.)
  const withoutDiacritics = normalized.replace(/[\u0300-\u036f]/g, '');
  
  // Convertir a minúsculas
  const lowercased = withoutDiacritics.toLowerCase();
  
  // Reemplazar caracteres no permitidos por guiones
  // letras (a-z), números (0-9), guiones (-), puntos (.), guiones bajos (_)
  const clean = lowercased.replace(/[^a-z0-9._-]/g, '-');
  
  // Eliminar guiones múltiples y guiones al inicio/final
  const final = clean
    .replace(/-+/g, '-')      // Múltiples guiones → un solo guión
    .replace(/^[-_]+/, '')    // Eliminar guiones al inicio
    .replace(/[-_]+$/, '');   // Eliminar guiones al final
  
  return final || 'unknown';
}


export function normalizeProductName(name: string): string {
  if (!name) return 'producto';
  
  // Normalizar y luego reemplazar espacios
  const normalized = normalizeFilename(name);
  
  // Reemplazar espacios con guiones (por si quedaron)
  return normalized.replace(/\s+/g, '-');
}


export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot + 1);
}


export function generateUniqueFilename(baseName: string, extension: string): string {
  const normalized = normalizeFilename(baseName);
  const timestamp = Date.now();
  return `${normalized}-${timestamp}.${extension}`;
}


export function generateProductSlug(name: string): string {
  if (!name) return 'producto';
  
 
  let slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')     
    .trim()
    .replace(/\s+/g, '-')              
    .replace(/-+/g, '-');              
  
  slug = slug.replace(/^-+|-+$/g, '');
  
  return slug || 'producto';
}