// src/lib/sheetsData.ts
import { AdMetric, Campaign, SearchTermMetric, TabData, AdGroupMetric, isSearchTermMetric } from './types'
import { SHEET_TABS, SheetTab, TAB_CONFIGS, DEFAULT_SHEET_URL } from './config'

async function fetchTabData(sheetUrl: string, tab: SheetTab): Promise<AdMetric[] | SearchTermMetric[] | AdGroupMetric[]> {
  try {
    const urlWithTab = `${sheetUrl}?tab=${tab}`
    const response = await fetch(urlWithTab)

    if (!response.ok) {
      throw new Error(`Failed to fetch data for tab ${tab}`)
    }

    const rawData = await response.json()

    if (!Array.isArray(rawData)) {
      console.error(`Response is not an array:`, rawData)
      return []
    }

    // Parse data based on tab type
    if (tab === 'searchTerms') {
      return rawData.map((row: any) => ({
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
        roas: Number(row['roas'] || 0),
        aov: Number(row['aov'] || 0)
      }))
    } else if (tab === 'adGroups') {
      // Map the ad groups data
      return rawData.map((row: any) => ({
        campaign: String(row['campaign'] || ''),
        campaignId: String(row['campaignId'] || ''),
        adGroup: String(row['adGroup'] || ''),
        adGroupId: String(row['adGroupId'] || ''),
        clicks: Number(row['clicks'] || 0),
        value: Number(row['value'] || 0),
        conv: Number(row['conv'] || 0),
        cost: Number(row['cost'] || 0),
        impr: Number(row['impr'] || 0),
        date: String(row['date'] || '')
      }))
    }

    // Daily metrics
    return rawData.map((row: any) => ({
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
    console.error(`Error fetching ${tab} data:`, error)
    return []
  }
}

export async function fetchAllTabsData(sheetUrl: string = DEFAULT_SHEET_URL): Promise<TabData> {
  const results = await Promise.all(
    SHEET_TABS.map(async tab => ({
      tab,
      data: await fetchTabData(sheetUrl, tab)
    }))
  )

  return results.reduce((acc, { tab, data }) => {
    if (tab === 'searchTerms') {
      acc[tab] = data as SearchTermMetric[]
    } else if (tab === 'adGroups') {
      acc[tab] = data as AdGroupMetric[];
    } else {
      acc[tab] = data as AdMetric[]
    }
    return acc
  }, { daily: [], searchTerms: [], adGroups: [] } as TabData)
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

export function getMetricOptions(activeTab: SheetTab = 'daily') {
  return TAB_CONFIGS[activeTab]?.metrics || {}
}

// SWR configuration without cache control
export const swrConfig = {
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000
} 