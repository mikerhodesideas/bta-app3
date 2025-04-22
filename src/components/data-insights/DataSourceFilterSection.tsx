import React from 'react';
import { ListFilter, Loader2, X, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import type { ColumnType, FilterOperatorType, FilterType } from './types';

export interface DataSourceFilterSectionProps {
    dataSources: { id: string; name: string }[];
    selectedSource: { id: string; name: string } | null;
    setSelectedSource: (src: { id: string; name: string } | null) => void;
    loading: boolean;
    isGeneratingLocalInsights: boolean;
    columnsAvailable: boolean;
    filters: FilterType[];
    addFilter: () => void;
    updateFilter: (id: number, field: keyof FilterType, value: string) => void;
    removeFilter: (id: number) => void;
    activeFilterId: number | null;
    setActiveFilterId: (id: number | null) => void;
    getFilterOperatorsForType: (type: 'date' | 'dimension' | 'metric') => { value: FilterOperatorType; label: string }[];
}

export const DataSourceFilterSection: React.FC<DataSourceFilterSectionProps> = ({
    dataSources,
    selectedSource,
    setSelectedSource,
    loading,
    isGeneratingLocalInsights,
    columnsAvailable,
    filters,
    addFilter,
    updateFilter,
    removeFilter,
    activeFilterId,
    setActiveFilterId,
    getFilterOperatorsForType,
}) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1: Select Data Source */}
        <Card className="shadow-sm border border-gray-200">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800">
                    <ListFilter className="inline h-5 w-5 mr-2 text-blue-600" />1. Select Data Source
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Select
                    value={selectedSource?.id || ''}
                    onValueChange={(value) => {
                        const src = dataSources.find(d => d.id === value) || null;
                        setSelectedSource(src);
                        setActiveFilterId(null);
                    }}
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
        <Card className="shadow-sm border border-gray-200">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800 flex items-center justify-between">
                    <span>
                        <ListFilter className="inline h-5 w-5 mr-2 text-blue-600" />2. Filter Data
                    </span>
                    <Button
                        variant="outline" size="sm"
                        onClick={addFilter}
                        disabled={!selectedSource || !columnsAvailable || loading || filters.length >= 5}
                        title={!selectedSource ? "Select a data source first" : !columnsAvailable ? "Columns loading..." : filters.length >= 5 ? "Maximum 5 filters allowed" : "Add a new filter"}
                    >
                        Add Filter
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
                            const column = columnsAvailable ? filter.field : undefined;
                            const currentColumnType: 'date' | 'dimension' | 'metric' = column ? 'dimension' : 'dimension';
                            const operators = getFilterOperatorsForType(currentColumnType);
                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-medium text-sm text-gray-700">Edit Filter: {filter.field}</h3>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setActiveFilterId(null)}><X size={16} /></Button>
                                    </div>
                                    <Select value={filter.field} onValueChange={(val) => updateFilter(filter.id, 'field', val)} disabled={!columnsAvailable}>
                                        <SelectTrigger className="w-full bg-white text-sm"><SelectValue placeholder="Select field..." /></SelectTrigger>
                                        <SelectContent>
                                            {columnsAvailable ? filters.map(c => <SelectItem key={c.id} value={c.field}>{c.field}</SelectItem>) : <SelectItem disabled>Loading columns...</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                    <Select value={filter.operator} onValueChange={(val) => updateFilter(filter.id, 'operator', val as FilterOperatorType)} disabled={!columnsAvailable || operators.length === 0}>
                                        <SelectTrigger className="w-full bg-white text-sm"><SelectValue placeholder="Select operator..." /></SelectTrigger>
                                        <SelectContent>
                                            {operators.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <input
                                        type="text"
                                        className="p-2 border rounded-md w-full text-sm bg-white"
                                        value={filter.value}
                                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                                        placeholder="Enter value"
                                    />
                                    <div className="flex justify-between pt-2">
                                        <Button variant="ghost" size="sm" onClick={() => setActiveFilterId(null)}>Cancel</Button>
                                        <div className="flex space-x-2">
                                            <Button variant="destructive" size="sm" onClick={() => { removeFilter(filter.id); setActiveFilterId(null); }}>Remove</Button>
                                            <Button variant="default" size="sm" onClick={() => setActiveFilterId(null)}>Apply Filter</Button>
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
                        {filters.map(filter => (
                            <Badge key={filter.id} variant="secondary" className="py-1 px-2 cursor-pointer group relative hover:bg-gray-200 rounded-full text-xs" onClick={() => setActiveFilterId(filter.id)}>
                                {filter.field} {filter.operator} {filter.value}
                                <button className="ml-1.5 opacity-50 group-hover:opacity-100 text-red-500 hover:text-red-700 rounded-full p-0.5 hover:bg-red-100" onClick={(e) => { e.stopPropagation(); removeFilter(filter.id); }}>
                                    <X size={10} />
                                </button>
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic">No filters applied.</p>
                )}
            </CardContent>
        </Card>
    </div>
); 