// app/register/page.tsx - VERSIÓN COMPLETA CON RUT
"use client"

import type React from "react"
import { useState } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Eye, EyeOff, UserPlus, Sparkles, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { validateRutInput } from "@/lib/rut-utils"

export default function RegisterPage() {
  const { register } = useAuthStore()
  const router = useRouter()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
  })
  const [rut, setRut] = useState("")
  const [rutValidation, setRutValidation] = useState<{ isValid: boolean; formatted: string; message?: string }>({
    isValid: false,
    formatted: ""
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Validación en tiempo real para la contraseña
  const passwordChecks = {
    length: formData.password.length >= 6,
    hasNumber: /\d/.test(formData.password),
    hasUpperCase: /[A-Z]/.test(formData.password),
    hasLowerCase: /[a-z]/.test(formData.password),
  }

  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length
  const passwordMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError("")
  }

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setRut(value)
    setRutValidation(validateRutInput(value))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Validar RUT
    if (!rutValidation.isValid) {
      setError(rutValidation.message || "RUT inválido")
      setIsLoading(false)
      return
    }

    // Validaciones existentes
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      setIsLoading(false)
      return
    }

    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError("Por favor completa todos los campos obligatorios")
      setIsLoading(false)
      return
    }

    try {
      const { confirmPassword, ...userData } = formData
      const success = await register({
        ...userData,
        rut: rutValidation.formatted
      })

      if (success) {
        toast({
          title: "¡Cuenta creada!",
          description: "Tu cuenta ha sido creada exitosamente.",
          duration: 3000,
        })
        router.push("/")
      } else {
        setError("Ya existe una cuenta con este email o RUT")
      }
    } catch (err: any) {
      setError(err.message || "Error al crear la cuenta. Inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div 
      className="container mx-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-md mx-auto">
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Volver a la tienda
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="overflow-hidden">
            <motion.div 
              className="h-1 bg-gradient-to-r from-orange-500 to-red-500"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            />

            <CardHeader className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.3 }}
                className="w-12 h-12 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center"
              >
                <UserPlus className="w-6 h-6 text-orange-600" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  Crear Cuenta
                  <Sparkles className="w-5 h-5 text-orange-500" />
                </CardTitle>
                <p className="text-muted-foreground">Regístrate para acceder a todas las funciones</p>
              </motion.div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div 
                  className="grid grid-cols-2 gap-4"
                  variants={{
                    hidden: { opacity: 0 },
                    visible: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1 }
                    }
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div 
                    className="space-y-2"
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    onFocus={() => setFocusedField('firstName')}
                    onBlur={() => setFocusedField(null)}
                  >
                    <Label htmlFor="firstName">Nombre *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="Juan"
                      disabled={isLoading}
                      className="transition-all focus:scale-[1.01]"
                    />
                  </motion.div>

                  <motion.div 
                    className="space-y-2"
                    variants={{
                      hidden: { opacity: 0, x: 10 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    onFocus={() => setFocusedField('lastName')}
                    onBlur={() => setFocusedField(null)}
                  >
                    <Label htmlFor="lastName">Apellido *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Pérez"
                      disabled={isLoading}
                      className="transition-all focus:scale-[1.01]"
                    />
                  </motion.div>
                </motion.div>

                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                >
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="tu@email.com"
                    disabled={isLoading}
                    className="transition-all focus:scale-[1.01]"
                  />
                </motion.div>

                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                >
                  <Label htmlFor="phone">Teléfono (opcional)</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+56 9 1234 5678"
                    disabled={isLoading}
                    className="transition-all focus:scale-[1.01]"
                  />
                </motion.div>

                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                  onFocus={() => setFocusedField('rut')}
                  onBlur={() => setFocusedField(null)}
                >
                  <Label htmlFor="rut">RUT *</Label>
                  <Input
                    id="rut"
                    name="rut"
                    value={rut}
                    onChange={handleRutChange}
                    placeholder="12.345.678-9"
                    disabled={isLoading}
                    className={`transition-all focus:scale-[1.01] ${
                      rut && (rutValidation.isValid ? "border-green-500" : "border-red-500")
                    }`}
                  />
                  
                  {/* Indicador de validación de RUT */}
                  <AnimatePresence>
                    {rut && (
                      <motion.div 
                        className={`flex items-center gap-1 text-xs mt-1 ${
                          rutValidation.isValid ? "text-green-600" : "text-red-500"
                        }`}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                      >
                        {rutValidation.isValid ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            <span>{rutValidation.message || "RUT válido"}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>{rutValidation.message || "RUT inválido"}</span>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Label htmlFor="password">Contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Mínimo 6 caracteres"
                      disabled={isLoading}
                      className="pr-10 transition-all focus:scale-[1.01]"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-transform hover:scale-110 active:scale-90"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Indicadores de validación de contraseña */}
                  <AnimatePresence>
                    {formData.password && (
                      <motion.div 
                        className="space-y-1 mt-2"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${(passwordStrength / 4) * 100}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                          <span className="text-gray-600">
                            {passwordStrength === 0 && "Muy débil"}
                            {passwordStrength === 1 && "Débil"}
                            {passwordStrength === 2 && "Media"}
                            {passwordStrength === 3 && "Fuerte"}
                            {passwordStrength === 4 && "Muy fuerte"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {Object.entries({
                            length: "6+ caracteres",
                            hasNumber: "Un número",
                            hasUpperCase: "Una mayúscula",
                            hasLowerCase: "Una minúscula"
                          }).map(([key, label]) => (
                            <motion.div 
                              key={key}
                              className="flex items-center gap-1"
                              initial={{ opacity: 0, x: -5 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              {passwordChecks[key as keyof typeof passwordChecks] ? (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              ) : (
                                <XCircle className="w-3 h-3 text-gray-300" />
                              )}
                              <span className={passwordChecks[key as keyof typeof passwordChecks] ? "text-green-600" : "text-gray-400"}>
                                {label}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div 
                  className="space-y-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="Repite tu contraseña"
                      disabled={isLoading}
                      className={`pr-10 transition-all focus:scale-[1.01] ${
                        formData.confirmPassword && (passwordMatch ? "border-green-500" : "border-red-500")
                      }`}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-transform hover:scale-110 active:scale-90"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  
                  {/* Indicador de coincidencia */}
                  <AnimatePresence>
                    {formData.confirmPassword && (
                      <motion.div 
                        className={`flex items-center gap-1 text-xs mt-1 ${
                          passwordMatch ? "text-green-600" : "text-red-500"
                        }`}
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                      >
                        {passwordMatch ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            <span>Las contraseñas coinciden</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Las contraseñas no coinciden</span>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button 
                    type="submit" 
                    className="w-full relative overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]" 
                    disabled={isLoading}
                  >
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <motion.div
                          key="loading"
                          className="flex items-center gap-2"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                          />
                          <span>Creando cuenta...</span>
                        </motion.div>
                      ) : (
                        <motion.span
                          key="normal"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          Crear Cuenta
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Button>
                </motion.div>
              </form>

              <motion.div 
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <p className="text-sm text-muted-foreground">
                  ¿Ya tienes una cuenta?{" "}
                  <Link href="/login" className="text-primary hover:underline transition-colors">
                    Inicia sesión aquí
                  </Link>
                </p>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}