"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useCouponStore } from "@/lib/coupon-store"
import { useProductStore } from "@/lib/product-store"
import { useEffect, useState } from "react"

interface Coupon {
  id: number
  code: string
  discountPercentage: number
  type: string
  targetId?: string
}

export function Banner() { // Asegúrate de que tenga 'export'
  const [highestCoupon, setHighestCoupon] = useState<Coupon | null>(null)
  const [displayText, setDisplayText] = useState("Proximamente nuevas ofertas ")
  const [couponCode, setCouponCode] = useState("")
  
  const products = useProductStore((state) => state.products)
  const coupons = useCouponStore((state) => state.coupons)
  const getHighestDiscountCoupon = useCouponStore((state) => state.getHighestDiscountCoupon)

  useEffect(() => {
    try {
      let coupon: Coupon | null = null
      
      if (typeof getHighestDiscountCoupon === 'function') {
        coupon = getHighestDiscountCoupon()
      } else if (coupons && coupons.length > 0) {
        coupon = coupons.reduce((max, current) => 
          current.discountPercentage > max.discountPercentage ? current : max
        )
      }

      setHighestCoupon(coupon)

      if (coupon) {
        let text = "Descuentos especiales disponibles"
        
        if (coupon.type === "product" && coupon.targetId) {
          const product = products.find((p) => p.id.toString() === coupon!.targetId)
          if (product) {
            text = `${product.name} - ${coupon.discountPercentage}% OFF`
          }
        } else if (coupon.type === "category" && coupon.targetId) {
          text = `${coupon.targetId} - ${coupon.discountPercentage}% OFF`
        } else {
          text = `Todos los productos - ${coupon.discountPercentage}% OFF`
        }
        
        setDisplayText(text)
        setCouponCode(coupon.code)
      } else {
        setDisplayText("Proximamente nuevas ofertas ")
        setCouponCode("")
      }
    } catch (error) {
      console.error('Error al cargar el banner:', error)
      setDisplayText("Proximamente nuevas ofertas ")
      setCouponCode("")
    }
  }, [coupons, products, getHighestDiscountCoupon])

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
              ¡Ofertas!
            </Badge>
            <h2 className="text-2xl font-bold">{displayText}</h2>
            <p className="text-orange-100">
              {couponCode ? `Usa el código: ${couponCode}` : "Solo por tiempo limitado. ¡No te lo pierdas!"}
            </p>
          </div>
          <Link href="/ofertas">
            <Button variant="secondary" size="lg" className="bg-white text-orange-600 hover:bg-orange-50">
              Ver Oferta
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}