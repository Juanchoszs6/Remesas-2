// app/api/productos-lista/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  let sqlQuery = '';
  let values: string[] = [];

  if (!query || query.trim() === '') {
    // Sin parámetro de búsqueda → devolver TODOS los productos
    sqlQuery = `
      SELECT codigo, nombre 
      FROM productos_ 
      ORDER BY codigo
    `;
    values = [];
  } else if (/^\d/.test(query)) {
    // Empieza con número → buscar por código (SIN LÍMITE)
    sqlQuery = `
      SELECT codigo, nombre 
      FROM productos_ 
      WHERE codigo ILIKE $1
      ORDER BY codigo
    `;
    values = [`${query}%`];
  } else {
    // Empieza con letra → buscar por nombre (SIN LÍMITE)
    sqlQuery = `
      SELECT codigo, nombre 
      FROM productos_ 
      WHERE nombre ILIKE $1
      ORDER BY nombre
    `;
    values = [`${query}%`];
  }

  try {
    const result = await pool.query(sqlQuery, values);
    console.log(`[PRODUCTOS-LISTA API] Query: "${query || 'ALL'}" - Resultados: ${result.rows.length}`);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error al consultar productos:', error);
    return NextResponse.json({ error: 'Error al consultar productos' }, { status: 500 });
  }
}