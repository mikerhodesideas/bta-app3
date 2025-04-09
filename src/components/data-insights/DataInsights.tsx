import React, { useState, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, Trash2, PlusCircle, ArrowUpDown, X, Edit, Activity, BrainCircuit, MessageSquareWarning, Loader2, SearchCheck, ListFilter, Eye, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useDataInsights, PREVIEW_ROW_OPTIONS } from './useDataInsights';
import type { ColumnType, FilterOperatorType } from './types';
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

// Helper to format metric values based on name and potential type, enforcing specific decimal rules
const formatMetricValue = (name: string, value: number | string | Date | undefined | null, currency: string): string => {
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

export const DataInsights: React.FC = () => {
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
    } = useDataInsights();

    // Local state
    const [activeFilterId, setActiveFilterId] = useState<number | null>(null);
    const [prompt, setPrompt] = useState<string>(
        "Analyze this filtered dataset focusing on performance trends, anomalies, and actionable recommendations for optimization."
    );
    const [selectedOutlierRow, setSelectedOutlierRow] = useState<any | null>(null);

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

    const outlierDisplayColumns = useMemo(() => {
        return columns.filter(c => c.type === 'dimension' || c.type === 'metric' || c.field.toLowerCase().includes('date')).slice(0, 8);
    }, [columns]);

    return (
        <TooltipProvider>
            <div className="flex flex-col h-full w-full p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Data Insights Generator</h1>
                </div>

                {/* Step 1 & 2: Setup Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Data Source Card */}
                    <Card className="shadow-sm border border-gray-200">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold text-gray-800"><ListFilter className="inline h-5 w-5 mr-2 text-blue-600" />1. Select Data Source</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={selectedSource?.id || ''}
                                onValueChange={(value) => {
                                    const source = dataSources.find(src => src.id === value);
                                    setSelectedSource(source || null);
                                    setActiveFilterId(null);
                                }}
                                disabled={loading}
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
                            {loading && !isGeneratingLocalInsights && (
                                <div className="mt-2 flex items-center text-sm text-gray-500"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading sheet data...</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Filters Card */}
                    <Card className="shadow-sm border border-gray-200">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center justify-between">
                                <span><ListFilter className="inline h-5 w-5 mr-2 text-blue-600" />2. Filter Data</span>
                                <Button
                                    variant="outline" size="sm"
                                    onClick={addFilter}
                                    disabled={filters.length >= 5 || !selectedSource || !columnsAvailable || loading}
                                    title={!selectedSource ? "Select a data source first" : !columnsAvailable ? "Columns loading..." : filters.length >= 5 ? "Maximum 5 filters allowed" : "Add a new filter"}
                                >
                                    <PlusCircle size={16} className="mr-1" /> Add Filter
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 min-h-[60px]">
                            {/* Active Filter Editor */}
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
                                                    <h3 className="font-medium text-sm text-gray-700">Edit Filter: {columns.find(c => c.field === filters.find(f => f.id === activeFilterId)?.field)?.name ?? '...'}</h3>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActiveFilterId(null)}><X size={16} /></Button>
                                                </div>
                                                <Select value={filter.field} onValueChange={(value) => updateFilter(filter.id, 'field', value)} disabled={!columnsAvailable}>
                                                    <SelectTrigger className="w-full bg-white text-sm"><SelectValue placeholder="Select field..." /></SelectTrigger>
                                                    <SelectContent>{!columnsAvailable && <SelectItem value="" disabled>Loading columns...</SelectItem>}{columns.map(col => (<SelectItem key={col.field} value={col.field}>{col.name}</SelectItem>))}</SelectContent>
                                                </Select>
                                                <Select value={filter.operator} onValueChange={(value) => updateFilter(filter.id, 'operator', value as FilterOperatorType)} disabled={!columnsAvailable || operators.length === 0}>
                                                    <SelectTrigger className="w-full bg-white text-sm"><SelectValue placeholder="Select operator..." /></SelectTrigger>
                                                    <SelectContent>{operators.map(op => (<SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>))}</SelectContent>
                                                </Select>
                                                <input type={currentColumnType === 'metric' ? 'number' : currentColumnType === 'date' ? 'date' : 'text'} className="p-2 border rounded-md w-full text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed" value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} placeholder="Enter value" disabled={!columnsAvailable} step={currentColumnType === 'metric' ? 'any' : undefined} />
                                                <div className="flex justify-between pt-2">
                                                    <Button variant="ghost" size="sm" onClick={() => setActiveFilterId(null)}>Cancel</Button>
                                                    <div className="flex space-x-2">
                                                        <Button variant="destructive" size="sm" onClick={() => { removeFilter(filter.id); setActiveFilterId(null); }}>Remove</Button>
                                                        <Button size="sm" onClick={() => setActiveFilterId(null)} disabled={!columnsAvailable}>Apply Filter</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                            {/* Filter List Badges */}
                            {filters.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {filters.map(filter => {
                                        const column = columns.find(col => col.field === filter.field);
                                        const operatorInfo = getFilterOperatorsForType(column?.type || 'dimension').find(op => op.value === filter.operator);
                                        return (
                                            <Badge key={filter.id} variant="secondary" className="py-1 px-2 cursor-pointer group relative hover:bg-gray-200 rounded-full text-xs" onClick={() => setActiveFilterId(filter.id)}>
                                                {column?.name || filter.field} {operatorInfo?.label || filter.operator} {filter.value}
                                                <button className="ml-1.5 opacity-50 group-hover:opacity-100 text-red-500 hover:text-red-700 rounded-full p-0.5 hover:bg-red-100" onClick={(e) => { e.stopPropagation(); removeFilter(filter.id); if (activeFilterId === filter.id) setActiveFilterId(null); }} title="Remove filter">
                                                    <X size={10} />
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
                        <AlertDescription>Successfully connected, but no data or columns were found for '{selectedSource.name}'. Please check the sheet.</AlertDescription>
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
                            <Table className="min-w-full">
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
                                    {data.slice(0, previewRowCount).map((row, rowIndex) => (
                                        <TableRow key={rowIndex} className="hover:bg-gray-50 text-sm">
                                            {columns.map(column => (
                                                <TableCell key={`${rowIndex}-${column.field}`} className="whitespace-nowrap px-3 py-2 text-gray-800">
                                                    {formatMetricValue(column.name, row[column.field], settings.currency)}
                                                </TableCell>
                                            ))}
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

                {/* Step 4: Review Summary & Outliers (Appears when data is loaded) */}
                {selectedSource && !loading && columnsAvailable && (
                    <div className="space-y-4 p-6 border rounded-lg shadow-sm bg-white">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-800"><Activity className="inline h-5 w-5 mr-2 text-teal-600" />4. Review Summary & Outliers</h2>
                            {outliers && outliers.length > 0 && (
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
                                                <Table className="text-xs bg-white">
                                                    <TableHeader className="sticky top-0 bg-gray-100">
                                                        <TableRow>
                                                            {outlierDisplayColumns.slice(0, 2).map(col => (
                                                                <TableHead key={col.field} className="px-2 py-1.5 font-medium text-gray-600">{col.name}</TableHead>
                                                            ))}
                                                            <TableHead className="px-2 py-1.5 font-medium text-gray-600">Outlier Metric</TableHead>
                                                            <TableHead className="px-2 py-1.5 font-medium text-gray-600">Value</TableHead>
                                                            <TableHead className="px-2 py-1.5 font-medium text-gray-600">Reason</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {outliers.map((o, index) => (
                                                            <TableRow key={o.id || index} className="hover:bg-gray-50">
                                                                {outlierDisplayColumns.slice(0, 2).map(col => (
                                                                    <TableCell
                                                                        key={`${o.id}-${col.field}`}
                                                                        className="px-2 py-1.5 whitespace-nowrap text-gray-700"
                                                                    >
                                                                        {formatMetricValue(col.name, o.rowData[col.field], settings.currency)}
                                                                    </TableCell>
                                                                ))}
                                                                <TableCell className="px-2 py-1.5 whitespace-nowrap font-medium text-orange-700">
                                                                    {o.column}
                                                                </TableCell>
                                                                <TableCell className="px-2 py-1.5 whitespace-nowrap font-medium text-orange-900">
                                                                    {formatMetricValue(o.column, o.value, settings.currency)}
                                                                </TableCell>
                                                                <TableCell className="px-2 py-1.5 text-xs text-gray-600">
                                                                    {o.reason || (o.mean !== undefined ?
                                                                        `Value is ${o.value > o.mean ? 'significantly higher' : 'significantly lower'} than average (${formatMetricValue(o.column, o.mean, settings.currency)})`
                                                                        : 'Outlier detected')}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
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
                                                        {localInsightsSummary.metrics.map(m => (
                                                            <React.Fragment key={m.name}>
                                                                <div className="pb-1.5 border-b border-gray-100 last:border-b-0">
                                                                    <div className="flex justify-between items-baseline mb-0.5">
                                                                        <dt className="font-medium text-gray-700 truncate" title={m.name}>{m.name}</dt>
                                                                        <dd className="font-semibold text-gray-900 pl-2">{formatMetricValue(m.name, m.avg, settings.currency)} <span className="text-xs font-normal text-gray-500">(Avg)</span></dd>
                                                                    </div>
                                                                    <RangeIndicator min={m.min} avg={m.avg} max={m.max} />
                                                                    <div className="flex justify-between text-xs text-gray-500 mt-0.5">
                                                                        <span>Min: {formatMetricValue(m.name, m.min, settings.currency)}</span>
                                                                        {m.sum !== undefined && <span>Sum: {formatMetricValue(m.name, m.sum, settings.currency)}</span>}
                                                                        <span>Max: {formatMetricValue(m.name, m.max, settings.currency)}</span>
                                                                    </div>
                                                                </div>
                                                            </React.Fragment>
                                                        ))}
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
                        {!loadingInsights && !insights && !apiError && (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="aiPrompt" className="block text-sm font-medium mb-1 text-gray-700">AI Analysis Prompt</label>
                                    <Textarea
                                        id="aiPrompt"
                                        placeholder="e.g., Analyze performance trends, identify top performers, suggest optimizations..."
                                        value={prompt}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                                        rows={3}
                                        className="w-full shadow-sm border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                                        disabled={loadingInsights}
                                    />
                                    {outliers && outliers.length > 0 && (
                                        <p className="text-xs text-orange-600 mt-1 italic">
                                            Note: Outliers will be {excludeOutliers ? 'EXCLUDED' : 'INCLUDED'} in the data sent for AI analysis based on the switch above.
                                        </p>
                                    )}
                                </div>
                                <Button
                                    onClick={handleGenerateApiInsightsClick}
                                    disabled={loadingInsights || !prompt.trim() || !localInsightsSummary}
                                    size="lg"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow hover:shadow-md transition-all duration-150"
                                >
                                    {loadingInsights ? (
                                        <><Loader2 className="animate-spin mr-2" size={16} /> Generating...</>
                                    ) : (
                                        <><BrainCircuit size={16} className="mr-2" /> Generate AI Insights</>
                                    )}
                                </Button>
                            </div>
                        )}

                        {/* Loading/Error/Result Display for API */}
                        <div className="space-y-4 mt-4">
                            {loadingInsights && (
                                <Alert variant="default" className="w-full bg-blue-50 border-blue-200 text-blue-800">
                                    <Loader2 className="animate-spin h-4 w-4" />
                                    <AlertTitle>Generating AI Insights</AlertTitle>
                                    <AlertDescription>Please wait, this may take a moment...</AlertDescription>
                                </Alert>
                            )}
                            {apiError && loadingInsights && (
                                <Alert variant="destructive" className="w-full">
                                    <MessageSquareWarning className="h-4 w-4" />
                                    <AlertTitle>Error Generating Insights</AlertTitle>
                                    <AlertDescription>{apiError}</AlertDescription>
                                </Alert>
                            )}
                            {insights && !apiError && !loadingInsights && (
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                                    <h3 className="text-lg font-semibold mb-2 text-green-800">Generated AI Insights</h3>
                                    <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-headings:text-gray-800 prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-strong:text-gray-700 prose-code:text-sm prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                                        <ReactMarkdown>{insights}</ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}; 