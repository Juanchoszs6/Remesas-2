// Define the expected response type for the API call
interface SiigoApiResponse {
  id: string;
  number: string;
  date?: string;
  status?: string;
  [key: string]: string | number | boolean | object | null | undefined;
}


interface ImpuestoSiigo {
  id: number;
}

interface ItemSiigo {
  code: string;
  description: string;
  quantity: number;
  price: number;
  tax: ImpuestoSiigo[];
  type: string;
}

interface PagoSiigo {
  id: number;
  value: number;
  due_date: string;
}

interface DatosCompraSiigo {
  document: {
    id: number;
  };
  date: string;
  supplier: {
    identification: string;
  };
  cost_center: number;
  invoice_prefix: string;
  invoice_number: string;
  provider_invoice: string;
  currency: {
    code: string;
  };
  exchange_rate: number;
  observations?: string;
  items: ItemSiigo[];
  payments: PagoSiigo[];
  discount_type: string;
  supplier_by_item: boolean;
  tax_included: boolean;
}

export async function crearCompraSiigo(
  token: string,
  partnerId: string,
  datosCompra: {
    document_id: number;
    fecha: string;
    proveedor_nit: string;
    centro_costo_id: number;
    prefijo_factura_proveedor: string;
    numero_factura_proveedor: string;
    codigo_moneda: string;
    tasa_cambio: number;
    observaciones?: string;
    items: Array<{
      tipo: string;
      codigo: string;
      descripcion: string;
      cantidad: number;
      precio: number;
      impuestos_id: number[];
    }>;
    pagos: Array<{
      id: number;
      valor: number;
      fecha_vencimiento: string;
    }>;
  }
): Promise<SiigoApiResponse> {
  const datosParaEnviar: DatosCompraSiigo = {
    document: {
      id: datosCompra.document_id,
    },
    date: datosCompra.fecha,
    supplier: {
      identification: datosCompra.proveedor_nit,
    },
    cost_center: datosCompra.centro_costo_id,
    invoice_prefix: datosCompra.prefijo_factura_proveedor,
    invoice_number: datosCompra.numero_factura_proveedor,
      provider_invoice: datosCompra.numero_factura_proveedor,
    currency: {
      code: datosCompra.codigo_moneda,
    },
    exchange_rate: datosCompra.tasa_cambio,
    observations: datosCompra.observaciones,
    items: datosCompra.items.map((item) => ({
      code: item.codigo,
      description: item.descripcion,
      quantity: item.cantidad,
      price: item.precio,
      tax: item.impuestos_id.map((impuestoId) => ({ id: impuestoId })),
      type:
        item.tipo === "product" ? "Product" :
        item.tipo === "fixed_asset" ? "FixedAsset" :
        item.tipo === "account" ? "Account" : item.tipo,
    })),
    payments: datosCompra.pagos.map((pago) => ({
      id: pago.id,
      value: pago.valor,
      due_date: pago.fecha_vencimiento,
    })),
    discount_type: "Value",
    supplier_by_item: false,
    tax_included: false,
  };

  const apiUrl = "https://api.siigo.com/v1/purchases";
  
  try {
    // Log the payload to send to the API
    console.log("Enviando datos a Siigo:", JSON.stringify(datosParaEnviar, null, 2));

    // Send the request to the API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Partner-Id': partnerId,
      },
      body: JSON.stringify(datosParaEnviar as unknown as Record<string, unknown>)
    });

    // Get the response data
    const responseData = await response.json();

    // Check if the response was successful
    if (!response.ok) {
      // Get the error data
      const errorData: { message?: string; [key: string]: unknown } = await response.json().catch(() => ({}));

      // Log the error
      console.error('Error en la respuesta de Siigo:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      // Throw an error
      throw new Error(`Error al crear la compra: ${errorData.message || response.statusText}`);
    }

    // Return the response data
    return responseData;
  } catch (error) {
    // Log the error
    console.error("Error en la petición a la API de Siigo:", error);

    // Throw the error
    throw error;
  }
}
