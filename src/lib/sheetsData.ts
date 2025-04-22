// src/lib/sheetsData.ts
import { AdMetric, Campaign, SearchTermMetric, TabData, AdGroupMetric, NegativeKeywordList, CampaignNegative, AdGroupNegative, CampaignStatus, SharedListKeyword, isSearchTermMetric } from './types'
import { SHEET_TABS, SheetTab, TAB_CONFIGS, DEFAULT_SHEET_URL } from './config'

async function fetchTabData(sheetUrl: string, tab: SheetTab): Promise<AdMetric[] | SearchTermMetric[] | AdGroupMetric[] | NegativeKeywordList[] | CampaignNegative[] | AdGroupNegative[] | CampaignStatus[] | SharedListKeyword[]> {
  // console.log(`[sheetsData] Starting fetch for tab: ${tab}`); // Removed
  try {
    const urlWithTab = `${sheetUrl}?tab=${tab}`
    // console.log(`[sheetsData] Fetching URL: ${urlWithTab}`); // Removed

    const response = await fetch(urlWithTab)

    if (!response.ok) {
      console.error(`HTTP error ${response.status} fetching tab ${tab}`) // Kept error log
      return []
    }
    // console.log(`[sheetsData] Received successful response for tab: ${tab}`); // Removed

    let rawData
    try {
      rawData = await response.json()
      // console.log(`[sheetsData] Successfully parsed JSON for tab: ${tab}`); // Removed
    } catch (jsonError) {
      console.error(`Failed to parse JSON for tab ${tab}:`, jsonError) // Kept error log
      return []
    }

    if (!Array.isArray(rawData)) {
      if (rawData && typeof rawData === 'object' && 'error' in rawData) {
        console.error(`Error from API for tab ${tab}:`, rawData.error) // Kept error log
      } else {
        console.error(`Response is not an array for tab ${tab}`) // Kept error log
      }
      return []
    }

    // Parse data based on tab type
    if (tab === 'searchTerms') {
      return rawData.map((row: any): SearchTermMetric => ({
        searchTerm: String(row['searchTerm'] || ''),
        campaign: String(row['campaign'] || ''),
        adGroup: String(row['adGroup'] || ''),
        impr: Number(row['impr'] || 0),
        clicks: Number(row['clicks'] || 0),
        cost: Number(row['cost'] || 0),
        conv: Number(row['conv'] || 0),
        value: Number(row['value'] || 0),
        cpc: Number(row['cpc'] || 0),
        ctr: Number(row['ctr'] || 0),
        convRate: Number(row['convRate'] || 0),
        cpa: Number(row['cpa'] || 0),
        roas: Number(row['roas'] || 0)
      }))
    } else if (tab === 'adGroups') {
      // Map the ad groups data, including calculated metrics
      return rawData.map((row: any): AdGroupMetric => ({
        campaign: String(row['campaign'] || ''),
        campaignId: String(row['campaignId'] || ''),
        adGroup: String(row['adGroup'] || ''),
        adGroupId: String(row['adGroupId'] || ''),
        impr: Number(row['impr'] || 0),
        clicks: Number(row['clicks'] || 0),
        value: Number(row['value'] || 0),
        conv: Number(row['conv'] || 0),
        cost: Number(row['cost'] || 0),
        date: String(row['date'] || ''),
        cpc: Number(row['cpc'] || 0),
        ctr: Number(row['ctr'] || 0),
        convRate: Number(row['convRate'] || 0),
        cpa: Number(row['cpa'] || 0),
        roas: Number(row['roas'] || 0)
      }))
    } else if (tab === 'negativeKeywordLists') {
      // Map the negative keyword lists data
      return rawData.map((row: any): NegativeKeywordList => ({
        listName: String(row['listName'] || ''),
        listId: String(row['listId'] || ''),
        listType: String(row['listType'] || ''),
        appliedToCampaignName: String(row['appliedToCampaignName'] || ''),
        appliedToCampaignId: String(row['appliedToCampaignId'] || '')
      }))
    } else if (tab === 'campaignNegatives') {
      // Map the campaign negatives data
      return rawData.map((row: any): CampaignNegative => ({
        campaignName: String(row['campaignName'] || ''),
        campaignId: String(row['campaignId'] || ''),
        criterionId: String(row['criterionId'] || ''),
        keywordText: String(row['keywordText'] || ''),
        matchType: String(row['matchType'] || '')
      }))
    } else if (tab === 'adGroupNegatives') {
      // Map the ad group negatives data
      return rawData.map((row: any): AdGroupNegative => ({
        campaignName: String(row['campaignName'] || ''),
        campaignId: String(row['campaignId'] || ''),
        adGroupName: String(row['adGroupName'] || ''),
        adGroupId: String(row['adGroupId'] || ''),
        criterionId: String(row['criterionId'] || ''),
        keywordText: String(row['keywordText'] || ''),
        matchType: String(row['matchType'] || '')
      }))
    }

    // Handle Campaign Status data
    if (tab === 'campaignStatus') {
      return rawData.map((row: any): CampaignStatus => ({
        campaignId: String(row['campaignId'] || ''),
        campaignName: String(row['campaignName'] || ''),
        status: String(row['status'] || ''),
        channelType: String(row['channelType'] || '')
      }));
    }

    // Handle Shared List Keyword data
    if (tab === 'sharedListKeywords') {
      return rawData.map((row: any): SharedListKeyword => ({
        listId: String(row['listId'] || ''),
        criterionId: String(row['criterionId'] || ''),
        keywordText: String(row['keywordText'] || ''),
        matchType: String(row['matchType'] || ''),
        type: String(row['type'] || '')
      }));
    }

    // Daily metrics (tab === 'Daily')
    return rawData.map((row: any): AdMetric => ({
      campaign: String(row['campaign'] || ''),
      campaignId: String(row['campaignId'] || ''),
      clicks: Number(row['clicks'] || 0),
      value: Number(row['value'] || 0),
      conv: Number(row['conv'] || 0),
      cost: Number(row['cost'] || 0),
      impr: Number(row['impr'] || 0),
      date: String(row['date'] || '')
    }))
  } catch (error) {
    console.error(`Error fetching ${tab} data:`, error) // Kept error log
    return []
  }
}

export async function fetchAllTabsData(sheetUrl: string = DEFAULT_SHEET_URL): Promise<TabData> {
  // console.log(`[sheetsData] Starting fetch for all tabs. URL: ${sheetUrl}`); // Removed
  const results = await Promise.all(
    SHEET_TABS.map(async tab => {
      // console.log(`[sheetsData] Processing tab: ${tab} in Promise.all`); // Removed
      try {
        return {
          tab,
          data: await fetchTabData(sheetUrl, tab)
        }
      } catch (error) {
        console.error(`Failed to fetch data for tab ${tab}:`, error) // Kept error log
        return {
          tab,
          data: []
        }
      }
    })
  )

  // console.log(`[sheetsData] Fetching complete. Assembling final data structure.`); // Removed
  return results.reduce((acc, { tab, data }) => {
    // console.log(`[sheetsData] Assigning data for tab: ${tab}`); // Removed
    if (tab === 'searchTerms') {
      acc[tab] = data as SearchTermMetric[]
    } else if (tab === 'adGroups') {
      acc[tab] = data as AdGroupMetric[]
    } else if (tab === 'negativeKeywordLists') {
      acc[tab] = data as NegativeKeywordList[]
    } else if (tab === 'campaignNegatives') {
      acc[tab] = data as CampaignNegative[]
    } else if (tab === 'adGroupNegatives') {
      acc[tab] = data as AdGroupNegative[]
    } else if (tab === 'campaignStatus') {
      acc[tab] = data as CampaignStatus[]
    } else if (tab === 'sharedListKeywords') {
      acc[tab] = data as SharedListKeyword[]
    } else {
      acc[tab] = data as AdMetric[] // Default to AdMetric for 'Daily'
    }
    return acc
  }, { daily: [], searchTerms: [], adGroups: [], negativeKeywordLists: [], campaignNegatives: [], adGroupNegatives: [], campaignStatus: [], sharedListKeywords: [] } as TabData)
}

export function getCampaigns(data: AdMetric[]): Campaign[] {
  const campaignMap = new Map<string, { id: string; name: string; totalCost: number }>()

  data.forEach(row => {
    if (!campaignMap.has(row.campaignId)) {
      campaignMap.set(row.campaignId, {
        id: row.campaignId,
        name: row.campaign,
        totalCost: row.cost
      })
    } else {
      const campaign = campaignMap.get(row.campaignId)!
      campaign.totalCost += row.cost
    }
  })

  return Array.from(campaignMap.values())
    .sort((a, b) => b.totalCost - a.totalCost) // Sort by cost descending
}

export function getMetricsByDate(data: AdMetric[], campaignId: string): AdMetric[] {
  return data
    .filter(metric => metric.campaignId === campaignId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

// SWR configuration without cache control
export const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000
}