export function cleanRut(rut: string): string {
  if (!rut) return ''
  return rut.replace(/[^0-9kK]/g, '').toUpperCase()
}

/**
 * Formatea el RUT con puntos y guion para MOSTRAR EN EL FRONTEND.
 */
export function formatRut(rut: string): string {
  if (!rut) return ''

  const clean = cleanRut(rut)
  if (clean.length < 2) return rut

  const cuerpo = clean.slice(0, -1)
  const dv = clean.slice(-1)

  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${cuerpoFormateado}-${dv}`
}

/**
 * Formatea el RUT MIENTRAS el usuario escribe, en tiempo real.
 */
export function formatRutOnType(value: string): string {
  // Limpiar: solo números y K/k
  let cleaned = value.replace(/[^0-9kK]/g, '').toUpperCase()

  // Limitar a 9 caracteres (8 dígitos + 1 DV)
  if (cleaned.length > 9) {
    cleaned = cleaned.slice(0, 9)
  }

  // Si tiene 1 o menos caracteres, devolver tal cual
  if (cleaned.length <= 1) {
    return cleaned
  }

  // Separar cuerpo y DV
  const cuerpo = cleaned.slice(0, -1)
  const dv = cleaned.slice(-1)

  // Formatear el cuerpo con puntos
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  // 6. Retornar con guion
  return `${cuerpoFormateado}-${dv}`
}

/**
 * Normaliza el RUT al formato que usa la BASE DE DATOS.
 */
export function normalizeRutForDB(rut: string): string {
  if (!rut) return ''

  const clean = cleanRut(rut)
  if (clean.length < 2) return rut

  const cuerpo = clean.slice(0, -1)
  const dv = clean.slice(-1)

  return `${cuerpo}-${dv}`
}

/**
 * Calcula el dígito verificador usando el algoritmo del Módulo 11.
 * 
 * @param cuerpo El RUT sin el dígito verificador (solo números, como string)
 * @returns El dígito verificador esperado ('0'-'9' o 'K')
 */
function calcularDV(cuerpo: string): string {
  let suma = 0
  let multiplicador = 2

  // Recorremos de derecha a izquierda
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }

  const resto = suma % 11
  const dv = 11 - resto

  if (dv === 11) return '0'
  if (dv === 10) return 'K'
  return dv.toString()
}

/**
 * Valida un RUT chileno 
 */
export function validarRUT(rut: string): boolean {
  if (!rut) return false

  const clean = cleanRut(rut)

  // RUT genérico (consumidor final) siempre válido
  if (clean === '666666666') return true

  // Debe tener entre 8 y 9 caracteres (7-8 dígitos + DV)
  if (clean.length < 8 || clean.length > 9) return false

  // Separar cuerpo y dígito verificador
  const cuerpo = clean.slice(0, -1)
  const dvIngresado = clean.slice(-1).toUpperCase()

  // El cuerpo debe ser solo números
  if (!/^\d+$/.test(cuerpo)) return false

  // El cuerpo no puede ser todo ceros
  if (/^0+$/.test(cuerpo)) return false

  // Calcular el DV esperado
  const dvEsperado = calcularDV(cuerpo)

  return dvEsperado === dvIngresado
}

/**
 * Alias de validarRUT para mantener compatibilidad.
 */
export function validateRut(rut: string): boolean {
  return validarRUT(rut)
}

/**
 * Alias de cleanRut para mantener compatibilidad con código antiguo.
 */
export function limpiarRUT(rut: string): string {
  return cleanRut(rut)
}

/**
 * Valida el RUT y devuelve un resultado con formato y mensaje de error.
 */
export function validateRutInput(rut: string): {
  isValid: boolean
  formatted: string
  message?: string
} {
  // Permitir RUT vacío (para casos donde es opcional)
  if (!rut || rut.trim() === '') {
    return { isValid: true, formatted: '', message: 'RUT vacío' }
  }

  const clean = cleanRut(rut)

  if (clean.length < 8 || clean.length > 9) {
    return {
      isValid: false,
      formatted: rut,
      message: 'El RUT debe tener entre 8 y 9 dígitos (sin contar puntos ni guión)'
    }
  }

  if (!validarRUT(rut)) {
    return {
      isValid: false,
      formatted: rut,
      message: 'RUT inválido. Verifica el dígito verificador.'
    }
  }

  return {
    isValid: true,
    formatted: formatRut(rut),
    message: 'RUT válido'
  }
}

/**
 * Analiza el estado del RUT para mostrar en tiempo real.
 */
export function getRutStatus(rut: string): {
  status: 'empty' | 'incomplete' | 'invalid-chars' | 'invalid-dv' | 'all-zeros' | 'valid'
  message: string
  canProceed: boolean 
} {
  // 1. Vacío
  if (!rut || rut.trim() === '') {
    return {
      status: 'empty',
      message: '',
      canProceed: true 
    }
  }

  const clean = cleanRut(rut)

  // 2. RUT genérico (66666666-6) siempre válido
  if (clean === '666666666') {
    return {
      status: 'valid',
      message: 'RUT válido (consumidor final)',
      canProceed: true
    }
  }

  // 3. Muy corto
  if (clean.length < 8) {
    return {
      status: 'incomplete',
      message: `RUT incompleto: faltan dígitos (tiene ${clean.length}, mínimo 8)`,
      canProceed: false 
    }
  }

  // Muy largo
  if (clean.length > 9) {
    return {
      status: 'invalid-chars',
      message: 'El RUT tiene demasiados dígitos (máximo 9)',
      canProceed: false
    }
  }

  // Separar cuerpo y DV
  const cuerpo = clean.slice(0, -1)
  const dvIngresado = clean.slice(-1).toUpperCase()

  // El cuerpo debe ser solo números
  if (!/^\d+$/.test(cuerpo)) {
    return {
      status: 'invalid-chars',
      message: 'El RUT contiene caracteres no válidos',
      canProceed: false
    }
  }

  // Todo ceros
  if (/^0+$/.test(cuerpo)) {
    return {
      status: 'all-zeros',
      message: 'El RUT no puede ser todo ceros',
      canProceed: false
    }
  }

  // Calcular DV esperado
  const dvEsperado = calcularDV(cuerpo)

  if (dvEsperado !== dvIngresado) {
    return {
      status: 'invalid-dv',
      message: `Dígito verificador incorrecto. Debería ser "${dvEsperado}", no "${dvIngresado}"`,
      canProceed: false
    }
  }

  // Todo OK
  return {
    status: 'valid',
    message: 'RUT válido',
    canProceed: true
  }
}