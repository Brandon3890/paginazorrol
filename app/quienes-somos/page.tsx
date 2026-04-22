"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowLeft, Target, Eye, Heart, Users, Sparkles } from "lucide-react"
import Image from "next/image"

export default function QuienesSomosPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Botón volver */}
        <div className="mb-6">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="mb-4 text-gray-600 hover:text-white hover:bg-orange-600 font-poppins transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
        </div>
        
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-semibold font-poppins text-gray-900 mb-4">
            ¿Quiénes somos?
          </h1>
          <div className="w-20 h-1 bg-orange-600 mx-auto rounded-full" />
        </motion.div>

        {/* Contenido principal con imagen a la derecha - misma altura */}
        <div className="max-w-6xl mx-auto">
          {/* Grid con altura igual para ambas columnas */}
          <motion.div 
            className="grid md:grid-cols-2 gap-12 items-stretch mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Texto - Lado izquierdo con altura completa */}
            <div className="flex flex-col justify-between h-full">
              <div className="prose prose-lg max-w-none">
                <p className="text-lg text-gray-700 leading-relaxed mb-6 font-poppins">
                  ¡Somos una tienda creada por <span className="font-semibold text-orange-600">dos personas que les apasionan los juegos</span>! 
                  Queremos ofrecer una experiencia familiar y profesional con nuestra experiencia en la industria de los juegos de mesa; 
                  queremos lograr la mejor experiencia hacia nuestros consumidores, poder lograr conectar con cada uno de ustedes para 
                  que tengan una experiencia agradable y cómoda. También queremos poder lograr llegar a personas nuevas y dar a conocer 
                  este gran universo lleno de increíbles experiencias.
                </p>
                
                <p className="text-lg text-gray-700 leading-relaxed mb-6 font-poppins">
                  Nuestro objetivo personal es ser una tienda que sea <span className="font-semibold text-orange-600">perfecta para nuestros consumidores</span>; 
                  queremos mejorar completamente en este largo trayecto que tenemos por delante. Nosotros estamos principalmente enfocados 
                  en ofrecer <span className="font-semibold text-orange-600">calidad antes que generar ingresos</span>, ya que este es tan solo nuestro segundo trabajo, 
                  que partió nada más y nada menos por nuestra gran pasión por los juegos en general.
                </p>
              </div>
            </div>

            {/* Imagen - Lado derecho con misma altura que el texto */}
            <div className="h-full">
              <div className="rounded-2xl overflow-hidden shadow-lg h-full">
                <div className="relative w-full h-full min-h-[400px] md:min-h-[450px]">
                  <Image
                    src="/ZorroL.jpeg"
                    alt="Zorro Lúdico - Tienda de juegos"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tarjetas de Misión y Visión */}
          <motion.div 
            className="grid md:grid-cols-2 gap-8 mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* Misión */}
            <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-8 border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Target className="w-6 h-6 text-orange-600" />
                </div>
                <h2 className="text-2xl font-semibold font-poppins text-gray-900">Misión</h2>
              </div>
              <p className="text-gray-700 leading-relaxed font-poppins">
                Dar experiencias de alta calidad que conecten a las personas mediante lo lúdico.
              </p>
            </div>

            {/* Visión */}
            <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-8 border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Eye className="w-6 h-6 text-orange-600" />
                </div>
                <h2 className="text-2xl font-semibold font-poppins text-gray-900">Visión</h2>
              </div>
              <p className="text-gray-700 leading-relaxed font-poppins">
                Contar con un espacio físico en conjunto para ser una marca reconocida dentro del rubro de lo lúdico a lo largo de todo Chile.
              </p>
            </div>
          </motion.div>

          {/* CTA final */}
          <motion.div 
            className="text-center py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <p className="text-gray-600 font-poppins mb-4">
              ¿Quieres conocer más sobre nosotros o tienes alguna pregunta?
            </p>
            <Link href="/contacto">
              <Button className="bg-orange-600 hover:bg-orange-700 text-white font-poppins px-8">
                Contáctanos
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  )
}