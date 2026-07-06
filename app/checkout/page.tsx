"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { useCartStore } from "@/lib/cart-store"
import { useAuthStore } from "@/lib/auth-store"
import { useGuestStore } from "@/lib/guest-store"
import { useOrderStore } from "@/lib/order-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Truck, Shield, LogIn, Tag, Loader2, MapPin, Plus, Check, User, ShoppingBag, AlertCircle, Store } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useCheckoutTimer } from '@/hooks/use-checkout-timer'
import { CheckoutTimer } from '@/components/checkout-timer'
import { motion, AnimatePresence } from "framer-motion"

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

interface Region {
  name: string;
  region_iso_3166_2: string;
  romanNumber: string;
  number: string;
  communes: Array<{
    name: string;
    postalCode: string;
  }>;
}

interface RegionsResponse {
  regions: Region[];
}

const roundToInteger = (amount: number): number => Math.round(amount)
const formatCLP = (price: number): string => roundToInteger(price).toLocaleString('es-CL')

type DeliveryMethod = 'home' | 'pickup'

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
  const { createGuestSession, isGuest, clearGuestSession, getGuestSession } = useGuestStore()
  const { addOrder } = useOrderStore()
  const router = useRouter()
  const { toast } = useToast()

  const { formattedTime, isExpired, progress, isReserving, confirmPurchase } = useCheckoutTimer()

  // Estado para método de entrega
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('home')

  const [formData, setFormData] = useState({
    email: "", firstName: "", lastName: "", phone: "", notes: "",
  })

  const [selectedAddress, setSelectedAddress] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [addressLoadAttempts, setAddressLoadAttempts] = useState(0)

  const [isGuestMode, setIsGuestMode] = useState(false)
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestData, setGuestData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    confirmEmail: ''
  })
  const [guestFormErrors, setGuestFormErrors] = useState<Record<string, string>>({})

  const [regions, setRegions] = useState<Region[]>([])
  const [loadingRegions, setLoadingRegions] = useState(false)
  const [manualAddress, setManualAddress] = useState({
    street: '',
    regionIso: '',
    regionName: '',
    communeName: '',
    postalCode: '',
    department: '',
    deliveryInstructions: ''
  })
  const [manualAddressErrors, setManualAddressErrors] = useState<Record<string, string>>({})

  const [chilexpressOptions, setChilexpressOptions] = useState<ChilexpressOption[]>([])
  const [isLoadingShipping, setIsLoadingShipping] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)
  const [selectedChilexpressOption, setSelectedChilexpressOption] = useState<ChilexpressOption | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<any>(null)
  const [showBranchSelector, setShowBranchSelector] = useState(false)
  const [availableBranches, setAvailableBranches] = useState<any[]>([])

  const subtotalBeforeDiscount = roundToInteger(getSubtotalPrice())
  const discountAmount = roundToInteger(getDiscountAmount())
  const totalAfterDiscount = roundToInteger(getTotalPrice())
  const shipping = deliveryMethod === 'pickup' ? 0 : roundToInteger(getShippingCost())
  const finalTotal = roundToInteger(totalAfterDiscount + shipping)

  // Dirección del local para retiro
  const STORE_ADDRESS = {
    street: 'Arcangel 1200',
    communeName: 'San Miguel',
    regionName: 'Región Metropolitana',
    regionIso: 'CL-RM',
    postalCode: '8900000',
    department: '',
    deliveryInstructions: 'Retirar en local - Arcangel 1200, San Miguel'
  }

  useEffect(() => {
    const fetchRegions = async () => {
      setLoadingRegions(true)
      try {
        const response = await fetch('/api/regions')
        const data: RegionsResponse = await response.json()
        setRegions(data.regions || [])
      } catch (error) {
        console.error('Error loading regions:', error)
      } finally {
        setLoadingRegions(false)
      }
    }
    fetchRegions()
  }, [])

  const selectedRegion = regions.find(r => r.region_iso_3166_2 === manualAddress.regionIso)

  // Cuando se cambia el método de entrega, resetear selecciones
  useEffect(() => {
    if (deliveryMethod === 'pickup') {
      setShippingCost(0)
      setSelectedChilexpressOption(null)
      setChilexpressOptions([])
      setShippingError(null)
      setSelectedBranch(null)
      setShowBranchSelector(false)
    } else {
      // Si vuelve a home y ya hay dirección, recalcular envío
      if (selectedAddress?.communeName && items.length > 0) {
        fetchShippingRates(selectedAddress.communeName)
      }
    }
  }, [deliveryMethod])

  useEffect(() => {
    if (!isAuthenticated) {
      const existingGuest = getGuestSession()
      if (existingGuest && !isGuestMode) {
        setIsGuestMode(true)
        setFormData({
          ...formData,
          email: existingGuest.email,
          firstName: existingGuest.firstName,
          lastName: existingGuest.lastName,
          phone: existingGuest.phone
        })
        setGuestData({
          ...guestData,
          email: existingGuest.email,
          firstName: existingGuest.firstName,
          lastName: existingGuest.lastName,
          phone: existingGuest.phone,
          confirmEmail: existingGuest.email
        })
      }
    } else {
      if (isGuestMode) {
        setIsGuestMode(false)
        clearGuestSession()
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    const checkAuthAndClearGuest = async () => {
      if (isAuthenticated) {
        clearGuestSession()
        setIsGuestMode(false)
        setShowGuestForm(false)
      }
    }
    checkAuthAndClearGuest()
  }, [isAuthenticated, clearGuestSession])

  useEffect(() => {
    setSelectedBranch(null);
    setShowBranchSelector(false);
  }, [selectedAddress?.communeName]);

  useEffect(() => {
    if (isExpired) {
      toast({
        title: "Tiempo agotado",
        description: "Tu sesion de compra ha expirado. Seras redirigido al inicio.",
        variant: "destructive",
        duration: 3000,
      });
      const timer = setTimeout(() => {
        router.push("/");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isExpired, router, toast]);

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

  const handleSelectBranch = (option: ChilexpressOption, branch: any) => {
    setSelectedBranch(branch);
    const updatedOption = {
      ...option,
      selectedBranch: branch,
      deliveryDescription: `Retiro en ${branch.name} - ${branch.address}`,
    };
    setSelectedChilexpressOption(updatedOption);
    setShowBranchSelector(false);
  };

  const fetchShippingRates = useCallback(async (communeName: string) => {
    if (!communeName || items.length === 0) return
    
    setIsLoadingShipping(true)
    setShippingError(null)
    setShowBranchSelector(false)
    setSelectedBranch(null)
    setAvailableBranches([])
    
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
        
        const branchOption = data.options.find((o: any) => o.type === "branch_pickup");
        if (branchOption && branchOption.branches && branchOption.branches.length > 0) {
          setAvailableBranches(branchOption.branches);
        }
        
        let defaultOption = data.options[0];
        const cashOnDeliveryOption = data.options.find((o: any) => o.isCashOnDelivery);
        if (cashOnDeliveryOption) {
          defaultOption = cashOnDeliveryOption;
        }
        
        setSelectedChilexpressOption(defaultOption);
        setShippingCost(defaultOption.price);
        
        const isExpress = defaultOption.serviceTypeCode === 2 || defaultOption.serviceTypeCode === 3;
        setShippingMethod(isExpress ? "express" : "standard");
        
        if (defaultOption.type === "branch_pickup" && defaultOption.branches && defaultOption.branches.length > 0) {
          setShowBranchSelector(true);
        }
      } else {
        setShippingError(data.error || "No se encontraron tarifas de envio");
      }
    } catch (error) {
      console.error("Error fetching shipping rates:", error);
      setShippingError("Error al calcular el costo de envio");
    } finally {
      setIsLoadingShipping(false);
    }
  }, [items, getTotalPrice, setShippingCost, setShippingMethod]);

  useEffect(() => {
    if (deliveryMethod === 'home' && selectedAddress?.communeName && items.length > 0) {
      fetchShippingRates(selectedAddress.communeName)
    }
  }, [selectedAddress?.communeName, items, fetchShippingRates, deliveryMethod])

  useEffect(() => {
    const loadUserData = async () => {
      if (isAuthenticated && user && !isGuestMode) {
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
  }, [isAuthenticated, user, loadUserAddresses, addressLoadAttempts, isGuestMode])

  useEffect(() => {
    if (user?.addresses && user.addresses.length > 0 && !selectedAddress && !isGuestMode) {
      const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0]
      setSelectedAddress(defaultAddress)
    }
  }, [user?.addresses, selectedAddress, isGuestMode])

  const validateGuestForm = () => {
    const errors: Record<string, string> = {}
    
    if (!guestData.firstName) errors.firstName = "Nombre requerido"
    if (!guestData.lastName) errors.lastName = "Apellido requerido"
    if (!guestData.email) errors.email = "Email requerido"
    if (!guestData.confirmEmail) errors.confirmEmail = "Confirmar email requerido"
    if (guestData.email !== guestData.confirmEmail) errors.confirmEmail = "Los correos no coinciden"
    if (!guestData.phone) errors.phone = "Teléfono requerido"
    
    setGuestFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateManualAddress = () => {
    const errors: Record<string, string> = {}
    
    if (!manualAddress.street) errors.street = "Calle requerida"
    if (!manualAddress.regionIso) errors.regionIso = "Región requerida"
    if (!manualAddress.communeName) errors.communeName = "Comuna requerida"
    if (!manualAddress.postalCode) errors.postalCode = "Código postal requerido"
    
    setManualAddressErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateGuestForm()) {
      toast({
        title: "Error de validación",
        description: "Por favor completa todos los campos correctamente",
        variant: "destructive"
      })
      return
    }
    
    const sessionId = createGuestSession({
      email: guestData.email,
      firstName: guestData.firstName,
      lastName: guestData.lastName,
      phone: guestData.phone
    })
    
    setFormData({
      ...formData,
      email: guestData.email,
      firstName: guestData.firstName,
      lastName: guestData.lastName,
      phone: guestData.phone
    })
    
    setIsGuestMode(true)
    setShowGuestForm(false)
    
    toast({
      title: "Modo invitado activado",
      description: "Completa tu dirección para continuar",
    })
  }

  const handleManualAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setManualAddress(prev => ({ ...prev, [name]: value }))
    
    if (manualAddressErrors[name]) {
      setManualAddressErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    
    if (name === 'regionIso') {
      setManualAddress(prev => ({
        ...prev,
        regionIso: value,
        regionName: selectedRegion?.name || '',
        communeName: '',
        postalCode: ''
      }))
    }
    
    if (name === 'communeName') {
      setManualAddress(prev => ({
        ...prev,
        communeName: value
      }))
    }
  }

  const handleManualAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateManualAddress()) {
      toast({
        title: "Error de validación",
        description: "Por favor completa todos los campos de dirección",
        variant: "destructive"
      })
      return
    }
    
    const tempAddress = {
      id: Date.now(),
      title: 'Dirección de envío',
      street: manualAddress.street,
      hasNoNumber: false,
      regionIso: manualAddress.regionIso,
      regionName: manualAddress.regionName || selectedRegion?.name || '',
      communeName: manualAddress.communeName,
      postalCode: manualAddress.postalCode,
      department: manualAddress.department,
      deliveryInstructions: manualAddress.deliveryInstructions,
      isDefault: true
    }
    
    setSelectedAddress(tempAddress)
    
    toast({
      title: "Dirección guardada",
      description: "Ahora selecciona un método de envío",
    })
  }

  const handleSelectShippingOption = (option: ChilexpressOption) => {
    setSelectedChilexpressOption(option);
    const price = option.price ?? 0;
    setShippingCost(price);
    
    const isExpress = option.serviceTypeCode === 2 || option.serviceTypeCode === 3;
    setShippingMethod(isExpress ? "express" : "standard");
    
    if (option.type === "branch_pickup" && option.branches && option.branches.length > 0) {
      setAvailableBranches(option.branches);
      setShowBranchSelector(true);
      setSelectedBranch(null);
    } else {
      setShowBranchSelector(false);
      setSelectedBranch(null);
      setAvailableBranches([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isExpired) {
      toast({ title: "Tiempo agotado", description: "Tu sesión ha expirado", variant: "destructive" })
      router.push('/')
      return
    }
    
    if (deliveryMethod === 'home') {
      if (!selectedAddress) {
        toast({ title: "Error", description: "Selecciona o ingresa una dirección de envío", variant: "destructive" })
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
    }

    setIsProcessing(true)

    try {
      const isGuestUser = isGuestMode && !isAuthenticated
      const apiEndpoint = isGuestUser ? '/api/orders/create-guest' : '/api/orders/create'
      
      let shippingAddress
      let shippingAddressForOrder 
      
      if (deliveryMethod === 'pickup') {
        const pickupAddress = {
          street: STORE_ADDRESS.street,
          hasNoNumber: false,
          regionIso: STORE_ADDRESS.regionIso,
          regionName: STORE_ADDRESS.regionName,
          communeName: STORE_ADDRESS.communeName,
          postalCode: STORE_ADDRESS.postalCode,
          department: STORE_ADDRESS.department || '',
          deliveryInstructions: STORE_ADDRESS.deliveryInstructions
        }
        shippingAddress = pickupAddress
        shippingAddressForOrder = {
          ...pickupAddress,
          title: 'Retiro en local - Arcangel 1200'
        }
      } else {
        const homeAddress = {
          street: selectedAddress.street,
          hasNoNumber: selectedAddress.hasNoNumber || false,
          regionIso: selectedAddress.regionIso || 'CL-RM',
          regionName: selectedAddress.regionName,
          communeName: selectedAddress.communeName,
          postalCode: selectedAddress.postalCode,
          department: selectedAddress.department || '',
          deliveryInstructions: selectedAddress.deliveryInstructions || ''
        }
        shippingAddress = homeAddress
        shippingAddressForOrder = {
          ...homeAddress,
          title: selectedAddress.title || 'Dirección de envío'
        }
      }
      
      const orderPayload: any = {
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image,
          category: item.category,
        })),
        customerInfo: {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
        },
        shippingAddress: shippingAddress,
        totals: {
          subtotal: subtotalBeforeDiscount,
          discount: discountAmount,
          shipping: shipping,
          total: finalTotal
        },
        notes: formData.notes,
        couponId: appliedCoupon ? couponDetails?.id : null,
        couponCode: appliedCoupon,
        shippingMethod: deliveryMethod === 'pickup' ? 'pickup' : shippingMethod,
        deliveryMethod: deliveryMethod,
        shippingDetails: deliveryMethod === 'pickup' ? {
          carrier: "Retiro en local",
          serviceName: "Retiro en tienda",
          serviceCode: 0,
          finalWeight: 0,
          selectedBranch: null,
          isCashOnDelivery: false,
          actualShippingCost: 0,
          storeAddress: STORE_ADDRESS
        } : {
          carrier: "Chilexpress",
          serviceName: selectedChilexpressOption?.name || '',
          serviceCode: selectedChilexpressOption?.typeCode || 0,
          finalWeight: selectedChilexpressOption?.finalWeight || 0,
          selectedBranch: selectedBranch ? {
            id: selectedBranch.id,
            name: selectedBranch.name,
            address: selectedBranch.address,
            telephone: selectedBranch.telephone,
          } : null,
          isCashOnDelivery: selectedChilexpressOption?.isCashOnDelivery || false,
          actualShippingCost: selectedChilexpressOption?.actualShippingCost || 0,
        }
      }
      
      if (isGuestUser) {
        const guest = getGuestSession()
        if (guest) {
          orderPayload.guestSessionId = guest.sessionId
        }
      }
      
      const orderResponse = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      })

      const orderData = await orderResponse.json()
      if (!orderResponse.ok) throw new Error(orderData.error)

      addOrder({
        userId: orderData.userId,
        items: items.map((item) => ({ ...item, id: item.id.toString() })),
        customerInfo: { 
          ...formData, 
          address: shippingAddress.street, 
          city: shippingAddress.communeName, 
          region: shippingAddress.regionName, 
          postalCode: shippingAddress.postalCode 
        },
        shippingAddress: shippingAddressForOrder, 
        paymentInfo: { method: "transbank", status: "pending" },
        totals: { subtotal: subtotalBeforeDiscount, discount: discountAmount, shipping, tax: 0, total: finalTotal },
        status: "pending",
        notes: formData.notes,
        couponId: appliedCoupon ? couponDetails?.id : null,
        couponCode: appliedCoupon,
        shippingMethod: deliveryMethod === 'pickup' ? 'pickup' : shippingMethod,
      })

      const paymentResponse = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: orderData.orderId, 
          amount: finalTotal,
          isGuest: isGuestUser,
          guestEmail: isGuestUser ? formData.email : undefined
        }),
      })

      const paymentData = await paymentResponse.json()

      if (paymentData.success && paymentData.token && paymentData.url) {
        window.location.href = `${paymentData.url}?token_ws=${paymentData.token}`
      } else {
        throw new Error(paymentData.error || 'No se pudo crear la transacción de pago')
      }

    } catch (error: any) {
      console.error('Error:', error)
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsProcessing(false)
    }
  }

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
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold">Tiempo agotado</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Tu sesión de compra ha expirado. Serás redirigido al inicio en unos segundos...
          </p>
          <Button onClick={() => router.push("/")} className="mt-4">
            Ir ahora
          </Button>
        </div>
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

      {isAuthenticated && !isGuestMode && (
        <CheckoutTimer timeLeft={formattedTime} progress={progress} isExpired={isExpired} />
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">Checkout</h1>

          {!isAuthenticated && !isGuestMode && !showGuestForm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  Cómo deseas comprar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <Link href="/login" className="w-full">
                    <Button variant="default" className="w-full">
                      <LogIn className="w-4 h-4 mr-2" />
                      Iniciar Sesión
                    </Button>
                  </Link>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowGuestForm(true)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Comprar como Invitado
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!isAuthenticated && !isGuestMode && showGuestForm && (
            <Card>
              <CardHeader>
                <CardTitle>Completar datos de Invitado</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGuestSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre *</Label>
                      <Input
                        required
                        value={guestData.firstName}
                        onChange={(e) => setGuestData({...guestData, firstName: e.target.value})}
                        placeholder="Tu nombre"
                        className={guestFormErrors.firstName ? "border-red-500" : ""}
                      />
                      {guestFormErrors.firstName && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {guestFormErrors.firstName}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Apellido *</Label>
                      <Input
                        required
                        value={guestData.lastName}
                        onChange={(e) => setGuestData({...guestData, lastName: e.target.value})}
                        placeholder="Tu apellido"
                        className={guestFormErrors.lastName ? "border-red-500" : ""}
                      />
                      {guestFormErrors.lastName && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {guestFormErrors.lastName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      required
                      value={guestData.email}
                      onChange={(e) => setGuestData({...guestData, email: e.target.value})}
                      placeholder="correo@ejemplo.com"
                      className={guestFormErrors.email ? "border-red-500" : ""}
                    />
                    {guestFormErrors.email && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {guestFormErrors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Confirmar Email *</Label>
                    <Input
                      type="email"
                      required
                      value={guestData.confirmEmail}
                      onChange={(e) => setGuestData({...guestData, confirmEmail: e.target.value})}
                      placeholder="confirma tu correo"
                      className={guestFormErrors.confirmEmail ? "border-red-500" : ""}
                    />
                    {guestFormErrors.confirmEmail && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {guestFormErrors.confirmEmail}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Teléfono *</Label>
                    <Input
                      type="tel"
                      required
                      value={guestData.phone}
                      onChange={(e) => setGuestData({...guestData, phone: e.target.value})}
                      placeholder="+569 XXXX XXXX"
                      className={guestFormErrors.phone ? "border-red-500" : ""}
                    />
                    {guestFormErrors.phone && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {guestFormErrors.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 pt-3">
                    <Button type="submit" className="flex-1">
                      Continuar como Invitado
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setShowGuestForm(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {isGuestMode && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-amber-700">Comprando como invitado</span>
                <Badge variant="outline" className="bg-amber-100">
                  {formData.email}
                </Badge>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  clearGuestSession()
                  setIsGuestMode(false)
                  setSelectedAddress(null)
                  setShowGuestForm(true)
                  setFormData({ email: "", firstName: "", lastName: "", phone: "", notes: "" })
                  setGuestData({ email: "", firstName: "", lastName: "", phone: "", confirmEmail: "" })
                  toast({ title: "Sesión cerrada", description: "Puedes iniciar sesión o volver a comprar como invitado" })
                }}
              >
                Cambiar
              </Button>
            </div>
          )}

          {(isAuthenticated || isGuestMode) && (
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
                    disabled={isAuthenticated || isGuestMode} 
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
                      disabled={isAuthenticated || isGuestMode}
                    />
                  </div>
                  <div>
                    <Label>Apellido *</Label>
                    <Input 
                      name="lastName" 
                      required 
                      value={formData.lastName} 
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})} 
                      disabled={isAuthenticated || isGuestMode}
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
                    disabled={isAuthenticated || isGuestMode}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* SELECCIÓN DE MÉTODO DE ENTREGA */}
          {(isAuthenticated || isGuestMode) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Método de Entrega
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={deliveryMethod} 
                  onValueChange={(value) => setDeliveryMethod(value as DeliveryMethod)}
                  className="space-y-3"
                >
                  {/* Opción: Envío a domicilio */}
                  <div
                    className={`flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                      deliveryMethod === 'home' 
                        ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setDeliveryMethod('home')}
                  >
                    <RadioGroupItem value="home" id="home" className="mt-1" />
                    <Label htmlFor="home" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            <Truck className="w-4 h-4 text-orange-500" />
                            Envío a domicilio
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Recibe tu pedido en la dirección que prefieras
                          </div>
                        </div>
                      </div>
                    </Label>
                  </div>

                  {/* Opción: Retiro en local */}
                  <div
                    className={`flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                      deliveryMethod === 'pickup' 
                        ? 'border-green-500 bg-green-50 ring-2 ring-green-200' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setDeliveryMethod('pickup')}
                  >
                    <RadioGroupItem value="pickup" id="pickup" className="mt-1" />
                    <Label htmlFor="pickup" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            <Store className="w-4 h-4 text-green-500" />
                            Retirar en local
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span className="font-medium">Arcangel 1200</span>, Comuna de San Miguel
                          </div>
                          <div className="text-xs text-green-600 font-medium mt-1">
                            🆓 Envío gratuito
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                          Gratis
                        </Badge>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          {/* DIRECCIÓN DE ENVÍO - Solo si eligió envío a domicilio */}
          {deliveryMethod === 'home' && (isAuthenticated || isGuestMode) && (
            <Card>
              <CardHeader><CardTitle>Dirección de Envío</CardTitle></CardHeader>
              <CardContent>
                {isAuthenticated && !isGuestMode ? (
                  <>
                    {loadingAddresses ? (
                      <div className="text-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        <p className="mt-2">Cargando direcciones...</p>
                      </div>
                    ) : user?.addresses && user.addresses.length > 0 ? (
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
                        <Link href="/profile">
                          <Button>Agregar dirección en tu perfil</Button>
                        </Link>
                      </div>
                    )}
                  </>
                ) : isGuestMode && !selectedAddress ? (
                  <form onSubmit={handleManualAddressSubmit} className="space-y-4">
                    <div>
                      <Label>Calle y número *</Label>
                      <Input
                        name="street"
                        required
                        value={manualAddress.street}
                        onChange={handleManualAddressChange}
                        placeholder="Ej: Av. Providencia 1234"
                        className={manualAddressErrors.street ? "border-red-500" : ""}
                      />
                      {manualAddressErrors.street && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {manualAddressErrors.street}
                        </p>
                      )}
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Región *</Label>
                        <select
                          name="regionIso"
                          required
                          value={manualAddress.regionIso}
                          onChange={handleManualAddressChange}
                          className={`w-full p-2 border rounded-md text-sm ${manualAddressErrors.regionIso ? "border-red-500" : ""}`}
                          disabled={loadingRegions}
                        >
                          <option value="">Selecciona una región</option>
                          {regions.map(region => (
                            <option key={region.region_iso_3166_2} value={region.region_iso_3166_2}>
                              {region.name}
                            </option>
                          ))}
                        </select>
                        {manualAddressErrors.regionIso && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" />
                            {manualAddressErrors.regionIso}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Comuna *</Label>
                        <select
                          name="communeName"
                          required
                          value={manualAddress.communeName}
                          onChange={handleManualAddressChange}
                          disabled={!manualAddress.regionIso || loadingRegions}
                          className={`w-full p-2 border rounded-md text-sm ${manualAddressErrors.communeName ? "border-red-500" : ""}`}
                        >
                          <option value="">Selecciona una comuna</option>
                          {selectedRegion?.communes.map(commune => (
                            <option key={commune.name} value={commune.name}>
                              {commune.name}
                            </option>
                          ))}
                        </select>
                        {manualAddressErrors.communeName && (
                          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                            <AlertCircle className="w-3 h-3" />
                            {manualAddressErrors.communeName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label>Código Postal *</Label>
                      <Input
                        name="postalCode"
                        required
                        value={manualAddress.postalCode}
                        onChange={handleManualAddressChange}
                        placeholder="Ej: 7500000"
                        className={manualAddressErrors.postalCode ? "border-red-500" : ""}
                      />
                      {manualAddressErrors.postalCode && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {manualAddressErrors.postalCode}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Ingresa el código postal de tu dirección
                      </p>
                    </div>

                    <div>
                      <Label>Departamento (Opcional)</Label>
                      <Input
                        name="department"
                        value={manualAddress.department}
                        onChange={handleManualAddressChange}
                        placeholder="Depto, oficina, etc."
                      />
                    </div>

                    <div>
                      <Label>Instrucciones de entrega</Label>
                      <Textarea
                        name="deliveryInstructions"
                        value={manualAddress.deliveryInstructions}
                        onChange={handleManualAddressChange}
                        rows={2}
                        placeholder="Referencias, horario, etc."
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      Guardar dirección
                    </Button>
                  </form>
                ) : selectedAddress && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium">{selectedAddress.street}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAddress.communeName}, {selectedAddress.regionName}
                    </p>
                    <p className="text-sm text-muted-foreground">CP: {selectedAddress.postalCode}</p>
                    {selectedAddress.department && <p className="text-sm">Depto: {selectedAddress.department}</p>}
                    {selectedAddress.deliveryInstructions && (
                      <p className="text-sm text-muted-foreground mt-1">{selectedAddress.deliveryInstructions}</p>
                    )}
                    {isGuestMode && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => setSelectedAddress(null)}
                      >
                        Cambiar dirección
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* MÉTODO DE ENVÍO - Solo si eligió envío a domicilio */}
          {deliveryMethod === 'home' && (isAuthenticated || isGuestMode) && selectedAddress && (
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
                    
                    {showBranchSelector && selectedChilexpressOption?.type === "branch_pickup" && availableBranches.length > 0 && (
                      <div className="mt-4 p-4 border rounded-lg bg-blue-50 border-blue-200">
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
                      </div>
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
          )}

          {/* Información de retiro en local - Solo si eligió retiro en local */}
          {deliveryMethod === 'pickup' && (isAuthenticated || isGuestMode) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-green-500" />
                  Retiro en Local
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Store className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Arcangel 1200</p>
                      <p className="text-sm text-muted-foreground">Comuna de San Miguel</p>
                      <p className="text-sm text-muted-foreground">Región Metropolitana</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                          🆓 Gratis
                        </Badge>
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                          Retiro en tienda
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Presenta tu número de pedido al momento de retirar.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(isAuthenticated || isGuestMode) && (
            <Card>
              <CardHeader><CardTitle>Método de Pago</CardTitle></CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-semibold">Transbank Webpay</h4>
                  <p className="text-sm">Paga seguro con tarjetas de crédito, débito y prepago</p>
                </div>
              </CardContent>
            </Card>
          )}

          {(isAuthenticated || isGuestMode) && (
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
          )}
        </div>

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
                
                {deliveryMethod === 'pickup' && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700 flex items-center gap-2">
                      <Store className="w-3 h-3" />
                      <span>Retirarás tu pedido en: <strong>Arcangel 1200, San Miguel</strong></span>
                    </p>
                  </div>
                )}
                
                {selectedChilexpressOption?.isCashOnDelivery && deliveryMethod === 'home' && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      El envío se pagará al momento de la entrega. El monto mostrado corresponde solo a los productos.
                    </p>
                  </div>
                )}
                
                {selectedChilexpressOption?.isBranchPickup && deliveryMethod === 'home' && selectedBranch && (
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
                disabled={isProcessing || 
                  (deliveryMethod === 'home' && (!selectedAddress || !selectedChilexpressOption || isLoadingShipping || (selectedChilexpressOption?.requiresBranchSelection && !selectedBranch))) ||
                  (!isAuthenticated && !isGuestMode)} 
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
                ) : isLoadingShipping ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calculando envío...</>
                ) : (!isAuthenticated && !isGuestMode) ? (
                  "Selecciona una opción arriba"
                ) : (
                  `Pagar $${formatCLP(finalTotal)}`
                )}
              </Button>
              
              {deliveryMethod === 'home' && selectedChilexpressOption?.requiresBranchSelection && !selectedBranch && selectedAddress && (
                <p className="text-xs text-red-500 text-center mt-2">
                  Debes seleccionar una sucursal para continuar
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