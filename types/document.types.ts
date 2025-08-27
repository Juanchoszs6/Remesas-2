// Supported document types
export type DocumentType = 'FC' | 'ND' | 'DS' | 'RP';

// Document type display names
export const documentTypeNames: Record<DocumentType, string> = {
  'FC': 'Factura de Compra',
  'ND': 'Nota Débito',
  'DS': 'Descuento',
  'RP': 'Recibo de Pago'
};

// Document type colors for UI
export const documentTypeColors = {
  'FC': 'bg-blue-100 text-blue-700 border-blue-200',
  'ND': 'bg-red-100 text-red-700 border-red-200',
  'DS': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'RP': 'bg-green-100 text-green-700 border-green-200'
} as const;
