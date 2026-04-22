"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, ShoppingCart, User, LogIn, UserPlus, Package, Settings, Menu, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useRouter, usePathname } from "next/navigation"
import { useCartStore } from "@/lib/cart-store"
import { useAuthStore } from "@/lib/auth-store"
import { useProductStore } from "@/lib/product-store"
import { CartDrawer } from "@/components/cart-drawer"
import Link from "next/link"
import { useCategoryStore } from "@/lib/category-store"
import { motion } from "framer-motion"
import Image from "next/image"

export function Header() {
  const [searchQuery, setSearchQuery] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState(false)

  const router = useRouter()
  const pathname = usePathname()

  const { getTotalItems, toggleCart } = useCartStore()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { categories, fetchCategories } = useCategoryStore()
  const { globalSearchQuery, setGlobalSearchQuery } = useProductStore()

  useEffect(() => {
    setIsMounted(true)
    fetchCategories()
  }, [fetchCategories])

  const totalItems = isMounted ? getTotalItems() : 0

  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)

  const navItems = [
    { name: "PRODUCTOS", href: "/productos", hasDropdown: true },
    { name: "NOTICIAS", href: "/noticias", hasDropdown: false },
    { name: "QUIÉNES SOMOS", href: "/quienes-somos", hasDropdown: false },
    { name: "CONTACTO", href: "/contacto", hasDropdown: false },
  ]

  const headerCategories = categories
    .filter(category => category.is_active)
    .map(category => ({
      name: category.name,
      href: `/filtro/${category.slug}`,
    }))

  // Manejador de búsqueda instantánea - SOLO actualiza el store, NO redirige
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setGlobalSearchQuery(value) // Solo actualiza el store, sin redirigir
  }

  // Limpiar búsqueda
  const clearSearch = () => {
    setSearchQuery("")
    setGlobalSearchQuery("")
    setSearchExpanded(false)
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <div className="sticky top-0 z-50">
      {/* BANNER DE PÁGINA EN CONSTRUCCIÓN - ROJO - SIN ESPACIO */}
      <div className="bg-red-600 text-white py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          <motion.div
            animate={{ rotate: [0, 10, -10, 10, 0] }}
            transition={{ duration: 0.5, delay: 0.3, repeat: Infinity, repeatDelay: 5 }}
          >
            <AlertTriangle className="w-5 h-5" />
          </motion.div>
          <p className="text-sm font-medium text-center">
            <strong>Página en construcción</strong> - Algunas secciones están en desarrollo. 
          </p>
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.3, repeat: Infinity, repeatDelay: 5 }}
          >
            <AlertTriangle className="w-5 h-5" />
          </motion.div>
        </div>
      </div>

      {/* HEADER - SIN BORDE SUPERIOR, PEGADO AL BANNER */}
      <header className="bg-white text-black border-b border-gray-300">
        <div className="max-w-7xl mx-auto px-8 py-6">
          {/* TOP */}
          <div className="flex items-center justify-between gap-6">
            {/* LOGO - Imagen SVG en lugar de texto */}
            <Link href="" onClick={() => setGlobalSearchQuery("")} className="flex-shrink-0">
              <div className="relative w-32 h-32 md:w-40 md:h-40">
                <Image
                  src="/logo-zorro.svg"
                  alt="Zorro Lúdico"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>

            {/* BUSCADOR DESKTOP - BÚSQUEDA INSTANTÁNEA SIN REDIRECCIÓN */}
            <div className="hidden md:flex flex-1 justify-center">
              <div className="relative w-full max-w-xl">
                <input
                  type="text"
                  placeholder="¿Qué estás buscando?"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full bg-transparent border border-gray-400 rounded-full py-3 pl-6 pr-14 text-sm focus:outline-none focus:border-[#E4572E] transition-colors"
                />

                {/* Línea */}
                <div className="absolute right-12 top-1/2 -translate-y-1/2 h-6 w-px bg-gray-400"></div>

                {/* Icono de búsqueda (solo decorativo) */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Search className="w-5 h-5 text-gray-700" />
                </div>
              </div>
            </div>

            {/* ICONOS */}
            <div className="flex items-center gap-4">
              {/* Mobile search */}
              <div className="md:hidden">
                {searchExpanded ? (
                  <div className="fixed inset-x-0 top-0 bg-white z-50 p-4 flex gap-2 shadow-md">
                    <input
                      type="text"
                      placeholder="¿Qué estás buscando?"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#E4572E]"
                      autoFocus
                    />
                    <button
                      onClick={clearSearch}
                      className="p-2 hover:bg-gray-100 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setSearchExpanded(true)}>
                    <Search className="w-6 h-6 text-black" />
                  </Button>
                )}
              </div>

              {/* CART */}
              <Button variant="ghost" size="icon" className="text-black relative" onClick={toggleCart}>
                <ShoppingCart className="w-6 h-6" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#E4572E] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Button>

              {/* USER - Versión mejorada con más opciones como en el header antiguo */}
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-black">
                      <User className="w-6 h-6" />
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogIn className="w-4 h-4 mr-2" />
                      Cerrar Sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-black">
                      <User className="w-6 h-6" />
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

              {/* MOBILE MENU */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-6 h-6 text-black" />
              </Button>
            </div>
          </div>

          {/* NAV */}
          <nav className="hidden lg:flex flex items-center justify-between mt-6 gap-6 text-sm font-semibold tracking-wide">
            {navItems.map((item) => {
              if (item.hasDropdown) {
                return (
                  <DropdownMenu key={item.name}>
                    <DropdownMenuTrigger asChild>
                      <button className="hover:text-[#E4572E] transition-colors">
                        {item.name}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {headerCategories.map((cat) => (
                        <DropdownMenuItem key={cat.name} asChild>
                          <Link href={cat.href}>{cat.name}</Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              }
              return (
                <Link 
                  key={item.name} 
                  href={item.href} 
                  className="hover:text-[#E4572E] transition-colors"
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      {/* MOBILE MENU */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80">
          <SheetTitle>Menú</SheetTitle>
          <div className="mt-6 flex flex-col gap-4">
            {/* PRODUCTOS con submenú */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setMobileProductsOpen(!mobileProductsOpen)}
                className="text-left hover:text-[#E4572E] transition-colors font-semibold flex justify-between items-center"
              >
                PRODUCTOS
                <span className="text-xs transition-transform" style={{
                  transform: mobileProductsOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                  ▼
                </span>
              </button>
              
              {mobileProductsOpen && (
                <div className="ml-4 flex flex-col gap-2">
                  {headerCategories.map((cat) => (
                    <Link
                      key={cat.name}
                      href={cat.href}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileProductsOpen(false);
                      }}
                      className="text-sm text-gray-600 hover:text-[#E4572E] transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* NOTICIAS */}
            <Link 
              href="/noticias" 
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E4572E] transition-colors"
            >
              NOTICIAS
            </Link>

            {/* QUIÉNES SOMOS */}
            <Link 
              href="/quienes-somos" 
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E4572E] transition-colors"
            >
              QUIÉNES SOMOS
            </Link>

            {/* CONTACTO */}
            <Link 
              href="/contacto" 
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E4572E] transition-colors"
            >
              CONTACTO
            </Link>
          </div>
        </SheetContent>
      </Sheet>
      <CartDrawer />
    </div>
  )
}