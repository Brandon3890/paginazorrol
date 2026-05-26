export function getSecurityHeaders() {
  const isProduction = process.env.NODE_ENV === 'production'
  
  const headers: Record<string, string> = {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  }
  
  if (isProduction) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  }
  
  return headers
}

export function getCSPHeaders() {
  // CSP unificado que funciona tanto en desarrollo como en producción
  return {
    'Content-Security-Policy': 
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https: http:; " +
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http:; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: blob: https: http:; " +
      "connect-src 'self' https: http: ws: wss:; " +
      "frame-ancestors 'none';"
  }
}