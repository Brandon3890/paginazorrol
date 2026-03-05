// lib/transbank-service.ts - VERSIÓN COMPLETA
import axios from 'axios'

export interface TransbankTransaction {
  buy_order: string
  session_id: string
  amount: number
  return_url: string
}

export interface TransbankResponse {
  token: string
  url: string
}

export interface TransbankCommitResponse {
  vci: string
  amount: number
  status: string
  buy_order: string
  session_id: string
  card_detail: {
    card_number: string
  }
  accounting_date: string
  transaction_date: string
  authorization_code: string
  payment_type_code: string
  response_code: number
  installments_number: number
}

class TransbankService {
  private baseURL: string
  private commerceCode: string
  private apiKey: string

  constructor() {
    // Configurar según el entorno
    this.commerceCode = process.env.TRANSBANK_COMMERCE_CODE || '597055555532'
    this.apiKey = process.env.TRANSBANK_API_KEY || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C'
    
    if (process.env.NODE_ENV === 'production' || process.env.TRANSBANK_ENVIRONMENT === 'production') {
      this.baseURL = 'https://webpay3g.transbank.cl'
      console.log('🚀 Transbank en modo PRODUCCIÓN')
    } else {
      this.baseURL = 'https://webpay3gint.transbank.cl'
      console.log('🧪 Transbank en modo INTEGRACIÓN')
    }
  }

  private getHeaders() {
    return {
      'Tbk-Api-Key-Id': this.commerceCode,
      'Tbk-Api-Key-Secret': this.apiKey,
      'Content-Type': 'application/json'
    }
  }

  async createTransaction(transactionData: TransbankTransaction): Promise<TransbankResponse> {
    try {
      console.log('🔄 Creando transacción Webpay:', {
        ...transactionData,
        amount: `$${transactionData.amount.toLocaleString('es-CL')}`
      })
      
      // Validaciones adicionales
      if (transactionData.amount <= 0) {
        throw new Error('El monto debe ser mayor a 0')
      }

      if (transactionData.buy_order.length > 26) {
        throw new Error('El buy_order no puede exceder 26 caracteres')
      }

      if (transactionData.session_id.length > 61) {
        throw new Error('El session_id no puede exceder 61 caracteres')
      }

      const response = await axios.post(
        `${this.baseURL}/rswebpaytransaction/api/webpay/v1.2/transactions`,
        transactionData,
        {
          headers: this.getHeaders(),
          timeout: 30000 // 30 segundos timeout
        }
      )

      console.log('✅ Transacción creada exitosamente')
      return response.data
    } catch (error: any) {
      console.error('❌ Error creando transacción Webpay:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      throw new Error(`Error al crear transacción Webpay: ${error.response?.data?.error_message || error.message}`)
    }
  }

  async commitTransaction(token: string): Promise<TransbankCommitResponse> {
    try {
      console.log('🔄 Confirmando transacción Webpay con token:', token)
      
      if (!token || token.length < 10) {
        throw new Error('Token de transacción inválido')
      }

      const response = await axios.put(
        `${this.baseURL}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`,
        {},
        {
          headers: this.getHeaders(),
          timeout: 30000
        }
      )
      
      console.log('✅ Transacción confirmada:', {
        status: response.data.status,
        response_code: response.data.response_code,
        authorization_code: response.data.authorization_code,
        amount: `$${response.data.amount?.toLocaleString('es-CL')}`
      })

      return response.data
    } catch (error: any) {
      console.error('❌ Error confirmando transacción Webpay:', {
        token: token,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      })
      throw new Error(`Error al confirmar transacción Webpay: ${error.response?.data?.error_message || error.message}`)
    }
  }

  async getTransactionStatus(token: string) {
    try {
      console.log('🔍 Consultando estado de transacción:', token)
      
      const response = await axios.get(
        `${this.baseURL}/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`,
        {
          headers: this.getHeaders(),
          timeout: 15000
        }
      )
      
      console.log('📊 Estado de transacción:', {
        status: response.data.status,
        response_code: response.data.response_code
      })
      
      return response.data
    } catch (error: any) {
      console.error('❌ Error obteniendo estado de transacción:', error.response?.data || error.message)
      throw error
    }
  }

  // Generar buy_order único para Transbank (DIFERENTE del order_number)
  generateBuyOrder(): string {
    const timestamp = Date.now().toString()
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
    const buyOrder = `TBK${timestamp}${random}`.slice(0, 26)
    console.log('📝 BuyOrder ÚNICO generado para Transbank:', buyOrder)
    return buyOrder
  }

  // Generar session_id único
  generateSessionId(): string {
    const sessionId = `SES${Date.now()}${Math.random().toString(36).substr(2, 15)}`.slice(0, 61)
    console.log('📝 SessionId ÚNICO generado:', sessionId)
    return sessionId
  }

  // Generar order_number único para nuestra base de datos (DIFERENTE del buy_order)
  generateOrderNumber(): string {
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substr(2, 9)
    const orderNumber = `ORD-${timestamp}-${random}`.toUpperCase()
    console.log('📝 OrderNumber ÚNICO generado:', orderNumber)
    return orderNumber
  }

  // Validar respuesta de Transbank
  isTransactionApproved(commitResponse: TransbankCommitResponse): boolean {
    const isApproved = (
      commitResponse.status === 'AUTHORIZED' && 
      commitResponse.response_code === 0
    )
    
    console.log('✅ Validación de transacción:', {
      status: commitResponse.status,
      response_code: commitResponse.response_code,
      approved: isApproved
    })
    
    return isApproved
  }

  // Obtener descripción del código de respuesta
  getResponseCodeDescription(responseCode: number): string {
    const descriptions: { [key: number]: string } = {
      0: 'Transacción aprobada',
      [-1]: 'Rechazo de transacción',
      [-2]: 'Transacción debe reintentarse',
      [-3]: 'Error en transacción',
      [-4]: 'Rechazo de transacción',
      [-5]: 'Rechazo por error de tasa',
      [-6]: 'Excede cupo máximo mensual',
      [-7]: 'Excede límite diario por transacción',
      [-8]: 'Rubro no autorizado',
    }
    
    return descriptions[responseCode] || `Código desconocido: ${responseCode}`
  }
}

export const transbankService = new TransbankService()