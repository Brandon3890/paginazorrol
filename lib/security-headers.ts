export function getSecurityHeaders() {
  const isProduction = process.env.NODE_ENV === 'production'

  const headers: Record<string, string> = {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  }

  if (isProduction) {
    headers['Strict-Transport-Security'] =
      'max-age=31536000; includeSubDomains'
  }

  return headers
}

export function getCSPHeaders() {
  const isDevelopment = process.env.NODE_ENV === 'development'

  if (isDevelopment) {
    return {
      'Content-Security-Policy':
        "default-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:3000; " +
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: blob: http: https:; " +
        "connect-src 'self' http://localhost:3000 ws: wss:; " +
        "frame-src 'self' https://www.youtube.com https://youtube.com; " +
        "frame-ancestors 'none';"
    }
  }

  return {
    'Content-Security-Policy':
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https: http:; " +
      "connect-src 'self' https: wss:; " +
      "frame-src 'self' https://www.youtube.com https://youtube.com; " +
      "frame-ancestors 'none';"
  }
}