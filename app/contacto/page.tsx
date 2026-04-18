"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Phone, Mail, Clock, Send, CheckCircle, MessageCircle, Instagram, Youtube, Facebook, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"

export default function ContactPage() {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  })

  // Estados de error para cada campo
  const [errors, setErrors] = useState({
    email: "",
    phone: ""
  })

  // Función para validar email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Función para validar teléfono chileno (+569XXXXXXXX)
  const validatePhone = (phone: string): boolean => {
    // Permite formato +569XXXXXXXX (11 dígitos en total)
    const phoneRegex = /^\+569\d{8}$/
    // También permite 9XXXXXXXX (9 dígitos)
    const phoneRegexAlt = /^9\d{8}$/
    return phoneRegex.test(phone) || phoneRegexAlt.test(phone) || phone === ""
  }

  // Formatear teléfono mientras escribe
  const formatPhoneNumber = (value: string): string => {
    // Eliminar todo excepto números y el signo +
    let cleaned = value.replace(/[^\d+]/g, '')
    
    // Si empieza con 9 y no tiene +, agregar +56
    if (cleaned.startsWith('9') && cleaned.length <= 9) {
      cleaned = `+56${cleaned}`
    }
    
    // Si tiene +56 y luego 9, mantener
    if (cleaned.startsWith('+569') && cleaned.length > 4) {
      // Limitar a +569 + 8 dígitos = 12 caracteres
      return cleaned.slice(0, 12)
    }
    
    return cleaned
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    
    let newValue = value
    let error = ""
    
    if (id === "email") {
      if (value && !validateEmail(value)) {
        error = "Ingresa un correo electrónico válido (ej: nombre@dominio.com)"
      }
      setErrors(prev => ({ ...prev, email: error }))
    }
    
    if (id === "phone") {
      newValue = formatPhoneNumber(value)
      if (value && !validatePhone(newValue)) {
        error = "Ingresa un número válido (+569XXXXXXXX o 9XXXXXXXX)"
      }
      setErrors(prev => ({ ...prev, phone: error }))
    }
    
    setFormData({
      ...formData,
      [id]: newValue
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validaciones antes de enviar
    let hasErrors = false
    
    if (!validateEmail(formData.email)) {
      setErrors(prev => ({ ...prev, email: "Ingresa un correo electrónico válido (ej: nombre@dominio.com)" }))
      hasErrors = true
    }
    
    if (formData.phone && !validatePhone(formData.phone)) {
      setErrors(prev => ({ ...prev, phone: "Ingresa un número válido (+569XXXXXXXX o 9XXXXXXXX)" }))
      hasErrors = true
    }
    
    if (hasErrors) {
      toast({
        title: "Error de validación",
        description: "Por favor corrige los errores en el formulario.",
        variant: "destructive",
        duration: 5000,
      })
      return
    }
    
    setIsSubmitting(true)
    
    // Limpiar el teléfono para enviar (quitar +56 si es necesario)
    let cleanPhone = formData.phone
    if (cleanPhone.startsWith('+569') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.substring(3) // Quitar +56
    }
    
    const dataToSend = {
      ...formData,
      phone: cleanPhone
    }
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      })

      const data = await response.json()

      if (response.ok) {
        setIsSubmitted(true)
        toast({
          title: "Mensaje enviado",
          description: "Gracias por contactarnos. Te responderemos pronto.",
          duration: 5000,
        })
        setFormData({ name: "", email: "", phone: "", subject: "", message: "" })
        setErrors({ email: "", phone: "" })
        setTimeout(() => setIsSubmitted(false), 3000)
      } else {
        throw new Error(data.error || "Error al enviar el mensaje")
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Intenta nuevamente.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
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
            Contáctanos
          </h1>
          <p className="text-lg font-normal font-poppins text-gray-600 max-w-2xl mx-auto">
            ¿Tienes alguna pregunta o sugerencia? Estamos aquí para ayudarte. 
            Completa el formulario y te responderemos a la brevedad.
          </p>
        </motion.div>

        {/* Formulario de Contacto - Centrado */}
        <div className="max-w-3xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="border-2 border-gray-200 rounded-2xl shadow-sm">
              <CardHeader className="border-b border-gray-100 pb-6">
                <CardTitle className="text-2xl font-semibold font-poppins text-gray-900">
                  Envíanos un Mensaje
                </CardTitle>
                <CardDescription className="font-normal font-poppins text-gray-500">
                  Completa el formulario y te responderemos a la brevedad.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Nombre */}
                    <div className="space-y-2">
                      <Label htmlFor="name" className="font-medium font-poppins text-gray-700">
                        Nombre Completo *
                      </Label>
                      <Input
                        id="name"
                        required
                        placeholder="Tu nombre"
                        value={formData.name}
                        onChange={handleChange}
                        className="font-normal font-poppins border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>

                    {/* Email con validación */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-medium font-poppins text-gray-700">
                        Correo Electrónico *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="tu@email.com"
                        value={formData.email}
                        onChange={handleChange}
                        className={`font-normal font-poppins border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${
                          errors.email ? "border-red-500 focus:border-red-500" : ""
                        }`}
                      />
                      {errors.email && (
                        <p className="text-xs text-red-500 font-poppins flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Teléfono con validación chilena */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="font-medium font-poppins text-gray-700">
                        Teléfono <span className="text-xs text-gray-400 font-normal">(Ej:  +569XXXXXXXX o 9XXXXXXXX)</span>
                      </Label>
                      <Input
                        id="phone"
                        placeholder="+56912345678"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`font-normal font-poppins border-gray-300 focus:border-orange-500 focus:ring-orange-500 ${
                          errors.phone ? "border-red-500 focus:border-red-500" : ""
                        }`}
                      />
                      {errors.phone && (
                        <p className="text-xs text-red-500 font-poppins flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.phone}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 font-poppins">
                      </p>
                    </div>

                    {/* Asunto */}
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="font-medium font-poppins text-gray-700">
                        Asunto *
                      </Label>
                      <Input
                        id="subject"
                        required
                        placeholder="¿Sobre qué quieres hablar?"
                        value={formData.subject}
                        onChange={handleChange}
                        className="font-normal font-poppins border-gray-300 focus:border-orange-500 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  {/* Mensaje */}
                  <div className="space-y-2">
                    <Label htmlFor="message" className="font-medium font-poppins text-gray-700">
                      Mensaje *
                    </Label>
                    <Textarea
                      id="message"
                      required
                      placeholder="Escribe tu mensaje aquí..."
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      className="font-normal font-poppins border-gray-300 focus:border-orange-500 focus:ring-orange-500 resize-none"
                    />
                  </div>

                  {/* Botón Enviar */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-normal font-poppins py-6 text-base"
                    >
                      <AnimatePresence mode="wait">
                        {isSubmitting ? (
                          <motion.div
                            key="loading"
                            className="flex items-center justify-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Enviando...</span>
                          </motion.div>
                        ) : isSubmitted ? (
                          <motion.div
                            key="success"
                            className="flex items-center justify-center gap-2"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <CheckCircle className="w-5 h-5" />
                            <span>¡Mensaje Enviado!</span>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="normal"
                            className="flex items-center justify-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <Send className="w-5 h-5" />
                            <span>Enviar Mensaje</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  )
}