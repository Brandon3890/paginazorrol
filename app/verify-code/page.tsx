"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Key, Loader2, Clock } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function VerifyCodePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [timeLeft, setTimeLeft] = useState(30 * 60) // 30 minutos en segundos
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  const email = searchParams.get('email')

  useEffect(() => {
    if (!email) {
      router.push('/reset-password')
      return
    }

    // Inicializar el array de referencias
    inputRefs.current = inputRefs.current.slice(0, 6)

    // Timer para expiración del código
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [email, router])

  // Función para establecer referencias corregida
  const setInputRef = (index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleInputChange = (index: number, value: string) => {
    // Solo permitir números
    const numericValue = value.replace(/[^0-9]/g, '')
    
    if (numericValue.length > 1) {
      value = numericValue.slice(0, 1) // Tomar solo el primer carácter
    } else {
      value = numericValue
    }

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-focus siguiente input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-submit si todos los campos están llenos
    if (newCode.every(digit => digit !== "") && index === 5) {
      handleVerifyCode(newCode.join(""))
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // Mover al input anterior al borrar
        inputRefs.current[index - 1]?.focus()
      } else if (code[index]) {
        // Limpiar el campo actual
        const newCode = [...code]
        newCode[index] = ""
        setCode(newCode)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      // Mover a la izquierda con flecha
      inputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      // Mover a la derecha con flecha
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
    const pastedArray = pastedData.split('')
    
    const newCode = ["", "", "", "", "", ""]
    pastedArray.forEach((char, index) => {
      if (index < 6) {
        newCode[index] = char
      }
    })
    
    setCode(newCode)
    
    // Focus en el último input con datos
    const lastFilledIndex = Math.min(pastedArray.length - 1, 5)
    if (lastFilledIndex < 5) {
      setTimeout(() => inputRefs.current[lastFilledIndex + 1]?.focus(), 0)
    } else {
      setTimeout(() => inputRefs.current[5]?.focus(), 0)
    }

    // Auto-submit si está completo
    if (pastedArray.length === 6) {
      setTimeout(() => handleVerifyCode(pastedArray.join("")), 100)
    }
  }

  const handleVerifyCode = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.join("")
    
    if (codeToVerify.length !== 6) {
      setError("Por favor ingresa el código completo de 6 dígitos")
      return
    }

    if (!/^\d{6}$/.test(codeToVerify)) {
      setError("El código debe contener solo números")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email,
          code: codeToVerify 
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Código verificado",
          description: "Ahora puedes crear tu nueva contraseña",
          duration: 3000,
        })
        router.push(`/new-password?token=${data.token}&email=${encodeURIComponent(email!)}`)
      } else {
        setError(data.error || "Código inválido o expirado")
        // Limpiar el código en caso de error
        setCode(["", "", "", "", "", ""])
        inputRefs.current[0]?.focus()
      }
    } catch (err) {
      setError("Error al verificar el código. Inténtalo de nuevo.")
      setCode(["", "", "", "", "", ""])
      inputRefs.current[0]?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email }),
      })

      const data = await response.json()

      if (response.ok) {
        setTimeLeft(30 * 60) // Reset timer a 30 minutos
        setCode(["", "", "", "", "", ""])
        inputRefs.current[0]?.focus()
        
        toast({
          title: "Código reenviado",
          description: "Te hemos enviado un nuevo código de verificación",
          duration: 5000,
        })
      } else {
        setError(data.error || "Error al reenviar el código")
      }
    } catch (err) {
      setError("Error al reenviar el código. Inténtalo de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!email) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <Alert variant="destructive">
            <AlertDescription>
              Email no encontrado. Por favor solicita un nuevo código de verificación.
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Link href="/reset-password" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver atrás
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Key className="w-6 h-6" />
              Verificar Código
            </CardTitle>
            <p className="text-muted-foreground">
              Ingresa el código de 6 dígitos que enviamos a <strong>{email}</strong>
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode() }} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Timer */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-4 py-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700">
                    El código expira en: {formatTime(timeLeft)}
                  </span>
                </div>
                {timeLeft === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    El código ha expirado. Por favor solicita uno nuevo.
                  </p>
                )}
              </div>

              {/* Code Inputs */}
              <div className="space-y-4">
                <Label htmlFor="code">Código de Verificación</Label>
                <div className="flex gap-2 justify-center">
                  {code.map((digit, index) => (
                    <Input
                      key={index}
                      ref={setInputRef(index)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleInputChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      className="w-12 h-12 text-center text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={isLoading || timeLeft === 0}
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Pega el código completo o ingrésalo dígito por dígito
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || code.join("").length !== 6 || timeLeft === 0}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar Código"
                )}
              </Button>

              <div className="text-center space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendCode}
                  disabled={isLoading || timeLeft > (25 * 60)} // Solo permitir reenvío después de 5 minutos
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    "Reenviar Código"
                  )}
                </Button>

                <p className="text-sm text-muted-foreground">
                  ¿No recibiste el código?{" "}
                  <button
                    type="button"
                    onClick={() => router.push('/reset-password')}
                    className="text-primary hover:underline"
                  >
                    Usar otro email
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}