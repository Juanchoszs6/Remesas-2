'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
  ScriptableContext,
} from 'chart.js';
import { toast } from 'sonner';

// registro de componentes de chartjs
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Constantes
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
] as const;

// Tipos
export type TimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type DocumentType = 'FC' | 'ND' | 'DS' | 'RP';

interface ChartColors {
  background: string;
  border: string;
  gradient: (context: ScriptableContext<'bar'>) => CanvasGradient | string;
}

export interface ChartDataResponse {
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
  const [chartData, setChartData] = useState<{
    labels: string[];
    values: number[];
    total: string;
  }>({ labels: [], values: [], total: '0' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChartData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(
          `/api/analiticas/chart-data?documentType=${documentType}&timeRange=${timeRange}`
        );
        
        if (!response.ok) {
          throw new Error('Error al cargar los datos del gráfico');
        }
        
        const result: ChartDataResponse = await response.json();
        
        if (result.success && result.data) {
          setChartData({
            labels: result.data.labels,
            values: result.data.values,
            total: result.data.total
          });
        } else {
          throw new Error(result.error || 'Error desconocido al cargar los datos');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        toast.error(`Error: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChartData();
  }, [documentType, timeRange]);
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const colors = CHART_COLORS[documentType];
  
  const chartValues = useMemo(() => chartData.values || Array(12).fill(0), [chartData.values]);
  const chartMonths = useMemo(() => chartData.labels || [...MONTHS], [chartData.labels]);
  const total = useMemo(() => {
    return parseFloat(chartData.total) || 0;
  }, [chartData.total]);

  const chartDataConfig: ChartData<'bar'> = useMemo(() => ({
    labels: chartData.labels,
    datasets: [
      {
        label: 'Total',
        data: chartData.values,
        backgroundColor: CHART_COLORS[documentType].gradient,
        borderColor: CHART_COLORS[documentType].border,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }), [chartData, documentType]);

  if (isLoading) {
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

  return (
    <div className={`p-4 bg-white rounded-lg shadow ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">
            Total: ${total.toLocaleString('es-CO', { style: 'decimal' })}
          </p>
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
            data={chartDataConfig}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      const value = context.parsed.y;
                      return `$${value.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
                    },
                  },
                },
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
                    callback: (value) => {
                      if (typeof value === 'number') {
                        return `$${value.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
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
          Total {documentType} {selectedYear}: 
          <span className="ml-2 font-semibold text-foreground">
            ${chartTotal.toLocaleString()}
          </span>
        </p>
      </div>
    </div>
  );
}