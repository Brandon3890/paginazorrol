"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ShoppingBag, Clock, ArrowRight, X, Loader2 } from "lucide-react"

interface CheckoutResumeModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  onCancel: () => void
  isCancelling?: boolean
}

export function CheckoutResumeModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  onCancel,
  isCancelling = false
}: CheckoutResumeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <Card className="max-w-md w-full bg-white shadow-2xl overflow-hidden">
              {/* Header con gradiente */}
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ 
                        rotate: [0, -10, 10, -5, 5, 0],
                        scale: [1, 1.1, 1.1, 1.05, 1.05, 1]
                      }}
                      transition={{ duration: 0.5 }}
                    >
                      <ShoppingBag className="w-8 h-8" />
                    </motion.div>
                    <div>
                      <h2 className="text-2xl font-bold">¡Pago pendiente!</h2>
                      <p className="text-orange-100 text-sm mt-1">
                        Ya tienes un proceso de compra iniciado
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                    disabled={isCancelling}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Clock className="w-6 h-6 text-orange-600" />
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-sm text-orange-800">
                      Tienes <span className="font-bold">10 minutos</span> para completar tu compra desde que iniciaste.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-gray-700 font-medium">
                    ¿Qué deseas hacer?
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-auto py-4 px-4 border-2 hover:bg-red-50 hover:border-red-300 transition-all"
                      onClick={onCancel}
                      disabled={isCancelling}
                    >
                      {isCancelling ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Cancelando...</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="block font-semibold text-gray-700">No</span>
                          <span className="text-xs text-gray-500">Cancelar y vaciar carrito</span>
                        </div>
                      )}
                    </Button>

                    <Button
                      className="h-auto py-4 px-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 transition-all"
                      onClick={onConfirm}
                      disabled={isCancelling}
                    >
                      <div className="text-center">
                        <span className="block font-semibold">Sí</span>
                        <span className="text-xs text-orange-100 flex items-center justify-center gap-1">
                          Continuar pago
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Button>
                  </div>

                  <p className="text-xs text-center text-gray-400 mt-4">
                    Si eliges "No", el stock será liberado y el carrito se vaciará
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}