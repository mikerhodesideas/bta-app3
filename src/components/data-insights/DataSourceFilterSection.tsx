import React from 'react';
import { ListFilter, Loader2, X, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { ColumnType, FilterOperatorType, FilterType, DataSourceType } from './types';

export interface DataSourceFilterSectionProps {
    dataSources: DataSourceType[];
    selectedSource: DataSourceType | null;
    handleSourceChange: (src: DataSourceType | null) => void;
    loading: boolean;
    isGeneratingLocalInsights: boolean;
    columns: ColumnType[];
    filters: FilterType[];
    addFilter: () => void;
    updateFilter: (id: number, field: keyof FilterType, value: string | FilterOperatorType) => void;
    removeFilter: (id: number) => void;
    activeFilterId?: number | null;
    setActiveFilterId?: (id: number | null) => void;
    getFilterOperatorsForType: (type: 'date' | 'dimension' | 'metric') => { value: FilterOperatorType; label: string }[];
}

export const DataSourceFilterSection: React.FC<DataSourceFilterSectionProps> = ({
    dataSources,
    selectedSource,
    handleSourceChange,
    loading,
    isGeneratingLocalInsights,
    columns,
    filters,
    addFilter,
    updateFilter,
    removeFilter,
    getFilterOperatorsForType,
}) => {
    const [internalActiveFilterId, setInternalActiveFilterId] = React.useState<number | null>(null);

    const columnsAvailable = columns.length > 0;

    const onSourceSelect = (value: string) => {
        const src = dataSources.find(d => d.id === value) || null;
        handleSourceChange(src);
        setInternalActiveFilterId(null);
    };

    const applyFilterChanges = () => {
        setInternalActiveFilterId(null);
    };

    const cancelFilterChanges = () => {
        setInternalActiveFilterId(null);
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Select Data Source */}
            <Card className="shadow-lg ring-1 ring-blue-200">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-4 rounded-t-lg">
                    <CardTitle className="text-lg font-bold flex items-center">
                        <ListFilter className="h-5 w-5 mr-2" />1. Select Data Source
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <Select
                        value={selectedSource?.id || ''}
                        onValueChange={onSourceSelect}
                        disabled={loading}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a data source" />
                        </SelectTrigger>
                        <SelectContent>
                            {dataSources.map(src => (
                                <SelectItem key={src.id} value={src.id}>{src.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {loading && !isGeneratingLocalInsights && (
                        <div className="mt-2 flex items-center text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading sheet data...
                        </div>
                    )}
                    {!loading && !selectedSource && (
                        <div className="mt-2 flex items-center text-sm text-blue-500">
                            <Info className="h-4 w-4 mr-2" /> Please select a data source
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Step 2: Filter Data */}
            <Card className="shadow-lg ring-1 ring-green-200">
                <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white p-4 rounded-t-lg flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center">
                        <ListFilter className="h-5 w-5 mr-2" />2. Filter Data
                    </CardTitle>
                    <Button
                        variant="outline" size="sm"
                        onClick={addFilter}
                        disabled={!selectedSource || !columnsAvailable || loading || filters.length >= 5}
                        title={!selectedSource ? "Select a data source first" : !columnsAvailable ? "No columns available for filtering" : filters.length >= 5 ? "Maximum 5 filters allowed" : "Add a new filter"}
                    >
                        Add Filter
                    </Button>
                </CardHeader>
                <CardContent className="pt-4 space-y-2 min-h-[60px]">
                    {/* Active Filter Editor */}
                    {internalActiveFilterId !== null && columnsAvailable && (
                        <div className="mb-3 p-3 bg-gray-50 border rounded-md overflow-hidden">
                            {(() => {
                                const filter = filters.find(f => f.id === internalActiveFilterId);
                                if (!filter) return null;
                                const column = columns.find(c => c.field === filter.field);
                                const currentColumnType = column?.type || 'dimension';
                                const operators = getFilterOperatorsForType(currentColumnType);
                                return (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-medium text-sm text-gray-700">Edit Filter: {column?.name || filter.field || 'New Filter'}</h3>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setInternalActiveFilterId(null)}><X size={16} /></Button>
                                        </div>
                                        <Select
                                            value={filter.field}
                                            onValueChange={(val) => updateFilter(filter.id, 'field', val)}
                                            disabled={!columnsAvailable}
                                        >
                                            <SelectTrigger className="w-full bg-white text-sm"><SelectValue placeholder="Select field..." /></SelectTrigger>
                                            <SelectContent>
                                                {columnsAvailable
                                                    ? columns.map(c => <SelectItem key={c.field} value={c.field}>{c.name}</SelectItem>)
                                                    : <SelectItem value="loading" disabled>Loading columns...</SelectItem>
                                                }
                                            </SelectContent>
                                        </Select>
                                        <Select
                                            value={filter.operator}
                                            onValueChange={(val) => updateFilter(filter.id, 'operator', val as FilterOperatorType)}
                                            disabled={!columnsAvailable || !filter.field || operators.length === 0}
                                        >
                                            <SelectTrigger className="w-full bg-white text-sm"><SelectValue placeholder="Select operator..." /></SelectTrigger>
                                            <SelectContent>
                                                {operators.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <input
                                            type={currentColumnType === 'metric' ? 'number' : currentColumnType === 'date' ? 'date' : 'text'}
                                            className="p-2 border rounded-md w-full text-sm bg-white"
                                            value={filter.value}
                                            onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                            placeholder={`Enter value${column ? ` for ${column.name}` : ''}`}
                                            disabled={!columnsAvailable || !filter.field}
                                        />
                                        <div className="flex justify-between pt-2">
                                            <Button variant="ghost" size="sm" onClick={cancelFilterChanges}>Cancel</Button>
                                            <div className="flex space-x-2">
                                                <Button variant="destructive" size="sm" onClick={() => { removeFilter(filter.id); setInternalActiveFilterId(null); }}>Remove</Button>
                                                <Button variant="default" size="sm" onClick={applyFilterChanges} disabled={!filter.field || !filter.operator}>Apply Filter</Button>
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
                                const col = columns.find(c => c.field === filter.field);
                                const opObj = getFilterOperatorsForType(col?.type || 'dimension').find(o => o.value === filter.operator);
                                return (
                                    <Badge key={filter.id} variant="secondary" className="py-1 px-2 cursor-pointer group relative hover:bg-gray-200 rounded-full text-xs" onClick={() => setInternalActiveFilterId(filter.id)}>
                                        {col?.name || filter.field} {opObj?.label || filter.operator} {filter.value}
                                        <button className="ml-1.5 opacity-50 group-hover:opacity-100 text-red-500 hover:text-red-700 rounded-full p-0.5 hover:bg-red-100" onClick={(e) => { e.stopPropagation(); removeFilter(filter.id); setInternalActiveFilterId(filter.id === internalActiveFilterId ? null : internalActiveFilterId); }}>
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
    );
}; 