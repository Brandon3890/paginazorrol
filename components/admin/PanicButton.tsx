"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, Power, PowerOff, Loader2, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function PanicButton() {
  const { toast } = useToast()
  const [storeOpen, setStoreOpen] = useState(true)
  const [maintenanceMessage, setMaintenanceMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newMessage, setNewMessage] = useState("")
  const [isClosing, setIsClosing] = useState(false)

  // Cargar estado actual
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/admin/store/status')
        if (response.ok) {
          const data = await response.json()
          setStoreOpen(data.storeOpen)
          setMaintenanceMessage(data.maintenanceMessage || '')
          setNewMessage(data.maintenanceMessage || '')
        }
      } catch (error) {
        console.error('Error fetching store status:', error)
      }
    }
    fetchStatus()
  }, [])

  const handleToggleStore = async () => {
    setLoading(true)
    try {
      const newState = !storeOpen
      const response = await fetch('/api/admin/store/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          storeOpen: newState,
          maintenanceMessage: newMessage
        })
      })

      if (response.ok) {
        setStoreOpen(newState)
        setMaintenanceMessage(newMessage)
        toast({
          title: newState ? " Tienda abierta" : " Tienda cerrada",
          description: newState 
            ? "Los clientes pueden realizar compras nuevamente" 
            : "La tienda está en modo mantenimiento",
          duration: 5000,
        })
        setDialogOpen(false)
        // Disparar evento para actualizar otros componentes
        window.dispatchEvent(new CustomEvent('store-status-changed', { 
          detail: { storeOpen: newState } 
        }))
      } else {
        toast({
          title: "Error",
          description: "No se pudo cambiar el estado de la tienda",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al cambiar el estado",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const openDialog = () => {
    setIsClosing(!storeOpen)
    setNewMessage(maintenanceMessage)
    setDialogOpen(true)
  }

  const getStatusColor = () => {
    if (storeOpen) return "bg-green-500"
    return "bg-red-500"
  }

  const getStatusText = () => {
    if (storeOpen) return "Tienda abierta"
    return "Tienda en mantenimiento"
  }

  return (
    <>
      <Button
        variant={storeOpen ? "outline" : "destructive"}
        onClick={openDialog}
        className={`relative flex items-center gap-2 ${!storeOpen ? 'animate-pulse' : ''}`}
        disabled={loading}
      >
        <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`} />
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : storeOpen ? (
          <Power className="w-4 h-4" />
        ) : (
          <PowerOff className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">{getStatusText()}</span>
        <span className="sm:hidden">{storeOpen ? "Abierto" : "Cerrado"}</span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${!storeOpen ? 'text-red-600' : 'text-yellow-600'}`}>
              {!storeOpen ? (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  ¿Abrir tienda?
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5" />
                  ¿Cerrar tienda?
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {!storeOpen ? (
                "La tienda está actualmente cerrada. ¿Quieres abrirla para que los clientes puedan comprar?"
              ) : (
                "La tienda está actualmente abierta. ¿Quieres cerrarla para realizar mantenimiento?"
              )}
            </DialogDescription>
          </DialogHeader>

          {storeOpen ? (
            <>
              <div className="py-2">
                <Label htmlFor="maintenance-message">Mensaje de mantenimiento</Label>
                <Textarea
                  id="maintenance-message"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Mensaje que verán los clientes..."
                  className="mt-2"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Este mensaje se mostrará en lugar del botón de "Agregar al carrito"
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Al cerrar la tienda, los clientes no podrán agregar productos al carrito ni realizar compras.</span>
                </p>
              </div>
            </>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Al abrir la tienda, los clientes podrán comprar normalmente.</span>
              </p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              variant={storeOpen ? "destructive" : "default"}
              onClick={handleToggleStore}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : storeOpen ? (
                <>
                  <PowerOff className="w-4 h-4 mr-2" />
                  Cerrar tienda
                </>
              ) : (
                <>
                  <Power className="w-4 h-4 mr-2" />
                  Abrir tienda
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}