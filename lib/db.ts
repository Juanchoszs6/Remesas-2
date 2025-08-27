import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined');
}

const sql = neon(process.env.DATABASE_URL);

export interface User {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface UploadedFile {
  id: number;
  file_name: string;
  document_type: string;
  month: number;
  year: number;
  total_value: number;
  processed_rows: number;
  uploaded_at: string;
  user_id: number;
}

export async function getUploadedFiles(userId: number, documentType?: string): Promise<UploadedFile[]> {
  if (documentType) {
    const result = await sql`
      SELECT * FROM uploaded_files 
      WHERE user_id = ${userId} AND document_type = ${documentType}
      ORDER BY year DESC, month DESC
    `;
    return result as UploadedFile[];
  }
  const result = await sql`
    SELECT * FROM uploaded_files 
    WHERE user_id = ${userId}
    ORDER BY year DESC, month DESC, document_type
  `;
  return result as UploadedFile[];
}

export async function checkFileExists(
  userId: number, 
  documentType: string, 
  month: number, 
  year: number
): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM uploaded_files 
    WHERE user_id = ${userId} 
      AND document_type = ${documentType}
      AND month = ${month}
      AND year = ${year}
    LIMIT 1
  `;
  return Array.isArray(result) && result.length > 0;
}

export async function saveUploadedFile(
  userId: number, 
  fileName: string, 
  documentType: string, 
  month: number, 
  year: number, 
  totalValue: number,
  processedRows: number
): Promise<UploadedFile> {
  const result = await sql`
    INSERT INTO uploaded_files 
      (user_id, file_name, document_type, month, year, total_value, processed_rows, uploaded_at)
    VALUES 
      (${userId}, ${fileName}, ${documentType}, ${month}, ${year}, ${totalValue}, ${processedRows}, NOW())
    RETURNING *
  `;
  return (result as UploadedFile[])[0];
}

export { sql };