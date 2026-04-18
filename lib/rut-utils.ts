// lib/rut-utils.ts
export function formatRut(rut: string): string {
  // Eliminar puntos y guión
  const cleanRut = rut.replace(/[.-]/g, '');
  
  if (cleanRut.length < 2) return rut;
  
  // Separar cuerpo y dígito verificador
  const cuerpo = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1).toUpperCase();
  
  // Formatear cuerpo con puntos
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${cuerpoFormateado}-${dv}`;
}

export function cleanRut(rut: string): string {
  return rut.replace(/[.-]/g, '').toUpperCase();
}

export function validateRut(rut: string): boolean {
  // Limpiar el RUT
  const cleanRutValue = cleanRut(rut);
  
  // Validar formato
  if (!/^[0-9]+[0-9Kk]$/.test(cleanRutValue)) {
    return false;
  }
  
  // Separar cuerpo y dígito verificador
  const cuerpo = cleanRutValue.slice(0, -1);
  const dvIngresado = cleanRutValue.slice(-1).toUpperCase();
  
  // Validar que el cuerpo no sea vacío
  if (cuerpo.length === 0) return false;
  
  // Calcular dígito verificador
  let suma = 0;
  let multiplo = 2;
  
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i)) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  
  const dvEsperado = 11 - (suma % 11);
  let dvCalculado = '';
  
  if (dvEsperado === 11) {
    dvCalculado = '0';
  } else if (dvEsperado === 10) {
    dvCalculado = 'K';
  } else {
    dvCalculado = dvEsperado.toString();
  }
  
  return dvCalculado === dvIngresado;
}

export function validateRutInput(rut: string): { isValid: boolean; formatted: string; message?: string } {
  const cleanRutValue = cleanRut(rut);
  
  if (!cleanRutValue) {
    return { isValid: false, formatted: rut, message: 'El RUT es requerido' };
  }
  
  if (cleanRutValue.length < 8 || cleanRutValue.length > 9) {
    return { isValid: false, formatted: rut, message: 'El RUT debe tener entre 8 y 9 caracteres' };
  }
  
  if (!validateRut(rut)) {
    return { isValid: false, formatted: rut, message: 'RUT inválido' };
  }
  
  return { isValid: true, formatted: formatRut(rut), message: 'RUT válido' };
}