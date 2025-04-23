// src/lib/metrics.ts
import { isSearchTermMetric } from './types'
import type { AdMetric, DailyMetrics, SearchTermMetric } from './types'

// Calculate aggregated metrics for daily campaign data
export function calculateMetrics(data: AdMetric[]): DailyMetrics {
  const totals = data.reduce((acc, d) => ({
    campaign: d.campaign,
    campaignId: d.campaignId,
    date: '',  // Not relevant for totals
    clicks: acc.clicks + d.clicks,
    impr: acc.impr + d.impr,
    cost: acc.cost + d.cost,
    conv: acc.conv + d.conv,
    value: acc.value + d.value,
  }), {
    campaign: '',
    campaignId: '',
    date: '',
    clicks: 0,
    impr: 0,
    cost: 0,
    conv: 0,
    value: 0
  } as AdMetric)

  return {
    ...totals,
    CTR: totals.impr ? (totals.clicks / totals.impr) * 100 : 0,
    CvR: totals.clicks ? (totals.conv / totals.clicks) * 100 : 0,
    CPA: totals.conv ? totals.cost / totals.conv : 0,
    ROAS: totals.cost ? totals.value / totals.cost : 0,
    CPC: totals.clicks ? totals.cost / totals.clicks : 0
  }
}

// Calculate daily metrics for campaign data
export function calculateDailyMetrics(data: AdMetric[]): DailyMetrics[] {
  return data.map(d => ({
    ...d,
    CTR: d.impr ? (d.clicks / d.impr) * 100 : 0,
    CvR: d.clicks ? (d.conv / d.clicks) * 100 : 0,
    CPA: d.conv ? d.cost / d.conv : 0,
    ROAS: d.cost ? d.value / d.cost : 0,
    CPC: d.clicks ? d.cost / d.clicks : 0
  }))
}

// Calculate profit for either daily or search term data
export function calculateProfit(
  data: AdMetric[] | SearchTermMetric[],
  costMetric: number,
  isProfitStrategy: boolean
): number {
  const totalValue = data.reduce((sum, d) => {
    return sum + d.value;
  }, 0)

  const totalCost = data.reduce((sum, d) => sum + d.cost, 0)
  const totalConv = data.reduce((sum, d) => {
    return sum + d.conv;
  }, 0)

  if (isProfitStrategy) {
    // For profit strategy, costMetric is Cost of Goods Sold (COGS)
    const totalCOGS = totalConv * costMetric
    return totalValue - totalCost - totalCOGS
  } else {
    // For revenue strategy, costMetric is Breakeven CPA
    const targetCost = totalConv * costMetric
    return totalValue - targetCost
  }
}

// Calculate daily profit values for either data type
export function calculateDailyProfit(
  data: AdMetric[] | SearchTermMetric[],
  costMetric: number,
  isProfitStrategy: boolean
): number[] {
  return data.map(d => {
    const value = d.value;
    const conv = d.conv;

    if (isProfitStrategy) {
      const COGS = conv * costMetric
      return value - d.cost - COGS
    } else {
      const targetCost = conv * costMetric
      return value - targetCost
    }
  })
}

// Format metric values consistently
export function formatMetric(value: number, type: 'number' | 'currency' | 'percent', currency = '$'): string {
  if (value === 0 || !value) return '0'

  if (type === 'currency') {
    return `${currency}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (type === 'percent') {
    return `${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  }

  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
} 