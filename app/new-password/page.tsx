"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function NewPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const token = searchParams.get('token')
  const email = searchParams.get('email')

  // Validaciones de contraseña
  const validations = {
    minLength: formData.password.length >= 8,
    hasUpperCase: /[A-Z]/.test(formData.password),
    hasLowerCase: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  }

  const isPasswordValid = Object.values(validations).every(Boolean)
  const passwordsMatch = formData.password === formData.confirmPassword

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token || !email) {
      setError("Enlace inválido o expirado")
      return
    }

    if (!isPasswordValid) {
      setError("La contraseña no cumple con todos los requisitos")
      return
    }

    if (!passwordsMatch) {
      setError("Las contraseñas no coinciden")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          email: decodeURIComponent(email),
          password: formData.password 
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        toast({
          title: "¡Contraseña actualizada!",
          description: "Tu contraseña ha sido cambiada exitosamente",
          duration: 5000,
        })
      } else {
        setError(data.error || "Error al cambiar la contraseña")
      }
    } catch (err) {
      setError("Error al procesar la solicitud. Inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <Alert variant="destructive">
            <AlertDescription>
              Enlace inválido o expirado. Por favor solicita un nuevo código de verificación.
            </AlertDescription>
          </Alert>
          <Link href="/reset-password" className="inline-block mt-4">
            <Button>
              Solicitar Nuevo Código
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-bold">¡Contraseña Actualizada!</CardTitle>
              <p className="text-muted-foreground">
                Tu contraseña ha sido cambiada exitosamente
              </p>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Ahora puedes iniciar sesión con tu nueva contraseña.
              </p>
              <div className="space-y-2">
                <Link href="/login">
                  <Button className="w-full">
                    Iniciar Sesión
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full">
                    Volver a la Tienda
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Link href="/verify-code" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver atrás
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Nueva Contraseña</CardTitle>
            <p className="text-muted-foreground">
              Crea una nueva contraseña segura para tu cuenta
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Nueva Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Ingresa tu nueva contraseña"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>

                {/* Password Requirements */}
                <div className="bg-muted rounded-lg p-3 space-y-1">
                  <p className="text-sm font-medium mb-2">La contraseña debe contener:</p>
                  <div className="text-xs space-y-1">
                    <div className={`flex items-center gap-2 ${validations.minLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${validations.minLength ? 'bg-green-600' : 'bg-gray-300'}`} />
                      Al menos 8 caracteres
                    </div>
                    <div className={`flex items-center gap-2 ${validations.hasUpperCase ? 'text-green-600' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${validations.hasUpperCase ? 'bg-green-600' : 'bg-gray-300'}`} />
                      Una letra mayúscula
                    </div>
                    <div className={`flex items-center gap-2 ${validations.hasLowerCase ? 'text-green-600' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${validations.hasLowerCase ? 'bg-green-600' : 'bg-gray-300'}`} />
                      Una letra minúscula
                    </div>
                    <div className={`flex items-center gap-2 ${validations.hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${validations.hasNumber ? 'bg-green-600' : 'bg-gray-300'}`} />
                      Un número
                    </div>
                    <div className={`flex items-center gap-2 ${validations.hasSpecialChar ? 'text-green-600' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${validations.hasSpecialChar ? 'bg-green-600' : 'bg-gray-300'}`} />
                      Un carácter especial (!@#$% etc.)
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirma tu nueva contraseña"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {formData.confirmPassword && (
                  <p className={`text-xs ${passwordsMatch ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordsMatch ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !isPasswordValid || !passwordsMatch}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cambiando Contraseña...
                  </>
                ) : (
                  "Cambiar Contraseña"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                ¿Recordaste tu contraseña?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Inicia sesión aquí
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}