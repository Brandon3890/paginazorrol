"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowLeft, FileText, Shield, Truck, RefreshCw, MessageCircle, Scale, AlertCircle, BookOpen, Mail, Globe, Users, ShoppingBag, DollarSign } from "lucide-react"

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
        </motion.div>

        {/* Contenido principal - TEXTO ÍNTEGRO SIN RESUMIR */}
        <div className="space-y-8">
          
          {/* TÉRMINOS Y CONDICIONES DE USO - Zorro Lúdico SpA */}
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
              Los presentes términos de uso, aplicables a todo cliente¹ (en adelante “usted”, “el cliente”), se comprenden como un acuerdo que vincula legalmente a su persona o los derechos que represente, con Zorro Lúdico SpA (en adelante, “La empresa”, “Nosotros”, “Zorro Lúdico”) para el uso e interacción con el sitio web bajo el dominio zorroludico.cl y todos sus subsitios, comprendiendo además formularios, canales de comunicación, aplicaciones de dispositivos móviles o cualquier medio digital que convenga al presente acuerdo. POR LO TANTO, el cliente acepta haber leído, comprendido y aceptado en su plenitud indiscutible el presente acuerdo antes de efectuar cualquier acción dentro de la definición de “cliente” establecida en la presente, comunicando y confirmando indisputablemente que el cliente acepta haber leído, comprendido y aceptado en su plenitud el presente acuerdo. Cualquier controversia será sometida a los tribunales competentes conforme a la legislación chilena vigente.
            </p>
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border-l-4 border-amber-500">
              <p className="text-sm text-gray-700 font-poppins">
                <span className="font-bold"></span>Entiéndase por cliente a cualquier persona que visite, realice una compra, establezca comunicación mediante cualquier canal remoto o presencial con representantes, accionistas, funcionarios o cualquier afiliado a la empresa; o quien establezca cualquier tipo de interacción con la página web zorroludico.cl
              </p>
            </div>
          </motion.section>

          {/* Jurisdicción y Domicilio */}
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
              Se deja expresa constancia que las partes establecen su domicilio en la ciudad de Santiago de Chile, aplicando su jurisdicción y jurisprudencia ante potenciales litigios entre los suscriptores del presente contrato.
            </p>
          </motion.section>

          {/* Modificaciones y Vigencia */}
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
              Los términos y condiciones establecidos en la presente están sujetos a cambio, cada versión estará acompañada al final de ésta de su fecha de publicación en la página web de la empresa indicada con anterioridad, comprendiéndose como la versión válida la que corresponda a la ventana de tiempo en la que ocurra cualquier incidencia bajo la cual sea procedente citar los términos y condiciones a beneficio del cliente, quien puede solicitar, mediante los canales de contacto de la empresa, de manera completamente transparente y gratuita, cualquier acuerdo de términos de uso pasado, citando la fecha exacta del hecho que amerite la inspección del acuerdo vigente a la fecha de su ejecución, la cual debe ser demostrada sin cabida a dudas razonables, mediante por ejemplo, una boleta electrónica relevante al incidente emitida por la empresa o correos electrónicos con fecha legible. La falsificación, adulteración o cualquier manipulación en la fecha de emisión de documentos o recepción de comunicaciones está contemplada bajo los artículos 197, inciso 2°; y artículo 198 del código penal. Por lo tanto, dadas las facultades establecidas previamente, el cliente renuncia a cualquier derecho a ser notificado de actualizaciones de los términos y condiciones, renunciando así también a reclamar ignorancia de los términos y condiciones que rigen, entendiéndose que su uso del sitio posterior a la publicación de la versión más reciente, conforme a lo establecido en la definición de cliente, como toma de conocimiento del uso de la página.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed">
              La empresa se reserva el derecho a modificar estos términos en el futuro. Las modificaciones serán aplicables a todas las transacciones realizadas con posterioridad a su publicación en el sitio web, a discreción de quien sus derechos representen o esté facultado para ello mediante cualquier carta poder, mandato, contrato de trabajo, prestación de servicios, en general, cualquier documento que vincule a la persona con Zorro Lúdico SpA.
            </p>
          </motion.section>

          {/* Uso internacional */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-semibold font-poppins text-gray-900 mb-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-orange-600" />
              Uso fuera de Chile
            </h2>
            <p className="text-gray-700 font-poppins leading-relaxed">
              La información, imágenes, vídeos, contenido en general dentro del sitio web individualizado anteriormente y los productos ofrecidos dentro de ésta, no tienen como objeto su uso y/o difusión de cualquier tipo o escala, tanto por personas naturales y jurídicas (Tanto de derecho público como privado) dentro de jurisdicciones que restrinjan o requieran de licencias, registros, inspecciones, regulaciones, o cualquier tramitación que involucraría gestiones extraoficiales a responsabilidad y/o costas de la empresa y/o a quien sus derechos representen. Quienes accedan al sitio y efectúen una compra fuera de la República de Chile lo hacen bajo su propia iniciativa y son sujetos a la exclusiva responsabilidad cualquier consecuencia y/o costa producto de cualquier interacción especificada dentro de la definición de cliente con cualquier servicio administrado por la empresa y no son imputables a Zorro Lúdico SpA ni de sus representantes, accionistas, funcionarios o cualquier afiliado a la empresa.
            </p>
          </motion.section>

          {/* Edad mínima */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-semibold font-poppins text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              Edad mínima
            </h2>
            <p className="text-gray-700 font-poppins leading-relaxed">
              Los servicios ofrecidos por la empresa comprenden que el cliente tiene o es mayor de dieciocho (18) años de edad. Quienes no cumplan con este requisito, pueden interactuar con el sitio sólo si cuentan con autorización de su tutor legal. El uso de datos falsos para la creación del perfil cae en expresa responsabilidad de quien los proporciona. Zorro Lúdico, en sus principios de resguardar el venerable derecho a la vida privada, no valida las edades de sus clientes, renunciando a responder en caso del uso del sitio con fines inapropiados para un menor de dieciocho años de edad (Como, por ejemplo, pero no limitándose, a la compra de un producto con restricción de edad)
            </p>
          </motion.section>

          {/* Propiedad Intelectual */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-semibold font-poppins text-gray-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-orange-600" />
              Propiedad Intelectual
            </h2>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              El sitio web, su código fuente, datos, funcionalidades específicas, diseños y cualquier medio digital o físico relacionado a Zorro Lúdico es de su exclusiva propiedad o han sido apropiadamente licenciados para su uso en el contexto que han sido presentados (A menos que se especifique lo contrario). Las gráficas, el nombre, logotipos, fuentes, o cualquier información escrita o multimedia asociada a Zorro Lúdico SpA están protegidas por derechos de autor y su reproducción no autorizada, tenga fines maliciosos o no, serán investigadas y denunciadas ante las autoridades competentes.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              Quienes se entiendan como clientes, se les permite el uso exclusivamente no comercial para el uso y acceso al sitio, su descarga, reproducción en imágenes tanto digitales como impresas, grabaciones de pantallas o cualquier otro medio con el objeto de replicar su contenido de manera expedita y compresa.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed">
              Se prohíbe estrictamente la reproducción, publicación, entrega o intercambio de licencia de cualquier medio de la empresa con propósitos comerciales sin permiso previo otorgado por un mandatario debidamente facultado para ello de la empresa.
            </p>
          </motion.section>

          {/* Responsabilidad Legal */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-red-50 rounded-xl p-6 border border-red-200"
          >
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-semibold font-poppins text-gray-900">SOBRE LA RESPONSABILIDAD LEGAL</h2>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              La empresa rechaza activamente toda garantía expresa o implícita sobre el contenido del sitio individualizado previamente o cualquier medio relevante a la actividad de Zorro Lúdico. No se ofrece ningún tipo de garantía ni se jura o declara la exactitud o veracidad sobre el contenido expuesto en el sitio, utilizando como ejemplo, pero no limitándose a cualquier inexactitud, lesiones físicas o a la propiedad fruto de cualquier interacción con la empresa, el uso no autorizado o malicioso de nuestros sistemas, el esparcimiento de un programa maligno o cualquier otra infección al sistema del usuario bajo responsabilidad de terceros no afiliados a la empresa, entre otros.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              La empresa sólo se limita a la distribución de los productos, y no se hace responsable por el contenido de éstos, siendo esto responsabilidad exclusiva de la casa productora de los bienes ofrecidos en el sitio web. En ningún caso nosotros o nuestros directores, empleados o agentes seremos responsables ante usted o cualquier tercero por cualquier daño directo, indirecto, consecuente, ejemplar, incidental, especial o punitivo, incluyendo pérdida de beneficios, pérdida de ingresos, pérdida de datos, u otros daños que surjan de su uso del sitio, incluso si hemos sido advertidos de la posibilidad de dichos daños. El cliente acepta indemnizar a la empresa y/o a quien sus derechos representen ante cualquier causal de daños, pérdidas, litigios o cualquier desmedro a la integridad económica o estructural de la empresa a causa de acciones de cualquier índole.
            </p>
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
              <h2 className="text-xl font-semibold font-poppins text-gray-900">SOBRE COMUNICACIONES</h2>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed">
              El cliente acepta recibir comunicaciones electrónicas de Zorro Lúdico SpA, sean estas confirmaciones de compra, avisos varios, difusiones o comunicados de todo tipo, pudiendo optar a no recibir divulgaciones de relevancia menor mediante un comunicado expreso mediante los canales de comunicación de la empresa.
            </p>
          </motion.section>

          {/* Compras */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <ShoppingBag className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold font-poppins text-gray-900">SOBRE LAS COMPRAS</h2>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              Una vez aprobado el pago de una compra, la empresa cuenta con un tiempo límite de tres días hábiles por cada unidad de cada producto comprado para preparar los productos solicitados. Los envíos serán diligenciados por la empresa CHILEXPRESS S.A., la empresa no se responsabiliza por potenciales atrasos en la entrega de los productos, ya que estos corren bajo la exclusiva responsabilidad de la empresa de correos. El cliente puede solicitar que el envío sea efectuado por cualquier otra empresa del giro de transporte, logística y/o comunicaciones que se haya seleccionado en la sección titulada “Personalizado”. La empresa se reserva el derecho a rechazar el utilizar los servicios de la empresa solicitada si ésta no es factible para el envío de los productos (Como, por ejemplo, pero no limitándose a, una empresa del giro de las telecomunicaciones, restaurantes, abastecimiento, etc.…). Toda queja referente a sujetos relacionados a tiempos de entrega han de ser dirigido a los canales de comunicación y reclamaciones de la empresa de correos.
            </p>
          </motion.section>

          {/* Reembolsos */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.45 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold font-poppins text-gray-900">SOBRE LOS REEMBOLSOS</h2>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg mb-4 border border-orange-200">
              <p className="text-gray-800 font-poppins font-semibold">
                ⚠️ Importante: Exclusión expresa del Derecho de Retracto
              </p>
              <p className="text-gray-700 font-poppins text-sm mt-1">
                En conformidad a lo dispuesto en el artículo 3 bis letra b) de la Ley N° 19.496, Zorro Lúdico SpA dispone la exclusión expresa del Derecho de Retracto para todas las compras realizadas a través de su sitio web. Por tanto, el cliente no podrá rescindir unilateralmente el contrato por mera expectativa o insatisfacción, sin perjuicio del pleno ejercicio de su Garantía Legal de seis meses en caso de fallas de fabricación.
              </p>
            </div>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              La empresa cumplirá sin disputar solicitudes de reembolso conforme a lo estipulado por el Servicio Nacional del Consumidor, en esencia, el cliente cuenta con seis meses a contar de la entrega del producto para solicitar una devolución del dinero, cambio o reparación del producto, siempre y cuando sea demostrable la existencia de fallas de fábrica en la mercancía.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed mb-3">
              Una vez abierto el producto, se pierde la posibilidad de cambio, salvo por las causales expuestas por ley.
            </p>
            <p className="text-gray-700 font-poppins leading-relaxed">
              <span className="font-semibold">El cliente cuenta con el derecho de solicitar, como método de reembolso, entre las siguientes opciones:</span>
            </p>
            <ul className="list-disc list-inside text-gray-700 font-poppins mt-2 space-y-1 ml-2">
              <li>1.- Transferencia bancaria</li>
              <li>2.- Crédito de tienda (Mediante cupón de descuento de un solo uso por el valor del producto reembolsado)</li>
            </ul>
            <p className="text-gray-700 font-poppins leading-relaxed mt-3">
              La empresa se reserva el derecho a descontar cualquier comisión bancaria o costo de operación relacionado con la devolución salvo las causales de reembolso protegidas por ley.
            </p>
          </motion.section>

          {/* Sobre Nosotros */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="bg-gray-50 rounded-xl p-6 border border-gray-200"
          >
            <h2 className="text-xl font-semibold font-poppins text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              SOBRE NOSOTROS
            </h2>
            <div className="space-y-3 text-gray-700 font-poppins leading-relaxed">
              <p>1.- La empresa no se hace responsable de lesiones, menoscabo o cualquier incidente relacionado al mal, imprudente, temerario o malicioso uso de los productos ofrecidos. Zorro Lúdico SpA responderá únicamente por daños directos que sean exclusiva y directamente imputables a una negligencia grave de nuestra parte, excluyendo daños indirectos, lucro cesante o perjuicios causados por actos de terceros o empresas de transporte.</p>
              <p>2.- La renuncia, cesión u omisión a aplicar cualquier medida o facultad establecida en el presente acuerdo no transmuta en su renuncia de aplicación futura.</p>
              <p>3.- Cualquier cita extraíble del presente acuerdo que pueda violar o contradecir lo establecido por las leyes de la República de Chile se entenderá como sin efecto de ser declarada como tal por un ministro de fe, sin afectar la validez y aplicabilidad de la información legalmente procedente que pueda acompañar a dicha cita o el resto del texto.</p>
              <p>4.- El cliente declara que estima innecesaria la firma física o manuscrita del presente contrato, no pudiendo alegar la ausencia de esta como base para desestimar el acuerdo.</p>
              <p>5.- El cliente reconoce y acepta que toda reclamación suscrita a los medios de contacto de la empresa está sujetas a un tiempo límite de respuesta de veinte (20) días hábiles.</p>
            </div>
          </motion.section>

          {/* Fecha */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.55 }}
            className="text-center"
          >
          </motion.div>

        </div>
      </main>

      <Footer />
    </div>
  )
}