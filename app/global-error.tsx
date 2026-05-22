"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Home, RefreshCw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("❌ Error global capturado:", error);
    // Aquí podrías enviar el error a un servicio de monitoreo
  }, [error]);

  return (
    <html>
      <body className="bg-gradient-to-b from-white to-gray-50">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="mb-6"
            >
              <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-gray-900 mb-2"
            >
              Error crítico
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-gray-600 mb-6"
            >
              Ha ocurrido un error inesperado. Estamos trabajando para solucionarlo.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6"
            >
              <p className="text-sm text-amber-800">
                <Shield className="w-4 h-4 inline mr-2" />
                Nuestro equipo ha sido notificado automáticamente.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col gap-3"
            >
              <Button
                onClick={reset}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Intentar de nuevo
              </Button>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Ir al inicio
                </Button>
              </Link>
            </motion.div>

            <p className="text-xs text-gray-400 mt-8">
              Si el problema persiste, contacta a soporte@ludicagames.com
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}