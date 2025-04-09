import React from 'react';
import { ChartDataType } from './types';

interface DataChartsProps {
    chartType: 'line' | 'bar' | null;
    chartData: ChartDataType;
}

export const DataCharts: React.FC<DataChartsProps> = ({ chartType, chartData }) => {
    if (!chartData || !chartType) return null;

    const { data, xField, yField, title } = chartData;

    // Safely extract numeric values
    const safeValues = data.map(d => {
        const val = d[yField];
        return typeof val === 'number' ? val : isNaN(Number(val)) ? 0 : Number(val);
    });

    const maxValue = Math.max(...safeValues, 1); // Ensure we don't divide by zero
    const chartHeight = 200;

    if (chartType === 'line') {
        return (
            <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">{title}</h3>
                <div className="border p-4 rounded-md bg-white">
                    <div className="h-52 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-gray-500">
                            <span>{maxValue.toFixed(0)}</span>
                            <span>{(maxValue / 2).toFixed(0)}</span>
                            <span>0</span>
                        </div>
                        <div className="ml-10 h-full flex items-end">
                            {data.map((point, index) => {
                                const val = point[yField];
                                const value = typeof val === 'number' ? val : Number(val) || 0;
                                const height = (value / maxValue) * chartHeight;
                                const label = point[xField]?.toString() || '';

                                return (
                                    <div key={index} className="flex flex-col items-center mx-1">
                                        <div
                                            className="w-4 bg-blue-500 rounded-t-sm"
                                            style={{ height: `${Math.max(height, 1)}px` }}
                                        ></div>
                                        <div className="text-xs mt-1 text-gray-500 transform -rotate-45 origin-top-left">
                                            {label.length > 5
                                                ? label.substring(0, 5) + '...'
                                                : label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (chartType === 'bar') {
        return (
            <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">{title}</h3>
                <div className="border p-4 rounded-md bg-white">
                    <div className="h-52 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-gray-500">
                            <span>{maxValue.toFixed(0)}</span>
                            <span>{(maxValue / 2).toFixed(0)}</span>
                            <span>0</span>
                        </div>
                        <div className="ml-10 h-full flex items-end space-x-6 justify-around">
                            {data.map((item, index) => {
                                const val = item[yField];
                                const value = typeof val === 'number' ? val : Number(val) || 0;
                                const height = (value / maxValue) * 100;
                                const label = item[xField]?.toString() || '';

                                return (
                                    <div key={index} className="flex flex-col items-center">
                                        <div
                                            className="w-16 bg-green-500 rounded-t-sm"
                                            style={{ height: `${Math.max(height, 1)}%` }}
                                        ></div>
                                        <div className="text-xs mt-1 text-gray-500">
                                            {label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}; 