// app/checkout/page.tsx
"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useCartStore } from "@/lib/cart-store"
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
import { ArrowLeft, CreditCard, Truck, Shield, LogIn, Tag, X, Loader2, MapPin, Plus, RefreshCw, Check } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useCheckoutTimer } from '@/hooks/use-checkout-timer'
import { CheckoutTimer } from '@/components/checkout-timer'
import { motion, AnimatePresence } from "framer-motion"

// Interfaces para las opciones de Chilexpress
interface ChilexpressOption {
  id?: string;
  type?: string;
  typeCode?: number;
  serviceTypeCode?: number;
  name: string;
  price: number;
  actualShippingCost?: number;
  finalWeight?: number;
  finalWeightFormatted?: string;
  didUseVolumetricWeight?: boolean;
  deliveryDescription?: string;
  conditions?: string;
  branches?: Array<{
    id?: number;
    name: string;
    address: string;
    telephone?: string;
    businessHours?: any[];
    latitude?: string;
    longitude?: string;
  }>;
  requiresBranchSelection?: boolean;
  selectedBranch?: any;
  isCashOnDelivery?: boolean;
  isHomeDelivery?: boolean;
  isBranchPickup?: boolean;
}

// Función para manejar rate limit
const handleRateLimit = async (response: Response) => {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000
    await new Promise(resolve => setTimeout(resolve, waitTime))
    return true
  }
  return false
}

// Función helper para tipos de cupón
const getCouponTypeText = (type: string) => {
  switch (type) {
    case 'global': return 'Descuento global'
    case 'category': return 'Descuento por categoría'
    case 'subcategory': return 'Descuento por subcategoría'
    case 'product': return 'Descuento por producto'
    case 'multiple': return 'Descuento múltiple'
    default: return 'Descuento'
  }
}

const roundToInteger = (amount: number): number => Math.round(amount)
const formatCLP = (price: number): string => roundToInteger(price).toLocaleString('es-CL')

export default function CheckoutPage() {
  const {
    items,
    getTotalPrice,
    getSubtotalPrice,
    getDiscountAmount,
    shippingMethod,
    setShippingMethod,
    setShippingCost,
    getShippingCost,
    appliedCoupon,
    couponDiscount,
    couponDetails,
    applyCoupon,
    removeCoupon,
    isLoading: cartLoading,
    hasActiveCheckout,
  } = useCartStore()
  
  const { user, isAuthenticated, loadUserAddresses } = useAuthStore()
  const { addOrder } = useOrderStore()
  const router = useRouter()
  const { toast } = useToast()

  const { formattedTime, isExpired, progress, isReserving, confirmPurchase } = useCheckoutTimer()

  const [formData, setFormData] = useState({
    email: "", firstName: "", lastName: "", phone: "", notes: "",
  })

  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
  const [couponCode, setCouponCode] = useState("")
  const [couponError, setCouponError] = useState("")
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [addressLoadAttempts, setAddressLoadAttempts] = useState(0)

  // Estados para Chilexpress
  const [chilexpressOptions, setChilexpressOptions] = useState<ChilexpressOption[]>([])
  const [isLoadingShipping, setIsLoadingShipping] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [selectedChilexpressOption, setSelectedChilexpressOption] = useState<ChilexpressOption | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<any>(null)
  const [showBranchSelector, setShowBranchSelector] = useState(false)
  const [availableBranches, setAvailableBranches] = useState<any[]>([])
  const [branchSearchTerm, setBranchSearchTerm] = useState("")

  // Cálculos
  const subtotalBeforeDiscount = roundToInteger(getSubtotalPrice())
  const discountAmount = roundToInteger(getDiscountAmount())
  const totalAfterDiscount = roundToInteger(getTotalPrice())
  const shipping = roundToInteger(getShippingCost())
  const finalTotal = roundToInteger(totalAfterDiscount + shipping)

  // Resetear sucursales cuando cambia la dirección
  useEffect(() => {
    setSelectedBranch(null);
    setShowBranchSelector(false);
    setBranchSearchTerm("");
  }, [selectedAddress?.communeName]);

  // Efecto para redirigir cuando expira el tiempo
  useEffect(() => {
    if (isExpired) {
      toast({
        title: "⏰ Tiempo agotado",
        description: "Tu sesión de compra ha expirado. Serás redirigido al inicio.",
        variant: "destructive",
        duration: 3000,
      });
      
      const timer = setTimeout(() => {
        router.push("/");
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isExpired, router, toast]);

  // Efecto para manejar cuando cambia la opción seleccionada
  useEffect(() => {
    if (selectedChilexpressOption) {
      if (selectedChilexpressOption.requiresBranchSelection && selectedChilexpressOption.branches && selectedChilexpressOption.branches.length > 0) {
        setShowBranchSelector(true);
      } else {
        setShowBranchSelector(false);
        setSelectedBranch(null);
      }
    }
  }, [selectedChilexpressOption]);

  // Función para manejar selección de sucursal
  const handleSelectBranch = (option: ChilexpressOption, branch: any) => {
    console.log("📦 Seleccionando sucursal:", branch);
    setSelectedBranch(branch);
    // Actualizar la opción seleccionada
    const updatedOption = {
      ...option,
      selectedBranch: branch,
      deliveryDescription: `Retiro en ${branch.name} - ${branch.address}`,
    };
    setSelectedChilexpressOption(updatedOption);
    setShowBranchSelector(false);
  };

  // Función para obtener tarifas de Chilexpress
  const fetchShippingRates = useCallback(async (communeName: string) => {
    if (!communeName || items.length === 0) return
    
    setIsLoadingShipping(true)
    setShippingError(null)
    setShowBranchSelector(false)
    setSelectedBranch(null)
    setAvailableBranches([]) // Resetear sucursales
    
    try {
      const totalValue = getTotalPrice();
      
      const itemsWithDimensions = items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        weight: item.weight || 0.5,
        height: item.height || 10,
        width: item.width || 15,
        length: item.length || 20,
      }));
      
      const response = await fetch('/api/shipping/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communeName,
          declaredWorth: totalValue,
          items: itemsWithDimensions,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.options && data.options.length > 0) {
        setChilexpressOptions(data.options);
        setShippingError(null);
        
        // Buscar la opción de retiro en sucursal y guardar sus branches
        const branchOption = data.options.find((o: any) => o.type === "branch_pickup");
        if (branchOption && branchOption.branches && branchOption.branches.length > 0) {
          setAvailableBranches(branchOption.branches);
        }
        
        // Seleccionar opción por defecto (priorizar envío por pagar o envío a domicilio)
        let defaultOption = data.options[0];
        const cashOnDeliveryOption = data.options.find((o: any) => o.isCashOnDelivery);
        if (cashOnDeliveryOption) {
          defaultOption = cashOnDeliveryOption;
        }
        
        setSelectedChilexpressOption(defaultOption);
        setShippingCost(defaultOption.price);
        
        const isExpress = defaultOption.serviceTypeCode === 2 || defaultOption.serviceTypeCode === 3;
        setShippingMethod(isExpress ? "express" : "standard");
        
        // Si es retiro en sucursal, mostrar selector
        if (defaultOption.type === "branch_pickup" && defaultOption.branches && defaultOption.branches.length > 0) {
          setShowBranchSelector(true);
        }
      } else {
        setShippingError(data.error || "No se encontraron tarifas de envío");
      }
    } catch (error) {
      console.error("Error fetching shipping rates:", error);
      setShippingError("Error al calcular el costo de envío");
    } finally {
      setIsLoadingShipping(false);
    }
  }, [items, getTotalPrice, setShippingCost, setShippingMethod]);

  // Efecto para obtener tarifas cuando cambia la comuna
  useEffect(() => {
    if (selectedAddress?.communeName && items.length > 0) {
      fetchShippingRates(selectedAddress.communeName)
    }
  }, [selectedAddress?.communeName, items, fetchShippingRates])

  // Efecto para cargar direcciones del usuario
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
  }, [isAuthenticated, user, loadUserAddresses, addressLoadAttempts])

  // Seleccionar dirección predeterminada
  useEffect(() => {
    if (user?.addresses && user.addresses.length > 0 && !selectedAddress) {
      const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0]
      setSelectedAddress(defaultAddress)
    }
  }, [user?.addresses, selectedAddress])

  const handleSelectShippingOption = (option: ChilexpressOption) => {
    console.log("📦 Seleccionando opción:", option);
    setSelectedChilexpressOption(option);
    const price = option.price ?? 0;
    setShippingCost(price);
    
    const isExpress = option.serviceTypeCode === 2 || option.serviceTypeCode === 3;
    setShippingMethod(isExpress ? "express" : "standard");
    
    // Si es retiro en sucursal y tiene branches, mostrar selector y guardar branches
    if (option.type === "branch_pickup" && option.branches && option.branches.length > 0) {
      setAvailableBranches(option.branches);
      setShowBranchSelector(true);
      setSelectedBranch(null); // Resetear sucursal seleccionada
    } else {
      setShowBranchSelector(false);
      setSelectedBranch(null);
      setAvailableBranches([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isExpired) {
      toast({ title: "⏰ Tiempo agotado", description: "Tu sesión ha expirado", variant: "destructive" })
      router.push('/')
      return
    }
    
    if (!selectedAddress) {
      toast({ title: "Error", description: "Selecciona una dirección de envío", variant: "destructive" })
      return
    }

    if (!selectedChilexpressOption) {
      toast({ title: "Error", description: "Selecciona un método de envío", variant: "destructive" })
      return
    }

    if (selectedChilexpressOption.requiresBranchSelection && !selectedBranch) {
      toast({ title: "Error", description: "Por favor selecciona una sucursal para retirar", variant: "destructive" })
      return
    }

    setIsProcessing(true)

    try {
      const orderResponse = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            id: item.id, name: item.name, price: item.price,
            quantity: item.quantity, image: item.image, category: item.category,
          })),
          customerInfo: {
            email: formData.email, firstName: formData.firstName,
            lastName: formData.lastName, phone: formData.phone,
            address: selectedAddress.street, city: selectedAddress.communeName,
            region: selectedAddress.regionName, postalCode: selectedAddress.postalCode,
          },
          shippingAddress: selectedAddress,
          totals: { subtotal: subtotalBeforeDiscount, discount: discountAmount, shipping, total: finalTotal },
          notes: formData.notes,
          couponId: appliedCoupon ? couponDetails?.id : null,
          couponCode: appliedCoupon,
          shippingMethod: shippingMethod,
          shippingDetails: {
            carrier: "Chilexpress",
            serviceName: selectedChilexpressOption.name,
            serviceCode: selectedChilexpressOption.typeCode,
            finalWeight: selectedChilexpressOption.finalWeight,
            selectedBranch: selectedBranch ? {
              id: selectedBranch.id,
              name: selectedBranch.name,
              address: selectedBranch.address,
              telephone: selectedBranch.telephone,
            } : null,
            isCashOnDelivery: selectedChilexpressOption.isCashOnDelivery,
            actualShippingCost: selectedChilexpressOption.actualShippingCost,
          }
        }),
      })

      const orderData = await orderResponse.json()
      if (!orderResponse.ok) throw new Error(orderData.error)

      addOrder({
        userId: user?.id,
        items: items.map((item) => ({ ...item, id: item.id.toString() })),
        customerInfo: { ...formData, address: selectedAddress.street, city: selectedAddress.communeName, region: selectedAddress.regionName, postalCode: selectedAddress.postalCode },
        shippingAddress: selectedAddress,
        paymentInfo: { method: "transbank", status: "pending" },
        totals: { subtotal: subtotalBeforeDiscount, discount: discountAmount, shipping, tax: 0, total: finalTotal },
        status: "pending",
        notes: formData.notes,
        couponId: appliedCoupon ? couponDetails?.id : null,
        couponCode: appliedCoupon,
        shippingMethod: shippingMethod,
      })

      const paymentResponse = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderData.orderId, amount: finalTotal }),
      })

      const paymentData = await paymentResponse.json()
      if (paymentData.success && paymentData.token && paymentData.url) {
        window.location.href = `${paymentData.url}?token_ws=${paymentData.token}`
      } else {
        throw new Error('No se pudo crear la transacción de pago')
      }

    } catch (error: any) {
      console.error('Error:', error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

  // Filtrar sucursales por término de búsqueda
  const filteredBranches = selectedChilexpressOption?.branches?.filter(branch =>
    branch.name.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(branchSearchTerm.toLowerCase())
  ) || [];

  if (cartLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-2">Cargando carrito...</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Tu carrito está vacío</h1>
        <Link href="/">
          <Button><ArrowLeft className="w-4 h-4 mr-2" />Continuar Comprando</Button>
        </Link>
      </div>
    )
  }

  if (isExpired) {
  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 space-y-4"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
        </div>
        <h1 className="text-2xl font-bold">⏰ Tiempo agotado</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Tu sesión de compra ha expirado. Serás redirigido al inicio en unos segundos...
        </p>
        <Button onClick={() => router.push("/")} className="mt-4">
          Ir ahora
        </Button>
      </motion.div>
    </div>
  )
}

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />Volver a la tienda
        </Link>
      </div>

      <CheckoutTimer timeLeft={formattedTime} progress={progress} isExpired={isExpired} />

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Formulario de Checkout */}
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Checkout</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información de Contacto */}
            <Card>
              <CardHeader><CardTitle>Información de Contacto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Email *</Label>
                  <Input 
                    name="email" 
                    type="email" 
                    required 
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                    disabled={isAuthenticated} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre *</Label>
                    <Input 
                      name="firstName" 
                      required 
                      value={formData.firstName} 
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})} 
                    />
                  </div>
                  <div>
                    <Label>Apellido *</Label>
                    <Input 
                      name="lastName" 
                      required 
                      value={formData.lastName} 
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})} 
                    />
                  </div>
                </div>
                <div>
                  <Label>Teléfono *</Label>
                  <Input 
                    name="phone" 
                    type="tel" 
                    required 
                    value={formData.phone} 
                    onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dirección de Envío */}
            <Card>
              <CardHeader><CardTitle>Dirección de Envío</CardTitle></CardHeader>
              <CardContent>
                {loadingAddresses ? (
                  <div className="text-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    <p className="mt-2">Cargando direcciones...</p>
                  </div>
                ) : isAuthenticated && user?.addresses && user.addresses.length > 0 ? (
                  <>
                    <Select value={selectedAddress?.id?.toString()} onValueChange={(value) => {
                      const address = user.addresses!.find(addr => addr.id.toString() === value)
                      setSelectedAddress(address)
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una dirección" />
                      </SelectTrigger>
                      <SelectContent>
                        {user.addresses.map((address) => (
                          <SelectItem key={address.id} value={address.id.toString()}>
                            {address.title} - {address.street}, {address.communeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Link href="/profile" className="mt-4 block">
                      <Button variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />Gestionar direcciones
                      </Button>
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <Link href="/login">
                      <Button>Iniciar Sesión para usar direcciones</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Método de Envío */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Método de Envío
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingShipping ? (
                    <div className="text-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Calculando opciones de envío...</p>
                    </div>
                  ) : shippingError ? (
                    <div className="text-center py-6 text-red-600">
                      <p className="text-sm">{shippingError}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fetchShippingRates(selectedAddress?.communeName)} 
                        className="mt-2"
                      >
                        Reintentar
                      </Button>
                    </div>
                  ) : chilexpressOptions.length > 0 ? (
                      <div className="space-y-4">
                        <RadioGroup 
                        value={selectedChilexpressOption?.id || selectedChilexpressOption?.serviceTypeCode?.toString() || selectedChilexpressOption?.type} 
                        onValueChange={(value) => {
                          const option = chilexpressOptions.find(o => 
                            o.id === value || 
                            o.serviceTypeCode?.toString() === value ||
                            o.type === value
                          );
                          if (option) handleSelectShippingOption(option);
                        }}
                      >
                        <div className="space-y-3">
                          {chilexpressOptions.map((option) => {
                            const uniqueId = option.id || `${option.type}_${option.serviceTypeCode || Math.random()}`;
                            const isCashOnDelivery = option.isCashOnDelivery || option.type === "cash_on_delivery";
                            const isBranchPickup = option.type === "branch_pickup";
                            const price = option.price ?? 0;
                            
                            return (
                              <div
                                key={uniqueId}
                                className={`flex items-start space-x-3 border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
                                  isCashOnDelivery ? "bg-amber-50 border-amber-200" : 
                                  isBranchPickup ? "bg-blue-50 border-blue-200" : ""
                                }`}
                              >
                                <RadioGroupItem value={uniqueId} id={uniqueId} className="mt-1" />
                                <Label htmlFor={uniqueId} className="flex-1 cursor-pointer">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium">
                                        {option.name}
                                        {isCashOnDelivery && option.actualShippingCost && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="text-sm text-muted-foreground mt-1">
                                        {option.deliveryDescription}
                                      </div>
                                      
                                      {option.conditions && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          {option.conditions}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right font-medium ml-4">
                                      {price === 0 ? (
                                        <span className="text-green-600">Gratis</span>
                                      ) : (
                                        <div>${formatCLP(price)}</div>
                                      )}
                                    </div>
                                  </div>
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      </RadioGroup>
                      {/* Selector de sucursales */}
                      {showBranchSelector && selectedChilexpressOption?.type === "branch_pickup" && availableBranches.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 p-4 border rounded-lg bg-blue-50 border-blue-200"
                        >
                          <Label className="font-semibold flex items-center gap-2 mb-3">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            Selecciona la sucursal donde deseas retirar
                            <Badge variant="secondary" className="ml-2">
                              {availableBranches.length} sucursales disponibles
                            </Badge>
                          </Label>
                          
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {availableBranches.map((branch: any, idx: number) => (
                              <div
                                key={branch.id || idx}
                                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                  selectedBranch?.id === branch.id
                                    ? "border-blue-500 bg-blue-100 ring-2 ring-blue-200"
                                    : "border-gray-200 bg-white hover:border-blue-300"
                                }`}
                                onClick={() => handleSelectBranch(selectedChilexpressOption, branch)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                                      {branch.name}
                                      {selectedBranch?.id === branch.id && (
                                        <Badge className="bg-blue-600 text-white text-xs">Seleccionada</Badge>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {branch.address}
                                    </div>
                                    {branch.telephone && branch.telephone !== "No disponible" && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {branch.telephone}
                                      </div>
                                    )}
                                    {branch.businessHours && branch.businessHours.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-2 pt-1 border-t border-blue-100">
                                        <span className="font-medium">Horario:</span>{' '}
                                        {branch.businessHours[0]?.day}: {branch.businessHours[0]?.initialStartHour} - {branch.businessHours[0]?.initialEndHour}
                                        {branch.businessHours[0]?.finalStartHour && branch.businessHours[0]?.finalEndHour && (
                                          <span>, {branch.businessHours[0]?.finalStartHour} - {branch.businessHours[0]?.finalEndHour}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {selectedBranch?.id === branch.id && (
                                    <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          {selectedBranch && (
                            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs text-green-700 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Sucursal seleccionada: <strong>{selectedBranch.name}</strong>
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <p>No hay métodos de envío disponibles</p>
                      <p className="text-xs mt-2">Selecciona una dirección para cotizar</p>
                    </div>
                  )}
                </CardContent>
              </Card>

            {/* Método de Pago */}
            <Card>
              <CardHeader><CardTitle>Método de Pago</CardTitle></CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-semibold">Transbank Webpay</h4>
                  <p className="text-sm">Paga seguro con tarjetas de crédito, débito y prepago</p>
                </div>
              </CardContent>
            </Card>

            {/* Notas del Pedido */}
            <Card>
              <CardHeader><CardTitle>Notas del Pedido</CardTitle></CardHeader>
              <CardContent>
                <Textarea 
                  name="notes" 
                  value={formData.notes} 
                  onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                  rows={3} 
                  placeholder="Instrucciones especiales para la entrega..."
                />
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Resumen del Pedido */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Resumen del Pedido</CardTitle></CardHeader>
            <CardContent className="space-y-4">
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
                    <p className="font-medium text-sm line-clamp-2">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                      <span className="text-xs text-muted-foreground">x{item.quantity}</span>
                    </div>
                  </div>
                  <div className="font-medium text-right">
                    ${formatCLP(item.price * item.quantity)}
                  </div>
                </div>
              ))}
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${formatCLP(subtotalBeforeDiscount)}</span>
                </div>
                
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Descuento ({appliedCoupon})
                    </span>
                    <span>-${formatCLP(discountAmount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span>Envío</span>
                  <span>{shipping === 0 ? "Gratis" : `$${formatCLP(shipping)}`}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between text-lg font-bold">
                  <span>Total a pagar</span>
                  <span>${formatCLP(finalTotal)}</span>
                </div>
                
                {selectedChilexpressOption?.isCashOnDelivery && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      El envío se pagará al momento de la entrega. El monto mostrado corresponde solo a los productos.
                    </p>
                  </div>
                )}
                
                {selectedChilexpressOption?.isBranchPickup && selectedBranch && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700 flex items-start gap-2">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>Retirarás tu pedido en: <strong>{selectedBranch.name}</strong><br />
                      {selectedBranch.address}</span>
                    </p>
                  </div>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                disabled={isProcessing || !selectedAddress || !selectedChilexpressOption || isLoadingShipping || (selectedChilexpressOption?.requiresBranchSelection && !selectedBranch)} 
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
                ) : isLoadingShipping ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calculando envío...</>
                ) : (
                  `Pagar $${formatCLP(finalTotal)}`
                )}
              </Button>
              
              {selectedChilexpressOption?.requiresBranchSelection && !selectedBranch && (
                <p className="text-xs text-red-500 text-center mt-2">
                  * Debes seleccionar una sucursal para continuar
                </p>
              )}
              
              <div className="text-xs text-muted-foreground text-center">
                <Shield className="w-3 h-3 inline mr-1" />
                Pago seguro con Transbank Webpay
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}