'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/analiticas/subir-archivo';
import { AnalyticsChart } from '@/components/analiticas/AnalyticsChart';
import type { DocumentType, ProcessedData } from '@/components/analiticas/AnalyticsChart';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const months = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

type UploadedFilesState = Record<DocumentType | 'unknown', number>;

// Función para formatear números en formato de moneda colombiana
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('panel');
  const [documentType, setDocumentType] = useState<DocumentType>('FC');
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<Record<DocumentType, ProcessedData | undefined>>({
    FC: { months: [], values: [], total: 0 },
    ND: { months: [], values: [], total: 0 },
    DS: { months: [], values: [], total: 0 },
    RP: { months: [], values: [], total: 0 }
  });
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({
    FC: 0,
    ND: 0,
    DS: 0,
    RP: 0,
    unknown: 0
  });

  // Cargar datos de la base de datos
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/analiticas/data');
      const result = await response.json();
      
      if (result.success) {
        const { data } = result;
        console.log('Datos recibidos del servidor:', data);
        
        // Inicializar el estado con los datos del servidor
        const updatedChartData = {
          FC: { months: data.labels, values: [], total: 0 },
          ND: { months: data.labels, values: [], total: 0 },
          DS: { months: data.labels, values: [], total: 0 },
          RP: { months: data.labels, values: [], total: 0 }
        } as Record<DocumentType, ProcessedData>;

        // Procesar los datasets del backend
        data.datasets.forEach((dataset: any) => {
          const docType = dataset.label as DocumentType;
          if (updatedChartData[docType] !== undefined) {
            const values = dataset.data.map((val: any) => Number(val) || 0);
            updatedChartData[docType] = {
              months: [...data.labels],
              values: values,
              total: values.reduce((a: number, b: number) => a + b, 0)
            };
          }
        });

        console.log('Datos procesados para el gráfico:', updatedChartData);
        setChartData(updatedChartData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Cargar datos al montar el componente
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const processExcelFile = useCallback(async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Obtener la primera hoja
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
          
          // Encontrar el índice de la fila de encabezado
          const headerRowIndex = jsonData.findIndex((row: unknown) => 
            Array.isArray(row) && row.some((cell: unknown) => 
              typeof cell === 'string' && cell.toLowerCase().includes('comprobante')
            )
          );
          
          if (headerRowIndex === -1) {
            throw new Error('No se encontró la fila de encabezado');
          }
          
          const headers = (jsonData[headerRowIndex] as string[]).map(h => h?.toString().toLowerCase() || '');
          const comprobanteIndex = headers.findIndex(h => h.includes('comprobante'));
          const fechaIndex = headers.findIndex(h => h.includes('fecha') && h.includes('elaboración'));
          const valorIndex = headers.findIndex(h => h.includes('valor'));
          
          if (comprobanteIndex === -1 || fechaIndex === -1 || valorIndex === -1) {
            throw new Error('No se encontraron las columnas requeridas en el archivo');
          }
          
          // Procesar filas de datos
          const processedData: Record<string, number[]> = {
            FC: Array(12).fill(0),
            ND: Array(12).fill(0),
            DS: Array(12).fill(0),
            RP: Array(12).fill(0)
          };
          
          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i] as (string | number | boolean | null)[];
            if (!row || !row[comprobanteIndex]) continue;
            
            const comprobanteValue = String(row[comprobanteIndex] || '');
            const docType = comprobanteValue.substring(0, 2).toUpperCase() as DocumentType;
            if (!['FC', 'ND', 'DS', 'RP'].includes(docType)) continue;
            
            // Procesar fecha
            let date: Date | null = null;
            const fechaValue = row[fechaIndex];
            if (fechaValue && typeof fechaValue === 'object' && 'getTime' in fechaValue) {
              date = fechaValue as unknown as Date;
            } else if (typeof fechaValue === 'number') {
              // Manejar números de fecha de Excel
              date = new Date((fechaValue - 25569) * 86400 * 1000);
            } else if (typeof fechaValue === 'string') {
              date = new Date(fechaValue);
            }
            
            if (!date || isNaN(date.getTime())) continue;
            
            const month = date.getMonth(); // 0-11
            const valueCell = row[valorIndex];
            const value = typeof valueCell === 'number' ? valueCell : 
                         typeof valueCell === 'string' ? parseFloat(valueCell) || 0 : 0;
            
            processedData[docType][month] += value;
          }
          
          // Configuración del gráfico
          const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top' as const,
                labels: {
                  boxWidth: 12,
                  padding: 10
                }
              },
              title: {
                display: true,
                text: `Análisis de ${documentType} (${timeRange})`,
                font: {
                  size: 14
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context: any) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.parsed.y !== null) {
                      label += formatCurrency(context.parsed.y);
                    }
                    return label;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: (value: any) => formatCurrency(Number(value))
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          };

          // Actualizar datos del gráfico
          setChartData({
            FC: {
              months,
              values: processedData.FC,
              total: processedData.FC.reduce((a, b) => a + b, 0)
            },
            ND: {
              months,
              values: processedData.ND,
              total: processedData.ND.reduce((a, b) => a + b, 0)
            },
            DS: {
              months,
              values: processedData.DS,
              total: processedData.DS.reduce((a, b) => a + b, 0)
            },
            RP: {
              months,
              values: processedData.RP,
              total: processedData.RP.reduce((a, b) => a + b, 0)
            }
          });
          
          resolve();
          
        } catch (error: unknown) {
          console.error('Error processing file:', error);
          reject(error);
        }
      };
      
      reader.onerror = (error: ProgressEvent<FileReader>) => {
        console.error('Error reading file:', error);
        reject(error);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }, [setChartData]);

  const handleFileProcessed = (result: { 
    success: boolean; 
    documentType: DocumentType; 
    totalValue?: number; 
    processedRows?: number; 
    filename?: string;
    shouldRefresh?: boolean;
  }) => {
    if (result.success) {
      // Actualizar el contador de archivos subidos
      setUploadedFiles(prev => ({
        ...prev,
        [result.documentType]: (prev[result.documentType] || 0) + 1
      }));
      
      // Forzar actualización de datos del gráfico
      if (result.shouldRefresh) {
        console.log('Actualizando datos del gráfico...');
        fetchData().then(() => {
          console.log('Datos del gráfico actualizados exitosamente');
        }).catch(error => {
          console.error('Error al actualizar los datos del gráfico:', error);
        });
      }
    }
  };

  const handleUploadComplete = () => {
    // toast.success('Carga de archivos completada');
  };

  const handleFilesUploaded = useCallback(async (files: Array<{ type: DocumentType; file: File }>) => {
    try {
      // Actualizar el contador de archivos subidos
      const newCounts = { ...uploadedFiles };
      files.forEach(({ type }) => {
        if (type in newCounts) {
          newCounts[type]++;
        } else {
          newCounts.unknown++;
        }
      });
      setUploadedFiles(newCounts);
      
      // Procesar archivos
      for (const { file } of files) {
        await processExcelFile(file);
      }
      
      // Recargar datos después de subir archivos
      await fetchData();
      
      // Cambiar a la pestaña del panel después del procesamiento
      setActiveTab('panel');
    } catch (error) {
      console.error('Error processing files:', error);
      alert('Error al procesar los archivos. Por favor, verifica el formato.');
    }
  }, [processExcelFile, uploadedFiles, fetchData]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Panel de Análisis</h1>
        <p className="text-muted-foreground">
          Carga y analiza tus archivos de transacciones
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="upload">Cargar Archivos</TabsTrigger>
            <TabsTrigger 
              value="panel" 
              disabled={Object.values(uploadedFiles).every(count => count === 0)}
            >
              Panel
            </TabsTrigger>
            <TabsTrigger value="reports" disabled>Reportes</TabsTrigger>
          </TabsList>
          {activeTab === 'panel' && (
            <button 
              onClick={fetchData}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Cargando...' : 'Actualizar Datos'}
            </button>
          )}
        </div>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cargar Archivos Excel</CardTitle>
              <CardDescription>
                Sube tus archivos de transacciones organizados por tipo y mes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload 
                documentType={documentType}
                timeRange={timeRange}
                onFileProcessed={handleFileProcessed}
                onUploadComplete={handleUploadComplete}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Instrucciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Tipos de Documentos</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li className="flex items-center">
                        <span className="inline-block w-8 h-4 rounded bg-blue-100 text-blue-800 text-xs flex items-center justify-center mr-2">FC</span>
                        Factura de Compra
                      </li>
                      <li className="flex items-center">
                        <span className="inline-block w-8 h-4 rounded bg-green-100 text-green-800 text-xs flex items-center justify-center mr-2">RP</span>
                        Recibo de Pago
                      </li>
                      <li className="flex items-center">
                        <span className="inline-block w-8 h-4 rounded bg-yellow-100 text-yellow-800 text-xs flex items-center justify-center mr-2">DS</span>
                        Documento Soporte
                      </li>
                      <li className="flex items-center">
                        <span className="inline-block w-8 h-4 rounded bg-red-100 text-red-800 text-xs flex items-center justify-center mr-2">ND</span>
                        Nota Débito
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="font-medium mb-2">Recomendaciones</h3>
                    <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-5">
                      <li>Asegúrate de que los archivos tengan el prefijo correcto (FC_, RP_, DS_, ND_)</li>
                      <li>Cada archivo debe contener datos de un solo mes</li>
                      <li>La primera fila debe contener los encabezados de las columnas</li>
                      <li>La primera columna debe contener las fechas de las transacciones</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progreso de Carga</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries({
                    FC: { label: 'Facturas de Compra', color: 'bg-blue-600' },
                    RP: { label: 'Recibos de Pago', color: 'bg-green-600' },
                    DS: { label: 'Documentos Soporte', color: 'bg-yellow-600' },
                    ND: { label: 'Notas Débito', color: 'bg-red-600' },
                    unknown: { label: 'Sin clasificar', color: 'bg-gray-400' },
                  } as const).map(([key, { label, color }]) => {
                    const count = uploadedFiles[key as keyof typeof uploadedFiles];
                    // Mostrar progreso solo para conteos mayores a cero o para la carga actual
                    if (count === 0 && key !== 'unknown') return null;
                    
                    const percentage = key === 'unknown' 
                      ? 0 
                      : Math.min(100, (count / 8) * 100);
                    
                    return (
                      <div key={key} className="flex items-center">
                        <span className={`inline-block w-8 h-4 rounded ${color} text-xs flex items-center justify-center mr-2`}>
                          {key}
                        </span>
                        <span className="text-sm">{label}</span>
                        <div className="flex-1 ml-4">
                          <progress className="w-full h-2" value={percentage} max="100" />
                        </div>
                        <span className="text-sm">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="panel">
          <div className="space-y-6">
            <div className="grid gap-6">
              {/* Resumen de totales */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(chartData).map(([type, data]) => (
                  <Card key={type} className="border-l-4 border-blue-500">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold">
                        {type === 'FC' ? 'Facturas de Compra' : 
                         type === 'ND' ? 'Notas Débito' :
                         type === 'DS' ? 'Documentos Soporte' : 'Recibos de Pago'}
                      </CardTitle>
                      <CardDescription className="text-2xl font-bold text-blue-600">
                        {formatCurrency(data?.total || 0)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {data?.values?.filter(v => v > 0).length || 0} meses con datos
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Gráfico principal */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Análisis por Mes</CardTitle>
                      <CardDescription>
                        Visualización de datos por tipo de documento
                      </CardDescription>
                    </div>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                      className="px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="FC">Facturas de Compra</option>
                      <option value="ND">Notas Débito</option>
                      <option value="DS">Documentos Soporte</option>
                      <option value="RP">Recibos de Pago</option>
                    </select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    {isLoading ? (
                      <div className="h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    ) : (
                      <AnalyticsChart 
                        title={
                          documentType === 'FC' ? 'Facturas de Compra' : 
                          documentType === 'ND' ? 'Notas Débito' :
                          documentType === 'DS' ? 'Documentos Soporte' : 'Recibos de Pago'
                        }
                        documentType={documentType}
                        timeRange={timeRange}
                        data={chartData[documentType]}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
