// app/admin/banners/page.tsx
"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { useAuthStore } from "@/lib/auth-store"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import {
  ImagePlus,
  Trash2,
  X,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Loader2,
  RefreshCw,
  Pencil,
  Plus,
  Type,
  Image as ImageIcon,
  Palette,
  Link2,
  Save,
  Undo2,
  Copy,
  Check,
  Layout,
  Contrast,
  Sun,
  Droplets,
  Sparkles,
  ArrowLeft
} from "lucide-react"

interface Banner {
  id: number
  title: string | null
  subtitle: string | null
  text: string | null
  image: string
  link: string | null
  is_active: number
  order: number
  show_text: number
  overlay_color: string
  text_color: string
  overlay_opacity: number
  text_position: "left" | "center" | "right"
  text_size: "small" | "medium" | "large"
}

const PRESET_COLORS = [
  { name: "Blanco", value: "#ffffff", bgClass: "bg-white" },
  { name: "Negro", value: "#000000", bgClass: "bg-black" },
  { name: "Gris oscuro", value: "#1f2937", bgClass: "bg-gray-800" },
  { name: "Rojo", value: "#dc2626", bgClass: "bg-red-600" },
  { name: "Naranja", value: "#ea580c", bgClass: "bg-orange-600" },
  { name: "Verde", value: "#16a34a", bgClass: "bg-green-600" },
  { name: "Azul", value: "#2563eb", bgClass: "bg-blue-600" },
  { name: "Púrpura", value: "#9333ea", bgClass: "bg-purple-600" },
  { name: "Rosa", value: "#ec4899", bgClass: "bg-pink-600" },
  { name: "Amarillo", value: "#eab308", bgClass: "bg-yellow-600" },
]

const TEXT_SIZES = {
  small: { title: "text-xl md:text-2xl", subtitle: "text-sm md:text-base", text: "text-xs md:text-sm" },
  medium: { title: "text-2xl md:text-3xl", subtitle: "text-base md:text-lg", text: "text-sm md:text-base" },
  large: { title: "text-3xl md:text-4xl", subtitle: "text-lg md:text-xl", text: "text-base md:text-lg" }
}

const hexToRgba = (hex: string, opacity: number): string => {
  if (!hex) return `rgba(0,0,0,${opacity / 100})`
  if (hex.startsWith('rgba')) {
    return hex.replace(/[\d\.]+\)$/g, `${opacity / 100})`)
  }
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
}

export default function AdminBannersPage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("content")
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    text: "",
    link: "",
    isActive: true,
    showText: true,
    overlayColor: "#ffffff",
    textColor: "#1f2937",
    overlayOpacity: 70,
    textPosition: "left" as "left" | "center" | "right",
    textSize: "medium" as "small" | "medium" | "large"
  })

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push("/")
      return
    }
    loadBanners()
  }, [isAuthenticated, user, router])

  const loadBanners = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/banners/admin')
      const data = await response.json()
      if (data.success) {
        setBanners(data.banners)
      }
    } catch (error) {
      console.error('Error loading banners:', error)
    } finally {
      setLoading(false)
    }
  }

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/banners/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al subir la imagen');
    }

    const data = await response.json();
    return data.imagePath; 
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor selecciona una imagen");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen no puede superar los 2MB");
      return;
    }

    setIsUploading(true);
    
    try {
      // Subir la imagen al servidor usando FormData
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/banners/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir la imagen');
      }

      const data = await response.json();
      
      // data.imagePath es la ruta como /banners/banner_1234567890.jpg
      setImagePreview(data.imagePath);
      setImageFile(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert("Error al subir la imagen");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setImagePreview("")
    setImageFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.showText && !formData.title.trim()) {
      return
    }
    
    if (!imagePreview && !editingBanner?.image) {
      return
    }
    
    setSaving(true)

    const bannerData = {
      title: formData.title || null,
      subtitle: formData.subtitle || null,
      text: formData.text || null,
      image: imagePreview || editingBanner?.image,
      link: formData.link || null,
      isActive: formData.isActive,
      showText: formData.showText,
      overlayColor: formData.overlayColor,
      textColor: formData.textColor,
      overlayOpacity: formData.overlayOpacity,
      textPosition: formData.textPosition,
      textSize: formData.textSize
};

    try {
      let response
      if (editingBanner) {
        response = await fetch('/api/banners/admin', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingBanner.id, ...bannerData })
        })
      } else {
        response = await fetch('/api/banners/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bannerData)
        })
      }

      if (response.ok) {
        await loadBanners()
        resetForm()
      }
    } catch (error) {
      console.error('Error saving banner:', error)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setEditingBanner(null)
    setIsEditing(false)
    setFormData({
      title: "",
      subtitle: "",
      text: "",
      link: "",
      isActive: true,
      showText: true,
      overlayColor: "#ffffff",
      textColor: "#1f2937",
      overlayOpacity: 70,
      textPosition: "left",
      textSize: "medium"
    })
    setImagePreview("")
    setImageFile(null)
    setActiveTab("content")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner)
    setIsEditing(true)
    setFormData({
      title: banner.title || "",
      subtitle: banner.subtitle || "",
      text: banner.text || "",
      link: banner.link || "",
      isActive: banner.is_active === 1,
      showText: banner.show_text === 1,
      overlayColor: banner.overlay_color || "#ffffff",
      textColor: banner.text_color || "#1f2937",
      overlayOpacity: banner.overlay_opacity || 70,
      textPosition: banner.text_position || "left",
      textSize: banner.text_size || "medium"
    })
    setImagePreview(banner.image)
    setImageFile(null)
    setActiveTab("content")
  }

  const handleDelete = async (id: number, imagePath?: string) => {
    try {
      // Eliminar el banner de la base de datos
      const response = await fetch(`/api/banners/admin?id=${id}`, { 
        method: 'DELETE' 
      });
      
      if (response.ok) {
        // Solo intentar eliminar el archivo si es una ruta válida (no base64)
        if (imagePath && imagePath.startsWith('/banners/') && !imagePath.includes('data:image')) {
          // Verificar que no sea imagen por defecto
          const defaultImages = ['/banners/witcher.jpg', '/banners/banner2.jpg'];
          if (!defaultImages.includes(imagePath)) {
            await fetch(`/api/banners/delete-image?path=${encodeURIComponent(imagePath)}`, {
              method: 'DELETE'
            });
          }
        }
        
        await loadBanners();
        if (editingBanner?.id === id) resetForm();
      }
    } catch (error) {
      console.error('Error deleting banner:', error);
    }
  };

    const forceUpdateBanner = async () => {
    try {
      // Llamar a revalidate para purgar cache
      await fetch('/api/revalidate?path=/', { method: 'POST' })
      
      // Recargar banners localmente
      await loadBanners()
      
      // Pequeño delay para asegurar que el cache se purgó
      setTimeout(async () => {
        await loadBanners()
      }, 500)
    } catch (error) {
      console.error('Error forcing update:', error)
    }
  }


  const toggleActive = async (id: number, currentActive: number) => {
    const banner = banners.find(b => b.id === id)
    if (!banner) return

    try {
      const response = await fetch('/api/banners/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...banner,
          isActive: currentActive === 0 
        })
      })
      if (response.ok) {
        await loadBanners()
      }
    } catch (error) {
      console.error('Error toggling banner:', error)
    }
  }

  const moveBanner = async (id: number, direction: "up" | "down") => {
    const index = banners.findIndex(b => b.id === id)
    if (direction === "up" && index === 0) return
    if (direction === "down" && index === banners.length - 1) return
    
    const newIndex = direction === "up" ? index - 1 : index + 1
    const newBanners = [...banners]
    ;[newBanners[index], newBanners[newIndex]] = [newBanners[newIndex], newBanners[index]]
    
    const reorderedBanners = newBanners.map((b, idx) => ({ id: b.id, order: idx }))
    
    try {
      const response = await fetch('/api/banners/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banners: reorderedBanners })
      })
      if (response.ok) {
        setBanners(newBanners)
      }
    } catch (error) {
      console.error('Error reordering banners:', error)
    }
  }

  const resetToDefault = async () => {
    // Función vacía o puedes implementarla después
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getPositionClass = () => {
    switch (formData.textPosition) {
      case "center": return "justify-center text-center"
      case "right": return "justify-end text-right"
      default: return "justify-start text-left"
    }
  }

  const getTextSizeClass = () => {
    return TEXT_SIZES[formData.textSize]
  }

  const overlayRgba = hexToRgba(formData.overlayColor, formData.overlayOpacity)

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Botón para volver al dashboard */}
        <Link href="/admin">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>
        </Link>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Gestión de Banners</h1>
            <p className="text-muted-foreground">Administra los banners del home</p>
          </div>
          <Button variant="outline" onClick={resetToDefault}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Restaurar Default
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Formulario - Panel izquierdo */}
          <Card className="lg:sticky lg:top-4 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isEditing ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {isEditing ? "Editar Banner" : "Nuevo Banner"}
              </CardTitle>
              <CardDescription>
                {isEditing ? "Modifica los datos del banner" : "Completa los datos para crear un nuevo banner"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="content">Contenido</TabsTrigger>
                  <TabsTrigger value="design">Diseño</TabsTrigger>
                  <TabsTrigger value="colors">Colores</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  {/* Pestaña: Contenido */}
                  <TabsContent value="content" className="space-y-4">
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="showTextYes"
                          checked={formData.showText}
                          onChange={() => setFormData({ ...formData, showText: true })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="showTextYes" className="cursor-pointer flex items-center gap-1">
                          <Type className="w-4 h-4" />
                          Con texto
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          id="showTextNo"
                          checked={!formData.showText}
                          onChange={() => setFormData({ ...formData, showText: false })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="showTextNo" className="cursor-pointer flex items-center gap-1">
                          <ImageIcon className="w-4 h-4" />
                          Solo imagen
                        </Label>
                      </div>
                    </div>

                    {formData.showText && (
                      <>
                        <div>
                          <Label htmlFor="title">Título *</Label>
                          <Input
                            id="title"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ej: THE WITCHER"
                          />
                        </div>

                        <div>
                          <Label htmlFor="subtitle">Subtítulo</Label>
                          <Input
                            id="subtitle"
                            value={formData.subtitle}
                            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                            placeholder="Ej: PATH OF DESTINY"
                          />
                        </div>

                        <div>
                          <Label htmlFor="text">Texto</Label>
                          <Textarea
                            id="text"
                            value={formData.text}
                            onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                            placeholder="Ej: DON'T MISS THE LAUNCH DAY!"
                            rows={2}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label htmlFor="link">Enlace (opcional)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="link"
                          value={formData.link}
                          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                          placeholder="Ej: /products/2"
                          className="flex-1"
                        />
                        {formData.link && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(formData.link || "")}
                          >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Deja vacío si no quieres que el banner sea clickeable
                      </p>
                    </div>

                    <div>
                      <Label>Imagen *</Label>
                      <div className="mt-2">
                        {imagePreview ? (
                          <div className="relative inline-block">
                            <div className="relative w-48 h-32 rounded-lg overflow-hidden border">
                              <Image
                                src={imagePreview}
                                alt="Preview"
                                fill
                                className="object-cover"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={removeImage}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed rounded-lg p-6 text-center">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                              id="image-upload"
                              ref={fileInputRef}
                            />
                            <label
                              htmlFor="image-upload"
                              className="cursor-pointer flex flex-col items-center gap-2"
                            >
                              <ImagePlus className="w-8 h-8 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                {isUploading ? "Subiendo..." : "Haz clic para subir imagen"}
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Recomendado: 1920x600px, máximo 2MB
                      </p>
                    </div>
                  </TabsContent>

                  {/* Pestaña: Diseño */}
                  <TabsContent value="design" className="space-y-4">
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Layout className="w-4 h-4" />
                        Posición del texto
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "left", label: "Izquierda", icon: "←" },
                          { value: "center", label: "Centro", icon: "⟷" },
                          { value: "right", label: "Derecha", icon: "→" }
                        ].map((pos) => (
                          <button
                            key={pos.value}
                            type="button"
                            className={`p-3 rounded-lg border-2 transition-all ${
                              formData.textPosition === pos.value
                                ? "border-orange-500 bg-orange-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => setFormData({ ...formData, textPosition: pos.value as any })}
                          >
                            <div className="text-center">
                              <div className="text-xl mb-1">{pos.icon}</div>
                              <span className="text-sm">{pos.label}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4" />
                        Tamaño del texto
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: "small", label: "Pequeño", preview: "Texto" },
                          { value: "medium", label: "Mediano", preview: "Texto" },
                          { value: "large", label: "Grande", preview: "Texto" }
                        ].map((size) => (
                          <button
                            key={size.value}
                            type="button"
                            className={`p-3 rounded-lg border-2 transition-all ${
                              formData.textSize === size.value
                                ? "border-orange-500 bg-orange-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => setFormData({ ...formData, textSize: size.value as any })}
                          >
                            <div className="text-center">
                              <div className={`font-bold ${
                                size.value === "small" ? "text-sm" : size.value === "large" ? "text-xl" : "text-base"
                              }`}>
                                {size.preview}
                              </div>
                              <span className="text-xs text-muted-foreground mt-1 block">{size.label}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Droplets className="w-4 h-4" />
                        Opacidad del overlay ({formData.overlayOpacity}%)
                      </Label>
                      <Slider
                        value={[formData.overlayOpacity]}
                        onValueChange={(value) => setFormData({ ...formData, overlayOpacity: value[0] })}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Transparente (se ve imagen)</span>
                        <span>Opaco (cubre imagen)</span>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Pestaña: Colores */}
                  <TabsContent value="colors" className="space-y-4">
                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Palette className="w-4 h-4" />
                        Color del overlay (fondo semitransparente)
                      </Label>
                      <div className="grid grid-cols-5 gap-2 mb-2">
                        {PRESET_COLORS.slice(0, 10).map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={`h-10 rounded-lg border-2 transition-all ${color.bgClass} ${
                              formData.overlayColor === color.value
                                ? "border-orange-500 ring-2 ring-orange-200"
                                : "border-gray-200"
                            }`}
                            onClick={() => setFormData({ ...formData, overlayColor: color.value })}
                            title={color.name}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.overlayColor}
                          onChange={(e) => setFormData({ ...formData, overlayColor: e.target.value })}
                          className="w-10 h-10 rounded border cursor-pointer"
                        />
                        <Input
                          value={formData.overlayColor}
                          onChange={(e) => setFormData({ ...formData, overlayColor: e.target.value })}
                          className="flex-1 font-mono text-sm"
                          placeholder="#RRGGBB"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Este color se combinará con la opacidad para crear un overlay
                      </p>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2 mb-2">
                        <Sun className="w-4 h-4" />
                        Color del texto
                      </Label>
                      <div className="grid grid-cols-5 gap-2 mb-2">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            className={`h-10 rounded-lg border-2 transition-all ${color.bgClass} ${
                              formData.textColor === color.value
                                ? "border-orange-500 ring-2 ring-orange-200"
                                : "border-gray-200"
                            }`}
                            onClick={() => setFormData({ ...formData, textColor: color.value })}
                            title={color.name}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.textColor}
                          onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                          className="w-10 h-10 rounded border cursor-pointer"
                        />
                        <Input
                          value={formData.textColor}
                          onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                          className="flex-1 font-mono text-sm"
                          placeholder="#RRGGBB"
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <div className="flex items-center gap-2 pt-4 border-t">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="isActive" className="cursor-pointer">
                      Banner activo
                    </Label>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={isUploading || saving} className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? "Guardando..." : (isEditing ? "Actualizar Banner" : "Crear Banner")}
                    </Button>
                    {isEditing && (
                      <Button type="button" variant="outline" onClick={resetForm}>
                        <Undo2 className="w-4 h-4 mr-2" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </Tabs>
            </CardContent>
          </Card>

          {/* Vista previa en vivo - Panel derecho */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Vista Previa en Vivo
                </CardTitle>
                <CardDescription>
                  Así se verá tu banner en la página principal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative rounded-xl overflow-hidden border shadow-lg">
                  <div className="relative w-full h-[200px] md:h-[280px] overflow-hidden bg-gray-100">
                    {imagePreview ? (
                      <>
                        <Image
                          src={imagePreview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                        <div 
                          className="absolute inset-0 pointer-events-none"
                          style={{ backgroundColor: overlayRgba }}
                        />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-muted-foreground">Sube una imagen para ver la vista previa</p>
                      </div>
                    )}
                    
                    {formData.showText && imagePreview && (
                      <div className={`absolute inset-0 flex items-center px-6 md:px-12 ${getPositionClass()} pointer-events-none`}>
                        <div className="max-w-md space-y-2">
                          <p 
                            className="text-[10px] sm:text-xs tracking-widest uppercase"
                            style={{ color: formData.textColor, opacity: 0.7 }}
                          >
                            NOVEDADES
                          </p>
                          <h2 
                            className={`font-bold leading-tight ${getTextSizeClass().title}`}
                            style={{ color: formData.textColor }}
                          >
                            {formData.title || "Título aquí"}
                          </h2>
                          {formData.subtitle && (
                            <p 
                              className={getTextSizeClass().subtitle}
                              style={{ color: formData.textColor }}
                            >
                              {formData.subtitle}
                            </p>
                          )}
                          {formData.text && (
                            <p 
                              className={`font-medium ${getTextSizeClass().text}`}
                              style={{ color: formData.textColor }}
                            >
                              {formData.text}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-muted-foreground">
                    <strong>Info:</strong> Overlay: {formData.overlayColor} ({formData.overlayOpacity}%) | 
                    Texto: {formData.textColor} | 
                    Posición: {formData.textPosition} | 
                    Tamaño: {formData.textSize}
                  </p>
                  {formData.overlayOpacity < 100 && imagePreview && (
                    <p className="text-xs text-green-600 mt-1">
                      La imagen es visible detrás del overlay (opacidad {formData.overlayOpacity}%)
                    </p>
                  )}
                  {formData.overlayOpacity === 100 && imagePreview && (
                    <p className="text-xs text-orange-600 mt-1">
                      El overlay está completamente opaco, la imagen no se ve
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de banners existentes */}
            <Card>
              <CardHeader>
                <CardTitle>Banners Guardados</CardTitle>
                <CardDescription>
                  {banners.length} banner(s) configurado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {banners.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay banners. Crea uno nuevo.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {banners.map((banner, idx) => (
                      <div
                        key={banner.id}
                        className={`border rounded-lg p-3 transition-all ${
                          banner.is_active === 0 ? "opacity-60 bg-gray-50" : ""
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                            <Image
                              src={banner.image}
                              alt={banner.title || "Banner"}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate text-sm">
                              {banner.show_text === 1 ? (banner.title || "Sin título") : "Solo imagen"}
                            </h4>
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <Badge variant={banner.is_active === 1 ? "default" : "secondary"} className="text-xs">
                                {banner.is_active === 1 ? "Activo" : "Inactivo"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {banner.show_text === 1 ? "Texto" : "Solo img"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveBanner(banner.id, "up")}
                              disabled={idx === 0}
                            >
                              <ArrowUp className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => moveBanner(banner.id, "down")}
                              disabled={idx === banners.length - 1}
                            >
                              <ArrowDown className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600"
                              onClick={() => handleEdit(banner)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleActive(banner.id, banner.is_active)}
                            >
                              {banner.is_active === 1 ? (
                                <EyeOff className="w-3 h-3" />
                              ) : (
                                <Eye className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => handleDelete(banner.id, banner.image)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}