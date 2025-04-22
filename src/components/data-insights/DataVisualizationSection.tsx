import React from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColumnType } from './types';
import { DataCharts } from './DataCharts';

export interface DataVisualizationSectionProps {
    columns: ColumnType[];
    data: any[];
    processedData: any[];
    chartType: 'line' | 'bar' | null;
    setChartType: (type: 'line' | 'bar') => void;
    selectedDimension: string;
    setSelectedDimension: (dim: string) => void;
    selectedMetric: string;
    setSelectedMetric: (field: string) => void;
    selectedSecondaryMetric: string;
    setSelectedSecondaryMetric: (field: string) => void;
    groupingDimension?: ColumnType;
    groupingDimensionName?: string;
    groupByValue: string;
    setGroupByValue: (val: string) => void;
    loading: boolean;
    isTimeSeries: boolean;
}

export const DataVisualizationSection: React.FC<DataVisualizationSectionProps> = ({
    columns,
    data,
    processedData,
    chartType,
    setChartType,
    selectedDimension,
    setSelectedDimension,
    selectedMetric,
    setSelectedMetric,
    selectedSecondaryMetric,
    setSelectedSecondaryMetric,
    groupingDimension,
    groupingDimensionName,
    groupByValue,
    setGroupByValue,
    loading,
    isTimeSeries,
}) => {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xl font-semibold text-gray-800">
                    <Activity className="inline h-5 w-5 mr-2 text-blue-600" />3.5. Data Visualization
                </h2>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
                {/* Chart Controls */}
                <Card className="shadow-sm border border-gray-200 md:w-1/5 flex-shrink-0">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-gray-800">Chart Controls</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="chart-type" className="text-sm">Chart Type</Label>
                                <Select
                                    value={chartType || ''}
                                    onValueChange={(val) => setChartType(val as 'line' | 'bar')}
                                >
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder="Select chart type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bar">Bar Chart</SelectItem>
                                        <SelectItem value="line">Line Chart</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="dimension" className="text-sm">Dimension (X-Axis)</Label>
                                <Select value={selectedDimension} onValueChange={setSelectedDimension}>
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder="Select dimension" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {columns
                                            .filter(col => col.type === 'dimension' || col.type === 'date')
                                            .map(col => (
                                                <SelectItem key={col.field} value={col.field}>{col.name}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="metric" className="text-sm">Primary Metric</Label>
                                <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder="Select metric" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {columns
                                            .filter(col => col.type === 'metric')
                                            .map(col => (
                                                <SelectItem key={col.field} value={col.field}>{col.name}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label htmlFor="secondary-metric" className="text-sm">Secondary Metric (optional)</Label>
                                <Select value={selectedSecondaryMetric} onValueChange={setSelectedSecondaryMetric}>
                                    <SelectTrigger className="w-full mt-1">
                                        <SelectValue placeholder="Select second metric" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                        {columns
                                            .filter(col => col.type === 'metric' && col.field !== selectedMetric)
                                            .map(col => (
                                                <SelectItem key={col.field} value={col.field}>{col.name}</SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {isTimeSeries && groupingDimension && (
                                <div>
                                    <Label htmlFor="group-by-value" className="text-sm">Group by {groupingDimensionName}</Label>
                                    <Select value={groupByValue} onValueChange={setGroupByValue}>
                                        <SelectTrigger className="w-full mt-1">
                                            <SelectValue placeholder="All" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All</SelectItem>
                                            {Array.from(new Set(data.map(r => String(r[groupingDimension.field])))).map(val => (
                                                <SelectItem key={val} value={val}>{val}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Chart Display */}
                <Card className="shadow-sm border border-gray-200 md:w-4/5 h-full">
                    <CardHeader className="pb-1">
                        <CardTitle className="text-lg font-semibold text-gray-800">Chart</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-8">
                        {selectedMetric && selectedDimension && chartType ? (
                            <DataCharts
                                chartType={chartType}
                                chartData={{
                                    title: `${columns.find(c => c.field === selectedMetric)?.name || selectedMetric} by ${columns.find(c => c.field === selectedDimension)?.name || selectedDimension}`,
                                    xField: selectedDimension,
                                    yField: selectedMetric,
                                    data: processedData
                                }}
                                secondaryMetric={
                                    selectedSecondaryMetric && selectedSecondaryMetric !== 'none' ? {
                                        field: selectedSecondaryMetric,
                                        name: columns.find(c => c.field === selectedSecondaryMetric)?.name || selectedSecondaryMetric
                                    } : undefined
                                }
                            />
                        ) : (
                            <div className="flex items-center justify-center h-[350px] bg-gray-50 rounded-md border border-dashed border-gray-300">
                                <p className="text-gray-500 text-sm">Select a dimension and metric to visualize</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}; 