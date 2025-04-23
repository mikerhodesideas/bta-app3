// src/lib/sheetsData.ts
import { AdMetric, Campaign, SearchTermMetric, TabData, AdGroupMetric, NegativeKeywordList, CampaignNegative, AdGroupNegative, CampaignStatus, SharedListKeyword, isSearchTermMetric, LandingPageMetric } from './types'
import { SHEET_TABS, SheetTab, DEFAULT_SHEET_URL } from './config'

async function fetchTabData(sheetUrl: string, tab: SheetTab): Promise<AdMetric[] | SearchTermMetric[] | AdGroupMetric[] | NegativeKeywordList[] | CampaignNegative[] | AdGroupNegative[] | CampaignStatus[] | SharedListKeyword[] | LandingPageMetric[]> {
  try {
    const urlWithTab = `${sheetUrl}?tab=${tab}`
    const response = await fetch(urlWithTab)

    if (!response.ok) {
      console.error(`HTTP error ${response.status} fetching tab ${tab}`)
      return []
    }

    let rawData
    try {
      rawData = await response.json()
    } catch (jsonError) {
      console.error(`Failed to parse JSON for tab ${tab}:`, jsonError)
      return []
    }

    if (!Array.isArray(rawData)) {
      if (rawData && typeof rawData === 'object' && 'error' in rawData) {
        console.error(`Error from API for tab ${tab}:`, rawData.error)
      } else {
        console.error(`Response is not an array for tab ${tab}`)
      }
      return []
    }

    // Parse data based on tab type, using correct header casing
    if (tab === 'searchTerms') {
      return rawData.map((row: any): SearchTermMetric => ({
        searchTerm: String(row['Search Term'] || ''),
        campaign: String(row['Campaign'] || ''),
        adGroup: String(row['Ad Group'] || ''),
        impr: Number(row['Impressions'] || 0),
        clicks: Number(row['Clicks'] || 0),
        cost: Number(row['Cost'] || 0),
        conv: Number(row['Conversions'] || 0),
        value: Number(row['Value'] || 0),
        cpc: Number(row['CPC'] || 0),
        ctr: Number(row['CTR'] || 0),
        convRate: Number(row['Conv Rate'] || 0),
        cpa: Number(row['CPA'] || 0),
        roas: Number(row['ROAS'] || 0)
      }))
    } else if (tab === 'adGroups') {
      return rawData.map((row: any): AdGroupMetric => ({
        campaign: String(row['Campaign'] || ''),
        campaignId: String(row['Campaign ID'] || ''),
        adGroup: String(row['Ad Group'] || ''),
        adGroupId: String(row['Ad Group ID'] || ''),
        impr: Number(row['Impressions'] || 0),
        clicks: Number(row['Clicks'] || 0),
        value: Number(row['Value'] || 0),
        conv: Number(row['Conversions'] || 0),
        cost: Number(row['Cost'] || 0),
        date: String(row['Date'] || ''),
        cpc: Number(row['CPC'] || 0),
        ctr: Number(row['CTR'] || 0),
        convRate: Number(row['Conv Rate'] || 0),
        cpa: Number(row['CPA'] || 0),
        roas: Number(row['ROAS'] || 0)
      }))
    } else if (tab === 'negativeKeywordLists') {
      return rawData.map((row: any): NegativeKeywordList => ({
        listName: String(row['List Name'] || ''),
        listId: String(row['List ID'] || ''),
        listType: String(row['List Type'] || ''),
        appliedToCampaignName: String(row['Campaign Name'] || ''),
        appliedToCampaignId: String(row['Campaign ID'] || '')
      }))
    } else if (tab === 'campaignNegatives') {
      return rawData.map((row: any): CampaignNegative => ({
        campaignName: String(row['Campaign Name'] || ''),
        campaignId: String(row['Campaign ID'] || ''),
        criterionId: String(row['Criterion ID'] || ''),
        keywordText: String(row['Keyword Text'] || ''),
        matchType: String(row['Match Type'] || '')
      }))
    } else if (tab === 'adGroupNegatives') {
      return rawData.map((row: any): AdGroupNegative => ({
        campaignName: String(row['Campaign Name'] || ''),
        campaignId: String(row['Campaign ID'] || ''),
        adGroupName: String(row['Ad Group Name'] || ''),
        adGroupId: String(row['Ad Group ID'] || ''),
        criterionId: String(row['Criterion ID'] || ''),
        keywordText: String(row['Keyword Text'] || ''),
        matchType: String(row['Match Type'] || '')
      }))
    } else if (tab === 'campaignStatus') {
      return rawData.map((row: any): CampaignStatus => {
        // Support both 'Cost' and 'Total Cost' header keys
        const rawCost = row['Cost'] ?? row['cost'] ?? row['Total Cost'] ?? row['totalCost'] ?? 0; // should be Cost
        return {
          campaignId: String(row['Campaign ID'] || ''),
          campaignName: String(row['Campaign Name'] || ''),
          status: String(row['Status'] || ''),
          channelType: String(row['Channel Type'] || ''),
          cost: Number(rawCost)
        };
      });
    } else if (tab === 'sharedListKeywords') {
      return rawData.map((row: any): SharedListKeyword => ({
        listId: String(row['List ID'] || ''),
        criterionId: String(row['Criterion ID'] || ''),
        keywordText: String(row['Keyword Text'] || ''),
        matchType: String(row['Match Type'] || ''),
        type: String(row['Type'] || '')
      }));
    } else if (tab === 'landingPages') {
      return rawData.map((row: any) => ({
        url: String(row['URL'] || ''),
        impressions: Number(row['Impressions'] || 0),
        clicks: Number(row['Clicks'] || 0),
        cost: Number(row['Cost'] || 0),
        conversions: Number(row['Conversions'] || 0),
        value: Number(row['Value'] || 0),
        ctr: Number(row['CTR'] || 0),
        cvr: Number(row['CVR'] || 0),
        cpa: Number(row['CPA'] || 0),
        roas: Number(row['ROAS'] || 0)
      }));
    }

    // Daily metrics (tab === 'daily')
    return rawData.map((row: any): AdMetric => ({
      campaign: String(row['Campaign'] || ''),
      campaignId: String(row['Campaign ID'] || ''),
      clicks: Number(row['Clicks'] || 0),
      value: Number(row['Value'] || 0),
      conv: Number(row['Conversions'] || 0),
      cost: Number(row['Cost'] || 0),
      impr: Number(row['Impressions'] || 0),
      date: String(row['Date'] || '')
    }))
  } catch (error) {
    console.error(`Error fetching ${tab} data:`, error)
    return []
  }
}

export async function fetchAllTabsData(sheetUrl: string = DEFAULT_SHEET_URL): Promise<TabData> {
  const results = await Promise.all(
    SHEET_TABS.map(async tab => {
      try {
        return {
          tab,
          data: await fetchTabData(sheetUrl, tab)
        }
      } catch (error) {
        console.error(`Failed to fetch data for tab ${tab}:`, error)
        return {
          tab,
          data: []
        }
      }
    })
  )

  return results.reduce((acc, { tab, data }) => {
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
    } else if (tab === 'landingPages') {
      acc[tab] = data as LandingPageMetric[]
    } else {
      acc[tab] = data as AdMetric[] // Default to AdMetric for 'Daily'
    }
    return acc
  }, { daily: [], searchTerms: [], adGroups: [], negativeKeywordLists: [], campaignNegatives: [], adGroupNegatives: [], campaignStatus: [], sharedListKeywords: [], landingPages: [] } as TabData)
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