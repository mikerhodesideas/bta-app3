import React, { useState, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, ArrowUpDown, Activity, BrainCircuit, MessageSquareWarning, Loader2, SearchCheck, ListFilter, Eye, Info, Split, Cpu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useDataInsights, PREVIEW_ROW_OPTIONS, DataSourceType } from './useDataInsights';
import { ModelSelector } from './ModelSelector';
import { SideBySideInsights, ProviderInsightData } from './SideBySideInsights';
import type { ColumnType, FilterOperatorType, DataRowType, ChartDataType, InsightSummaryType, OutlierType, SortConfigType, FilterType, MetricSummaryItem, DimensionSummaryItem, DimensionValueSummary } from './types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { formatCurrency } from '@/lib/utils';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { MAX_RECOMMENDED_INSIGHT_ROWS } from '@/lib/config';
import { DataVisualizationSection, DataSourceFilterSection } from './';
import { LLMProvider, TokenUsage, calculateCost, AVAILABLE_MODELS, LLMResponse } from '@/lib/types/models';

// Helper to format metric values based on name and potential type, enforcing specific decimal rules
const formatMetricValue = (name: string, value: string | number | Date | undefined | null, currency: string): string => {
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
        <div className="w-full h-2 bg-gray-200 rounded-full relative mt-1" title={`Min: ${min?.toFixed(2)}, Avg: ${avg?.toFixed(2)}, Max: ${max?.toFixed(2)}`}>
            <div
                className="absolute h-2 w-1 bg-blue-600 rounded-full"
                style={{ left: `${avgPositionPercent}%` }}
            ></div>
        </div>
    );
};

export interface DataInsightsProps { showVisualization?: boolean }

// Define the extended return type for the hook locally
// This assumes the hook will be updated to return these values
interface UseDataInsightsExtendedReturn {
    dataSources: DataSourceType[];
    selectedSource: DataSourceType | null;
    setSelectedSource: Dispatch<SetStateAction<DataSourceType | null>>;
    data: DataRowType[];
    columns: ColumnType[];
    loading: boolean;
    isGeneratingLocalInsights: boolean;
    loadingInsights: boolean;
    totalRows: number;
    filteredRows: number;
    filters: FilterType[];
    sortConfig: SortConfigType;
    localInsightsSummary: InsightSummaryType | null;
    outliers: OutlierType[] | null; // Corrected: OutlierType from types.ts
    excludeOutliers: boolean;
    setExcludeOutliers: Dispatch<SetStateAction<boolean>>;
    insights: string | null;
    apiError: string | null;
    addFilter: () => void;
    updateFilter: (id: number, field: string, value: string | FilterOperatorType) => void;
    removeFilter: (id: number) => void;
    handleSort: (key: string) => void;
    handleOutlierDecisionAndGenerateApiInsights: (prompt: string) => void;
    getFilterOperatorsForType: (type: 'metric' | 'dimension' | 'date') => { label: string; value: FilterOperatorType }[];
    previewRowCount: number;
    setPreviewRowCount: Dispatch<SetStateAction<number>>;
    isTimeSeries: boolean;
    llmProvider: LLMProvider;
    setLlmProvider: Dispatch<SetStateAction<LLMProvider>>;
    modelNames: { [key in LLMProvider]: string };
    showSideBySide: boolean;
    setShowSideBySide: Dispatch<SetStateAction<boolean>>;
    geminiInsights: string | null;
    openaiInsights: string | null;
    loadingGeminiInsights: boolean;
    loadingOpenaiInsights: boolean;
    geminiError: string | null;
    openaiError: string | null;
    anthropicInsights: string | null; // Assumed added
    loadingAnthropicInsights: boolean; // Assumed added
    anthropicError: string | null; // Assumed added
    handleGenerateSideBySideInsights: (prompt: string, providers: [LLMProvider, LLMProvider]) => void; // Assumed added
    geminiTokenUsage: TokenUsage | null;
    openaiTokenUsage: TokenUsage | null;
    anthropicTokenUsage: TokenUsage | null;
}

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
        geminiTokenUsage,
        openaiTokenUsage,
        anthropicTokenUsage,
        handleGenerateSideBySideInsights: handleGenerateSideBySideInsightsFromHook,
        anthropicInsights,
        loadingAnthropicInsights,
        anthropicError
    } = useDataInsights();

    // Default values for missing properties
    // const anthropicInsights = null; // Now provided by hook
    // const loadingAnthropicInsights = false; // Now provided by hook
    // const anthropicError = null; // Now provided by hook

    // Local state
    const [activeFilterId, setActiveFilterId] = useState<number | null>(null);
    const [prompt, setPrompt] = useState<string>(
        "Analyze this filtered dataset focusing on performance trends, anomalies, and actionable recommendations for optimization."
    );
    const [selectedOutlierRow, setSelectedOutlierRow] = useState<OutlierType | null>(null); // Use OutlierType

    // Chart state
    const [chartType, setChartType] = useState<'line' | 'bar' | null>('bar');
    const [selectedMetric, setSelectedMetric] = useState<string>('');
    const [selectedDimension, setSelectedDimension] = useState<string>('');
    const [selectedSecondaryMetric, setSelectedSecondaryMetric] = useState<string>('');
    // Add explicit type ColumnType | undefined
    const groupingDimension = useMemo(() => columns.find((c: ColumnType) => c.type === 'dimension'), [columns]);
    const groupingDimensionName = groupingDimension?.name;
    const [groupByValue, setGroupByValue] = useState<string>('all');

    // State for side-by-side comparison provider selection
    const [providersToCompare, setProvidersToCompare] = useState<[LLMProvider, LLMProvider]>(['gemini', 'openai']);

    // Calculate cost for each provider
    const geminiCost = geminiTokenUsage ? calculateCost(geminiTokenUsage, modelNames.gemini) : undefined;
    const openaiCost = openaiTokenUsage ? calculateCost(openaiTokenUsage, modelNames.openai) : undefined;
    const anthropicCost = anthropicTokenUsage ? calculateCost(anthropicTokenUsage, modelNames.anthropic) : undefined;

    // Set default chart values when data or columns change
    useEffect(() => {
        if (columns.length > 0 && data.length > 0) {
            // Add explicit type ColumnType | undefined
            const dateColumn = columns.find((col: ColumnType) => col.type === 'date');

            // Find cost and value metrics
            const costMetric = columns.find((col: ColumnType) =>
                col.type === 'metric' &&
                (col.name.toLowerCase().includes('cost') || col.field.toLowerCase().includes('cost'))
            );

            const valueMetric = columns.find((col: ColumnType) =>
                col.type === 'metric' &&
                (col.name.toLowerCase().includes('value') || col.field.toLowerCase().includes('value'))
            );

            // Find clicks metric as fallback
            const clicksMetric = columns.find((col: ColumnType) =>
                col.type === 'metric' &&
                (col.name.toLowerCase().includes('click') || col.field.toLowerCase().includes('click'))
            );

            // Find first dimension for non-time series
            const firstDimension = columns.find((col: ColumnType) => col.type === 'dimension');

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
            } else {
                // Add explicit type ColumnType | undefined
                const firstMetric = columns.find((col: ColumnType) => col.type === 'metric');
                setSelectedMetric(firstMetric?.field || '');
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
        // Add explicit type ColumnType | undefined
        const dimCol = columns.find((c: ColumnType) => c.field === selectedDimension);
        // Only aggregate when X-axis is a date field and data exists
        if (dimCol?.type === 'date' && groupingDimension) {
            // filter by selected group value (or include all if 'all')
            const rows = groupByValue === 'all'
                ? data
                : data.filter((r: DataRowType) => String(r[groupingDimension.field]) === groupByValue);
            const map = new Map<string, any>();
            rows.forEach((row: DataRowType) => {
                const raw = row[selectedDimension];
                const key = raw instanceof Date ? raw.toISOString() : String(raw);
                const existing = map.get(key) || { [selectedDimension]: raw };
                // Ensure values are numbers before adding
                const metricValue = Number(row[selectedMetric]);
                existing[selectedMetric] = (existing[selectedMetric] || 0) + (isNaN(metricValue) ? 0 : metricValue);
                if (selectedSecondaryMetric && selectedSecondaryMetric !== 'none') {
                    const secondaryMetricValue = Number(row[selectedSecondaryMetric]);
                    existing[selectedSecondaryMetric] = (existing[selectedSecondaryMetric] || 0) + (isNaN(secondaryMetricValue) ? 0 : secondaryMetricValue);
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

    // Updated function to handle both single and side-by-side generation
    const handleGenerateClick = () => {
        if (showSideBySide) {
            // Call the function from the hook
            handleGenerateSideBySideInsightsFromHook(prompt, providersToCompare);
        } else {
            // Existing logic for single provider
            handleOutlierDecisionAndGenerateApiInsights(prompt);
        }
    };

    // Helper function to get provider-specific data for the side-by-side view
    const getProviderData = (provider: LLMProvider): ProviderInsightData => {
        switch (provider) {
            case 'gemini':
                return {
                    provider: 'gemini',
                    insights: geminiInsights,
                    isLoading: loadingGeminiInsights,
                    tokenUsage: geminiTokenUsage,
                    modelName: modelNames.gemini,
                    cost: geminiCost,
                    error: geminiError,
                };
            case 'openai':
                return {
                    provider: 'openai',
                    insights: openaiInsights,
                    isLoading: loadingOpenaiInsights,
                    tokenUsage: openaiTokenUsage,
                    modelName: modelNames.openai,
                    cost: openaiCost,
                    error: openaiError,
                };
            case 'anthropic':
                return {
                    provider: 'anthropic',
                    insights: anthropicInsights,
                    isLoading: loadingAnthropicInsights,
                    tokenUsage: anthropicTokenUsage,
                    modelName: modelNames.anthropic,
                    cost: anthropicCost,
                    error: anthropicError,
                };
            default:
                // Should not happen with typed providers
                return { provider: 'gemini', insights: null, isLoading: false, tokenUsage: null, modelName: '', cost: undefined, error: 'Invalid provider' };
        }
    };

    // Available providers for selection
    const availableProviders: LLMProvider[] = ['gemini', 'openai', 'anthropic'];

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
                                        {/* Add explicit type ColumnType */}
                                        {columns.map((column: ColumnType) => (
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
                                    {/* Add explicit type number for rowIndex */}
                                    {data.slice(0, previewRowCount).map((row: DataRowType, rowIndex: number) => (
                                        <TableRow key={rowIndex} className="hover:bg-gray-50 text-sm">
                                            {/* Add explicit type ColumnType */}
                                            {columns.map((column: ColumnType) => {
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
                                                {(() => {
                                                    const calculatedMetrics = ['cpc', 'ctr', 'convrate', 'cpa', 'roas'];
                                                    const columnsToShow = columns.filter((col: ColumnType) =>
                                                        !calculatedMetrics.includes(col.field.toLowerCase())
                                                    );

                                                    return (
                                                        <Table className="text-xs bg-white">
                                                            <TableHeader className="sticky top-0 bg-gray-100">
                                                                <TableRow>
                                                                    {/* Add explicit type ColumnType */}
                                                                    {columnsToShow.map((col: ColumnType) => (
                                                                        <TableHead key={col.field} className="px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap">{col.name}</TableHead>
                                                                    ))}
                                                                    {/* Reason column (Outlier Metric/Value columns removed) */}
                                                                    <TableHead className="px-2 py-1.5 font-medium text-gray-600 whitespace-nowrap">Reason</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {outliers.map((o: OutlierType, index: number) => (
                                                                    <TableRow key={o.id || `${index}-${o.field}`} className="hover:bg-gray-50">
                                                                        {/* Map over pre-filtered columns for cells */}
                                                                        {columnsToShow.map((col: ColumnType) => {
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
                                                        {localInsightsSummary.metrics.map((m: MetricSummaryItem) => {
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
                                                        {localInsightsSummary.dimensions.map((d: DimensionSummaryItem) => (
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
                                                                            {d.topValues.map((tv: DimensionValueSummary) => (
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

                {/* Step 5: Generate AI Insights */}
                {localInsightsSummary && !isGeneratingLocalInsights && selectedSource && !loading && !apiError && columnsAvailable && (
                    <div className="space-y-6 p-6 border rounded-lg shadow-sm bg-white">
                        <h2 className="text-xl font-semibold text-gray-800"><BrainCircuit className="inline h-5 w-5 mr-2 text-indigo-600" />5. Generate AI Insights</h2>

                        <Separator className="my-0" />

                        {/* Prompt & Generate Button Area */}
                        {!(loadingInsights || loadingGeminiInsights || loadingOpenaiInsights || loadingAnthropicInsights) && !(insights || geminiInsights || openaiInsights || anthropicInsights) && (
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between items-start mb-2 flex-wrap">
                                        <label htmlFor="aiPrompt" className="block text-sm font-medium text-gray-700 mb-1">AI Analysis Prompt</label>
                                        <div className="flex items-center gap-4 flex-wrap">
                                            {/* Side by Side Toggle */}
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id="side-by-side"
                                                    checked={showSideBySide}
                                                    onCheckedChange={setShowSideBySide}
                                                    aria-label="Compare AI models side by side"
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
                                                        <p className="text-sm">Compare insights from two AI models side by side</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>

                                            {/* Conditional Model Selectors */}
                                            {showSideBySide ? (
                                                <div className="flex items-center gap-3">
                                                    <Label className="text-sm font-medium text-gray-700">Compare:</Label>
                                                    <Select
                                                        value={providersToCompare[0]}
                                                        onValueChange={(value) => {
                                                            const newProvider = value as LLMProvider;
                                                            // Prevent selecting the same provider twice
                                                            if (newProvider !== providersToCompare[1]) {
                                                                setProvidersToCompare([newProvider, providersToCompare[1]]);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 w-[120px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {availableProviders.map(p => (
                                                                <SelectItem key={p} value={p} disabled={p === providersToCompare[1]}>
                                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <span className="text-sm text-gray-500">vs</span>
                                                    <Select
                                                        value={providersToCompare[1]}
                                                        onValueChange={(value) => {
                                                            const newProvider = value as LLMProvider;
                                                            // Prevent selecting the same provider twice
                                                            if (newProvider !== providersToCompare[0]) {
                                                                setProvidersToCompare([providersToCompare[0], newProvider]);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 w-[120px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {availableProviders.map(p => (
                                                                <SelectItem key={p} value={p} disabled={p === providersToCompare[0]}>
                                                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
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
                                        disabled={loadingInsights || loadingGeminiInsights || loadingOpenaiInsights || loadingAnthropicInsights}
                                    />
                                    {(() => {
                                        let rowsToSend = filteredRows;
                                        if (!isTimeSeries && excludeOutliers && outliers && outliers.length > 0) {
                                            rowsToSend = Math.max(0, filteredRows - outliers.length);
                                        }
                                        const providerText = showSideBySide
                                            ? `${providersToCompare[0].charAt(0).toUpperCase() + providersToCompare[0].slice(1)} and ${providersToCompare[1].charAt(0).toUpperCase() + providersToCompare[1].slice(1)}`
                                            : `${llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)}`;
                                        return (
                                            <p className="text-xs text-orange-600 mt-1 italic">
                                                {!isTimeSeries && outliers && outliers.length > 0 && (
                                                    <>Note: Outliers will be {excludeOutliers ? 'EXCLUDED' : 'INCLUDED'} in the data sent for AI analysis based on the switch above.<br /></>
                                                )}
                                                Sending {rowsToSend} rows for analysis (Recommended max: {MAX_RECOMMENDED_INSIGHT_ROWS}).
                                                <span className="ml-1">Using {providerText} for analysis.</span>
                                            </p>
                                        );
                                    })()}
                                </div>
                                <Button
                                    onClick={handleGenerateClick}
                                    disabled={loadingInsights || loadingGeminiInsights || loadingOpenaiInsights || loadingAnthropicInsights || !prompt.trim() || !localInsightsSummary}
                                    size="lg"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow hover:shadow-md transition-all duration-150"
                                >
                                    {(loadingInsights || loadingGeminiInsights || loadingOpenaiInsights || loadingAnthropicInsights) ? (
                                        <><Loader2 className="animate-spin mr-2" size={16} /> Generating...</>
                                    ) : (
                                        <><BrainCircuit size={16} className="mr-2" /> Generate AI Insights</>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Loading/Error/Result Display Area */}
                        <div className="space-y-4 mt-4">
                            {/* Loading indicator for single model view */}
                            {loadingInsights && !showSideBySide && (
                                <Alert variant="default" className="w-full bg-blue-50 border-blue-200 text-blue-800">
                                    <Loader2 className="animate-spin h-4 w-4" />
                                    <AlertTitle>Generating AI Insights ({llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)})</AlertTitle>
                                    <AlertDescription>Please wait, this may take a moment...</AlertDescription>
                                </Alert>
                            )}

                            {/* Error display for single model view */}
                            {apiError && !loadingInsights && !showSideBySide && (
                                <Alert variant="destructive" className="w-full">
                                    <MessageSquareWarning className="h-4 w-4" />
                                    <AlertTitle>Error Generating Insights ({llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)})</AlertTitle>
                                    <AlertDescription>{apiError}</AlertDescription>
                                </Alert>
                            )}

                            {/* Results for single model view */}
                            {insights && !loadingInsights && !apiError && !showSideBySide && (
                                <div className={`p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-lg font-semibold text-green-800">
                                            Generated AI Insights ({llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1)})
                                            <Badge variant="outline" className={`ml-2 bg-green-100 text-green-800 hover:bg-green-100`}>
                                                {modelNames[llmProvider]}
                                            </Badge>
                                        </h3>
                                        {/* Dynamic Token/Cost Display */}
                                        {(() => {
                                            const usageData = getProviderData(llmProvider);
                                            if (!usageData.tokenUsage) return null;
                                            return (
                                                <div className="flex items-center text-xs text-green-600">
                                                    <Cpu className="h-3 w-3 mr-1" />
                                                    <span>{usageData.tokenUsage.inputTokens + usageData.tokenUsage.outputTokens} tokens</span>
                                                    <span className="ml-1 text-green-500">({usageData.tokenUsage.inputTokens} in / {usageData.tokenUsage.outputTokens} out)</span>
                                                    {usageData.cost !== undefined && (
                                                        <span className="ml-2 text-green-600">${usageData.cost.toFixed(4)}</span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-800 prose-h2:text-xl prose-h2:font-bold prose-h2:text-green-700 prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:font-semibold prose-h3:text-green-600 prose-h3:mt-5 prose-h3:mb-2 prose-p:my-2 prose-p:leading-relaxed prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-strong:text-gray-800 prose-strong:font-semibold prose-ul:my-2 prose-ul:pl-6 prose-li:my-1 prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                                        <ReactMarkdown className="insights-content">{insights}</ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            {/* Side by Side View */}
                            {showSideBySide && (
                                <SideBySideInsights
                                    // Pass data for the two selected providers
                                    provider1Data={getProviderData(providersToCompare[0])}
                                    provider2Data={getProviderData(providersToCompare[1])}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}; 