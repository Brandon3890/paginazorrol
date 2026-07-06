"use client"

import Image from "next/image"
import { FaInstagram, FaYoutube, FaFacebook } from "react-icons/fa"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useCategoryStore } from "@/lib/category-store"

export function Footer() {
  const { categories, fetchCategories, categoriesLoaded } = useCategoryStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    
    const loadCategories = async () => {
      try {
        await fetchCategories(true)
      } catch (error) {
        console.error('Error loading categories in footer:', error)
      }
    }
    
    if (!categoriesLoaded) {
      loadCategories()
    }
    
    const handleCategoriesUpdate = () => {
      console.log('🔄 Footer: Categorías actualizadas, recargando...')
      fetchCategories(true)
    }
    
    window.addEventListener('categories-updated', handleCategoriesUpdate)
    
    const handleProductUpdate = () => {
      fetchCategories(true)
    }
    
    window.addEventListener('product-updated', handleProductUpdate)
    
    return () => {
      window.removeEventListener('categories-updated', handleCategoriesUpdate)
      window.removeEventListener('product-updated', handleProductUpdate)
    }
  }, [fetchCategories, categoriesLoaded])

  // Obtener SOLO las primeras 4 categorías ACTIVAS
  const activeCategories = categories
    .filter(category => category.is_active === true || category.is_active === 1 || category.is_active !== 0)
    .slice(0, 4)
    .map(category => ({
      name: category.name,
      slug: category.slug,
    }))

  const defaultCategories = [
    { name: "Juegos de Mesa", slug: "juegos-mesa" },
    { name: "TCG", slug: "tcg" },
    { name: "Puzzles", slug: "puzzles" },
    { name: "Rol", slug: "rol" }
  ]

  const displayCategories = isMounted && activeCategories.length > 0 
    ? activeCategories 
    : defaultCategories

  return (
    <footer className="bg-black text-white mt-20">
      <div className="max-w-7xl mx-auto px-6 py-16">

        <div className="text-center mb-10">
          <Link href="/"> 
            <h2
              className="text-3xl tracking-widest cursor-pointer hover:text-orange-400 transition-colors"
              style={{ fontFamily: "Modern Antiqua, serif" }}
            >
              ZORRO <br /> LÚDICO
            </h2>
          </Link>
        </div>

        <div className="border-t border-gray-700 mb-10"></div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          <div>
            <h3 className="font-semibold mb-3 text-lg">Productos</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              {displayCategories.map((category) => (
                <li key={category.slug}>
                  <Link 
                    href={`/filtro/${category.slug}`}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-lg">Información</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li>
                <Link 
                  href="/preguntas-frecuentes"
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Preguntas frecuentes
                </Link>
              </li>
              <li>
                <Link 
                  href="/terminos-y-condiciones"
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Términos y condiciones
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-lg">Contáctanos</h3>
            <p className="text-gray-300 text-sm">+56 9 5877 3629</p>
            <p className="text-gray-300 text-sm mb-4">
              jinfranko@zorroludico.cl
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-lg">Métodos de Pago</h3>
            <div className="bg-white p-2 inline-block rounded">
              <Image
                src="/logo-web-pay-plus.png"  
                alt="Webpay"
                width={180}
                height={80}
                className="object-contain"
              />
            </div>
            <h3 className="font-semibold mb-3 text-lg mt-4">Síguenos</h3>
            <div className="flex gap-5">
              <a
                href="https://www.instagram.com/zorroludico/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <FaInstagram className="text-2xl" />
              </a>
              <a
                href="https://www.youtube.com/@ZorroL%C3%BAdico"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="YouTube"
              >
                <FaYoutube className="text-2xl" />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61589561386914"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <FaFacebook className="text-2xl" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}