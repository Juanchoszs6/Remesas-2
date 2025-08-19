import bcrypt from 'bcryptjs';
import { sql, User, Session } from './db';
import { cookies } from 'next/headers';

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Generate session token
export function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Create user
export async function createUser(email: string, password: string): Promise<User> {
  try {
    const hashedPassword = await hashPassword(password);
    
    const result = await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${hashedPassword})
      RETURNING id, email, password_hash, created_at, updated_at
    `;
    
    return result[0] as User;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

// Find user by email
export async function findUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await sql`
      SELECT id, email, password_hash, created_at, updated_at
      FROM users
      WHERE email = ${email}
    `;
    
    return result.length > 0 ? result[0] as User : null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
}

// Create session
export async function createSession(userId: number): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await sql`
    INSERT INTO sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt})
  `;
  
  return token;
}

// Find session by token
export async function findSessionByToken(token: string): Promise<(Session & { user: User }) | null> {
  const result = await sql`
    SELECT 
      s.id, s.user_id, s.token, s.expires_at, s.created_at,
      u.id as user_id, u.email, u.password_hash, u.created_at as user_created_at, u.updated_at as user_updated_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > NOW()
  `;
  
  if (!result[0]) return null;
  
  const row = result[0];
  return {
    id: row.id,
    user_id: row.user_id,
    token: row.token,
    expires_at: row.expires_at,
    created_at: row.created_at,
    user: {
      id: row.user_id,
      email: row.email,
      password_hash: row.password_hash,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at
    }
  };
}

// Delete session
export async function deleteSession(token: string): Promise<void> {
  await sql`
    DELETE FROM sessions
    WHERE token = ${token}
  `;
}

// Get current user from cookies
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session_token')?.value;
  
  if (!token) return null;
  
  const session = await findSessionByToken(token);
  return session?.user || null;
}

// Set session cookie
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/'
  });
}

// Clear session cookie
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('session_token');
}
