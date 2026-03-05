"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useCategoryStore } from "@/lib/category-store"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

export default function NewCategoryPage() {
  const router = useRouter()
  const addCategory = useCategoryStore((state) => state.addCategory)

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    isActive: true
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = "El nombre es requerido"
    }
    
    if (!formData.slug.trim()) {
      newErrors.slug = "El slug es requerido"
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = "El slug solo puede contener letras minúsculas, números y guiones"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    addCategory(formData)
    router.push("/admin/categories")
  }

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "")
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/admin/categories">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver a Categorías
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Nueva Categoría</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Crea una nueva categoría para organizar tus productos
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Información de la Categoría</CardTitle>
            <CardDescription>
              Completa los datos de la nueva categoría. Las subcategorías las podrás agregar después.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la categoría *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      handleChange("name", e.target.value)
                      if (!formData.slug) {
                        handleChange("slug", generateSlug(e.target.value))
                      }
                    }}
                    placeholder="Ej: Juegos de Mesa"
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => handleChange("slug", e.target.value)}
                    placeholder="Ej: juegos-mesa"
                    className={errors.slug ? "border-destructive" : ""}
                  />
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug}</p>}
                  <p className="text-xs text-muted-foreground">
                    El slug se usa en la URL. Solo letras minúsculas, números y guiones.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="Describe brevemente esta categoría..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="isActive">Categoría activa</Label>
                    <p className="text-sm text-muted-foreground">
                      Las categorías inactivas no se mostrarán en la tienda
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleChange("isActive", checked)}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Link href="/admin/categories" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Cancelar
                  </Button>
                </Link>
                <Button type="submit" className="flex-1 bg-[#C2410C] hover:bg-[#9A3412]">
                  <Save className="w-4 h-4 mr-2" />
                  Crear Categoría
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  )
}