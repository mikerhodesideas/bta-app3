'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { TabData, CampaignStatus, CampaignNegative, AdGroupNegative, NegativeKeywordList, SharedListKeyword, AdMetric, AdGroupMetric } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info, AlertTriangle, CheckCircle } from "lucide-react"
import StackedDistributionBar from '@/components/ui/StackedDistributionBar'
import { useDataStore } from '@/store/dataStore'
import CampaignNegativeAuditTable, { CampaignNegativeDetail } from '@/components/negative-keywords/CampaignNegativeAuditTable'

interface EnabledCampaign extends CampaignStatus {
    // Add cost later if needed
}

type MatchTypeFilter = 'All' | 'BROAD' | 'PHRASE' | 'EXACT'
const matchTypeOptions: MatchTypeFilter[] = ['All', 'BROAD', 'PHRASE', 'EXACT'];

type SharedListFilter = 'Applied' | 'All';
const sharedListOptions: SharedListFilter[] = ['Applied', 'All'];
const rowCountOptions = [10, 30, 50, 100];

// Helper function for badge variants
const getMatchTypeVariant = (matchType: string): "matchExact" | "matchPhrase" | "matchBroad" | "outline" => {
    switch (matchType?.toUpperCase()) {
        case 'EXACT': return 'matchExact';
        case 'PHRASE': return 'matchPhrase';
        case 'BROAD': return 'matchBroad';
        default: return 'outline'; // Fallback if needed
    }
}

// Helper function for distribution calculation
const calculateDistribution = (negatives: (CampaignNegative | AdGroupNegative | SharedListKeyword)[]) => {
    const counts = { BROAD: 0, PHRASE: 0, EXACT: 0, TOTAL: negatives.length };
    negatives.forEach(neg => {
        const type = neg.matchType?.toUpperCase();
        if (type === 'BROAD' || type === 'PHRASE' || type === 'EXACT') {
            counts[type]++;
        }
    });
    if (counts.TOTAL === 0) return { BROAD: 0, PHRASE: 0, EXACT: 0 };
    return {
        BROAD: Math.round((counts.BROAD / counts.TOTAL) * 100),
        PHRASE: Math.round((counts.PHRASE / counts.TOTAL) * 100),
        EXACT: Math.round((counts.EXACT / counts.TOTAL) * 100),
    };
};

// Helper function to check for single-word broad match negatives
const isPotentiallyRiskyBroadMatch = (keywordText: string, matchType: string): boolean => {
    // Check if it's BROAD match and contains no spaces (likely a single word)
    return matchType?.toUpperCase() === 'BROAD' && !keywordText?.includes(' ');
}

export default function NegativeKeywordsPage() {
    const { settings } = useSettings()
    const storeState = useDataStore();
    const { data: tabData, loading: isLoading, error } = storeState;
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
    const [campaignMatchTypeFilter, setCampaignMatchTypeFilter] = useState<MatchTypeFilter>('All');
    const [adGroupMatchTypeFilter, setAdGroupMatchTypeFilter] = useState<MatchTypeFilter>('All');
    const [sharedListFilter, setSharedListFilter] = useState<SharedListFilter>('Applied');
    const [rowsToShow, setRowsToShow] = useState<number>(30);

    // Filter and prepare campaign list
    const enabledCampaigns = useMemo(() => {
        if (!tabData?.campaignStatus) return []
        const campaigns = tabData.campaignStatus
            .filter((cs: CampaignStatus) => cs.status === 'ENABLED' && cs.channelType === 'SEARCH')
            .sort((a: CampaignStatus, b: CampaignStatus) => a.campaignName.localeCompare(b.campaignName));
        return campaigns;
    }, [tabData?.campaignStatus])

    const filteredLists = useMemo(() => {
        const allListsData = tabData?.negativeKeywordLists || [];
        if (allListsData.length === 0) return [];

        let listsToShow: NegativeKeywordList[] = [];

        if (sharedListFilter === 'Applied') {
            if (!selectedCampaignId) return [];
            const applicationsForSelectedCampaign = allListsData.filter(
                (list: NegativeKeywordList) => list.appliedToCampaignId === selectedCampaignId
            );
            const uniqueListIdsForCampaign = new Set(applicationsForSelectedCampaign.map((list: NegativeKeywordList) => list.listId));
            listsToShow = Array.from(uniqueListIdsForCampaign).map(listId => {
                return allListsData.find((list: NegativeKeywordList) => list.listId === listId);
            }).filter((list): list is NegativeKeywordList => list !== undefined);

        } else {
            const allUniqueListIds = new Set(allListsData.map((list: NegativeKeywordList) => list.listId));
            listsToShow = Array.from(allUniqueListIds).map(listId => {
                return allListsData.find((list: NegativeKeywordList) => list.listId === listId);
            }).filter((list): list is NegativeKeywordList => list !== undefined);
        }

        listsToShow.sort((a, b) => a.listName.localeCompare(b.listName));

        return listsToShow;
    }, [selectedCampaignId, tabData?.negativeKeywordLists, sharedListFilter]);

    const allSharedKeywordsSource = useMemo(() => tabData?.sharedListKeywords || [], [tabData?.sharedListKeywords]);

    const filteredCampaignNegatives = useMemo(() => {
        if (!selectedCampaignId || !tabData?.campaignNegatives) return [];
        return tabData.campaignNegatives.filter(neg =>
            neg.campaignId === selectedCampaignId &&
            (campaignMatchTypeFilter === 'All' || neg.matchType === campaignMatchTypeFilter)
        );
    }, [selectedCampaignId, tabData?.campaignNegatives, campaignMatchTypeFilter]);

    const filteredAdGroupNegatives = useMemo(() => {
        if (!selectedCampaignId || !tabData?.adGroupNegatives) return [];
        const filtered = tabData.adGroupNegatives.filter(neg =>
            neg.campaignId === selectedCampaignId &&
            (adGroupMatchTypeFilter === 'All' || neg.matchType === adGroupMatchTypeFilter)
        );
        // Group by Ad Group for better display
        return filtered.reduce((acc, neg) => {
            const group = acc.find(item => item.adGroupName === neg.adGroupName);
            if (group) {
                group.negatives.push(neg);
            } else {
                acc.push({ adGroupName: neg.adGroupName, adGroupId: neg.adGroupId, negatives: [neg] });
            }
            return acc;
        }, [] as { adGroupName: string; adGroupId: string; negatives: AdGroupNegative[] }[]);
    }, [selectedCampaignId, tabData?.adGroupNegatives, adGroupMatchTypeFilter]);

    // Calculate total ad group negatives count
    const totalAdGroupNegativesCount = useMemo(() => {
        return filteredAdGroupNegatives.reduce((count, group) => count + group.negatives.length, 0);
    }, [filteredAdGroupNegatives]);

    // --- Audit Calculations ---
    const auditResults = useMemo(() => {
        if (!selectedCampaignId) return null; // Only run audit if a campaign is selected

        const campaignNegs = filteredCampaignNegatives;
        const adGroupNegsFlat = filteredAdGroupNegatives.flatMap(g => g.negatives);

        const totalCampaignNegs = campaignNegs.length;
        const totalAdGroupNegs = adGroupNegsFlat.length;

        const campaignDistribution = calculateDistribution(campaignNegs);
        const adGroupDistribution = calculateDistribution(adGroupNegsFlat);

        const riskyCampaignBroad = campaignNegs.filter(neg => isPotentiallyRiskyBroadMatch(neg.keywordText, neg.matchType)).length;
        const riskyAdGroupBroad = adGroupNegsFlat.filter(neg => isPotentiallyRiskyBroadMatch(neg.keywordText, neg.matchType)).length;

        return {
            hasZeroCampaignNegs: totalCampaignNegs === 0,
            hasZeroAdGroupNegs: totalAdGroupNegs === 0,
            campaignDistribution,
            adGroupDistribution,
            riskyCampaignBroad,
            riskyAdGroupBroad,
            totalRiskyBroad: riskyCampaignBroad + riskyAdGroupBroad,
        };

    }, [selectedCampaignId, filteredCampaignNegatives, filteredAdGroupNegatives]);
    // --- End Audit Calculations ---

    // --- Data Fetching and Basic Filtering ---
    const enabledSearchCampaigns = useMemo(() => {
        if (!tabData?.campaignStatus) return [];
        return tabData.campaignStatus
            .filter((cs: CampaignStatus) => cs.status === 'ENABLED' && cs.channelType === 'SEARCH');
    }, [tabData?.campaignStatus]);

    const allNegativeKeywordLists = useMemo(() => tabData?.negativeKeywordLists || [], [tabData?.negativeKeywordLists]);
    const allSharedKeywords = useMemo(() => tabData?.sharedListKeywords || [], [tabData?.sharedListKeywords]);
    const allCampaignNegatives = useMemo(() => tabData?.campaignNegatives || [], [tabData?.campaignNegatives]);
    const allAdGroupNegatives = useMemo(() => tabData?.adGroupNegatives || [], [tabData?.adGroupNegatives]);
    const allAdGroupMetrics = useMemo(() => tabData?.adGroups || [], [tabData?.adGroups]);

    // --- Account-Wide Audit Calculations --- 
    const accountWideAudit = useMemo(() => {
        if (selectedCampaignId || !enabledCampaigns || enabledCampaigns.length === 0) return null;

        const enabledSearchIds = new Set(enabledCampaigns.map(c => c.campaignId));

        const relevantCampaignNegs = allCampaignNegatives.filter(neg => enabledSearchIds.has(neg.campaignId));
        const relevantAdGroupNegs = allAdGroupNegatives.filter(neg => enabledSearchIds.has(neg.campaignId));

        let campaignsWithZeroCampaignNegs = 0;
        let campaignsWithZeroAdGroupNegs = 0;

        enabledSearchIds.forEach(id => {
            if (!relevantCampaignNegs.some(neg => neg.campaignId === id)) {
                campaignsWithZeroCampaignNegs++;
            }
            if (!relevantAdGroupNegs.some(neg => neg.campaignId === id)) {
                campaignsWithZeroAdGroupNegs++;
            }
        });

        const campaignDistribution = calculateDistribution(relevantCampaignNegs);
        const adGroupDistribution = calculateDistribution(relevantAdGroupNegs);
        const totalRiskyBroad = relevantCampaignNegs.filter(neg => isPotentiallyRiskyBroadMatch(neg.keywordText, neg.matchType)).length +
            relevantAdGroupNegs.filter(neg => isPotentiallyRiskyBroadMatch(neg.keywordText, neg.matchType)).length;

        const appliedListIds = new Set(
            allNegativeKeywordLists.filter(list => enabledSearchIds.has(list.appliedToCampaignId)).map(list => list.listId)
        );
        const uniqueSharedKeywordsApplied = new Map<string, SharedListKeyword>();
        allSharedKeywordsSource.forEach(kw => {
            if (appliedListIds.has(kw.listId) && !uniqueSharedKeywordsApplied.has(kw.criterionId)) {
                uniqueSharedKeywordsApplied.set(kw.criterionId, kw);
            }
        });
        const sharedDistribution = calculateDistribution(Array.from(uniqueSharedKeywordsApplied.values()));

        return {
            totalCampaigns: enabledCampaigns.length,
            campaignsWithZeroCampaignNegs,
            campaignsWithZeroAdGroupNegs,
            campaignDistribution,
            adGroupDistribution,
            totalRiskyBroad,
            sharedDistribution,
        }
    }, [selectedCampaignId, enabledCampaigns, allCampaignNegatives, allAdGroupNegatives, allNegativeKeywordLists, allSharedKeywordsSource]);

    // --- Refactored: Calculate detailed campaign data for the table ---
    const campaignNegativeDetails = useMemo((): CampaignNegativeDetail[] => {
        if (selectedCampaignId || !enabledCampaigns || enabledCampaigns.length === 0) {
            return [];
        }

        const adGroupsByCampaign = new Map<string, Set<string>>();
        allAdGroupMetrics.forEach((metric: AdGroupMetric) => {
            if (!adGroupsByCampaign.has(metric.campaignId)) {
                adGroupsByCampaign.set(metric.campaignId, new Set());
            }
            adGroupsByCampaign.get(metric.campaignId)!.add(metric.adGroupId);
        });

        const details: CampaignNegativeDetail[] = enabledCampaigns
            .map((campaign: CampaignStatus) => {
                const campaignId = campaign.campaignId;
                const cost = campaign.cost || 0;

                if (cost === 0) return null;

                const campaignNegs = allCampaignNegatives.filter((neg: CampaignNegative) => neg.campaignId === campaignId);
                const uniqueAdGroupIdsInCampaign = adGroupsByCampaign.get(campaignId) || new Set();
                const adGroupNegsInCampaign = allAdGroupNegatives.filter((neg: AdGroupNegative) => neg.campaignId === campaignId);
                const appliedLists = new Set(
                    allNegativeKeywordLists
                        .filter((list: NegativeKeywordList) => list.appliedToCampaignId === campaignId)
                        .map((list: NegativeKeywordList) => list.listId)
                );
                const adGroupsWithNegatives = new Set(
                    adGroupNegsInCampaign.map((neg: AdGroupNegative) => neg.adGroupId)
                );

                return {
                    campaignId: campaignId,
                    campaignName: campaign.campaignName,
                    cost: cost,
                    listsAppliedCount: appliedLists.size,
                    campaignNegCount: campaignNegs.length,
                    adGroupCount: uniqueAdGroupIdsInCampaign.size,
                    adGroupsWithNegsCount: adGroupsWithNegatives.size,
                    totalAdGroupNegCount: adGroupNegsInCampaign.length,
                };
            })
            .filter((detail): detail is CampaignNegativeDetail => detail !== null);

        details.sort((a, b) => b.cost - a.cost);
        return details;
    }, [
        selectedCampaignId,
        enabledCampaigns,
        allCampaignNegatives,
        allAdGroupMetrics,
        allAdGroupNegatives,
        allNegativeKeywordLists,
    ]);

    // --- Calculate List Application Stats --- 
    const listApplicationStats = useMemo(() => {
        if (!enabledCampaigns || enabledCampaigns.length === 0) return null;
        const appliedListCampaignIds = new Set(
            allNegativeKeywordLists.map((list: NegativeKeywordList) => list.appliedToCampaignId)
        );
        let campaignsWithoutLists = 0;
        enabledCampaigns.forEach((campaign: CampaignStatus) => {
            if (!appliedListCampaignIds.has(campaign.campaignId)) {
                campaignsWithoutLists++;
            }
        });
        return { campaignsWithoutLists };
    }, [enabledCampaigns, allNegativeKeywordLists]);

    // --- Campaign-Specific Audit Calculations --- 
    const campaignSpecificAudit = useMemo(() => {
        if (!selectedCampaignId) return null;
        const campaignNegs = allCampaignNegatives.filter((neg: CampaignNegative) => neg.campaignId === selectedCampaignId);
        const adGroupNegsRaw = allAdGroupNegatives.filter((neg: AdGroupNegative) => neg.campaignId === selectedCampaignId);
        const appliedListIds = new Set(allNegativeKeywordLists.filter((list: NegativeKeywordList) => list.appliedToCampaignId === selectedCampaignId).map((list: NegativeKeywordList) => list.listId));
        const appliedSharedKeywords = allSharedKeywordsSource.filter((kw: SharedListKeyword) => appliedListIds.has(kw.listId));

        const campaignDistribution = calculateDistribution(campaignNegs);
        const adGroupDistribution = calculateDistribution(adGroupNegsRaw);
        const sharedListKeywordsDistribution = calculateDistribution(appliedSharedKeywords);

        const riskyCampaignBroad = campaignNegs.filter((neg: CampaignNegative) => isPotentiallyRiskyBroadMatch(neg.keywordText, neg.matchType)).length;
        const riskyAdGroupBroad = adGroupNegsRaw.filter((neg: AdGroupNegative) => isPotentiallyRiskyBroadMatch(neg.keywordText, neg.matchType)).length;
        const riskySharedBroad = appliedSharedKeywords.filter((kw: SharedListKeyword) => isPotentiallyRiskyBroadMatch(kw.keywordText, kw.matchType)).length;

        return {
            totalCampaignNegs: campaignNegs.length,
            totalAdGroupNegs: adGroupNegsRaw.length,
            totalAppliedSharedKeywords: appliedSharedKeywords.length,
            campaignDistribution,
            adGroupDistribution,
            sharedListKeywordsDistribution,
            riskyCampaignBroad,
            riskyAdGroupBroad,
            riskySharedBroad,
        };
    }, [selectedCampaignId, allNegativeKeywordLists, allSharedKeywordsSource, allCampaignNegatives, allAdGroupNegatives]);

    // --- Hooks for Filtered Data for Display (depend on campaignSpecificAudit to know if a campaign is selected) ---
    const filteredListsForDisplay = useMemo(() => {
        if (!campaignSpecificAudit) return [];
        const allListsData = allNegativeKeywordLists;
        if (allListsData.length === 0) return [];
        let listsToShow: NegativeKeywordList[] = [];
        if (sharedListFilter === 'Applied') {
            if (!selectedCampaignId) return [];
            const applicationsForSelectedCampaign = allListsData.filter(
                (list: NegativeKeywordList) => list.appliedToCampaignId === selectedCampaignId
            );
            const uniqueListIdsForCampaign = new Set(applicationsForSelectedCampaign.map((list: NegativeKeywordList) => list.listId));
            listsToShow = Array.from(uniqueListIdsForCampaign).map((listId: string) => {
                return allListsData.find((list: NegativeKeywordList) => list.listId === listId);
            }).filter((list): list is NegativeKeywordList => list !== undefined);
        } else {
            const allUniqueListIds = new Set(allListsData.map((list: NegativeKeywordList) => list.listId));
            listsToShow = Array.from(allUniqueListIds).map((listId: string) => {
                return allListsData.find((list: NegativeKeywordList) => list.listId === listId);
            }).filter((list): list is NegativeKeywordList => list !== undefined);
        }
        listsToShow.sort((a, b) => a.listName.localeCompare(b.listName));
        return listsToShow;
    }, [campaignSpecificAudit, selectedCampaignId, allNegativeKeywordLists, sharedListFilter]);

    const campaignNegsForDisplay = useMemo(() => {
        if (!campaignSpecificAudit) return [];
        const campaignNegs = allCampaignNegatives.filter((neg: CampaignNegative) =>
            neg.campaignId === selectedCampaignId &&
            (campaignMatchTypeFilter === 'All' || neg.matchType === campaignMatchTypeFilter)
        );
        campaignNegs.sort((a, b) => a.keywordText.localeCompare(b.keywordText));
        return campaignNegs;
    }, [campaignSpecificAudit, selectedCampaignId, allCampaignNegatives, campaignMatchTypeFilter]);

    const adGroupNegsGroupedForDisplay = useMemo(() => {
        if (!campaignSpecificAudit) return [];
        const filtered = allAdGroupNegatives.filter((neg: AdGroupNegative) =>
            neg.campaignId === selectedCampaignId &&
            (adGroupMatchTypeFilter === 'All' || neg.matchType === adGroupMatchTypeFilter)
        );
        const grouped = filtered.reduce((acc, neg) => {
            let group = acc.find((item: { adGroupName: string; adGroupId: string; negatives: AdGroupNegative[] }) => item.adGroupName === neg.adGroupName);
            if (group) {
                group.negatives.push(neg);
            } else {
                group = { adGroupName: neg.adGroupName, adGroupId: neg.adGroupId, negatives: [neg] };
                acc.push(group);
            }
            group.negatives.sort((a, b) => a.keywordText.localeCompare(b.keywordText));
            return acc;
        }, [] as { adGroupName: string; adGroupId: string; negatives: AdGroupNegative[] }[]);
        grouped.sort((a, b) => a.adGroupName.localeCompare(b.adGroupName));
        return grouped;
    }, [campaignSpecificAudit, selectedCampaignId, allAdGroupNegatives, adGroupMatchTypeFilter]);

    // Calculate total ad group negatives count for display (uses filtered/grouped data)
    const totalFilteredAdGroupNegativesCount = useMemo(() => {
        return adGroupNegsGroupedForDisplay.reduce((count: number, group) => count + group.negatives.length, 0);
    }, [adGroupNegsGroupedForDisplay]);

    return (
        <TooltipProvider>
            <div className="container mx-auto px-4 py-12 mt-16">
                <h1 className="text-3xl font-bold mb-8">Negative Keywords</h1>

                {error ? (
                    <div className="text-red-500 mb-4">Error loading data: {error}</div>
                ) : isLoading && !Object.values(tabData || {}).some(arr => arr && arr.length > 0) ? (
                    <div>Loading data...</div>
                ) : !settings.sheetUrl ? (
                    <div className="text-center text-gray-500 pt-10">Please configure your Google Sheet URL in settings.</div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <Label htmlFor="campaign-select" className="block text-sm font-medium mb-2">Select Campaign</Label>
                                <Select
                                    value={selectedCampaignId ?? 'ACCOUNT_WIDE'}
                                    onValueChange={(value) => {
                                        setSelectedCampaignId(value === 'ACCOUNT_WIDE' ? null : value);
                                        // Reset filters when campaign changes
                                        setSharedListFilter('Applied');
                                        setCampaignMatchTypeFilter('All');
                                        setAdGroupMatchTypeFilter('All');
                                    }}
                                >
                                    <SelectTrigger id="campaign-select" className="w-[350px]">
                                        <SelectValue placeholder="Choose campaign or view account-wide..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ACCOUNT_WIDE">-- View Account-Wide Audit --</SelectItem>
                                        {enabledSearchCampaigns.map((campaign) => (
                                            <SelectItem key={campaign.campaignId} value={campaign.campaignId}>
                                                {campaign.campaignName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="rows-select" className="block text-sm font-medium mb-2">Items per Section</Label>
                                <Select value={String(rowsToShow)} onValueChange={(value) => setRowsToShow(Number(value))}>
                                    <SelectTrigger id="rows-select" className="w-[100px]">
                                        <SelectValue placeholder="Rows" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rowCountOptions.map((option) => (
                                            <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {!selectedCampaignId && accountWideAudit && (
                            <Card className="mt-6 border-blue-200 border">
                                <CardHeader className="bg-blue-50">
                                    <CardTitle className="text-xl font-semibold flex items-center">
                                        Account-Wide Negative Audit (Enabled Search Campaigns: {accountWideAudit.totalCampaigns})
                                    </CardTitle>
                                    <CardDescription className="text-xs pt-1">
                                        Overview of negative keyword health across all active search campaigns.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="text-sm space-y-4 px-4 pb-4 pt-4">
                                    <CampaignNegativeAuditTable data={campaignNegativeDetails} />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center pt-4">
                                        {listApplicationStats && (
                                            <div className="p-3 bg-blue-50/50 rounded border border-blue-100">
                                                <p className="text-xs text-muted-foreground mb-1">Campaigns w/o Lists Applied</p>
                                                <p className={`text-2xl font-semibold ${listApplicationStats.campaignsWithoutLists > 0 ? 'text-orange-600' : 'text-green-600'}`}>{listApplicationStats.campaignsWithoutLists}</p>
                                            </div>
                                        )}
                                        <div className="p-3 bg-blue-50/50 rounded border border-blue-100">
                                            <p className="text-xs text-muted-foreground mb-1">Campaigns w/o Campaign Negs</p>
                                            <p className={`text-2xl font-semibold ${accountWideAudit.campaignsWithZeroCampaignNegs > 0 ? 'text-orange-600' : 'text-green-600'}`}>{accountWideAudit.campaignsWithZeroCampaignNegs}</p>
                                        </div>
                                        <div className="p-3 bg-blue-50/50 rounded border border-blue-100">
                                            <p className="text-xs text-muted-foreground mb-1">Campaigns w/o AdGroup Negs</p>
                                            <p className={`text-2xl font-semibold ${accountWideAudit.campaignsWithZeroAdGroupNegs > 0 ? 'text-orange-600' : 'text-green-600'}`}>{accountWideAudit.campaignsWithZeroAdGroupNegs}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                                        <div>
                                            <StackedDistributionBar distribution={accountWideAudit.sharedDistribution} />
                                            <h4 className="font-medium mb-2 text-center text-xs text-muted-foreground">Overall Shared List Distribution</h4>
                                            <div className="text-xs text-center space-y-1">
                                                <div>Exact: <span className="font-semibold">{accountWideAudit.sharedDistribution.EXACT}%</span></div>
                                                <div>Phrase: <span className="font-semibold">{accountWideAudit.sharedDistribution.PHRASE}%</span></div>
                                                <div>Broad: <span className="font-semibold">{accountWideAudit.sharedDistribution.BROAD}%</span></div>
                                            </div>
                                        </div>
                                        <div>
                                            <StackedDistributionBar distribution={accountWideAudit.campaignDistribution} />
                                            <h4 className="font-medium mb-2 text-center text-xs text-muted-foreground">Overall Campaign Negatives Distribution</h4>
                                            <div className="text-xs text-center space-y-1">
                                                <div>Exact: <span className="font-semibold">{accountWideAudit.campaignDistribution.EXACT}%</span></div>
                                                <div>Phrase: <span className="font-semibold">{accountWideAudit.campaignDistribution.PHRASE}%</span></div>
                                                <div>Broad: <span className="font-semibold">{accountWideAudit.campaignDistribution.BROAD}%</span></div>
                                            </div>
                                        </div>
                                        <div>
                                            <StackedDistributionBar distribution={accountWideAudit.adGroupDistribution} />
                                            <h4 className="font-medium mb-2 text-center text-xs text-muted-foreground">Overall Ad Group Negatives Distribution</h4>
                                            <div className="text-xs text-center space-y-1">
                                                <div>Exact: <span className="font-semibold">{accountWideAudit.adGroupDistribution.EXACT}%</span></div>
                                                <div>Phrase: <span className="font-semibold">{accountWideAudit.adGroupDistribution.PHRASE}%</span></div>
                                                <div>Broad: <span className="font-semibold">{accountWideAudit.adGroupDistribution.BROAD}%</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {selectedCampaignId && campaignSpecificAudit && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                <Card className="col-span-1 flex flex-col border-purple-200 border">
                                    <CardHeader className="pb-2 bg-purple-50">
                                        <CardTitle className="flex justify-between items-center text-lg font-semibold">
                                            <span>Shared Lists</span>
                                            <Select value={sharedListFilter} onValueChange={(v) => setSharedListFilter(v as SharedListFilter)} disabled={!selectedCampaignId && sharedListFilter !== 'All'}>
                                                <SelectTrigger className="w-[100px] h-7 text-xs">
                                                    <SelectValue placeholder="Filter" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Applied" disabled={!selectedCampaignId}>Applied</SelectItem>
                                                    <SelectItem value="All">All</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </CardTitle>
                                        <div className="text-xs text-muted-foreground pt-2 border-t mt-2 space-y-1">
                                            <p>Applied Keywords: <span className="font-semibold text-sm">{campaignSpecificAudit.totalAppliedSharedKeywords}</span></p>
                                            <p>Distribution: Exact:<span className="font-semibold">{campaignSpecificAudit.sharedListKeywordsDistribution.EXACT}%</span> Phrase:<span className="font-semibold">{campaignSpecificAudit.sharedListKeywordsDistribution.PHRASE}%</span> Broad:<span className="font-semibold">{campaignSpecificAudit.sharedListKeywordsDistribution.BROAD}%</span></p>
                                            <StackedDistributionBar distribution={campaignSpecificAudit.sharedListKeywordsDistribution} />
                                            {campaignSpecificAudit.riskySharedBroad > 0 && (
                                                <div className="flex items-center text-orange-600"><AlertTriangle size={12} className="mr-1 shrink-0" /><span className="font-semibold">{campaignSpecificAudit.riskySharedBroad}</span> risky broad match{campaignSpecificAudit.riskySharedBroad !== 1 ? 'es' : ''}</div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-2 flex-grow">
                                        {filteredListsForDisplay.length > 0 ? (
                                            <Accordion type="multiple" className="w-full text-sm">
                                                {filteredListsForDisplay.slice(0, rowsToShow).map(list => {
                                                    const keywordsInList = allSharedKeywordsSource.filter((kw: SharedListKeyword) => kw.listId === list.listId);
                                                    keywordsInList.sort((a, b) => a.keywordText.localeCompare(b.keywordText));
                                                    return (
                                                        <AccordionItem value={list.listId} key={list.listId}>
                                                            <AccordionTrigger className="text-sm hover:no-underline">
                                                                <span className="flex-grow text-left pr-2">{list.listName}</span>
                                                                <span className="text-xs text-gray-500 shrink-0">({keywordsInList.length})</span>
                                                            </AccordionTrigger>
                                                            <AccordionContent>
                                                                {keywordsInList.length > 0 ? (
                                                                    <div className="space-y-1 pl-4">
                                                                        {keywordsInList.map((kw: SharedListKeyword) => {
                                                                            const isRisky = isPotentiallyRiskyBroadMatch(kw.keywordText, kw.matchType);
                                                                            return (
                                                                                <div key={kw.criterionId} className="flex justify-between items-center py-1 border-b last:border-b-0">
                                                                                    <span className="break-all pr-2 flex items-center">
                                                                                        {kw.keywordText}
                                                                                        {isRisky && (
                                                                                            <Tooltip delayDuration={100}>
                                                                                                <TooltipTrigger asChild>
                                                                                                    <AlertTriangle size={14} className="ml-2 text-orange-400 cursor-help shrink-0" />
                                                                                                </TooltipTrigger>
                                                                                                <TooltipContent className="max-w-xs">
                                                                                                    <p className="text-xs">Single-word Broad Match negatives can block many relevant searches. Consider Phrase or Exact match instead.</p>
                                                                                                </TooltipContent>
                                                                                            </Tooltip>
                                                                                        )}
                                                                                    </span>
                                                                                    <Badge variant={getMatchTypeVariant(kw.matchType)} className="ml-2 text-xs shrink-0">{kw.matchType}</Badge>
                                                                                </div>
                                                                            );
                                                                        })
                                                                        }
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-gray-500 pl-4 italic">No keywords found in this list.</p>
                                                                )}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    );
                                                })}
                                            </Accordion>
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">
                                                {sharedListFilter === 'Applied' ? 'No shared lists applied to this campaign.' : 'No shared lists found.'}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className="col-span-1 flex flex-col border-teal-200 border">
                                    <CardHeader className="pb-2 bg-teal-50">
                                        <CardTitle className="flex justify-between items-center text-lg font-semibold">
                                            <span>Campaign Level</span>
                                            <Select value={campaignMatchTypeFilter} onValueChange={(v) => setCampaignMatchTypeFilter(v as MatchTypeFilter)} disabled={!selectedCampaignId}>
                                                <SelectTrigger className="w-[100px] h-7 text-xs">
                                                    <SelectValue placeholder="Match Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {matchTypeOptions.map(opt => (
                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </CardTitle>
                                        <div className="text-xs text-muted-foreground pt-2 border-t mt-2 space-y-1">
                                            <p>Total Negatives: <span className="font-semibold text-sm">{campaignSpecificAudit.totalCampaignNegs}</span></p>
                                            <p>Distribution: Exact:<span className="font-semibold">{campaignSpecificAudit.campaignDistribution.EXACT}%</span> Phrase:<span className="font-semibold">{campaignSpecificAudit.campaignDistribution.PHRASE}%</span> Broad:<span className="font-semibold">{campaignSpecificAudit.campaignDistribution.BROAD}%</span></p>
                                            <StackedDistributionBar distribution={campaignSpecificAudit.campaignDistribution} />
                                            {campaignSpecificAudit.riskyCampaignBroad > 0 && (
                                                <div className="flex items-center text-orange-600"><AlertTriangle size={12} className="mr-1 shrink-0" /><span className="font-semibold">{campaignSpecificAudit.riskyCampaignBroad}</span> risky broad match{campaignSpecificAudit.riskyCampaignBroad !== 1 ? 'es' : ''}</div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-2 flex-grow overflow-y-auto">
                                        {campaignNegsForDisplay.length > 0 ? (
                                            <div className="space-y-1 text-sm">
                                                {campaignNegsForDisplay.slice(0, rowsToShow).map((neg: CampaignNegative, index: number) => {
                                                    const isRisky = isPotentiallyRiskyBroadMatch(neg.keywordText, neg.matchType);
                                                    return (
                                                        <div key={neg.criterionId || index} className="flex justify-between items-center py-1 border-b last:border-b-0">
                                                            <span className="break-all pr-2 flex items-center">
                                                                {neg.keywordText}
                                                                {isRisky && (
                                                                    <Tooltip delayDuration={100}>
                                                                        <TooltipTrigger asChild>
                                                                            <AlertTriangle size={14} className="ml-2 text-orange-400 cursor-help shrink-0" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="max-w-xs">
                                                                            <p className="text-xs">Single-word Broad Match negatives can block many relevant searches. Consider Phrase or Exact match instead.</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </span>
                                                            <Badge variant={getMatchTypeVariant(neg.matchType)} className="ml-2 text-xs shrink-0">{neg.matchType}</Badge>
                                                        </div>
                                                    );
                                                })}
                                                {campaignNegsForDisplay.length > rowsToShow && (
                                                    <p className="text-xs text-center text-gray-400 pt-2">... and {campaignNegsForDisplay.length - rowsToShow} more</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">No campaign level negatives found{campaignMatchTypeFilter !== 'All' ? ` for ${campaignMatchTypeFilter} match type` : ' for this campaign'}.</p>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className="col-span-1 flex flex-col border-amber-200 border">
                                    <CardHeader className="pb-2 bg-amber-50">
                                        <CardTitle className="flex justify-between items-center text-lg font-semibold">
                                            <span>Ad Group Level</span>
                                            <Select value={adGroupMatchTypeFilter} onValueChange={(v) => setAdGroupMatchTypeFilter(v as MatchTypeFilter)} disabled={!selectedCampaignId}>
                                                <SelectTrigger className="w-[100px] h-7 text-xs">
                                                    <SelectValue placeholder="Match Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {matchTypeOptions.map(opt => (
                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </CardTitle>
                                        <div className="text-xs text-muted-foreground pt-2 border-t mt-2 space-y-1">
                                            <p>Total Keywords: <span className="font-semibold text-sm">{totalFilteredAdGroupNegativesCount}</span> in {adGroupNegsGroupedForDisplay.length} groups with negatives</p>
                                            <p>Distribution: Exact:<span className="font-semibold">{campaignSpecificAudit.adGroupDistribution.EXACT}%</span> Phrase:<span className="font-semibold">{campaignSpecificAudit.adGroupDistribution.PHRASE}%</span> Broad:<span className="font-semibold">{campaignSpecificAudit.adGroupDistribution.BROAD}%</span></p>
                                            <StackedDistributionBar distribution={campaignSpecificAudit.adGroupDistribution} />
                                            {campaignSpecificAudit.riskyAdGroupBroad > 0 && (
                                                <div className="flex items-center text-orange-600"><AlertTriangle size={12} className="mr-1 shrink-0" /><span className="font-semibold">{campaignSpecificAudit.riskyAdGroupBroad}</span> risky broad match{campaignSpecificAudit.riskyAdGroupBroad !== 1 ? 'es' : ''}</div>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-2 flex-grow overflow-y-auto">
                                        {adGroupNegsGroupedForDisplay.length > 0 ? (
                                            <div className="space-y-3 text-sm">
                                                {adGroupNegsGroupedForDisplay.slice(0, rowsToShow).map(group => (
                                                    <div key={group.adGroupId}>
                                                        <strong className="block mb-1 font-medium text-gray-700">{group.adGroupName}</strong>
                                                        <div className="pl-4 space-y-1">
                                                            {group.negatives.map((neg: AdGroupNegative, index: number) => {
                                                                const isRisky = isPotentiallyRiskyBroadMatch(neg.keywordText, neg.matchType);
                                                                return (
                                                                    <div key={neg.criterionId || index} className="flex justify-between items-center py-1 border-b last:border-b-0">
                                                                        <span className="break-all pr-2 flex items-center">
                                                                            {neg.keywordText}
                                                                            {isRisky && (
                                                                                <Tooltip delayDuration={100}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <AlertTriangle size={14} className="ml-2 text-orange-400 cursor-help shrink-0" />
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="max-w-xs">
                                                                                        <p className="text-xs">Single-word Broad Match negatives can block many relevant searches. Consider Phrase or Exact match instead.</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            )}
                                                                        </span>
                                                                        <Badge variant={getMatchTypeVariant(neg.matchType)} className="ml-2 text-xs shrink-0">{neg.matchType}</Badge>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                                {adGroupNegsGroupedForDisplay.length > rowsToShow && (
                                                    <p className="text-xs text-center text-gray-400 pt-2">... and {adGroupNegsGroupedForDisplay.length - rowsToShow} more groups</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500 italic">No ad group level negatives found{adGroupMatchTypeFilter !== 'All' ? ` for ${adGroupMatchTypeFilter} match type` : ' for this campaign'}.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {!selectedCampaignId && !accountWideAudit && !isLoading && Object.values(tabData || {}).some(arr => arr && arr.length > 0) && (
                            <div className="text-center text-gray-500 pt-10 col-span-3">
                                <p>Select a campaign above to view its specific negative keywords and insights, or review the account-wide audit.</p>
                            </div>
                        )}
                        {!isLoading && !error && !Object.values(tabData || {}).some(arr => arr && arr.length > 0) && settings.sheetUrl && (
                            <div className="text-center text-gray-500 pt-10 col-span-3">
                                <p>No negative keyword data (campaign, ad group, or lists) found in your sheet.</p>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </TooltipProvider>
    )
} 