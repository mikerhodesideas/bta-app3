// src/components/negative-keywords/CampaignNegativeAuditTable.tsx
import React, { useState, useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useSettings } from '@/lib/contexts/SettingsContext';
import { formatCurrency } from '@/lib/utils'; // Assuming a utility for currency formatting
import { Button } from "@/components/ui/button";

export interface CampaignNegativeDetail {
    campaignId: string;
    campaignName: string;
    cost: number;
    listsAppliedCount: number;
    campaignNegCount: number;
    adGroupCount: number;
    adGroupsWithNegsCount: number;
    totalAdGroupNegCount: number;
}

interface CampaignNegativeAuditTableProps {
    data: CampaignNegativeDetail[];
}

const CampaignNegativeAuditTable: React.FC<CampaignNegativeAuditTableProps> = ({ data }) => {
    const { settings } = useSettings();
    const rowsPerPage = 10;
    const [page, setPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: keyof CampaignNegativeDetail; direction: 'asc' | 'desc' }>({ key: 'cost', direction: 'desc' });
    const handleSort = (key: keyof CampaignNegativeDetail) => {
        if (sortConfig.key === key) {
            setSortConfig({ key, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
        } else {
            setSortConfig({ key, direction: 'desc' });
        }
        setPage(1);
    };
    const sortIndicator = (key: keyof CampaignNegativeDetail) => {
        if (sortConfig.key === key) {
            return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
        }
        return null;
    };
    const sortedData = useMemo(() => {
        const sortable = [...data];
        const { key, direction } = sortConfig;
        sortable.sort((a, b) => {
            const aVal = a[key];
            const bVal = b[key];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }
            return 0;
        });
        return sortable;
    }, [data, sortConfig]);
    const paginatedData = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        return sortedData.slice(start, start + rowsPerPage);
    }, [sortedData, page]);
    const totalPages = Math.ceil(data.length / rowsPerPage);

    return (
        <div className="overflow-x-auto mt-4 mb-4 border rounded-md">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="w-[300px] cursor-pointer" onClick={() => handleSort('campaignName')}>Campaign{sortIndicator('campaignName')}</TableHead>
                        <TableHead className="text-right cursor-pointer" onClick={() => handleSort('cost')}>Cost ({settings.currency}){sortIndicator('cost')}</TableHead>
                        <TableHead className="text-center cursor-pointer" onClick={() => handleSort('listsAppliedCount')}>Lists Applied{sortIndicator('listsAppliedCount')}</TableHead>
                        <TableHead className="text-center cursor-pointer" onClick={() => handleSort('campaignNegCount')}>Campaign Negs{sortIndicator('campaignNegCount')}</TableHead>
                        <TableHead className="text-center cursor-pointer" onClick={() => handleSort('adGroupCount')}>Total Ad Groups{sortIndicator('adGroupCount')}</TableHead>
                        <TableHead className="text-center cursor-pointer" onClick={() => handleSort('adGroupsWithNegsCount')}>Ad Groups w/ Negs{sortIndicator('adGroupsWithNegsCount')}</TableHead>
                        <TableHead className="text-center cursor-pointer" onClick={() => handleSort('totalAdGroupNegCount')}>Total Ad Group Negs{sortIndicator('totalAdGroupNegCount')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {paginatedData.map((campaign) => (
                        <TableRow key={campaign.campaignId}>
                            <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(campaign.cost, settings.currency)}</TableCell>
                            <TableCell className="text-center">{campaign.listsAppliedCount}</TableCell>
                            <TableCell className="text-center">{campaign.campaignNegCount}</TableCell>
                            <TableCell className="text-center">{campaign.adGroupCount}</TableCell>
                            <TableCell className="text-center">{campaign.adGroupsWithNegsCount}</TableCell>
                            <TableCell className="text-center">{campaign.totalAdGroupNegCount}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {/* Pagination Controls */}
            <div className="flex items-center justify-between p-2">
                <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, data.length)} of {data.length} entries
                </div>
                <div className="flex space-x-1">
                    <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>Previous</Button>
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(pg => (
                        <Button key={pg} variant={pg === page ? 'default' : 'outline'} size="sm" onClick={() => setPage(pg)}>{pg}</Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>Next</Button>
                </div>
            </div>
        </div>
    );
};

export default CampaignNegativeAuditTable; 