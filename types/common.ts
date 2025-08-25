// Common types used across the application

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface FormError {
  field: string;
  message: string;
}

export interface FormState<T = Record<string, unknown>> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FileUploadResponse {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export type Nullable<T> = T | null | undefined;

export type Maybe<T> = T | null | undefined;

export type Dictionary<T> = Record<string, T>;
