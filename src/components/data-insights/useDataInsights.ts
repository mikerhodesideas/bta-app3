import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { fetchAllTabsData } from '@/lib/sheetsData';
import { SHEET_TABS, SheetTab } from '@/lib/config';
import {
    DataSourceType,
    ColumnType,
    FilterType,
    FilterOperatorType,
    SortConfigType,
    DataRowType,
    ChartDataType,
    OutlierType,
} from './types';

// Type for local summary insights
interface LocalInsightsSummary {
    rowCount: number;
    metrics: {
        name: string;
        min?: number;
        max?: number;
        avg?: number;
        sum?: number;
    }[];
    dimensions: {
        name: string;
        uniqueCount?: number;
        topValues?: { value: string; count: number }[];
    }[];
}

export const PREVIEW_ROW_OPTIONS = [5, 10, 30, 50, 100];

export function useDataInsights() {
    const { settings } = useSettings();

    // State management
    const [dataSources] = useState<DataSourceType[]>(
        SHEET_TABS.map(tab => ({ id: tab, name: tab.charAt(0).toUpperCase() + tab.slice(1) }))
    );
    const [selectedSource, setSelectedSource] = useState<DataSourceType | null>(null);
    const [data, setData] = useState<DataRowType[]>([]);
    const [columns, setColumns] = useState<ColumnType[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [isGeneratingLocalInsights, setIsGeneratingLocalInsights] = useState(false);
    const [totalRows, setTotalRows] = useState(0);
    const [filteredRows, setFilteredRows] = useState(0);
    const [filters, setFilters] = useState<FilterType[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfigType>({ key: '', direction: 'desc' });
    const [insights, setInsights] = useState<string | null>(null);
    const [localInsightsSummary, setLocalInsightsSummary] = useState<LocalInsightsSummary | null>(null);
    const [outliers, setOutliers] = useState<OutlierType[] | null>(null);
    const [timeSeriesField, setTimeSeriesField] = useState<string | null>(null);
    const [showChart, setShowChart] = useState(false);
    const [chartData, setChartData] = useState<ChartDataType>(null);
    const [chartType, setChartType] = useState<'line' | 'bar' | null>(null);
    const [previewRowCount, setPreviewRowCount] = useState<number>(PREVIEW_ROW_OPTIONS[0]);
    const [apiError, setApiError] = useState<string | null>(null);

    // Reset state when changing data source or manually invoked
    const resetState = useCallback((resetFiltersAndColumns = true) => {
        if (resetFiltersAndColumns) {
            setFilters([]);
            setColumns([]);
        }
        setInsights(null);
        setLocalInsightsSummary(null);
        setOutliers(null);
        setShowChart(false);
        setChartData(null);
        setChartType(null);
        setApiError(null);
    }, []);

    // Data loading function wrapped in useCallback
    const loadData = useCallback(async () => {
        if (!selectedSource || !settings.sheetUrl) return;

        setLoading(true);
        setColumns([]);
        setFilters([]);
        resetState(false);

        try {
            const allData = await fetchAllTabsData(settings.sheetUrl);
            const tabData = allData[selectedSource.id as SheetTab] || [];

            let cols: ColumnType[] = [];
            if (tabData.length > 0) {
                const firstRow = tabData[0];
                cols = Object.keys(firstRow).map(key => {
                    const value = firstRow[key as keyof typeof firstRow];
                    const type = key.toLowerCase().includes('date') ? 'date' :
                        typeof value === 'number' ? 'metric' : 'dimension';
                    return {
                        field: key,
                        name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                        type: type
                    };
                });
                setColumns(cols);
                const firstSortable = cols.find(c => c.type === 'metric' || c.type === 'date') || cols[0];
                setSortConfig({ key: firstSortable ? firstSortable.field : '', direction: 'desc' });

                const dateFields = cols
                    .filter(col => col.type === 'date')
                    .map(col => col.field);
                if (dateFields.length > 0) {
                    setTimeSeriesField(dateFields[0]);
                } else {
                    setTimeSeriesField(null);
                }
            } else {
                setTimeSeriesField(null);
            }

            const dataRows = convertToDataRows(tabData, cols);
            setData(dataRows);
            setTotalRows(tabData.length);
            setFilteredRows(tabData.length);
            setPreviewRowCount(PREVIEW_ROW_OPTIONS[0]);

        } catch (error) {
            console.error('Error loading data:', error);
            setData([]);
            setColumns([]);
            setTotalRows(0);
            setFilteredRows(0);
            setApiError(error instanceof Error ? error.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [selectedSource, settings.sheetUrl, resetState]);

    // Load data when source changes
    useEffect(() => {
        if (selectedSource && settings.sheetUrl) {
            loadData();
        } else {
            setData([]);
            setColumns([]);
            setTotalRows(0);
            setFilteredRows(0);
            setFilters([]);
            resetState(true);
        }
    }, [selectedSource, settings.sheetUrl, loadData, resetState]);

    // Apply filters and sorting to data
    const filteredAndSortedData = useMemo(() => {
        if (!data.length) return [];

        let filtered = [...data];
        if (filters.length > 0) {
            filtered = data.filter(item => {
                return filters.every(filter => {
                    if (!filter.field) return true;

                    const value = item[filter.field];
                    const filterValue = filter.value;
                    const column = columns.find(c => c.field === filter.field);
                    const columnType = column?.type;

                    const itemValueStr = value === null || value === undefined ? '' : String(value);
                    const filterValueStr = filterValue === null || filterValue === undefined ? '' : String(filterValue);

                    try {
                        switch (filter.operator) {
                            case 'equals':
                                return itemValueStr.toLowerCase() === filterValueStr.toLowerCase();
                            case 'equals_case_sensitive':
                                return itemValueStr === filterValueStr;
                            case 'contains':
                                return itemValueStr.toLowerCase().includes(filterValueStr.toLowerCase());
                            case 'does_not_contain':
                                return !itemValueStr.toLowerCase().includes(filterValueStr.toLowerCase());
                            case 'contains_case_sensitive':
                                return itemValueStr.includes(filterValueStr);
                            case 'does_not_contain_case_sensitive':
                                return !itemValueStr.includes(filterValueStr);
                            case 'starts_with':
                                return itemValueStr.toLowerCase().startsWith(filterValueStr.toLowerCase());
                            case 'ends_with':
                                return itemValueStr.toLowerCase().endsWith(filterValueStr.toLowerCase());

                            case 'equals_number': {
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal === filtNum;
                            }
                            case 'not_equals': {
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                if (!isNaN(numVal) && !isNaN(filtNum)) return numVal !== filtNum;
                                return itemValueStr !== filterValueStr;
                            }
                            case 'greater_than': {
                                if (columnType === 'date') {
                                    const dateVal = new Date(itemValueStr);
                                    const filtDate = new Date(filterValueStr);
                                    return !isNaN(dateVal.getTime()) && !isNaN(filtDate.getTime()) && dateVal > filtDate;
                                }
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal > filtNum;
                            }
                            case 'greater_than_equals': {
                                if (columnType === 'date') {
                                    const dateVal = new Date(itemValueStr);
                                    const filtDate = new Date(filterValueStr);
                                    return !isNaN(dateVal.getTime()) && !isNaN(filtDate.getTime()) && dateVal >= filtDate;
                                }
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal >= filtNum;
                            }
                            case 'less_than': {
                                if (columnType === 'date') {
                                    const dateVal = new Date(itemValueStr);
                                    const filtDate = new Date(filterValueStr);
                                    return !isNaN(dateVal.getTime()) && !isNaN(filtDate.getTime()) && dateVal < filtDate;
                                }
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal < filtNum;
                            }
                            case 'less_than_equals': {
                                if (columnType === 'date') {
                                    const dateVal = new Date(itemValueStr);
                                    const filtDate = new Date(filterValueStr);
                                    return !isNaN(dateVal.getTime()) && !isNaN(filtDate.getTime()) && dateVal <= filtDate;
                                }
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal <= filtNum;
                            }

                            default:
                                return true;
                        }
                    } catch (e) {
                        console.warn(`Error applying filter: ${filter.operator} on field ${filter.field}`, e);
                        return true;
                    }
                });
            });
        }

        setFilteredRows(filtered.length);

        if (sortConfig.key && columns.some(c => c.field === sortConfig.key)) {
            const sortColumn = columns.find(c => c.field === sortConfig.key);
            filtered.sort((a, b) => {
                const aVal = a[sortConfig.key];
                const bVal = b[sortConfig.key];

                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return sortConfig.direction === 'asc' ? 1 : -1;
                if (bVal == null) return sortConfig.direction === 'asc' ? -1 : 1;

                let comparison = 0;
                if (sortColumn?.type === 'metric') {
                    comparison = (Number(aVal) || 0) - (Number(bVal) || 0);
                } else if (sortColumn?.type === 'date') {
                    try {
                        const dateA = new Date(String(aVal)).getTime();
                        const dateB = new Date(String(bVal)).getTime();
                        if (!isNaN(dateA) && !isNaN(dateB)) {
                            comparison = dateA - dateB;
                        } else if (isNaN(dateA) && !isNaN(dateB)) {
                            comparison = -1;
                        } else if (!isNaN(dateA) && isNaN(dateB)) {
                            comparison = 1;
                        }
                    } catch {
                        comparison = String(aVal).localeCompare(String(bVal));
                    }
                } else {
                    comparison = String(aVal).localeCompare(String(bVal));
                }

                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }

        return filtered;
    }, [data, filters, sortConfig, columns]);

    // Convert API data to DataRowType, attempting date parsing
    const convertToDataRows = useCallback((tabData: any[], currentColumns: ColumnType[]): DataRowType[] => {
        return tabData.map(item => {
            const dataRow: DataRowType = {};
            Object.keys(item).forEach(key => {
                const column = currentColumns.find(c => c.field === key);
                if (column?.type === 'date') {
                    const parsedDate = new Date(item[key]);
                    dataRow[key] = isNaN(parsedDate.getTime()) ? item[key] : parsedDate;
                } else {
                    dataRow[key] = item[key];
                }
            });
            return dataRow;
        });
    }, []);

    // Get appropriate filter operators based on column type
    const getFilterOperatorsForType = useCallback((columnType: 'date' | 'dimension' | 'metric'): Array<{ value: FilterOperatorType, label: string }> => {
        switch (columnType) {
            case 'metric':
            case 'date':
                return [
                    { value: 'greater_than', label: '>' },
                    { value: 'greater_than_equals', label: '>=' },
                    { value: 'equals_number', label: '=' },
                    { value: 'not_equals', label: '!=' },
                    { value: 'less_than', label: '<' },
                    { value: 'less_than_equals', label: '<=' }
                ];
            case 'dimension':
            default:
                return [
                    { value: 'contains', label: 'contains' },
                    { value: 'does_not_contain', label: 'does not contain' },
                    { value: 'equals', label: 'equals (ignore case)' },
                    { value: 'starts_with', label: 'starts with' },
                    { value: 'ends_with', label: 'ends with' },
                    { value: 'contains_case_sensitive', label: 'contains (case sensitive)' },
                    { value: 'does_not_contain_case_sensitive', label: 'does not contain (case sensitive)' },
                    { value: 'equals_case_sensitive', label: 'equals (case sensitive)' }
                ];
        }
    }, []);

    // Filter management functions
    const addFilter = useCallback(() => {
        const defaultColumn = columns.length > 0 ? columns[0] : null;
        const defaultField = defaultColumn?.field || '';
        const defaultColumnType = defaultColumn?.type || 'dimension';
        const operators = getFilterOperatorsForType(defaultColumnType);
        const defaultOperator = operators.length > 0 ? operators[0].value : 'contains';

        const newFilter: FilterType = {
            id: Date.now(),
            field: defaultField,
            operator: defaultOperator,
            value: ''
        };
        setFilters(f => [...f, newFilter]);
    }, [columns, getFilterOperatorsForType]);

    const updateFilter = useCallback((id: number, fieldName: keyof FilterType, value: string) => {
        setFilters(currentFilters => currentFilters.map(filter => {
            if (filter.id === id) {
                const updatedFilter = { ...filter, [fieldName]: value };

                if (fieldName === 'field') {
                    const newColumn = columns.find(col => col.field === value);
                    const newType = newColumn?.type || 'dimension';
                    const operators = getFilterOperatorsForType(newType);
                    updatedFilter.operator = operators.length > 0 ? operators[0].value : 'contains';
                    updatedFilter.value = '';
                }
                return updatedFilter;
            }
            return filter;
        }));
    }, [columns, getFilterOperatorsForType]);

    const removeFilter = useCallback((id: number) => {
        setFilters(filters => filters.filter(filter => filter.id !== id));
    }, []);

    // Sorting function
    const handleSort = useCallback((key: string) => {
        setSortConfig(prevSortConfig => ({
            key,
            direction: prevSortConfig.key === key && prevSortConfig.direction === 'desc' ? 'asc' : 'desc'
        }));
    }, []);

    // --- Local Insights & Outlier Detection ---
    const generateLocalInsightsAndDetectOutliers = useCallback(() => {
        setIsGeneratingLocalInsights(true);
        setLocalInsightsSummary(null);
        setOutliers(null);
        setInsights(null);
        setApiError(null);

        if (!columns.length || !filteredAndSortedData.length) {
            setIsGeneratingLocalInsights(false);
            return;
        }

        try {
            const summary: LocalInsightsSummary = {
                rowCount: filteredAndSortedData.length,
                metrics: [],
                dimensions: []
            };
            const detectedOutliers: OutlierType[] = [];

            columns.forEach(column => {
                const values = filteredAndSortedData.map(row => row[column.field]);

                if (column.type === 'metric') {
                    const numericValues = values.map(Number).filter(v => !isNaN(v) && isFinite(v));
                    if (numericValues.length > 0) {
                        const sum = numericValues.reduce((acc, val) => acc + val, 0);
                        const avg = sum / numericValues.length;
                        const min = Math.min(...numericValues);
                        const max = Math.max(...numericValues);
                        summary.metrics.push({ name: column.name, min, max, avg, sum });

                        // Outlier detection (simple std dev method)
                        if (numericValues.length >= 2) {
                            const stdDev = Math.sqrt(
                                numericValues.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / numericValues.length
                            );
                            if (stdDev > 0) {
                                filteredAndSortedData.forEach((row, index) => {
                                    const value = Number(row[column.field]);
                                    // Consider values > 2 std dev away and non-zero/non-negative as outliers
                                    if (!isNaN(value) && isFinite(value) && value > 0 && Math.abs(value - avg) > 2 * stdDev) {
                                        detectedOutliers.push({
                                            id: `${column.field}-${index}`, // Simple unique ID for the outlier instance
                                            column: column.name,
                                            field: column.field,
                                            value: value,
                                            row: row // Keep the reference to the original row
                                        });
                                    }
                                });
                            }
                        }
                    }
                } else if (column.type === 'dimension') {
                    const validValues = values.filter(v => v !== null && v !== undefined).map(String);
                    if (validValues.length > 0) {
                        const valueCounts: Record<string, number> = {};
                        validValues.forEach(v => { valueCounts[v] = (valueCounts[v] || 0) + 1; });
                        const uniqueCount = Object.keys(valueCounts).length;
                        const topValues = Object.entries(valueCounts)
                            .sort(([, countA], [, countB]) => countB - countA)
                            .slice(0, 5) // Top 5
                            .map(([value, count]) => ({ value, count }));
                        summary.dimensions.push({ name: column.name, uniqueCount, topValues });
                    }
                }
            });

            setLocalInsightsSummary(summary);
            if (detectedOutliers.length > 0) {
                setOutliers(detectedOutliers);
            }

        } catch (error) {
            console.error("Error generating local insights:", error);
        } finally {
            setIsGeneratingLocalInsights(false);
        }
    }, [columns, filteredAndSortedData]);

    // --- API Insight Generation ---
    const fetchGeminiInsights = useCallback(async (prompt: string, dataToAnalyze: DataRowType[]) => {
        setLoadingInsights(true);
        setInsights(null);
        setApiError(null);

        const refinedPrompt = `Analyze the provided dataset (${selectedSource?.name || 'Unknown Source'}) and provide insights based on the following request: "${prompt}". Focus on key trends, potential issues, and actionable recommendations. Format the response using Markdown. Dataset sample:\n\n`;

        try {
            const maxRowsToSend = 500;
            const dataSample = dataToAnalyze.slice(0, maxRowsToSend);

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: refinedPrompt, data: dataSample }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `API Error: ${response.status}`);
            }

            setInsights(result.insights);

        } catch (error) {
            console.error("Error fetching Gemini insights:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching insights.";
            setApiError(errorMessage);
            setInsights(null);
        } finally {
            setLoadingInsights(false);
        }
    }, [selectedSource]);

    // --- Combined Flow Control ---

    // Step 1: Generate local summary & detect outliers
    const startInsightProcess = useCallback(() => {
        generateLocalInsightsAndDetectOutliers();
    }, [generateLocalInsightsAndDetectOutliers]);

    // Step 2 (Optional): Generate API insights after outlier decision
    const handleOutlierDecisionAndGenerateApiInsights = useCallback((includeOutliers: boolean, prompt: string) => {
        let dataToSend = filteredAndSortedData;

        if (!includeOutliers && outliers) {
            // Create a set of outlier identifiers (using the generated ID)
            const outlierIds = new Set(outliers.map(o => o.id));

            // Filter out rows corresponding to the detected outliers
            // This requires identifying the row associated with each outlier ID
            // NOTE: This assumes the outlier ID format `${column.field}-${index}` is reliable.
            // A more robust approach might involve adding unique IDs to rows if possible.
            dataToSend = filteredAndSortedData.filter((row, index) => {
                // Check if *any* column in this row at this index was marked as an outlier
                let isRowOutlier = false;
                for (const outlier of outliers) {
                    // Simple check based on index - requires data to be stable
                    if (outlier.id.endsWith(`-${index}`)) {
                        // More specific check: does the outlier field match a column?
                        if (row[outlier.field] === outlier.value) {
                            isRowOutlier = true;
                            break;
                        }
                    }
                }
                return !isRowOutlier;
            });
            console.log(`Sending ${dataToSend.length} rows to API after excluding ${outliers.length} outlier instances.`);
        } else {
            console.log(`Sending ${dataToSend.length} rows to API ${includeOutliers ? 'including' : 'without'} potential outliers.`);
        }

        fetchGeminiInsights(prompt, dataToSend);
    }, [filteredAndSortedData, outliers, fetchGeminiInsights]);

    // Charting Logic
    const generateChart = useCallback(() => {
        if (!timeSeriesField || !columns.length || !filteredAndSortedData.length) {
            console.warn("Cannot generate chart: Missing date field, columns, or data.");
            setShowChart(false);
            return;
        }

        const metricColumns = columns.filter(col => col.type === 'metric');
        if (metricColumns.length === 0) {
            console.warn("Cannot generate chart: No metric columns found.");
            setShowChart(false);
            return;
        }

        const sortedData = [...filteredAndSortedData].sort((a, b) => {
            const dateA = new Date(String(a[timeSeriesField]));
            const dateB = new Date(String(b[timeSeriesField]));
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;
            return dateA.getTime() - dateB.getTime();
        });

        const metricField = metricColumns[0].field;

        setChartData({
            data: sortedData.slice(-50),
            xField: timeSeriesField,
            yField: metricField,
            title: `${metricColumns[0].name} over Time (${selectedSource?.name})`
        });

        setChartType('line');
        setShowChart(true);
    }, [columns, filteredAndSortedData, timeSeriesField, selectedSource]);

    return {
        dataSources,
        selectedSource,
        setSelectedSource,
        data: filteredAndSortedData,
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
        addFilter,
        updateFilter,
        removeFilter,
        handleSort,
        startInsightProcess,
        handleOutlierDecisionAndGenerateApiInsights,
        getFilterOperatorsForType,
        previewRowCount,
        setPreviewRowCount,
        generateChart
    };
}