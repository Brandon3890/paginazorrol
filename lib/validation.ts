import { z } from 'zod'

// Esquemas de validación comunes
export const loginSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .min(1, 'Email es requerido')
    .max(255, 'Email demasiado largo')
    .transform(email => email.toLowerCase().trim()),
  password: z.string()
    .min(6, 'Mínimo 6 caracteres')
    .max(100, 'Máximo 100 caracteres')
    .regex(/^(?=.*[a-zA-Z])(?=.*\d)/, 'Debe contener letras y números'),
})

export const registerSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email es requerido'),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(100),
  firstName: z.string().min(1, 'Nombre es requerido').max(100),
  lastName: z.string().min(1, 'Apellido es requerido').max(100),
  phone: z.string().optional(),
})

export const productSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(255),
  price: z.number().min(0, 'Precio debe ser positivo').max(999999.99),
  description: z.string().max(2000).optional(),
  category_id: z.number().int().positive('Categoría inválida'),
})

// Sanitización básica
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remover < y >
    .trim()
    .substring(0, 1000) // Limitar longitud
}

export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

// Validación de archivos
export function validateFile(file: File): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const maxSize = 5 * 1024 * 1024 // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

  if (!allowedTypes.includes(file.type)) {
    errors.push('Tipo de archivo no permitido. Use JPEG, PNG, WebP o GIF.')
  }

  if (file.size > maxSize) {
    errors.push('Archivo demasiado grande. Máximo 5MB.')
  }

  if (file.name.length > 255) {
    errors.push('Nombre de archivo demasiado largo.')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}