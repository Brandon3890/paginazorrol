const GUEST_IDENTIFIER_COOKIE = 'guest_identifier'

export function getClientIdentifier(): string {
  if (typeof document === 'undefined') {
    return ''
  }
  
  // Buscar en cookies
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === GUEST_IDENTIFIER_COOKIE) {
      return decodeURIComponent(value)
    }
  }
  
  // Si no hay cookie, generar uno
  const tempId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  document.cookie = `${GUEST_IDENTIFIER_COOKIE}=${encodeURIComponent(tempId)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
  return tempId
}

export function setClientIdentifier(identifier: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${GUEST_IDENTIFIER_COOKIE}=${encodeURIComponent(identifier)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
}

export function clearClientIdentifier(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${GUEST_IDENTIFIER_COOKIE}=; path=/; max-age=0`
}