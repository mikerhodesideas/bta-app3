// src/components/data-insights/types.ts

export type DataSourceType = {
    id: string;
    name: string;
};

export type ColumnType = {
    field: string;
    name: string;
    type: 'date' | 'dimension' | 'metric';
};

export type FilterOperatorType =
    // String operators
    | 'contains'
    | 'does_not_contain'
    | 'contains_case_sensitive'
    | 'does_not_contain_case_sensitive'
    | 'equals'
    | 'equals_case_sensitive'
    | 'starts_with'
    | 'ends_with'
    // Number operators
    | 'greater_than'
    | 'greater_than_equals'
    | 'less_than'
    | 'less_than_equals'
    | 'equals_number'
    | 'not_equals';

export type FilterType = {
    id: number;
    field: string;
    operator: FilterOperatorType;
    value: string;
};

export type SortConfigType = {
    key: string;
    direction: 'asc' | 'desc';
};

export type ChartDataType = {
    data: any[];
    xField: string;
    yField: string;
    title: string;
} | null;

export interface OutlierType {
    id: string;
    column: string;
    field: string;
    value: number;
    rowData: DataRowType;
    reason?: string;
    mean?: number;
    stdDev?: number;
}

export type BaseDataRowType = {
    [key: string]: string | number | Date;
};

export type DataRowFields = {
    [key: string]: string | number | Date | undefined;
};

export type DataRowType = DataRowFields & {
    isOutlier?: boolean;
};

export interface MetricSummaryItem {
    name: string;
    min?: number;
    max?: number;
    avg?: number;
    sum?: number;
}

export interface DimensionValueSummary {
    value: string;
    count: number;
    metrics: {
        cost?: number;
        clicks?: number;
        value?: number;
        conv?: number;
    };
}

export interface DimensionSummaryItem {
    name: string;
    uniqueCount?: number;
    topValues?: DimensionValueSummary[];
}

export interface InsightSummaryType {
    rowCount: number;
    metrics: MetricSummaryItem[];
    dimensions: DimensionSummaryItem[];
} 