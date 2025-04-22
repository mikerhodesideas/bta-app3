'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { fetchAllTabsData } from '@/lib/sheetsData'
import { TabData, CampaignStatus, CampaignNegative, AdGroupNegative, NegativeKeywordList } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

interface EnabledCampaign extends CampaignStatus {
    // Add cost later if needed
}

type MatchTypeFilter = 'All' | 'BROAD' | 'PHRASE' | 'EXACT'
const matchTypeOptions: MatchTypeFilter[] = ['All', 'BROAD', 'PHRASE', 'EXACT'];

type SharedListFilter = 'Applied' | 'All';
const sharedListOptions: SharedListFilter[] = ['Applied', 'All'];

// Helper function for badge variants
const getMatchTypeVariant = (matchType: string): "default" | "secondary" | "outline" | "destructive" | null | undefined => {
    switch (matchType) {
        case 'EXACT': return 'default';
        case 'PHRASE': return 'secondary';
        case 'BROAD': return 'outline';
        default: return 'outline';
    }
}

export default function NegativeKeywordsPage() {
    const { settings } = useSettings()
    const [tabData, setTabData] = useState<TabData | null>(null)
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [campaignMatchTypeFilter, setCampaignMatchTypeFilter] = useState<MatchTypeFilter>('All');
    const [adGroupMatchTypeFilter, setAdGroupMatchTypeFilter] = useState<MatchTypeFilter>('All');
    const [sharedListFilter, setSharedListFilter] = useState<SharedListFilter>('Applied');

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

    // Filter and prepare campaign list
    const enabledCampaigns = useMemo(() => {
        if (!tabData?.campaignStatus) return []

        // Filter for enabled SEARCH campaigns
        const campaigns = tabData.campaignStatus
            .filter(cs => cs.status === 'ENABLED' && cs.channelType === 'SEARCH') // Add channelType filter
            .sort((a, b) => a.campaignName.localeCompare(b.campaignName)); // Sort alphabetically for now

        return campaigns;
    }, [tabData])

    const filteredLists = useMemo(() => {
        const allListsData = tabData?.negativeKeywordLists || [];
        if (allListsData.length === 0) return [];

        let listsToShow: NegativeKeywordList[] = [];

        if (sharedListFilter === 'Applied') {
            if (!selectedCampaignId) return [];
            const applicationsForSelectedCampaign = allListsData.filter(
                list => list.appliedToCampaignId === selectedCampaignId
            );
            const uniqueListIdsForCampaign = new Set(applicationsForSelectedCampaign.map(list => list.listId));
            listsToShow = Array.from(uniqueListIdsForCampaign).map(listId => {
                return allListsData.find(list => list.listId === listId);
            }).filter(list => list !== undefined) as NegativeKeywordList[];

        } else {
            const allUniqueListIds = new Set(allListsData.map(list => list.listId));
            listsToShow = Array.from(allUniqueListIds).map(listId => {
                return allListsData.find(list => list.listId === listId);
            }).filter(list => list !== undefined) as NegativeKeywordList[];
        }

        listsToShow.sort((a, b) => a.listName.localeCompare(b.listName));

        return listsToShow;
    }, [selectedCampaignId, tabData?.negativeKeywordLists, sharedListFilter]);

    const allSharedKeywords = useMemo(() => tabData?.sharedListKeywords || [], [tabData?.sharedListKeywords]);

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


    return (
        <div className="container mx-auto px-4 py-12 mt-16">
            <h1 className="text-3xl font-bold mb-8">Negative Keywords</h1>

            {error ? (
                <div className="text-red-500 mb-4">{error}</div>
            ) : isLoading ? (
                <div>Loading campaign data...</div>
            ) : (
                <div className="space-y-6">
                    <div>
                        <Label htmlFor="campaign-select" className="block text-sm font-medium mb-2">Select Campaign</Label>
                        <Select
                            value={selectedCampaignId ?? ''}
                            onValueChange={(value) => setSelectedCampaignId(value || null)}
                        >
                            <SelectTrigger id="campaign-select" className="w-[350px]">
                                <SelectValue placeholder="Choose an enabled campaign..." />
                            </SelectTrigger>
                            <SelectContent>
                                {enabledCampaigns.map((campaign) => (
                                    <SelectItem key={campaign.campaignId} value={campaign.campaignId}>
                                        {campaign.campaignName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedCampaignId && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <Card className="col-span-1">
                                <CardHeader>
                                    <CardTitle className="flex justify-between items-center">
                                        <span>Shared Lists</span>
                                        <Select value={sharedListFilter} onValueChange={(v) => setSharedListFilter(v as SharedListFilter)}>
                                            <SelectTrigger className="w-[100px] h-7 text-xs">
                                                <SelectValue placeholder="Filter" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {sharedListOptions.map(opt => (
                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {filteredLists.length > 0 && allSharedKeywords.length > 0 ? (
                                        <Accordion type="multiple" className="w-full text-sm">
                                            {filteredLists.map(list => {
                                                const keywordsInList = allSharedKeywords.filter(kw => kw.listId === list.listId);
                                                return (
                                                    <AccordionItem value={list.listId} key={list.listId}>
                                                        <AccordionTrigger>{list.listName} ({keywordsInList.length})</AccordionTrigger>
                                                        <AccordionContent>
                                                            {keywordsInList.length > 0 ? (
                                                                <div className="space-y-1 pl-4">
                                                                    {keywordsInList.map(kw => (
                                                                        <div key={kw.criterionId} className="flex justify-between items-center">
                                                                            <span>{kw.keywordText}</span>
                                                                            <Badge variant={getMatchTypeVariant(kw.matchType)} className="ml-2 text-xs">{kw.matchType}</Badge>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-gray-500 pl-4">No keywords found in this list.</p>
                                                            )}
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                );
                                            })}
                                        </Accordion>
                                    ) : (
                                        <p className="text-sm text-gray-500">{isLoading ? 'Loading...' : 'No shared lists applied or keywords found.'}</p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="col-span-1">
                                <CardHeader>
                                    <CardTitle className="flex justify-between items-center">
                                        <span>Campaign Level Negatives</span>
                                        <Select value={campaignMatchTypeFilter} onValueChange={(v) => setCampaignMatchTypeFilter(v as MatchTypeFilter)}>
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
                                </CardHeader>
                                <CardContent>
                                    {filteredCampaignNegatives.length > 0 ? (
                                        <div className="space-y-1 text-sm">
                                            {filteredCampaignNegatives.map((neg, index) => (
                                                <div key={neg.criterionId || index} className="flex justify-between items-center py-1 border-b last:border-b-0">
                                                    <span>{neg.keywordText}</span>
                                                    <Badge variant={getMatchTypeVariant(neg.matchType)} className="ml-2 text-xs shrink-0">{neg.matchType}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">No campaign level negatives found{campaignMatchTypeFilter !== 'All' ? ` for ${campaignMatchTypeFilter} match type` : ''}.</p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="col-span-1">
                                <CardHeader>
                                    <CardTitle className="flex justify-between items-center">
                                        <span>Ad Group Level Negatives</span>
                                        <Select value={adGroupMatchTypeFilter} onValueChange={(v) => setAdGroupMatchTypeFilter(v as MatchTypeFilter)}>
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
                                </CardHeader>
                                <CardContent>
                                    {filteredAdGroupNegatives.length > 0 ? (
                                        <div className="space-y-3 text-sm">
                                            {filteredAdGroupNegatives.map(group => (
                                                <div key={group.adGroupId}>
                                                    <strong className="block mb-1 font-medium text-gray-700">{group.adGroupName}</strong>
                                                    <div className="pl-4 space-y-1">
                                                        {group.negatives.map((neg, index) => (
                                                            <div key={neg.criterionId || index} className="flex justify-between items-center py-1 border-b last:border-b-0">
                                                                <span>{neg.keywordText}</span>
                                                                <Badge variant={getMatchTypeVariant(neg.matchType)} className="ml-2 text-xs shrink-0">{neg.matchType}</Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">No ad group level negatives found{adGroupMatchTypeFilter !== 'All' ? ` for ${adGroupMatchTypeFilter} match type` : ' for this campaign'}.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
} 