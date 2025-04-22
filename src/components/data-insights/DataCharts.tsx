import React, { useEffect, useState } from 'react';
import { ChartDataType } from './types';
import { format, parseISO, isValid } from 'date-fns';

interface DataChartsProps {
    chartType: 'line' | 'bar' | null;
    chartData: ChartDataType;
    secondaryMetric?: {
        field: string;
        name: string;
    };
}

const formatDateValue = (value: any): string => {
    if (!value) return '';

    try {
        // If it's already a Date object
        if (value instanceof Date && !isNaN(value.getTime())) {
            return format(value, 'MMM d');
        }

        // If it's a string, try to parse it
        if (typeof value === 'string') {
            // Check if it's an ISO date string
            const date = parseISO(value);
            if (isValid(date)) {
                return format(date, 'MMM d');
            }
        }

        // Default case - return as is
        return String(value);
    } catch (e) {
        return String(value);
    }
};

// Helper to parse dates from various formats
const parseDate = (value: any): Date | null => {
    if (!value) return null;

    // If it's already a Date object
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value;
    }

    // If it's a string, try to parse it
    if (typeof value === 'string') {
        const date = parseISO(value);
        if (isValid(date)) {
            return date;
        }
    }

    return null;
};

// Sort data by date field for time series
const sortDataByDate = (data: any[], field: string): any[] => {
    return [...data].sort((a, b) => {
        const dateA = parseDate(a[field]);
        const dateB = parseDate(b[field]);

        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
    });
};

// Limit the number of x-axis labels for better readability
const limitXAxisLabels = (data: any[], maxLabels: number = 12): any[] => {
    if (data.length <= maxLabels) return data;

    const step = Math.ceil(data.length / maxLabels);
    return data.filter((_, index) => index % step === 0);
};

export const DataCharts: React.FC<DataChartsProps> = ({ chartType, chartData, secondaryMetric }) => {
    const [debugInfo, setDebugInfo] = useState<string>('');

    useEffect(() => {
        // Debug info about the chart data
        if (chartData && chartData.data && chartData.data.length > 0) {
            const info = {
                chartType,
                dataPoints: chartData.data.length,
                xField: chartData.xField,
                yField: chartData.yField,
                secondaryField: secondaryMetric?.field,
                sampleData: chartData.data.slice(0, 2),
                isTimeSeries: false
            };

            // Check if it's time series data
            if (chartData.data.length > 0) {
                const firstPoint = chartData.data[0];
                info.isTimeSeries = firstPoint[chartData.xField] instanceof Date ||
                    (typeof firstPoint[chartData.xField] === 'string' &&
                        isValid(parseISO(firstPoint[chartData.xField] as string)));
            }

            setDebugInfo(JSON.stringify(info, null, 2));
        }
    }, [chartData, chartType, secondaryMetric]);

    if (!chartData || !chartType) return null;

    const { data, xField, yField, title } = chartData;
    if (data.length === 0) {
        return <div className="p-4 text-gray-500">No data available to chart</div>;
    }

    const hasSecondaryMetric = secondaryMetric && secondaryMetric.field && secondaryMetric.field !== 'none';

    // Check if data is time series by looking at first data point
    const isTimeSeries = data.length > 0 && (
        data[0][xField] instanceof Date ||
        (typeof data[0][xField] === 'string' && isValid(parseISO(data[0][xField] as string)))
    );

    // Sort the data if it's time series
    const sortedData = isTimeSeries ? sortDataByDate(data, xField) : [...data];

    // Get visible X-axis labels (limit them for readability)
    const visibleLabels = limitXAxisLabels(sortedData);

    // Primary metric values for calculation
    const safeValues = sortedData.map(d => {
        const val = d[yField];
        return typeof val === 'number' ? val : isNaN(Number(val)) ? 0 : Number(val);
    });

    const maxValue = Math.max(...safeValues, 1); // Ensure we don't divide by zero

    // Secondary metric values if exists
    let safeSecondaryValues: number[] = [];
    let maxSecondaryValue = 0;

    if (hasSecondaryMetric) {
        safeSecondaryValues = sortedData.map(d => {
            const val = d[secondaryMetric.field];
            return typeof val === 'number' ? val : isNaN(Number(val)) ? 0 : Number(val);
        });
        maxSecondaryValue = Math.max(...safeSecondaryValues, 1);
    }

    const chartHeight = 300;

    // Different rendering for line chart vs bar chart
    if (chartType === 'line') {
        // Create line chart points for SVG path 
        const pointsForPath = sortedData.map((point, index) => {
            const val = point[yField];
            const value = typeof val === 'number' ? val : Number(val) || 0;
            const normalizedHeight = chartHeight - (value / maxValue) * chartHeight;
            // Calculate x position based on index and total width
            const xPosition = (index / (sortedData.length - 1)) * 100;
            return `${xPosition},${normalizedHeight}`;
        }).join(' ');

        // Secondary line points if secondary metric exists
        const secondaryPointsForPath = hasSecondaryMetric ? sortedData.map((point, index) => {
            const val = point[secondaryMetric.field];
            const value = typeof val === 'number' ? val : Number(val) || 0;
            const normalizedHeight = chartHeight - (value / maxSecondaryValue) * chartHeight;
            const xPosition = (index / (sortedData.length - 1)) * 100;
            return `${xPosition},${normalizedHeight}`;
        }).join(' ') : '';

        return (
            <div className="mt-4 h-full">
                <h3 className="text-lg font-medium mb-2">{title}{hasSecondaryMetric ? ` & ${secondaryMetric.name}` : ''}</h3>
                <div className="border p-4 rounded-md bg-white">
                    <div className="h-[350px] relative">
                        {/* Left Y-Axis Labels */}
                        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-gray-500">
                            <span>{maxValue.toFixed(0)}</span>
                            <span>{(maxValue / 2).toFixed(0)}</span>
                            <span>0</span>
                        </div>

                        {/* Right Y-Axis Labels (if secondary metric) */}
                        {hasSecondaryMetric && (
                            <div className="absolute right-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-gray-500">
                                <span>{maxSecondaryValue.toFixed(0)}</span>
                                <span>{(maxSecondaryValue / 2).toFixed(0)}</span>
                                <span>0</span>
                            </div>
                        )}

                        {/* Chart Area using SVG for actual line charts */}
                        <div className={`ml-10 ${hasSecondaryMetric ? 'mr-10' : ''} h-full relative`}>
                            <svg
                                width="100%"
                                height={chartHeight}
                                viewBox={`0 0 100 ${chartHeight}`}
                                preserveAspectRatio="none"
                                className="overflow-visible"
                            >
                                {/* Primary line */}
                                <polyline
                                    points={pointsForPath}
                                    fill="none"
                                    stroke="#3b82f6" /* blue-500 */
                                    strokeWidth="2"
                                    vectorEffect="non-scaling-stroke"
                                />

                                {/* Points on the primary line */}
                                {sortedData.map((point, index) => {
                                    const val = point[yField];
                                    const value = typeof val === 'number' ? val : Number(val) || 0;
                                    const normalizedHeight = chartHeight - (value / maxValue) * chartHeight;
                                    const xPosition = (index / (sortedData.length - 1)) * 100;

                                    return (
                                        <circle
                                            key={`primary-${index}`}
                                            cx={xPosition}
                                            cy={normalizedHeight}
                                            r="0.7"
                                            fill="#3b82f6" /* blue-500 */
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    );
                                })}

                                {/* Secondary line if exists */}
                                {hasSecondaryMetric && (
                                    <>
                                        <polyline
                                            points={secondaryPointsForPath}
                                            fill="none"
                                            stroke="#10b981" /* green-500 */
                                            strokeWidth="2"
                                            vectorEffect="non-scaling-stroke"
                                        />

                                        {/* Points on the secondary line */}
                                        {sortedData.map((point, index) => {
                                            const val = point[secondaryMetric.field];
                                            const value = typeof val === 'number' ? val : Number(val) || 0;
                                            const normalizedHeight = chartHeight - (value / maxSecondaryValue) * chartHeight;
                                            const xPosition = (index / (sortedData.length - 1)) * 100;

                                            return (
                                                <circle
                                                    key={`secondary-${index}`}
                                                    cx={xPosition}
                                                    cy={normalizedHeight}
                                                    r="0.7"
                                                    fill="#10b981" /* green-500 */
                                                    vectorEffect="non-scaling-stroke"
                                                />
                                            );
                                        })}
                                    </>
                                )}
                            </svg>

                            {/* X-Axis Labels */}
                            <div className="flex justify-between absolute bottom-[-25px] left-0 right-0">
                                {visibleLabels.map((item, index) => {
                                    const label = isTimeSeries ? formatDateValue(item[xField]) : item[xField]?.toString() || '';
                                    // Calculate position based on index in full dataset
                                    const originalIndex = sortedData.findIndex(d => d === item);
                                    const position = (originalIndex / (sortedData.length - 1)) * 100;

                                    return (
                                        <div
                                            key={index}
                                            className="text-xs text-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap absolute"
                                            style={{ left: `${position}%` }}
                                        >
                                            {label}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Legend */}
                        {hasSecondaryMetric && (
                            <div className="absolute top-[-25px] right-2 flex items-center text-xs">
                                <div className="flex items-center mr-3">
                                    <div className="w-3 h-3 bg-blue-500 mr-1"></div>
                                    <span>{chartData.title.split(' by ')[0]}</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 bg-green-500 mr-1"></div>
                                    <span>{secondaryMetric.name}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (chartType === 'bar') {
        return (
            <div className="mt-4 h-full">
                <h3 className="text-lg font-medium mb-2">{title}{hasSecondaryMetric ? ` & ${secondaryMetric.name}` : ''}</h3>
                <div className="border p-4 rounded-md bg-white">
                    <div className="h-[350px] relative">
                        {/* Left Y-Axis Labels */}
                        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-gray-500">
                            <span>{maxValue.toFixed(0)}</span>
                            <span>{(maxValue / 2).toFixed(0)}</span>
                            <span>0</span>
                        </div>

                        {/* Right Y-Axis Labels (if secondary metric) */}
                        {hasSecondaryMetric && (
                            <div className="absolute right-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-gray-500">
                                <span>{maxSecondaryValue.toFixed(0)}</span>
                                <span>{(maxSecondaryValue / 2).toFixed(0)}</span>
                                <span>0</span>
                            </div>
                        )}

                        {/* Chart Area */}
                        <div className={`ml-10 ${hasSecondaryMetric ? 'mr-10' : ''} h-full flex items-end`}>
                            {/* Use visible labels to limit overcrowding */}
                            {visibleLabels.map((item, index) => {
                                const val = item[yField];
                                const value = typeof val === 'number' ? val : Number(val) || 0;
                                const height = (value / maxValue) * 100;
                                const label = isTimeSeries ? formatDateValue(item[xField]) : item[xField]?.toString() || '';

                                // Calculate position for the bar in the full dataset
                                const originalIndex = sortedData.indexOf(item);

                                // Secondary value (if exists)
                                let secondaryHeight = 0;
                                if (hasSecondaryMetric) {
                                    const secondaryVal = item[secondaryMetric.field];
                                    const secondaryValue = typeof secondaryVal === 'number' ? secondaryVal : Number(secondaryVal) || 0;
                                    secondaryHeight = (secondaryValue / maxSecondaryValue) * 100;
                                }

                                // Calculate the width based on total items
                                const barWidth = 100 / visibleLabels.length;
                                const barStyle = { width: `${barWidth}%` };

                                return (
                                    <div key={index} className="flex flex-col items-center h-full" style={barStyle}>
                                        <div className="relative flex items-end h-full w-full">
                                            {/* Primary Bar */}
                                            <div className="absolute bottom-0 left-[15%] w-[30%] bg-blue-500 rounded-t-sm"
                                                style={{ height: `${Math.max(height, 1)}%` }}></div>

                                            {/* Secondary Bar (if exists) */}
                                            {hasSecondaryMetric && (
                                                <div className="absolute bottom-0 right-[15%] w-[30%] bg-green-500 rounded-t-sm"
                                                    style={{ height: `${Math.max(secondaryHeight, 1)}%` }}></div>
                                            )}
                                        </div>

                                        {/* X-Axis Label */}
                                        <div className="text-xs mt-2 text-gray-500 transform -rotate-45 origin-top-left whitespace-nowrap">
                                            {label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        {hasSecondaryMetric && (
                            <div className="absolute top-[-25px] right-2 flex items-center text-xs">
                                <div className="flex items-center mr-3">
                                    <div className="w-3 h-3 bg-blue-500 mr-1"></div>
                                    <span>{chartData.title.split(' by ')[0]}</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-3 h-3 bg-green-500 mr-1"></div>
                                    <span>{secondaryMetric.name}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
}; 