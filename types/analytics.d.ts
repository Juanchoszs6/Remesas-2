export type DocumentType = 'FC' | 'ND' | 'DS' | 'RP';

export interface ProcessedData {
  months: string[];
  values: number[];
  total: number;
}

export interface FileUploadProps {
  onFilesUploaded: (files: Array<{ type: DocumentType; file: File }>) => void;
}

export interface AnalyticsChartProps {
  title: string;
  documentType: DocumentType;
  data?: ProcessedData;
}
