import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    // Consultar todos los activos de la tabla 'activos' con solo código y nombre
    const result = await pool.query(
      'SELECT codigo, nombre FROM activos ORDER BY codigo'
    );
    
    // Devolver los datos directamente sin campos adicionales
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al consultar activos:', error);
    return NextResponse.json(
      { error: 'Error al consultar activos' }, 
      { status: 500 }
    );
  }
}
    