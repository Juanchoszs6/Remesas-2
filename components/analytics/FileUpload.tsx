'use client';

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentType } from './AnalyticsChart';

interface FileUploadProps {
  onFilesUploaded: (files: Array<{ type: DocumentType; file: File }>) => void;
}

interface UploadedFileData {
  file: File;
  type: DocumentType | 'unknown';
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

const documentTypeNames: Record<DocumentType, string> = {
  'FC': 'Factura de Compra',
  'ND': 'Nota Débito',
  'DS': 'Documento Soporte',
  'RP': 'Recibo de Pago'
};

export function FileUpload({ onFilesUploaded }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFileData[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Helper function to detect document type from filename
  const detectDocumentType = (filename: string): DocumentType | 'unknown' => {
    const lowerName = filename.toLowerCase();
    if (lowerName.includes('fc') || lowerName.includes('factura')) return 'FC';
    if (lowerName.includes('nd') || lowerName.includes('nota debito')) return 'ND';
    if (lowerName.includes('ds') || lowerName.includes('documento soporte')) return 'DS';
    if (lowerName.includes('rp') || lowerName.includes('recibo pago')) return 'RP';
    return 'unknown';
  };

  const processFiles = async (filesToProcess: UploadedFileData[]) => {
    const results: Array<{ type: DocumentType; file: File }> = [];
    
    // Procesar archivos uno por uno de manera secuencial
    for (let i = 0; i < filesToProcess.length; i++) {
      const fileData = filesToProcess[i];
      
      // Actualizar estado a 'uploading' para este archivo
      setFiles(prev => 
        prev.map(f => 
          f.file === fileData.file 
            ? { ...f, status: 'uploading' as const }
            : f
        )
      );
      
      // Saltar archivos con tipo desconocido
      if (fileData.type === 'unknown') {
        toast.warning(`Tipo de documento no reconocido en ${fileData.file.name}`);
        setFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { ...f, status: 'error' as const, error: 'Tipo de documento no reconocido' }
              : f
          )
        );
        continue;
      }
      
      // Solo procesar si el tipo es un DocumentType válido
      if (!['FC', 'ND', 'DS', 'RP'].includes(fileData.type)) {
        setFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { ...f, status: 'error' as const, error: 'Tipo de documento no válido' }
              : f
          )
        );
        continue;
      }
      
      try {
        // Crear FormData para la carga del archivo
        const formData = new FormData();
        formData.append('file', fileData.file);
        
        // Mostrar el progreso actual
        toast.info(`Procesando archivo ${i + 1} de ${filesToProcess.length}: ${fileData.file.name}`);
        
        // Cargar archivo a la API para procesamiento
        const response = await fetch('/api/analytics/process', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Error al procesar el archivo');
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error('Error al procesar el archivo');
        }
        
        // Actualizar estado del archivo a 'success'
        setFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { ...f, status: 'success' as const } 
              : f
          )
        );
        
        // Agregar a resultados
        results.push({
          type: fileData.type as DocumentType,
          file: fileData.file
        });
        
        toast.success(`Archivo ${fileData.file.name} procesado correctamente (${i + 1}/${filesToProcess.length})`);
      } catch (error) {
        console.error('Error procesando archivo:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error al procesar el archivo';
        
        setFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { 
                  ...f, 
                  status: 'error' as const, 
                  error: errorMessage
                } 
              : f
          )
        );
        
        toast.error(`Error al procesar ${fileData.file.name}: ${errorMessage}`);
      }
      
      // Pequeña pausa entre archivos para evitar sobrecargar el servidor
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(file => file.file.name !== fileName));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles: File[]) => {
      const newFiles: UploadedFileData[] = acceptedFiles.map(file => ({
        file,
        type: detectDocumentType(file.name),
        status: 'uploading' as const,
      }));

      setFiles(prev => [...prev, ...newFiles]);
      
      try {
        const processedFiles = await processFiles(newFiles);
        if (onFilesUploaded) {
          onFilesUploaded(processedFiles);
        }
      } catch (error) {
        console.error('Error processing files:', error);
      }
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: true,
    maxFiles: 20,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const getDocumentTypeName = (type: DocumentType | 'unknown') => {
    if (type === 'unknown') return 'Tipo de documento desconocido';
    return documentTypeNames[type] || 'Tipo de documento desconocido';
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-2">
          <Upload className="h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-600">
            {isDragActive
              ? 'Suelta los archivos aquí...'
              : 'Arrastra y suelta archivos Excel aquí, o haz clic para seleccionar'}
          </p>
          <p className="text-xs text-gray-500">Soporta archivos .xlsx y .xls (hasta 10MB)</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Archivos cargados: {files.length}</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {files.map((fileData, index) => {
              const statusIcons = {
                uploading: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
                success: <span className="h-3 w-3 rounded-full bg-green-500" />,
                error: <span className="h-3 w-3 rounded-full bg-red-500" />
              };
              
              const statusColors = {
                uploading: 'text-blue-600',
                success: 'text-green-600',
                error: 'text-red-600'
              };
              
              return (
                <div
                  key={`${fileData.file.name}-${index}`}
                  className="flex items-center justify-between p-3 border rounded-md bg-white hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-md ${
                      fileData.type === 'FC' ? 'bg-blue-100 text-blue-600' :
                      fileData.type === 'RP' ? 'bg-green-100 text-green-600' :
                      fileData.type === 'DS' ? 'bg-yellow-100 text-yellow-600' :
                      fileData.type === 'ND' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{fileData.file.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {getDocumentTypeName(fileData.type)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-2">
                    <span className={`text-xs font-medium ${statusColors[fileData.status]}`}>
                      {fileData.status === 'uploading' ? 'Subiendo...' : 
                       fileData.status === 'success' ? 'Completado' : 'Error'}
                    </span>
                    {statusIcons[fileData.status]}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(fileData.file.name);
                      }}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Eliminar archivo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
