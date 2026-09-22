// Simple in-memory rate limiter 
class SimpleRateLimiter {
  private attempts: Map<string, { count: number; firstAttempt: number }> = new Map()
  
  constructor(
    private maxAttempts: number,
    private timeWindow: number
  ) {}

  attempt(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const attemptData = this.attempts.get(key)

    if (!attemptData) {
      this.attempts.set(key, { count: 1, firstAttempt: now })
      return {
        allowed: true,
        remaining: this.maxAttempts - 1,
        resetTime: now + this.timeWindow * 1000
      }
    }

    if (now - attemptData.firstAttempt > this.timeWindow * 1000) {
      this.attempts.set(key, { count: 1, firstAttempt: now })
      return {
        allowed: true,
        remaining: this.maxAttempts - 1,
        resetTime: now + this.timeWindow * 1000
      }
    }

    if (attemptData.count >= this.maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: attemptData.firstAttempt + this.timeWindow * 1000
      }
    }

    attemptData.count++
    this.attempts.set(key, attemptData)

    return {
      allowed: true,
      remaining: this.maxAttempts - attemptData.count,
      resetTime: attemptData.firstAttempt + this.timeWindow * 1000
    }
  }

  cleanup() {
    const now = Date.now()
    for (const [key, data] of this.attempts.entries()) {
      if (now - data.firstAttempt > this.timeWindow * 1000 * 2) {
        this.attempts.delete(key)
      }
    }
  }
}

export const loginRateLimiter = new SimpleRateLimiter(80, 900) // 80 intentos en 15 minutos
export const apiRateLimiter = new SimpleRateLimiter(500, 60) // 500 peticiones por minuto
export const adminRateLimiter = new SimpleRateLimiter(200, 60) // 200 acciones admin por minuto

// Cleanup cada hora
setInterval(() => {
  loginRateLimiter.cleanup()
  apiRateLimiter.cleanup()
  adminRateLimiter.cleanup()
}, 60 * 60 * 1000)