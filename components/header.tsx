"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Search, ShoppingCart, User, LogIn, UserPlus, Package, Settings, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { useAuthStore } from "@/lib/auth-store"
import { CartDrawer } from "@/components/cart-drawer"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useCategoryStore } from "@/lib/category-store"

export function Header() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()

  const { getTotalItems, toggleCart } = useCartStore()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { categories, fetchCategories } = useCategoryStore()
  
  // Usar useEffect para marcar cuando el componente está montado en el cliente
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Solo calcular totalItems después de que el componente esté montado
  const totalItems = isMounted ? getTotalItems() : 0

  // Cargar categorías al montar el componente
  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Transformar categorías para el header (solo las activas)
  const headerCategories = categories
    .filter(category => category.is_active)
    .map(category => ({
      name: category.name,
      href: `/filtro/${category.slug}`, // Cambiado de /${category.slug} a /filtro/${category.slug}
      subcategories: category.subcategories
        .filter(sub => sub.is_active)
        .map(sub => ({
          name: sub.name,
          href: `/filtro/${category.slug}/${sub.slug}` // Cambiado a la nueva ruta
        }))
    }))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchExpanded(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryName) ? prev.filter((name) => name !== categoryName) : [...prev, categoryName],
    )
  }

  return (
    <>
      <header className="bg-white border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-10 h-10 bg-[#C2410C] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">L</span>
              </div>
            </Link>

            <div className="hidden lg:flex flex-1 justify-center">
              <NavigationMenu>
                <NavigationMenuList className="flex gap-1">
                  {headerCategories.map((category) => (
                    <NavigationMenuItem key={category.name}>
                      <NavigationMenuTrigger
                        className="
                          bg-transparent hover:bg-muted text-foreground font-medium px-4 py-2 h-auto
                          flex items-center gap-1
                          [&>svg]:h-4 [&>svg]:w-4 [&>svg]:ml-1 [&>svg]:text-foreground
                        "
                      >
                        {category.name}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="grid w-[400px] gap-2 p-4 md:w-[500px] md:grid-cols-2">
                          {category.subcategories.map((subcategory) => (
                            <Link
                              key={subcategory.name}
                              href={subcategory.href}
                              className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              <div className="text-sm font-medium">{subcategory.name}</div>
                            </Link>
                          ))}
                        </div>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </Button>

              {/* Search Bar - Desktop 
              <div className="hidden md:flex items-center">
                {searchExpanded ? (
                  <form onSubmit={handleSearch} className="flex items-center gap-2 animate-in slide-in-from-right">
                    <Input
                      placeholder="Buscar..."
                      className="w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      onBlur={() => {
                        if (!searchQuery) setSearchExpanded(false)
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSearchExpanded(false)
                        setSearchQuery("")
                      }}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </form>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setSearchExpanded(true)}>
                    <Search className="w-5 h-5" />
                  </Button>
                )}
              </div>*/}

              {/* User Menu */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-sm font-medium">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">{user?.email}</div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <User className="w-4 h-4 mr-2" />
                        Mi Perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/orders">
                        <Package className="w-4 h-4 mr-2" />
                        Mis Pedidos
                      </Link>
                    </DropdownMenuItem>
                    {user?.role === 'admin' && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <Settings className="w-4 h-4 mr-2" />
                          Administración
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogIn className="w-4 h-4 mr-2" />
                      Cerrar Sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild>
                      <Link href="/login">
                        <LogIn className="w-4 h-4 mr-2" />
                        Iniciar Sesión
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/register">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Crear Cuenta
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Cart Button - SOLUCIÓN PARA HIDRATACIÓN */}
              <Button variant="ghost" size="icon" className="relative" onClick={toggleCart}>
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 bg-[#C2410C] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold"
                    suppressHydrationWarning
                  >
                    {totalItems}
                  </span>
                )}
              </Button>

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetContent side="left" className="w-80">
                  <SheetTitle>Menú</SheetTitle>
                  <div className="flex flex-col gap-6 mt-8">
                    {/* Mobile Search */}
                    <form onSubmit={handleSearch} className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Buscar..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </form>

                    {/* Mobile Categories */}
                    <nav className="flex flex-col gap-2">
                      {headerCategories.map((category) => (
                        <div key={category.name} className="space-y-1">
                          <button
                            onClick={() => toggleCategory(category.name)}
                            className="w-full flex items-center justify-between font-semibold text-lg text-foreground hover:text-[#C2410C] transition-colors py-2"
                          >
                            {category.name}
                            {expandedCategories.includes(category.name) ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRight className="w-5 h-5" />
                            )}
                          </button>
                          {expandedCategories.includes(category.name) && (
                            <div className="pl-4 space-y-1 animate-in slide-in-from-top">
                              {category.subcategories.map((sub) => (
                                <Link
                                  key={sub.name}
                                  href={sub.href}
                                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5"
                                  onClick={() => setMobileMenuOpen(false)}
                                >
                                  {sub.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  )
}