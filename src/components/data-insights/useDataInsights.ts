import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { useDataStore } from '@/store/dataStore';
import { SHEET_TABS, SheetTab, MAX_RECOMMENDED_INSIGHT_ROWS } from '@/lib/config';
import { generateInsightsWithProvider } from '@/lib/api-router';
import { LLMProvider, DEFAULT_PROVIDER, TokenUsage, LLMResponse } from '@/lib/types/models';
import { DEFAULT_MODELS } from '@/lib/types/models';
import {
    DataSourceType,
    ColumnType,
    FilterType,
    FilterOperatorType,
    SortConfigType,
    DataRowType,
    OutlierType,
    InsightSummaryType,
    MetricSummaryItem,
    DimensionSummaryItem
} from './types';
import {
    AdMetric,
    AdGroupMetric,
    SearchTermMetric,
    isAdMetric,
    isSearchTermMetric,
    isAdGroupMetric
} from '@/lib/types';

// Define GenerateInsightsOptions locally based on usage
interface GenerateInsightsOptions {
    prompt: string;
    data: DataRowType[];
    sourceInfo: {
        name: string;
        filters: string;
        totalRows: number;
        rowsAnalyzed: number;
        outlierInfo: string;
    };
}

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

    // Define the order of metrics as per Google Ads
    const metricOrder = ['impr', 'clicks', 'cost', 'conv', 'value', 'cpc', 'ctr', 'convrate', 'cpa', 'roas'];

    // First pass to get all columns and their types from DataRowType
    const columnMap = new Map<string, ColumnType>();
    Object.keys(firstRow).forEach(key => {
        if (key === 'isOutlier') return; // Skip internal state

        const value = firstRow[key as keyof typeof firstRow];
        const lowerKey = key.toLowerCase();
        let type: 'date' | 'metric' | 'dimension' = 'dimension';

        // Use typeof check on potentially converted data
        if (value instanceof Date) {
            type = 'date';
        } else if (typeof value === 'number') {
            type = 'metric';
        } else if (lowerKey === 'date') { // Fallback for unconverted date strings? Should ideally be Date objects now
            type = 'date';
        } else if (metricOrder.includes(lowerKey)) { // Check known metric names
            type = 'metric';
        }
        // Otherwise, default to dimension

        columnMap.set(key, {
            field: key,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            type: type
        });
    });

    // Sorting logic (remains the same)
    const metrics: ColumnType[] = [];
    const otherColumns: ColumnType[] = [];
    columnMap.forEach(column => {
        if (column.type === 'metric') metrics.push(column);
        else otherColumns.push(column);
    });
    metrics.sort((a, b) => {
        const aIndex = metricOrder.indexOf(a.field.toLowerCase());
        const bIndex = metricOrder.indexOf(b.field.toLowerCase());
        if (aIndex === -1 && bIndex === -1) return a.field.localeCompare(b.field);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    return [
        ...otherColumns.filter(col => col.type === 'dimension'),
        ...otherColumns.filter(col => col.type === 'date'),
        ...metrics
    ];
};

// New helper function to derive initial columns directly from RAW data types
const deriveInitialColumnsFromRawData = (rawData: (AdMetric | SearchTermMetric | AdGroupMetric)[]): ColumnType[] => {
    if (!rawData || rawData.length === 0) return [];
    const firstRow = rawData[0]; // Assuming structure is consistent within the array

    const metricOrder = ['impr', 'clicks', 'cost', 'conv', 'value', 'cpc', 'ctr', 'convrate', 'cpa', 'roas']; // Use lowercase for matching
    const columnMap = new Map<string, ColumnType>();

    Object.keys(firstRow).forEach(key => {
        const value = firstRow[key as keyof typeof firstRow];
        const lowerKey = key.toLowerCase();
        let type: 'date' | 'metric' | 'dimension' = 'dimension';

        // Type inference based on key name and value type from RAW data
        if (lowerKey === 'date' || lowerKey.endsWith('date') || lowerKey.startsWith('date')) {
            type = 'date';
        } else if (typeof value === 'number' || metricOrder.includes(lowerKey)) {
            type = 'metric';
        }
        // Refine dimension checks if needed (e.g., campaignId, adGroupId)
        if (['campaign', 'campaignid', 'adgroup', 'adgroupid', 'searchterm', 'url'].includes(lowerKey)) {
            type = 'dimension';
        }


        columnMap.set(key, {
            field: key,
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            type: type
        });
    });

    // Sorting logic (same as deriveColumnsFromData)
    const metrics: ColumnType[] = [];
    const otherColumns: ColumnType[] = [];
    columnMap.forEach(column => {
        if (column.type === 'metric') metrics.push(column);
        else otherColumns.push(column);
    });
    metrics.sort((a, b) => {
        const aIndex = metricOrder.indexOf(a.field.toLowerCase());
        const bIndex = metricOrder.indexOf(b.field.toLowerCase());
        if (aIndex === -1 && bIndex === -1) return a.field.localeCompare(b.field);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
    });

    return [
        ...otherColumns.filter(col => col.type === 'dimension'),
        ...otherColumns.filter(col => col.type === 'date'),
        ...metrics
    ];
};

const convertToDataRows = (rawData: (AdMetric | SearchTermMetric | AdGroupMetric)[], cols: ColumnType[]): DataRowType[] => {
    if (!rawData || !cols || cols.length === 0) return [];
    return rawData.map(row => {
        const dataRow: { [key: string]: string | number | Date | boolean | undefined } = { isOutlier: false };
        cols.forEach(col => {
            const rawValue = row[col.field as keyof typeof row];
            if (col.type === 'date' && typeof rawValue === 'string') {
                try {
                    // Attempt to parse standard date formats
                    const dateValue = new Date(rawValue);
                    // Check if parsing was successful (beware of invalid dates returning Date objects)
                    dataRow[col.field] = !isNaN(dateValue.getTime()) ? dateValue : rawValue;
                } catch {
                    dataRow[col.field] = rawValue; // Fallback if Date constructor throws
                }
            } else if (col.type === 'metric' && typeof rawValue !== 'number') {
                // Attempt conversion only if it's not already a number
                const numValue = Number(rawValue);
                dataRow[col.field] = !isNaN(numValue) && isFinite(numValue) ? numValue : rawValue; // Assign number or original value
            } else {
                // Assign directly if it's already the correct type or not date/metric
                dataRow[col.field] = rawValue;
            }
        });
        return dataRow as DataRowType;
    });
};

// Define which tabs this hook supports
const SUPPORTED_INSIGHT_TABS: SheetTab[] = ['daily', 'searchTerms', 'adGroups'];

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
    const [localInsightsSummary, setLocalInsightsSummary] = useState<InsightSummaryType | null>(null);
    const [detectedOutliers, setDetectedOutliers] = useState<EnhancedOutlierType[] | null>(null);
    const [excludeOutliers, setExcludeOutliers] = useState(true);
    const [previewRowCount, setPreviewRowCount] = useState<number>(PREVIEW_ROW_OPTIONS[0]);
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const [rowCountWarning, setRowCountWarning] = useState<string | null>(null);
    const [isTimeSeries, setIsTimeSeries] = useState(false);
    const [llmProvider, setLlmProvider] = useState<LLMProvider>(DEFAULT_PROVIDER);

    // Side by side state
    const [showSideBySide, setShowSideBySide] = useState<boolean>(false);
    const [geminiInsights, setGeminiInsights] = useState<string | null>(null);
    const [openaiInsights, setOpenaiInsights] = useState<string | null>(null);
    const [loadingGeminiInsights, setLoadingGeminiInsights] = useState<boolean>(false);
    const [loadingOpenaiInsights, setLoadingOpenaiInsights] = useState<boolean>(false);
    const [geminiError, setGeminiError] = useState<string | null>(null);
    const [openaiError, setOpenaiError] = useState<string | null>(null);
    const [anthropicInsights, setAnthropicInsights] = useState<string | null>(null);
    const [loadingAnthropicInsights, setLoadingAnthropicInsights] = useState<boolean>(false);
    const [anthropicError, setAnthropicError] = useState<string | null>(null);

    // Add state for token usage
    const [geminiTokenUsage, setGeminiTokenUsage] = useState<TokenUsage | null>(null);
    const [openaiTokenUsage, setOpenaiTokenUsage] = useState<TokenUsage | null>(null);
    const [anthropicTokenUsage, setAnthropicTokenUsage] = useState<TokenUsage | null>(null);

    const resetState = useCallback((resetFiltersAndColumns = true) => {
        if (resetFiltersAndColumns) {
            // Don't reset columns here, useEffect will handle it
            // setColumns([]);
            setFilters([]);
        }
        setInsights(null);
        setLocalInsightsSummary(null);
        setDetectedOutliers(null);
        setExcludeOutliers(true);
        setApiError(null);
        // Reset side by side state
        setGeminiInsights(null);
        setOpenaiInsights(null);
        setGeminiError(null);
        setOpenaiError(null);
        // Reset Anthropic state
        setAnthropicInsights(null);
        setLoadingAnthropicInsights(false); // Ensure loading is reset
        setAnthropicError(null);
        // Reset token usage
        setGeminiTokenUsage(null);
        setOpenaiTokenUsage(null);
        setAnthropicTokenUsage(null);
        // Reset time series flag on source change
        setIsTimeSeries(false);
    }, []);

    // Effect to set default source AFTER initial data load AND data is actually available
    useEffect(() => {
        // Check if loading is finished and no source is selected yet
        if (!globalLoading && !selectedSource) {
            // Check if we actually have data in the store
            const searchTermsData = getDataForTab('searchTerms');

            if (searchTermsData && searchTermsData.length > 0) {
                const defaultSource = dataSources.find(src => src.id === 'searchTerms');
                if (defaultSource) {
                    console.log("[Insights] Data verified, setting default source to SearchTerms with", searchTermsData.length, "rows");
                    setSelectedSource(defaultSource);
                }
            } else {
                console.log("[Insights] SearchTerms data not available yet, will try again when data is ready");
            }
        }
    }, [globalLoading, selectedSource, dataSources, getDataForTab]); // Added getDataForTab as dependency

    // --- Derived State from Store ---
    const rawDataForSelectedTab = useMemo(() => {
        if (!selectedSource) return undefined; // Return undefined if no source
        const currentDataKey = selectedSource.id as SheetTab;
        try {
            // This now returns PossibleTabData (union type)
            const data = getDataForTab(currentDataKey);
            console.log(`[Insights] Retrieved ${data?.length ?? 0} rows for ${currentDataKey}`);
            return data;
        } catch (error) {
            console.error(`[Insights] Error retrieving data for tab ${currentDataKey}:`, error);
            return undefined; // Return undefined on error
        }
    }, [selectedSource, getDataForTab]); // getDataForTab can be dependency if store guarantees stability

    // Effect to derive columns based on selected source and raw data
    useEffect(() => {
        const currentDataKey = selectedSource?.id as SheetTab | undefined;

        // Clear columns immediately if source is removed
        if (!currentDataKey) {
            console.log("[Insights] No source selected, clearing columns.");
            setColumns([]);
            setIsTimeSeries(false);
            resetState(true); // Reset filters too
            return;
        }

        // Only proceed if rawData is available (not undefined)
        if (rawDataForSelectedTab !== undefined) {
            console.log(`[Insights] Processing column derivation for ${currentDataKey}`);
            // Reset insights/filters etc. when data/source changes, but not columns yet
            resetState(false);

            // Check if the selected tab is supported
            if (SUPPORTED_INSIGHT_TABS.includes(currentDataKey)) {
                if (rawDataForSelectedTab.length > 0) {
                    const firstRow = rawDataForSelectedTab[0];
                    // Type guard check - ensures the data array matches the expected type for the tab
                    if (
                        (currentDataKey === 'daily' && isAdMetric(firstRow)) ||
                        (currentDataKey === 'searchTerms' && isSearchTermMetric(firstRow)) ||
                        (currentDataKey === 'adGroups' && isAdGroupMetric(firstRow))
                    ) {
                        // Cast to the union type we know it is safe to use with helpers
                        const validRawData = rawDataForSelectedTab as (AdMetric[] | SearchTermMetric[] | AdGroupMetric[]);

                        // 1. Derive initial columns directly from raw data structure
                        const initialCols = deriveInitialColumnsFromRawData(validRawData);

                        if (initialCols.length > 0) {
                            // 2. Convert raw data rows using initial columns
                            const convertedRows = convertToDataRows(validRawData, initialCols);

                            if (convertedRows.length > 0) {
                                // 3. Derive final columns from the fully converted DataRowType[]
                                const finalColumns = deriveColumnsFromData(convertedRows);
                                console.log("[Insights] Setting final columns:", finalColumns.map(c => c.field));
                                setColumns(finalColumns);
                                setIsTimeSeries(!!finalColumns.find(col => col.type === 'date'));
                                return; // Success
                            } else {
                                console.warn(`[Insights] convertToDataRows returned empty for ${currentDataKey}`);
                            }
                        } else {
                            console.warn(`[Insights] deriveInitialColumnsFromRawData returned empty for ${currentDataKey}`);
                        }
                    } else {
                        console.warn(`[Insights] Data type mismatch for tab ${currentDataKey}. Expected AdMetric/SearchTermMetric/AdGroupMetric based on tab name, but first row didn't match type guard. First row:`, firstRow);
                    }
                } else {
                    console.log(`[Insights] Tab ${currentDataKey} is supported but has no data.`);
                    // Set empty columns for supported but empty tab
                    setColumns([]);
                    setIsTimeSeries(false);
                    return; // Processed (empty data)
                }
            } else {
                console.log(`[Insights] Tab ${currentDataKey} is not supported for insights.`);
            }
        } else {
            // rawDataForSelectedTab is undefined (still loading perhaps, or error)
            console.log("[Insights] Raw data is undefined for", currentDataKey, "- waiting or error occurred.");
        }

        // Default case: Reset columns if unsupported, error, no data, or loading raw data
        console.log(`[Insights] Resetting columns due to unsupported tab, error, or missing data for ${currentDataKey}.`);
        setColumns([]);
        setIsTimeSeries(false);

    }, [selectedSource, rawDataForSelectedTab, resetState]); // Effect Dependencies

    // --- Base Processed Data (Converted & Filtered, before sorting/outlier exclusion) ---
    const baseProcessedData = useMemo(() => {
        // Ensure columns are available before proceeding
        if (!columns || columns.length === 0 || !rawDataForSelectedTab) {
            return [];
        }

        const currentDataKey = selectedSource?.id as SheetTab | undefined;
        if (!currentDataKey || !SUPPORTED_INSIGHT_TABS.includes(currentDataKey)) {
            return []; // Don't process unsupported tabs
        }

        // Use the type-guarded raw data for conversion
        const firstRow = rawDataForSelectedTab.length > 0 ? rawDataForSelectedTab[0] : null;
        if (!firstRow || !(
            (currentDataKey === 'daily' && isAdMetric(firstRow)) ||
            (currentDataKey === 'searchTerms' && isSearchTermMetric(firstRow)) ||
            (currentDataKey === 'adGroups' && isAdGroupMetric(firstRow))
        )) {
            return []; // Mismatch detected
        }

        const validRawData = rawDataForSelectedTab as (AdMetric[] | SearchTermMetric[] | AdGroupMetric[]);

        // Convert raw data to DataRowType using the final columns derived in the effect
        let processedData = convertToDataRows(validRawData, columns);

        // Apply filters (only regular filters here)
        if (filters.length > 0) {
            processedData = processedData.filter(item => {
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
        // Reset outlier flag initially before detection runs
        processedData.forEach(row => row.isOutlier = false);

        return processedData;

    }, [rawDataForSelectedTab, filters, columns, selectedSource]); // Removed sortConfig, excludeOutliers, detectedOutliers

    // --- Outlier Detection Effect (runs on baseProcessedData) ---
    useEffect(() => {
        // Skip outlier detection if conditions met
        if (isTimeSeries || !columns.length || !baseProcessedData.length || isGeneratingLocalInsights || baseProcessedData.length < 4) {
            setDetectedOutliers(null);
            // Ensure flags are false if skipping
            baseProcessedData.forEach(row => { row.isOutlier = false; });
            return;
        }

        const CORE_OUTLIER_METRICS = ['impr', 'clicks', 'cost', 'conv', 'value'];

        // Reset flags before recalculating
        baseProcessedData.forEach(row => row.isOutlier = false);

        const metricColumnsToCheck = columns.filter(col =>
            col.type === 'metric' &&
            CORE_OUTLIER_METRICS.includes(col.field.toLowerCase())
        );

        const outliersFound: EnhancedOutlierType[] = [];

        metricColumnsToCheck.forEach(metricCol => {
            const values = baseProcessedData.map(row => row[metricCol.field]).filter(v => typeof v === 'number' && !isNaN(v)) as number[];
            if (values.length < 4) return;

            const sum = values.reduce((acc, val) => acc + val, 0);
            const mean = sum / values.length;
            const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
            const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
            const stdDev = Math.sqrt(variance);

            const lowerBound = mean - 3 * stdDev;
            const upperBound = mean + 3 * stdDev;

            // Mark rows in baseProcessedData and collect outliers
            baseProcessedData.forEach((row, rowIndex) => {
                const value = row[metricCol.field];
                if (typeof value === 'number' && !isNaN(value) && (value < lowerBound || value > upperBound)) {
                    row.isOutlier = true; // Mark the row in the base data
                    const reason = value < lowerBound
                        ? `Value is significantly lower than average (${mean.toFixed(2)})`
                        : `Value is significantly higher than average (${mean.toFixed(2)})`;
                    outliersFound.push({
                        id: `${metricCol.field}-${rowIndex}`,
                        column: metricCol.name,
                        field: metricCol.field,
                        value: value,
                        row: row, // Reference the row from baseProcessedData
                        rowIndex: rowIndex, // Use original index from baseProcessedData
                        rowData: row, // Keep for compatibility if needed elsewhere
                        reason: reason,
                        mean: mean,
                        stdDev: stdDev
                    });
                }
            });
        });

        // ... (unique outlier logic) ...
        const uniqueRowIndices = new Set<number>();
        const uniqueOutliers = outliersFound.filter(o => {
            if (uniqueRowIndices.has(o.rowIndex)) {
                return false;
            }
            uniqueRowIndices.add(o.rowIndex);
            return true;
        });

        setDetectedOutliers(uniqueOutliers.length > 0 ? uniqueOutliers : null);

    }, [baseProcessedData, columns, isGeneratingLocalInsights, isTimeSeries]); // Depends on baseProcessedData

    // --- Final Filtered and Sorted Data (Applies outlier exclusion and sorting) ---
    const filteredAndSortedData = useMemo(() => {
        let finalData = [...baseProcessedData]; // Start with filtered data

        // Apply outlier filter if enabled (using the isOutlier flag set by the effect)
        if (excludeOutliers && detectedOutliers) { // Check detectedOutliers to ensure effect has run
            finalData = finalData.filter(row => !row.isOutlier);
        }

        // Apply sorting
        if (sortConfig.key && columns.find(c => c.field === sortConfig.key)) {
            const sortColumn = columns.find(c => c.field === sortConfig.key);
            const sortType = sortColumn?.type;
            finalData.sort((a, b) => {
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

        return finalData;

        // Depends on baseProcessedData, sortConfig, excludeOutliers, and detectedOutliers (state)
    }, [baseProcessedData, sortConfig, columns, excludeOutliers, detectedOutliers]);

    // --- Total Rows Memo ---
    const totalRows = useMemo(() => baseProcessedData.length, [baseProcessedData]); // Based on data *before* outlier exclusion

    // --- Selected Source Change Effect ---
    useEffect(() => {
        resetState(true);
        setPreviewRowCount(PREVIEW_ROW_OPTIONS[0]);
    }, [selectedSource, resetState]);


    // --- Data for Summary --- relies on filteredAndSortedData
    const dataForSummary = useMemo(() => {
        return filteredAndSortedData;
    }, [filteredAndSortedData]);

    // --- Summary Calculation --- (depends on dataForSummary)
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
        const dimensionColumns = columns.filter(col =>
            (col.type === 'dimension' || col.type === 'date') &&
            col.field !== 'isOutlier'
        );

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

    }, [columns, excludeOutliers]);  // Add excludeOutliers since it's used in logging

    // --- Summary Effect --- (depends on dataForSummary)
    useEffect(() => {
        if (!columns.length || !dataForSummary.length) {
            // If no columns/data, ensure summary is nullified
            if (localInsightsSummary !== null) {
                setLocalInsightsSummary(null);
            }
            return;
        }
        calculateSummary(dataForSummary);
    }, [dataForSummary, columns, calculateSummary, localInsightsSummary]); // Added localInsightsSummary to prevent re-calc if already set


    // --- Side-by-Side Generation --- (depends on dataForSummary, totalRows)
    const handleGenerateSideBySideInsights = useCallback(async (prompt: string, providers: [LLMProvider, LLMProvider]) => {
        if (!prompt || !localInsightsSummary || !dataForSummary.length) {
            console.error("[Insights] Missing required data for side-by-side generation");
            return;
        }

        // Clear previous errors/results for the selected providers
        providers.forEach(provider => {
            if (provider === 'gemini') {
                setGeminiInsights(null);
                setGeminiError(null);
                setGeminiTokenUsage(null);
                setLoadingGeminiInsights(true);
            } else if (provider === 'openai') {
                setOpenaiInsights(null);
                setOpenaiError(null);
                setOpenaiTokenUsage(null);
                setLoadingOpenaiInsights(true);
            } else if (provider === 'anthropic') {
                setAnthropicInsights(null);
                setAnthropicError(null);
                setAnthropicTokenUsage(null);
                setLoadingAnthropicInsights(true);
            }
        });

        const dataForAnalysis = !isTimeSeries && excludeOutliers && detectedOutliers
            ? dataForSummary.filter(row => !detectedOutliers.some(o => o.rowIndex === row.originalIndex))
            : dataForSummary;

        // --- Construct sourceInfo (Mirroring single insight generation) ---
        const outlierInfoForPrompt = isTimeSeries
            ? "Time series data detected; outliers were not checked or excluded."
            : (excludeOutliers && detectedOutliers && detectedOutliers.length > 0
                ? `${detectedOutliers.length} potential outliers were excluded based on standard deviation analysis.`
                : "Outliers were included.");

        const sourceInfo = {
            name: selectedSource?.name || 'Selected Data',
            filters: filters.length > 0 ? filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(', ') : 'None',
            totalRows: totalRows, // Use totalRows before outlier exclusion
            rowsAnalyzed: dataForAnalysis.length,
            outlierInfo: outlierInfoForPrompt
        };
        // --- End construct sourceInfo ---

        // Prepare the payload with sourceInfo
        const payload: GenerateInsightsOptions = {
            prompt,
            data: dataForAnalysis,
            sourceInfo: sourceInfo,
            // The following were removed as they are now part of sourceInfo or not directly needed by API
            // columns,
            // localSummary: localInsightsSummary,
            // currency: settings.currency,
        };

        console.log(`[Insights] Generating side-by-side insights for ${providers.join(' and ')} with ${dataForAnalysis.length} rows using payload:`, payload);

        try {
            const insightPromises = providers.map(provider =>
                generateInsightsWithProvider(payload, provider)
            );

            const results = await Promise.allSettled(insightPromises);

            results.forEach((result, index) => {
                const provider = providers[index];
                if (result.status === 'fulfilled') {
                    const { content, usage, error } = result.value as LLMResponse & { usage?: TokenUsage, error?: string };
                    if (error) {
                        console.error(`[Insights] Error from ${provider}:`, error);
                        if (provider === 'gemini') setGeminiError(error);
                        else if (provider === 'openai') setOpenaiError(error);
                        else if (provider === 'anthropic') setAnthropicError(error);
                    } else {
                        if (provider === 'gemini') {
                            setGeminiInsights(content);
                            setGeminiTokenUsage(usage ?? null);
                        } else if (provider === 'openai') {
                            setOpenaiInsights(content);
                            setOpenaiTokenUsage(usage ?? null);
                        } else if (provider === 'anthropic') {
                            setAnthropicInsights(content);
                            setAnthropicTokenUsage(usage ?? null);
                        }
                    }
                } else {
                    // Promise rejected
                    const reason = result.reason || 'Unknown error during API call';
                    console.error(`[Insights] API call failed for ${provider}:`, reason);
                    const errorMessage = typeof reason === 'string' ? reason : (reason as Error)?.message || 'Failed to generate insights';
                    if (provider === 'gemini') setGeminiError(errorMessage);
                    else if (provider === 'openai') setOpenaiError(errorMessage);
                    else if (provider === 'anthropic') setAnthropicError(errorMessage);
                }
            });

        } catch (err: any) {
            console.error("[Insights] Unexpected error during side-by-side generation:", err);
            // Set a general error for both? Or decide how to handle this.
            // For now, setting the error for both requested providers
            providers.forEach(provider => {
                const msg = err.message || 'An unexpected error occurred';
                if (provider === 'gemini') setGeminiError(msg);
                else if (provider === 'openai') setOpenaiError(msg);
                else if (provider === 'anthropic') setAnthropicError(msg);
            });
        } finally {
            // Stop loading indicators for the requested providers
            providers.forEach(provider => {
                if (provider === 'gemini') setLoadingGeminiInsights(false);
                else if (provider === 'openai') setLoadingOpenaiInsights(false);
                else if (provider === 'anthropic') setLoadingAnthropicInsights(false);
            });
        }
    }, [
        localInsightsSummary,
        excludeOutliers,
        detectedOutliers,
        isTimeSeries,
        dataForSummary, // Use dataForSummary
        totalRows,      // Use totalRows
        selectedSource,
        filters
    ]);


    // --- Single API Insights Generation --- (depends on filteredAndSortedData)
    const handleOutlierDecisionAndGenerateApiInsights = useCallback(async (prompt: string) => {
        // If side by side is enabled, use that function instead, passing the current single provider
        if (showSideBySide) {
            // This case should ideally be handled by the component directly calling handleGenerateSideBySideInsights
            // with the *two* selected providers. This function is primarily for single-provider generation.
            // However, to maintain current structure, we'll log a warning and potentially call side-by-side
            // with default providers if needed, though the component should manage this.
            console.warn("[Insights] handleOutlierDecisionAndGenerateApiInsights called while showSideBySide is true. Component should call handleGenerateSideBySideInsights directly.");
            // Optionally trigger side-by-side with default/current providers if necessary, but ideally prevent this path.
            // handleGenerateSideBySideInsights(prompt, [llmProvider, /* determine second provider */ ]);
            return; // Prevent single generation when side-by-side is active
        }

        if (!prompt || !localInsightsSummary || !dataForSummary.length) {
            setApiError("Missing prompt, summary, or data for analysis.");
            return;
        }

        setLoadingInsights(true);
        setApiError(null);
        setInsights(null);

        // Reset token usage when starting a new generation
        if (llmProvider === 'gemini') {
            setGeminiTokenUsage(null);
        } else if (llmProvider === 'openai') {
            setOpenaiTokenUsage(null);
        } else if (llmProvider === 'anthropic') {
            setAnthropicTokenUsage(null);
        }

        let dataForApi = filteredAndSortedData;
        let outlierInfoForPrompt = isTimeSeries
            ? "Time series data detected; outliers were not checked or excluded."
            : (excludeOutliers && detectedOutliers && detectedOutliers.length > 0
                ? `${detectedOutliers.length} potential outliers were excluded based on standard deviation analysis.`
                : "Outliers were included.");

        if (excludeOutliers && detectedOutliers && detectedOutliers.length > 0) {
            // Filter based on isOutlier flag, which is reliable now
            dataForApi = filteredAndSortedData.filter(row => !row.isOutlier);
            outlierInfoForPrompt = `${detectedOutliers.length} potential outliers were excluded based on standard deviation analysis.`;
        }

        if (dataForApi.length === 0) {
            setApiError('No data available to send for AI analysis after filtering (and potentially outlier removal).');
            setLoadingInsights(false);
            return;
        }

        try {
            // Prepare the source info
            const sourceInfo = {
                name: selectedSource?.name || 'Selected Data',
                filters: filters.length > 0 ? filters.map(f => `${f.field} ${f.operator} ${f.value}`).join(', ') : 'None',
                totalRows: filteredAndSortedData.length,
                rowsAnalyzed: dataForApi.length,
                outlierInfo: outlierInfoForPrompt
            };

            // Use the router to call the appropriate API
            const response = await generateInsightsWithProvider(
                {
                    data: dataForApi,
                    sourceInfo,
                    prompt
                },
                llmProvider
            );

            // Set the generated insights and token usage
            setInsights(response.content);

            // Save token usage based on provider
            if (llmProvider === 'gemini') {
                setGeminiTokenUsage(response.usage);
            } else if (llmProvider === 'openai') {
                setOpenaiTokenUsage(response.usage);
            } else if (llmProvider === 'anthropic') {
                setAnthropicTokenUsage(response.usage);
            }

        } catch (error) {
            console.error('[Insights] Error during API insights generation:', error);
            setApiError(error instanceof Error ? error.message : 'An unknown error occurred during the API call');
            setInsights(null);
        } finally {
            setLoadingInsights(false);
        }
    }, [
        filteredAndSortedData, // Use final data
        detectedOutliers,
        selectedSource,
        filters,
        excludeOutliers,
        isTimeSeries,
        llmProvider,
        showSideBySide,
        dataForSummary.length, // Keep dataForSummary.length for checks if needed
        localInsightsSummary
    ]);

    // Filter/Sort management functions (remain the same)
    const addFilter = useCallback(() => {
        if (!columns || columns.length === 0) return;
        const defaultField = columns[0].field;
        const defaultType = columns[0].type;
        // Set default operator based on type: '>' for metric, 'contains' otherwise
        const defaultOperator = defaultType === 'metric' ? 'greater_than' : 'contains';

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
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
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
            { label: 'Greater Than', value: 'greater_than' as FilterOperatorType },
            { label: 'Less Than', value: 'less_than' as FilterOperatorType },
            { label: 'Equals', value: 'equals_number' as FilterOperatorType },
            { label: 'Not Equals', value: 'not_equals' as FilterOperatorType },
            { label: 'Greater Than or Equals', value: 'greater_than_equals' as FilterOperatorType },
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

    // --- Reset and Handlers ---
    const handleSourceChange = useCallback((source: DataSourceType | null) => {
        console.log("[Insights] Source changed to:", source?.id);
        setSelectedSource(source);
        lastDataKeyRef.current = null; // Force column recalculation
        // Reset everything except columns (useEffect will handle columns)
        resetState(true); // Reset filters etc.
    }, [resetState]);

    return {
        dataSources,
        selectedSource,
        handleSourceChange,
        columns,
        filteredAndSortedData,
        totalRows,
        loading: globalLoading || isGeneratingLocalInsights,
        isGeneratingLocalInsights,
        loadingInsights,
        filteredRows: filteredAndSortedData.length,
        filters,
        sortConfig,
        localInsightsSummary,
        outliers: detectedOutliers,
        excludeOutliers,
        setExcludeOutliers,
        insights,
        apiError: apiError || globalError,
        rowCountWarning,
        addFilter,
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
        modelNames: DEFAULT_MODELS,
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
        anthropicTokenUsage,
        anthropicInsights,
        loadingAnthropicInsights,
        anthropicError
    };
}