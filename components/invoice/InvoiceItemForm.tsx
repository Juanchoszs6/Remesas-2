import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumberInput } from "@/components/ui/number-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Autocomplete } from "@/components/autocomplete"
import { InvoiceItem } from "@/types/siigo"
import { Trash2 } from "lucide-react"

type InvoiceItemFormProps = {
  item: InvoiceItem
  onUpdate: (
    id: string, 
    field: keyof InvoiceItem, 
    value: string | number | boolean | { type?: string; value?: number } | undefined
  ) => void
  onRemove: (id: string) => void
  index: number
  isLastItem: boolean
  ivaPercentage: number
  disabled?: boolean
}

export function InvoiceItemForm({
  item,
  onUpdate,
  onRemove,
  index,
  isLastItem,
  ivaPercentage,
  disabled = false
}: InvoiceItemFormProps) {
  
  const calculateItemSubtotal = () => {
    const subtotal = (item.quantity || 0) * (item.price || 0);
    const discount = item.discount?.value || 0;
    return subtotal - discount;
  };

  const calculateItemTotal = () => {
    const subtotal = calculateItemSubtotal();
    const iva = item.hasIVA ? subtotal * (ivaPercentage / 100) : 0;
    return subtotal + iva;
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">Item {index + 1}</Badge>
        {!isLastItem && (
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="text-red-500 hover:text-red-700 disabled:opacity-50"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Item</Label>
          <Select
            value={item.type}
            onValueChange={(value: 'product' | 'activo' | 'contable') => onUpdate(item.id, 'type', value)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product">🛍️ Producto</SelectItem>
              <SelectItem value="activo">🏢 Activo Fijo</SelectItem>
              <SelectItem value="contable">🏦 Cuenta Contable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {item.type === "product" && (
            <Autocomplete
              label="Código Producto"
              placeholder="Buscar producto..."
              apiEndpoint="/api/productos-lista"
              value={item.code}
              onSelect={(option) => {
                if (option) {
                  onUpdate(item.id, 'code', option.codigo || '');
                  onUpdate(item.id, 'description', option.nombre || '');
                  if (option.precio_base !== undefined) {
                    onUpdate(item.id, 'price', option.precio_base);
                  }
                  if (option.tiene_iva !== undefined) {
                    onUpdate(item.id, 'hasIVA', option.tiene_iva === true);
                  }
                }
              }}
              disabled={disabled}
              required
            />
          )}

          {item.type === "activo" && (
            <Autocomplete
              label="Código Activo Fijo"
              placeholder="Buscar activo fijo..."
              apiEndpoint="/api/activos-fijos"
              value={item.code}
              onSelect={(option) => {
                if (option) {
                  onUpdate(item.id, 'code', option.codigo || '');
                  onUpdate(item.id, 'description', option.nombre || '');
                  if (option.precio_base) {
                    onUpdate(item.id, 'price', option.precio_base);
                  }
                  if (option.tiene_iva !== undefined) {
                    onUpdate(item.id, 'hasIVA', option.tiene_iva);
                  }
                }
              }}
              disabled={disabled}
              required
            />
          )}

          {item.type === "contable" && (
            <Autocomplete
              label="Código Cuenta Contable"
              placeholder="Buscar cuenta contable..."
              apiEndpoint="/api/cuentas-contables"
              value={item.code}
              onSelect={(option) => {
                if (option) {
                  onUpdate(item.id, 'code', option.codigo || '');
                  onUpdate(item.id, 'description', option.nombre || '');
                }
              }}
              disabled={disabled}
              required
            />
          )}
        </div>

        <div className="space-y-2">
          <Label>Descripción</Label>
          <Input
            value={item.description}
            onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
            placeholder="Descripción del item"
            disabled={disabled}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Cantidad</Label>
          <NumberInput
            value={item.quantity}
            onChange={(value) => onUpdate(item.id, 'quantity', value === '' ? 1 : Number(value))}
            min={1}
            step={1}
            allowEmpty={false}
            placeholder="1"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Precio Unitario</Label>
          <NumberInput
            value={item.price}
            onChange={(value) => onUpdate(item.id, 'price', value === '' ? 0 : Number(value))}
            min={0}
            step={0.01}
            allowEmpty={true}
            placeholder="0.00"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label>Descuento</Label>
          <NumberInput
            value={item.discount?.value || 0}
            onChange={(value) => {
              const numValue = value === '' ? 0 : Number(value);
              onUpdate(item.id, 'discount', { 
                ...item.discount, 
                value: numValue 
              });
            }}
            min={0}
            step={0.01}
            allowEmpty={true}
            placeholder="0.00"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`iva-${item.id}`}
              checked={item.hasIVA !== false}
              onCheckedChange={(checked) => onUpdate(item.id, 'hasIVA', checked)}
              disabled={disabled}
            />
            <Label htmlFor={`iva-${item.id}`} className="text-sm font-medium">
              Este item tiene IVA
            </Label>
          </div>
          {item.hasIVA !== false && (
            <Badge variant="secondary" className="text-xs">
              IVA aplicado: {ivaPercentage}%
            </Badge>
          )}
        </div>
      </div>

      <div className="bg-muted p-3 rounded-md">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">Subtotal:</span>
            <span className="text-sm font-medium">
              ${calculateItemSubtotal().toLocaleString("es-CO", { 
                minimumFractionDigits: 2 
              })} COP
            </span>
          </div>
          
          {item.hasIVA !== false && (
            <div className="flex justify-between items-center">
              <span className="text-sm">IVA ({ivaPercentage}%):</span>
              <span className="text-sm font-medium">
                ${(calculateItemSubtotal() * (ivaPercentage / 100)).toLocaleString("es-CO", { 
                  minimumFractionDigits: 2 
                })} COP
              </span>
            </div>
          )}
          
          <div className="flex justify-between items-center border-t pt-2">
            <span className="text-sm font-bold">Total Item:</span>
            <span className="text-sm font-bold text-green-600">
              ${calculateItemTotal().toLocaleString("es-CO", { 
                minimumFractionDigits: 2 
              })} COP
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}