// lib/security-headers.ts
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
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (isDevelopment) {
    return {
      'Content-Security-Policy': 
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: blob: https:; " +
        "connect-src 'self' http://localhost:3000; " +
        "frame-ancestors 'none';"
    }
  }
  
  // CSP para producción
  return {
    'Content-Security-Policy': 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://api.webpay.com https://static.cloudflareinsights.com https://www.google-analytics.com https://api.simplefactura.cl; " +
      "frame-src 'self' https://webpay3gint.transbank.cl https://webpay3g.transbank.cl; " +
      "form-action 'self'; " +
      "frame-ancestors 'none';"
  }
}