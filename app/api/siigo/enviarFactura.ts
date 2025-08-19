import type { FormData, SiigoResponse } from "../../../types/siigo"

// Función principal para enviar factura a Siigo usando API routes
export async function enviarFacturaASiigo(datosFormulario: FormData): Promise<SiigoResponse> {
  try {
    console.log('🚀 Iniciando envío de factura a Siigo...');
    
    // Enviar datos a nuestra API route que maneja todo el proceso
    const response = await fetch('/api/siigo/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(datosFormulario)
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('❌ Error en la respuesta:', responseData);
      return {
        success: false,
        error: responseData.error || 'Error desconocido',
        message: responseData.message || 'Error al enviar la factura a Siigo'
      };
    }
    
    console.log('✅ Factura enviada exitosamente:', responseData);
    
    return {
      success: true,
      data: responseData.data,
      message: responseData.message || 'Factura enviada exitosamente a Siigo'
    };
    
  } catch (error) {
    console.error('💥 Error al enviar factura:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      message: 'Error al enviar la factura a Siigo'
    };
  }
}

// Función de prueba con datos de ejemplo
export async function pruebaEnvioFactura(): Promise<SiigoResponse> {
  const datosEjemplo: FormData = {
    selectedProvider: {
      codigo: 'PROV001',
      nombre: 'Proveedor de Prueba',
      identification: '12345678',
      name: 'Proveedor de Prueba'
    },
    items: [
      {
        id: '1',
        type: 'product',
        code: 'PROD001',
        description: 'Producto de prueba',
        quantity: 2,
        price: 50000,
        warehouse: '',
        hasIVA: true
      }
    ],
    sedeEnvio: 'Bodega Principal',
    hasIVA: true,
    ivaPercentage: 19,
    observations: 'Factura de prueba desde API'
  };
  
  console.log('🧪 Ejecutando prueba de envío de factura...');
  const resultado = await enviarFacturaASiigo(datosEjemplo);
  console.log('📊 Resultado de la prueba:', resultado);
  
  return resultado;
}

// Función para obtener token (solo para testing desde el cliente)
export async function obtenerToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/siigo/auth', {
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
