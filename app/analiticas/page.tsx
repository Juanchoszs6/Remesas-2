'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUpload } from '@/components/analiticas/FileUpload';
import { AnalyticsChart } from '@/components/analiticas/AnalyticsChart';
import type { DocumentType, ProcessedData } from '@/components/analiticas/AnalyticsChart';
import * as XLSX from 'xlsx';

const months = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

type UploadedFilesState = Record<DocumentType | 'unknown', number>;

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('upload');
  const [documentType, setDocumentType] = useState<DocumentType>('FC');
  const [timeRange, setTimeRange] = useState<'month' | 'quarter' | 'year'>('month');
  const [chartData, setChartData] = useState<Record<DocumentType, ProcessedData | undefined>>({
    FC: undefined,
    ND: undefined,
    DS: undefined,
    RP: undefined
  });
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFilesState>({
    FC: 0,
    ND: 0,
    DS: 0,
    RP: 0,
    unknown: 0
  });

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

  const handleFileProcessed = (data: any) => {
    console.log('File processed:', data);
    if (data?.type && data.type in chartData) {
      setChartData(prev => ({
        ...prev,
        [data.type as DocumentType]: data
      }));
    }
    // toast.success('Archivo procesado correctamente');
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
      
      // Cambiar a la pestaña del panel después del procesamiento
      setActiveTab('panel');
    } catch (error) {
      console.error('Error processing files:', error);
      alert('Error al procesar los archivos. Por favor, verifica el formato.');
    }
  }, [processExcelFile, uploadedFiles]);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Panel de Análisis</h1>
        <p className="text-muted-foreground">
          Carga y analiza tus archivos de transacciones
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Facturas de Compra (FC)</CardTitle>
                <CardDescription>
                  Resumen mensual de facturas de compra
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsChart 
                  title="Facturas de Compra" 
                  documentType="FC"
                  data={chartData.FC}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análisis de Notas Débito (ND)</CardTitle>
                <CardDescription>
                  Resumen mensual de notas débito
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsChart 
                  title="Notas Débito" 
                  documentType="ND"
                  data={chartData.ND}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análisis de Documentos Soporte (DS)</CardTitle>
                <CardDescription>
                  Resumen mensual de documentos soporte
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsChart 
                  title="Documentos Soporte" 
                  documentType="DS"
                  data={chartData.DS}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análisis de Recibos de Pago (RP)</CardTitle>
                <CardDescription>
                  Resumen mensual de recibos de pago
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalyticsChart 
                  title="Recibos de Pago" 
                  documentType="RP"
                  data={chartData.RP}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
