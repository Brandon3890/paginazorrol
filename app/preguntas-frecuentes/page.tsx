"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { ArrowLeft, ChevronDown, ChevronUp, MessageCircle, ShoppingBag, Truck, Shield, Store, RefreshCw, Users, HelpCircle, CreditCard, Package, MapPin, Phone } from "lucide-react"
import { useState } from "react"

export default function PreguntasFrecuentesPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  const faqs = [
    {
      question: "¿Tienen local comercial físico?",
      answer: "No, por ahora solo contamos con tienda virtual.",
      icon: Store
    },
    {
      question: "¿Cómo puedo comprar uno o varios artículos?",
      answer: "Puedes comprar directamente en nuestra página, seleccionando el artículo que quieres comprar. Puedes comprar solo uno seleccionando el botón de 'Comprar' y si quieres comprar varios del mismo artículo usa el botón de 'Agregar al Carro'. En el carrito puedes seleccionar la cantidad que deseas.",
      icon: ShoppingBag
    },
    {
      question: "¿Es seguro comprar a través de nuestra página?",
      answer: "Sí, es seguro comprar ya que nuestro proveedor de pagos es Transbank. Tiene conexión cifrada y necesita autenticación bancaria que solo tú como dueño de tus tarjetas tienes acceso.",
      icon: Shield
    },
    {
      question: "¿Hacen envíos a todo Chile?",
      answer: "Hacemos envíos a todo Chile a través de Chilexpress (pagas el envío al recibir el producto o retirando en sucursal).",
      icon: Truck
    },
    {
      question: "¿Puedo escoger otra empresa de envíos?",
      answer: "Sí, en las opciones de despacho puedes seleccionar la opción de 'Personalizado'. Ahí puedes escoger cualquier empresa de transporte de tu conveniencia. Nosotros nos pondremos en contacto contigo para la confirmación. Esto puede tener un coste adicional que varía según la empresa que elijas. Te recomendamos cotizar antes de comprar.",
      icon: Package
    },
    {
      question: "¿Puedo retirar mi producto en persona?",
      answer: "Sí, en las opciones de despacho puedes seleccionar la opción de 'Retiro en persona'. Puedes venir a recoger tu producto a nuestra oficina en Arcángel 1200, San Miguel. Te avisaremos después de 24 horas hábiles de haber recibido el pago.",
      icon: MapPin
    },
    {
      question: "¿No sabes qué juego o artículo elegir?",
      answer: "No te preocupes, nosotros podemos ayudarte a elegir. Escríbenos un WhatsApp y te responderemos a la brevedad, no importa si estás recién comenzando o si ya tienes experiencia. No olvides revisar nuestros artículos 'Recomendado por el Zorro'.",
      icon: HelpCircle
    },
    {
      question: "¿Se aceptan cambios o devoluciones?",
      answer: "Aceptamos cambios o devoluciones solo si el producto está sellado de fábrica o si el producto vino con algún tipo de fallo de fábrica. Deberás ponerte en contacto dentro de un plazo de 10 días después de recibir el producto. No nos hacemos responsables si el producto fue dañado por responsabilidad del comprador. Si el producto vino con fallas de fábrica, se aplicarán las garantías legales respetando tu derecho como consumidor.",
      icon: RefreshCw
    },
    {
      question: "¿Dónde me puedo contactar?",
      answer: "Puedes contactarnos en la sección 'Contacto' de nuestra página o a través de WhatsApp. Responderemos a la brevedad.",
      icon: MessageCircle
    },
    {
      question: "¿Tienen juegos para todas las edades?",
      answer: "Sí, contamos con una gran variedad de artículos lúdicos para cualquier persona, ya sea para niños y personas adultas. No hay edad para poder jugar y disfrutar.",
      icon: Users
    }
  ]

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
            Preguntas Frecuentes
          </h1>
          <div className="w-20 h-1 bg-orange-600 mx-auto rounded-full mb-4" />
          <p className="text-lg font-normal font-poppins text-gray-600 max-w-2xl mx-auto">
            Encuentra respuestas a las dudas más comunes sobre nuestras compras, envíos y productos.
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const Icon = faq.icon
              const isOpen = openIndex === index
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => toggleQuestion(index)}
                    className="w-full text-left p-5 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="font-semibold font-poppins text-gray-900 text-base md:text-lg">
                        {faq.question}
                      </span>
                    </div>
                    <div className="flex-shrink-0 text-gray-400">
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="p-5 pt-0 bg-gray-50 border-t border-gray-100">
                          <p className="text-gray-700 font-poppins leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>

          {/* Sección de contacto adicional */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-8 text-center border border-orange-100"
          >
            <h3 className="text-xl font-semibold font-poppins text-gray-900 mb-3">
              ¿Tienes alguna duda que no se haya podido responder?
            </h3>
            <p className="text-gray-600 font-poppins mb-6">
              ¡Escríbenos! Estamos aquí para ayudarte.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contacto">
                <Button className="bg-orange-600 hover:bg-orange-700 text-white font-poppins">
                  Formulario de Contacto
                </Button>
              </Link>
              <a
                href="https://wa.me/56958773629"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="border-green-500 text-green-600 hover:bg-green-50 font-poppins">
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Métodos de pago y envío info rápida */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-orange-600" />
              <div>
                <p className="font-semibold text-gray-800 font-poppins text-sm">Pagos Seguros</p>
                <p className="text-xs text-gray-500 font-poppins">Transbank - Conexión cifrada</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <Truck className="w-8 h-8 text-orange-600" />
              <div>
                <p className="font-semibold text-gray-800 font-poppins text-sm">Envíos a todo Chile</p>
                <p className="text-xs text-gray-500 font-poppins">Chilexpress o empresa personalizada</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  )
}