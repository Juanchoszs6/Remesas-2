'use client';

import { useState, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Constants
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
] as const;

// Types
export type TimeRange = 'month' | 'quarter' | 'year';
export type DocumentType = 'FC' | 'ND' | 'DS' | 'RP';

interface ChartColors {
  background: string;
  border: string;
  gradient: (context: ScriptableContext<'bar'>) => CanvasGradient | string;
}

export interface ProcessedData {
  months?: string[];
  values?: number[];
  total?: number;
  [key: string]: unknown;
}

export interface AnalyticsChartProps {
  title: string;
  documentType: DocumentType;
  timeRange?: TimeRange;
  data?: ProcessedData;
  className?: string;
}

// Color configurations
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
  data, 
  timeRange = 'month',
  className = ''
}: AnalyticsChartProps) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const colors = CHART_COLORS[documentType];
  
  // Safely access values with fallbacks
  const chartValues = useMemo(() => data?.values || Array(12).fill(0), [data?.values]);
  const chartMonths = useMemo(() => data?.months || [...MONTHS], [data?.months]);
  const chartTotal = useMemo(() => 
    data?.total !== undefined ? data.total : chartValues.reduce((sum, val) => sum + val, 0),
    [data?.total, chartValues]
  );
  
  // Memoize chart data to prevent unnecessary re-renders
  const chartData = useMemo<ChartData<'bar', number[], string>>(() => ({
    labels: chartMonths,
    datasets: [{
      label: title,
      data: chartValues,
      backgroundColor: colors.gradient,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
    }],
  }), [chartMonths, chartValues, title, colors]);

  const chartOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: 'easeInOutQuart' as const
    },
    layout: {
      padding: {
        top: 30,
        right: 10,
        bottom: 40,  // Adjusted bottom padding
        left: 10
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, weight: 600 },
        bodyFont: { size: 13, weight: 500 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: (items) => items[0].label,
          label: (context) => `Total: $${context.parsed.y.toLocaleString()}`,
          labelColor: () => ({
            borderColor: 'transparent',
            backgroundColor: colors.border,
            borderRadius: 4,
          }),
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0, 0, 0, 0.05)', drawBorder: false },
        ticks: {
          color: 'rgba(0, 0, 0, 0.6)',
          font: { size: 12 },
          callback: (value) => `$${Number(value).toLocaleString()}`,
          padding: 10,
        },
      },
      x: {
        grid: { display: false, drawBorder: false },
        ticks: {
          color: 'rgba(0, 0, 0, 0.7)',
          font: { size: 12, weight: 500 },
          maxRotation: 0,
          autoSkip: false,
          padding: 10,
          callback: (value: number | string, index: number, values) => {
            // Get the full month name from the chart's labels
            const monthName = chartMonths[index] || '';
            // Return the first 3 letters of the month name
            return monthName.substring(0, 3);
          }
        },
      },
    },
  }), [colors.border]);

  const handleYearChange = (increment: number) => {
    setSelectedYear(prev => {
      const newYear = prev + increment;
      return newYear >= 2024 && newYear <= currentYear ? newYear : prev;
    });
  };

  const handlePreviousYear = () => handleYearChange(-1);
  const handleNextYear = () => handleYearChange(1);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{title} - {selectedYear}</h3>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handlePreviousYear}
            disabled={selectedYear <= 2024}
            className="h-8 w-8"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-16 text-center font-medium">{selectedYear}</span>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleNextYear}
            disabled={selectedYear >= currentYear}
            className="h-8 w-8"
            aria-label="Next year"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="relative h-[450px] w-full bg-white rounded-lg p-4 shadow-sm border overflow-hidden">
        {/* Removed duplicate month labels from background */}
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
          <div className="w-full h-full grid grid-cols-12 gap-0">
            {MONTHS.map((month) => (
              <div 
                key={month}
                className="h-full border-r border-gray-100"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
        <div className="relative h-full w-full">
          <Bar 
            options={chartOptions} 
            data={chartData} 
            aria-label={`${title} chart for ${selectedYear}`}
          />
        </div>
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