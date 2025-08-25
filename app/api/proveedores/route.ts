// app/api/proveedores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let sqlQuery = '';
  let countQuery = '';
  let values: (string | number)[] = [];
  let countValues: (string | number)[] = [];

  if (query.trim() === '') {
    // Sin parámetro de búsqueda → devolver proveedores con paginación
    sqlQuery = `
      SELECT codigo, nombre, identification 
      FROM proveedores 
      ORDER BY nombre
      LIMIT $1 OFFSET $2
    `;
    values = [limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM proveedores`;
    countValues = [];
  } else if (/^\d/.test(query)) {
    // Empieza con número → buscar por código o identificación con paginación
    sqlQuery = `
      SELECT codigo, nombre, identification 
      FROM proveedores 
      WHERE codigo ILIKE $1 OR identification ILIKE $1
      ORDER BY codigo
      LIMIT $2 OFFSET $3
    `;
    values = [`%${query}%`, limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM proveedores WHERE codigo ILIKE $1 OR identification ILIKE $1`;
    countValues = [`%${query}%`];
  } else {
    // Empieza con letra → buscar por nombre con paginación
    sqlQuery = `
      SELECT codigo, nombre, identification 
      FROM proveedores 
      WHERE nombre ILIKE $1
      ORDER BY nombre
      LIMIT $2 OFFSET $3
    `;
    values = [`%${query}%`, limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM proveedores WHERE nombre ILIKE $1`;
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
    
    console.log(`[PROVEEDORES API] Query: "${query}" - Página: ${page}/${totalPages} - Resultados: ${result.rows.length}/${total}`);
    
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
    console.error('Error al consultar proveedores:', error);
    return new NextResponse('Error al consultar proveedores', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { codigo, nombre } = data;

    if (!codigo || !nombre) {
      return new NextResponse('Código y nombre son requeridos', { status: 400 });
    }

    const result = await pool.query(
      'INSERT INTO proveedores (codigo, nombre) VALUES ($1, $2) RETURNING *',
      [codigo, nombre]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    return new NextResponse('Error al crear proveedor', { status: 500 });
  }
}