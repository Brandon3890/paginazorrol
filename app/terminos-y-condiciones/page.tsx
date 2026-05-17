"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowLeft, FileText, Shield, Truck, RefreshCw, MessageCircle, Scale, AlertCircle, BookOpen, Mail, Phone } from "lucide-react"

export default function TerminosYCondicionesPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Botón volver */}
        <div className="mb-6">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="mb-4 text-gray-600 hover:text-white hover:bg-orange-600 font-poppins transition-all duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al inicio
            </Button>
          </Link>
        </div>
        
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-semibold font-poppins text-gray-900 mb-4">
            Términos y Condiciones
          </h1>
          <div className="w-20 h-1 bg-orange-600 mx-auto rounded-full mb-4" />
          <p className="text-lg font-normal font-poppins text-gray-600 max-w-2xl mx-auto">
            Lee atentamente los siguientes términos que regulan el uso de nuestro sitio web y la relación comercial con Zorro Lúdico SpA.
          </p>
          <p className="text-sm text-gray-500 mt-3 font-poppins">
            Versión vigente: Santiago, 18 de marzo de 2026
          </p>
        </motion.div>

        {/* Contenido principal */}
        <div className="space-y-8">
          
          {/* Introducción */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gray-50 rounded-xl p-6 border border-gray-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold font-poppins text-gray-900">TÉRMINOS Y CONDICIONES DE USO</h2>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              <span className="font-semibold">Zorro Lúdico SpA</span>
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed">
              Los presentes términos de uso, aplicables a todo cliente¹ (en adelante “usted”, “el cliente”), se comprenden como un acuerdo 
              que vincula legalmente a su persona o los derechos que represente, con <span className="font-semibold">Zorro Lúdico SpA</span> 
              (en adelante, “La empresa”, “Nosotros”, “Zorro Lúdico”) para el uso e interacción con el sitio web bajo el dominio 
              <span className="font-medium text-orange-700"> zorroludico.cl</span> y todos sus subsitios, comprendiendo además formularios, 
              canales de comunicación, aplicaciones de dispositivos móviles o cualquier medio digital que convenga al presente acuerdo.
            </p>
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
              <p className="text-sm text-gray-700 font-poppins">
                 Entiéndase por cliente a cualquier persona que visite, 
                realice una compra, establezca comunicación mediante cualquier canal remoto o presencial con representantes, accionistas, 
                funcionarios o cualquier afiliado a la empresa; o quien establezca cualquier tipo de interacción con la página web zorroludico.cl.
              </p>
            </div>
          </motion.section>

          {/* Jurisdicción */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-semibold font-poppins text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Jurisdicción y Domicilio
            </h2>
            <p className="text-gray-700 font-poppins leading-relaxed">
              Se deja expresa constancia que las partes establecen su domicilio en la ciudad de Santiago de Chile, 
              aplicando su jurisdicción y jurisprudencia ante potenciales litigios entre los suscriptores del presente contrato. 
              Cualquier controversia será sometida a los tribunales competentes conforme a la legislación chilena vigente.
            </p>
          </motion.section>

          {/* Modificaciones */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-semibold font-poppins text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Modificaciones y Vigencia
            </h2>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              Los términos y condiciones establecidos en la presente están sujetos a cambio. Cada versión estará acompañada de su 
              fecha de publicación en la página web. La empresa se reserva el derecho a modificar estos términos en el futuro. 
              Las modificaciones serán aplicables a todas las transacciones realizadas con posterioridad a su publicación.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed">
              El cliente puede solicitar, mediante los canales de contacto de la empresa, de manera completamente transparente y gratuita, 
              cualquier acuerdo de términos de uso pasado, citando la fecha exacta del hecho que amerite la inspección del acuerdo vigente 
              a la fecha de su ejecución.
            </p>
          </motion.section>

          {/* Propiedad Intelectual */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-semibold font-poppins text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-600" />
              Propiedad Intelectual
            </h2>
            <p className="text-gray-700 font-poppins leading-relaxed">
              El sitio web, su código fuente, datos, funcionalidades específicas, diseños y cualquier medio digital o físico relacionado 
              a Zorro Lúdico es de su exclusiva propiedad o han sido apropiadamente licenciados. Las gráficas, el nombre, logotipos, 
              fuentes, o cualquier información escrita o multimedia asociada a Zorro Lúdico SpA están protegidas por derechos de autor 
              y su reproducción no autorizada será investigada y denunciada ante las autoridades competentes.
            </p>
          </motion.section>

          {/* Responsabilidad Legal */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-red-50 rounded-xl p-6 border border-red-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-semibold font-poppins text-gray-900">Responsabilidad Legal</h2>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              La empresa rechaza activamente toda garantía expresa o implícita sobre el contenido del sitio. No se ofrece ningún tipo 
              de garantía ni se declara la exactitud o veracidad sobre el contenido expuesto.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              La empresa sólo se limita a la distribución de los productos, y no se hace responsable por el contenido de éstos, siendo 
              esto responsabilidad exclusiva de la casa productora de los bienes ofrecidos.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed font-medium">
              En ningún caso nosotros o nuestros directores, empleados o agentes seremos responsables ante usted o cualquier tercero 
              por cualquier daño directo, indirecto, consecuente, ejemplar, incidental, especial o punitivo, incluyendo pérdida de 
              beneficios, pérdida de ingresos, pérdida de datos, u otros daños que surjan de su uso del sitio.
            </p>
          </motion.section>

          {/* Compras y Envíos */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <Truck className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold font-poppins text-gray-900">Compras y Envíos</h2>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              Una vez aprobado el pago de una compra, la empresa cuenta con un tiempo límite de <span className="font-semibold">tres días hábiles</span> 
              por cada unidad de cada producto comprado para preparar los productos solicitados.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              Los envíos estándar serán diligenciados por la empresa <span className="font-semibold">CHILEXPRESS S.A.</span>, la empresa no se responsabiliza 
              por potenciales atrasos en la entrega de los productos, ya que estos corren bajo la exclusiva responsabilidad de la empresa de correos.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed">
              El cliente puede solicitar que el envío sea efectuado por cualquier otra empresa del giro de transporte, logística y/o comunicaciones 
              que se haya seleccionado en la sección titulada <span className="italic">“Personalizado”</span>.
            </p>
          </motion.section>

          {/* Reembolsos y Garantía */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold font-poppins text-gray-900">Reembolsos y Garantía Legal</h2>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg mb-4 border border-orange-200">
              <p className="text-gray-800 font-poppins font-semibold">
                ⚠️ Importante: Exclusión expresa del Derecho de Retracto
              </p>
              <p className="text-gray-700 font-poppins text-sm mt-1">
                En conformidad a lo dispuesto en el artículo 3 bis letra b) de la Ley N° 19.496, Zorro Lúdico SpA dispone la exclusión expresa 
                del Derecho de Retracto para todas las compras realizadas a través de su sitio web. Por tanto, el cliente no podrá rescindir 
                unilateralmente el contrato por mera expectativa o insatisfacción.
              </p>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              La empresa cumplirá sin disputar solicitudes de reembolso conforme a lo estipulado por el Servicio Nacional del Consumidor. 
              El cliente cuenta con <span className="font-semibold">seis meses a contar de la entrega del producto</span> para solicitar una devolución 
              del dinero, cambio o reparación del producto, siempre y cuando sea demostrable la existencia de fallas de fábrica en la mercancía.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              Una vez abierto el producto, se pierde la posibilidad de cambio, salvo por las causales expuestas por ley.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed">
              <span className="font-semibold">Métodos de reembolso disponibles:</span>
            </p>
            <ul className="list-disc list-inside text-gray-700 font-poppins mt-2 space-y-1 ml-2">
              <li>Transferencia bancaria</li>
              <li>Crédito de tienda (mediante cupón de descuento de un solo uso por el valor del producto reembolsado)</li>
            </ul>
          </motion.section>

          {/* Comunicaciones */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.35 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold font-poppins text-gray-900">Comunicaciones</h2>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed">
              El cliente acepta recibir comunicaciones electrónicas de Zorro Lúdico SpA, sean estas confirmaciones de compra, avisos varios, 
              difusiones o comunicados de todo tipo, pudiendo optar a no recibir divulgaciones de relevancia menor mediante un comunicado 
              expreso mediante los canales de comunicación de la empresa.
            </p>
            <div className="mt-4 p-3 bg-gray-100 rounded-lg">
              <p className="text-sm text-gray-700 font-poppins">
                <span className="font-semibold">Tiempo de respuesta a reclamaciones:</span> El cliente reconoce y acepta que toda reclamación 
                suscrita a los medios de contacto de la empresa está sujeta a un tiempo límite de respuesta de veinte (20) días hábiles.
              </p>
            </div>
          </motion.section>

          {/* Notas finales */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-gray-50 rounded-xl p-6 border border-gray-200"
          >
            <h2 className="text-lg font-semibold font-poppins text-gray-900 mb-3">Cláusulas complementarias</h2>
            <ul className="space-y-2 text-gray-700 font-poppins text-sm list-disc list-inside">
              <li>La empresa no se hace responsable de lesiones o incidentes relacionados al mal uso de los productos ofrecidos.</li>
              <li>La renuncia a aplicar cualquier medida establecida en el presente acuerdo no implica su renuncia de aplicación futura.</li>
              <li>Cualquier cita que contradiga las leyes de la República de Chile se entenderá como sin efecto.</li>
              <li>El cliente declara que estima innecesaria la firma física del presente contrato.</li>
              <li>El cliente acepta indemnizar a la empresa ante cualquier desmedro a su integridad económica o estructural.</li>
            </ul>
          </motion.section>
        </div>
      </main>

      <Footer />
    </div>
  )
}