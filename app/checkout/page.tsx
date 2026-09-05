"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Truck, Shield, LogIn, Tag, Loader2, MapPin, Plus, Check, User, ShoppingBag, AlertCircle, Store, Home, Mail, Phone } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useCheckoutTimer } from '@/hooks/use-checkout-timer'
import { CheckoutTimer } from '@/components/checkout-timer'

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

const BODEGA_OPTION: ChilexpressOption = {
  id: "bodega_pickup",
  type: "bodega_pickup",
  name: "Retiro en Bodega",
  price: 0,
  deliveryDescription: "Retira tu pedido en nuestra bodega sin costo de envio",
  conditions: "Horario: Lunes a Viernes 10:00 - 18:00 hrs",
  isBranchPickup: true,
  branches: [{
    id: 1,
    name: "Bodega - Retiro en Tienda",
    address: "Arcangel 1200, San Miguel",
    telephone: "+56 2 1234 5678"
  }]
}

const BODEGA_ADDRESS = {
  street: "Arcangel 1200, San Miguel",
  hasNoNumber: false,
  regionIso: 'CL-RM',
  regionName: 'Region Metropolitana',
  communeName: 'San Miguel',
  postalCode: '8900000',
  department: '',
  deliveryInstructions: 'Retiro en bodega - Horario Lunes a Viernes 10:00 a 18:00 hrs'
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
  const { createGuestSession, isGuest, clearGuestSession, getGuestSession } = useGuestStore()
  const { addOrder } = useOrderStore()
  const router = useRouter()
  const { toast } = useToast()

  const { formattedTime, isExpired, progress, isReserving, confirmPurchase } = useCheckoutTimer()

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
    rut: '',
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

  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const [storeOpen, setStoreOpen] = useState(true)
  const [maintenanceMessage, setMaintenanceMessage] = useState("")

  const shippingFetchedRef = useRef<string>("")
  const isFetchingRef = useRef(false)

  const [editingGuestData, setEditingGuestData] = useState(false)

  const [hasAddress, setHasAddress] = useState(false)

  useEffect(() => {
    const fetchStoreStatus = async () => {
      try {
        const response = await fetch('/api/store/status')
        if (response.ok) {
          const data = await response.json()
          setStoreOpen(data.storeOpen)
          setMaintenanceMessage(data.maintenanceMessage || '')
          if (!data.storeOpen) {
            toast({
              title: "Tienda en mantenimiento",
              description: data.maintenanceMessage || "No se pueden realizar compras en este momento",
              variant: "destructive",
              duration: 5000,
            })
            router.push('/')
          }
        }
      } catch (error) {
        console.error('Error fetching store status:', error)
      }
    }
    fetchStoreStatus()
  }, [router, toast])

  const subtotalBeforeDiscount = roundToInteger(getSubtotalPrice())
  const discountAmount = roundToInteger(getDiscountAmount())
  const totalAfterDiscount = roundToInteger(getTotalPrice())
  const shipping = roundToInteger(getShippingCost())
  const finalTotal = roundToInteger(totalAfterDiscount + shipping)

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

  useEffect(() => {
    if (isAuthenticated) {
      setIsGuestMode(false)
      clearGuestSession()
      if (user) {
        setFormData({
          ...formData,
          email: user.email || "",
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          phone: user.phone || "",
        })
      }
    }
  }, [isAuthenticated, user])

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
    if (!communeName || items.length === 0 || isFetchingRef.current) return
    
    isFetchingRef.current = true
    
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
      
      let allOptions: ChilexpressOption[] = []
      
      if (data.success && data.options && data.options.length > 0) {
        allOptions = data.options
        setShippingError(null)
        
        const branchOption = data.options.find((o: any) => o.type === "branch_pickup");
        if (branchOption && branchOption.branches && branchOption.branches.length > 0) {
          setAvailableBranches(branchOption.branches);
        }
      } else {
        setShippingError(data.error || "No se encontraron tarifas de envio")
      }
      
      const hasBodega = allOptions.some((o: any) => o.type === "bodega_pickup");
      if (!hasBodega) {
        allOptions.push(BODEGA_OPTION);
      }
      
      setChilexpressOptions(allOptions)
      
      if (selectedChilexpressOption) {
        const existingOption = allOptions.find(o => 
          o.id === selectedChilexpressOption.id || 
          o.type === selectedChilexpressOption.type
        );
        if (existingOption) {
          setSelectedChilexpressOption(existingOption)
          setShippingCost(existingOption.price)
          
          if (existingOption.type === "branch_pickup" && existingOption.branches && existingOption.branches.length > 0) {
            setAvailableBranches(existingOption.branches);
            setShowBranchSelector(true);
          }
          
          isFetchingRef.current = false
          return
        }
      }
      
      const defaultOption = allOptions[0];
      
      if (defaultOption) {
        setSelectedChilexpressOption(defaultOption)
        setShippingCost(defaultOption.price)
        
        if (defaultOption.type === "bodega_pickup") {
          setShippingMethod("bodega_pickup" as any)
          setShowBranchSelector(false)
          setSelectedBranch(null)
        } else {
          setShippingMethod(defaultOption.serviceTypeCode === 2 || defaultOption.serviceTypeCode === 3 ? "express" : "standard")
          
          if (defaultOption.type === "branch_pickup" && defaultOption.branches && defaultOption.branches.length > 0) {
            setAvailableBranches(defaultOption.branches);
            setShowBranchSelector(true);
          }
        }
      }
      
    } catch (error) {
      console.error("Error fetching shipping rates:", error)
      setShippingError("Error al calcular el costo de envio")
      setChilexpressOptions([BODEGA_OPTION])
      setSelectedChilexpressOption(BODEGA_OPTION)
      setShippingCost(0)
      setShippingMethod("bodega_pickup" as any)
      setShowBranchSelector(false)
      setSelectedBranch(null)
    } finally {
      setIsLoadingShipping(false)
      isFetchingRef.current = false
    }
  }, [items, getTotalPrice, setShippingCost, setShippingMethod, selectedChilexpressOption]);

  useEffect(() => {
    let communeName = null;
    
    if (selectedAddress?.communeName) {
      communeName = selectedAddress.communeName;
    }
    
    if (!communeName || items.length === 0) {
      return;
    }
    
    const fetchKey = `${communeName}`;
    if (shippingFetchedRef.current === fetchKey) {
      return;
    }
    
    shippingFetchedRef.current = fetchKey;
    fetchShippingRates(communeName);
    
  }, [selectedAddress?.communeName, items.length, fetchShippingRates]);

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

  const validateGuestForm = () => {
    const errors: Record<string, string> = {}
    
    if (!guestData.firstName) errors.firstName = "Nombre requerido"
    if (!guestData.lastName) errors.lastName = "Apellido requerido"
    if (!guestData.email) errors.email = "Email requerido"
    if (!guestData.confirmEmail) errors.confirmEmail = "Confirmar email requerido"
    if (guestData.email !== guestData.confirmEmail) errors.confirmEmail = "Los correos no coinciden"
    if (!guestData.phone) errors.phone = "Telefono requerido"
    if (guestData.rut && !guestData.rut.match(/^[0-9]+-[0-9Kk]$/)) {
      errors.rut = "Formato de RUT invalido (ej: 12345678-5)"
    }
    
    setGuestFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateManualAddress = () => {
    const errors: Record<string, string> = {}
    
    if (!manualAddress.street) errors.street = "Calle requerida"
    if (!manualAddress.regionIso) errors.regionIso = "Region requerida"
    if (!manualAddress.communeName) errors.communeName = "Comuna requerida"
    if (!manualAddress.postalCode) errors.postalCode = "Codigo postal requerido"
    
    setManualAddressErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateGuestForm()) {
      toast({
        title: "Error de validacion",
        description: "Por favor completa todos los campos correctamente",
        variant: "destructive"
      })
      return
    }
    
    const rutToUse = guestData.rut.trim() || "66666666-6"
    
    createGuestSession({
      email: guestData.email,
      firstName: guestData.firstName,
      lastName: guestData.lastName,
      phone: guestData.phone,
      rut: rutToUse
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
    setEditingGuestData(false)
    
    toast({
      title: "Datos guardados",
      description: "Ahora ingresa tu direccion para cotizar el envio",
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
        title: "Error de validacion",
        description: "Por favor completa todos los campos de direccion",
        variant: "destructive"
      })
      return
    }
    
    const tempAddress = {
      id: Date.now(),
      title: 'Direccion de envio',
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
    
    shippingFetchedRef.current = ""
    setSelectedAddress(tempAddress)
    setHasAddress(true)
    
    setChilexpressOptions([])
    setSelectedChilexpressOption(null)
    setAvailableBranches([])
    setShowBranchSelector(false)
    
    toast({
      title: "Direccion guardada",
      description: "Calculando opciones de envio...",
    })
  }

  const getUniqueAddresses = (addresses: any[]) => {
    const seen = new Set()
    return addresses.filter(addr => {
      const key = `${addr.street}-${addr.communeName}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const uniqueAddresses = user?.addresses ? getUniqueAddresses(user.addresses) : []

  const handleLoginClick = () => {
    if (guestData.email || guestData.firstName) {
      createGuestSession({
        email: guestData.email || formData.email,
        firstName: guestData.firstName || formData.firstName,
        lastName: guestData.lastName || formData.lastName,
        phone: guestData.phone || formData.phone,
        rut: guestData.rut || "66666666-6"
      })
    }
    router.push('/login?redirect=/checkout')
  }

  const handleGuestModeClick = () => {
    setShowGuestForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isExpired) {
      toast({ title: "Tiempo agotado", description: "Tu sesion ha expirado", variant: "destructive" })
      router.push('/')
      return
    }
    
    const isBodegaPickupSelected = selectedChilexpressOption?.type === "bodega_pickup"
    
    if (!isBodegaPickupSelected && !selectedAddress) {
      toast({ title: "Error", description: "Selecciona o ingresa una direccion de envio", variant: "destructive" })
      return
    }

    if (!selectedChilexpressOption) {
      toast({ title: "Error", description: "Selecciona un metodo de envio", variant: "destructive" })
      return
    }

    if (selectedChilexpressOption?.requiresBranchSelection && !selectedBranch) {
      toast({ title: "Error", description: "Por favor selecciona una sucursal para retirar", variant: "destructive" })
      return
    }

    if (!acceptedTerms) {
      toast({ 
        title: "Error", 
        description: "Debes aceptar los Terminos y Condiciones para continuar", 
        variant: "destructive" 
      })
      return
    }

    setIsProcessing(true)

    try {
      const isGuestUser = isGuestMode && !isAuthenticated
      const apiEndpoint = isGuestUser ? '/api/orders/create-guest' : '/api/orders/create'
      
      let shippingType = 'standard'
      
      if (isBodegaPickupSelected) {
        shippingType = 'bodega_pickup'
      } else if (selectedBranch) {
        shippingType = 'branch_pickup'
      } else if (selectedChilexpressOption?.isCashOnDelivery) {
        shippingType = 'cash_on_delivery'
      } else if (selectedChilexpressOption?.isHomeDelivery || selectedChilexpressOption?.type === 'home_delivery') {
        shippingType = 'home_delivery'
      } else if (selectedChilexpressOption?.type === 'branch_pickup') {
        shippingType = 'branch_pickup'
      }
      
      let shippingAddressData
      if (isBodegaPickupSelected) {
        shippingAddressData = BODEGA_ADDRESS
      } else {
        shippingAddressData = {
          street: selectedAddress.street,
          hasNoNumber: selectedAddress.hasNoNumber || false,
          regionIso: selectedAddress.regionIso || 'CL-RM',
          regionName: selectedAddress.regionName,
          communeName: selectedAddress.communeName,
          postalCode: selectedAddress.postalCode,
          department: selectedAddress.department,
          deliveryInstructions: selectedAddress.deliveryInstructions
        }
      }
      
      let shippingDetailsData
      if (isBodegaPickupSelected) {
        shippingDetailsData = {
          type: 'bodega_pickup',
          carrier: "Bodega",
          serviceName: "Retiro en Bodega",
          serviceCode: null,
          finalWeight: null,
          selectedBranch: {
            id: 1,
            name: "Bodega - Retiro en Tienda",
            address: "Arcangel 1200, San Miguel",
            telephone: "+56 2 1234 5678"
          },
          isCashOnDelivery: false,
          actualShippingCost: 0,
        }
      } else {
        shippingDetailsData = {
          type: shippingType,
          carrier: "Chilexpress",
          serviceName: selectedChilexpressOption?.name || null,
          serviceCode: selectedChilexpressOption?.typeCode || selectedChilexpressOption?.serviceTypeCode || null,
          finalWeight: selectedChilexpressOption?.finalWeight || null,
          selectedBranch: selectedBranch ? {
            id: selectedBranch.id,
            name: selectedBranch.name,
            address: selectedBranch.address,
            telephone: selectedBranch.telephone || null,
          } : null,
          isCashOnDelivery: selectedChilexpressOption?.isCashOnDelivery || false,
          actualShippingCost: selectedChilexpressOption?.actualShippingCost || selectedChilexpressOption?.price || 0,
        }
      }
      
      let rutToUse
      if (isGuestUser) {
        rutToUse = guestData.rut.trim() || "66666666-6"
      } else {
        rutToUse = user?.rut
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
          rut: rutToUse
        },
        shippingAddress: shippingAddressData,
        totals: {
          subtotal: subtotalBeforeDiscount,
          discount: discountAmount,
          shipping: isBodegaPickupSelected ? 0 : shipping,
          total: isBodegaPickupSelected ? totalAfterDiscount : finalTotal
        },
        notes: formData.notes,
        couponId: appliedCoupon ? couponDetails?.id : null,
        couponCode: appliedCoupon,
        shippingMethod: isBodegaPickupSelected ? "bodega_pickup" : shippingMethod,
        shippingType: shippingType,
        shippingDetails: shippingDetailsData,
        acceptedTerms: acceptedTerms
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
      
      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Error al crear la orden')
      }

      addOrder({
        userId: orderData.userId,
        items: items.map((item) => ({ ...item, id: item.id.toString() })),
        customerInfo: { ...formData, address: selectedAddress?.street || 'Retiro en bodega', city: selectedAddress?.communeName || 'Santiago', region: selectedAddress?.regionName || 'Region Metropolitana', postalCode: selectedAddress?.postalCode || '8900000' },
        shippingAddress: selectedAddress,
        paymentInfo: { method: "transbank", status: "pending" },
        totals: { subtotal: subtotalBeforeDiscount, discount: discountAmount, shipping: isBodegaPickupSelected ? 0 : shipping, tax: 0, total: isBodegaPickupSelected ? totalAfterDiscount : finalTotal },
        status: "pending",
        notes: formData.notes,
        couponId: appliedCoupon ? couponDetails?.id : null,
        couponCode: appliedCoupon,
        shippingMethod: isBodegaPickupSelected ? "bodega_pickup" : shippingMethod,
      })

      const paymentResponse = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: orderData.orderId, 
          amount: isBodegaPickupSelected ? totalAfterDiscount : finalTotal,
          isGuest: isGuestUser,
          guestEmail: isGuestUser ? formData.email : undefined
        }),
      })

      const paymentData = await paymentResponse.json()

      if (paymentData.success && paymentData.token && paymentData.url) {
        window.location.href = `${paymentData.url}?token_ws=${paymentData.token}`
      } else {
        throw new Error(paymentData.error || 'No se pudo crear la transaccion de pago')
      }

    } catch (error: any) {
      console.error('Error:', error)
      toast({ 
        title: "Error", 
        description: error.message || "Ocurrio un error al procesar tu pedido", 
        variant: "destructive" 
      })
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
        <h1 className="text-2xl font-bold mb-4">Tu carrito esta vacio</h1>
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
            Tu sesion de compra ha expirado. Seras redirigido al inicio en unos segundos...
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
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a la tienda
        </Link>
      </div>

      {hasActiveCheckout() && (
        <CheckoutTimer
          timeLeft={formattedTime}
          progress={progress}
          isExpired={isExpired}
        />
      )}

      <h1 className="text-3xl font-bold mb-8">
        Checkout
      </h1>

      <div className="grid lg:grid-cols-2 gap-8 items-start">

        {/* COLUMNA IZQUIERDA */}
        <div className="space-y-6">

          {/* Como deseas comprar */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Como deseas comprar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAuthenticated && !isGuestMode && !showGuestForm ? (
                <div className="space-y-3">
                  <Button
                    className="w-full"
                    onClick={handleLoginClick}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Iniciar Sesion
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Al iniciar sesion podras ver el estado de tu pedido y conseguir beneficios en el futuro como cliente frecuente.
                  </p>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        O
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGuestModeClick}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Comprar como Invitado
                  </Button>
                </div>
              ) : isAuthenticated ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-600">
                    <span className="font-medium">Sesion iniciada</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              ) : isGuestMode ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-600">
                    <User className="w-4 h-4" />
                    <span className="font-medium">Comprando como invitado</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Te notificaremos cuando tu pedido este listo para retiro via email o telefono.
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-4 py-2 h-auto text-600 rounded-md"
                    onClick={() => {
                      setIsGuestMode(false)
                      setShowGuestForm(true)
                    }}
                  >
                    Cambiar datos
                  </Button>
                </div>
              ) : null}

              {showGuestForm && !isAuthenticated && (
                <form onSubmit={handleGuestSubmit} className="space-y-4 pt-4 border-t">
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
                    <Label>Telefono *</Label>
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
                  <div>
                    <Label>RUT (Opcional)</Label>
                    <Input
                      placeholder="Ej: 12345678-5"
                      value={guestData.rut}
                      onChange={(e) => setGuestData({...guestData, rut: e.target.value})}
                      className={guestFormErrors.rut ? "border-red-500" : ""}
                    />
                    {guestFormErrors.rut && (
                      <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {guestFormErrors.rut}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button type="submit" className="flex-1">
                      Continuar como Invitado
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowGuestForm(false)
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Informacion de Contacto */}
          {(isAuthenticated || isGuestMode) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Informacion de Contacto</span>
                  {isGuestMode && !isAuthenticated && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingGuestData(!editingGuestData)}
                    >
                      {editingGuestData ? "Cancelar" : "Editar"}
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isGuestMode && !isAuthenticated && editingGuestData ? (
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
                      <Label>Telefono *</Label>
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
                    <div>
                      <Label>RUT (Opcional)</Label>
                      <Input
                        placeholder="Ej: 12345678-5"
                        value={guestData.rut}
                        onChange={(e) => setGuestData({...guestData, rut: e.target.value})}
                        className={guestFormErrors.rut ? "border-red-500" : ""}
                      />
                      {guestFormErrors.rut && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {guestFormErrors.rut}
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full">
                      Guardar datos
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{formData.firstName} {formData.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{formData.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{formData.phone}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Direccion de Envio */}
          {(isAuthenticated || isGuestMode) && (
            <Card>
              <CardHeader>
                <CardTitle>Direccion de Envio</CardTitle>
              </CardHeader>
              <CardContent>
                {isAuthenticated && !isGuestMode ? (
                  <>
                    {loadingAddresses ? (
                      <div className="text-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        <p className="mt-2">Cargando direcciones...</p>
                      </div>
                    ) : uniqueAddresses.length > 0 ? (
                      <>
                        <Select
                          value={selectedAddress?.id?.toString()}
                          onValueChange={(value) => {
                            if (user && user.addresses) {
                              const address = user.addresses.find(addr => addr.id.toString() === value)
                              if (address) {
                                setSelectedAddress(address)
                                setHasAddress(true)
                                setChilexpressOptions([])
                                setSelectedChilexpressOption(null)
                                setAvailableBranches([])
                                setShowBranchSelector(false)
                                shippingFetchedRef.current = ""
                              }
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una direccion" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueAddresses.map((address) => (
                              <SelectItem key={address.id} value={address.id.toString()}>
                                {address.title} - {address.street}, {address.communeName}
                                {address.isDefault && " (Predeterminada)"}
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
                        <p className="text-sm text-muted-foreground mb-4">No tienes direcciones guardadas</p>
                        <Link href="/profile">
                          <Button>Agregar direccion en tu perfil</Button>
                        </Link>
                      </div>
                    )}
                  </>
                ) : isGuestMode && !isAuthenticated ? (
                  !hasAddress ? (
                    <form onSubmit={handleManualAddressSubmit} className="space-y-4">
                      <div>
                        <Label>Calle y numero *</Label>
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
                          <Label>Region *</Label>
                          <select
                            name="regionIso"
                            required
                            value={manualAddress.regionIso}
                            onChange={handleManualAddressChange}
                            className={`w-full p-2 border rounded-md text-sm ${manualAddressErrors.regionIso ? "border-red-500" : ""}`}
                            disabled={loadingRegions}
                          >
                            <option value="">Selecciona una region</option>
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
                        <Label>Codigo Postal *</Label>
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
                          Ingresa el codigo postal de tu direccion
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
                        Guardar direccion y cotizar envio
                      </Button>
                    </form>
                  ) : (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="font-medium">{selectedAddress?.street}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedAddress?.communeName}, {selectedAddress?.regionName}
                      </p>
                      <p className="text-sm text-muted-foreground"> {selectedAddress?.postalCode}</p>
                      {selectedAddress?.department && <p className="text-sm">Depto: {selectedAddress.department}</p>}
                      {selectedAddress?.deliveryInstructions && (
                        <p className="text-sm text-muted-foreground mt-1">{selectedAddress.deliveryInstructions}</p>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setSelectedAddress(null)
                          setHasAddress(false)
                          setManualAddress({
                            street: '',
                            regionIso: '',
                            regionName: '',
                            communeName: '',
                            postalCode: '',
                            department: '',
                            deliveryInstructions: ''
                          })
                          setChilexpressOptions([])
                          setSelectedChilexpressOption(null)
                        }}
                      >
                        Cambiar direccion
                      </Button>
                    </div>
                  )
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Metodo de Envio */}
          {hasAddress && selectedAddress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Metodo de Envio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingShipping ? (
                  <div className="text-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Calculando opciones de envio...</p>
                  </div>
                ) : chilexpressOptions.length > 0 ? (
                  <div className="space-y-4">
                    <RadioGroup
                      value={selectedChilexpressOption?.id || selectedChilexpressOption?.type}
                      onValueChange={(value) => {
                        const option = chilexpressOptions.find(o =>
                          o.id === value || o.type === value
                        );
                        if (option) {
                          setSelectedChilexpressOption(option);
                          setShippingCost(option.price ?? 0);
                          
                          if (option.type === "bodega_pickup") {
                            setShippingMethod("bodega_pickup" as any);
                            setShowBranchSelector(false);
                            setSelectedBranch(null);
                          } else {
                            setShippingMethod(option.serviceTypeCode === 2 || option.serviceTypeCode === 3 ? "express" : "standard");
                            if (option.type === "branch_pickup" && option.branches && option.branches.length > 0) {
                              setAvailableBranches(option.branches);
                              setShowBranchSelector(true);
                              setSelectedBranch(null);
                            } else {
                              setShowBranchSelector(false);
                              setSelectedBranch(null);
                              setAvailableBranches([]);
                            }
                          }
                        }
                      }}
                    >
                      <div className="space-y-3">
                        {chilexpressOptions.map((option) => {
                          const uniqueId = option.id || option.type || `option_${Math.random()}`;
                          const isBodegaPickup = option.type === "bodega_pickup";
                          const isCashOnDelivery = option.isCashOnDelivery || option.type === "cash_on_delivery";
                          const isBranchPickup = option.type === "branch_pickup";
                          const price = option.price ?? 0;
                          
                          return (
                            <div
                              key={uniqueId}
                              className={`flex items-start space-x-3 border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
                                isBodegaPickup ? "bg-green-50 border-green-200" :
                                isCashOnDelivery ? "bg-amber-50 border-amber-200" : 
                                isBranchPickup ? "bg-blue-50 border-blue-200" : ""
                              }`}
                            >
                              <RadioGroupItem value={uniqueId} id={uniqueId} className="mt-1" />
                              <Label htmlFor={uniqueId} className="flex-1 cursor-pointer">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium flex items-center gap-2">
                                      {isBodegaPickup && <Store className="w-4 h-4 text-green-600" />}
                                      {isBranchPickup && <Store className="w-4 h-4 text-blue-600" />}
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
                                    {isBranchPickup && option.branches && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {option.branches.length} sucursales disponibles en tu comuna
                                      </div>
                                    )}
                                    {isBodegaPickup && (
                                      <>
                                        <div className="text-xs text-green-600 mt-1">
                                          Arcangel 1200, San Miguel
                                        </div>
                                        <div className="text-xs text-green-600 mt-1">
                                          <AlertCircle className="w-3 h-3 inline mr-1" />
                                          Se notificara cuando este disponible para retiro
                                        </div>
                                      </>
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
                              onClick={() => {
                                setSelectedBranch(branch);
                                const updatedOption = {
                                  ...selectedChilexpressOption,
                                  selectedBranch: branch,
                                  deliveryDescription: `Retiro en ${branch.name} - ${branch.address}`,
                                };
                                setSelectedChilexpressOption(updatedOption);
                                setShowBranchSelector(false);
                              }}
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
                                      Telefono: {branch.telephone}
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
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Cargando opciones de envio...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Metodo de Pago */}
          {hasAddress && selectedAddress && (
            <Card>
              <CardHeader><CardTitle>Metodo de Pago</CardTitle></CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-semibold">Transbank Webpay</h4>
                  <p className="text-sm">Paga seguro con tarjetas de credito, debito y prepago</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notas del Pedido */}
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

        {/* COLUMNA DERECHA - RESUMEN */}
        <div className="lg:sticky lg:top-[120px] self-start">
          <Card>
            <CardHeader>
              <CardTitle>Resumen del Pedido</CardTitle>
            </CardHeader>
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
                  <span>Envio</span>
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
                      El envio se pagara al momento de la entrega. El monto mostrado corresponde solo a los productos.
                    </p>
                  </div>
                )}
                
                {selectedBranch && selectedChilexpressOption?.type === "branch_pickup" && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700 flex items-start gap-2">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>
                        Retiraras tu pedido en: <strong>{selectedBranch.name}</strong>
                        <br />
                        {selectedBranch.address}
                      </span>
                    </p>
                  </div>
                )}

                {selectedChilexpressOption?.type === "bodega_pickup" && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700 flex items-center gap-2">
                      <Store className="w-4 h-4 text-green-600" />
                      <span>
                        <strong>Retiro en Bodega</strong>
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => {
                    setAcceptedTerms(checked === true)
                  }}
                  className="mt-0.5"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="terms"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Acepto los{" "}
                    <Link
                      href="/terminos-y-condiciones"
                      target="_blank"
                      className="text-blue-600 hover:text-blue-800 hover:underline transition-colors font-semibold"
                    >
                      Terminos y Condiciones
                    </Link>
                    {" "}de compra
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Al marcar esta casilla, confirmas que has leido y aceptas nuestros terminos y condiciones.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={
                  isProcessing ||
                  isLoadingShipping ||
                  !hasAddress ||
                  !selectedAddress ||
                  !selectedChilexpressOption ||
                  !acceptedTerms ||
                  (selectedChilexpressOption?.requiresBranchSelection && !selectedBranch)
                }
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
                ) : isLoadingShipping ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calculando envio...</>
                ) : !hasAddress ? (
                  "Ingresa una direccion de envio"
                ) : !selectedChilexpressOption ? (
                  "Selecciona un metodo de envio"
                ) : !acceptedTerms ? (
                  "Acepta los Terminos y Condiciones"
                ) : (
                  `Pagar $${formatCLP(finalTotal)}`
                )}
              </Button>
              
              {selectedChilexpressOption?.requiresBranchSelection && !selectedBranch && selectedAddress && (
                <p className="text-xs text-red-500 text-center mt-2">
                  Debes seleccionar una sucursal para continuar
                </p>
              )}
              
              {!acceptedTerms && hasAddress && (
                <p className="text-xs text-red-500 text-center mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Debes aceptar los Terminos y Condiciones para continuar
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