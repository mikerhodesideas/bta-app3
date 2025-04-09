import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { useDataStore } from '@/store/dataStore';
import { SHEET_TABS, SheetTab, MAX_RECOMMENDED_INSIGHT_ROWS } from '@/lib/config';
import {
    DataSourceType,
    ColumnType,
    FilterType,
    FilterOperatorType,
    SortConfigType,
    DataRowType,
    OutlierType,
} from './types';
import {
    AdMetric,
    AdGroupMetric,
    SearchTermMetric,
    isAdGroupMetric,
    isSearchTermMetric,
} from '@/lib/types';

// Fix EnhancedOutlierType to include the 'row' property from base OutlierType
interface EnhancedOutlierType extends OutlierType {
    rowData: DataRowType;
    field: string;
    rowIndex: number;
    row: DataRowType; // Add missing property from base OutlierType
    reason?: string;  // Added to explain why this is an outlier
    mean?: number;    // Mean value for the metric
    stdDev?: number;  // Standard deviation for the metric
}

// Define DimensionSummaryItem locally
interface DimensionSummaryItem {
    name: string;
    uniqueCount?: number;
    topValues?: {
        value: string;
        count: number;
        metrics: {
            cost?: number;
            clicks?: number;
            value?: number;
            conv?: number;
        };
    }[];
}

// Define LocalInsightsSummary locally
interface LocalInsightsSummary {
    rowCount: number;
    metrics: {
        name: string;
        min?: number;
        max?: number;
        avg?: number;
        sum?: number;
    }[];
    dimensions: DimensionSummaryItem[];
}

export const PREVIEW_ROW_OPTIONS = [5, 10, 30, 50, 100];

// Helper functions (ensure they handle potential undefined/nulls gracefully)
const deriveColumnsFromData = (data: DataRowType[]): ColumnType[] => {
    if (!data || data.length === 0) return [];
    const firstRow = data[0];
    return Object.keys(firstRow).map(key => {
        const value = firstRow[key as keyof typeof firstRow];
        const lowerKey = key.toLowerCase();
        let type: 'date' | 'metric' | 'dimension' = 'dimension';
        if (lowerKey === 'date' || lowerKey.endsWith('date') || lowerKey.startsWith('date')) {
            type = 'date';
        } else if (typeof value === 'number' ||
            ['impr', 'clicks', 'cost', 'conv', 'value', 'cpc', 'ctr', 'cvr', 'convrate', 'roas', 'cpa'].includes(lowerKey)) {
            type = 'metric';
        }
        return {
            field: key,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            type: type
        };
    });
};

const convertToDataRows = (rawData: (AdMetric | SearchTermMetric | AdGroupMetric)[], cols: ColumnType[]): DataRowType[] => {
    if (!rawData || !cols || cols.length === 0) return [];
    return rawData.map(row => {
        const dataRow: DataRowType = {};
        cols.forEach(col => {
            const rawValue = row[col.field as keyof typeof row];
            if (col.type === 'date' && typeof rawValue === 'string') {
                try {
                    const dateValue = new Date(rawValue);
                    dataRow[col.field] = !isNaN(dateValue.getTime()) ? dateValue : rawValue;
                } catch {
                    dataRow[col.field] = rawValue;
                }
            } else if (col.type === 'metric' && typeof rawValue === 'string') {
                const numValue = Number(rawValue);
                dataRow[col.field] = !isNaN(numValue) && isFinite(numValue) ? numValue : rawValue;
            } else {
                dataRow[col.field] = rawValue;
            }
        });
        return dataRow;
    });
};

export function useDataInsights() {
    const { settings } = useSettings();
    const allData = useDataStore(state => state.data);
    const globalLoading = useDataStore(state => state.loading);
    const globalError = useDataStore(state => state.error);
    const getDataForTab = useDataStore(state => state.getDataForTab);
    const lastDataKeyRef = useRef<string | null>(null);

    // State
    const [dataSources] = useState<DataSourceType[]>(
        SHEET_TABS.map(tab => ({ id: tab, name: tab.charAt(0).toUpperCase() + tab.slice(1) }))
    );
    const [selectedSource, setSelectedSource] = useState<DataSourceType | null>(null);
    const [columns, setColumns] = useState<ColumnType[]>([]);
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [isGeneratingLocalInsights, setIsGeneratingLocalInsights] = useState(false);
    const [filters, setFilters] = useState<FilterType[]>([]);
    const [sortConfig, setSortConfig] = useState<SortConfigType>({ key: '', direction: 'desc' });
    const [insights, setInsights] = useState<string | null>(null);
    const [localInsightsSummary, setLocalInsightsSummary] = useState<LocalInsightsSummary | null>(null);
    const [detectedOutliers, setDetectedOutliers] = useState<EnhancedOutlierType[] | null>(null);
    const [excludeOutliers, setExcludeOutliers] = useState(false);
    const [previewRowCount, setPreviewRowCount] = useState<number>(PREVIEW_ROW_OPTIONS[0]);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [apiError, setApiError] = useState<string | null>(null); // Separate state for API errors

    const resetState = useCallback((resetFiltersAndColumns = true) => {
        if (resetFiltersAndColumns) {
            setFilters([]);
        }
        setInsights(null);
        setLocalInsightsSummary(null);
        setDetectedOutliers(null);
        setExcludeOutliers(false);
        setApiError(null); // Reset API error on source change
    }, []);

    // --- Derived State from Store ---
    const rawDataForSelectedTab = useMemo(() => {
        // Cache the result of getDataForTab to avoid infinite loop
        if (!selectedSource) return [];
        const cachedData = getDataForTab(selectedSource.id as SheetTab);
        return [...cachedData]; // Return a new copy to avoid reference issues
    }, [selectedSource, getDataForTab]);

    // Derive Columns based on the *first row* of raw data if available
    // This needs to happen *before* converting all rows, but only needs the structure
    const derivedColumns = useMemo(() => {
        if (rawDataForSelectedTab.length > 0) {
            // Create a temporary DataRowType from the first raw item just for structure analysis
            const tempCols = Object.keys(rawDataForSelectedTab[0]).map(key => ({
                field: key,
                name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                type: 'dimension' as 'dimension' | 'metric' | 'date' // Placeholder type
            }));
            const firstDataRow = convertToDataRows([rawDataForSelectedTab[0]], tempCols)[0];
            return deriveColumnsFromData([firstDataRow]);
        } else {
            return [];
        }
    }, [rawDataForSelectedTab]);

    // Update state columns when derivedColumns change
    useEffect(() => {
        setColumns(derivedColumns);
        const firstSortable = derivedColumns.find(c => c.type === 'metric' || c.type === 'date') || derivedColumns[0];
        if (firstSortable && !sortConfig.key) {
            setSortConfig({ key: firstSortable.field, direction: 'desc' });
        }
        // Reset sort key if the column no longer exists
        if (sortConfig.key && !derivedColumns.some(c => c.field === sortConfig.key)) {
            setSortConfig({ key: '', direction: 'desc' });
        }
    }, [derivedColumns, sortConfig.key]); // Depend only on derivedColumns

    // Convert raw data to DataRowType using the derived columns
    const baseData = useMemo(() => {
        return convertToDataRows(rawDataForSelectedTab, columns).map(row => ({
            ...row,
            isOutlier: false // Add isOutlier flag to each row
        }));
    }, [rawDataForSelectedTab, columns]);

    const totalRows = useMemo(() => baseData.length, [baseData]);

    useEffect(() => {
        resetState(true);
        setPreviewRowCount(PREVIEW_ROW_OPTIONS[0]);
    }, [selectedSource, resetState]);

    // --- Filtering & Sorting (Operates on baseData) ---
    const filteredAndSortedData = useMemo(() => {
        if (!baseData || baseData.length === 0) return [];
        let filtered = [...baseData];

        // Apply regular filters
        if (filters.length > 0) {
            filtered = filtered.filter(item => {
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
                            case 'equals': return itemValueStr.toLowerCase() === filterValueStr.toLowerCase();
                            case 'equals_case_sensitive': return itemValueStr === filterValueStr;
                            case 'contains': return itemValueStr.toLowerCase().includes(filterValueStr.toLowerCase());
                            case 'does_not_contain': return !itemValueStr.toLowerCase().includes(filterValueStr.toLowerCase());
                            case 'contains_case_sensitive': return itemValueStr.includes(filterValueStr);
                            case 'does_not_contain_case_sensitive': return !itemValueStr.includes(filterValueStr);
                            case 'starts_with': return itemValueStr.toLowerCase().startsWith(filterValueStr.toLowerCase());
                            case 'ends_with': return itemValueStr.toLowerCase().endsWith(filterValueStr.toLowerCase());
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
                                if (columnType === 'date' && value instanceof Date && !isNaN(new Date(filterValueStr).getTime())) return value > new Date(filterValueStr);
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal > filtNum;
                            }
                            case 'greater_than_equals': {
                                if (columnType === 'date' && value instanceof Date && !isNaN(new Date(filterValueStr).getTime())) return value >= new Date(filterValueStr);
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal >= filtNum;
                            }
                            case 'less_than': {
                                if (columnType === 'date' && value instanceof Date && !isNaN(new Date(filterValueStr).getTime())) return value < new Date(filterValueStr);
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal < filtNum;
                            }
                            case 'less_than_equals': {
                                if (columnType === 'date' && value instanceof Date && !isNaN(new Date(filterValueStr).getTime())) return value <= new Date(filterValueStr);
                                const numVal = Number(value);
                                const filtNum = Number(filterValue);
                                return !isNaN(numVal) && !isNaN(filtNum) && numVal <= filtNum;
                            }
                            default: return true;
                        }
                    } catch (e) {
                        console.warn(`Error applying filter: ${filter.operator} on field ${filter.field}`, e);
                        return true;
                    }
                });
            });
        }

        // Apply outlier filter if enabled
        if (excludeOutliers) {
            filtered = filtered.filter(row => !row.isOutlier);
        }

        // Apply sorting
        if (sortConfig.key && columns.find(c => c.field === sortConfig.key)) {
            const sortColumn = columns.find(c => c.field === sortConfig.key);
            const sortType = sortColumn?.type;
            filtered.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                let comparison = 0;
                if (valA == null && valB == null) comparison = 0;
                else if (valA == null) comparison = 1;
                else if (valB == null) comparison = -1;
                else {
                    if (sortType === 'metric') {
                        comparison = (Number(valA) || 0) - (Number(valB) || 0);
                    } else if (sortType === 'date' && valA instanceof Date && valB instanceof Date) {
                        comparison = valA.getTime() - valB.getTime();
                    } else {
                        comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
                    }
                }
                return sortConfig.direction === 'asc' ? comparison : comparison * -1;
            });
        }
        return filtered;
    }, [baseData, filters, sortConfig, columns, excludeOutliers]); // Add excludeOutliers to dependencies

    const filteredRows = useMemo(() => filteredAndSortedData.length, [filteredAndSortedData]);

    // --- Outlier Detection (runs on filtered data, marks rows with isOutlier flag) ---
    useEffect(() => {
        if (!columns.length || !baseData.length || isGeneratingLocalInsights) {
            setDetectedOutliers(null);
            return;
        }

        // Reset all isOutlier flags
        baseData.forEach(row => {
            row.isOutlier = false;
        });

        // Filter out derived metrics that we don't want to check for outliers
        const excludedMetrics = ['convrate', 'cpa', 'roas', 'ctr'];
        const metricColumns = columns.filter(col =>
            col.type === 'metric' &&
            !excludedMetrics.some(excluded => col.field.toLowerCase().includes(excluded))
        );

        const outliersFound: EnhancedOutlierType[] = [];

        metricColumns.forEach(metricCol => {
            const values = baseData.map(row => row[metricCol.field]).filter(v => typeof v === 'number' && !isNaN(v)) as number[];
            if (values.length < 4) return;

            const sum = values.reduce((acc, val) => acc + val, 0);
            const mean = sum / values.length;
            const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
            const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
            const stdDev = Math.sqrt(variance);

            const lowerBound = mean - 3 * stdDev;
            const upperBound = mean + 3 * stdDev;

            baseData.forEach((row, rowIndex) => {
                const value = row[metricCol.field];
                if (typeof value === 'number' && !isNaN(value) && (value < lowerBound || value > upperBound)) {
                    // Mark the row as an outlier
                    row.isOutlier = true;

                    const reason = value < lowerBound
                        ? `Value is significantly lower than average (${value.toFixed(2)} < ${mean.toFixed(2)} - 3σ)`
                        : `Value is significantly higher than average (${value.toFixed(2)} > ${mean.toFixed(2)} + 3σ)`;

                    outliersFound.push({
                        id: `${metricCol.field}-${rowIndex}`,
                        column: metricCol.name,
                        field: metricCol.field,
                        value: value,
                        row: row,
                        rowIndex: rowIndex,
                        rowData: row,
                        reason: reason,
                        mean: mean,
                        stdDev: stdDev
                    });
                }
            });
        });

        // Remove duplicate rows (same row might be an outlier for multiple metrics)
        const uniqueRowIndices = new Set<number>();
        const uniqueOutliers = outliersFound.filter(o => {
            if (uniqueRowIndices.has(o.rowIndex)) {
                return false;
            }
            uniqueRowIndices.add(o.rowIndex);
            return true;
        });

        setDetectedOutliers(uniqueOutliers.length > 0 ? uniqueOutliers : null);

    }, [baseData, columns, isGeneratingLocalInsights]); // Remove excludeOutliers from dependencies

    // --- Data for Summary Calculation (depends on outlier state) ---
    const dataForSummary = useMemo(() => {
        return filteredAndSortedData; // Now filteredAndSortedData already handles outlier exclusion
    }, [filteredAndSortedData]);

    // --- Summary Calculation (runs on dataForSummary) ---
    const calculateSummary = useCallback((dataToSummarize: DataRowType[]) => {
        if (!columns.length || !dataToSummarize.length) {
            setLocalInsightsSummary(null);
            setIsGeneratingLocalInsights(false);
            return;
        }

        console.log(`[Insights] Calculating summary for ${dataToSummarize.length} rows. Outliers excluded: ${excludeOutliers}`);

        // Use a local state variable to avoid state updates during calculation
        let localMetricsSummary: any[] = [];
        let localDimensionsSummary: any[] = [];

        const metricColumns = columns.filter(col => col.type === 'metric');
        const dimensionColumns = columns.filter(col => col.type === 'dimension' || col.type === 'date');

        localMetricsSummary = metricColumns.map(col => {
            const values = dataToSummarize.map(row => row[col.field]).filter(v => typeof v === 'number' && !isNaN(v)) as number[];
            if (values.length === 0) return { name: col.name };
            const min = Math.min(...values);
            const max = Math.max(...values);
            const sum = values.reduce((acc, val) => acc + val, 0);
            const avg = sum / values.length;
            return { name: col.name, min, max, avg, sum };
        }).filter((m): m is { name: string; min: number; max: number; avg: number; sum: number } => m.avg !== undefined);

        localDimensionsSummary = dimensionColumns.map(col => {
            const groupedData: { [key: string]: DataRowType[] } = {};
            dataToSummarize.forEach(row => {
                const key = String(row[col.field] ?? 'null');
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push(row);
            });

            const uniqueCount = Object.keys(groupedData).length;

            const topValues = Object.entries(groupedData)
                .map(([value, rows]) => ({
                    value,
                    count: rows.length,
                    metrics: {
                        cost: rows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0),
                        clicks: rows.reduce((sum, r) => sum + (Number(r.clicks) || 0), 0),
                        value: rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0),
                        conv: rows.reduce((sum, r) => sum + (Number(r.conv) || 0), 0),
                    }
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            return { name: col.name, uniqueCount, topValues };
        });

        // Only set the state once at the end to avoid multiple renders
        setLocalInsightsSummary({
            rowCount: dataToSummarize.length,
            metrics: localMetricsSummary,
            dimensions: localDimensionsSummary,
        });

        setIsGeneratingLocalInsights(false);
        console.log('[Insights] Summary calculation complete.');

    }, [columns]);  // Remove excludeOutliers from dependencies to break the cycle

    // --- Effect to trigger Summary Calculation ---
    useEffect(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        // Prevent recalculation if nothing important changed
        const shouldCalculate =
            columns.length > 0 &&
            !globalLoading &&
            dataForSummary.length > 0;

        if (!shouldCalculate) {
            return;
        }

        // Track if we already calculated for this data set
        const dataKey = `${dataForSummary.length}-${excludeOutliers}-${columns.length}`;

        if (lastDataKeyRef.current === dataKey) {
            return; // Skip if we already calculated for this exact data configuration
        }

        setIsGeneratingLocalInsights(true);

        // Use a longer timeout to avoid rapid recalculations
        debounceTimeoutRef.current = setTimeout(() => {
            lastDataKeyRef.current = dataKey;
            calculateSummary(dataForSummary);
        }, 800);

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [dataForSummary, columns, globalLoading, calculateSummary, excludeOutliers]);

    // --- API Insights Generation (uses filteredAndSortedData, respects excludeOutliers) ---
    const handleOutlierDecisionAndGenerateApiInsights = useCallback(async (prompt: string) => {
        setLoadingInsights(true);
        setApiError(null);
        setInsights(null);

        let dataForApi = filteredAndSortedData;
        let outlierInfoForPrompt = "Outliers were included.";

        if (excludeOutliers && detectedOutliers && detectedOutliers.length > 0) {
            const outlierRowIndices = new Set(detectedOutliers.map(o => o.rowIndex));
            dataForApi = filteredAndSortedData.filter((_, index) => !outlierRowIndices.has(index));
            outlierInfoForPrompt = `${detectedOutliers.length} potential outliers were excluded based on standard deviation analysis.`;
        }

        if (dataForApi.length === 0) {
            setApiError('No data available to send for AI analysis after filtering (and potentially outlier removal).');
            setLoadingInsights(false);
            return;
        }

        const limitedDataForApi = dataForApi.slice(0, MAX_RECOMMENDED_INSIGHT_ROWS);
        const rowLimitInfo = dataForApi.length > MAX_RECOMMENDED_INSIGHT_ROWS
            ? ` (showing top ${MAX_RECOMMENDED_INSIGHT_ROWS} rows based on current sort)`
            : '';
        const fullPrompt = `Dataset: ${selectedSource?.name || 'Selected Data'}\nFilters Applied: ${filters.length > 0 ? filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(', ') : 'None'}\nTotal Rows Matching Filters: ${filteredAndSortedData.length}\nRows Sent for Analysis: ${limitedDataForApi.length}${rowLimitInfo}\nOutlier Handling: ${outlierInfoForPrompt}\n\nUser Prompt: ${prompt}`;

        console.log(`[Insights] Sending ${limitedDataForApi.length} rows to API. Outliers excluded: ${excludeOutliers}`);

        try {
            const response = await fetch('/api/generate-insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: limitedDataForApi,
                    columns: columns,
                    prompt: fullPrompt,
                    sourceName: selectedSource?.name || 'Selected Data'
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }
            const result = await response.json();
            setInsights(result.insights);
            console.log('[Insights] API insights received.');
        } catch (error) {
            console.error('Error generating API insights:', error);
            setApiError(error instanceof Error ? error.message : 'An unknown error occurred');
        } finally {
            setLoadingInsights(false);
        }
    }, [filteredAndSortedData, detectedOutliers, columns, selectedSource, filters, excludeOutliers]);

    // Filter/Sort management functions (remain the same)
    const addFilter = useCallback(() => {
        if (!columns || columns.length === 0) return;
        const defaultField = columns[0].field;
        const defaultType = columns[0].type;
        const defaultOperators = getFilterOperatorsForType(defaultType);
        const defaultOperator = defaultOperators.length > 0 ? defaultOperators[0].value : 'contains';
        setFilters(prev => [
            ...prev,
            { id: Date.now(), field: defaultField, operator: defaultOperator, value: '' }
        ]);
    }, [columns]);
    const updateFilter = useCallback((id: number, key: keyof FilterType, value: any) => {
        setFilters(prev => prev.map(f => {
            if (f.id === id) {
                const updatedFilter = { ...f, [key]: value };
                if (key === 'field') {
                    const newColumn = columns.find(c => c.field === value);
                    const newType = newColumn?.type || 'dimension';
                    const newOperators = getFilterOperatorsForType(newType);
                    updatedFilter.operator = newOperators.length > 0 ? newOperators[0].value : 'contains';
                    updatedFilter.value = '';
                }
                return updatedFilter;
            } else {
                return f;
            }
        }));
    }, [columns]);
    const removeFilter = useCallback((id: number) => {
        setFilters(prev => prev.filter(f => f.id !== id));
    }, []);
    const handleSort = useCallback((key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);
    const getFilterOperatorsForType = (type: 'metric' | 'dimension' | 'date'): { label: string; value: FilterOperatorType }[] => {
        const common = [
            { label: 'Equals', value: 'equals' as FilterOperatorType },
            { label: 'Not Equals', value: 'not_equals' as FilterOperatorType },
        ];
        const text = [
            ...common,
            { label: 'Contains', value: 'contains' as FilterOperatorType },
            { label: 'Does Not Contain', value: 'does_not_contain' as FilterOperatorType },
            { label: 'Starts With', value: 'starts_with' as FilterOperatorType },
            { label: 'Ends With', value: 'ends_with' as FilterOperatorType },
            { label: 'Equals (Case Sensitive)', value: 'equals_case_sensitive' as FilterOperatorType },
            { label: 'Contains (Case Sensitive)', value: 'contains_case_sensitive' as FilterOperatorType },
            { label: 'Does Not Contain (Case Sensitive)', value: 'does_not_contain_case_sensitive' as FilterOperatorType },
        ];
        const numeric = [
            { label: 'Equals', value: 'equals_number' as FilterOperatorType },
            { label: 'Not Equals', value: 'not_equals' as FilterOperatorType },
            { label: 'Greater Than', value: 'greater_than' as FilterOperatorType },
            { label: 'Greater Than or Equals', value: 'greater_than_equals' as FilterOperatorType },
            { label: 'Less Than', value: 'less_than' as FilterOperatorType },
            { label: 'Less Than or Equals', value: 'less_than_equals' as FilterOperatorType },
        ];
        const date = [
            { label: 'Equals', value: 'equals' as FilterOperatorType },
            { label: 'Not Equals', value: 'not_equals' as FilterOperatorType },
            { label: 'After', value: 'greater_than' as FilterOperatorType },
            { label: 'On or After', value: 'greater_than_equals' as FilterOperatorType },
            { label: 'Before', value: 'less_than' as FilterOperatorType },
            { label: 'On or Before', value: 'less_than_equals' as FilterOperatorType },
        ];
        switch (type) {
            case 'metric': return numeric;
            case 'date': return date;
            case 'dimension': default: return text;
        }
    };

    return {
        dataSources,
        selectedSource,
        setSelectedSource,
        data: filteredAndSortedData,
        columns,
        loading: globalLoading || isGeneratingLocalInsights,
        isGeneratingLocalInsights,
        loadingInsights,
        totalRows,
        filteredRows,
        filters,
        sortConfig,
        localInsightsSummary,
        outliers: detectedOutliers,
        excludeOutliers,
        setExcludeOutliers,
        insights,
        apiError: apiError || globalError,
        addFilter,
        updateFilter,
        removeFilter,
        handleSort,
        handleOutlierDecisionAndGenerateApiInsights,
        getFilterOperatorsForType,
        previewRowCount,
        setPreviewRowCount,
    };
}