'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentType } from './AnalyticsChart';

interface FileUploadProps {
  onFilesUploaded: (files: Array<{ type: DocumentType; file: File; data?: any }>) => void;
}

interface UploadedFileData {
  file: File;
  type: DocumentType | 'unknown';
  status: 'uploading' | 'success' | 'error';
  error?: string;
  data?: any;
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

  // Función mejorada para detectar el tipo de documento desde el nombre del archivo
  const detectDocumentType = (filename: string): DocumentType | 'unknown' => {
    if (!filename) return 'unknown';
    
    const name = filename.toLowerCase().trim();
    console.log('Detectando tipo para archivo:', name);
    
    // Patrones más específicos primero
    const patterns = [
      // Factura de Compra
      { pattern: /(^|[\s\-_.])(fc|factura[s]?[\s\-_]*(de[\s\-_]*)?compra[s]?)([\s\-_.]|$)/i, type: 'FC' as DocumentType },
      { pattern: /(^|[\s\-_.])(fact[\s\-_]*comp)([\s\-_.]|$)/i, type: 'FC' as DocumentType },
      
      // Nota Débito
      { pattern: /(^|[\s\-_.])(nd|nota[s]?[\s\-_]*d[eé]bito[s]?)([\s\-_.]|$)/i, type: 'ND' as DocumentType },
      { pattern: /(^|[\s\-_.])(nota[s]?[\s\-_]*deb)([\s\-_.]|$)/i, type: 'ND' as DocumentType },
      
      // Documento Soporte
      { pattern: /(^|[\s\-_.])(ds|documento[s]?[\s\-_]*soporte[s]?)([\s\-_.]|$)/i, type: 'DS' as DocumentType },
      { pattern: /(^|[\s\-_.])(doc[\s\-_]*sop)([\s\-_.]|$)/i, type: 'DS' as DocumentType },
      
      // Recibo de Pago
      { pattern: /(^|[\s\-_.])(rp|recibo[s]?[\s\-_]*(de[\s\-_]*)?pago[s]?)([\s\-_.]|$)/i, type: 'RP' as DocumentType },
      { pattern: /(^|[\s\-_.])(rec[\s\-_]*pag)([\s\-_.]|$)/i, type: 'RP' as DocumentType },
    ];
    
    // Buscar patrones específicos
    for (const { pattern, type } of patterns) {
      if (pattern.test(name)) {
        console.log(`Tipo ${type} detectado con patrón específico`);
        return type;
      }
    }
    
    // Búsqueda de palabras clave más general
    if (/factura/i.test(name) && !/débito|credito|nota/i.test(name)) return 'FC';
    if (/nota.*d[eé]bito/i.test(name) || /débito/i.test(name)) return 'ND';
    if (/documento.*soporte/i.test(name) || /soporte/i.test(name)) return 'DS';
    if (/recibo.*pago/i.test(name) || /pago/i.test(name)) return 'RP';
    
    // Búsqueda por prefijos al inicio del nombre
    if (/^fc[\s\-_]/i.test(name)) return 'FC';
    if (/^nd[\s\-_]/i.test(name)) return 'ND';
    if (/^ds[\s\-_]/i.test(name)) return 'DS';
    if (/^rp[\s\-_]/i.test(name)) return 'RP';
    
    console.log('Tipo de documento no detectado para:', name);
    return 'unknown';
  };

  const processFiles = async (filesToProcess: UploadedFileData[]) => {
    setIsUploading(true);
    const results: Array<{ type: DocumentType; file: File; data?: any }> = [];
    
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
        if (fileData.file.size > 50 * 1024 * 1024) { // 50MB
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
        
        // Crear toast de progreso
        const toastId = toast.loading(`Procesando ${fileData.file.name}... (${i + 1}/${filesToProcess.length})`);
        
        try {
          // Crear FormData
          const formData = new FormData();
          formData.append('file', fileData.file);
          
          // Llamar a la API
          const response = await fetch('/api/analytics/process', {
            method: 'POST',
            body: formData,
          });
          
          let result;
          try {
            result = await response.json();
          } catch (e) {
            throw new Error('Respuesta inválida del servidor');
          }
          
          if (!response.ok) {
            throw new Error(result.error || `Error HTTP ${response.status}`);
          }
          
          if (!result.success) {
            throw new Error(result.error || result.details || 'Error procesando archivo');
          }
          
          // Determinar tipo de documento
          let detectedType = fileData.type;
          if (detectedType === 'unknown') {
            // Intentar detectar desde el nombre del archivo
            detectedType = detectDocumentType(fileData.file.name);
            
            if (detectedType === 'unknown') {
              // Intentar detectar desde los datos procesados
              const dataTypes = Object.keys(result.data || {}).filter(key => 
                key !== '_debug' && result.data[key]?.total > 0
              );
              
              if (dataTypes.length === 1) {
                detectedType = dataTypes[0] as DocumentType;
                console.log(`Tipo detectado desde datos: ${detectedType}`);
              }
            }
          }
          
          if (detectedType === 'unknown') {
            throw new Error('No se pudo determinar el tipo de documento. Incluya FC, ND, DS o RP en el nombre del archivo.');
          }
          
          // Actualizar archivo como exitoso
          setFiles(prev => 
            prev.map(f => 
              f.file === fileData.file 
                ? { 
                    ...f, 
                    status: 'success' as const,
                    type: detectedType as DocumentType,
                    data: result.data
                } 
                : f
            )
          );
          
          // Agregar a resultados
          results.push({
            type: detectedType as DocumentType,
            file: fileData.file,
            data: result.data
          });
          
          toast.success(`${fileData.file.name} procesado como ${documentTypeNames[detectedType]}`, { id: toastId });
          
        } catch (error) {
          console.error('Error procesando archivo:', error);
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
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Notificar archivos procesados exitosamente
      if (results.length > 0 && onFilesUploaded) {
        onFilesUploaded(results);
        toast.success(`${results.length} archivo(s) procesado(s) correctamente`);
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

        // Agregar archivos a la lista
        setFiles(prev => [...prev, ...newFiles]);
        
        // Procesar archivos
        try {
          await processFiles(newFiles);
        } catch (error) {
          console.error('Error processing files:', error);
          toast.error('Error procesando archivos. Revise los detalles de cada archivo.');
        }
      }
    },
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    multiple: true,
    maxFiles: 50,
    maxSize: 50 * 1024 * 1024, // 50MB
    onError: (err) => {
      console.error('Error en dropzone:', err);
      toast.error(`Error al cargar archivos: ${err.message}`);
    },
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
                ? 'Suelta los archivos aquí...'
                : 'Arrastra archivos Excel o haz clic para seleccionar'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Soporta archivos .xlsx, .xls y .csv (hasta 50MB cada uno)
            </p>
          </div>
          {isUploading && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Procesando archivos...</span>
            </div>
          )}
        </div>
      </div>

      {/* Resumen de archivos */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Archivos ({files.length})
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
                    <p className="text-xs text-gray-500">
                      {getDocumentTypeName(fileData.type)} • {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {fileData.error && (
                      <p className="text-xs text-red-600 mt-1 truncate" title={fileData.error}>
                        {fileData.error}
                      </p>
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
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50"
                        disabled={isUploading}
                      >
                        Reintentar
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

      {/* Instrucciones */}
      {files.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            Consejos para mejores resultados:
          </h4>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Nombra tus archivos con prefijos: FC (Facturas), ND (Notas Débito), DS (Documentos Soporte), RP (Recibos Pago)</li>
            <li>Asegúrate de que tus archivos tengan columnas de "Fecha" y "Valor"</li>
            <li>Los archivos pueden contener múltiples tipos de documentos</li>
            <li>Formatos soportados: Excel (.xlsx, .xls) y CSV</li>
          </ul>
        </div>
      )}
    </div>
  );
}