"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Home, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mb-8"
          >
            <div className="w-32 h-32 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-16 h-16 text-orange-500" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-6xl md:text-8xl font-bold text-gray-900 mb-4"
          >
            404
          </motion.h1>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl md:text-3xl font-semibold text-gray-800 mb-4"
          >
            Página no encontrada
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 mb-8"
          >
            Lo sentimos, la página que buscas no existe o ha sido movida.
            Serás redirigido al inicio en {countdown} segundos.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/">
              <Button className="bg-orange-600 hover:bg-orange-700">
                <Home className="w-4 h-4 mr-2" />
                Ir al Inicio
              </Button>
            </Link>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver atrás
            </Button>
          </motion.div>

          {/* Barra de progreso */}
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 5, ease: "linear" }}
            className="h-1 bg-orange-500 rounded-full mt-8 mx-auto max-w-md"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}