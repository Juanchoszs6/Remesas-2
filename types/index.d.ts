// Type definitions for analytics

type DocumentType = 'FC' | 'ND' | 'DS' | 'RP';

interface ProcessedData {
  months: string[];
  values: number[];
  total: number;
}

interface FileUploadProps {
  onFileProcessed: (data: ProcessedData) => void;
}

interface AnalyticsChartProps {
  title: string;
  documentType: DocumentType;
  data?: ProcessedData;
}

export type { DocumentType, ProcessedData, FileUploadProps, AnalyticsChartProps };
