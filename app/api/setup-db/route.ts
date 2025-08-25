import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST() {
  try {
    console.log('Setting up database tables...');
    
    // Drop existing tables if they exist (to ensure clean setup)
    await sql`DROP TABLE IF EXISTS sessions CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    
    // Create users table
    await sql`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create sessions table
    await sql`
      CREATE TABLE sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    // Create indexes for better performance
    await sql`CREATE INDEX idx_users_email ON users(email)`;
    await sql`CREATE INDEX idx_sessions_token ON sessions(token)`;
    await sql`CREATE INDEX idx_sessions_user_id ON sessions(user_id)`;
    await sql`CREATE INDEX idx_sessions_expires_at ON sessions(expires_at)`;
    
    // Verify tables were created
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'sessions')
      ORDER BY table_name
    `;
    
    console.log('Tables created successfully:', tablesResult);
    
    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully!',
      tables: tablesResult,
      tablesCount: tablesResult.length
    });
    
  } catch (error: unknown) {
    console.error('Database setup error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    const errorDetails = error && typeof error === 'object' ? {
      code: 'code' in error ? error.code : undefined,
      severity: 'severity' in error ? error.severity : undefined,
      detail: 'detail' in error ? error.detail : undefined,
      hint: 'hint' in error ? error.hint : undefined
    } : {};
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: errorDetails
    }, { status: 500 });
  }
}
