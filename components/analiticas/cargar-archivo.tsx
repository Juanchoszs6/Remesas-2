'use client';

import { useState, useCallback } from 'react';
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

type TipoDocumento = 'FC' | 'ND' | 'DS' | 'RP';
type RangoTiempo = 'mes' | 'trimestre' | 'año';
type EstadoArchivo = 'cargando' | 'completado' | 'error';

interface DatosProcesados {
  [key: string]: unknown;
  _debug?: {
    filasProcesadas?: number;
    [key: string]: unknown;
  };
  valorTotal?: number;
  procesado?: number;
}

interface ArchivoCargado {
  archivo: File;
  tipo: TipoDocumento | 'desconocido';
  estado: EstadoArchivo;
  error?: string;
  datos?: DatosProcesados;
}

interface PropsCargarArchivo {
  alProcesarArchivo?: (datos: {
    exito: boolean;
    valorTotal?: number;
    tipoDocumento: TipoDocumento;
    filasProcesadas?: number;
    nombreArchivo?: string;
    tamanoArchivo?: number;
  }) => void;
  alCompletarCarga?: () => void;
  tipoDocumento: TipoDocumento;
  rangoTiempo: RangoTiempo;
}

const coloresTipoDocumento = {
  'FC': 'bg-blue-100 text-blue-700 border-blue-200',
  'ND': 'bg-red-100 text-red-700 border-red-200',
  'DS': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'RP': 'bg-green-100 text-green-700 border-green-200',
  'desconocido': 'bg-gray-100 text-gray-700 border-gray-200'
} as const;

const nombresTipoDocumento: Record<TipoDocumento, string> = {
  'FC': 'Factura de Compra',
  'ND': 'Nota Débito',
  'DS': 'Documento Soporte',
  'RP': 'Recibo de Pago'
};

export function CargarArchivo({ 
  alProcesarArchivo, 
  alCompletarCarga, 
  tipoDocumento, 
  rangoTiempo 
}: PropsCargarArchivo) {
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<ArchivoCargado[]>([]);

  const detectarTipoDocumento = (nombreArchivo: string): TipoDocumento | 'desconocido' => {
    if (!nombreArchivo) return 'desconocido';
    
    const nombre = nombreArchivo.toLowerCase().trim();
    
    const patrones = [
      { patron: /(^|[\s\-_.])(fc|factura[s]?[\s\-_]*compra)([\s\-_.]|$)/i, tipo: 'FC' as TipoDocumento },
      { patron: /(^|[\s\-_.])(nd|nota[s]?[\s\-_]*d[eé]bito)/i, tipo: 'ND' as TipoDocumento },
      { patron: /(^|[\s\-_.])(ds|documento[s]?[\s\-_]*soporte)/i, tipo: 'DS' as TipoDocumento },
      { patron: /(^|[\s\-_.])(rp|recibo[s]?[\s\-_]*pago)/i, tipo: 'RP' as TipoDocumento },
    ];
    
    for (const { patron, tipo } of patrones) {
      if (patron.test(nombre)) {
        return tipo;
      }
    }
    
    if (/factura|compra/i.test(nombre)) return 'FC';
    if (/nota|d[eé]bito/i.test(nombre)) return 'ND';
    if (/documento|soporte/i.test(nombre)) return 'DS';
    if (/recibo|pago/i.test(nombre)) return 'RP';
    
    return 'desconocido';
  };

  const procesarArchivos = async () => {
    if (archivos.length === 0) return;
    
    setCargando(true);
    setError(null);
    
    for (const archivo of archivos) {
      const idNotificacion = toast.loading(`Procesando ${archivo.archivo.name}...`);
      const datosFormulario = new FormData();
      datosFormulario.append('archivo', archivo.archivo);

      try {
        const respuesta = await fetch('/api/analiticas/procesar', {
          method: 'POST',
          body: datosFormulario,
        });

        if (!respuesta.ok) {
          throw new Error(`Error ${respuesta.status}: ${respuesta.statusText}`);
        }

        const resultado = await respuesta.json();
        
        if (!resultado.exito) {
          throw new Error(resultado.error || 'Error al procesar el archivo');
        }

        // Actualizar estado del archivo
        const archivoActualizado: ArchivoCargado = {
          ...archivo,
          estado: 'completado',
          datos: resultado.datos,
        };

        setArchivos(prev => 
          prev.map(a => a.archivo === archivo.archivo ? archivoActualizado : a)
        );

        // Notificar al componente padre
        if (alProcesarArchivo) {
          alProcesarArchivo({
            exito: true,
            valorTotal: resultado.datos?.valorTotal,
            tipoDocumento,
            filasProcesadas: resultado.datos?.procesado,
            nombreArchivo: archivo.archivo.name,
            tamanoArchivo: archivo.archivo.size
          });
        }

        toast.success(`Archivo ${archivo.archivo.name} procesado correctamente`, {
          id: idNotificacion
        });

      } catch (error) {
        console.error('Error procesando archivo:', error);
        setError(error instanceof Error ? error.message : 'Error desconocido');
        
        setArchivos(prev => 
          prev.map(a => 
            a.archivo === archivo.archivo 
              ? { ...a, estado: 'error', error: 'Error al procesar' } 
              : a
          )
        );

        toast.error(`Error al procesar ${archivo.archivo.name}`, {
          id: idNotificacion,
          description: error instanceof Error ? error.message : 'Intente nuevamente'
        });
      }
    }

    setCargando(false);
    if (alCompletarCarga) {
      alCompletarCarga();
    }
  };

  const onDrop = useCallback((archivosAceptados: File[]) => {
    const nuevosArchivos = archivosAceptados.map(archivo => ({
      archivo,
      tipo: detectarTipoDocumento(archivo.name),
      estado: 'cargando' as const,
    }));

    setArchivos(prev => [...prev, ...nuevosArchivos]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1,
    disabled: cargando
  });

  const eliminarArchivo = (archivoAEliminar: File) => {
    setArchivos(prev => prev.filter(a => a.archivo !== archivoAEliminar));
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400',
          cargando && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-2">
          <Upload className="h-10 w-10 text-gray-400" />
          <p className="text-sm text-gray-600">
            {isDragActive
              ? 'Suelta el archivo aquí...'
              : 'Arrastra y suelta archivos aquí, o haz clic para seleccionar'}
          </p>
          <p className="text-xs text-gray-500">
            Formatos soportados: .xlsx, .xls, .csv (máx. 50MB)
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {archivos.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Archivos seleccionados</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setArchivos([])}
              disabled={cargando}
            >
              Limpiar todo
            </Button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {archivos.map((archivo, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between p-3 rounded-md border',
                  archivo.estado === 'error' 
                    ? 'bg-red-50 border-red-200' 
                    : archivo.estado === 'completado'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-gray-200'
                )}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-5 w-5 text-gray-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {archivo.archivo.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">
                        {(archivo.archivo.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {archivo.tipo !== 'desconocido' && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full border',
                            coloresTipoDocumento[archivo.tipo as keyof typeof coloresTipoDocumento] ||
                            coloresTipoDocumento.desconocido
                          )}
                        >
                          {nombresTipoDocumento[archivo.tipo as TipoDocumento] || 'Desconocido'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {archivo.estado === 'cargando' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  )}
                  {archivo.estado === 'completado' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {archivo.estado === 'error' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      eliminarArchivo(archivo.archivo);
                    }}
                    disabled={cargando}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Button
              onClick={procesarArchivos}
              disabled={cargando || archivos.length === 0}
              className="w-full"
            >
              {cargando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                'Procesar archivos'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CargarArchivo;
