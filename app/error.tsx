// app/error.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  AlertCircle, 
  Home, 
  ArrowLeft, 
  RefreshCw, 
  Package,
  MessageCircle,
  WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Log del error
    console.error("Error capturado:", error);

    // Detectar estado de conexión
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [error]);

  const handleRetry = () => {
    reset();
  };

  const getErrorType = () => {
    if (!isOnline) return "Sin conexión a Internet";
    if (error.message?.includes("fetch")) return "Error de conexión con el servidor";
    if (error.message?.includes("timeout")) return "Tiempo de espera agotado";
    if (error.message?.includes("network")) return "Error de red";
    return "Error interno del servidor";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          {/* Animación del error */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mb-8"
          >
            <div className="w-32 h-32 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-16 h-16 text-red-500" />
            </div>
          </motion.div>

          {/* Título y descripción */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-4"
          >
            {isOnline ? "¡Algo salió mal!" : "Sin conexión a Internet"}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-gray-600 mb-4"
          >
            {getErrorType()}
          </motion.p>

          {!isOnline && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3 mb-6 max-w-md mx-auto"
            >
              <WifiOff className="w-4 h-4" />
              <span className="text-sm">
                Verifica tu conexión a Internet y vuelve a intentar
              </span>
            </motion.div>
          )}

          {/* Botones de acción */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto">
                <Home className="w-4 h-4 mr-2" />
                Ir al Inicio
              </Button>
            </Link>
          </motion.div>

          {/* Mensaje de contacto */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 pt-6 border-t border-gray-200"
          >
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}