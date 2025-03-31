'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { fetchAllTabsData } from '@/lib/sheetsData'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { SearchTermMetric, TabData } from '@/lib/types'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button'

type SortField = keyof SearchTermMetric
type SortDirection = 'asc' | 'desc'

export default function TermsPage() {
    const { settings } = useSettings()
    const [sortField, setSortField] = useState<SortField>('cost')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

    const { data: tabsData, error, isLoading } = useSWR<TabData>(
        settings.sheetUrl,
        fetchAllTabsData
    )

    if (error) {
        return (
            <div className="p-8 text-center">
                <div className="text-red-500 mb-4">Error loading data</div>
            </div>
        )
    }

    if (isLoading) {
        return <div className="p-8 text-center">Loading...</div>
    }

    const searchTerms = (tabsData?.searchTerms || []) as SearchTermMetric[]

    // Sort data
    const sortedTerms = [...searchTerms].sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        const multiplier = sortDirection === 'asc' ? 1 : -1
        return (Number(aVal) - Number(bVal)) * multiplier
    })

    const handleSort = (field: SortField) => {
        if (field === sortField) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('desc')
        }
    }

    const SortButton = ({ field, children }: { field: SortField, children: React.ReactNode }) => (
        <Button
            variant="ghost"
            onClick={() => handleSort(field)}
            className="h-8 px-2 lg:px-3"
        >
            {children}
            {sortField === field && (
                <span className="ml-2">
                    {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
            )}
        </Button>
    )

    return (
        <div className="container mx-auto px-4 py-12 mt-16">
            <h1 className="text-3xl font-bold mb-12 text-gray-900">Search Terms</h1>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[200px]">
                                <SortButton field="searchTerm">Search Term</SortButton>
                            </TableHead>
                            <TableHead>
                                <SortButton field="campaign">Campaign</SortButton>
                            </TableHead>
                            <TableHead>
                                <SortButton field="adGroup">Ad Group</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="impr">Impr</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="clicks">Clicks</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="cost">Cost</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="conv">Conv</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="value">Value</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="ctr">CTR</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="convRate">CvR</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="cpa">CPA</SortButton>
                            </TableHead>
                            <TableHead className="text-right">
                                <SortButton field="roas">ROAS</SortButton>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedTerms.slice(0, 10).map((term, i) => (
                            <TableRow key={`${term.searchTerm}-${i}`}>
                                <TableCell className="font-medium">{term.searchTerm}</TableCell>
                                <TableCell>{term.campaign}</TableCell>
                                <TableCell>{term.adGroup}</TableCell>
                                <TableCell className="text-right">{formatNumber(term.impr)}</TableCell>
                                <TableCell className="text-right">{formatNumber(term.clicks)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(term.cost, settings.currency)}</TableCell>
                                <TableCell className="text-right">{formatNumber(term.conv)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(term.value, settings.currency)}</TableCell>
                                <TableCell className="text-right">{formatPercent(term.ctr * 100)}</TableCell>
                                <TableCell className="text-right">{formatPercent(term.convRate * 100)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(term.cpa, settings.currency)}</TableCell>
                                <TableCell className="text-right">{term.roas.toFixed(2)}x</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
} 