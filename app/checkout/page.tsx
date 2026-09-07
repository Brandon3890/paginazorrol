"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useCartStore } from "@/lib/cart-store"
import { useAuthStore } from "@/lib/auth-store"
import { useGuestStore } from "@/lib/guest-store"
import { useOrderStore } from "@/lib/order-store"
import { useCouponStore } from "@/lib/coupon-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Truck, Shield, LogIn, Tag, Loader2, MapPin, Plus, Check, User, ShoppingBag, AlertCircle, Store, Home, Mail, Phone, Gift, X } from "lucide-react"
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
  const { validateCoupon, useCoupon, fetchCoupons } = useCouponStore()
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

  const [deliveryOption, setDeliveryOption] = useState<'bodega' | 'envio' | null>(null)

  const [shippingRut, setShippingRut] = useState('')
  const [shippingRutError, setShippingRutError] = useState('')

  // Estado para cupón
  const [couponCode, setCouponCode] = useState('')
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false)
  const [couponError, setCouponError] = useState('')
  const [couponSuccess, setCouponSuccess] = useState('')

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

  // Cargar cupones al montar
  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

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
        if (!user.rut || user.rut === '66666666-6') {
          setShippingRut('')
        } else {
          setShippingRut(user.rut)
        }
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
      setChilexpressOptions([])
      setSelectedChilexpressOption(null)
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
    if (!guestData.rut) {
      errors.rut = "RUT requerido"
    } else if (!guestData.rut.match(/^[0-9]+-[0-9Kk]$/)) {
      errors.rut = "Formato de RUT invalido (ej: 12345678-5)"
    }
    
    setGuestFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateShippingRut = () => {
    if (isAuthenticated && (!shippingRut || shippingRut === '66666666-6')) {
      setShippingRutError('El RUT es obligatorio para el envío')
      return false
    }
    if (shippingRut && !shippingRut.match(/^[0-9]+-[0-9Kk]$/)) {
      setShippingRutError('Formato de RUT invalido (ej: 12345678-5)')
      return false
    }
    setShippingRutError('')
    return true
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
    
    const rutToUse = guestData.rut.trim()
    
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
      description: "Ahora elige como deseas recibir tu pedido",
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

  const handleSelectBodega = () => {
    setDeliveryOption('bodega')
    setSelectedAddress(null)
    setHasAddress(false)
    setChilexpressOptions([])
    setSelectedChilexpressOption(BODEGA_OPTION)
    setShippingCost(0)
    setShippingMethod("bodega_pickup" as any)
    setShowBranchSelector(false)
    setSelectedBranch(null)
    setAvailableBranches([])
    shippingFetchedRef.current = ""
    
    toast({
      title: "Retiro en Bodega seleccionado",
      description: "Retiraras tu pedido en nuestra bodega sin costo de envio",
    })
  }

  const handleSelectEnvio = () => {
    setDeliveryOption('envio')
    setSelectedAddress(null)
    setHasAddress(false)
    setChilexpressOptions([])
    setSelectedChilexpressOption(null)
    setAvailableBranches([])
    setShowBranchSelector(false)
    shippingFetchedRef.current = ""
  }

  const getHomeDeliveryOptions = () => {
    return chilexpressOptions.filter(opt => 
      opt.type === "home_delivery" || opt.type === "cash_on_delivery"
    )
  }

  const getBranchPickupOption = () => {
    return chilexpressOptions.find(opt => opt.type === "branch_pickup")
  }

  // =====================================================
  // APLICAR CUPÓN - CORREGIDO (NO USA EL CUPÓN)
  // =====================================================
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Ingresa un código de cupón')
      return
    }

    if (appliedCoupon) {
      removeCoupon()
      setCouponSuccess('')
    }

    setIsApplyingCoupon(true)
    setCouponError('')
    setCouponSuccess('')

    try {
      const cartItems = items.map(item => ({
        id: item.id,
        categoryId: item.categoryId,
        subcategoryId: item.subcategoryId,
        quantity: item.quantity,
        price: item.price,
        name: item.name
      }))

      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          items: cartItems
        })
      })

      const data = await response.json()

      if (!data.valid) {
        setCouponError(data.error || 'Cupón no válido')
        return
      }

      const coupon = data.coupon
      const discount = (subtotalBeforeDiscount * coupon.discountPercentage) / 100
      
      // ❌ NO usar el cupón aquí - SOLO validar y aplicar descuento visual
      // await useCoupon(coupon.id)  // ← ELIMINADO

      applyCoupon(
        coupon.code,
        Math.round(discount),
        {
          id: coupon.id,
          code: coupon.code,
          discountPercentage: coupon.discountPercentage,
          type: coupon.type
        }
      )

      setCouponSuccess(`¡Cupón aplicado! ${coupon.discountPercentage}% de descuento`)
      setCouponCode('')
      
      toast({
        title: "Cupón aplicado",
        description: `Se ha aplicado un descuento del ${coupon.discountPercentage}%`,
      })

    } catch (error) {
      console.error('Error applying coupon:', error)
      setCouponError('Error al aplicar el cupón. Intenta nuevamente.')
    } finally {
      setIsApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    removeCoupon()
    setCouponSuccess('')
    toast({
      title: "Cupón eliminado",
      description: "El cupón ha sido removido del pedido",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isExpired) {
      toast({ title: "Tiempo agotado", description: "Tu sesion ha expirado", variant: "destructive" })
      router.push('/')
      return
    }
    
    if (isAuthenticated) {
      if (!shippingRut || shippingRut === '66666666-6') {
        toast({
          title: "RUT requerido",
          description: "Por favor ingresa tu RUT para el envío.",
          variant: "destructive",
          duration: 5000,
        })
        return
      }
      if (!shippingRut.match(/^[0-9]+-[0-9Kk]$/)) {
        toast({
          title: "RUT inválido",
          description: "Formato de RUT invalido (ej: 12345678-5)",
          variant: "destructive",
          duration: 5000,
        })
        return
      }
    }
    
    const isBodegaPickupSelected = deliveryOption === 'bodega'
    
    if (!isBodegaPickupSelected && !selectedAddress) {
      toast({ title: "Error", description: "Selecciona o ingresa una direccion de envio", variant: "destructive" })
      return
    }

    if (!isBodegaPickupSelected && !selectedChilexpressOption) {
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
      
      // =====================================================
      // OBTENER EL RUT CORRECTO PARA EL ENVÍO
      // =====================================================
      let rutToUse
      if (isGuestUser) {
        rutToUse = guestData.rut.trim()
      } else {
        rutToUse = shippingRut || user?.rut || ''
      }
      
      console.log('RUT enviado a la API')
      
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

      // =====================================================
      // CREAR PAGO - ENVIANDO EL RUT
      // =====================================================
      const paymentResponse = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: orderData.orderId, 
          amount: isBodegaPickupSelected ? totalAfterDiscount : finalTotal,
          isGuest: isGuestUser,
          guestEmail: isGuestUser ? formData.email : undefined,
          customerRut: rutToUse
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

        <div className="space-y-6">

          {/* Información de Contacto combinado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Información de Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAuthenticated && !isGuestMode ? (
                <>
                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      onClick={handleLoginClick}
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Iniciar Sesion
                    </Button>
                    <p className="text-xs text-muted-foreground text-center leading-relaxed">
                      <span className="font-medium text-foreground">¿Ya tienes cuenta?</span> Inicia sesión para 
                      <span className="text-blue-600 font-medium"> rastrear tu pedido</span> en tiempo real, 
                      <span className="text-blue-600 font-medium"> acumular puntos</span> en cada compra y 
                      <span className="text-blue-600 font-medium"> acceder a beneficios exclusivos</span> como cliente frecuente.
                    </p>
                  </div>

                  <div className="pt-2">
                    <p className="text-sm font-medium text-center text-muted-foreground mb-4">
                      O completa tus datos para comprar como invitado
                    </p>
                    
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
                        <Label>RUT *</Label>
                        <Input
                          required
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
                        <User className="w-4 h-4 mr-2" />
                        Continuar como Invitado
                      </Button>
                    </form>
                  </div>
                </>
              ) : isAuthenticated ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-black-600">
                    <Check className="w-4 h-4" />
                    <span className="font-medium">Sesion iniciada</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>{user?.firstName} {user?.lastName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{user?.phone}</span>
                  </div>
                  
                  {(!user?.rut || user?.rut === '66666666-6') && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <Label className="text-sm font-medium text-amber-800">
                        RUT para envío <span className="text-red-500">*</span>
                      </Label>
                      <p className="text-xs text-amber-700 mb-2">
                        Se requiere un RUT Válido. Se usará solo para el envío.
                      </p>
                      <Input
                        required
                        placeholder="Ej: 12345678-5"
                        value={shippingRut}
                        onChange={(e) => {
                          setShippingRut(e.target.value)
                          setShippingRutError('')
                        }}
                        className={shippingRutError ? "border-red-500" : ""}
                      />
                      {shippingRutError && (
                        <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {shippingRutError}
                        </p>
                      )}
                    </div>
                  )}
                  
                  {user?.rut && user.rut !== '66666666-6' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">RUT: {user.rut}</span>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Podras ver el estado de tu pedido y acumular beneficios como cliente frecuente.
                  </p>
                </div>
              ) : isGuestMode ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-black-600">
                    <User className="w-4 h-4" />
                    <span className="font-medium">Comprando como invitado</span>
                  </div>
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
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">RUT: {guestData.rut}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Te notificaremos cuando tu pedido este listo para retiro via email o telefono.
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setIsGuestMode(false)
                        setShowGuestForm(true)
                      }}
                    >
                      Cambiar datos
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* ¿Cómo deseas recibir tu pedido? */}
          {(isGuestMode || isAuthenticated) && !deliveryOption && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  ¿Cómo deseas recibir tu pedido?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    className="border-2 rounded-lg p-6 cursor-pointer hover:border-green-500 transition-all hover:shadow-md text-center"
                    onClick={handleSelectBodega}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                        <Store className="w-7 h-7 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Retiro en Bodega</h3>
                        <p className="text-sm text-muted-foreground mt-1">Sin costo de envio</p>
                        <p className="text-xs text-muted-foreground mt-2">Arcangel 1200, San Miguel</p>
                        <p className="text-xs text-muted-foreground">Horario: Lunes a Viernes 10:00 - 18:00 hrs</p>
                      </div>
                      <Button variant="outline" className="mt-2 w-full border-green-500 text-green-600 hover:bg-green-50 hover:text-green-600">
                        Seleccionar
                      </Button>
                    </div>
                  </div>

                  <div
                    className="border-2 rounded-lg p-6 cursor-pointer hover:border-blue-500 transition-all hover:shadow-md text-center"
                    onClick={handleSelectEnvio}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                        <Home className="w-7 h-7 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Envío a Domicilio</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isAuthenticated ? "Usa tus direcciones guardadas" : "Ingresa tu dirección"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">El costo de envío se calculará según tu ubicación</p>
                      </div>
                      <Button variant="outline" className="mt-2 w-full border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-600">
                        Seleccionar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Retiro en Bodega */}
          {deliveryOption === 'bodega' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Retiro en Bodega</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setDeliveryOption(null)
                    setSelectedChilexpressOption(null)
                    setShippingCost(0)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Cambiar opción
                </Button>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-start gap-3">
                    <Store className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Retiro en Bodega</p>
                      <p className="text-sm text-green-700 mt-1">
                        Arcangel 1200, San Miguel
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Horario: Lunes a Viernes 10:00 - 18:00 hrs
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Sin costo de envio
                      </p>
                      <div className="mt-3 p-3 bg-green-100 rounded-lg border border-green-200">
                        <p className="text-xs text-green-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>Se notificara cuando este disponible para retiro</strong>
                            <br />
                            Te avisaremos por correo electronico o telefono cuando tu pedido este listo para retirar.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dirección de Envío */}
          {deliveryOption === 'envio' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Dirección de Envío
                </CardTitle>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeliveryOption(null)
                    setSelectedAddress(null)
                    setHasAddress(false)
                    setChilexpressOptions([])
                    setSelectedChilexpressOption(null)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Cambiar opción
                </Button>
              </CardHeader>

              <CardContent>
                {isAuthenticated && !isGuestMode ? (
                  <>
                    {loadingAddresses ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Cargando direcciones...
                        </p>
                      </div>
                    ) : uniqueAddresses.length > 0 ? (
                      <div className="space-y-4">

                        <div className="relative">
                          <Select
                            value={selectedAddress?.id?.toString()}
                            onValueChange={(value) => {
                              if (user && user.addresses) {
                                const address = user.addresses.find(
                                  addr => addr.id.toString() === value
                                )

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
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Selecciona una dirección" />
                            </SelectTrigger>

                            <SelectContent>
                              {uniqueAddresses.map((address) => (
                                <SelectItem
                                  key={address.id}
                                  value={address.id.toString()}
                                  className="group"
                                >
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium group-hover:text-white group-focus:text-white">
                                      {address.title}
                                    </span>

                                    <span className="text-xs text-muted-foreground group-hover:text-white group-focus:text-white">
                                      {address.street}, {address.communeName}
                                      {address.isDefault && " (Predeterminada)"}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedAddress && (
                          <div className="p-4 rounded-lg">
                            <div className="flex items-start gap-3">

                              <div className="mt-0.5">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                  <Check className="w-4 h-4 text-black" />
                                </div>
                              </div>

                              <div className="flex-1">

                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-gray-900">
                                    {selectedAddress.title}
                                  </p>

                                  {selectedAddress.isDefault && (
                                    <Badge
                                      variant="secondary"
                                      className="h-5 text-xs bg-gray-100 text-gray-900 border-0"
                                    >
                                      Predeterminada
                                    </Badge>
                                  )}
                                </div>

                                <p className="text-sm text-gray-800">
                                  {selectedAddress.street}
                                </p>

                                <p className="text-sm text-gray-800">
                                  {selectedAddress.communeName},{" "}
                                  {selectedAddress.regionName}
                                </p>

                                <p className="text-sm text-gray-800">
                                  Código Postal: {selectedAddress.postalCode}
                                </p>

                                {selectedAddress.department && (
                                  <p className="text-sm text-gray-800">
                                    Depto: {selectedAddress.department}
                                  </p>
                                )}

                                {selectedAddress.deliveryInstructions && (
                                  <p className="text-sm text-gray-800 mt-1 italic">
                                    "{selectedAddress.deliveryInstructions}"
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-300">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="px-3 py-2 h-auto text-sm font-semibold hover:text-white rounded-md"
                                onClick={() => {
                                  setSelectedAddress(null)
                                  setHasAddress(false)
                                  setChilexpressOptions([])
                                  setSelectedChilexpressOption(null)
                                }}
                              >
                                <ArrowLeft className="w-3 h-3 mr-1" />
                                Cambiar dirección
                              </Button>
                            </div>
                          </div>
                        )}

                        <Link href="/profile" className="block">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Gestionar direcciones
                          </Button>
                        </Link>
                      </div>

                    ) : (

                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                          <MapPin className="w-8 h-8 text-muted-foreground" />
                        </div>

                        <p className="text-sm font-medium">
                          No tienes direcciones guardadas
                        </p>

                        <p className="text-xs text-muted-foreground mt-1 mb-4">
                          Agrega una dirección en tu perfil para continuar
                        </p>

                        <Link href="/profile">
                          <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Agregar dirección
                          </Button>
                        </Link>
                      </div>
                    )}
                  </>

                ) : isGuestMode && !isAuthenticated ? (

                  !hasAddress ? (

                    <form
                      onSubmit={handleManualAddressSubmit}
                      className="space-y-4"
                    >

                      <div>
                        <Label className="text-sm font-medium">
                          Calle y número{" "}
                          <span className="text-red-500">*</span>
                        </Label>

                        <Input
                          name="street"
                          required
                          value={manualAddress.street}
                          onChange={handleManualAddressChange}
                          placeholder="Ej: Av. Providencia 1234"
                          className={`mt-1.5 h-11 ${
                            manualAddressErrors.street
                              ? "border-red-500"
                              : ""
                          }`}
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
                          <Label className="text-sm font-medium">
                            Región{" "}
                            <span className="text-red-500">*</span>
                          </Label>

                          <select
                            name="regionIso"
                            required
                            value={manualAddress.regionIso}
                            onChange={handleManualAddressChange}
                            className={`mt-1.5 w-full h-11 px-3 border rounded-md text-sm bg-background ${
                              manualAddressErrors.regionIso
                                ? "border-red-500"
                                : "border-input"
                            }`}
                            disabled={loadingRegions}
                          >
                            <option value="">
                              Selecciona una región
                            </option>

                            {regions.map(region => (
                              <option
                                key={region.region_iso_3166_2}
                                value={region.region_iso_3166_2}
                              >
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
                          <Label className="text-sm font-medium">
                            Comuna{" "}
                            <span className="text-red-500">*</span>
                          </Label>

                          <select
                            name="communeName"
                            required
                            value={manualAddress.communeName}
                            onChange={handleManualAddressChange}
                            disabled={
                              !manualAddress.regionIso ||
                              loadingRegions
                            }
                            className={`mt-1.5 w-full h-11 px-3 border rounded-md text-sm bg-background ${
                              manualAddressErrors.communeName
                                ? "border-red-500"
                                : "border-input"
                            }`}
                          >
                            <option value="">
                              Selecciona una comuna
                            </option>

                            {selectedRegion?.communes.map(commune => (
                              <option
                                key={commune.name}
                                value={commune.name}
                              >
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
                        <Label className="text-sm font-medium">
                          Código Postal{" "}
                          <span className="text-red-500">*</span>
                        </Label>

                        <Input
                          name="postalCode"
                          required
                          value={manualAddress.postalCode}
                          onChange={handleManualAddressChange}
                          placeholder="Ej: 7500000"
                          className={`mt-1.5 h-11 ${
                            manualAddressErrors.postalCode
                              ? "border-red-500"
                              : ""
                          }`}
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
                        <Label className="text-sm font-medium">
                          Departamento (Opcional)
                        </Label>

                        <Input
                          name="department"
                          value={manualAddress.department}
                          onChange={handleManualAddressChange}
                          placeholder="Depto, oficina, etc."
                          className="mt-1.5 h-11"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">
                          Instrucciones de entrega
                        </Label>

                        <Textarea
                          name="deliveryInstructions"
                          value={manualAddress.deliveryInstructions}
                          onChange={handleManualAddressChange}
                          rows={2}
                          placeholder="Referencias, horario, etc."
                          className="mt-1.5 resize-none"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11"
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Guardar dirección y cotizar envío
                      </Button>

                    </form>

                  ) : (

                    <div className="p-4 rounded-lg">
                      <div className="flex items-start gap-3">

                        <div className="mt-0.5">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <Check className="w-4 h-4 text-black" />
                          </div>
                        </div>

                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">
                            {selectedAddress?.street}
                          </p>

                          <p className="text-sm text-gray-800">
                            {selectedAddress?.communeName},{" "}
                            {selectedAddress?.regionName}
                          </p>

                          <p className="text-sm text-gray-800">
                            Código Postal: {selectedAddress?.postalCode}
                          </p>

                          {selectedAddress?.department && (
                            <p className="text-sm text-gray-800">
                              Depto: {selectedAddress.department}
                            </p>
                          )}

                          {selectedAddress?.deliveryInstructions && (
                            <p className="text-sm text-gray-800 mt-1 italic">
                              "{selectedAddress.deliveryInstructions}"
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-300">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-3 py-2 h-auto text-sm font-semibold hover:text-white rounded-md"

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
                          <ArrowLeft className="w-3 h-3 mr-1" />
                          Cambiar dirección
                        </Button>
                      </div>
                    </div>
                  )
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* MÉTODO DE ENVÍO */}
          {deliveryOption === "envio" && hasAddress && selectedAddress && (
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
                    <p className="text-sm text-muted-foreground">
                      Cargando direcciones de envío...
                    </p>
                  </div>

                ) : chilexpressOptions.length === 0 ? (

                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">
                      No hay opciones de envío disponibles para esta dirección.
                    </p>
                  </div>

                ) : (

                  <div className="space-y-4">

                    <div className="space-y-3">

                      {getBranchPickupOption() && (
                        <div
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            selectedChilexpressOption?.type === "branch_pickup"
                              ? "border-black bg-gray-50 ring-2 ring-gray-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                          onClick={() => {
                            const option = getBranchPickupOption();

                            if (option) {
                              setSelectedChilexpressOption(option);
                              setShippingCost(option.price ?? 0);

                              if (
                                option.branches &&
                                option.branches.length > 0
                              ) {
                                setAvailableBranches(option.branches);
                                setShowBranchSelector(true);
                                setSelectedBranch(null);
                              }
                            }
                          }}
                        >

                          <div className="flex items-start gap-3">

                            <div className="flex items-center mt-1">
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  selectedChilexpressOption?.type ===
                                  "branch_pickup"
                                    ? "border-black bg-black"
                                    : "border-gray-400 bg-white"
                                }`}
                              >
                                {selectedChilexpressOption?.type ===
                                  "branch_pickup" && (
                                  <div className="w-2 h-2 rounded-full bg-white" />
                                )}
                              </div>
                            </div>

                            <div className="flex-1">

                              <div className="font-medium flex items-center gap-2">
                                <Store className="w-4 h-4" />

                                Retiro en Sucursal Chilexpress
                              </div>

                              <div className="text-sm text-muted-foreground mt-1">
                                Retira tu pedido en una sucursal Chilexpress.
                              </div>

                            </div>

                            <div className="text-right font-medium">
                              {getBranchPickupOption()?.price === 0 ? (
                                <span className="text-green-600">
                                  Gratis
                                </span>
                              ) : (
                                <span>
                                  $
                                  {formatCLP(
                                    getBranchPickupOption()?.price || 0
                                  )}
                                </span>
                              )}
                            </div>

                          </div>
                        </div>
                      )}

                      {getHomeDeliveryOptions().length > 0 && (
                        <div
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            selectedChilexpressOption &&
                            selectedChilexpressOption.type !== "branch_pickup"
                              ? "border-black bg-gray-50 ring-2 ring-gray-300"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                          onClick={() => {

                            const homeOptions =
                              getHomeDeliveryOptions();

                            if (homeOptions.length > 0) {

                              const currentIsHomeDelivery =
                                selectedChilexpressOption &&
                                selectedChilexpressOption.type !==
                                  "branch_pickup";

                              const optionToSelect =
                                currentIsHomeDelivery
                                  ? selectedChilexpressOption
                                  : homeOptions[0];

                              setSelectedChilexpressOption(
                                optionToSelect
                              );

                              setShippingCost(
                                optionToSelect?.price ?? 0
                              );

                              setShowBranchSelector(false);
                              setSelectedBranch(null);
                              setAvailableBranches([]);
                            }
                          }}
                        >

                          <div className="flex items-start gap-3">

                            <div className="flex items-center mt-1">
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  selectedChilexpressOption &&
                                  selectedChilexpressOption.type !==
                                    "branch_pickup"
                                    ? "border-black bg-black"
                                    : "border-gray-400 bg-white"
                                }`}
                              >
                                {selectedChilexpressOption &&
                                  selectedChilexpressOption.type !==
                                    "branch_pickup" && (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  )}
                              </div>
                            </div>

                            <div className="flex-1">

                              <div className="font-medium flex items-center gap-2">
                                <Truck className="w-4 h-4" />

                                Envío a domicilio
                              </div>

                              <div className="text-sm text-muted-foreground mt-1">
                                Recibe tu pedido directamente en tu dirección.
                              </div>

                            </div>

                          </div>
                        </div>
                      )}

                    </div>

                    {selectedChilexpressOption?.type === "branch_pickup" && (
                      <div className="space-y-4">

                        {showBranchSelector &&
                          availableBranches.length > 0 && (
                            <div className="p-4 border rounded-lg bg-gray-50 border-gray-200">

                              <Label className="font-semibold flex items-center gap-2 mb-3">

                                <MapPin className="w-4 h-4" />

                                Selecciona la sucursal donde deseas retirar

                                <Badge
                                  variant="secondary"
                                  className="ml-2"
                                >
                                  {availableBranches.length} sucursales
                                </Badge>

                              </Label>

                              <div className="space-y-2 max-h-64 overflow-y-auto">

                                {availableBranches.map(
                                  (branch: any, idx: number) => {

                                    const isBranchSelected =
                                      selectedBranch?.id === branch.id;

                                    return (
                                      <div
                                        key={branch.id || idx}
                                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                          isBranchSelected
                                            ? "border-black bg-gray-100 ring-2 ring-gray-300"
                                            : "border-gray-200 bg-white hover:border-gray-400"
                                        }`}
                                        onClick={() => {

                                          setSelectedBranch(branch);

                                          const updatedOption = {
                                            ...selectedChilexpressOption,
                                            selectedBranch: branch,
                                            deliveryDescription:
                                              `Retiro en ${branch.name} - ${branch.address}`,
                                          };

                                          setSelectedChilexpressOption(
                                            updatedOption
                                          );

                                          setShowBranchSelector(false);
                                        }}
                                      >

                                        <div className="flex items-start justify-between">

                                          <div className="flex-1">

                                            <div className="font-medium text-sm flex items-center gap-2 flex-wrap">

                                              {branch.name}

                                              {isBranchSelected && (
                                                <Badge className="bg-black text-white text-xs">
                                                  Seleccionada
                                                </Badge>
                                              )}

                                            </div>

                                            <div className="text-xs text-muted-foreground mt-1">
                                              {branch.address}
                                            </div>

                                            {branch.telephone &&
                                              branch.telephone !==
                                                "No disponible" && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                  Teléfono:{" "}
                                                  {branch.telephone}
                                                </div>
                                              )}

                                          </div>

                                          {isBranchSelected && (
                                            <Check className="w-5 h-5 text-black flex-shrink-0" />
                                          )}

                                        </div>

                                      </div>
                                    );
                                  }
                                )}

                              </div>

                            </div>
                          )}

                        {selectedBranch && (
                          <div className="p-3 border rounded-lg bg-gray-50">

                            <div className="flex items-center gap-2">

                              <Check className="w-4 h-4 text-green-600" />

                              <div>
                                <p className="text-sm font-medium">
                                  Sucursal seleccionada
                                </p>

                                <p className="text-sm text-muted-foreground">
                                  {selectedBranch.name}
                                </p>

                                <p className="text-xs text-muted-foreground">
                                  {selectedBranch.address}
                                </p>
                              </div>

                            </div>

                          </div>
                        )}

                      </div>
                    )}

                    {selectedChilexpressOption &&
                      selectedChilexpressOption.type !== "branch_pickup" && (
                        <div className="space-y-3">

                          <p className="text-sm font-medium text-muted-foreground">
                            Selecciona el tipo de envío
                          </p>

                          {getHomeDeliveryOptions().map(
                            (option, index) => {

                              const uniqueId =
                                option.id ??
                                `home_delivery_${index}`;

                              const price =
                                option.price ?? 0;

                              const isCashOnDelivery =
                                option.isCashOnDelivery ||
                                option.type ===
                                  "cash_on_delivery";

                              const isSelected =
                                selectedChilexpressOption?.id ===
                                option.id;

                              return (
                                <div
                                  key={uniqueId}
                                  className={`flex items-start gap-3 border rounded-lg p-4 cursor-pointer transition-all ${
                                    isSelected
                                      ? "border-black bg-gray-50 ring-2 ring-gray-300"
                                      : "border-gray-200 bg-white hover:bg-gray-50"
                                  }`}
                                  onClick={() => {

                                    setSelectedChilexpressOption(
                                      option
                                    );

                                    setShippingCost(
                                      option.price ?? 0
                                    );

                                    setShowBranchSelector(false);
                                    setSelectedBranch(null);
                                    setAvailableBranches([]);

                                  }}
                                >

                                  <div className="flex items-center mt-1">

                                    <div
                                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                        isSelected
                                          ? "border-black bg-black"
                                          : "border-gray-400 bg-white"
                                      }`}
                                    >

                                      {isSelected && (
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                      )}

                                    </div>

                                  </div>

                                  <div className="flex-1">

                                    <div className="flex items-center justify-between">

                                      <div>

                                        <div className="font-medium flex items-center gap-2">

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
                                          <span className="text-green-600">
                                            Gratis
                                          </span>
                                        ) : (
                                          <span>
                                            $
                                            {formatCLP(price)}
                                          </span>
                                        )}

                                      </div>

                                    </div>

                                  </div>

                                </div>
                              );
                            }
                          )}

                        </div>
                      )}

                  </div>
                )}

              </CardContent>
            </Card>
          )}

          {/* Mostrar mensaje si no hay opciones de envío disponibles */}
          {deliveryOption === 'envio' && hasAddress && selectedAddress && chilexpressOptions.length === 0 && !isLoadingShipping && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Metodo de Envio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 text-muted-foreground">
                  <p>No hay metodos de envio disponibles para esta direccion</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => {
                      setDeliveryOption(null)
                      setSelectedAddress(null)
                      setHasAddress(false)
                      setChilexpressOptions([])
                      setSelectedChilexpressOption(null)
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Volver a opciones
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cupón de descuento */}
          {(isGuestMode || isAuthenticated) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5" />
                  Cupón de descuento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div>
                      <p className="font-medium text-green-800 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Cupón aplicado: <strong>{appliedCoupon}</strong>
                      </p>
                      <p className="text-sm text-green-600">
                        Descuento: {couponDetails?.discountPercentage || 0}%
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCoupon}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ingresa tu código de cupón"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase())
                          setCouponError('')
                          setCouponSuccess('')
                        }}
                        className="flex-1 h-11"
                        disabled={isApplyingCoupon}
                      />
                      <Button
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponCode.trim()}
                        className="h-11 px-6"
                      >
                        {isApplyingCoupon ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Aplicar'
                        )}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {couponError}
                      </p>
                    )}
                    {couponSuccess && (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        {couponSuccess}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notas del Pedido */}
          {(isGuestMode || isAuthenticated) && (
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

          {/* Metodo de Pago */}
          {deliveryOption && (
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
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 flex items-start gap-2">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>
                        Retiraras tu pedido en: <strong>{selectedBranch.name}</strong>
                        <br />
                        {selectedBranch.address}
                      </span>
                    </p>
                  </div>
                )}

                {deliveryOption === 'bodega' && (
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
                  (deliveryOption !== 'bodega' && !hasAddress) ||
                  (deliveryOption !== 'bodega' && !selectedAddress) ||
                  (deliveryOption !== 'bodega' && !selectedChilexpressOption) ||
                  !acceptedTerms ||
                  (selectedChilexpressOption?.requiresBranchSelection && !selectedBranch) ||
                  (isAuthenticated && (!shippingRut || shippingRut === '66666666-6'))
                }
                onClick={handleSubmit}
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
                ) : isLoadingShipping ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Calculando envio...</>
                ) : !deliveryOption ? (
                  "Selecciona una opcion de entrega"
                ) : deliveryOption === 'bodega' ? (
                  `Pagar $${formatCLP(finalTotal)}`
                ) : isAuthenticated && (!shippingRut || shippingRut === '66666666-6') ? (
                  "Ingresa tu RUT para el envío"
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
              
              {!acceptedTerms && deliveryOption && (
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