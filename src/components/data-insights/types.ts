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
    row: DataRowType;
}

export type BaseDataRowType = {
    [key: string]: string | number | Date;
};

export type DataRowType = BaseDataRowType & {
    isOutlier?: boolean;
}; 