"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useCartStore, shippingOptions } from "@/lib/cart-store"
import { useAuthStore } from "@/lib/auth-store"
import { useOrderStore } from "@/lib/order-store"
import { useCouponStore } from "@/lib/coupon-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CreditCard, Truck, Shield, LogIn, Tag, X, Loader2, MapPin, Plus, RefreshCw } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

// Función para manejar rate limit
const handleRateLimit = async (response: Response) => {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000
    
    console.warn(`⏰ Rate limit alcanzado. Esperando ${waitTime/1000} segundos...`)
    
    await new Promise(resolve => setTimeout(resolve, waitTime))
    return true
  }
  return false
}

// Función helper para tipos de cupón
const getCouponTypeText = (type: string) => {
  switch (type) {
    case 'global':
      return 'Descuento global'
    case 'category':
      return 'Descuento por categoría'
    case 'subcategory':
      return 'Descuento por subcategoría'
    case 'product':
      return 'Descuento por producto'
    case 'multiple':
      return 'Descuento múltiple'
    default:
      return 'Descuento'
  }
}

// Función para redondear a número entero sin decimales
const roundToInteger = (amount: number): number => {
  return Math.round(amount);
};

// Función para formatear precio en CLP sin decimales
const formatCLP = (price: number): string => {
  return roundToInteger(price).toLocaleString('es-CL');
};

export default function CheckoutPage() {
  const {
    items,
    getTotalPrice,
    getSubtotalPrice,
    getDiscountAmount,
    clearCart,
    shippingMethod,
    setShippingMethod,
    getShippingCost,
    appliedCoupon,
    couponDiscount,
    couponDetails,
    applyCoupon,
    removeCoupon,
    isLoading: cartLoading,
  } = useCartStore()
  const { user, isAuthenticated, loadUserAddresses } = useAuthStore()
  const { addOrder } = useOrderStore()
  const { validateCoupon } = useCouponStore()
  const router = useRouter()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    notes: "",
  })

  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [couponError, setCouponError] = useState("")
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [addressLoadAttempts, setAddressLoadAttempts] = useState(0)

  // CÁLCULOS ACTUALIZADOS - USANDO EL STORE CORREGIDO Y REDONDEADOS
  const subtotalBeforeDiscount = roundToInteger(getSubtotalPrice())
  const discountAmount = roundToInteger(getDiscountAmount())
  const totalAfterDiscount = roundToInteger(getTotalPrice())
  const shipping = roundToInteger(getShippingCost())
  const tax = roundToInteger(totalAfterDiscount * 0.19)
  const finalTotal = roundToInteger(totalAfterDiscount + shipping + tax)

  /*console.log('💰 Resumen de precios:', {
    subtotalBeforeDiscount,
    discountAmount,
    totalAfterDiscount,
    shipping,
    tax,
    finalTotal,
    appliedCoupon,
    couponDetails
  })*/

  // Cargar datos del usuario y direcciones si está autenticado
  useEffect(() => {
    const loadUserData = async () => {
      if (isAuthenticated && user) {
        setFormData(prev => ({
          ...prev,
          email: user.email || "",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          phone: user.phone || "",
        }))

        if (!user.addresses || user.addresses.length === 0) {
          setLoadingAddresses(true)
          try {
            if (addressLoadAttempts < 3) {
              await loadUserAddresses()
              setAddressLoadAttempts(prev => prev + 1)
            } else {
              console.warn('⚠️ Máximo de intentos de carga de direcciones alcanzado')
              toast({
                title: "Advertencia",
                description: "No se pudieron cargar las direcciones. Por favor intenta agregar una dirección manualmente.",
                variant: "destructive",
              })
            }
          } catch (error) {
            console.error('Error loading addresses:', error)
          } finally {
            setLoadingAddresses(false)
          }
        }
      }
    }

    loadUserData()
  }, [isAuthenticated, user, loadUserAddresses, addressLoadAttempts, toast])

  // Seleccionar dirección predeterminada cuando las direcciones estén disponibles
  useEffect(() => {
    if (user?.addresses && user.addresses.length > 0 && !selectedAddress) {
      const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0]
      setSelectedAddress(defaultAddress)
    }
  }, [user?.addresses, selectedAddress])

  // Mostrar loading mientras se hidrata el carrito
  if (cartLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando carrito...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Tu carrito está vacío</h1>
          <p className="text-muted-foreground mb-6">Agrega algunos productos antes de proceder al checkout.</p>
          <Link href="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Continuar Comprando
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

const handleApplyCoupon = async () => {
  if (!couponCode.trim()) {
    toast({
      title: "Error",
      description: "Por favor ingresa un código de cupón",
      variant: "destructive",
    })
    return
  }

  setIsValidatingCoupon(true)
  setCouponError("")

  try {
    /* LOG DETALLADO DE LOS ITEMS DEL CARRITO
    console.log('🛒 Items en carrito para validación:', items.map(item => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      subcategoryId: item.subcategoryId,
      category: item.category,
      price: item.price,
      quantity: item.quantity
    })))*/

    const response = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: couponCode.trim().toUpperCase(),
        items: items.map(item => ({
          id: item.id,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          price: item.price,
          quantity: item.quantity
        }))
      }),
    })

    // Manejar rate limit
    if (await handleRateLimit(response)) {
      return handleApplyCoupon() // Reintentar
    }

    const result = await response.json()

    /*console.log('🎯 Respuesta de validación de cupón:', result)*/

    if (result.valid && result.coupon) {
      // CALCULAR EL DESCUENTO REAL - VERSIÓN CORREGIDA
      let discountAmount = 0
      const coupon = result.coupon
      
      /*console.log('🎯 Calculando descuento para cupón:', {
        type: coupon.type,
        categoryIds: coupon.categoryIds,
        subcategoryIds: coupon.subcategoryIds,
        productIds: coupon.productIds,
        items: items
      })*/

      if (coupon.type === 'global') {
        // Descuento global - aplicar a todo el carrito
        discountAmount = (subtotalBeforeDiscount * coupon.discountPercentage) / 100
        /*console.log(' Descuento global calculado:', discountAmount)*/
      } else {
        // Para cupones específicos, calcular descuento solo para items aplicables
        let itemsWithDiscount = 0
        
        items.forEach(item => {
          let appliesToItem = false
          let reason = ""
          
          // Verificar si el cupón aplica a este item específico
          switch (coupon.type) {
            case 'category':
              appliesToItem = item.categoryId && coupon.categoryIds.includes(item.categoryId)
              reason = appliesToItem ? 
                `Categoría ${item.categoryId} coincide con ${coupon.categoryIds}` :
                `Categoría ${item.categoryId} NO coincide con ${coupon.categoryIds}`
              break
              
            case 'subcategory':
              appliesToItem = item.subcategoryId && coupon.subcategoryIds.includes(item.subcategoryId)
              reason = appliesToItem ? 
                `Subcategoría ${item.subcategoryId} coincide con ${coupon.subcategoryIds}` :
                `Subcategoría ${item.subcategoryId} NO coincide con ${coupon.subcategoryIds}`
              break
              
            case 'product':
              appliesToItem = coupon.productIds.includes(item.id)
              reason = appliesToItem ? 
                `Producto ${item.id} coincide con ${coupon.productIds}` :
                `Producto ${item.id} NO coincide con ${coupon.productIds}`
              break
              
            case 'multiple':
              appliesToItem = (
                (item.categoryId && coupon.categoryIds.includes(item.categoryId)) ||
                (item.subcategoryId && coupon.subcategoryIds.includes(item.subcategoryId)) ||
                coupon.productIds.includes(item.id)
              )
              reason = appliesToItem ? 
                `Múltiple: categoría ${item.categoryId}, subcategoría ${item.subcategoryId} o producto ${item.id} coincide` :
                `Múltiple: NO coincide categoría ${item.categoryId}, subcategoría ${item.subcategoryId} o producto ${item.id}`
              break
          }
          
         /* console.log(`🔍 ${item.name}: ${reason}`)*/
          
          if (appliesToItem) {
            const itemTotal = item.price * item.quantity
            const itemDiscount = (itemTotal * coupon.discountPercentage) / 100
            discountAmount += itemDiscount
            itemsWithDiscount++
            /*console.log(`📦 Descuento aplicado a ${item.name}: $${itemDiscount}`)*/
          }
        })

        /*console.log(`📊 Resumen: ${itemsWithDiscount} productos aplican de ${items.length} total`)*/
      }

      // REDONDEAR EL DESCUENTO A NÚMERO ENTERO
      discountAmount = roundToInteger(discountAmount)
      /*console.log('💰 Descuento total redondeado:', discountAmount)*/

      // Validar que se haya calculado algún descuento
      if (discountAmount === 0 && coupon.type !== 'global') {
        setCouponError("El cupón no aplica a ningún producto en tu carrito")
        toast({
          title: "Cupón no aplicable",
          description: "Este cupón no aplica a ningún producto en tu carrito",
          variant: "destructive",
        })
        setIsValidatingCoupon(false)
        return
      }

      // APLICAR CUPÓN CON EL DESCUENTO CALCULADO Y REDONDEADO
      applyCoupon(couponCode.trim().toUpperCase(), discountAmount, coupon)
      
      toast({
        title: "¡Cupón aplicado!",
        description: `${coupon.discountPercentage}% de descuento aplicado ($${formatCLP(discountAmount)})`,
      })
      setCouponCode("")
    } else {
      setCouponError(result.error || "Cupón inválido")
      toast({
        title: "Cupón inválido",
        description: result.error || "No se pudo aplicar el cupón",
        variant: "destructive",
      })
    }
  } catch (error) {
    console.error('Error validating coupon:', error)
    setCouponError("Error al validar el cupón")
    toast({
      title: "Error",
      description: "No se pudo validar el cupón",
      variant: "destructive",
    })
  } finally {
    setIsValidatingCoupon(false)
  }
}

  const handleRemoveCoupon = () => {
    removeCoupon()
    toast({
      title: "Cupón removido",
      description: "El descuento ha sido eliminado",
    })
  }

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  if (!selectedAddress) {
    toast({
      title: "Error",
      description: "Por favor selecciona una dirección de envío",
      variant: "destructive",
    })
    return
  }

  const requiredFields = ['email', 'firstName', 'lastName', 'phone']
  const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData].trim())

  if (missingFields.length > 0) {
    toast({
      title: "Error",
      description: `Por favor completa todos los campos requeridos`,
      variant: "destructive",
    })
    return
  }

  setIsProcessing(true)

  let couponId = null
  let couponCodeUsed = null

  if (appliedCoupon && couponDetails) {
    couponId = couponDetails.id
    couponCodeUsed = couponDetails.code
    
    if (couponDetails.currentUses >= couponDetails.maxUses) {
      toast({
        title: "Cupón agotado",
        description: "Este cupón ya ha sido utilizado el máximo de veces permitido",
        variant: "destructive",
      })
      setIsProcessing(false)
      return
    }
  }

  try {
    // 1. Crear la orden en MySQL
    const orderResponse = await fetch('/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          category: item.category,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
        })),
        customerInfo: {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          address: selectedAddress.street,
          city: selectedAddress.communeName,
          region: selectedAddress.regionName,
          postalCode: selectedAddress.postalCode,
          department: selectedAddress.department,
          deliveryInstructions: selectedAddress.deliveryInstructions,
        },
        shippingAddress: selectedAddress,
        totals: {
          subtotal: subtotalBeforeDiscount,
          discount: discountAmount,
          shipping,
          tax,
          total: finalTotal,
        },
        notes: formData.notes,
        couponId: couponId,
        couponCode: couponCodeUsed,
        shippingMethod: shippingMethod,
      }),
    })

    if (await handleRateLimit(orderResponse)) {
      return handleSubmit(e)
    }

    const orderData = await orderResponse.json()

    if (!orderResponse.ok) {
      throw new Error(orderData.error || 'Error al crear la orden')
    }

    /*console.log('✅ Orden creada en MySQL:', orderData)*/

    // 2. MARCAR CUPÓN COMO USADO
    if (couponId) {
      try {
        /*console.log(`🎫 Marcando cupón ${couponId} como usado...`)*/
        const couponUseResponse = await fetch(`/api/coupons/${couponId}/use`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (couponUseResponse.ok) {
          console.log(`✅ Cupón ${couponId} marcado como usado exitosamente`)
        } else {
          console.warn(`⚠️ No se pudo marcar el cupón como usado: ${couponUseResponse.status}`)
        }
      } catch (couponError) {
        console.error('❌ Error al marcar cupón como usado:', couponError)
      }
    }

    // 4. Guardar en el store local (pero NO limpiar carrito todavía)
    const localOrderId = addOrder({
      userId: user?.id,
      items: items.map((item) => ({
        id: item.id.toString(),
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        category: item.category,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
      })),
      customerInfo: {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        address: selectedAddress.street,
        city: selectedAddress.communeName,
        region: selectedAddress.regionName,
        postalCode: selectedAddress.postalCode,
        department: selectedAddress.department,
        deliveryInstructions: selectedAddress.deliveryInstructions,
      },
      shippingAddress: selectedAddress,
      paymentInfo: {
        method: "transbank",
        status: "pending",
      },
      totals: {
        subtotal: subtotalBeforeDiscount,
        discount: discountAmount,
        shipping,
        tax,
        total: finalTotal,
      },
      status: "pending",
      notes: formData.notes,
      couponId: couponId,
      couponCode: couponCodeUsed,
      shippingMethod: shippingMethod,
    })

    /*console.log('✅ Orden creada en store local:', localOrderId)*/

    // 5. Crear transacción en Transbank
    const paymentResponse = await fetch('/api/payment/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: orderData.orderId,
        amount: finalTotal
      }),
    })

    if (await handleRateLimit(paymentResponse)) {
      return handleSubmit(e)
    }

    const paymentData = await paymentResponse.json()

    if (!paymentResponse.ok) {
      throw new Error(paymentData.error || 'Error al crear transacción de pago')
    }

    if (paymentData.success && paymentData.token && paymentData.url) {
      // IMPORTANTE: NO LIMPIAR EL CARRITO AQUÍ
      // Solo redirigir a Transbank
      console.log('🔄 Redirigiendo a Transbank...')
      console.log('🛒 Carrito MANTENIDO hasta confirmación de pago')
      window.location.href = `${paymentData.url}?token_ws=${paymentData.token}`
      
    } else {
      throw new Error('No se pudo crear la transacción de pago')
    }

  } catch (error: any) {
    console.error('❌ Error procesando pedido:', error)
    toast({
      title: "Error",
      description: error.message || "Hubo un problema al procesar tu pedido. Por favor intenta nuevamente.",
      variant: "destructive",
    })
  } finally {
    setIsProcessing(false)
  }
}

  // Función para recargar direcciones manualmente
  const handleReloadAddresses = async () => {
    setLoadingAddresses(true)
    try {
      await loadUserAddresses()
      toast({
        title: "Direcciones actualizadas",
        description: "Las direcciones se han cargado correctamente",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las direcciones",
        variant: "destructive",
      })
    } finally {
      setLoadingAddresses(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a la tienda
        </Link>
      </div>

      {!isAuthenticated && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LogIn className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-medium">¿Ya tienes una cuenta?</h3>
                  <p className="text-sm text-muted-foreground">Inicia sesión para usar tus direcciones guardadas</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/login">
                  <Button variant="outline" size="sm">
                    Iniciar Sesión
                  </Button>
                </Link>

                <Link href="/register">
                  <Button size="sm">
                    Crear Cuenta
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Checkout Form */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Checkout</h1>
            <p className="text-muted-foreground">Completa tu información para finalizar la compra</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Información de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="tu@email.com"
                    disabled={isAuthenticated}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Nombre *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      placeholder="Juan"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Apellido *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      placeholder="Pérez"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+56 9 1234 5678"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Dirección de Envío
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingAddresses ? (
                  <div className="text-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Cargando direcciones...</p>
                  </div>
                ) : isAuthenticated && user?.addresses && user.addresses.length > 0 ? (
                  <>
                    <div className="flex justify-between items-center">
                      <Label>Selecciona una dirección guardada</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleReloadAddresses}
                        disabled={loadingAddresses}
                      >
                        <RefreshCw className={`w-4 h-4 mr-1 ${loadingAddresses ? 'animate-spin' : ''}`} />
                        Actualizar
                      </Button>
                    </div>
                    <Select
                      value={selectedAddress?.id?.toString() || ""}
                      onValueChange={(value) => {
                        const address = user.addresses!.find(addr => addr.id.toString() === value)
                        setSelectedAddress(address)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una dirección" />
                      </SelectTrigger>
                      <SelectContent>
                        {user.addresses.map((address) => (
                          <SelectItem key={address.id} value={address.id.toString()}>
                            <div className="flex flex-col">
                              <span className="font-medium">{address.title}</span>
                              <span className="text-sm text-muted-foreground">
                                {address.street}, {address.communeName}
                                {address.isDefault && " (Predeterminada)"}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedAddress && (
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold">{selectedAddress.title}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {selectedAddress.street}
                              {selectedAddress.hasNoNumber && " (Sin número)"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {selectedAddress.communeName}, {selectedAddress.regionName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Código Postal: {selectedAddress.postalCode}
                            </p>
                            {selectedAddress.department && (
                              <p className="text-sm text-muted-foreground">
                                Depto: {selectedAddress.department}
                              </p>
                            )}
                            {selectedAddress.deliveryInstructions && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <strong>Indicaciones:</strong> {selectedAddress.deliveryInstructions}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        ¿No encuentras tu dirección?
                      </p>
                      <Link href="/profile">
                        <Button variant="outline" size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          Gestionar direcciones
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      {isAuthenticated 
                        ? "No tienes direcciones guardadas" 
                        : "Inicia sesión para usar direcciones guardadas"
                      }
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Link href={isAuthenticated ? "/profile" : "/login"}>
                        <Button>
                          <Plus className="w-4 h-4 mr-2" />
                          {isAuthenticated ? "Agregar Dirección" : "Iniciar Sesión"}
                        </Button>
                      </Link>
                      {isAuthenticated && (
                        <Button variant="outline" onClick={handleReloadAddresses}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Recargar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Método de Envío
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={shippingMethod} onValueChange={(value) => setShippingMethod(value as any)}>
                  <div className="space-y-3">
                    {shippingOptions.map((option) => (
                      <div
                        key={option.id}
                        className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <RadioGroupItem value={option.id} id={option.id} />
                        <Label htmlFor={option.id} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{option.name}</div>
                              <div className="text-sm text-muted-foreground">{option.description}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {totalAfterDiscount >= 50000 ? (
                                  <span className="text-green-600">Gratis</span>
                                ) : (
                                  `$${formatCLP(option.price)}`
                                )}
                              </div>
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
                {totalAfterDiscount >= 50000 && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">🎉 ¡Envío gratis! Tu pedido supera los $50.000</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Método de Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
                      <span className="text-white text-xs font-bold">TB</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">Transbank Webpay</h4>
                      <p className="text-sm text-muted-foreground">
                        Paga seguro con Webpay Plus
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-blue-700">
                    <p>Serás redirigido a Transbank para completar tu pago de manera segura.</p>
                    <p className="mt-1">Aceptamos todas las tarjetas de crédito, débito y prepago.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notas del Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Instrucciones especiales para la entrega..."
                  rows={3}
                />
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Items */}
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <Image
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Cantidad: {item.quantity}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${formatCLP(item.price * item.quantity)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Coupon Section */}
              <div className="space-y-2">
                <Label htmlFor="coupon" className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Código de Cupón
                </Label>
                {appliedCoupon ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                    <Tag className="w-4 h-4 text-green-600" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-green-800">{appliedCoupon}</span>
                      {couponDetails && (
                        <div className="text-xs text-green-600 mt-1">
                          {couponDetails.discountPercentage}% de descuento aplicado
                          {couponDetails.type !== 'global' && (
                            <span className="block text-green-500">
                              ({getCouponTypeText(couponDetails.type)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      className="h-auto p-1 hover:bg-green-100"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        id="coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="CODIGO2025"
                        className="uppercase"
                        disabled={isValidatingCoupon}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleApplyCoupon}
                        disabled={isValidatingCoupon || !couponCode.trim()}
                      >
                        {isValidatingCoupon ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Aplicar"
                        )}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-sm text-red-600">{couponError}</p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Totals - VERSIÓN CORREGIDA SIN DECIMALES */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${formatCLP(subtotalBeforeDiscount)}</span>
                </div>
                
                {/* DESCUENTO APLICADO */}
                {discountAmount > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Descuento ({appliedCoupon})
                      </span>
                      <span>-${formatCLP(discountAmount)}</span>
                    </div>
                    
                    {/* SUBTOTAL DESPUÉS DEL DESCUENTO */}
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Subtotal con descuento</span>
                      <span className="font-medium">${formatCLP(totalAfterDiscount)}</span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-between">
                  <span>Envío</span>
                  <span>{shipping === 0 ? "Gratis" : `$${formatCLP(shipping)}`}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (19%)</span>
                  <span>${formatCLP(tax)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${formatCLP(finalTotal)}</span>
                </div>
                
                {/* AHORRO TOTAL */}
                {discountAmount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                    <div className="flex justify-between items-center text-green-800">
                      <span className="font-medium">¡Estás ahorrando!</span>
                      <span className="font-bold">${formatCLP(discountAmount)}</span>
                    </div>
                    {couponDetails && (
                      <p className="text-xs text-green-600 mt-1">
                        {couponDetails.discountPercentage}% de descuento {couponDetails.type !== 'global' ? `aplicado a productos seleccionados` : 'aplicado a toda tu compra'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                disabled={isProcessing || !selectedAddress}
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  `Pagar con Transbank $${formatCLP(finalTotal)}`
                )}
              </Button>

              {!selectedAddress && (
                <p className="text-sm text-red-600 text-center">
                  Por favor selecciona una dirección de envío
                </p>
              )}

              <div className="text-xs text-muted-foreground text-center">
                <Shield className="w-4 h-4 inline mr-1" />
                Pago seguro con Transbank Webpay
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}