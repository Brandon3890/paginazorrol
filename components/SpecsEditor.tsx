// components/SpecsEditor.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Plus, GripVertical, AlignLeft, ChevronUp, ChevronDown } from "lucide-react"
import { ProductSpec } from "@/lib/product-specs"

interface SpecsEditorProps {
  specs: ProductSpec[];
  onChange: (specs: ProductSpec[]) => void;
}

export function SpecsEditor({ specs, onChange }: SpecsEditorProps) {
  const [newLabel, setNewLabel] = useState("")
  const [newValue, setNewValue] = useState("")

  const addSpec = () => {
    if (newLabel.trim() && newValue.trim()) {
      onChange([...specs, { label: newLabel.trim(), value: newValue.trim() }])
      setNewLabel("")
      setNewValue("")
    }
  }

  const removeSpec = (index: number) => {
    onChange(specs.filter((_, i) => i !== index))
  }

  const updateSpec = (index: number, field: keyof ProductSpec, value: string) => {
    const updated = [...specs]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const moveSpecUp = (index: number) => {
    if (index === 0) return
    const updated = [...specs]
    const temp = updated[index]
    updated[index] = updated[index - 1]
    updated[index - 1] = temp
    onChange(updated)
  }

  const moveSpecDown = (index: number) => {
    if (index === specs.length - 1) return
    const updated = [...specs]
    const temp = updated[index]
    updated[index] = updated[index + 1]
    updated[index + 1] = temp
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-semibold">Caracteristicas del Producto</Label>
          <span className="text-xs text-muted-foreground">
            {specs.length} caracteristica{specs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Agrega todas las caracteristicas que quieras mostrar. Cada caracteristica tiene un titulo en negrita y un contenido.
          Puedes escribir cualquier titulo que necesites. Usa <strong>Enter</strong> para saltos de linea en el contenido.
          Arrastra o usa las flechas para reordenar.
        </p>
      </div>

      {specs.length > 0 && (
        <div className="border rounded-lg divide-y">
          {specs.map((spec, index) => (
            <div key={index} className="flex items-start gap-2 p-3 hover:bg-muted/20 group">
               <div className="flex flex-col gap-1 flex-shrink-0 mt-1">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveSpecUp(index)}
                    disabled={index === 0}
                    className="h-6 w-6 text-muted-foreground hover:text-blue-600 disabled:opacity-30"
                    title="Mover arriba"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => moveSpecDown(index)}
                    disabled={index === specs.length - 1}
                    className="h-6 w-6 text-muted-foreground hover:text-blue-600 disabled:opacity-30"
                    title="Mover abajo"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSpec(index)}
                  className="h-6 w-6 text-muted-foreground hover:text-red-600"
                  title="Eliminar"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Titulo (negrita)</Label>
                  <Input
                    value={spec.label}
                    onChange={(e) => updateSpec(index, 'label', e.target.value)}
                    placeholder="Escribe el titulo."
                    className="font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Contenido (Enter para saltos de linea)</Label>
                    <span className="text-xs text-muted-foreground">
                      <AlignLeft className="w-3 h-3 inline mr-1" />
                      {spec.value.split('\n').length} lineas
                    </span>
                  </div>
                  <Textarea
                    value={spec.value}
                    onChange={(e) => updateSpec(index, 'value', e.target.value)}
                    placeholder="Escribe el contenido."
                    rows={Math.min(spec.value.split('\n').length + 1, 8)}
                    className="min-h-[60px] resize-y font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-lg p-4 bg-muted/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Titulo (se mostrara en negrita)</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ej: INCLUYE, CONTENIDO, DETALLES..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addSpec()
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Contenido (Enter para saltos de linea)</Label>
            <div className="flex flex-col gap-2">
              <Textarea
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Escribe el contenido. Presiona Enter para saltos de linea."
                rows={3}
                className="resize-y"
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' && (e.shiftKey || e.ctrlKey)) || 
                      (e.key === 'Enter' && e.target instanceof HTMLTextAreaElement && 
                       e.target.value.trim() && newLabel.trim())) {
                    e.preventDefault()
                    addSpec()
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={addSpec}
                  disabled={!newLabel.trim() || !newValue.trim()}
                  className="flex-shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
                <p className="text-xs text-muted-foreground flex items-center">
                  {newValue.split('\n').length > 1 ? `${newValue.split('\n').length} lineas` : ''}
                  &nbsp;{newValue.trim() ? `(${newValue.length} caracteres)` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 p-2 bg-muted/30 rounded text-xs text-muted-foreground">
          <strong>Tips:</strong>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>Usa <kbd className="px-1 py-0.5 bg-muted rounded">Enter</kbd> para saltos de linea dentro del contenido</li>
            <li>Usa <kbd className="px-1 py-0.5 bg-muted rounded">Shift+Enter</kbd> o <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+Enter</kbd> para agregar la caracteristica</li>
            <li>Puedes pegar texto con multiples lineas (ej: listas de productos)</li>
            <li>Usa las flechas <ChevronUp className="w-3 h-3 inline" /> <ChevronDown className="w-3 h-3 inline" /> para reordenar</li>
          </ul>
        </div>
      </div>
    </div>
  )
}