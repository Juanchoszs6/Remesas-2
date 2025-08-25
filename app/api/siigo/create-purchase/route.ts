import { NextResponse } from "next/server";
import { crearCompraSiigo } from "@/lib/siigo/purchaseApi";
import { obtenerTokenSiigo, SiigoAuthError } from "@/lib/siigo/auth";

interface ErrorResponse {
  error: string;
  details?: unknown;
  status: number;
}

export async function POST(request: Request) {
  try {
    // Obtener el token de autenticación de Siigo
    const token = await obtenerTokenSiigo();
    const partnerId = process.env.SIIGO_PARTNER_ID || "";

    if (!token) {
      console.error("Error: No se pudo obtener el token de autenticación de Siigo");
      return NextResponse.json(
        { error: "No se pudo autenticar con el servicio de Siigo. Verifica usuario, clave y partner ID en el .env" },
        { status: 401 }
      );
    }

    // Validar que el partnerId esté configurado
    if (!partnerId) {
      console.error("Error: No se encontró el Partner ID de Siigo");
      return NextResponse.json(
        { error: "Configuración incompleta del servicio" },
        { status: 500 }
      );
    }

    // Obtener los datos del cuerpo de la solicitud
    const datosFactura = await request.json();
    
    // Validar que los datos requeridos estén presentes
    if (!datosFactura) {
      return NextResponse.json(
        { error: "No se proporcionaron datos de la factura" },
        { status: 400 }
      );
    }

    // Registrar los datos recibidos para depuración
    console.log("Datos de factura recibidos:", JSON.stringify(datosFactura, null, 2));

    // Enviar la factura a Siigo
    const resultado = await crearCompraSiigo(token, partnerId, datosFactura);
    
    // Registrar la respuesta exitosa
    console.log("Factura enviada exitosamente a Siigo:", resultado);
    
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    
    if (error instanceof SiigoAuthError) {
      return NextResponse.json(
        { 
          error: "Error de autenticación con Siigo",
          details: error.message,
          status: 401
        } as ErrorResponse,
        { status: 401 }
      );
    }
    
    if (error instanceof Error) {
      const status = 'status' in error && typeof error.status === 'number' 
        ? error.status as number 
        : 500;
      
      return NextResponse.json(
        { 
          error: "Error al procesar la solicitud",
          details: error.message,
          status
        } as ErrorResponse,
        { status }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Error interno del servidor al procesar la solicitud",
        status: 500
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
