class OrderNumberService {
  // Secuencial por día (se reinicia cada día)
  private dailyCounters: Map<string, number> = new Map()

  // Generar número de orden único y legible
  generateOrderNumber(): string {
    const now = new Date()
    const dateStr = this.formatDate(now)
    const sequentialNumber = this.getDailySequential(dateStr)
    
    // Formato: ORD-YYYYMMDD-HHMMSS-SSS-NNN
    const orderNumber = `ORD-${dateStr}-${this.formatTime(now)}-${sequentialNumber.toString().padStart(3, '0')}`
    
    console.log('📝 OrderNumber generado:', orderNumber)
    return orderNumber
  }

  // Formatear fecha como YYYYMMDD
  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}${month}${day}`
  }

  // Formatear tiempo como HHMMSSmmm
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const seconds = date.getSeconds().toString().padStart(2, '0')
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0')
    return `${hours}${minutes}${seconds}${milliseconds}`
  }

  // Obtener número secuencial del día
  private getDailySequential(dateStr: string): number {
    if (!this.dailyCounters.has(dateStr)) {
      this.dailyCounters.set(dateStr, 1)
    }
    
    const currentCount = this.dailyCounters.get(dateStr)!
    this.dailyCounters.set(dateStr, currentCount + 1)
    
    return currentCount
  }

  // Generar número simple (alternativa más corta)
  generateSimpleOrderNumber(): string {
    const now = new Date()
    const dateStr = this.formatDate(now)
    const sequentialNumber = this.getDailySequential(dateStr)
    
    // Formato más corto: ORD-YYYYMMDD-NNN
    const orderNumber = `ORD-${dateStr}-${sequentialNumber.toString().padStart(4, '0')}`
    
    console.log('📝 OrderNumber simple generado:', orderNumber)
    return orderNumber
  }

  // Generar número con timestamp (único absoluto)
  generateTimestampOrderNumber(): string {
    const now = new Date()
    const timestamp = now.getTime()
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    
    // Formato: ORD-TIMESTAMP-RANDOM
    const orderNumber = `ORD-${timestamp}-${random}`
    
    console.log('📝 OrderNumber con timestamp generado:', orderNumber)
    return orderNumber
  }

  // Validar formato de número de orden
  isValidOrderNumber(orderNumber: string): boolean {
    const patterns = [
      /^ORD-\d{8}-\d{9}-\d{3}$/,      // ORD-YYYYMMDD-HHMMSSmmm-NNN
      /^ORD-\d{8}-\d{4}$/,            // ORD-YYYYMMDD-NNNN
      /^ORD-\d{13}-\d{3}$/            // ORD-TIMESTAMP-RANDOM
    ]
    
    return patterns.some(pattern => pattern.test(orderNumber))
  }

  // Extraer fecha del número de orden
  extractDate(orderNumber: string): Date | null {
    try {
      // Para formato ORD-YYYYMMDD-...
      const match = orderNumber.match(/^ORD-(\d{8})/)
      if (match) {
        const dateStr = match[1]
        const year = parseInt(dateStr.substring(0, 4))
        const month = parseInt(dateStr.substring(4, 6)) - 1
        const day = parseInt(dateStr.substring(6, 8))
        return new Date(year, month, day)
      }
      
      // Para formato ORD-TIMESTAMP-...
      const timestampMatch = orderNumber.match(/^ORD-(\d{13})/)
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1])
        return new Date(timestamp)
      }
      
      return null
    } catch {
      return null
    }
  }
}

export const orderNumberService = new OrderNumberService()