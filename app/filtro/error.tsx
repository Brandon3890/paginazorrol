"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FiltroErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function FiltroError({ error, reset }: FiltroErrorProps) {
  useEffect(() => {
    console.error("❌ Error en filtro:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mb-8"
          >
            <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-4"
          >
            Error al cargar productos
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-gray-600 mb-8"
          >
            {error.message || "Hubo un problema al cargar los productos. Por favor, intenta de nuevo."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button onClick={reset} className="bg-orange-600 hover:bg-orange-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Intentar de nuevo
            </Button>
            <Link href="/filtro">
              <Button variant="outline">
                <Home className="w-4 h-4 mr-2" />
                Volver a productos
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  )
}