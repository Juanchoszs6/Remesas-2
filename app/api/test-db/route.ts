import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await sql`SELECT NOW() as current_time`;
    console.log('Database connection successful:', result);
    
    // Check if tables exist
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'sessions')
    `;
    
    console.log('Tables found:', tablesResult);
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      currentTime: result[0],
      tables: tablesResult,
      tablesCount: tablesResult.length
    });
    
  } catch (error: any) {
    console.error('Database connection error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        code: error.code,
        severity: error.severity,
        detail: error.detail
      }
    }, { status: 500 });
  }
}
