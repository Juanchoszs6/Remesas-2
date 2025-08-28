// Importaciones de bibliotecas y componentes necesarios
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertCircle, 
  FileText, 
  Upload, 
  X, 
  CheckCircle2, 
  Loader2, 
  FileSpreadsheet,
  RefreshCw 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DocumentType, documentTypeNames, documentTypeColors } from '@/types/document.types';
import type { TimeRange } from './AnalyticsChart';

// Asegurarnos de que JSX esté disponible
declare global {
  namespace JSX {
    interface Element {}
    interface IntrinsicElements { [key: string]: any; }
  }
}

// Interfaz para las propiedades del componente
interface FileUploadProps {
  onFileProcessed?: (data: {
    success: boolean;
    totalValue?: number;
    documentType: DocumentType;
    processedRows?: number;
    [key: string]: unknown;
  }) => void;
  onUploadComplete?: () => void;
  documentType: DocumentType;
  timeRange: TimeRange;
}

interface ProcessedData {
  success: boolean;
  totalValue?: number;
  processedRows?: number;
  documentType?: DocumentType;
  filename?: string;
  shouldRefresh?: boolean;
  _debug?: {
    processedRows?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface UploadedFileData {
  file: File;
  type: DocumentType | 'unknown';
  status: 'uploading' | 'success' | 'error';
  error?: string;
  data?: ProcessedData;
  debugInfo?: Record<string, unknown>;
}


// Componente para la carga de archivos
export function FileUpload({ onFileProcessed, onUploadComplete, documentType, timeRange }: FileUploadProps) {
  // Estados para manejar los archivos cargados
  const [files, setFiles] = useState<UploadedFileData[]>([]);
  // Estados para manejar la carga y el progreso
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileData, setFileData] = useState<UploadedFileData | null>(null);

  // Función para detectar el tipo de documento desde el nombre del archivo
  const detectDocumentType = (filename: string): DocumentType | 'unknown' => {
    if (!filename) return 'unknown';
    
    const name = filename.toLowerCase().trim();
    console.log('Detectando tipo para archivo Siigo:', name);
    
    // Patrones específicos para Siigo
    const patterns = [
      { pattern: /(^|[\s\-_.])(fc|factura[s]?[\s\-_]*compra)([\s\-_.]|$)/i, type: 'FC' as DocumentType },
      { pattern: /(^|[\s\-_.])(nd|nota[s]?[\s\-_]*d[eé]bito)/i, type: 'ND' as DocumentType },
      { pattern: /(^|[\s\-_.])(ds|documento[s]?[\s\-_]*soporte)/i, type: 'DS' as DocumentType },
      { pattern: /(^|[\s\-_.])(rp|recibo[s]?[\s\-_]*pago)/i, type: 'RP' as DocumentType },
    ];
    
    for (const { pattern, type } of patterns) {
      if (pattern.test(name)) {
        console.log(`Tipo ${type} detectado para archivo Siigo`);
        return type;
      }
    }
    
    // Si no se detectó, intentar por palabras clave generales
    if (/factura|compra/i.test(name)) return 'FC';
    if (/nota.*d[eé]bito|débito/i.test(name)) return 'ND';
    if (/documento.*soporte|soporte/i.test(name)) return 'DS';
    if (/recibo.*pago|pago/i.test(name)) return 'RP';
    
    console.log('Tipo no detectado, será determinado por el contenido del archivo');
    return 'unknown';
  };

  // Función para calcular el hash del contenido del archivo
  const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Función que se ejecuta cuando se sueltan archivos en la zona de carga
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // No hacer nada si no hay archivos
    if (acceptedFiles.length === 0) return;

    // Filtrar archivos duplicados por nombre y contenido
    const existingFilenames = new Set(files.map(f => f.file.name));
    
    // Procesar archivos para verificar duplicados
    const filesToProcess: UploadedFileData[] = [];
    
    for (const file of acceptedFiles) {
      // Verificar por nombre
      if (existingFilenames.has(file.name)) {
        toast.warning(`El archivo "${file.name}" ya está en la lista de carga.`);
        continue;
      }
      
      // Calcular hash del archivo
      try {
        const fileHash = await calculateFileHash(file);
        const isDuplicate = files.some(f => f.debugInfo?.fileHash === fileHash);
        
        if (isDuplicate) {
          toast.warning(`El archivo "${file.name}" tiene el mismo contenido que un archivo ya cargado.`);
          continue;
        }
        
        filesToProcess.push({
          file,
          type: detectDocumentType(file.name),
          status: 'uploading' as const,
          debugInfo: { fileHash }
        });
        
        existingFilenames.add(file.name);
      } catch (error) {
        console.error('Error procesando archivo:', error);
        toast.error(`Error al procesar el archivo "${file.name}"`);
      }
    }
    
    if (filesToProcess.length === 0) return;

    // Agregar los archivos al estado
    setFiles(prev => [...prev, ...filesToProcess]);

    // Procesar los archivos
    const processFiles = async (filesToProcess: UploadedFileData[]) => {
      for (const fileData of filesToProcess) {
        const toastId = toast.loading(`Procesando ${fileData.file.name}...`);
        
        try {
          const formData = new FormData();
          formData.append('file', fileData.file);

          const response = await fetch('/api/analiticas/proceso', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Error al subir el archivo: ${response.statusText}`);
          }

          const result = await response.json();
          
          // Actualizar el estado del archivo
          setFiles(prev => 
            prev.map(f => 
              f.file === fileData.file 
                ? { 
                    ...f, 
                    status: 'success' as const, 
                    data: result.data,
                    debugInfo: result.debug
                  } 
                : f
            )
          );

          // Notificar que el archivo se procesó correctamente
          if (onFileProcessed) {
            onFileProcessed({
              success: true,
              documentType: fileData.type as DocumentType,
              totalValue: result.data?.totalValue,
              processedRows: result.data?.processedRows,
              filename: fileData.file.name,
              shouldRefresh: true
            });
          }

          toast.success(`Archivo ${fileData.file.name} procesado correctamente`, { id: toastId });
        } catch (error) {
          console.error('Error procesando archivo:', error);
          setFiles(prev => 
            prev.map(f => 
              f.file === fileData.file 
                ? { 
                    ...f, 
                    status: 'error' as const, 
                    error: error instanceof Error ? error.message : 'Error desconocido'
                  } 
                : f
            )
          );
          toast.error(`Error al procesar ${fileData.file.name}`, { 
            id: toastId,
            description: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }
      
      // Notificar que la carga ha finalizado
      if (onUploadComplete) {
        onUploadComplete();
      }
    };

    try {
      await processFiles(newFiles);
    } catch (error) {
      console.error('Error procesando archivos:', error);
      toast.error('Error al procesar los archivos. Por favor, intente nuevamente.');
    }
  }, [onFileProcessed, onUploadComplete]);

  // Función para procesar los archivos
  const processFiles = async (filesToProcess: UploadedFileData[]) => {
    setIsUploading(true);

    // Procesar cada archivo
    for (let i = 0; i < filesToProcess.length; i++) {
      const fileData = filesToProcess[i];

      // Validar tipo de archivo
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];

      const hasValidExtension = /\.(xlsx|xls|csv)$/i.test(fileData.file.name);
      const hasValidMimeType = validTypes.includes(fileData.file.type);

      if (!hasValidExtension && !hasValidMimeType) {
        setFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { 
                  ...f, 
                  status: 'error' as const, 
                  error: 'Formato no soportado. Use archivos Excel (.xlsx, .xls) o CSV'
              } 
              : f
          )
        );
        toast.error(`Formato no soportado: ${fileData.file.name}`);
        continue;
      }

      // Validar tamaño
      if (fileData.file.size > 50 * 1024 * 1024) {
        setFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { 
                  ...f, 
                  status: 'error' as const, 
                  error: 'Archivo demasiado grande (máx. 50MB)'
              } 
              : f
          )
        );
        toast.error(`Archivo muy grande: ${fileData.file.name}`);
        continue;
      }

      // Actualizar estado a 'uploading'
      setFiles(prev => 
        prev.map(f => 
          f.file === fileData.file 
            ? { ...f, status: 'uploading' as const }
            : f
        )
      );

      const toastId = toast.loading(`Procesando ${fileData.file.name}... (${i + 1}/${filesToProcess.length})`);

      try {
        const formData = new FormData();
        formData.append('file', fileData.file);
        formData.append('documentType', documentType);
        formData.append('timeRange', timeRange);

        console.log('Enviando archivo Siigo a /api/analiticas/proceso', {
          documentType,
          timeRange
        });

        // Verificar si el endpoint existe primero
        const response = await fetch('/api/analiticas/proceso', {
          method: 'POST',
          body: formData,
        });

        console.log('Respuesta del servidor:', response.status, response.statusText);

        if (!response.ok) {
          throw new Error(`Error al subir el archivo: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Respuesta JSON del procesamiento Siigo:', result);

        // Validar la respuesta del servidor
        if (!result || typeof result !== 'object') {
          throw new Error('Respuesta inválida del servidor');
        }

        // Define the expected response type
        type ApiResponse = { 
          success: boolean; 
          error?: string; 
          details?: string; 
          data?: ProcessedData;
          _debug?: {
            processedRows?: number;
            [key: string]: unknown;
          };
        };

        const resultData = result as ApiResponse;

        if (!resultData.success) {
          throw new Error(resultData.error || resultData.details || 'Error procesando archivo Siigo');
        }

        // Determinar tipo de documento
        let detectedType = fileData.type;
        if (detectedType === 'unknown') {
          // Intentar detectar desde el nombre del archivo
          detectedType = detectDocumentType(fileData.file.name);

          if (detectedType === 'unknown' && resultData.data) {
            // Intentar detectar desde los datos procesados
            const data = resultData.data;
            const dataEntries = Object.entries(data)
              .filter(([key]) => key !== '_debug')
              .map(([type, value]) => {
                const typedValue = value as { total?: number } | undefined;
                return {
                  type: type as DocumentType,
                  total: typedValue?.total || 0
                };
              })
              .filter(item => item.total > 0);

            if (dataEntries.length > 0) {
              // Tomar el tipo con mayor total
              const maxTotal = Math.max(...dataEntries.map(t => t.total));
              const maxType = dataEntries.find(t => t.total === maxTotal)?.type;
              if (maxType) {
                detectedType = maxType;
                console.log(`Tipo con mayor total detectado: ${detectedType}`);
              }
            }
          }
        }

        if (detectedType === 'unknown') {
          throw new Error('No se pudo determinar el tipo de documento Siigo. Verifique que contenga FC-, ND-, DS- o RP-');
        }

        // Actualizar archivo como exitoso
        const responseData = result as ApiResponse;
        const debugInfo = responseData._debug || (responseData.data as { _debug?: unknown })?._debug;
        const processedRows = typeof debugInfo === 'object' && debugInfo !== null && 'processedRows' in debugInfo 
          ? Number(debugInfo.processedRows) || 0 
          : 0;

        const fileDataToUpdate: UploadedFileData = {
          ...fileData,
          status: 'success',
          type: detectedType,
          data: responseData.data,
          debugInfo: debugInfo as Record<string, unknown> | undefined
        };

        setFiles(prev => 
          prev.map(f => f.file === fileData.file ? fileDataToUpdate : f)
        );

        // Notificar archivo procesado exitosamente
        if (onFileProcessed) {
          onFileProcessed({
            success: true,
            documentType: fileData.type as DocumentType,
            totalValue: result.data?.totalValue,
            processedRows: result.data?.processedRows,
            filename: fileData.file.name,
            timeRange: timeRange,
            shouldRefresh: true
          });
        }

        // Notificar carga completa
        if (onUploadComplete) {
          onUploadComplete();
        }

        toast.success(
          `${fileData.file.name} procesado como ${documentTypeNames[detectedType]} (${processedRows} filas)`, 
          { id: toastId }
        );
      } catch (error) {
        console.error('Error procesando archivo Siigo:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

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

        toast.error(`Error en ${fileData.file.name}: ${errorMessage}`, { id: toastId });
      }
    }

    // Notificar carga completa
    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  // Configuración de la zona de arrastrar y soltar
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,  
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: true, 
    onDropRejected: (fileRejections) => {
      const errorMessages = fileRejections.map(({ file, errors }) => {
        const errorMessage = errors.map(e => e.message).join(', ');
        return `Error en ${file.name}: ${errorMessage}`;
      });
      toast.error(errorMessages.join('\n'));
    }
  });

  // Función para obtener el nombre del tipo de documento
  const getDocumentTypeName = (type: DocumentType | 'unknown') => {
    if (type === 'unknown') return 'Tipo desconocido';
    return documentTypeNames[type] || 'Tipo desconocido';
  };

  // Función para limpiar todos los archivos
  const clearAllFiles = () => {
    setFiles([]);
  };

  // Función para reintentar la carga de un archivo
  const retryFile = async (fileData: UploadedFileData) => {
    await processFiles([fileData]);
  };

  // Función para eliminar un archivo específico
  const removeFile = (fileName: string) => {
    setFiles(prevFiles => prevFiles.filter(f => f.file.name !== fileName));
  };

  const getStatusIcon = (status: UploadedFileData['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadedFileData['status']) => {
    switch (status) {
      case 'uploading':
        return 'Procesando...';
      case 'success':
        return 'Completado';
      case 'error':
        return 'Error';
    }
  };

  // Helper function to safely count files by status
  const countFilesByStatus = (status: UploadedFileData['status']): number => {
    return files.filter((file): file is UploadedFileData & { status: typeof status } => 
      file.status === status
    ).length;
  };

  const successCount = countFilesByStatus('success');
  const errorCount = countFilesByStatus('error');
  const uploadingCount = countFilesByStatus('uploading');

  return (
    <div className="space-y-6">
      {/* Zona de carga */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50 scale-105 shadow-lg' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={`p-4 rounded-full ${isDragActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Upload className={`h-8 w-8 ${isDragActive ? 'text-blue-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive
                ? 'Suelta los archivos de Siigo aquí...'
                : 'Arrastra archivos Excel de Siigo o haz clic para seleccionar'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Soporta archivos .xlsx, .xls y .csv (hasta 50MB cada uno)
            </p>
          </div>
          {isUploading && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Procesando archivos de Siigo...</span>
            </div>
          )}
        </div>
      </div>

      {/* Resumen de archivos */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Archivos de Siigo ({files.length})
            </h3>
            <div className="flex items-center space-x-4">
              {successCount > 0 && (
                <span className="text-sm text-green-600 font-medium">
                  {successCount} exitoso{successCount !== 1 ? 's' : ''}
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-sm text-red-600 font-medium">
                  {errorCount} error{errorCount !== 1 ? 'es' : ''}
                </span>
              )}
              {uploadingCount > 0 && (
                <span className="text-sm text-blue-600 font-medium">
                  {uploadingCount} procesando
                </span>
              )}
              <button
                onClick={clearAllFiles}
                className="text-sm text-gray-500 hover:text-red-500 transition-colors"
                disabled={isUploading}
              >
                Limpiar todo
              </button>
            </div>
          </div>

          {/* Lista de archivos */}
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {files.map((fileData, index) => (
              <div
                key={`${fileData.file.name}-${index}`}
                className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center space-x-4 min-w-0 flex-1">
                  {/* Icono del archivo */}
                  <div className={`p-3 rounded-lg border ${fileData.type in documentTypeColors ? documentTypeColors[fileData.type as DocumentType] : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    <FileText className="h-5 w-5" />
                  </div>

                  {/* Información del archivo */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileData.file.name}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{getDocumentTypeName(fileData.type)}</span>
                      <span>•</span>
                      <span>{(fileData.file.size / 1024 / 1024).toFixed(2)} MB</span>
                      {fileData.debugInfo && 'processedRows' in fileData.debugInfo && (
                      <>
                        <span>•</span>
                        <span>{String(fileData.debugInfo.processedRows)} filas procesadas</span>
                      </>
                    )}
                    </div>
                    {fileData.error && (
                      <p className="text-xs text-red-600 mt-1 truncate" title={fileData.error}>
                        {fileData.error}
                      </p>
                    )}
                    {fileData.status === 'success' && fileData.data && (
                      <div className="text-xs text-green-600 mt-1">
                        {Object.entries(fileData.data)
                          .filter(([key]) => key !== '_debug')
                          .map(([type, data]) => {
                            const typedData = data as { total?: number };
                            if (typedData?.total && typedData.total > 0) {
                              return `${type}: ${typedData.total.toLocaleString()}`;
                            }
                            return null;
                          })
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Estado y acciones */}
                <div className="flex items-center space-x-3 ml-4">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(fileData.status)}
                    <span className={`text-xs font-medium ${
                      fileData.status === 'success' ? 'text-green-600' :
                      fileData.status === 'error' ? 'text-red-600' :
                      'text-blue-600'
                    }`}>
                      {getStatusText(fileData.status)}
                    </span>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {fileData.status === 'error' && (
                      <button
                        onClick={() => retryFile(fileData)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 flex items-center space-x-1"
                        disabled={isUploading}
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Reintentar</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(fileData.file.name);
                      }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
                      disabled={isUploading}
                      aria-label="Eliminar archivo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instrucciones específicas para Siigo */}
      {files.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Instrucciones para archivos de Siigo:
          </h4>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Los archivos deben contener las columnas: "Factura proveedor", "Fecha elaboración", "Valor"</li>
            <li>Los comprobantes deben tener prefijos: FC- (Facturas), ND- (Notas Débito), DS- (Documentos Soporte), RP- (Recibos Pago)</li>
            <li>Las fechas deben estar en formato DD/MM/YYYY (formato colombiano)</li>
            <li>Los valores pueden estar en formato 1.234.567,89 o 1,234,567.89</li>
            <li>Se procesarán automáticamente por mes y tipo de documento</li>
          </ul>
        </div>
      )}

      {/* Información de debug para desarrolladores */}
      {process.env.NODE_ENV === 'development' && files.some(f => f.debugInfo) && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Información de Debug:</h4>
          {files.filter(f => f.debugInfo).map((file, index) => {
            const debugInfo = file.debugInfo || {};
            const processed = 'processedRows' in debugInfo ? debugInfo.processedRows : 0;
            const skipped = 'skippedRows' in debugInfo ? debugInfo.skippedRows : 0;
            
            return (
              <div key={index} className="text-xs text-gray-600 mb-2">
                <strong>{file.file.name}:</strong> {String(processed)} procesadas, {String(skipped)} saltadas
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}