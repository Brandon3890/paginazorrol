"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  ArrowLeft, 
  User, 
  Save, 
  LogOut, 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Star,
  Home,
  Briefcase,
  Building,
  Phone,
  Mail,
  Shield,
  AlertCircle,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import ChangePasswordForm from "@/app/profile/ChangePasswordForm"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Commune {
  name: string
  postalCode: string
}

interface Region {
  name: string
  region_iso_3166_2: string
  romanNumber: string
  number: string
  communes: Commune[]
}

interface RegionsResponse {
  regions: Region[]
}

// Función para obtener el ícono según el título de la dirección
const getAddressIcon = (title: string) => {
  const lowerTitle = title.toLowerCase()
  if (lowerTitle.includes('casa') || lowerTitle.includes('hogar')) return <Home className="w-4 h-4" />
  if (lowerTitle.includes('trabajo') || lowerTitle.includes('oficina')) return <Briefcase className="w-4 h-4" />
  if (lowerTitle.includes('departamento') || lowerTitle.includes('depto')) return <Building className="w-4 h-4" />
  return <MapPin className="w-4 h-4" />
}

export default function ProfilePage() {
  const { user, isAuthenticated, updateUser, logout, addUserAddress, updateUserAddress, deleteUserAddress, setDefaultAddress } = useAuthStore()
  const router = useRouter()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isAddressLoading, setIsAddressLoading] = useState(false)
  const [regions, setRegions] = useState<Region[]>([])
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [addressToDelete, setAddressToDelete] = useState<number | null>(null)
  const [addressForm, setAddressForm] = useState({
    title: "",
    street: "",
    hasNoNumber: false,
    regionIso: "",
    communeName: "",
    postalCode: "",
    department: "",
    deliveryInstructions: ""
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
      })
    }

    // Cargar regiones
    fetchRegions()
  }, [user, isAuthenticated, router])

  const fetchRegions = async () => {
    try {
      const response = await fetch('/api/regions')
      const data: RegionsResponse = await response.json()
      setRegions(data.regions || [])
    } catch (error) {
      console.error('Error loading regions:', error)
      toast({
        title: "Error",
        description: "No se pudieron cargar las regiones",
        variant: "destructive",
      })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    // Limpiar error del campo cuando el usuario empieza a escribir
    if (formErrors[e.target.name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[e.target.name]
        return newErrors
      })
    }
  }

  const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const newForm = {
      ...addressForm,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }

    setAddressForm(newForm)

    // Limpiar error del campo
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }

    // Si cambia la región, limpiar comuna y código postal
    if (name === 'regionIso') {
      setAddressForm(prev => ({
        ...prev,
        communeName: "",
        postalCode: ""
      }))
    }

    // Si cambia la comuna, actualizar automáticamente el código postal
    if (name === 'communeName' && value) {
      const selectedRegion = regions.find(r => r.region_iso_3166_2 === newForm.regionIso)
      const selectedCommune = selectedRegion?.communes.find(c => c.name === value)
      if (selectedCommune) {
        setAddressForm(prev => ({
          ...prev,
          postalCode: selectedCommune.postalCode
        }))
      }
    }
  }

  const validateAddressForm = () => {
    const errors: Record<string, string> = {}
    
    if (!addressForm.title) errors.title = "El título es requerido"
    if (!addressForm.street) errors.street = "La calle es requerida"
    if (!addressForm.regionIso) errors.regionIso = "La región es requerida"
    if (!addressForm.communeName) errors.communeName = "La comuna es requerida"
    if (!addressForm.postalCode) errors.postalCode = "El código postal es requerido"
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await updateUser(formData)
      toast({
        title: "Perfil actualizado",
        description: "Tu información ha sido guardada correctamente.",
        duration: 3000,
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil. Inténtalo de nuevo.",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateAddressForm()) {
      toast({
        title: "Error de validación",
        description: "Por favor completa todos los campos requeridos.",
        variant: "destructive",
      })
      return
    }

    setIsAddressLoading(true)

    try {
      const selectedRegion = regions.find(r => r.region_iso_3166_2 === addressForm.regionIso)

      const addressData = {
        title: addressForm.title,
        street: addressForm.street,
        hasNoNumber: addressForm.hasNoNumber,
        regionIso: addressForm.regionIso,
        regionName: selectedRegion?.name || "",
        communeName: addressForm.communeName,
        postalCode: addressForm.postalCode,
        department: addressForm.department,
        deliveryInstructions: addressForm.deliveryInstructions,
        isDefault: !user?.addresses || user.addresses.length === 0
      }

      if (editingAddress) {
        await updateUserAddress(editingAddress.id, addressData)
        toast({
          title: "Dirección actualizada",
          description: "Tu dirección ha sido actualizada correctamente.",
        })
      } else {
        await addUserAddress(addressData)
        toast({
          title: "Dirección agregada",
          description: "Tu nueva dirección ha sido guardada.",
        })
      }

      setShowAddressForm(false)
      setEditingAddress(null)
      setAddressForm({
        title: "",
        street: "",
        hasNoNumber: false,
        regionIso: "",
        communeName: "",
        postalCode: "",
        department: "",
        deliveryInstructions: ""
      })
      setFormErrors({})
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo guardar la dirección. Inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsAddressLoading(false)
    }
  }

  const handleEditAddress = (address: any) => {
    setEditingAddress(address)
    setAddressForm({
      title: address.title,
      street: address.street,
      hasNoNumber: address.hasNoNumber,
      regionIso: address.regionIso,
      communeName: address.communeName,
      postalCode: address.postalCode,
      department: address.department || "",
      deliveryInstructions: address.deliveryInstructions || ""
    })
    setShowAddressForm(true)
    setFormErrors({})
  }

  const confirmDeleteAddress = (id: number) => {
    setAddressToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleDeleteAddress = async () => {
    if (!addressToDelete) return

    try {
      await deleteUserAddress(addressToDelete)
      toast({
        title: "Dirección eliminada",
        description: "La dirección ha sido eliminada correctamente.",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la dirección. Inténtalo de nuevo.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setAddressToDelete(null)
    }
  }

  const handleSetDefaultAddress = async (id: number) => {
    try {
      await setDefaultAddress(id)
      toast({
        title: "Dirección predeterminada",
        description: "La dirección ha sido establecida como predeterminada.",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo establecer la dirección predeterminada.",
        variant: "destructive",
      })
    }
  }

  const handleCancelAddressForm = () => {
    setShowAddressForm(false)
    setEditingAddress(null)
    setAddressForm({
      title: "",
      street: "",
      hasNoNumber: false,
      regionIso: "",
      communeName: "",
      postalCode: "",
      department: "",
      deliveryInstructions: ""
    })
    setFormErrors({})
  }

  const selectedRegion = regions.find(r => r.region_iso_3166_2 === addressForm.regionIso)

  const handleLogout = () => {
    logout()
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión correctamente.",
      duration: 3000,
    })
    router.push("/")
  }

  // Obtener iniciales para el avatar
  const getInitials = () => {
    const first = formData.firstName.charAt(0).toUpperCase()
    const last = formData.lastName.charAt(0).toUpperCase()
    return first + last
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-muted/30 rounded-full w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 flex items-center justify-center">
            <User className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold mb-2">No autenticado</h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">Por favor inicia sesión para ver tu perfil.</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center">
            <Link href="/login" className="w-full sm:w-auto">
              <Button className="w-full">Iniciar Sesión</Button>
            </Link>
            <Link href="/registro" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full">Registrarse</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header con avatar y nombre - Versión móvil mejorada */}
        <div className="mb-4 sm:mb-8">
          <Link href="/" className="inline-flex items-center text-xs sm:text-sm text-muted-foreground hover:text-foreground mb-3 sm:mb-4">
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Volver a la tienda
          </Link>
          
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Opcion de avatar, por si se implementa mas tarde  
            <Avatar className="w-12 h-12 sm:w-16 sm:h-16 border-2 border-primary/10">
              <AvatarFallback className="bg-primary/5 text-primary text-base sm:text-xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>*/}
            <div className="flex-1 min-w-0"> {/* min-w-0 para permitir truncado */}
              <h1 className="text-lg sm:text-2xl font-bold truncate">
                {formData.firstName} {formData.lastName}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">{formData.email}</span>
              </p>
              {formData.phone && (
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 truncate">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="truncate">{formData.phone}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="info" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="info" className="text-xs sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="truncate">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="text-xs sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="truncate">Direcciones</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 flex-shrink-0" />
              <span className="truncate">Seguridad</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <User className="w-4 h-4 sm:w-5 sm:h-5" />
                  Información Personal
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Actualiza tu información de contacto
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="firstName" className="text-xs sm:text-sm">Nombre</Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        required
                        value={formData.firstName}
                        onChange={handleInputChange}
                        placeholder="Juan"
                        className="h-8 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1 sm:space-y-2">
                      <Label htmlFor="lastName" className="text-xs sm:text-sm">Apellido</Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        required
                        value={formData.lastName}
                        onChange={handleInputChange}
                        placeholder="Pérez"
                        className="h-8 sm:h-10 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="tu@email.com"
                      className="h-8 sm:h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1 sm:space-y-2">
                    <Label htmlFor="phone" className="text-xs sm:text-sm">Teléfono</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+56 9 1234 5678"
                      className="h-8 sm:h-10 text-sm"
                    />
                  </div>

                  <Separator className="my-3 sm:my-4" />

                  <Button type="submit" className="w-full h-8 sm:h-10 text-sm" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addresses">
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                      Mis Direcciones
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Gestiona tus direcciones de envío
                    </CardDescription>
                  </div>
                  {!showAddressForm && (
                    <Button 
                      size="sm"
                      onClick={() => {
                        setShowAddressForm(true)
                        setEditingAddress(null)
                        setAddressForm({
                          title: "",
                          street: "",
                          hasNoNumber: false,
                          regionIso: "",
                          communeName: "",
                          postalCode: "",
                          department: "",
                          deliveryInstructions: ""
                        })
                      }}
                      className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-9"
                    >
                      <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Nueva Dirección
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                {showAddressForm ? (
                  <ScrollArea className="h-[400px] sm:h-auto pr-3">
                    <form onSubmit={handleAddressSubmit} className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 border rounded-lg p-3 sm:p-4 bg-muted/30">
                      <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">
                        {editingAddress ? 'Editar Dirección' : 'Agregar Nueva Dirección'}
                      </h3>
                      
                      <div className="grid grid-cols-1 gap-3 sm:gap-4">
                        <div className="space-y-1 sm:space-y-2">
                          <Label htmlFor="title" className="text-xs sm:text-sm">Título de la dirección *</Label>
                          <Input
                            id="title"
                            name="title"
                            required
                            value={addressForm.title}
                            onChange={handleAddressInputChange}
                            placeholder="Ej: Casa, Trabajo"
                            className={`h-8 sm:h-10 text-sm ${formErrors.title ? "border-destructive" : ""}`}
                          />
                          {formErrors.title && (
                            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3" />
                              {formErrors.title}
                            </p>
                          )}
                        </div>
                        
                        <div className="space-y-1 sm:space-y-2">
                          <Label htmlFor="street" className="text-xs sm:text-sm">Calle y número *</Label>
                          <Input
                            id="street"
                            name="street"
                            required
                            value={addressForm.street}
                            onChange={handleAddressInputChange}
                            placeholder="Ej: Av. Principal 123"
                            className={`h-8 sm:h-10 text-sm ${formErrors.street ? "border-destructive" : ""}`}
                          />
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="hasNoNumber"
                              name="hasNoNumber"
                              checked={addressForm.hasNoNumber}
                              onChange={handleAddressInputChange}
                              className="rounded"
                            />
                            <Label htmlFor="hasNoNumber" className="text-xs">
                              Mi calle no tiene número
                            </Label>
                          </div>
                          {formErrors.street && (
                            <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3" />
                              {formErrors.street}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                        <div className="grid grid-cols-1 gap-3">
                          <div className="space-y-1 sm:space-y-2">
                            <Label htmlFor="regionIso" className="text-xs sm:text-sm">Región *</Label>
                            <select
                              id="regionIso"
                              name="regionIso"
                              required
                              value={addressForm.regionIso}
                              onChange={handleAddressInputChange}
                              className={`w-full h-8 sm:h-10 text-sm p-1 sm:p-2 border rounded-md ${formErrors.regionIso ? "border-destructive" : ""}`}
                            >
                              <option value="">Selecciona una región</option>
                              {regions.map(region => (
                                <option key={region.region_iso_3166_2} value={region.region_iso_3166_2}>
                                  {region.name}
                                </option>
                              ))}
                            </select>
                            {formErrors.regionIso && (
                              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {formErrors.regionIso}
                              </p>
                            )}
                          </div>
                          
                          <div className="space-y-1 sm:space-y-2">
                            <Label htmlFor="communeName" className="text-xs sm:text-sm">Comuna *</Label>
                            <select
                              id="communeName"
                              name="communeName"
                              required
                              value={addressForm.communeName}
                              onChange={handleAddressInputChange}
                              disabled={!addressForm.regionIso}
                              className={`w-full h-8 sm:h-10 text-sm p-1 sm:p-2 border rounded-md ${formErrors.communeName ? "border-destructive" : ""}`}
                            >
                              <option value="">Selecciona una comuna</option>
                              {selectedRegion?.communes.map(commune => (
                                <option key={commune.name} value={commune.name}>
                                  {commune.name}
                                </option>
                              ))}
                            </select>
                            {formErrors.communeName && (
                              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {formErrors.communeName}
                              </p>
                            )}
                          </div>
                          
                          <div className="space-y-1 sm:space-y-2">
                            <Label htmlFor="postalCode" className="text-xs sm:text-sm">Código Postal *</Label>
                            <Input
                              id="postalCode"
                              name="postalCode"
                              required
                              value={addressForm.postalCode}
                              onChange={handleAddressInputChange}
                              placeholder="Ej: 8320000"
                              className={`h-8 sm:h-10 text-sm ${formErrors.postalCode ? "border-destructive" : ""}`}
                            />
                            {formErrors.postalCode && (
                              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                {formErrors.postalCode}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1 sm:space-y-2">
                          <Label htmlFor="department" className="text-xs sm:text-sm">Departamento (opcional)</Label>
                          <Input
                            id="department"
                            name="department"
                            value={addressForm.department}
                            onChange={handleAddressInputChange}
                            placeholder="Número o nombre del departamento"
                            className="h-8 sm:h-10 text-sm"
                          />
                        </div>

                        <div className="space-y-1 sm:space-y-2">
                          <Label htmlFor="deliveryInstructions" className="text-xs sm:text-sm">Indicaciones (opcional)</Label>
                          <textarea
                            id="deliveryInstructions"
                            name="deliveryInstructions"
                            value={addressForm.deliveryInstructions}
                            onChange={handleAddressInputChange}
                            placeholder="Ej: Timbre azul, dejar con conserjería"
                            rows={2}
                            className="w-full p-2 text-sm border rounded-md"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button type="submit" className="w-full sm:flex-1 h-8 sm:h-10 text-sm" disabled={isAddressLoading}>
                          {isAddressLoading ? (
                            <>
                              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                              Guardando...
                            </>
                          ) : (
                            <>
                              <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                              {editingAddress ? "Actualizar" : "Agregar"}
                            </>
                          )}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleCancelAddressForm}
                          className="w-full sm:flex-1 h-8 sm:h-10 text-sm"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </ScrollArea>
                ) : null}

                <div className="space-y-3 sm:space-y-4">
                  {user.addresses && user.addresses.length > 0 ? (
                    user.addresses.map((address) => (
                      <div 
                        key={address.id} 
                        className={`border rounded-lg p-3 sm:p-4 transition-all hover:shadow-md ${
                          address.isDefault ? 'border-primary/50 bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 flex-wrap">
                              <div className="p-1 bg-muted rounded-full flex-shrink-0">
                                {getAddressIcon(address.title)}
                              </div>
                              <h4 className="font-semibold text-sm sm:text-base truncate">{address.title}</h4>
                              {address.isDefault && (
                                <Badge variant="default" className="bg-primary text-primary-foreground text-xs whitespace-nowrap">
                                  <Star className="w-3 h-3 mr-1 fill-current" />
                                  Predet.
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground break-words">
                              {address.street}
                              {address.hasNoNumber && " (Sin número)"}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground break-words">
                              {address.communeName}, {address.regionName}
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              CP: {address.postalCode}
                            </p>
                            {address.department && (
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                Depto: {address.department}
                              </p>
                            )}
                            {address.deliveryInstructions && (
                              <div className="mt-1 sm:mt-2 p-1 sm:p-2 bg-muted/30 rounded-md">
                                <p className="text-xs text-muted-foreground break-words">
                                  <strong>Indicaciones:</strong> {address.deliveryInstructions}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex sm:flex-col gap-1 sm:ml-4 justify-end">
                            {!address.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSetDefaultAddress(address.id)}
                                title="Establecer como predeterminada"
                                className="h-7 sm:h-8 px-2"
                              >
                                <Star className="w-3 h-3 sm:w-4 sm:h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAddress(address)}
                              title="Editar dirección"
                              className="h-7 sm:h-8 px-2"
                            >
                              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => confirmDeleteAddress(address.id)}
                              title="Eliminar dirección"
                              className="h-7 sm:h-8 px-2 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 sm:py-12 border-2 border-dashed rounded-lg">
                      <MapPin className="w-8 h-8 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-2 sm:mb-4" />
                      <p className="text-sm sm:text-base text-muted-foreground mb-1 sm:mb-2">No tienes direcciones guardadas</p>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 px-4">
                        Agrega una dirección para facilitar tus compras
                      </p>
                      <Button 
                        onClick={() => setShowAddressForm(true)}
                        size="sm"
                        className="text-xs sm:text-sm h-8 sm:h-9"
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Agregar dirección
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <ChangePasswordForm />
          </TabsContent>
        </Tabs>

        {/* Botón de Cerrar Sesión */}
        <div className="flex justify-end mt-4 sm:mt-6">
          <Button variant="outline" onClick={handleLogout} className="text-destructive hover:text-destructive h-8 sm:h-10 text-xs sm:text-sm">
            <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {/* Dialog de confirmación para eliminar dirección */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="w-[90%] sm:w-full max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">¿Eliminar dirección?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Esta acción no se puede deshacer. La dirección será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAddress} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs sm:text-sm h-8 sm:h-10">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}