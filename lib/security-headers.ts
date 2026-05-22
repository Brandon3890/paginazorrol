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
  
  // CSP para producción - Permite lo necesario pero mantiene seguridad
  return {
    'Content-Security-Policy': 
      "default-src 'self'; " +
      // Permite scripts de Next.js, Cloudflare y hashes para inline
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com; " +
      // Permite estilos inline (necesario para Tailwind/Shadcn)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      // Fuentes
      "font-src 'self' https://fonts.gstatic.com data:; " +
      // Imágenes
      "img-src 'self' data: https: blob:; " +
      // Conexiones API
      "connect-src 'self' https://api.webpay.com https://static.cloudflareinsights.com https://www.google-analytics.com https://api.simplefactura.cl; " +
      // Frames para Webpay
      "frame-src 'self' https://webpay3gint.transbank.cl https://webpay3g.transbank.cl; " +
      // Formularios
      "form-action 'self'; " +
      "frame-ancestors 'none';"
  }
}