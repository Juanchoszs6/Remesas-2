import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Buscar por código o nombre con paginación para mejorar rendimiento
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let sqlQuery = '';
  let countQuery = '';
  let values: (string | number)[] = [];
  let countValues: string[] = [];

  if (!query || query.trim() === '') {
    // Sin parámetro de búsqueda → devolver todas las cuentas contables con paginación
    sqlQuery = `
      SELECT id_contable as codigo, nombre_contable as nombre 
      FROM contables 
      ORDER BY id_contable
      LIMIT $1 OFFSET $2
    `;
    values = [limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM contables`;
    countValues = [];
  } else if (/^\d/.test(query)) {
    // Buscar por código con paginación (búsqueda parcial mejorada)
    sqlQuery = `
      SELECT id_contable as codigo, nombre_contable as nombre 
      FROM contables 
      WHERE id_contable::text ILIKE $1
      ORDER BY id_contable
      LIMIT $2 OFFSET $3
    `;
    values = [`%${query}%`, limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM contables WHERE id_contable::text ILIKE $1`;
    countValues = [`%${query}%`];
  } else {
    // Buscar por nombre con paginación (búsqueda parcial mejorada)
    sqlQuery = `
      SELECT id_contable as codigo, nombre_contable as nombre 
      FROM contables 
      WHERE nombre_contable ILIKE $1
      ORDER BY nombre_contable
      LIMIT $2 OFFSET $3
    `;
    values = [`%${query}%`, limit, offset];
    
    countQuery = `SELECT COUNT(*) as total FROM contables WHERE nombre_contable ILIKE $1`;
    countValues = [`%${query}%`];
  }

  try {
    // Ejecutar ambas consultas en paralelo para obtener datos y total
    const [result, countResult] = await Promise.all([
      pool.query(sqlQuery, values),
      pool.query(countQuery, countValues)
    ]);
    
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);
    
    console.log(`[CONTABLES API] Query: "${query}" - Página: ${page}/${totalPages} - Resultados: ${result.rows.length}/${total}`);
    
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
    console.error('Error al consultar cuentas contables:', error);
    return NextResponse.json({ error: 'Error al consultar cuentas contables' }, { status: 500 });
  }
}
