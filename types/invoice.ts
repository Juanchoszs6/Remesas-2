export interface InvoiceType {
  id: string;
  code: string;
  name: string;
  description: string;
  type: string;
  active: boolean;
  document_support: boolean;
  cost_center: boolean;
  cost_center_mandatory: boolean;
  automatic_number: boolean;
  consecutive: number;
  decimals: boolean;
  consumption_tax: boolean;
  reteiva: boolean;
  reteica: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  type: string;
  customer: {
    id: string;
    name: string;
  };
  total: number;
  status: 'draft' | 'posted' | 'cancelled';
  created_at: string;
  updated_at: string;
}
