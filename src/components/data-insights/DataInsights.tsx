import React, { useState, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, Trash2, PlusCircle, ArrowUpDown, X, Edit, Activity, BrainCircuit, MessageSquareWarning, Loader2, SearchCheck, ListFilter, Eye, Info, Split, Cpu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useDataInsights, PREVIEW_ROW_OPTIONS } from './useDataInsights';
import { ModelSelector } from './ModelSelector';
import { SideBySideInsights } from './SideBySideInsights';
import type { ColumnType, FilterOperatorType, DataRowType, ChartDataType } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { MAX_RECOMMENDED_INSIGHT_ROWS } from '@/lib/config';
import { DataCharts } from './DataCharts';
import { DataVisualizationSection, DataSourceFilterSection } from './';
import { TokenUsage, calculateCost } from '@/lib/types/models';

// Helper to format metric values based on name and potential type, enforcing specific decimal rules
const formatMetricValue = (name: string, value: string | number | Date | undefined, currency: string): string => {
    if (value === undefined || value === null) return 'N/A';

    // Handle Date objects first
    if (value instanceof Date && !isNaN(value.getTime())) {
        try {
            return value.toISOString().split('T')[0]; // Format as YYYY-MM-DD
        } catch (e) {
            return String(value); // Fallback
        }
    }

    const lowerName = name.toLowerCase();

    // Treat CampaignId specifically as a string
    if (lowerName === 'campaignid') {
        return String(value); // Return as string immediately
    }
    // Treat AdGroupId specifically as a string
    if (lowerName === 'adgroupid') {
        return String(value); // Return as string immediately
    }

    let numericValue: number | undefined = undefined;

    // Attempt to convert to number if it's not already
    if (typeof value === 'number') {
        numericValue = value;
    } else if (typeof value === 'string') {
        const parsed = Number(value);
        if (!isNaN(parsed) && isFinite(parsed)) {
            numericValue = parsed;
        } else {
            try {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            } catch { }
            return value; // Return original string if not numeric or parsable date
        }
    }

    // Now format based on name, using the potentially converted numericValue
    if (numericValue !== undefined && isFinite(numericValue)) {
        // 0 decimal places
        if (lowerName.includes('impr') || lowerName.includes('clicks')) {
            return numericValue.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }
        // 1 decimal place
        else if (lowerName.includes('conv') && !lowerName.includes('rate') && !lowerName.includes('value')) { // Specifically 'conv', not 'convRate' or 'value'
            return numericValue.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        }
        // Currency (2 decimal places)
        else if (lowerName.includes('cost') || lowerName.includes('value') || lowerName.includes('cpc') || lowerName.includes('cpa')) {
            return formatCurrency(numericValue, currency); // Assumes formatCurrency handles 2 decimals
        }
        // ROAS (1 decimal place + 'x')
        else if (lowerName.includes('roas')) {
            return `${numericValue.toFixed(1)}x`;
        }
        // Percentage (1 decimal place + '%')
        else if (lowerName.includes('ctr') || lowerName.includes('cvr') || lowerName.includes('convrate')) {
            // Value is a decimal (e.g., 0.045), multiply by 100 for percentage display
            const percentageValue = numericValue * 100;
            return `${percentageValue.toFixed(1)}%`;
        }
        // Default fallback (e.g., unknown metrics) - 2 decimal places
        else {
            return numericValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    } else if (typeof value === 'string') {
        return value;
    }

    return 'N/A'; // Fallback
};

// Helper for visual range indicator
const RangeIndicator = ({ min, avg, max }: { min?: number, avg?: number, max?: number }) => {
    if (min === undefined || avg === undefined || max === undefined || max - min === 0) {
        return null; // Don't render if data is missing or range is zero
    }
    const avgPositionPercent = ((avg - min) / (max - min)) * 100;

    return (
        <div className="w-full h-2 bg-gray-200 rounded-full relative mt-1" title={`Min: ${min.toFixed(2)}, Avg: ${avg.toFixed(2)}, Max: ${max.toFixed(2)}`}>
            <div
                className="absolute h-2 w-1 bg-blue-600 rounded-full"
                style={{ left: `${avgPositionPercent}%` }}
            ></div>
        </div>
    );
};

export interface DataInsightsProps { showVisualization?: boolean }
export const DataInsights: React.FC<DataInsightsProps> = ({ showVisualization = true }) => {
    const { settings } = useSettings();
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
        excludeOutliers,
        setExcludeOutliers,
        insights,
        apiError,
        addFilter: addFilterBase,
        updateFilter,
        removeFilter,
        handleSort,
        handleOutlierDecisionAndGenerateApiInsights,
        getFilterOperatorsForType,
        previewRowCount,
        setPreviewRowCount,
        isTimeSeries,
        llmProvider,
        setLlmProvider,
        modelNames,
        showSideBySide,
        setShowSideBySide,
        geminiInsights,
        openaiInsights,
        loadingGeminiInsights,
        loadingOpenaiInsights,
        geminiError,
        openaiError,
        handleGenerateSideBySideInsights,
        geminiTokenUsage,
        openaiTokenUsage,
        anthropicTokenUsage
    } = useDataInsights();

    // Local state
    const [activeFilterId, setActiveFilterId] = useState<number | null>(null);
    const [prompt, setPrompt] = useState<string>(
        "Analyze this filtered dataset focusing on performance trends, anomalies, and actionable recommendations for optimization."
    );
    const [selectedOutlierRow, setSelectedOutlierRow] = useState<any | null>(null);

    // Chart state
    const [chartType, setChartType] = useState<'line' | 'bar' | null>('bar');
    const [selectedMetric, setSelectedMetric] = useState<string>('');
    const [selectedDimension, setSelectedDimension] = useState<string>('');
    const [selectedSecondaryMetric, setSelectedSecondaryMetric] = useState<string>('');
    // Auto-detected primary grouping dimension (first non-date dimension)
    const groupingDimension = useMemo(() => columns.find(c => c.type === 'dimension'), [columns]);
    const groupingDimensionName = groupingDimension?.name;
    // Group by specific dimension value (for time series)
    const [groupByValue, setGroupByValue] = useState<string>('all');

    // Calculate cost for each provider
    const geminiCost = geminiTokenUsage ? calculateCost(geminiTokenUsage, modelNames.gemini) : undefined;
    const openaiCost = openaiTokenUsage ? calculateCost(openaiTokenUsage, modelNames.openai) : undefined;
    const anthropicCost = anthropicTokenUsage ? calculateCost(anthropicTokenUsage, modelNames.anthropic) : undefined;

    // Set default chart values when data or columns change
    useEffect(() => {
        if (columns.length > 0 && data.length > 0) {
            // Find date column for time series
            const dateColumn = columns.find(col => col.type === 'date');

            // Find cost and value metrics
            const costMetric = columns.find(col =>
                col.type === 'metric' &&
                (col.name.toLowerCase().includes('cost') || col.field.toLowerCase().includes('cost'))
            );

            const valueMetric = columns.find(col =>
                col.type === 'metric' &&
                (col.name.toLowerCase().includes('value') || col.field.toLowerCase().includes('value'))
            );

            // Find clicks metric as fallback
            const clicksMetric = columns.find(col =>
                col.type === 'metric' &&
                (col.name.toLowerCase().includes('click') || col.field.toLowerCase().includes('click'))
            );

            // Find first dimension for non-time series
            const firstDimension = columns.find(col => col.type === 'dimension');

            // Set chart type based on data
            setChartType(dateColumn ? 'line' : 'bar');

            // Set dimension based on whether time series data is available
            if (dateColumn) {
                setSelectedDimension(dateColumn.field);
            } else if (firstDimension) {
                setSelectedDimension(firstDimension.field);
            }

            // Set primary metric (prefer cost, fallback to first metric)
            if (costMetric) {
                setSelectedMetric(costMetric.field);
            } else if (columns.find(col => col.type === 'metric')) {
                setSelectedMetric(columns.find(col => col.type === 'metric')?.field || '');
            }

            // Set secondary metric (prefer value if cost is primary, or clicks)
            if (valueMetric && costMetric) {
                setSelectedSecondaryMetric(valueMetric.field);
            } else if (clicksMetric && costMetric) {
                setSelectedSecondaryMetric(clicksMetric.field);
            } else {
                setSelectedSecondaryMetric('none');
            }

            setGroupByValue('all');
        }
    }, [columns, data]);

    // Processed data: collapse by date, optionally filter by one dimension value
    const processedData = useMemo(() => {
        const dimCol = columns.find(c => c.field === selectedDimension);
        // Only aggregate when X-axis is a date field and data exists
        if (dimCol?.type === 'date' && groupingDimension) {
            // filter by selected group value (or include all if 'all')
            const rows = groupByValue === 'all'
                ? data
                : data.filter(r => String(r[groupingDimension.field]) === groupByValue);
            const map = new Map<string, any>();
            rows.forEach(row => {
                const raw = row[selectedDimension];
                const key = raw instanceof Date ? raw.toISOString() : String(raw);
                const existing = map.get(key) || { [selectedDimension]: raw };
                existing[selectedMetric] = (existing[selectedMetric] || 0) + Number(row[selectedMetric]) || 0;
                if (selectedSecondaryMetric && selectedSecondaryMetric !== 'none') {
                    existing[selectedSecondaryMetric] = (existing[selectedSecondaryMetric] || 0) + Number(row[selectedSecondaryMetric]) || 0;
                }
                map.set(key, existing);
            });
            return Array.from(map.values());
        }
        return data;
    }, [data, columns, selectedDimension, selectedMetric, selectedSecondaryMetric, groupByValue, groupingDimension]);

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

    const handleGenerateApiInsightsClick = () => {
        handleOutlierDecisionAndGenerateApiInsights(prompt);
    };

    return (
        <TooltipProvider>
            <div className="flex flex-col h-full w-full p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
                {/* Remove this main title */}
                {/* <h1 className="text-3xl font-bold text-gray-900">Data Insights</h1> */}

                {/* This will now be the main title */}
                <h2 className="text-2xl font-semibold text-gray-800">Data Insights Generator</h2>

                {/* Step 1 & 2: Data Source & Filters */}
                <DataSourceFilterSection
                    dataSources={dataSources}
                    selectedSource={selectedSource}
                    setSelectedSource={setSelectedSource}
                    loading={loading}
                    isGeneratingLocalInsights={isGeneratingLocalInsights}
                    columnsAvailable={columns.length > 0}
                    filters={filters}
                    addFilter={addFilter}
                    updateFilter={updateFilter}
                    removeFilter={removeFilter}
                    activeFilterId={activeFilterId}
                    setActiveFilterId={setActiveFilterId}
                    getFilterOperatorsForType={getFilterOperatorsForType}
                />

                {/* Loading/Error Alerts */}
                {loading && !isGeneratingLocalInsights && (
                    <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                        <Loader2 className="animate-spin h-4 w-4" />
                        <AlertTitle>Loading Data</AlertTitle>
                        <AlertDescription>Fetching data from the source...</AlertDescription>
                    </Alert>
                )}
                {apiError && !loading && (
                    <Alert variant="destructive">
                        <MessageSquareWarning className="h-4 w-4" />
                        <AlertTitle>Data Fetching Error</AlertTitle>
                        <AlertDescription>{apiError}</AlertDescription>
                    </Alert>
                )}
                {selectedSource && !loading && !apiError && !columnsAvailable && (
                    <Alert variant="default" className="bg-yellow-50 border-yellow-200 text-yellow-800">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No Data or Columns</AlertTitle>
                        <AlertDescription>Successfully connected to Tab, but no data or columns were found. Please check the sheet.</AlertDescription>
                    </Alert>
                )}

                {/* Time Series Notification */}
                {isTimeSeries && selectedSource && !loading && columnsAvailable && (
                    <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
                        <Info className="h-4 w-4" />
                        <AlertTitle>Time Series Data Detected</AlertTitle>
                        <AlertDescription>A date column was found. Outlier detection/exclusion has been automatically disabled for time series analysis.</AlertDescription>
                    </Alert>
                )}

                {/* Step 3: Data Preview Table */}
                {selectedSource && !loading && !apiError && columnsAvailable && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <h2 className="text-xl font-semibold text-gray-800"><ListFilter className="inline h-5 w-5 mr-2 text-gray-500" />3. Data Preview</h2>
                            <div className="flex items-center gap-4">
                                <Badge variant="outline">{filteredRows} of {totalRows} rows</Badge>
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-600">Show:</span>
                                    <Select value={previewRowCount.toString()} onValueChange={(val) => setPreviewRowCount(Number(val))}>
                                        <SelectTrigger className="h-8 w-[70px] text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>{PREVIEW_ROW_OPTIONS.map(option => (<SelectItem key={option} value={option.toString()}>{option}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto border rounded-lg shadow-sm max-h-[400px] bg-white">
                            <Table className="min-w-full divide-y divide-gray-200">
                                <TableHeader className="sticky top-0 bg-gray-100 z-10 shadow-sm">
                                    <TableRow>
                                        {columns.map(column => (
                                            <TableHead key={column.field} className="whitespace-nowrap px-3 py-2 font-medium text-gray-600 text-xs uppercase tracking-wider">
                                                <Button variant="ghost" size="sm" className="-ml-2 h-8 p-1 font-semibold text-xs uppercase tracking-wider hover:bg-gray-200" onClick={() => handleSort(column.field)}>
                                                    {column.name}
                                                    {sortConfig.key === column.field ? (
                                                        sortConfig.direction === 'desc' ? <ChevronDown size={14} className="ml-1" /> : <ChevronUp size={14} className="ml-1" />
                                                    ) : (
                                                        <ArrowUpDown size={14} className="ml-1 text-gray-400 opacity-50 group-hover:opacity-100" />
                                                    )}
                                                </Button>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.slice(0, previewRowCount).map((row: DataRowType, rowIndex) => (
                                        <TableRow key={rowIndex} className="hover:bg-gray-50 text-sm">
                                            {columns.map(column => {
                                                const value = column.field === 'isOutlier' ? undefined : row[column.field];
                                                return (
                                                    <TableCell
                                                        key={`${rowIndex}-${column.field}`}
                                                        className="whitespace-nowrap px-3 py-2 text-gray-800 truncate max-w-xs"
                                                        title={String(value ?? '')}
                                                    >
                                                        {formatMetricValue(column.name, value, settings.currency)}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                    {data.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={columns.length} className="text-center py-6 text-gray-500 italic">No data matches the current filters.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        {data.length > previewRowCount && (
                            <p className="text-xs text-gray-500 mt-1 italic">Showing first {previewRowCount} rows. {filteredRows} rows total match filters.</p>
                        )}
                    </div>
                )}

                {/* Data Visualization Section */}
                {showVisualization && selectedSource && !loading && !apiError && columnsAvailable && data.length > 0 && (
                    <DataVisualizationSection
                        columns={columns}
                        data={data}
                        chartType={chartType}
                        setChartType={setChartType}
                        selectedDimension={selectedDimension}
                        setSelectedDimension={setSelectedDimension}
                        selectedMetric={selectedMetric}
                        setSelectedMetric={setSelectedMetric}
                        selectedSecondaryMetric={selectedSecondaryMetric}
                        setSelectedSecondaryMetric={setSelectedSecondaryMetric}
                        groupingDimension={groupingDimension}
                        groupingDimensionName={groupingDimensionName}
                        groupByValue={groupByValue}
                        setGroupByValue={setGroupByValue}
                        processedData={processedData}
                        loading={loading}
                        isTimeSeries={isTimeSeries}
                    />
                )}

                {/* Step 4: Review Summary & Outliers (Always shown when data is loaded, but outlier detection disabled for time series) */}
                {selectedSource && !loading && columnsAvailable && (
                    <div className="space-y-4 p-6 border rounded-lg shadow-sm bg-white">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-800"><Activity className="inline h-5 w-5 mr-2 text-teal-600" />4. Review Summary & Outliers</h2>
                            {!isTimeSeries && outliers && outliers.length > 0 && (
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="exclude-outliers"
                                        checked={excludeOutliers}
                                        onCheckedChange={setExcludeOutliers}
                                        aria-label="Exclude outliers from calculations and AI analysis"
                                    />
                                    <Label htmlFor="exclude-outliers" className={`text-sm font-medium ${excludeOutliers ? 'text-orange-700' : 'text-gray-600'}`}>
                                        Exclude Outliers
                                    </Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info size={14} className="text-gray-400 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Toggle to recalculate summary statistics excluding potential outliers identified below.</p>
                                            <p>This also affects data sent for AI analysis.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            )}
                        </div>

                        {/* Loading Indicator for Summary Calculation */}
                        {isGeneratingLocalInsights && (
                            <Alert variant="default" className="bg-gray-50 border-gray-200">
                                <Loader2 className="animate-spin h-4 w-4" />
                                <AlertTitle>Calculating Summary</AlertTitle>
                                <AlertDescription>Analyzing data {excludeOutliers ? 'excluding potential outliers' : 'including potential outliers'}...</AlertDescription>
                            </Alert>
                        )}

                        {/* Content shown once summary calculation is finished */}
                        {!isGeneratingLocalInsights && (
                            <>
                                {outliers && outliers.length > 0 && (
                                    <Dialog>
                                        <Card className="border-orange-200 bg-orange-50 shadow-sm">
                                            <CardHeader className="py-3 px-4">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-md font-semibold text-orange-800 flex items-center">
                                                        <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                                                        <div className="flex items-center">
                                                            Potential Outliers Detected ({outliers.length})
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Info size={14} className="ml-1.5 text-orange-600 cursor-help" />
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-sm">
                                                                    <p>Outliers are rows where a metric value is more than 3 standard deviations (3σ) away from the mean.</p>
                                                                    <p className="mt-1">These may represent anomalies or important data patterns.</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </CardTitle>
                                                    <DialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="text-xs h-7">
                                                            <Eye size={14} className="mr-1" /> View Outlier Rows
                                                        </Button>
                                                    </DialogTrigger>
                                                </div>
                                                <CardDescription className="text-xs text-orange-700 pt-1">
                                                    These rows have values significantly different from the average based on standard deviation analysis. Review them before proceeding.
                                                </CardDescription>
                                            </CardHeader>
                                        </Card>
                                        <DialogContent className="max-w-5xl bg-white">
                                            <DialogHeader>
                                                <DialogTitle>Potential Outlier Rows</DialogTitle>
                                                <DialogDescription>
                                                    Review the rows identified as potential outliers. Use the switch above to exclude them from summary calculations and AI analysis.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="max-h-[60vh] overflow-auto border rounded-md my-4">
                                                {(() => { // IIFE to calculate filtered columns once
                                                    const calculatedMetrics = ['cpc', 'ctr', 'convrate', 'cpa', 'roas'];
                                                    const columnsToShow = columns.filter(col =>
                                                        !calculatedMetrics.includes(col.field.toLowerCase())
                                                    );

                                                    return (
                                                        <Table className="text-xs bg-white">
                                                            <TableHeader className="sticky top-0 bg-gray-100">
                                                                <TableRow>
                                                                    {/* Map over pre-filtered columns */}
                                                                    {columnsToShow.map(col => (
                                                                        <TableHead key={col.field} className="px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap">{col.name}</TableHead>
                                                                    ))}
                                                                    {/* Reason column (Outlier Metric/Value columns removed) */}
                                                                    <TableHead className="px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap">Reason</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {outliers.map((o, index) => (
                                                                    <TableRow key={o.id || index} className="hover:bg-gray-50">
                                                                        {/* Map over pre-filtered columns for cells */}
                                                                        {columnsToShow.map(col => {
                                                                            const value = col.field === 'isOutlier' ? undefined : o.rowData[col.field];
                                                                            return (
                                                                                <TableCell
                                                                                    key={`${o.id}-${col.field}`}
                                                                                    className="px-2 py-1.5 whitespace-nowrap text-gray-700"
                                                                                >
                                                                                    {formatMetricValue(col.name, value, settings.currency)}
                                                                                </TableCell>
                                                                            );
                                                                        })}
                                                                        {/* Enhanced Reason cell */}
                                                                        <TableCell className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                                                                            <span className="font-medium text-orange-700">{o.column}:</span> {' '}
                                                                            {o.reason || (o.mean !== undefined ?
                                                                                `Value is ${o.value > o.mean ? 'significantly higher' : 'significantly lower'} than average (${o.mean})`
                                                                                : 'Outlier detected')}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    );
                                                })()}
                                            </div>
                                            <DialogFooter>
                                                <div className="flex items-center space-x-2 mr-auto">
                                                    <Switch
                                                        id="exclude-outliers"
                                                        checked={excludeOutliers}
                                                        onCheckedChange={setExcludeOutliers}
                                                    />
                                                    <Label htmlFor="exclude-outliers" className="text-sm cursor-pointer">
                                                        Exclude outliers from summary and analysis
                                                    </Label>
                                                </div>
                                                <DialogClose asChild>
                                                    <Button type="button" variant="secondary">Close</Button>
                                                </DialogClose>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}

                                {localInsightsSummary ? (
                                    <div className="mt-4">
                                        <h3 className="text-lg font-semibold mb-2 text-gray-800">Data Summary ({localInsightsSummary.rowCount} rows {excludeOutliers ? ' / Outliers Excluded' : ' / Outliers Included'})</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                            <div>
                                                <h4 className="font-medium mb-2 text-gray-700 border-b pb-1">Metrics Summary</h4>
                                                {localInsightsSummary.metrics.length > 0 ? (
                                                    <dl className="space-y-3 mt-2">
                                                        {localInsightsSummary.metrics.map(m => {
                                                            // Define calculated metrics to exclude sum for
                                                            const calculatedMetrics = ['cpc', 'ctr', 'convrate', 'cpa', 'roas'];
                                                            const isCalculatedMetric = calculatedMetrics.includes(m.name.toLowerCase());

                                                            return (
                                                                <React.Fragment key={m.name}>
                                                                    <div className="pb-1.5 border-b border-gray-100 last:border-b-0">
                                                                        <div className="flex justify-between items-baseline mb-0.5">
                                                                            <dt className="font-medium text-gray-700 truncate" title={m.name}>{m.name}</dt>
                                                                            <dd className="font-semibold text-gray-900 pl-2">{formatMetricValue(m.name, m.avg, settings.currency)} <span className="text-xs font-normal text-gray-500">(Avg)</span></dd>
                                                                        </div>
                                                                        <RangeIndicator min={m.min} avg={m.avg} max={m.max} />
                                                                        <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                                                                            <span>Min: {formatMetricValue(m.name, m.min, settings.currency)}</span>
                                                                            {/* Only show Sum if it exists AND is NOT a calculated metric */}
                                                                            {!isCalculatedMetric && m.sum !== undefined && <span>Sum: {formatMetricValue(m.name, m.sum, settings.currency)}</span>}
                                                                            <span>Max: {formatMetricValue(m.name, m.max, settings.currency)}</span>
                                                                        </div>
                                                                    </div>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </dl>
                                                ) : <p className="italic text-gray-500 mt-2">No numeric metrics found.</p>}
                                            </div>
                                            <div>
                                                <h4 className="font-medium mb-2 text-gray-700 border-b pb-1">Dimensions Summary</h4>
                                                {localInsightsSummary.dimensions.length > 0 ? (
                                                    <div className="space-y-4 mt-2">
                                                        {localInsightsSummary.dimensions.map(d => (
                                                            <div key={d.name} className="border rounded-md overflow-hidden">
                                                                <div className="bg-gray-50 px-3 py-1.5 border-b">
                                                                    <div className="flex justify-between items-center">
                                                                        <h5 className="font-medium text-gray-700 truncate text-xs uppercase tracking-wider" title={d.name}>{d.name}</h5>
                                                                        <Badge variant="secondary" className="text-xs h-5 px-1.5">{d.uniqueCount} unique</Badge>
                                                                    </div>
                                                                </div>
                                                                {d.topValues && d.topValues.length > 0 ? (
                                                                    <Table className="text-xs">
                                                                        <TableHeader>
                                                                            <TableRow className="bg-gray-50">
                                                                                <TableHead className="px-2 py-1 h-auto font-medium">Value</TableHead>
                                                                                <TableHead className="px-2 py-1 h-auto font-medium text-right">Count</TableHead>
                                                                                <TableHead className="px-2 py-1 h-auto font-medium text-right">Cost</TableHead>
                                                                                <TableHead className="px-2 py-1 h-auto font-medium text-right">Clicks</TableHead>
                                                                                <TableHead className="px-2 py-1 h-auto font-medium text-right">Value</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {d.topValues.map(tv => (
                                                                                <TableRow key={tv.value} className="hover:bg-gray-50">
                                                                                    <TableCell className="px-2 py-1.5 truncate font-medium max-w-[150px]" title={tv.value}>{tv.value || ' (empty) '}</TableCell>
                                                                                    <TableCell className="px-2 py-1.5 text-right">{tv.count}</TableCell>
                                                                                    <TableCell className="px-2 py-1.5 text-right">{formatMetricValue('cost', tv.metrics.cost, settings.currency)}</TableCell>
                                                                                    <TableCell className="px-2 py-1.5 text-right">{formatMetricValue('clicks', tv.metrics.clicks, settings.currency)}</TableCell>
                                                                                    <TableCell className="px-2 py-1.5 text-right">{formatMetricValue('value', tv.metrics.value, settings.currency)}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                ) : (
                                                                    <p className="text-xs italic text-gray-500 p-2">No top values found for this dimension.</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="italic text-gray-500 mt-2">No dimension fields found.</p>}
                                            </div>
                                        </div>
                                    </div>
                                ) : isGeneratingLocalInsights ? (
                                    <Alert variant="default">
                                        <Loader2 className="animate-spin h-4 w-4" />
                                        <AlertTitle>Generating Summary</AlertTitle>
                                        <AlertDescription>Analyzing data and calculating summary statistics...</AlertDescription>
                                    </Alert>
                                ) : null}
                            </>
                        )}
                    </div>
                )}

                {/* Step 5: Generate AI Insights (Show when summary is ready and data loaded) */}
                {localInsightsSummary && !isGeneratingLocalInsights && selectedSource && !loading && !apiError && columnsAvailable && (
                    <div className="space-y-6 p-6 border rounded-lg shadow-sm bg-white">
                        <h2 className="text-xl font-semibold text-gray-800"><BrainCircuit className="inline h-5 w-5 mr-2 text-indigo-600" />5. Generate AI Insights</h2>

                        <Separator className="my-0" />

                        {/* Prompt & Generate Button */}
                        {!loadingInsights && !insights && !openaiInsights && !geminiInsights && !apiError && (
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label htmlFor="aiPrompt" className="block text-sm font-medium text-gray-700">AI Analysis Prompt</label>
                                        <div className="flex items-center gap-4">
                                            {/* Side by Side Toggle */}
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id="side-by-side"
                                                    checked={showSideBySide}
                                                    onCheckedChange={setShowSideBySide}
                                                    aria-label="Compare both AI models side by side"
                                                />
                                                <Label htmlFor="side-by-side" className="text-sm font-medium text-gray-700 flex items-center">
                                                    <Split className="h-4 w-4 mr-1 text-gray-500" />
                                                    Side by Side
                                                </Label>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Info size={14} className="text-gray-400 cursor-help" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="text-sm">Compare insights from both Gemini and OpenAI side by side</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>

                                            {/* Only show the model selector if side-by-side is OFF */}
                                            {!showSideBySide && (
                                                <ModelSelector
                                                    selectedProvider={llmProvider}
                                                    onProviderChange={setLlmProvider}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <Textarea
                                        id="aiPrompt"
                                        placeholder="e.g., Analyze performance trends, identify top performers, suggest optimizations..."
                                        value={prompt}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                                        rows={3}
                                        className="w-full shadow-sm border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                        disabled={loadingInsights || loadingGeminiInsights || loadingOpenaiInsights}
                                    />
                                    {(() => { // IIFE to calculate rowsToSend and render the note
                                        let rowsToSend = filteredRows;
                                        if (!isTimeSeries && excludeOutliers && outliers && outliers.length > 0) {
                                            rowsToSend = Math.max(0, filteredRows - outliers.length);
                                        }
                                        return (
                                            <p className="text-xs text-orange-600 mt-1 italic">
                                                {!isTimeSeries && outliers && outliers.length > 0 && (
                                                    <>Note: Outliers will be {excludeOutliers ? 'EXCLUDED' : 'INCLUDED'} in the data sent for AI analysis based on the switch above.<br /></>
                                                )}
                                                Sending {rowsToSend} rows for analysis (Recommended max: {MAX_RECOMMENDED_INSIGHT_ROWS}).
                                                {!showSideBySide && (
                                                    <span className="ml-1">
                                                        Using {llmProvider === 'gemini' ? 'Gemini AI' : llmProvider === 'openai' ? 'OpenAI' : 'Anthropic'} for analysis.
                                                    </span>
                                                )}
                                            </p>
                                        );
                                    })()}
                                </div>
                                <Button
                                    onClick={handleGenerateApiInsightsClick}
                                    disabled={loadingInsights || loadingGeminiInsights || loadingOpenaiInsights || !prompt.trim() || !localInsightsSummary}
                                    size="lg"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow hover:shadow-md transition-all duration-150"
                                >
                                    {loadingInsights || loadingGeminiInsights || loadingOpenaiInsights ? (
                                        <><Loader2 className="animate-spin mr-2" size={16} /> Generating...</>
                                    ) : (
                                        <><BrainCircuit size={16} className="mr-2" /> Generate AI Insights</>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Loading/Error/Result Display for API */}
                        <div className="space-y-4 mt-4">
                            {/* Loading indicator for single model view */}
                            {loadingInsights && !showSideBySide && (
                                <Alert variant="default" className="w-full bg-blue-50 border-blue-200 text-blue-800">
                                    <Loader2 className="animate-spin h-4 w-4" />
                                    <AlertTitle>Generating AI Insights</AlertTitle>
                                    <AlertDescription>Please wait, this may take a moment...</AlertDescription>
                                </Alert>
                            )}

                            {/* Error display for single model view */}
                            {apiError && !showSideBySide && (
                                <Alert variant="destructive" className="w-full">
                                    <MessageSquareWarning className="h-4 w-4" />
                                    <AlertTitle>Error Generating Insights</AlertTitle>
                                    <AlertDescription>{apiError}</AlertDescription>
                                </Alert>
                            )}

                            {/* Results for single model view */}
                            {insights && !apiError && !loadingInsights && !showSideBySide && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-semibold text-green-800">
                                            Generated AI Insights ({llmProvider === 'gemini' ? 'Gemini' : llmProvider === 'openai' ? 'OpenAI' : 'Anthropic'})
                                            <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">
                                                {llmProvider === 'gemini' ? modelNames.gemini : llmProvider === 'openai' ? modelNames.openai : modelNames.anthropic}
                                            </Badge>
                                        </h3>
                                        {llmProvider === 'gemini' && geminiTokenUsage && (
                                            <div className="flex items-center text-xs text-green-600">
                                                <Cpu className="h-3 w-3 mr-1" />
                                                <span>{geminiTokenUsage.inputTokens + geminiTokenUsage.outputTokens} tokens</span>
                                                <span className="ml-1 text-green-500">({geminiTokenUsage.inputTokens} in / {geminiTokenUsage.outputTokens} out)</span>
                                                {geminiCost !== undefined && (
                                                    <span className="ml-2 text-green-600">${geminiCost.toFixed(4)}</span>
                                                )}
                                            </div>
                                        )}
                                        {llmProvider === 'openai' && openaiTokenUsage && (
                                            <div className="flex items-center text-xs text-green-600">
                                                <Cpu className="h-3 w-3 mr-1" />
                                                <span>{openaiTokenUsage.inputTokens + openaiTokenUsage.outputTokens} tokens</span>
                                                <span className="ml-1 text-green-500">({openaiTokenUsage.inputTokens} in / {openaiTokenUsage.outputTokens} out)</span>
                                                {openaiCost !== undefined && (
                                                    <span className="ml-2 text-green-600">${openaiCost.toFixed(4)}</span>
                                                )}
                                            </div>
                                        )}
                                        {llmProvider === 'anthropic' && anthropicTokenUsage && (
                                            <div className="flex items-center text-xs text-green-600">
                                                <Cpu className="h-3 w-3 mr-1" />
                                                <span>{anthropicTokenUsage.inputTokens + anthropicTokenUsage.outputTokens} tokens</span>
                                                <span className="ml-1 text-green-500">({anthropicTokenUsage.inputTokens} in / {anthropicTokenUsage.outputTokens} out)</span>
                                                {anthropicCost !== undefined && (
                                                    <span className="ml-2 text-green-600">${anthropicCost.toFixed(4)}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="prose prose-sm max-w-none
                                        prose-headings:font-semibold 
                                        prose-headings:text-gray-800 
                                        prose-h2:text-xl prose-h2:font-bold prose-h2:text-green-700 prose-h2:mt-6 prose-h2:mb-3
                                        prose-h3:text-lg prose-h3:font-semibold prose-h3:text-green-600 prose-h3:mt-5 prose-h3:mb-2
                                        prose-p:my-2 prose-p:leading-relaxed
                                        prose-a:text-blue-600 hover:prose-a:text-blue-700 
                                        prose-strong:text-gray-800 prose-strong:font-semibold
                                        prose-ul:my-2 prose-ul:pl-6
                                        prose-li:my-1
                                        prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                                    ">
                                        <ReactMarkdown className="insights-content">{insights}</ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            {/* Side by Side View */}
                            {showSideBySide && (
                                <SideBySideInsights
                                    geminiInsights={geminiInsights}
                                    openaiInsights={openaiInsights}
                                    isLoadingGemini={loadingGeminiInsights}
                                    isLoadingOpenAI={loadingOpenaiInsights}
                                    geminiTokenUsage={geminiTokenUsage}
                                    openaiTokenUsage={openaiTokenUsage}
                                    modelNames={modelNames}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}; 