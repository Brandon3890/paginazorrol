// lib/product-specs.ts

export interface ProductSpec {
  label: string;
  value: string;
}

export function parseProductSpecs(specsJson: string | null): ProductSpec[] {
  if (!specsJson) return [];
  
  try {
    const parsed = JSON.parse(specsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => 
        item && 
        typeof item === 'object' && 
        typeof item.label === 'string' && 
        typeof item.value === 'string' &&
        item.label.trim() !== '' &&
        item.value.trim() !== ''
      );
    }
    return [];
  } catch {
    return [];
  }
}

export function stringifyProductSpecs(specs: ProductSpec[]): string {
  if (!specs || specs.length === 0) return '';
  return JSON.stringify(specs);
}