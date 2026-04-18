"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { Clock, AlertCircle } from 'lucide-react'

interface CheckoutTimerProps {
  timeLeft: string
  progress: number
  isExpired: boolean
}

export function CheckoutTimer({ timeLeft, progress, isExpired }: CheckoutTimerProps) {
  // Determinar color basado en el tiempo restante
  const getColor = () => {
    if (progress > 50) return 'bg-green-500'
    if (progress > 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getTextColor = () => {
    if (progress > 50) return 'text-green-600'
    if (progress > 25) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <AnimatePresence mode="wait">
      {!isExpired ? (
        <motion.div
          key="timer"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-white border border-orange-200 rounded-lg p-4 mb-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1, repeat: Infinity, repeatType: "reverse" }
                }}
              >
                <Clock className={`w-5 h-5 ${getTextColor()}`} />
              </motion.div>
              <span className="font-medium">Tiempo para completar la compra</span>
            </div>
            <motion.span 
              className={`text-2xl font-bold ${getTextColor()}`}
              animate={progress < 25 ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              {timeLeft}
            </motion.span>
          </div>

          {/* Barra de progreso */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${getColor()}`}
              initial={{ width: '100%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <motion.p 
            className="text-xs text-muted-foreground mt-2 flex items-center gap-1"
            animate={progress < 25 ? { opacity: [1, 0.7, 1] } : {}}
          >
            <AlertCircle className="w-3 h-3" />
            {progress < 25 
              ? "¡Últimos minutos! Completa tu compra pronto." 
              : "Los productos están reservados por 10 minutos"}
          </motion.p>
        </motion.div>
      ) : (
        <motion.div
          key="expired"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
        >
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Tiempo agotado - Redirigiendo al inicio...</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}