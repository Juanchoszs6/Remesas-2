// All possible document types
export type DocumentType = 'FC' | 'RP' | 'DS' | 'ND' | 'unknown';

// Type for required document types (excluding 'unknown')
export type RequiredDocumentType = Exclude<DocumentType, 'unknown'>;

export interface UploadedFileData {
  file: File;
  type: DocumentType;
  month: number;
  year: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export interface FileUploadProps {
  onFilesUploaded?: (files: Array<{ type: RequiredDocumentType; file: File }>) => void;
}
