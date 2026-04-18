// components/back-to-top.tsx - Versión simple
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronUp } from "lucide-react"

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", toggleVisibility)
    return () => window.removeEventListener("scroll", toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    })
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ duration: 0.3 }}
          onClick={scrollToTop}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="fixed bottom-6 right-6 z-50"
          aria-label="Volver arriba"
        >
          <motion.div
            className="w-12 h-12 rounded-full bg-[#1d1b1a] flex items-center justify-center text-white shadow-lg"
            animate={{
              scale: isHovered ? 1.1 : 1,
              backgroundColor: isHovered ? "#1d1b1a" : "#302d2b"
            }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              animate={isHovered ? { y: -3 } : { y: 0 }}
              transition={{ duration: 0.2, repeat: isHovered ? Infinity : 0, repeatType: "reverse" }}
            >
              <ChevronUp className="w-6 h-6" />
            </motion.div>
          </motion.div>
        </motion.button>
      )}
    </AnimatePresence>
  )
}