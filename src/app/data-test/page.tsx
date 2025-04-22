'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { fetchAllTabsData } from '@/lib/sheetsData'
import { SHEET_TABS, SheetTab } from '@/lib/config'
import { TabData } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ArrowUpDown } from 'lucide-react'

const ROW_OPTIONS = [10, 30, 50, 100, 200, 500];

type SortDirection = 'asc' | 'desc';

export default function DataTestPage() {
    const { settings } = useSettings()
    const [tabData, setTabData] = useState<TabData | null>(null)
    const [selectedTab, setSelectedTab] = useState<SheetTab>('daily')
    const [rowsToShow, setRowsToShow] = useState<number>(10);
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    useEffect(() => {
        if (!settings.sheetUrl) {
            setIsLoading(false)
            setError('Please configure your Google Sheet URL in settings')
            return
        }

        async function loadData() {
            try {
                setIsLoading(true)
                setError(null)
                const data = await fetchAllTabsData(settings.sheetUrl)
                setTabData(data)
            } catch (err: any) {
                console.error('Error fetching data:', err)
                setError(`Failed to load data: ${err?.message || 'Unknown error'}`)
            } finally {
                setIsLoading(false)
            }
        }

        loadData()
    }, [settings.sheetUrl])

    useEffect(() => {
        setSortKey(null);
        setSortDirection('asc');
    }, [selectedTab]);

    const getSelectedTabData = useCallback(() => {
        if (!tabData) return []
        return tabData[selectedTab] || []
    }, [tabData, selectedTab]);

    const getDataKeys = useCallback(() => {
        const data = getSelectedTabData()
        if (data.length === 0) return []
        return Object.keys(data[0] || {})
    }, [getSelectedTabData]);

    const dataKeys = getDataKeys()

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc');
        }
    };

    const sortedData = useMemo(() => {
        const dataToSort = getSelectedTabData();
        if (!sortKey || dataToSort.length === 0) {
            return dataToSort;
        }

        return [...dataToSort].sort((a, b) => {
            const aValue = a[sortKey as keyof typeof a];
            const bValue = b[sortKey as keyof typeof b];

            if (aValue < bValue) {
                return sortDirection === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [sortKey, sortDirection, getSelectedTabData]);

    return (
        <div className="container mx-auto px-4 py-12 mt-16">
            <h1 className="text-3xl font-bold mb-8">Data Testing Page</h1>

            {error ? (
                <div className="text-red-500 mb-4">{error}</div>
            ) : isLoading ? (
                <div>Loading...</div>
            ) : (
                <div className="space-y-6">
                    <div className="flex space-x-4 items-end">
                        <div>
                            <Label htmlFor="tab-select" className="block text-sm font-medium mb-2">Select Data Tab</Label>
                            <Select value={selectedTab} onValueChange={(value) => setSelectedTab(value as SheetTab)}>
                                <SelectTrigger id="tab-select" className="w-[200px]">
                                    <SelectValue placeholder="Select tab" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SHEET_TABS.map((tab) => (
                                        <SelectItem key={tab} value={tab}>
                                            {tab}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="rows-select" className="block text-sm font-medium mb-2">Rows per Page</Label>
                            <Select value={String(rowsToShow)} onValueChange={(value) => setRowsToShow(Number(value))}>
                                <SelectTrigger id="rows-select" className="w-[120px]">
                                    <SelectValue placeholder="Rows" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROW_OPTIONS.map((option) => (
                                        <SelectItem key={option} value={String(option)}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Card className="p-6 bg-white rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-2">Tab: {selectedTab}</h2>
                        <p className="mb-4">Total rows: {sortedData.length}</p>

                        {sortedData.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {dataKeys.map((key) => (
                                                <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => handleSort(key)}
                                                        className="px-1 py-1 h-auto text-xs"
                                                    >
                                                        {key}
                                                        {sortKey === key && (
                                                            <ArrowUpDown className={`ml-2 h-3 w-3 ${sortDirection === 'asc' ? '' : 'transform rotate-180'}`} />
                                                        )}
                                                    </Button>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedData.slice(0, rowsToShow).map((row, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {dataKeys.map((key) => (
                                                    <td key={`${rowIndex}-${key}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {typeof row[key as keyof typeof row] === 'number'
                                                            ? Number(row[key as keyof typeof row]).toLocaleString()
                                                            : String(row[key as keyof typeof row])}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p>No data available for this tab</p>
                        )}
                    </Card>
                </div>
            )}
        </div>
    )
} 