import { InvoiceItem } from "@/types/siigo";

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
): Promise<any> {
  const url = "https://api.siigo.com/v1/purchases";

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

  try {
    console.log("Enviando datos a Siigo:", JSON.stringify(datosParaEnviar, null, 2));
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Partner-Id": partnerId,
      },
      body: JSON.stringify(datosParaEnviar),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("Error en la respuesta de Siigo (detalle completo):", JSON.stringify(responseData, null, 2));
      // Propagar el error completo al frontend para depuración
      throw { siigo: responseData, status: response.status };
    }

    return responseData;
  } catch (error) {
    console.error("Error en la petición a la API de Siigo:", error);
    throw error;
  }
}
