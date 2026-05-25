export function getSecurityHeaders() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const headers: Record<string, string> = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  }
  
  // Solo en producción
  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  }
  
  return headers
}

export function getCSPHeaders() {
  // CSP más permisivo para desarrollo
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (isDevelopment) {
    return {
      'Content-Security-Policy': 
        "default-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:3000; " +
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' http://localhost:3000; " +
        "frame-ancestors 'none';"
    }
  }
  
  // CSP estricto para producción
  return {
    'Content-Security-Policy': 
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://api.webpay.com; " +
      "frame-ancestors 'none';"
  }
}