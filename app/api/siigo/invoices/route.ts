import { NextRequest, NextResponse } from 'next/server';
import type { 
  FormData, 
  SiigoInvoiceRequest, 
  SiigoInvoiceItemRequest, 
  SiigoAuthResponse,
  InvoiceItem,
  SiigoPurchaseRequest,
  SiigoExpenseRequest
} from '../../../../types/siigo';

// Función para obtener token desde nuestra API
async function obtenerToken(): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/siigo/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('❌ Error al obtener token:', response.status);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('💥 Error en obtenerToken:', error);
    return null;
  }
}

// Función para validar datos del formulario
function validarDatosFormulario(datosFormulario: FormData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validaciones obligatorias
  if (!datosFormulario.selectedProvider?.identification) {
    errors.push('El proveedor es obligatorio');
  }

  if (!datosFormulario.items || datosFormulario.items.length === 0) {
    errors.push('Debe incluir al menos un item');
  }

  // Validar items
  datosFormulario.items?.forEach((item, index) => {
    if (!item.description?.trim()) {
      errors.push(`Item ${index + 1}: La descripción es obligatoria`);
    }
    if (!item.quantity || item.quantity <= 0) {
      errors.push(`Item ${index + 1}: La cantidad debe ser mayor a 0`);
    }
    if (!item.price || item.price <= 0) {
      errors.push(`Item ${index + 1}: El precio debe ser mayor a 0`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

// Función para mapear datos de factura de compra (Purchase Invoice)
function mapearFacturaCompra(datosFormulario: FormData): SiigoPurchaseRequest {
  const fechaFactura = datosFormulario.invoiceDate || new Date().toISOString().split('T')[0];
  
  // Mapear items con estructura correcta para SIIGO
  const items: SiigoInvoiceItemRequest[] = datosFormulario.items.map((item: InvoiceItem) => {
    const basePrice = item.price || 0;
    const quantity = item.quantity || 1;
    const subtotal = basePrice * quantity;
    
    return {
      code: item.code || 'ITEM001',
      description: item.description?.trim() || 'Producto/Servicio',
      quantity: quantity,
      price: basePrice,
      discount: 0, // Sin descuento por defecto
      taxes: item.hasIVA ? [
        {
          id: 13156, // ID estándar de IVA 19% en SIIGO
          value: Math.round(subtotal * 0.19 * 100) / 100
        }
      ] : []
    };
  });

  // Calcular totales
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalTaxes = items.reduce((sum, item) => {
    return sum + (item.taxes?.reduce((taxSum, tax) => taxSum + (tax.value || 0), 0) || 0);
  }, 0);
  const total = subtotal + totalTaxes;

  return {
    document: {
      id: 25 // Factura de Compra en SIIGO
    },
    date: fechaFactura,
    supplier: {
      identification: datosFormulario.selectedProvider?.identification || '',
      branch_office: 0
    },
    number: datosFormulario.providerInvoiceNumber ? 
      parseInt(datosFormulario.providerInvoiceNumber) : undefined,
    cost_center: datosFormulario.costCenter ? 
      parseInt(datosFormulario.costCenter) : undefined,
    observations: datosFormulario.observations?.trim() || 'Factura de compra generada desde formulario web',
    items: items,
    payments: [
      {
        id: 8468, // Método de pago configurado
        value: Math.round(total * 100) / 100,
        due_date: fechaFactura // Fecha de vencimiento igual a fecha de factura
      }
    ],
    additional_fields: {
      warehouse: datosFormulario.sedeEnvio || '1',
      prefix: datosFormulario.providerInvoicePrefix || ''
    }
  };
}

// Función para mapear datos de gasto (Expense)
function mapearGasto(datosFormulario: FormData): SiigoExpenseRequest {
  const fechaGasto = datosFormulario.invoiceDate || new Date().toISOString().split('T')[0];
  
  // Para gastos, tomamos el primer item como referencia
  const primerItem = datosFormulario.items[0];
  const montoTotal = primerItem.price * primerItem.quantity;
  const montoIVA = primerItem.hasIVA ? montoTotal * 0.19 : 0;
  const total = montoTotal + montoIVA;

  return {
    document: {
      id: 28 // Comprobante de Egreso en SIIGO
    },
    date: fechaGasto,
    supplier: {
      identification: datosFormulario.selectedProvider?.identification || '',
      branch_office: 0
    },
    category: 'office_expenses', // Categoría por defecto
    description: primerItem.description?.trim() || 'Gasto registrado desde formulario web',
    amount: Math.round(montoTotal * 100) / 100,
    tax_included: primerItem.hasIVA || false,
    cost_center: datosFormulario.costCenter ? 
      parseInt(datosFormulario.costCenter) : undefined,
    observations: datosFormulario.observations?.trim() || '',
    payment: {
      id: 8468,
      value: Math.round(total * 100) / 100,
      due_date: fechaGasto
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando envío de factura a Siigo...');
    
    // Obtener datos del formulario desde el body de la petición
    const datosFormulario: FormData = await request.json();
    
    // 1. Validar datos del formulario
    const validacion = validarDatosFormulario(datosFormulario);
    if (!validacion.valid) {
      console.error('❌ Errores de validación:', validacion.errors);
      return NextResponse.json(
        { 
          error: 'Datos del formulario inválidos',
          details: validacion.errors 
        },
        { status: 400 }
      );
    }
    
    // 2. Obtener token de autenticación
    const token = await obtenerToken();
    if (!token) {
      return NextResponse.json(
        { error: 'No se pudo obtener el token de autenticación' },
        { status: 500 }
      );
    }
    
    // 3. Determinar tipo de documento y mapear datos
    let facturaData: SiigoPurchaseRequest | SiigoExpenseRequest;
    let endpoint: string;
    
    // Detectar si es gasto (un solo item con descripción de gasto) o factura de compra
    const esGasto = datosFormulario.items.length === 1 && 
                   (datosFormulario.items[0].description?.toLowerCase().includes('gasto') ||
                    datosFormulario.items[0].type === 'service');
    
    if (esGasto) {
      console.log('📄 Procesando como gasto/egreso...');
      facturaData = mapearGasto(datosFormulario);
      endpoint = 'https://api.siigo.com/v1/vouchers'; // Endpoint para gastos
    } else {
      console.log('📄 Procesando como factura de compra...');
      facturaData = mapearFacturaCompra(datosFormulario);
      endpoint = 'https://api.siigo.com/v1/purchases'; // Endpoint para facturas de compra
    }
    
    console.log('📋 Datos mapeados:', JSON.stringify(facturaData, null, 2));
    
    // 4. Enviar a SIIGO API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Partner-Id': process.env.SIIGO_PARTNER_ID || 'siigo-invoice-form'
      },
      body: JSON.stringify(facturaData)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error en la respuesta de Siigo:', {
        status: response.status,
        statusText: response.statusText,
        data: responseData
      });
      
      // Manejo específico de errores comunes
      let errorMessage = 'Error al enviar a SIIGO';
      if (response.status === 401) {
        errorMessage = 'Token de autenticación inválido o expirado';
      } else if (response.status === 422) {
        errorMessage = 'Datos inválidos según SIIGO';
      } else if (response.status === 403) {
        errorMessage = 'Sin permisos para esta operación en SIIGO';
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          details: responseData,
          status: response.status
        },
        { status: response.status }
      );
    }
    
    console.log('✅ Documento enviado exitosamente a SIIGO:', responseData);
    
    // 5. Guardar en base de datos local para analytics (opcional)
    try {
      // TODO: Implementar guardado en BD local para analytics
      console.log('💾 Guardando registro para analytics...');
    } catch (dbError) {
      console.warn('⚠️ Error al guardar en BD local:', dbError);
      // No fallar si no se puede guardar localmente
    }
    
    return NextResponse.json({
      success: true,
      data: responseData,
      message: `${esGasto ? 'Gasto' : 'Factura de compra'} enviado exitosamente a SIIGO`,
      type: esGasto ? 'expense' : 'purchase'
    });
    
  } catch (error) {
    console.error('💥 Error crítico al procesar solicitud:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        message: 'Error crítico al procesar la solicitud'
      },
      { status: 500 }
    );
  }
}
