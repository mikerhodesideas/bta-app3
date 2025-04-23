// src/components/negative-keywords/CampaignNegativeAuditTable.tsx
import React from 'react';
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

    return (
        <div className="overflow-x-auto mt-4 mb-4 border rounded-md">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="w-[300px]">Campaign</TableHead>
                        <TableHead className="text-right">Cost ({settings.currency})</TableHead>
                        <TableHead className="text-center">Lists Applied</TableHead>
                        <TableHead className="text-center">Campaign Negs</TableHead>
                        <TableHead className="text-center">Total Ad Groups</TableHead>
                        <TableHead className="text-center">Ad Groups w/ Negs</TableHead>
                        <TableHead className="text-center">Total Ad Group Negs</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((campaign) => (
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
        </div>
    );
};

export default CampaignNegativeAuditTable; 