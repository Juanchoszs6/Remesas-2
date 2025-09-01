// app/api/productos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let sqlQuery = '';
  let countQuery = '';
  let values: (string | number)[] = [];
  let countValues: string[] = [];

  if (!query || query.trim() === '') {
    // Sin parámetro de búsqueda → devolver productos con paginación
    sqlQuery = ` +
      SELECT codigo, nombre, precio_base, tiene_iva 
      FROM productos_ 
      ORDER BY codigo
      LIMIT $1 OFFSET $2
    `;
    values = [limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM productos_`;
    countValues = [];
  } else if (/^\d/.test(query)) {
    // Empieza con número → buscar por código con paginación
    sqlQuery = `
      SELECT codigo, nombre, precio_base, tiene_iva 
      FROM productos_ 
      WHERE codigo ILIKE $1
      ORDER BY codigo
      LIMIT $2 OFFSET $3
    `;
    values = [`%${query}%`, limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM productos_ WHERE codigo ILIKE $1`;
    countValues = [`%${query}%`];
  } else {
    // Empieza con letra → buscar por nombre con paginación
    sqlQuery = `
      SELECT codigo, nombre, precio_base, tiene_iva 
      FROM productos_ 
      WHERE nombre ILIKE $1
      ORDER BY nombre
      LIMIT $2 OFFSET $3
    `;
    values = [`%${query}%`, limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM productos_ WHERE nombre ILIKE $1`;
    countValues = [`%${query}%`];
  }

  try {
    // Ejecutar ambas consultas en paralelo
    const [result, countResult] = await Promise.all([
      pool.query(sqlQuery, values),
      pool.query(countQuery, countValues)
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    console.log(`[PRODUCTOS API] Query: "${query}" - Página: ${page}/${totalPages} - Resultados: ${result.rows.length}/${total}`);
    
    return NextResponse.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error al consultar productos:', error);
    return NextResponse.json({ error: 'Error al consultar productos' }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { codigo, nombre, precio_base, tiene_iva } = data;

    if (!codigo || !nombre) {
      return NextResponse.json({ error: 'Código y nombre son requeridos' }, { status: 400 });
    }

    const result = await pool.query(
      'INSERT INTO productos_ (codigo, nombre, precio_base, tiene_iva) VALUES ($1, $2, $3, $4) RETURNING *',
      [codigo, nombre, precio_base, tiene_iva]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al insertar producto:', error);
    return NextResponse.json({ error: 'Error al insertar producto' }, { status: 500 });
  }
}