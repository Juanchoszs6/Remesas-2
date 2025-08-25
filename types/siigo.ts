// /types/siigo.ts - Tipos actualizados según documentación oficial

// Tipos para el formulario interno
export interface InvoiceItem {
  id: string;
  type: 'product' | 'activo' | 'contable';
  code: string;
  description: string;
  quantity: number;
  price: number;
  warehouse?: string;
  hasIVA?: boolean;
  discount?: {
    value?: number;
    percentage?: number;
  };
}

// Tipos según la documentación oficial de Siigo
export interface SiigoDocument {
  id: number;
}

export interface SiigoSupplier {
  identification: string;
  branch_office: number;
}

export interface SiigoProviderInvoice {
  prefix: string;
  number: string;
}

export interface SiigoCurrency {
  code: string;
  exchange_rate: number;
}

export interface SiigoTax {
  id: number;
}

export interface SiigoItem {
  type: 'Product' | 'Service' | 'FixedAsset';
  code: string;
  description: string;
  quantity: number;
  price: number;
  discount?: number; // Número simple, no objeto
  taxes?: SiigoTax[];
}

export interface SiigoPayment {
  id: number;
  value: number;
  due_date: string;
}

// Request completo para la API de Siigo
export interface SiigoPurchaseRequest {
  document: SiigoDocument;
  date: string;
  supplier: SiigoSupplier;
  cost_center?: number;
  provider_invoice?: SiigoProviderInvoice;
  currency?: SiigoCurrency;
  observations?: string;
  discount_type?: 'Value' | 'Percentage';
  supplier_by_item?: boolean;
  tax_included?: boolean;
  items: SiigoItem[];
  payments: SiigoPayment[];
  warehouse?: string;
}

// Respuesta de la API de Siigo
export interface SiigoPurchaseResponse {
  id: string;
  document: SiigoDocument;
  number: number;
  name: string;
  date: string;
  supplier: SiigoSupplier;
  cost_center?: number;
  provider_invoice?: SiigoProviderInvoice;
  discount_type?: string;
  currency?: SiigoCurrency;
  total: number;
  balance: number;
  observations?: string;
  items: Array<{
    type: string;
    id: string;
    code: string;
    description: string;
    quantity: number;
    price: number;
    discount?: {
      percentage?: number;
      value?: number;
    };
    taxes?: Array<{
      id: number;
      name: string;
      type: string;
      percentage: number;
      value: number;
    }>;
    total: number;
  }>;
  payments: Array<{
    id: number;
    name: string;
    value: number;
    due_date: string;
  }>;
  metadata: {
    created: string;
    last_updated: string | null;
  };
}

// Tipos auxiliares para mantener compatibilidad
export type SiigoPurchaseItemRequest = SiigoItem;
export type SiigoPaymentRequest = SiigoPayment;

// Types for form data
export interface FormData {
  selectedProvider?: {
    identification: string;
    branch_office?: number;
  };
  invoiceDate?: string;
  providerInvoiceNumber?: string;
  providerInvoicePrefix?: string;
  costCenter?: string;
  observations?: string;
  sedeEnvio?: string;
  hasIVA?: boolean;
  ivaPercentage?: number;
  items: InvoiceItem[];
}

export interface SiigoInvoiceRequest {
  document: SiigoDocument;
  date: string;
  items: SiigoItem[];
  payments: SiigoPayment[];
  supplier: SiigoSupplier;
  cost_center?: number;
  provider_invoice?: SiigoProviderInvoice;
  observations?: string;
  additional_fields?: {
    warehouse?: string;
    prefix?: string;
  };
}

export interface SiigoAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface SiigoExpenseRequest {
  document: SiigoDocument;
  date: string;
  supplier: SiigoSupplier;
  category: string;
  description: string;
  amount: number;
  tax_included: boolean;
  cost_center?: number;
  observations?: string;
  payment: {
    id: number;
    value: number;
    due_date: string;
  };
}