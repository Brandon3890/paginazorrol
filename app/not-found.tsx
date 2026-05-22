// app/not-found.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Search, 
  Home, 
  ArrowLeft, 
  Package, 
  AlertTriangle,
  Compass,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [suggestions] = useState([
    "Revisa que la dirección web sea correcta",
    "Usa el buscador para encontrar lo que necesitas",
    "Visita nuestra página de inicio",
    "Explora nuestras categorías",
  ]);

  // Efecto para el contador
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShouldRedirect(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Efecto SEPARADO para la redirección
  useEffect(() => {
    if (shouldRedirect) {
      router.push("/");
    }
  }, [shouldRedirect, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          {/* Animación del 404 */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="relative mb-8"
          >
            <div className="text-[120px] md:text-[180px] font-bold text-gray-200 select-none">
              404
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <AlertTriangle className="w-16 h-16 md:w-24 md:h-24 text-orange-500" />
            </motion.div>
          </motion.div>

          {/* Título y descripción */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-4"
          >
            ¡Ups! Página no encontrada
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-gray-600 mb-8"
          >
            La página que estás buscando no existe o ha sido movida.
            Serás redirigido automáticamente en {countdown} segundos.
          </motion.p>

          {/* Barra de progreso */}
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 10, ease: "linear" }}
            className="h-1 bg-orange-500 rounded-full mb-8 mx-auto max-w-md"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}