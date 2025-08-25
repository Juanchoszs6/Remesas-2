'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, Loader2, X, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentType } from './AnalyticsChart';

interface FileUploadProps {
  onFilesUploaded: (files: Array<{ type: DocumentType; file: File; data?: unknown }>) => void;
}

interface ProcessedData {
  [key: string]: unknown;
  _debug?: {
    processedRows?: number;
    [key: string]: unknown;
  };
}

interface UploadedFileData {
  file: File;
  type: DocumentType | 'unknown';
  status: 'uploading' | 'success' | 'error';
  error?: string;
  data?: ProcessedData;
  debugInfo?: Record<string, unknown>;
}

const documentTypeNames: Record<DocumentType, string> = {
  'FC': 'Factura de Compra',
  'ND': 'Nota Débito', 
  'DS': 'Documento Soporte',
  'RP': 'Recibo de Pago'
};

const documentTypeColors = {
  'FC': 'bg-blue-100 text-blue-700 border-blue-200',
  'ND': 'bg-red-100 text-red-700 border-red-200',
  'DS': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'RP': 'bg-green-100 text-green-700 border-green-200',
  'unknown': 'bg-gray-100 text-gray-700 border-gray-200'
};

export function FileUpload({ onFilesUploaded }: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFileData[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Función mejorada para detectar tipo desde nombre de archivo Siigo
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

  const processFiles = async (filesToProcess: UploadedFileData[]) => {
    setIsUploading(true);
    const results: Array<{ type: DocumentType; file: File; data?: Record<string, unknown> }> = [];
    
    try {
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
          
          console.log('Enviando archivo Siigo a /api/analytics/process');
          
          // Verificar si el endpoint existe primero
          const response = await fetch('/api/analytics/process', {
            method: 'POST',
            body: formData,
          });
          
          console.log('Respuesta del servidor:', response.status, response.statusText);
          
          if (!response.ok) {
            let errorMessage = `Error del servidor: ${response.status} ${response.statusText}`;
            
            try {
              const errorText = await response.text();
              console.error('Error del servidor:', errorText);
              
              if (response.status === 404) {
                errorMessage = 'Endpoint no encontrado. Verifique que /api/analytics/process/route.ts existe';
              } else if (response.status === 500) {
                errorMessage = 'Error interno del servidor. Verifique los logs';
              }
            } catch (_e) {
              console.error('No se pudo leer la respuesta de error');
            }
            
            throw new Error(errorMessage);
          }
          
          let result: unknown;
          try {
            result = await response.json();
            console.log('Respuesta JSON del procesamiento Siigo:', result);
          } catch (_e) {
            throw new Error('Respuesta inválida del servidor');
          }
          
          if (!result || typeof result !== 'object' || !('success' in result)) {
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
          
          // Agregar a resultados
          results.push({
            type: detectedType,
            file: fileData.file,
            data: responseData.data
          });
          
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
        
        // Pausa entre archivos
        if (i < filesToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Notificar archivos procesados exitosamente
      if (results.length > 0 && onFilesUploaded) {
        onFilesUploaded(results);
        toast.success(`${results.length} archivo(s) de Siigo procesado(s) correctamente`);
      }
      
    } finally {
      setIsUploading(false);
    }
    
    return results;
  };

  const removeFile = (fileName: string) => {
    setFiles(prev => prev.filter(file => file.file.name !== fileName));
  };

  const clearAllFiles = () => {
    setFiles([]);
    toast.info('Todos los archivos han sido eliminados');
  };

  const retryFile = async (fileData: UploadedFileData) => {
    if (fileData.status !== 'error') return;
    
    const updatedFile = { ...fileData, status: 'uploading' as const, error: undefined };
    setFiles(prev => prev.map(f => f.file === fileData.file ? updatedFile : f));
    
    await processFiles([updatedFile]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles: File[], fileRejections) => {
      // Manejar archivos rechazados
      if (fileRejections.length > 0) {
        fileRejections.forEach(({ file, errors }) => {
          const errorMessages = errors.map(e => e.message).join(', ');
          toast.error(`Error con ${file.name}: ${errorMessages}`);
        });
      }

      // Procesar archivos aceptados
      if (acceptedFiles.length > 0) {
        const newFiles: UploadedFileData[] = acceptedFiles.map(file => ({
          file,
          type: detectDocumentType(file.name),
          status: 'uploading' as const,
        }));

        setFiles(prev => [...prev, ...newFiles]);
        
        try {
          await processFiles(newFiles);
        } catch (error) {
          console.error('Error procesando archivos Siigo:', error);
          toast.error('Error procesando archivos de Siigo. Revise los detalles.');
        }
      }
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: true,
    maxFiles: 20,
    maxSize: 50 * 1024 * 1024,
    disabled: isUploading
  });

  const getDocumentTypeName = (type: DocumentType | 'unknown') => {
    if (type === 'unknown') return 'Tipo desconocido';
    return documentTypeNames[type] || 'Tipo desconocido';
  };

  const getStatusIcon = (status: UploadedFileData['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
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

  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const uploadingCount = files.filter(f => f.status === 'uploading').length;

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
                  <div className={`p-3 rounded-lg border ${documentTypeColors[fileData.type]}`}>
                    <FileSpreadsheet className="h-5 w-5" />
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