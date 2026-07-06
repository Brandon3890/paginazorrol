"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, ShoppingCart, User, LogIn, UserPlus, Package, Settings, Menu, X, AlertTriangle, Shield, Crown, CheckCircle } from "lucide-react"
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
import { motion, AnimatePresence } from "framer-motion"
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
  const { categories, fetchCategories, categoriesLoaded } = useCategoryStore()
  const { globalSearchQuery, setGlobalSearchQuery } = useProductStore()

  useEffect(() => {
    setIsMounted(true)
    
    const loadCategories = async () => {
      try {
        if (!categoriesLoaded) {
          await fetchCategories(true)
        }
      } catch (error) {
        console.error('Error loading categories in header:', error)
      }
    }
    
    loadCategories()
    
    const handleCategoriesUpdate = () => {
      console.log('🔄 Header: Categorías actualizadas, recargando...')
      fetchCategories(true)
    }
    
    window.addEventListener('categories-updated', handleCategoriesUpdate)
    
    return () => {
      window.removeEventListener('categories-updated', handleCategoriesUpdate)
    }
  }, [fetchCategories, categoriesLoaded])

  const totalItems = isMounted ? getTotalItems() : 0

  const [mobileProductsOpen, setMobileProductsOpen] = useState(false)

  const navItems = [
    { name: "PRODUCTOS", href: "/productos", hasDropdown: true },
    { name: "QUIÉNES SOMOS", href: "/quienes-somos", hasDropdown: false },
    { name: "CONTACTO", href: "/contacto", hasDropdown: false },
  ]

  // ✅ SOLO categorías ACTIVAS (is_active === true)
  const headerCategories = categories
    .filter(category => category.is_active === true)
    .map(category => ({
      name: category.name,
      href: `/filtro/${category.slug}`,
    }))

  const defaultHeaderCategories = [
    { name: "Juegos de Mesa", href: "/filtro/juegos-mesa" },
    { name: "TCG", href: "/filtro/tcg" },
    { name: "Puzzles", href: "/filtro/puzzles" },
    { name: "Rol", href: "/filtro/rol" }
  ]

  const displayHeaderCategories = isMounted && headerCategories.length > 0 
    ? headerCategories 
    : defaultHeaderCategories

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setGlobalSearchQuery(value)
  }

  const clearSearch = () => {
    setSearchQuery("")
    setGlobalSearchQuery("")
    setSearchExpanded(false)
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const getUserInitials = () => {
    if (!user) return "U"
    const firstName = user.firstName || ""
    const lastName = user.lastName || ""
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }
    return firstName ? firstName.charAt(0).toUpperCase() : "U"
  }

  return (
    <div className="sticky top-0 z-50">
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

      <header className="bg-white text-black border-b border-gray-300">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between gap-6">
            <Link
              href="/"
              onClick={() => setGlobalSearchQuery("")}
              className="flex-shrink-0"
            >
              <div className="relative w-28 h-28 md:w-32 md:h-32">
                <Image
                  src="/logo-zorro.svg"
                  alt="Zorro Lúdico"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </Link>

            <div className="hidden md:flex flex-1 justify-center">
              <div className="relative w-full max-w-xl">
                <input
                  type="text"
                  placeholder="¿Qué estás buscando?"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full bg-transparent border border-gray-400 rounded-full py-3 pl-6 pr-14 text-sm focus:outline-none focus:border-[#E4572E] transition-colors"
                />
                <div className="absolute right-12 top-1/2 -translate-y-1/2 h-6 w-px bg-gray-400"></div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <Search className="w-5 h-5 text-gray-700" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
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

              <Button variant="ghost" size="icon" className="text-black relative" onClick={toggleCart}>
                <ShoppingCart className="w-6 h-6" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#E4572E] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Button>

              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="relative group"
                    >
                      <div className="absolute -top-1 -right-1">
                        <div className="relative">
                          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                          <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E4572E] to-[#FF6B4A] flex items-center justify-center text-white text-sm font-bold">
                        {getUserInitials()}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <div className="px-3 py-2 bg-gradient-to-r from-[#E4572E]/10 to-transparent">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E4572E] to-[#FF6B4A] flex items-center justify-center text-white text-md font-bold">
                          {getUserInitials()}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">
                            {user?.firstName} {user?.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {user?.email}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/profile" className="flex items-center">
                        <User className="w-4 h-4 mr-3 text-[#121212]" />
                        <span>Mi Perfil</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/orders" className="flex items-center">
                        <Package className="w-4 h-4 mr-3 text-[#2563EB]" />
                        <span>Mis Pedidos</span>
                      </Link>
                    </DropdownMenuItem>
                    
                    {user?.role === 'admin' && (
                      <>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href="/admin" className="flex items-center">
                            <Shield className="w-4 h-4 mr-3 text-purple-600" />
                            <span className="flex items-center gap-1">
                              Administración
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <LogIn className="w-4 h-4 mr-3" />
                      <span>Cerrar Sesión</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="text-black hover:bg-[#E4572E] hover:text-white transition-colors"
                    >
                      <User className="w-6 h-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                      ¿Ya tienes cuenta?
                    </div>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/login" className="flex items-center text-[#E4572E] font-medium">
                        <LogIn className="w-4 h-4 mr-2" />
                        Iniciar Sesión
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/register" className="flex items-center">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Crear Cuenta
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

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
                      {displayHeaderCategories.map((cat) => (
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

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80">
          <SheetTitle>Menú</SheetTitle>
          
          {isAuthenticated && (
            <div className="mt-4 p-3 bg-gradient-to-r from-[#E4572E]/10 to-transparent rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E4572E] to-[#FF6B4A] flex items-center justify-center text-white text-md font-bold">
                  {getUserInitials()}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-4 flex flex-col gap-4">
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
                  {displayHeaderCategories.map((cat) => (
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
            
            <Link 
              href="/quienes-somos" 
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E4572E] transition-colors"
            >
              QUIÉNES SOMOS
            </Link>

            <Link 
              href="/contacto" 
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#E4572E] transition-colors"
            >
              CONTACTO
            </Link>

            {isAuthenticated && (
              <>
                <div className="border-t border-gray-200 my-2"></div>
                <Link 
                  href="/profile" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-gray-700 hover:text-[#E4572E] transition-colors"
                >
                  <User className="w-4 h-4" />
                  Mi Perfil
                </Link>
                <Link 
                  href="/orders" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 text-gray-700 hover:text-[#E4572E] transition-colors"
                >
                  <Package className="w-4 h-4" />
                  Mis Pedidos
                </Link>
                {user?.role === 'admin' && (
                  <Link 
                    href="/admin" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-purple-600 hover:text-purple-700 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Administración
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors text-left"
                >
                  <LogIn className="w-4 h-4" />
                  Cerrar Sesión
                </button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <CartDrawer />
    </div>
  )
}