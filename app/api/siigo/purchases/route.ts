import { NextRequest, NextResponse } from "next/server";
import { obtenerTokenSiigo } from "../auth/route";

// Tipos corregidos según la documentación oficial de Siigo
interface SiigoDocument {
  id: number;
}

interface SiigoSupplier {
  identification: string;
  branch_office: number; // Siempre requerido según la doc
}

interface SiigoProviderInvoice {
  prefix: string;
  number: string;
  cufe?: string;
}

interface SiigoCurrency {
  code: string;
  exchange_rate: number;
}

// Tipos para impuestos según Siigo
interface SiigoTax {
  id: number; // Solo se envía el ID del impuesto
}

// Tipos para descuentos según Siigo
interface SiigoDiscount {
  percentage?: number;
  value?: number;
}

// Item según la estructura exacta de Siigo
interface SiigoItem {
  type: 'Product' | 'Service' | 'FixedAsset'; // Solo estos tipos están documentados
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount?: number; // Siigo espera un número, no un objeto
  taxes?: SiigoTax[];
}

interface SiigoPayment {
  id: number;
  value: number;
  due_date: string;
}

// Request body corregido
interface RequestBody {
  provider: {
    identificacion: string;
    nombre: string;
    tipo_documento: string;
    nombre_comercial: string;
    ciudad: string;
    direccion: string;
    telefono: string;
    correo_electronico: string;
    codigo?: string;
    branch_office?: number;
  };
  items: Array<{
    id: string;
    type: 'product' | 'activo' | 'contable';
    code: string;
    description: string;
    quantity: number;
    price: number;
    hasIVA?: boolean;
    discount?: {
      value?: number;
      percentage?: number;
    };
    warehouse?: string;
  }>;
  documentId: string;
  providerInvoiceNumber: string;
  providerInvoicePrefix?: string;
  cufe?: string;
  invoiceDate: string;
  ivaPercentage?: number;
  observations?: string;
  costCenter?: number;
  currency?: {
    code: string;
    exchange_rate: number;
  };
}

// Payload completo para Siigo
interface SiigoPurchaseRequest {
  document: SiigoDocument;
  date: string;
  supplier: SiigoSupplier;
  cost_center?: number;
  provider_invoice?: SiigoProviderInvoice;
  currency?: SiigoCurrency;
  observations?: string;
  discount_type?: 'Value' | 'Percentage';
  supplier_by_item?: boolean;
  tax_included?: boolean;
  items: SiigoItem[];
  payments: SiigoPayment[];
}

// Utilidades
function formatDate(date: string | Date): string {
  if (typeof date === 'string') {
    return date; // Ya está en formato YYYY-MM-DD
  }
  return date.toISOString().split('T')[0];
}

function mapItemTypeToSiigo(type: string): 'Product' | 'Service' | 'FixedAsset' {
  const typeMap: Record<string, 'Product' | 'Service' | 'FixedAsset'> = {
    'product': 'Product',
    'producto': 'Product',
    'service': 'Service',
    'servicio': 'Service',
    'activo': 'FixedAsset',
    'activos_fijos': 'FixedAsset',
    'fixed_asset': 'FixedAsset',
    // Nota: 'Account' no existe en la documentación oficial
    'contable': 'Product', // Mapear a Product por defecto
    'cuenta_contable': 'Product'
  };
  return typeMap[type.toLowerCase()] || 'Product';
}

function calculateItemSubtotal(item: RequestBody['items'][0]): number {
  const subtotal = item.quantity * item.price;
  const discountValue = item.discount?.value || 0;
  return subtotal - discountValue;
}

function calculateItemTax(item: RequestBody['items'][0], taxPercentage: number = 19): number {
  if (!item.hasIVA) return 0;
  const subtotal = calculateItemSubtotal(item);
  return subtotal * (taxPercentage / 100);
}

function calculateGrandTotal(items: RequestBody['items'], taxPercentage: number = 19): number {
  return items.reduce((total, item) => {
    const subtotal = calculateItemSubtotal(item);
    const tax = calculateItemTax(item, taxPercentage);
    return total + subtotal + tax;
  }, 0);
}

export async function POST(request: NextRequest) {
  try {
    console.log("[PURCHASES] Iniciando proceso de creación de compra");
    
    const body: RequestBody = await request.json();
    console.log("[PURCHASES] Datos recibidos:", {
      proveedor: body.provider?.identificacion,
      proveedorNombre: body.provider?.nombre,
      itemsCount: body.items?.length,
      factura: body.providerInvoicePrefix ? 
        `${body.providerInvoicePrefix}-${body.providerInvoiceNumber}` : 
        body.providerInvoiceNumber
    });

    // Validaciones básicas
    if (!body.provider?.identificacion) {
      console.error('[PURCHASES] Error: Proveedor no proporcionado');
      return NextResponse.json({
        error: "Datos de proveedor incompletos",
        details: "El campo 'provider.identificacion' es requerido"
      }, { status: 400 });
    }

    if (!body.items?.length) {
      console.error('[PURCHASES] Error: No se enviaron items');
      return NextResponse.json({
        error: "Datos de ítems incompletos",
        details: "Debe incluir al menos un ítem en la compra"
      }, { status: 400 });
    }

    if (!body.providerInvoiceNumber) {
      console.error('[PURCHASES] Error: Número de factura no proporcionado');
      return NextResponse.json({
        error: "Datos de factura incompletos", 
        details: "El número de factura es requerido"
      }, { status: 400 });
    }

    // Validar items
    const invalidItems = body.items.filter(item =>
      !item.code || !item.description || !item.quantity || item.price === undefined
    );

    if (invalidItems.length > 0) {
      console.error('[PURCHASES] Error: Ítems inválidos', invalidItems);
      return NextResponse.json({
        error: "Datos de ítems inválidos",
        details: `${invalidItems.length} ítems tienen datos incompletos`
      }, { status: 400 });
    }

    console.log("[PURCHASES] Validaciones completadas exitosamente");

    // Obtener credenciales
    const siigoToken = await obtenerTokenSiigo();
    const partnerId = process.env.SIIGO_PARTNER_ID;

    if (!siigoToken || !partnerId) {
      console.error('[PURCHASES] Error: Faltan credenciales de Siigo');
      return NextResponse.json({
        error: 'Error de autenticación',
        details: 'No se pudieron obtener las credenciales de Siigo'
      }, { status: 500 });
    }

    // Construir items según formato Siigo
    const siigoItems: SiigoItem[] = body.items.map(item => {
      const siigoItem: SiigoItem = {
        type: mapItemTypeToSiigo(item.type),
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        price: item.price
      };

      // Agregar descuento si existe (como número, no objeto)
      if (item.discount?.value && item.discount.value > 0) {
        siigoItem.discount = item.discount.value;
      }

      // Agregar impuestos solo si el item tiene IVA explícitamente marcado como true
      if (item.hasIVA === true) {
        siigoItem.taxes = [{ id: 13156 }]; // ID estándar para IVA 19% en Siigo
      }

      return siigoItem;
    });

    // Calcular total para el pago
    const total = calculateGrandTotal(body.items, body.ivaPercentage || 19);

    // Construir payload según documentación exacta de Siigo
    const siigoPayload: SiigoPurchaseRequest = {
      document: {
        id: parseInt(body.documentId) || 27524
      },
      date: formatDate(body.invoiceDate),
      supplier: {
        identification: body.provider.identificacion,
        branch_office: body.provider.branch_office || 0
      },
      items: siigoItems,
      payments: [
        {
          id: 5636,
          value: Math.round(total * 100) / 100,
          due_date: formatDate(body.invoiceDate)
        }
      ],
      cost_center: body.costCenter,
      provider_invoice: {
        prefix: body.providerInvoicePrefix || 'FC',
        number: body.providerInvoiceNumber,
        ...(body.cufe && { cufe: body.cufe })
      },
      currency: body.currency,
      observations: body.observations,
      discount_type: 'Value',
      supplier_by_item: false,
      tax_included: false
    };

    // Log del payload (sin información sensible)
    console.log('[PURCHASES] Payload para Siigo:', {
      document: siigoPayload.document,
      date: siigoPayload.date,
      supplier: { identification: siigoPayload.supplier.identification },
      itemsCount: siigoPayload.items.length,
      total: siigoPayload.payments[0].value
    });

    // Llamada a la API de Siigo
    const siigoResponse = await fetch('https://api.siigo.com/v1/purchases', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${siigoToken}`,
        'Partner-Id': partnerId
      },
      body: JSON.stringify(siigoPayload)
    });

    const responseText = await siigoResponse.text();
    let responseData;

    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error('[PURCHASES] Error al parsear respuesta JSON:', e);
      return NextResponse.json({
        error: 'Error en la respuesta de Siigo',
        details: 'No se pudo parsear la respuesta del servidor',
        raw: responseText.substring(0, 500)
      }, { status: 500 });
    }

    console.log(`[PURCHASES] Respuesta de Siigo: ${siigoResponse.status} ${siigoResponse.statusText}`);

    if (!siigoResponse.ok) {
      console.error('[PURCHASES] Error en respuesta de Siigo:', {
        status: siigoResponse.status,
        error: responseData
      });

      return NextResponse.json({
        error: 'Error al procesar la factura en Siigo',
        message: responseData.message || responseData.error || 'Error desconocido',
        details: responseData,
        status: siigoResponse.status
      }, { status: siigoResponse.status });
    }

    // Éxito
    console.log('[PURCHASES] Factura creada exitosamente:', {
      id: responseData.id,
      number: responseData.number,
      total: responseData.total
    });

    return NextResponse.json({
      success: true,
      message: `Factura creada exitosamente`,
      data: {
        id: responseData.id,
        number: responseData.number,
        total: responseData.total,
        date: responseData.date,
        name: responseData.name,
        balance: responseData.balance
      }
    });

  } catch (error) {
    console.error("[PURCHASES] Error general:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    
    return NextResponse.json({
      error: "Error interno del servidor",
      message: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}