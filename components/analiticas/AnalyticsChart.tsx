'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartData, ChartOptions, ScriptableContext } from 'chart.js';
import { toast } from 'sonner';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Dynamic import for Bar chart with SSR disabled
const Bar = dynamic<{
  data: ChartData<'bar'>;
  options: ChartOptions<'bar'>;
  width?: number;
  height?: number;
}>(() => import('react-chartjs-2').then((mod) => mod.Bar), { 
  ssr: false 
});

// Constantes
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
] as const;

// Tipos
export type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type DocumentType = 'FC' | 'ND' | 'DS' | 'RP';

export interface ChartDataResponse {
  labels: string[];
  values: number[];
  total: number;
}

interface ChartColors {
  background: string;
  border: string;
  gradient: (context: ScriptableContext<'bar'>) => CanvasGradient | string;
}

interface ApiChartDataResponse {
  success: boolean;
  data?: {
    labels: string[];
    values: number[];
    total: string;
    count: number;
    documentType: string;
    timeRange: string;
  };
  error?: string;
}

export interface AnalyticsChartProps {
  title: string;
  documentType: DocumentType;
  timeRange?: TimeRange;
  className?: string;
}

//Configuraciones de color 
const CHART_COLORS: Record<DocumentType, ChartColors> = {
  FC: {
    background: 'rgba(59, 130, 246, 0.5)',
    border: 'rgb(59, 130, 246)',
    gradient: (context: ScriptableContext<'bar'>) => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      if (!chartArea) return 'rgba(59, 130, 246, 0.5)';
      
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.1)');
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.8)');
      return gradient;
    }
  },
  ND: {
    background: 'rgba(239, 68, 68, 0.5)',
    border: 'rgb(239, 68, 68)',
    gradient: (context: ScriptableContext<'bar'>) => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      if (!chartArea) return 'rgba(239, 68, 68, 0.5)';
      
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.8)');
      return gradient;
    }
  },
  DS: {
    background: 'rgba(245, 158, 11, 0.5)',
    border: 'rgb(245, 158, 11)',
    gradient: (context: ScriptableContext<'bar'>) => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      if (!chartArea) return 'rgba(245, 158, 11, 0.5)';
      
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, 'rgba(245, 158, 11, 0.1)');
      gradient.addColorStop(1, 'rgba(245, 158, 11, 0.8)');
      return gradient;
    }
  },
  RP: {
    background: 'rgba(16, 185, 129, 0.5)',
    border: 'rgb(16, 185, 129)',
    gradient: (context: ScriptableContext<'bar'>) => {
      const chart = context.chart;
      const { ctx, chartArea } = chart;
      if (!chartArea) return 'rgba(16, 185, 129, 0.5)';
      
      const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.1)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.8)');
      return gradient;
    }
  }
} as const;

export function AnalyticsChart({ 
  title, 
  documentType, 
  timeRange = 'month', 
  className = '' 
}: AnalyticsChartProps) {
  // State for chart data and UI
  const [chartData, setChartData] = useState<{
    labels: string[];
    values: number[];
    total: string;
  }>({ labels: [], values: [], total: '0' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Set mounted state on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch chart data
  useEffect(() => {
    const obtenerDatosGrafico = async () => {
      if (!isMounted) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const respuesta = await fetch('/api/analiticas/obtener-datos');
        
        if (!respuesta.ok) {
          throw new Error('Error al cargar los datos del gráfico');
        }
        
        const resultado = await respuesta.json();
        
        if (resultado.exito && resultado.datos) {
          // Encontrar los datos para el tipo de documento seleccionado
          const datosFiltrados = resultado.datos.conjuntosDatos.find(
            (conjunto: { etiqueta: string }) => conjunto.etiqueta === documentType
          ) || { datos: Array(12).fill(0), total: 0 };
          
          setChartData({
            labels: resultado.datos.etiquetas || [],
            values: datosFiltrados.datos || Array(12).fill(0),
            total: (datosFiltrados.total || 0).toFixed(2)
          });
        } else {
          throw new Error(resultado.error || 'Error desconocido al cargar los datos');
        }
      } catch (error) {
        const mensajeError = error instanceof Error ? error.message : 'Error desconocido';
        console.error('Error al obtener datos:', mensajeError);
        setError('No se pudieron cargar los datos. Por favor, intente nuevamente.');
        toast.error('Error al cargar los datos del gráfico');
      } finally {
        setIsLoading(false);
      }
    };

    obtenerDatosGrafico();
  }, [documentType, isMounted]);

  // Obtener año actual para mostrar en el título
  const añoActual = 2025; // Fijamos el año 2025 según lo solicitado
  
  // Obtener colores para el tipo de documento actual
  const colores = CHART_COLORS[documentType] || CHART_COLORS.FC; // Usar FC como valor por defecto
  
  // Preparar datos para el gráfico
  const valoresGrafico = useMemo(() => 
    chartData.values?.length > 0 ? chartData.values : Array(12).fill(0), 
    [chartData.values]
  );
  
  const etiquetasGrafico = useMemo(() => 
    chartData.labels?.length > 0 ? chartData.labels : 
    Array.from({ length: 12 }, (_, i) => {
      const fecha = new Date();
      fecha.setMonth(fecha.getMonth() - (11 - i));
      return fecha.toLocaleString('es-ES', { month: 'short' });
    }), 
    [chartData.labels]
  );
  
  // Calcular total
  const totalGrafico = useMemo(() => 
    parseFloat(chartData.total) || 0, 
    [chartData.total]
  );

  const configuracionGrafico: ChartData<'bar'> = useMemo(() => ({
    labels: etiquetasGrafico,
    datasets: [
      {
        label: documentType,
        data: valoresGrafico,
        backgroundColor: colores.gradient,
        borderColor: colores.border,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
        barThickness: 20,
        maxBarThickness: 30,
      },
    ],
  }), [etiquetasGrafico, valoresGrafico, documentType, colores]);

  // Mostrar un estado de carga o null durante SSR
  if (typeof window === 'undefined' || isLoading) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow flex items-center justify-center h-80 ${className}`}>
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
          <p className="text-sm text-gray-500">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
        <div className="text-center py-8">
          <p className="text-red-500 mb-2">Error al cargar los datos</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Loading and error states are already handled by the main rendering logic

  return (
    <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">{title} - {añoActual}</h3>
        <div className="text-sm font-medium">
          Total: <span className="text-blue-600">{formatValue(totalGrafico)}</span>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {}}
            disabled={true}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {}}
            disabled={true}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="h-64">
        {chartData.labels.length > 0 ? (
          <Bar
            data={configuracionGrafico}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    label: (context: any) => formatValue(context.parsed.y)
                  }
                }
              },
              scales: {
                x: {
                  grid: {
                    display: false,
                  },
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value: any) => {
                      if (typeof value === 'number') {
                        return formatValue(value);
                      }
                      return value;
                    },
                  },
                },
              },
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            No hay datos disponibles para el rango seleccionado
          </div>
        )}
      </div>
      
      <div className="text-right">
        <p className="text-sm text-gray-600">
          Total {documentType} {añoActual}: 
          <span className="ml-2 font-semibold text-foreground">
            {formatValue(totalGrafico)}
          </span>
        </p>
      </div>
    </div>
  );
}