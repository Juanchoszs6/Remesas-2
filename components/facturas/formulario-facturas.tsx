import * as React from 'react';
import { useReducer, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { InvoiceItem } from "@/types/siigo";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from '@/components/ui/separator';
import { Autocomplete, type AutocompleteOption } from '@/components/autocomplete';
import { InvoiceItemForm } from "./formulario-item-facturas";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Send, 
  Plus, 
  CheckCircle2 as CheckCircledIcon, 
  AlertTriangle as ExclamationTriangleIcon 
} from 'lucide-react';

// Definiendo porpiedades 
interface Provider {
  id?: string;
  codigo?: string;
  identificacion?: string;
  nombre?: string;
  name?: string; // Alias de nombre 
  branch_office?: number;
  type?: string;
  identification?: string;
  tipo_documento?: string;
  nombre_comercial?: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string;
  correo_electronico?: string;
  [key: string]: string | number | undefined;
}

interface InvoiceState {
  provider: Provider | null;
  items: InvoiceItem[];
  invoiceDate: string;
  documentId: string;
  providerInvoiceNumber: string;
  providerInvoicePrefix: string;
  observations: string;
  ivaPercentage: number;
  providerCode: string;
  providerIdentification: string;
  costCenter: string;
  cufe?: string;
  currency?: string;
}

type InvoiceFormAction =
  | { type: 'ADD_ITEM'; payload: InvoiceItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { 
      type: 'UPDATE_ITEM'; 
      payload: { 
        id: string; 
        field: keyof InvoiceItem; 
        value: string | number | boolean | { type?: string; value?: number } | undefined;
      } 
    }
  | { 
      type: 'UPDATE_FIELD'; 
      payload: (
        | { field: 'invoiceDate' | 'documentId' | 'providerInvoiceNumber' | 'providerInvoicePrefix' | 'observations' | 'providerCode' | 'providerIdentification' | 'cufe'; value: string }
        | { field: 'costCenter'; value: string }
        | { field: 'ivaPercentage'; value: number }
        | { field: 'currency'; value: string | undefined }
      )
    }
  | { type: 'SET_PROVIDER'; payload: Provider | null }
  | { type: 'SET_DOCUMENT_ID'; payload: string }
  | { type: 'SET_PROVIDER_INVOICE_NUMBER'; payload: string }
  | { type: 'SET_CUFE'; payload: string }
  | { type: 'SET_CURRENCY'; payload: string }
  | { type: 'RESET_FORM' };

// El tipo facturas formlario se define arriba 

// Funcion utilmem reduct
const calculateSubtotal = (items: InvoiceItem[]): number => {
  return items.reduce((sum, item) => {
    const itemSubtotal = (item.quantity || 0) * (item.price || 0);
    const discount = item.discount?.value || 0;
    return sum + (itemSubtotal - discount);
  }, 0);
};

const calculateIVA = (items: InvoiceItem[], ivaPercentage: number): number => {
  return items.reduce((sum, item) => {
    if (!item.hasIVA) return sum;
    const itemSubtotal = (item.quantity || 0) * (item.price || 0);
    const discount = item.discount?.value || 0;
    const taxableAmount = itemSubtotal - discount;
    return sum + (taxableAmount * (ivaPercentage / 100));
  }, 0);
};

const calculateTotal = (items: InvoiceItem[], ivaPercentage: number): number => {
  const subtotal = calculateSubtotal(items);
  const iva = calculateIVA(items, ivaPercentage);
  return subtotal + iva;
};

const mapItemTypeToSiigoType = (type: string = 'product'): 'Product' | 'Service' | 'FixedAsset' => {
  switch (type) {
    case 'product': return 'Product';
    case 'service': return 'Service';
    case 'fixed-asset': return 'FixedAsset';
    default: return 'Product';
  }
};

// incializar el estado
const initialState: InvoiceState = {
  provider: null,
  items: [],
  invoiceDate: new Date().toISOString().split('T')[0],
  documentId: '',
  providerInvoiceNumber: '',
  providerInvoicePrefix: 'FC',
  costCenter: '0',
  observations: '',
  ivaPercentage: 19,
  providerCode: '',
  providerIdentification: ''
};

// reducir funcion
const invoiceFormReducer = (state: InvoiceState, action: InvoiceFormAction): InvoiceState => {
  switch (action.type) {
    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, action.payload]
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload.id 
            ? { ...item, [action.payload.field]: action.payload.value }
            : item
        )
      };
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.payload.field]: action.payload.value
      } as InvoiceState;
    case 'SET_PROVIDER':
      return {
        ...state,
        provider: action.payload,
        providerCode: action.payload?.codigo || '',
        providerIdentification: action.payload?.identificacion || ''
      };
    case 'SET_DOCUMENT_ID':
      return {
        ...state,
        documentId: action.payload
      };
    case 'SET_PROVIDER_INVOICE_NUMBER':
      return {
        ...state,
        providerInvoiceNumber: action.payload
      };
    case 'RESET_FORM':
      return { ...initialState };
    default:
      return state;
  }
};

export default function InvoiceForm() {
  const router = useRouter();
  const [state, dispatch] = useReducer(invoiceFormReducer, initialState);
// El estado de carga no se utiliza actualmente, pero se guarda para uso futuro.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleAddItem = useCallback(() => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
// ... (el resto del código sigue siendo el mismo)
      type: 'product',
      code: '',
      description: '',
      quantity: 1,
      price: 0,
      warehouse: '1',
      hasIVA: true,
    };
    dispatch({ type: 'ADD_ITEM', payload: newItem });
  }, []);

  const handleProviderSelect = useCallback((option: AutocompleteOption | null) => {
    if (!option) {
      dispatch({ type: 'SET_PROVIDER', payload: null });
      return;
    }

    // Asignar AutocompleteOption al tipo de proveedor
    const provider: Provider = {
      id: option.codigo,
      nombre: option.nombre,
      identificacion: option.codigo,
      codigo: option.codigo,
      name: option.nombre,
      tipo_documento: '31',
      nombre_comercial: option.nombre,
      ciudad: 'Bogotá',
      direccion: 'No especificada',
      telefono: '0000000',
      correo_electronico: 'no@especificado.com',
      branch_office: 0,
      type: 'Proveedor',
      identification: option.codigo
    };

    dispatch({ type: 'SET_PROVIDER', payload: provider });
  }, []);

  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];
    
    if (!state.provider) {
      errors.push('Debe seleccionar un proveedor');
    }
    
    if (!state.providerInvoiceNumber?.trim()) {
      errors.push('El número de factura es requerido');
    }
    
    if (state.items.length === 0) {
      errors.push('Debe agregar al menos un ítem');
    }
    
    // Validar items
    state.items.forEach((item: InvoiceItem, index: number) => {
      if (!item.code?.trim()) {
        errors.push(`Item ${index + 1}: Código es requerido`);
      }
      if (!item.description?.trim()) {
        errors.push(`Item ${index + 1}: Descripción es requerida`);
      }
      if (!item.quantity || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Cantidad debe ser mayor a 0`);
      }
      if (item.price === undefined || item.price < 0) {
        errors.push(`Item ${index + 1}: Precio no puede ser negativo`);
      }
    });
    
    return errors;
  }, [state]);

  // Define el tipo SiigoPaymentRequest ya que no se importa
interface SiigoPaymentRequest {
  // Agregue las propiedades reales según sus requisitos
  [key: string]: string | number | boolean | object | undefined | null;
}

const buildSiigoPayload = useCallback((): SiigoPaymentRequest => {
    // El código del proveedor es el identification
    const codigoProveedor = state.provider?.codigo || state.provider?.identificacion || '';
    const branchOffice = state.provider?.branch_office ?? 0;
    const fechaFormateada = state.invoiceDate;

    // Mapear los ítems al formato de Siigo
    const items = state.items.map((item: InvoiceItem) => {
      const itemSubtotal = (item.quantity || 0) * (item.price || 0);
      const discount = item.discount?.value || 0;
      const taxableAmount = itemSubtotal - discount;
      
      return {
        type: mapItemTypeToSiigoType(item.type),
        code: item.code,
        description: item.description || item.code,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        discount: discount,
        taxes: item.hasIVA ? [{
          id: 18384, // ID del impuesto IVA
          tax_base: taxableAmount,
          type: "IVA"
        }] : [],
        warehouse: item.warehouse || '1'
      };
    });

    const total = calculateTotal(state.items, state.ivaPercentage);

    const payment: SiigoPaymentRequest & { name: string } = {
      id: 8467, // ID real del método de pago, ajusta según tu configuración
      name: "OTROS",
      value: total,
      due_date: fechaFormateada
    };

    // Payload robusto y limpio
    return {
      document: {
        id: 27524,
      },
      date: fechaFormateada,
      supplier: {
        identification: String(codigoProveedor),
        branch_office: branchOffice
      },
      cost_center: state.costCenter,
      provider_invoice: {
        prefix: state.providerInvoicePrefix || "FC",
        number: state.providerInvoiceNumber ? String(Number(state.providerInvoiceNumber)) : null,
        // Incluir CUFE si está presente
        ...(state.cufe && { cufe: state.cufe })
      },
      currency: state.currency,
      discount_type: "Value",
      supplier_by_item: false,
      tax_included: false, // Los impuestos se manejan por ítem
      observations: state.observations || "",
      items,
      payments: [payment]
    };
  }, [state]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      // Validar formulario
      const validationErrors = validateForm();
      if (validationErrors.length > 0) {
        toast.error('Errores en el formulario', {
          description: validationErrors.join(', ')
        });
        setIsSubmitting(false);
        return;
      }
      // Construir el payload robusto para SIIGO
      const payload = buildSiigoPayload();
      const response = await fetch('/api/siigo/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        const siigoMsg = data?.details?.Message || data?.error || data?.message || 'Error desconocido';
        const missingFields = data?.missingFields ? `\nCampos faltantes: ${data.missingFields.join(', ')}` : '';
        toast.error('❌ Error al enviar la factura a Siigo', { description: siigoMsg + missingFields, duration: 8000 });
        setSubmitResult({ success: false, message: siigoMsg + missingFields });
        throw new Error(siigoMsg + missingFields);
      }
      toast.success('✅ Factura enviada correctamente a Siigo', {
        description: `Número de factura: ${data.number || data.data?.number || state.providerInvoiceNumber}`,
        duration: 5000,
      });
      setSubmitResult({ success: true, message: `Factura enviada correctamente. Número: ${data.number || data.data?.number || state.providerInvoiceNumber}` });
      dispatch({ type: 'RESET_FORM' });
      router.refresh();
    } catch (error) {
      let errorMessage = 'Error desconocido al enviar la factura';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast.error('❌ Error al enviar la factura', {
        description: errorMessage,
        duration: 6000,
      });
      setSubmitResult({ success: false, message: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }, [state, validateForm, buildSiigoPayload, router]);



  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {submitResult && (
        <Alert variant={submitResult.success ? 'default' : 'destructive'}>
          {submitResult.success ? (
            <CheckCircledIcon className="h-4 w-4" />
          ) : (
            <ExclamationTriangleIcon className="h-4 w-4" />
          )}
          <AlertTitle>
            {submitResult.success ? '¡Éxito!' : 'Error'}
          </AlertTitle>
          <AlertDescription>{submitResult.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Crear Nueva Factura</CardTitle>
            <CardDescription>
              Complete los detalles de la factura a continuación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Información General */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Autocomplete
                  label="Proveedor"
                  placeholder="Buscar proveedor..."
                  apiEndpoint="/api/proveedores"
                  value={state.provider?.nombre || ""}
                  onSelect={handleProviderSelect}
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-code">Código de Proveedor *</Label>
                <Input
                  id="provider-code"
                  value={state.provider?.codigo || state.provider?.identificacion || ''}
                  readOnly
                  className="bg-gray-100 cursor-not-allowed"
                  tabIndex={-1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider-invoice-prefix">Prefijo de Factura *</Label>
                <select
                  id="provider-invoice-prefix"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={state.providerInvoicePrefix || 'FC'}
                  onChange={(e) =>
                    dispatch({ 
                      type: 'UPDATE_FIELD', 
                      payload: { field: 'providerInvoicePrefix', value: e.target.value } 
                    })
                  }
                  required
                >
                  <option value="FC">FC - Factura de Compra</option>
                  <option value="ND">ND - Nota Débito</option>
                  <option value="DS">DS - Documento Soporte</option>
                  <option value="RP">RP - Recibo de Pago</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-center">Centro de Costo *</Label>
                <Input
                  id="cost-center"
                  type="text"
                  value={state.costCenter || '0'}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_FIELD',
                      payload: { field: 'costCenter', value: e.target.value }
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider-invoice-number">Número de Factura *</Label>
                <Input
                  id="provider-invoice-number"
                  placeholder="Número de la factura"
                  value={state.providerInvoiceNumber}
                  onChange={(e) =>
                    dispatch({ type: 'SET_PROVIDER_INVOICE_NUMBER', payload: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-date">Fecha de Factura *</Label>
                <Input
                  id="invoice-date"
                  type="date"
                  value={state.invoiceDate}
                  onChange={(e) => dispatch({
                    type: 'UPDATE_FIELD',
                    payload: { field: 'invoiceDate', value: e.target.value }
                  })}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Ítems de la Factura</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                disabled={isSubmitting}
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Ítem
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay ítems en la factura</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddItem}
                  className="mt-2"
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar primer ítem
                </Button>
              </div>
            ) : (
              state.items.map((item, index) => (
                <InvoiceItemForm
                  key={item.id}
                  item={item}
                  index={index}
                  isLastItem={index === state.items.length - 1}
                  onUpdate={(id: string, field: keyof InvoiceItem, value: string | number | boolean | { type?: string; value?: number } | undefined) => {
                    dispatch({
                      type: 'UPDATE_ITEM',
                      payload: { id, field, value }
                    })
                  }}
                  onRemove={(id) => dispatch({ type: 'REMOVE_ITEM', payload: id })}
                  ivaPercentage={state.ivaPercentage}
                  disabled={isSubmitting}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Totales */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">
                  ${calculateSubtotal(state.items).toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                </span>
              </div>
              <div className="flex justify-between">
                <span>IVA ({state.ivaPercentage}%):</span>
                <span className="font-medium">
                  ${calculateIVA(state.items, state.ivaPercentage).toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-green-600">
                  ${calculateTotal(state.items, state.ivaPercentage).toLocaleString("es-CO", { minimumFractionDigits: 2 })} COP
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Observaciones */}
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Observaciones adicionales (opcional)"
              value={state.observations}
              onChange={(e) => dispatch({
                type: 'UPDATE_FIELD',
                payload: { field: 'observations', value: e.target.value }
              })}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Botones */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => window.history.back()}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || state.items.length === 0}
          >
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Enviando a Siigo...' : 'Enviar Factura a Siigo'}
          </Button>
        </div>
      </form>
    </div>
  );
}