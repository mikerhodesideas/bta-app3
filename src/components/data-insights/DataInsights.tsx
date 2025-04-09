import React, { useState, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, Trash2, PlusCircle, ArrowUpDown, X, Edit, LineChart, BarChart, Activity, BrainCircuit, MessageSquareWarning, Loader2, SearchCheck, FileBarChart2, ListFilter } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useDataInsights, PREVIEW_ROW_OPTIONS } from './useDataInsights';
import { DataCharts } from './DataCharts';
import { ColumnType, FilterOperatorType, OutlierType } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export const DataInsights: React.FC = () => {
    const {
        dataSources,
        selectedSource,
        setSelectedSource,
        data,
        columns,
        loading,
        isGeneratingLocalInsights,
        loadingInsights,
        totalRows,
        filteredRows,
        filters,
        sortConfig,
        localInsightsSummary,
        outliers,
        insights,
        apiError,
        showChart,
        chartData,
        chartType,
        addFilter: addFilterBase,
        updateFilter,
        removeFilter,
        handleSort,
        startInsightProcess,
        handleOutlierDecisionAndGenerateApiInsights,
        getFilterOperatorsForType,
        previewRowCount,
        setPreviewRowCount,
        generateChart
    } = useDataInsights();

    // Local state
    const [activeFilterId, setActiveFilterId] = useState<number | null>(null);
    const [prompt, setPrompt] = useState<string>(
        "Analyze this filtered dataset focusing on performance trends, anomalies, and actionable recommendations for optimization."
    );
    // Track which step the insight process is in
    const [insightWorkflowStep, setInsightWorkflowStep] = useState<'idle' | 'localSummary' | 'outlierDecision' | 'apiInsights'>('idle');

    // Reset workflow step when source or filters change significantly
    useEffect(() => {
        setInsightWorkflowStep('idle');
    }, [selectedSource, filters]);

    const addFilter = () => {
        if (filters.length >= 5) return;
        const newFilterId = Date.now();
        addFilterBase();
        setActiveFilterId(newFilterId);
    };

    useEffect(() => {
        if (filters.length === 0) {
            setActiveFilterId(null);
        }
    }, [filters.length]);

    const columnsAvailable = columns.length > 0;

    // Trigger local analysis and move to next step
    const handleStartAnalysisClick = () => {
        startInsightProcess();
        setInsightWorkflowStep('localSummary');
    };

    // Trigger API call and update step
    const handleGenerateApiInsightsClick = (includeOutliers: boolean) => {
        handleOutlierDecisionAndGenerateApiInsights(includeOutliers, prompt);
        setInsightWorkflowStep('apiInsights');
    };

    const handleGenerateChartClick = () => {
        generateChart();
        // Optionally link chart generation to workflow step if needed
    };

    // Determine current step based on state
    const currentStep = useMemo(() => {
        if (apiError || insights) return 'apiInsights';
        if (outliers && localInsightsSummary) return 'outlierDecision';
        if (localInsightsSummary) return 'localSummary';
        return 'idle';
    }, [localInsightsSummary, outliers, insights, apiError]);

    useEffect(() => {
        setInsightWorkflowStep(currentStep);
    }, [currentStep])

    return (
        <TooltipProvider>
            <div className="flex flex-col h-full w-full p-4 max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-2xl font-bold">Data Insights Generator</h1>
                </div>

                {/* Step 1 & 2: Data Source & Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Data Source Card (remains the same) */}
                    <Card>
                        <CardHeader>
                            <CardTitle><ListFilter className="inline h-5 w-5 mr-2" />1. Select Data Source</CardTitle>
                            <CardDescription>Choose the dataset you want to analyze.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={selectedSource?.id || ''}
                                onValueChange={(value) => {
                                    const source = dataSources.find(src => src.id === value);
                                    setSelectedSource(source || null);
                                    setActiveFilterId(null);
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a data source" />
                                </SelectTrigger>
                                <SelectContent>
                                    {dataSources.map(source => (
                                        <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* Filters Card (remains the same) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span><ListFilter className="inline h-5 w-5 mr-2" />2. Filter Data</span>
                                <Button
                                    variant="outline" size="sm"
                                    onClick={addFilter}
                                    disabled={filters.length >= 5 || !selectedSource || !columnsAvailable || loading}
                                    title={!selectedSource ? "Select a data source first" : !columnsAvailable ? "Columns loading..." : filters.length >= 5 ? "Maximum 5 filters allowed" : "Add a new filter"}
                                >
                                    <PlusCircle size={16} className="mr-1" />
                                    Add Filter
                                </Button>
                            </CardTitle>
                            <CardDescription>Refine the dataset by applying filters (optional).</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {/* Active Filter Editor (remains the same) */}
                            {activeFilterId !== null && columnsAvailable && (
                                <div className="mb-3 p-3 bg-gray-50 border rounded-md overflow-hidden">
                                    {(() => {
                                        const filter = filters.find(f => f.id === activeFilterId);
                                        if (!filter) return null;

                                        const column = columns.find(col => col.field === filter.field);
                                        const currentColumnType = column?.type ?? 'dimension';
                                        const operators = getFilterOperatorsForType(currentColumnType);

                                        return (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-medium text-sm">Edit Filter: {columns.find(c => c.field === filters.find(f => f.id === activeFilterId)?.field)?.name ?? '...'}</h3>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActiveFilterId(null)}>
                                                        <X size={16} />
                                                    </Button>
                                                </div>

                                                <Select
                                                    value={filter.field}
                                                    onValueChange={(value) => updateFilter(filter.id, 'field', value)}
                                                    disabled={!columnsAvailable}
                                                >
                                                    <SelectTrigger className="w-full bg-white text-sm">
                                                        <SelectValue placeholder="Select field..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {!columnsAvailable && <SelectItem value="" disabled>Loading columns...</SelectItem>}
                                                        {columns.map(col => (
                                                            <SelectItem key={col.field} value={col.field}>{col.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                <Select
                                                    value={filter.operator}
                                                    onValueChange={(value) => updateFilter(filter.id, 'operator', value as FilterOperatorType)}
                                                    disabled={!columnsAvailable || operators.length === 0}
                                                >
                                                    <SelectTrigger className="w-full bg-white text-sm">
                                                        <SelectValue placeholder="Select operator..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {operators.map(op => (
                                                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>

                                                <input
                                                    type={currentColumnType === 'metric' ? 'number' : currentColumnType === 'date' ? 'date' : 'text'}
                                                    className="p-2 border rounded-md w-full text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                    value={filter.value}
                                                    onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                                    placeholder="Enter value"
                                                    disabled={!columnsAvailable}
                                                />

                                                <div className="flex justify-between pt-2">
                                                    <Button variant="ghost" size="sm" onClick={() => setActiveFilterId(null)}>Cancel</Button>
                                                    <div className="flex space-x-2">
                                                        <Button
                                                            variant="destructive" size="sm"
                                                            onClick={() => {
                                                                removeFilter(filter.id);
                                                                setActiveFilterId(null);
                                                            }}
                                                        >
                                                            Remove
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => setActiveFilterId(null)}
                                                            disabled={!columnsAvailable}
                                                        >
                                                            Apply Filter
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* Filter List - Badges (remains the same) */}
                            {filters.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {filters.map(filter => {
                                        const column = columns.find(col => col.field === filter.field);
                                        const operatorInfo = getFilterOperatorsForType(column?.type || 'dimension').find(op => op.value === filter.operator);
                                        const filterDisplayValue = filter.value;
                                        return (
                                            <Badge key={filter.id} variant="secondary" className="py-1 px-2 cursor-pointer group relative hover:bg-gray-200"
                                                onClick={() => setActiveFilterId(filter.id)} // Click to edit
                                            >
                                                {column?.name || filter.field} {operatorInfo?.label || filter.operator} {filterDisplayValue}
                                                <button
                                                    className="ml-1 opacity-50 group-hover:opacity-100 text-red-500 hover:text-red-700"
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent badge click when removing
                                                        removeFilter(filter.id);
                                                        if (activeFilterId === filter.id) setActiveFilterId(null);
                                                    }}
                                                    title="Remove filter"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </Badge>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No filters applied.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Loading Indicator */}
                {loading && (
                    <Alert variant="default">
                        <Loader2 className="animate-spin h-4 w-4" />
                        <AlertTitle>Loading Data Source</AlertTitle>
                        <AlertDescription>Please wait while the data is being fetched.</AlertDescription>
                    </Alert>
                )}

                {/* Step 3: Data Preview Table (remains largely the same) */}
                {selectedSource && !loading && columnsAvailable && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle><FileBarChart2 className="inline h-5 w-5 mr-2" />3. Data Preview</CardTitle>
                                <div className="flex items-center gap-4">
                                    <Badge variant="outline">{filteredRows} of {totalRows} rows</Badge>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-600">Show:</span>
                                        <Select value={previewRowCount.toString()} onValueChange={(val) => setPreviewRowCount(Number(val))}>
                                            <SelectTrigger className="h-8 w-[70px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PREVIEW_ROW_OPTIONS.map(option => (
                                                    <SelectItem key={option} value={option.toString()}>{option}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto border rounded-md max-h-[400px]">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-gray-50 z-10">
                                        <TableRow>
                                            {columns.map(column => (
                                                <TableHead key={column.field} className="whitespace-nowrap px-3 py-2">
                                                    <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => handleSort(column.field)}>
                                                        {column.name}
                                                        {sortConfig.key === column.field ? (
                                                            sortConfig.direction === 'desc' ? <ChevronDown size={14} className="ml-1" /> : <ChevronUp size={14} className="ml-1" />
                                                        ) : (
                                                            <ArrowUpDown size={14} className="ml-1 text-gray-400" />
                                                        )}
                                                    </Button>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.slice(0, previewRowCount).map((row, index) => (
                                            <TableRow key={index} className="hover:bg-gray-50">
                                                {columns.map(column => (
                                                    <TableCell key={column.field} className="px-3 py-1.5 whitespace-nowrap">
                                                        {formatCellValue(row[column.field], column.type)}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                        {data.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={columns.length} className="text-center py-4 text-gray-500 italic">No data matches the current filters.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            {data.length > previewRowCount && (
                                <p className="text-xs text-gray-500 mt-2 italic">Showing first {previewRowCount} rows. {filteredRows} rows total match filters.</p>
                            )}
                        </CardContent>
                    </Card>
                )}
                {selectedSource && !loading && !columnsAvailable && (
                    <Alert variant="default">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No Data</AlertTitle>
                        <AlertDescription>No data or columns found for the selected source.</AlertDescription>
                    </Alert>
                )}

                {/* Step 4: Start Analysis Button */}
                {selectedSource && !loading && columnsAvailable && insightWorkflowStep === 'idle' && (
                    <Card>
                        <CardHeader>
                            <CardTitle><SearchCheck className="inline h-5 w-5 mr-2" />4. Analyze Data</CardTitle>
                            <CardDescription>Start the analysis process to get a data summary and detect potential outliers.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={handleStartAnalysisClick}
                                disabled={isGeneratingLocalInsights}
                            >
                                {isGeneratingLocalInsights ? (
                                    <><Loader2 className="animate-spin mr-2" size={16} /> Analyzing...</>
                                ) : (
                                    'Start Analysis'
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Analysis Results Area (Local Summary, Outliers, API Prompt/Results) */}
                {(insightWorkflowStep === 'localSummary' || insightWorkflowStep === 'outlierDecision' || insightWorkflowStep === 'apiInsights') && selectedSource && !loading && columnsAvailable && (
                    <Card>
                        <CardHeader>
                            <CardTitle>4. Analysis & Insights</CardTitle>
                            <CardDescription>Review the data summary, handle outliers, and generate deeper AI insights.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Local Insights Summary */}
                            {localInsightsSummary && (
                                <div className="p-4 border rounded-md bg-gray-50">
                                    <h3 className="text-md font-semibold mb-3">Data Summary ({localInsightsSummary.rowCount} rows)</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <h4 className="font-medium mb-1">Metrics</h4>
                                            {localInsightsSummary.metrics.length > 0 ? (
                                                <ul className="list-disc pl-5 space-y-1">
                                                    {localInsightsSummary.metrics.map(m => (
                                                        <li key={m.name}>
                                                            <span className="font-semibold">{m.name}:</span> Avg: {m.avg?.toFixed(2) ?? 'N/A'}, Min: {m.min ?? 'N/A'}, Max: {m.max ?? 'N/A'}, Sum: {m.sum?.toFixed(2) ?? 'N/A'}
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : <p className="italic text-gray-500">No numeric metrics found.</p>}
                                        </div>
                                        <div>
                                            <h4 className="font-medium mb-1">Dimensions</h4>
                                            {localInsightsSummary.dimensions.length > 0 ? (
                                                <ul className="list-disc pl-5 space-y-1">
                                                    {localInsightsSummary.dimensions.map(d => {
                                                        // Build top values string using JSON.stringify
                                                        const topValuesString = d.topValues
                                                            ?.map(tv => `${JSON.stringify(tv.value)} [${tv.count}]`)
                                                            .join(', ');

                                                        return (
                                                            <li key={d.name}>
                                                                <span className="font-semibold">{d.name}:</span> {d.uniqueCount} unique values
                                                                {topValuesString && (
                                                                    <span className="text-xs text-gray-600"> (Top: {topValuesString})</span>
                                                                )}
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            ) : <p className="italic text-gray-500">No dimension fields found.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Outlier Decision */}
                            {insightWorkflowStep === 'localSummary' && outliers && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Potential Outliers Detected!</AlertTitle>
                                    <AlertDescription>
                                        <p className="mb-2">{outliers.length} potential outlier value(s) were found. These might skew AI analysis. Review them below.</p>
                                        <div className="max-h-32 overflow-y-auto border bg-background p-2 rounded-md mb-3">
                                            <ul className="list-disc pl-4 text-xs space-y-0.5">
                                                {outliers.map((o, i) => (
                                                    <li key={o.id}>Row for {o.column}: {formatCellValue(o.value, 'metric')}</li>
                                                ))}
                                            </ul>
                                        </div>
                                        <p>Do you want to exclude these outliers before generating AI insights?</p>
                                    </AlertDescription>
                                    <div className="flex gap-2 mt-3">
                                        <Button size="sm" variant="destructive" onClick={() => handleGenerateApiInsightsClick(false)} disabled={loadingInsights}>
                                            Exclude Outliers & Analyze
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleGenerateApiInsightsClick(true)} disabled={loadingInsights}>
                                            Include Outliers & Analyze
                                        </Button>
                                    </div>
                                </Alert>
                            )}

                            {/* Prompt & Generate API Insights (Show if workflow started) */}
                            {(insightWorkflowStep === 'localSummary' || insightWorkflowStep === 'outlierDecision' || insightWorkflowStep === 'apiInsights') && (
                                <div className="space-y-4">
                                    <Separator />
                                    <div>
                                        <label htmlFor="aiPrompt" className="block text-sm font-medium mb-1">AI Analysis Prompt</label>
                                        <Textarea
                                            id="aiPrompt"
                                            placeholder="Enter your analysis prompt here..."
                                            value={prompt}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                                            rows={3}
                                            className="w-full"
                                            disabled={loadingInsights || insightWorkflowStep === 'apiInsights'} // Disable after generation starts
                                        />
                                    </div>
                                    {/* Only show Generate button if no outliers OR if we haven't started the API call yet after the outlier decision */}
                                    {(insightWorkflowStep === 'localSummary' && !outliers) && (
                                        <Button
                                            onClick={() => handleGenerateApiInsightsClick(true)} // Always include if no outliers detected
                                            disabled={loadingInsights || !selectedSource || !data.length}
                                            title={!selectedSource ? "Select data first" : !data.length ? "No data to analyze" : "Generate AI Insights"}
                                        >
                                            {loadingInsights ? (
                                                <><Loader2 className="animate-spin mr-2" size={16} /> Generating...</>
                                            ) : (
                                                <><BrainCircuit size={16} className="mr-2" /> Generate AI Insights</>
                                            )}
                                        </Button>
                                    )}

                                    {/* Chart Button - always available if data exists */}
                                    <Button
                                        variant="outline"
                                        onClick={handleGenerateChartClick}
                                        disabled={!selectedSource || !data.length}
                                        title={!selectedSource ? "Select data first" : !data.length ? "No data for chart" : "Generate Chart"}
                                    >
                                        <Activity size={16} className="mr-2" /> Generate Chart
                                    </Button>
                                </div>
                            )}
                        </CardContent>

                        {/* Footer for API Results & Chart */}
                        {(loadingInsights || insights || apiError || showChart) && (
                            <CardFooter className="flex flex-col items-start gap-4 border-t pt-4">
                                {/* Loading API Insights */}
                                {loadingInsights && (
                                    <Alert variant="default" className="w-full">
                                        <Loader2 className="animate-spin h-4 w-4" />
                                        <AlertTitle>Generating AI Insights</AlertTitle>
                                        <AlertDescription>Please wait, this may take a moment...</AlertDescription>
                                    </Alert>
                                )}
                                {/* API Error Display */}
                                {apiError && !loadingInsights && (
                                    <Alert variant="destructive" className="w-full">
                                        <MessageSquareWarning className="h-4 w-4" />
                                        <AlertTitle>Error Generating Insights</AlertTitle>
                                        <AlertDescription>{apiError}</AlertDescription>
                                    </Alert>
                                )}

                                {/* API Insights Display */}
                                {insights && !apiError && !loadingInsights && (
                                    <div className="w-full p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <h3 className="text-lg font-semibold mb-2 text-green-800">Generated AI Insights</h3>
                                        <div className="prose prose-sm max-w-none">
                                            <ReactMarkdown>{insights}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {/* Chart Display */}
                                {showChart && chartData && (
                                    <div className="w-full p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                        <h3 className="text-lg font-semibold mb-2 text-indigo-800">Data Chart</h3>
                                        <DataCharts chartData={chartData} chartType={chartType} />
                                    </div>
                                )}
                            </CardFooter>
                        )}
                    </Card>
                )}
            </div>
        </TooltipProvider>
    );
};

// Helper function to format cell values (remains the same)
const formatCellValue = (value: any, type: string): string => {
    if (value === null || value === undefined) {
        return '-'; // Display hyphen for null/undefined
    }

    if (type === 'date') {
        if (value instanceof Date && !isNaN(value.getTime())) {
            // Format date as YYYY-MM-DD for consistency
            return value.toISOString().split('T')[0];
        } else if (typeof value === 'string') {
            // Attempt to parse string as date, return original if invalid
            const date = new Date(value);
            return isNaN(date.getTime()) ? value : date.toISOString().split('T')[0];
        } else {
            return String(value); // Fallback for unexpected date types
        }
    }

    if (type === 'metric') {
        const num = Number(value);
        if (!isNaN(num)) {
            // Format numbers with commas and 2 decimal places (adjust as needed)
            return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }

    // Default: convert to string
    return String(value);
}; 