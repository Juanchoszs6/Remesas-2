import { ApiResponse } from './common';

type Primitive = string | number | boolean | null | undefined;
type QueryValue = Primitive | Primitive[] | { [key: string]: QueryValue };

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  [key: string]: QueryValue | undefined;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

type ErrorResponseData = {
  statusCode: number;
  message: string;
  error?: string;
  timestamp?: string;
  path?: string;
  [key: string]: unknown;
};

export interface ErrorResponse extends ErrorResponseData {}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, QueryValue>;
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  headers?: Record<string, string>;
  timeout?: number;
  retry?: number;
  retryDelay?: number;
}

export interface ApiClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
  transformRequest?: <T>(data: T, headers: Headers) => unknown;
  transformResponse?: <T>(data: T) => unknown;
  onRequest?: (config: RequestOptions) => void;
  onResponse?: (response: Response) => void;
  onError?: (error: ErrorResponse) => void;
}

export interface UploadOptions {
  file: File;
  url: string;
  fieldName?: string;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: <T = unknown>(response: T) => void;
  headers?: Record<string, string>;
  data?: Record<string, unknown>;
  withCredentials?: boolean;
}

export interface DownloadOptions {
  url: string;
  filename?: string;
  headers?: Record<string, string>;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: (blob: Blob) => void;
}

export interface ApiClient {
  get<T = unknown>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  post<T = unknown, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<ApiResponse<T>>;
  put<T = unknown, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<ApiResponse<T>>;
  patch<T = unknown, D = unknown>(url: string, data?: D, options?: RequestOptions): Promise<ApiResponse<T>>;
  delete<T = unknown>(url: string, options?: RequestOptions): Promise<ApiResponse<T>>;
  upload<T = unknown>(options: UploadOptions): Promise<ApiResponse<T>>;
  download(options: DownloadOptions): Promise<void>;
  setHeader(key: string, value: string): void;
  removeHeader(key: string): void;
  setBaseURL(url: string): void;
  getBaseURL(): string;
  create(options?: ApiClientOptions): ApiClient;
}

// Common response types
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ErrorDetail {
  code: string;
  message: string;
  field?: string;
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

export interface ValidationError {
  message: string;
  errors: ErrorDetail[];
  statusCode: number;
  timestamp: string;
  path: string;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface RequestConfig extends Omit<RequestInit, 'body'> {
  params?: QueryParams;
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  timeout?: number;
  signal?: AbortSignal;
  onUploadProgress?: (progress: number) => void;
  onDownloadProgress?: (progress: number) => void;
}

export interface ResponseWrapper<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: RequestConfig;
  request?: Request | XMLHttpRequest;
}

export interface ApiError extends Error {
  config: RequestConfig;
  code?: string;
  request?: Request | XMLHttpRequest;
  response?: ResponseWrapper<ErrorResponse>;
  isApiError: boolean;
  status?: number;
}

export const isApiError = (error: unknown): error is ApiError => {
  return error !== null && 
         typeof error === 'object' && 
         'isApiError' in error && 
         error.isApiError === true;
};
