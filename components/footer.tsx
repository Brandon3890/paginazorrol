import Image from "next/image"
import { FaInstagram, FaYoutube, FaFacebook } from "react-icons/fa"
import Link from "next/link"  

export function Footer() {
  return (
    <footer className="bg-black text-white mt-20">
      <div className="max-w-7xl mx-auto px-6 py-16">

        {/* Logo centrado */}
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

        {/* Línea */}
        <div className="border-t border-gray-700 mb-10"></div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">

          {/* Productos */}
          <div>
            <h3 className="font-semibold mb-3 text-lg">Productos</h3>
            <ul className="space-y-2 text-gray-300 text-sm">
              <li className="hover:text-white cursor-pointer">Juegos de Mesa</li>
              <li className="hover:text-white cursor-pointer">Juegos de Rol</li>
              <li className="hover:text-white cursor-pointer">Juegos de Cartas</li>
              <li className="hover:text-white cursor-pointer">Accesorios</li>
            </ul>
          </div>

          {/* Información - ENLACES CLICKEABLES */}
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
              <li className="hover:text-white cursor-pointer">Términos y condiciones</li>
              <li className="hover:text-white cursor-pointer">Condiciones de envío</li>
              <li className="hover:text-white cursor-pointer">Política de privacidad</li>
            </ul>
          </div>

          {/* Contacto + Redes */}
          <div>
            <h3 className="font-semibold mb-3 text-lg">Contáctanos</h3>
            <p className="text-gray-300 text-sm">+56 9 5877 3629</p>
            <p className="text-gray-300 text-sm mb-4">
              contacto@zorroludico.cl
            </p>
          </div>

          {/* Métodos de Pago */}
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
                href="https://www.instagram.com/reel/DWsVY_oDAWD/?utm_source=ig_web_copy_link&igsh=NTc4MTIwNjQ2YQ=="
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <FaInstagram className="text-2xl" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white transition-colors"
                aria-label="YouTube"
              >
                <FaYoutube className="text-2xl" />
              </a>
              <a
                href="https://facebook.com"
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