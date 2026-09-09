"use client"

import { useEffect, useState, useRef } from "react"
import { useAuthStore } from "@/lib/auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  X, 
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Users,
  Store,
  FileText,
  Download,
  Eye,
  AlertCircle,
  RefreshCw,
  Upload,
  Send,
  Edit,
  Printer,
  File,
  AlertTriangle,
  Check
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"

// ============================================================
// MODAL PARA CONFIRMAR ENVÍO DE EMAIL
// ============================================================
const ConfirmEmailModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isLoading 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  isLoading: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">¿Estás seguro?</h3>
            <p className="text-sm text-gray-600 mt-2">
              Se enviará la boleta 
              <strong className="text-amber-700"> generada por la API</strong>, no la que acabas de subir.
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Si deseas enviar la nueva boleta subida, usa el botón de la sección 
              <strong className="text-green-700"> "Subir Boleta"</strong>.
            </p>
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="default"
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                onClick={onConfirm}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar de todas formas
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface OrderItem {
  id: number
  product_name: string
  product_price: number
  quantity: number
  subtotal: number
  image_url?: string
  category?: string
}

interface Order {
  id: number
  order_number: string
  status: string
  payment_status: string
  payment_method: string
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
  notes?: string
  coupon_code?: string
  coupon_info?: any
  created_at: string
  updated_at: string
  items: OrderItem[]
  customer_email: string
  customer_first_name: string
  customer_last_name: string
  customer_phone: string
  customer_rut?: string
  is_guest?: boolean
  shipping_type?: string
  shipping_details?: any
  shipping_address?: {
    street: string
    commune_name: string
    region_name: string
    postal_code: string
    department?: string
    delivery_instructions?: string
    title?: string
  }
  transbank_info?: {
    authorization_code?: string
    payment_type?: string
    payment_type_code?: string
    installments?: number
    card_number?: string
    transaction_date?: string
  }
  boleta_info?: {
    id?: number
    folio: string
    monto_total: number
    fecha_emision: string
    estado_sii: string
    rut_receptor?: string
    razon_social?: string
  }
  boleta_emitida?: number
  boleta_intentos?: number
  boleta_error?: string
  boleta_pdf_path?: string | null
  boleta_pdf_folio?: string | null
  boleta_nueva?: {
    folio: string
    path: string
    fecha_subida: string
  }
}

// Mapeo de tipos de pago de Transbank
const PAYMENT_TYPES: Record<string, { label: string, description: string, icon: string }> = {
  'VD': { label: 'Débito', description: 'Venta Débito', icon: '' },
  'VP': { label: 'Prepago', description: 'Venta Prepago', icon: '' },
  'VN': { label: 'Normal', description: 'Venta Normal (1 cuota)', icon: '' },
  'VC': { label: 'Cuotas', description: 'Venta en Cuotas', icon: '' },
  'SI': { label: '3 Cuotas sin interés', description: '3 cuotas sin interés', icon: '' },
  'S2': { label: '2 Cuotas sin interés', description: '2 cuotas sin interés', icon: '' },
  'NC': { label: 'N Cuotas sin interés', description: 'N cuotas sin interés', icon: '' },
}

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  processing: { label: "Procesando", icon: Package, color: "bg-blue-100 text-blue-800" },
  shipped: { label: "Enviado", icon: Truck, color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Entregado", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelado", icon: X, color: "bg-red-100 text-red-800" },
}

const calculateTaxBreakdown = (amountWithIVA: number) => {
  const neto = Math.round(amountWithIVA / 1.19)
  const iva = amountWithIVA - neto
  return { neto, iva }
}

export default function AdminOrderDetailPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const { toast } = useToast()
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estado para la boleta
  const [consultandoBoleta, setConsultandoBoleta] = useState(false)
  const [boletaEstado, setBoletaEstado] = useState<string | null>(null)
  const [boletaFolio, setBoletaFolio] = useState<string | null>(null)
  const [boletaError, setBoletaError] = useState<string | null>(null)
  
  //  Estados separados para descargas
  const [descargandoPDFAntiguo, setDescargandoPDFAntiguo] = useState(false)
  const [descargandoPDFNuevo, setDescargandoPDFNuevo] = useState(false)
  
  const [reintentandoBoleta, setReintentandoBoleta] = useState(false)
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [enviandoEmailAntiguo, setEnviandoEmailAntiguo] = useState(false)
  
  // Estado para subir PDF
  const [subiendoPDF, setSubiendoPDF] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado para el modal de confirmación
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const formatPrice = (price: number) => {
    if (isNaN(price) || price === undefined || price === null) return '$0'
    return '$' + price.toLocaleString('es-CL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
  }

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.push("/login")
      return
    }

    if (user?.role !== 'admin') {
      router.push("/orders")
      return
    }

    fetchOrder()
  }, [isAuthenticated, authLoading, router, user, orderId])

  const fetchOrder = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/admin/orders/${orderId}`)
      
      if (response.ok) {
        const orderData = await response.json()
        console.log(' Order data received:', orderData)
        setOrder(orderData)
        
        if (orderData.boleta_emitida === 1 && orderData.boleta_info?.folio) {
          setBoletaFolio(orderData.boleta_info.folio)
          setBoletaEstado(orderData.boleta_info.estado_sii || 'emitida')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Error al cargar los detalles del pedido')
      }
    } catch (error) {
      console.error('Error fetching order details:', error)
      setError('No se pudieron cargar los detalles del pedido. Por favor intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // ============================================================
  // FUNCIONES PARA BOLETA ANTIGUA (ApiGateway)
  // ============================================================

  const consultarBoleta = async () => {
    const folio = order?.boleta_info?.folio || boletaFolio
    
    if (!folio) {
      toast({
        title: "Sin folio",
        description: "No se encontró el folio de la boleta",
        variant: "destructive",
      })
      return
    }

    setConsultandoBoleta(true)
    setBoletaError(null)
    
    try {
      const response = await fetch(`/api/apigateway/consultar?folio=${folio}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        const estado = data.data.estado || data.data.estado_boleta || 'desconocido'
        setBoletaEstado(estado)
        setBoletaFolio(folio)
        
        toast({
          title: "Estado consultado",
          description: `Boleta N° ${folio} está en estado: ${estado}`,
          duration: 5000,
        })
      } else {
        setBoletaError(data.error || 'Error al consultar la boleta')
        toast({
          title: "Error",
          description: data.error || 'No se pudo consultar la boleta',
          variant: "destructive",
        })
      }
    } catch (error: any) {
      console.error('Error consultando boleta:', error)
      setBoletaError(error.message || 'Error de conexión')
      toast({
        title: "Error",
        description: error.message || 'Error al consultar la boleta',
        variant: "destructive",
      })
    } finally {
      setConsultandoBoleta(false)
    }
  }

  //  Descargar PDF de la BOLETA ANTIGUA (ApiGateway)
  const descargarBoletaAntigua = async () => {
    const folio = order?.boleta_info?.folio || boletaFolio
    
    if (!folio) {
      toast({
        title: "Sin boleta",
        description: "Esta orden no tiene una boleta asociada en el SII",
        variant: "destructive",
      })
      return
    }
    
    setDescargandoPDFAntiguo(true)
    try {
      const response = await fetch(`/api/apigateway/pdf?folio=${folio}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `boleta-${folio}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        
        toast({
          title: "PDF descargado",
          description: `Boleta N° ${folio} descargada exitosamente`,
          duration: 3000,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Error al descargar PDF",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error descargando PDF:', error)
      toast({
        title: "Error",
        description: "No se pudo descargar el PDF",
        variant: "destructive",
      })
    } finally {
      setDescargandoPDFAntiguo(false)
    }
  }

  //  Enviar boleta antigua por email (ApiGateway)
  //  Enviar boleta antigua por email (ApiGateway) - CON PARÁMETRO antigua=true
const handleEnviarEmailAntiguo = async () => {
  if (!order) return
  
  setShowConfirmModal(false)
  setEnviandoEmailAntiguo(true)
  
  try {
    //  AGREGAR PARÁMETRO antigua=true PARA FORZAR LA BOLETA ANTIGUA
    const response = await fetch(`/api/orders/${order.id}/resend-email?antigua=true`, {
      method: 'POST',
    })
    
    const data = await response.json()
    
    if (response.ok && data.success) {
      toast({
        title: "📧 Email enviado",
        description: data.message || `Boleta antigua (folio ${order.boleta_info?.folio}) enviada a ${order.customer_email}`,
        duration: 5000,
      })
    } else {
      toast({
        title: "❌ Error",
        description: data.error || "Error al enviar el email",
        variant: "destructive",
        duration: 5000,
      })
    }
  } catch (error) {
    console.error('Error enviando email antiguo:', error)
    toast({
      title: "❌ Error",
      description: "Error al conectar con el servidor",
      variant: "destructive",
      duration: 5000,
    })
  } finally {
    setEnviandoEmailAntiguo(false)
  }
}

  // Reintentar generación de boleta (solo si no existe)
  const handleReintentarBoleta = async () => {
    if (!order) return
    
    if (order.boleta_emitida === 1 && order.boleta_info?.folio) {
      toast({
        title: "Boleta ya emitida",
        description: `Esta orden ya tiene la boleta N° ${order.boleta_info.folio}`,
        variant: "default",
        duration: 5000,
      })
      return
    }
    
    setReintentandoBoleta(true)
    try {
      const response = await fetch(`/api/orders/${order.id}/retry-boleta-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast({
          title: " Boleta emitida",
          description: data.message || `Boleta N° ${data.folio} generada exitosamente`,
          duration: 5000,
        })
        fetchOrder()
      } else if (response.status === 429) {
        toast({
          title: "⏳ Espera antes de reintentar",
          description: data.error || `Debes esperar ${data.waitingMinutes || 5} minutos`,
          variant: "default",
          duration: 5000,
        })
      } else if (response.status === 409) {
        toast({
          title: "⏳ Procesando",
          description: "Otro usuario está procesando esta orden. Intenta nuevamente en unos segundos.",
          variant: "default",
          duration: 5000,
        })
      } else {
        toast({
          title: "❌ Error",
          description: data.error || "Error al generar la boleta",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error reintentando boleta:', error)
      toast({
        title: "❌ Error",
        description: "Error al conectar con el servidor",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setReintentandoBoleta(false)
    }
  }

  // ============================================================
  // FUNCIONES PARA BOLETA NUEVA (PDF subido por admin)
  // ============================================================

  //  Descargar PDF de la BOLETA NUEVA (subida por admin)
  const descargarBoletaNueva = async () => {
    if (!order?.boleta_pdf_path) {
      toast({
        title: "Sin PDF",
        description: "No hay un PDF subido para descargar",
        variant: "destructive",
      })
      return
    }
    
    setDescargandoPDFNuevo(true)
    try {
      const response = await fetch(order.boleta_pdf_path)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        const folio = order?.boleta_pdf_folio || 'boleta-admin'
        a.download = `boleta-${folio}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        
        toast({
          title: "PDF descargado",
          description: "Boleta subida por admin descargada exitosamente",
          duration: 3000,
        })
      } else {
        toast({
          title: "Error",
          description: "No se pudo descargar la boleta",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error descargando PDF:', error)
      toast({
        title: "Error",
        description: "No se pudo descargar el PDF",
        variant: "destructive",
      })
    } finally {
      setDescargandoPDFNuevo(false)
    }
  }

  //  Enviar boleta nueva por email (PDF subido por admin)
  const handleEnviarEmailNuevo = async () => {
    if (!order) return
    
    if (!order.boleta_pdf_path) {
      toast({
        title: "Sin PDF",
        description: "No hay un PDF subido para enviar",
        variant: "destructive",
      })
      return
    }
    
    setEnviandoEmail(true)
    try {
      const response = await fetch(`/api/orders/${order.id}/resend-email`, {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast({
          title: "📧 Email enviado",
          description: data.message || `Nueva boleta enviada a ${order.customer_email}`,
          duration: 5000,
        })
      } else {
        toast({
          title: "❌ Error",
          description: data.error || "Error al enviar el email",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error enviando email:', error)
      toast({
        title: "❌ Error",
        description: "Error al conectar con el servidor",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setEnviandoEmail(false)
    }
  }

  // ============================================================
  // FUNCIONES PARA SUBIR PDF
  // ============================================================

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type === 'application/pdf') {
        setPdfFile(file)
        toast({
          title: "PDF seleccionado",
          description: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
          duration: 3000,
        })
      } else {
        toast({
          title: "Formato inválido",
          description: "Por favor selecciona un archivo PDF",
          variant: "destructive",
          duration: 3000,
        })
        e.target.value = ''
      }
    }
  }

  const handleSubirPDF = async () => {
    if (!pdfFile || !order) return
    
    setSubiendoPDF(true)
    try {
      const formData = new FormData()
      formData.append('pdf', pdfFile)
      formData.append('orderId', order.id.toString())
      
      const response = await fetch('/api/admin/orders/upload-boleta', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast({
          title: " PDF subido",
          description: `PDF subido exitosamente. Folio: ${data.folio || 'ADMIN-XXXXX'}`,
          duration: 5000,
        })
        setPdfFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        await fetchOrder()
      } else {
        toast({
          title: "❌ Error",
          description: data.error || "Error al subir el PDF",
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error subiendo PDF:', error)
      toast({
        title: "❌ Error",
        description: "Error al conectar con el servidor",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setSubiendoPDF(false)
    }
  }

  // ============================================================
  // RENDERIZADO
  // ============================================================

  const getImageUrl = (imagePath: string | undefined) => {
    if (!imagePath) return "/placeholder.svg"
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath
    if (imagePath.startsWith('/uploads/')) return imagePath
    if (imagePath.startsWith('uploads/')) return `/${imagePath}`
    if (imagePath.startsWith('/')) return imagePath
    return `/uploads/products/${imagePath}`
  }

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'transbank': return 'Transbank Webpay'
      case 'cash': return 'Efectivo'
      default: return method || 'Transbank Webpay'
    }
  }

  const getPaymentTypeDisplay = (code: string) => {
    const type = PAYMENT_TYPES[code]
    if (type) {
      return `${type.icon} ${type.label}`
    }
    return code || 'No especificado'
  }

  const getPaymentTypeDescription = (code: string) => {
    const type = PAYMENT_TYPES[code]
    return type ? type.description : code || 'No especificado'
  }

  const formatInstallments = (installments: number | undefined) => {
    if (installments === undefined || installments === null) return 'No especificado'
    return installments === 0 ? 'Sin cuotas' : `${installments} cuota(s)`
  }

  const formatTransactionDate = (dateString: string | undefined) => {
    if (!dateString) return 'No disponible'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return 'Fecha inválida'
    }
  }

  const getShippingDisplay = () => {
    if (!order) return null
    
    const shippingType = order.shipping_type || ''
    const shippingDetails = order.shipping_details
    
    if (shippingType === 'bodega_pickup' || shippingDetails?.type === 'bodega_pickup') {
      const branch = shippingDetails?.selectedBranch || { address: 'Arcangel 1200, San Miguel' }
      return {
        type: 'bodega',
        title: 'Retiro en Bodega',
        address: branch.address || 'Arcangel 1200, San Miguel',
        details: '',
        icon: Store
      }
    }
    
    if (shippingType === 'branch_pickup' || shippingDetails?.selectedBranch) {
      const branch = shippingDetails?.selectedBranch
      return {
        type: 'branch',
        title: 'Retiro en Sucursal',
        address: branch?.address || 'Sucursal Chilexpress',
        details: branch?.name ? `Sucursal: ${branch.name}` : '',
        icon: Store
      }
    }
    
    if (shippingType === 'home_delivery' || shippingType === 'standard' || shippingType === 'express') {
      return {
        type: 'home',
        title: 'Envío a Domicilio',
        address: order.shipping_address?.street || 'Dirección no especificada',
        details: `${order.shipping_address?.commune_name || ''} ${order.shipping_address?.region_name ? `, ${order.shipping_address.region_name}` : ''}`,
        icon: Truck
      }
    }
    
    return null
  }

  const shippingDisplay = getShippingDisplay()
  const paymentTypeCode = order?.transbank_info?.payment_type_code || order?.transbank_info?.payment_type
  const tieneBoleta = order?.boleta_emitida === 1 && order?.boleta_info?.folio
  const tienePDFAdmin = !!order?.boleta_pdf_path

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    )
  }

  if (user?.role !== 'admin') return null

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando detalles del pedido...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-red-800 mb-2">Error</h1>
            <p className="text-red-600 mb-6">{error || 'Pedido no encontrado'}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button onClick={fetchOrder}>Reintentar</Button>
            <Link href="/admin/orders"><Button variant="outline">Volver a Pedidos</Button></Link>
          </div>
        </div>
      </div>
    )
  }

  const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
  const StatusIcon = statusInfo.icon
  const { neto: subtotalNeto, iva: subtotalIVA } = calculateTaxBreakdown(order.subtotal)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* MODAL DE CONFIRMACIÓN */}
      <ConfirmEmailModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleEnviarEmailAntiguo}
        isLoading={enviandoEmailAntiguo}
      />

      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/admin/orders" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a todos los pedidos
          </Link>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl lg:text-3xl font-bold">Pedido #{order.order_number}</h1>
                {order.is_guest ? (
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
                    <User className="w-3 h-3 mr-1" />
                    Invitado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                    <Users className="w-3 h-3 mr-1" />
                    Cliente Registrado
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Realizado el {new Date(order.created_at).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Badge className={`${statusInfo.color} border text-sm`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {order.payment_status === 'paid' ? 'Pagado' : 
                 order.payment_status === 'pending' ? 'Pago pendiente' :
                 order.payment_status === 'failed' ? 'Pago fallido' : 
                 order.payment_status === 'refunded' ? 'Reembolsado' :
                 order.payment_status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
          {/* COLUMNA IZQUIERDA */}
          <div className="xl:col-span-1 space-y-6">
            {/* Información del Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {order.customer_first_name} {order.customer_last_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm">{order.customer_email}</p>
                </div>
                {order.customer_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm">{order.customer_phone}</p>
                  </div>
                )}
                {order.customer_rut && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                    <span className="text-muted-foreground text-sm">RUT:</span>
                    <span className="text-sm font-mono font-medium">{order.customer_rut}</span>
                  </div>
                )}
                {order.is_guest && (
                  <Badge variant="outline" className="mt-2 bg-purple-50 text-purple-700 border-purple-200">
                    <User className="w-3 h-3 mr-1" />
                    Invitado
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Dirección de Envío */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5" />
                  Dirección de Envío
                </CardTitle>
              </CardHeader>
              <CardContent>
                {shippingDisplay ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <shippingDisplay.icon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{shippingDisplay.title}</span>
                    </div>
                    <p className="text-sm">{shippingDisplay.address}</p>
                    {shippingDisplay.details && (
                      <p className="text-sm text-muted-foreground">{shippingDisplay.details}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Dirección no especificada</p>
                )}
              </CardContent>
            </Card>

            {/* Información de Pago */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5" />
                  Información de Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Método:</span>
                  <span>{formatPaymentMethod(order.payment_method)}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estado:</span>
                  <span className={
                    order.payment_status === 'paid' ? 'text-green-600 font-medium' :
                    order.payment_status === 'pending' ? 'text-yellow-600 font-medium' :
                    order.payment_status === 'failed' ? 'text-red-600 font-medium' :
                    'text-muted-foreground'
                  }>
                    {order.payment_status === 'paid' ? 'Pagado' : 
                     order.payment_status === 'pending' ? 'Pendiente' :
                     order.payment_status === 'failed' ? 'Fallido' : 
                     order.payment_status === 'refunded' ? 'Reembolsado' :
                     order.payment_status}
                  </span>
                </div>

                {order.transbank_info && (
                  <>
                    {paymentTypeCode && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Tipo de pago:</span>
                        <span className="font-medium">
                          {getPaymentTypeDisplay(paymentTypeCode)}
                        </span>
                      </div>
                    )}
                    {paymentTypeCode && (
                      <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                        <span>Descripción:</span>
                        <span>{getPaymentTypeDescription(paymentTypeCode)}</span>
                      </div>
                    )}
                    {order.transbank_info.authorization_code && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Código autorización:</span>
                        <span className="font-mono text-xs">{order.transbank_info.authorization_code}</span>
                      </div>
                    )}
                    {(order.transbank_info.installments !== undefined && order.transbank_info.installments !== null) && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cuotas:</span>
                        <span>{formatInstallments(order.transbank_info.installments)}</span>
                      </div>
                    )}
                    {order.transbank_info.card_number && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tarjeta:</span>
                        <span className="font-mono text-xs">**** {order.transbank_info.card_number}</span>
                      </div>
                    )}
                    {order.transbank_info.transaction_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fecha transacción:</span>
                        <span className="text-xs">{formatTransactionDate(order.transbank_info.transaction_date)}</span>
                      </div>
                    )}
                  </>
                )}

                {order.coupon_info && (
                  <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
                    <p className="text-xs font-medium text-green-800">Cupón aplicado:</p>
                    <p className="text-xs text-green-700">{order.coupon_info.code} ({order.coupon_info.discount_percentage}% descuento)</p>
                    <p className="text-xs text-green-600">Tipo: {order.coupon_info.type}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/*  SECCIÓN DE BOLETA - Boleta Antigua (ApiGateway) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  {tienePDFAdmin ? "Boleta Electrónica (Antigua)" : "Boleta Electrónica"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order?.boleta_info ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Folio:</span>
                      <span className="font-mono font-medium">{order.boleta_info.folio}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Estado:</span>
                      <Badge variant={order.boleta_info.estado_sii === 'emitida' ? 'default' : 'outline'}>
                        {order.boleta_info.estado_sii || 'emitida'}
                      </Badge>
                    </div>
                    {/*  Mensaje de advertencia si hay PDF admin */}
                    {tienePDFAdmin && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-xs text-amber-700 flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>Esta es la boleta <strong>antigua</strong></span>
                        </p>
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={consultarBoleta}
                        disabled={consultandoBoleta}
                      >
                        {consultandoBoleta ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4 mr-2" />
                        )}
                        Consultar estado en el SII
                      </Button>
                      {/*  Descargar PDF - SOLO de la boleta antigua */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={descargarBoletaAntigua}
                        disabled={descargandoPDFAntiguo}
                      >
                        {descargandoPDFAntiguo ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Descargar PDF
                      </Button>
                      {/*  Enviar boleta antigua - CON modal si tiene PDF admin */}
                      {tienePDFAdmin ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-amber-500 text-amber-600 hover:bg-amber-50/50 hover:text-amber-600 transition-colors"
                          onClick={() => setShowConfirmModal(true)}
                          disabled={enviandoEmailAntiguo}
                        >
                          {enviandoEmailAntiguo ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          Enviar boleta antigua
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={handleEnviarEmailAntiguo}
                          disabled={enviandoEmailAntiguo}
                        >
                          {enviandoEmailAntiguo ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-2" />
                          )}
                          Enviar por email
                        </Button>
                      )}
                    </div>
                    {boletaEstado && boletaEstado !== order.boleta_info.estado_sii && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">
                          Estado actualizado: <strong>{boletaEstado}</strong>
                        </p>
                      </div>
                    )}
                    {boletaError && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-600">{boletaError}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Esta orden no tiene una boleta asociada en el SII
                    </p>
                    <div className="flex flex-col gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-amber-500 text-amber-600 hover:bg-amber-50"
                        onClick={handleReintentarBoleta}
                        disabled={reintentandoBoleta}
                      >
                        {reintentandoBoleta ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Reintentar generación
                      </Button>
                    </div>
                    {order.boleta_intentos !== undefined && order.boleta_intentos > 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        Intentos: {order.boleta_intentos} de 30
                      </p>
                    )}
                    {order.boleta_error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs text-red-600">Error: {order.boleta_error}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/*  SECCIÓN PARA SUBIR PDF (Admin) - Con datos de la boleta nueva */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="w-5 h-5" />
                  Subir Boleta (PDF)
                  {order?.boleta_pdf_path && (
                    <Badge className="bg-green-500 text-white text-xs ml-2">
                      <Check className="w-3 h-3 mr-1" />
                      Subida
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/*  Si ya hay PDF subido, mostrar los datos de la boleta nueva */}
                {order?.boleta_pdf_path && order?.boleta_nueva ? (
                  <>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-green-700">Folio (nueva boleta):</span>
                        <span className="font-mono font-medium text-green-800">
                          {order.boleta_nueva.folio}
                        </span>
                      </div>

                      <p className="text-xs text-green-600 mt-1">
                        Esta boleta fue subida manualmente
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">

                      {/*  Descargar PDF subido - SOLO descargar el PDF del admin */}
                      <Button
                        variant="outline"
                        className="w-full border-green-500 text-green-600 hover:bg-green-50/50 hover:text-green-600 transition-colors"
                        onClick={descargarBoletaNueva}
                        disabled={descargandoPDFNuevo}
                      >
                        {descargandoPDFNuevo ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Descargar PDF subido
                      </Button>
                      {/*  Enviar nueva boleta por email - SOLO enviar el PDF del admin */}
                      <Button
                        variant="outline"
                        className="w-full border-blue-500 text-blue-600 hover:bg-blue-50/50 hover:text-blue-600 transition-colors"
                        onClick={handleEnviarEmailNuevo}
                        disabled={enviandoEmail}
                      >
                        {enviandoEmail ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Enviar nueva boleta por email
                      </Button>
                    </div>
                  </>
                ) : (
                  //  Si no hay PDF subido, mostrar el formulario para subir
                  <>
                    <p className="text-xs text-muted-foreground">
                      Sube un PDF de la boleta para reemplazar la actual. 
                      Esto es útil para notas de crédito, débito o correcciones.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                      />
                      {pdfFile && (
                        <div className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                          <span className="text-sm text-green-700 truncate">{pdfFile.name}</span>
                          <span className="text-xs text-green-600">{(pdfFile.size / 1024).toFixed(1)} KB</span>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleSubirPDF}
                        disabled={!pdfFile || subiendoPDF}
                      >
                        {subiendoPDF ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Subir y Reemplazar Boleta
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="xl:col-span-2 space-y-6">
            {/* Productos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Productos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => {
                      const itemTotal = item.product_price * item.quantity
                      const imageUrl = getImageUrl(item.image_url)
                      
                      return (
                        <div key={item.id} className="flex gap-4 p-3 bg-muted/30 rounded-lg">
                          <div className="relative w-16 h-16 flex-shrink-0">
                            <Image
                              src={imageUrl}
                              alt={item.product_name}
                              fill
                              className="object-cover rounded"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.src = "/placeholder.svg"
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm lg:text-base line-clamp-2">{item.product_name}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {item.category || "General"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">Cantidad: {item.quantity}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-sm lg:text-base">
                              {formatPrice(itemTotal)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatPrice(item.product_price)} c/u
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No hay productos en esta orden</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Resumen */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumen del Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                    <span>Neto (sin IVA):</span>
                    <span>{formatPrice(subtotalNeto)}</span>
                  </div>
                  <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                    <span>IVA (19%):</span>
                    <span>{formatPrice(subtotalIVA)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="text-muted-foreground">Descuento:</span>
                      <span>-{formatPrice(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Envío:</span>
                    <span>
                      {order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium text-base">
                    <span>Total:</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>

                {order.notes && (
                  <div className="mt-6 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs font-medium text-blue-800 mb-1">Notas del pedido:</p>
                    <p className="text-sm text-blue-700">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}