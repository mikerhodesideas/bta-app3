'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { CampaignSelect } from '@/components/CampaignSelect'
import { MetricsScorecard } from '@/components/MetricsScorecard'
import { MetricsChart } from '@/components/MetricsChart'
import { useSettings } from '@/lib/contexts/SettingsContext'
import { fetchAllTabsData, getCampaigns, getMetricsByDate } from '@/lib/sheetsData'
import { calculateMetrics, calculateDailyMetrics, calculateProfit, calculateDailyProfit } from '@/lib/metrics'
import { formatCurrency, formatNumber } from '@/lib/utils'
import type { MetricKey, AdMetric, AllMetricKeys, DailyMetrics, MetricOptions } from '@/lib/types'
import type { SheetTab } from '@/lib/config'
import { Button } from '@/components/ui/button'

// Define base metric options directly here
const BASE_METRIC_OPTIONS: MetricOptions = {
    cost: { label: 'Cost', format: (val) => formatCurrency(val, 'USD') }, // Provide default currency
    value: { label: 'Conv. Value', format: (val) => formatCurrency(val, 'USD') }, // Provide default currency
    clicks: { label: 'Clicks', format: formatNumber },
    conv: { label: 'Conversions', format: formatNumber },
    impr: { label: 'Impressions', format: formatNumber },
    // Calculated metrics are handled separately below
};

export function DashboardPage() {
    const { settings } = useSettings()
    const activeTab = settings.activeTab || 'Daily'
    // Use BASE_METRIC_OPTIONS, adapting currency format
    const metricOptions = Object.entries(BASE_METRIC_OPTIONS).reduce((acc, [key, value]) => {
        if (key === 'cost' || key === 'value') {
            acc[key as MetricKey] = { ...value, format: (val) => formatCurrency(val, settings.currency) };
        } else {
            acc[key as MetricKey] = value;
        }
        return acc;
    }, {} as MetricOptions);

    const [selectedMetrics, setSelectedMetrics] = useState<AllMetricKeys[]>(['cost', 'value'])
    const [chartType, setChartType] = useState<'line' | 'bar'>('line')
    const [activeChart, setActiveChart] = useState<'profit' | 'metrics'>('profit')

    const { data: tabsData = {} as Record<SheetTab, AdMetric[]>, error, isLoading } = useSWR(
        settings.sheetUrl,
        fetchAllTabsData
    )

    // Ensure we're only using daily data for the dashboard
    const adData = (tabsData?.Daily || []) as AdMetric[]
    const campaigns = getCampaigns(adData)

    // Initialize with highest spend campaign
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')

    // Update selected campaign when data changes
    useEffect(() => {
        if (campaigns.length > 0 && !selectedCampaignId) {
            // Campaigns are already sorted by totalCost descending
            setSelectedCampaignId(campaigns[0].id)
        }
    }, [campaigns, selectedCampaignId])

    const campaignData = getMetricsByDate(adData, selectedCampaignId)
    const calculatedMetrics = calculateMetrics(campaignData)
    const dailyMetrics = calculateDailyMetrics(campaignData)

    // Calculate profit metrics
    const isProfitStrategy = settings.optimizationStrategy === 'profit'
    const totalProfit = calculateProfit(campaignData, settings.costMetric, isProfitStrategy)

    // Ensure profit data has the same structure as daily metrics
    const dailyProfitData = dailyMetrics.map(day => ({
        date: day.date,
        profit: calculateProfit([day], settings.costMetric, isProfitStrategy)
    }))

    const handleMetricClick = (metric: AllMetricKeys) => {
        setSelectedMetrics((current) => {
            if (current.includes(metric)) {
                return current.filter((m) => m !== metric)
            }
            if (current.length >= 2) {
                return [current[1], metric]
            }
            return [...current, metric]
        })
    }

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

    // Combine metric options with calculated metrics
    const allMetricOptions = {
        ...metricOptions,
        CTR: { label: 'CTR', format: (val: number) => val.toFixed(1) + '%' },
        CvR: { label: 'CvR', format: (val: number) => val.toFixed(1) + '%' },
        CPA: { label: 'CPA', format: (val: number) => formatCurrency(val, settings.currency) },
        ROAS: { label: 'ROAS', format: (val: number) => val.toFixed(2) + 'x' }
    }

    return (
        <div className="container mx-auto px-4 py-12 mt-16">
            <h1 className="text-3xl font-bold mb-12 text-gray-900">Google Ads Dashboard</h1>

            <div className="mb-8">
                <CampaignSelect
                    campaigns={campaigns}
                    selectedId={selectedCampaignId}
                    onSelect={setSelectedCampaignId}
                />
            </div>

            {settings.costMetric > 0 && (
                <div className="mb-8 bg-white rounded-xl shadow-sm border p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-900">
                        {isProfitStrategy ? 'Total Profit' : 'Net Revenue'}
                    </h2>
                    <div className={`text-4xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(totalProfit, settings.currency)}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <MetricsScorecard
                    data={dailyMetrics}
                    onMetricClick={handleMetricClick}
                    selectedMetrics={selectedMetrics}
                    metricOptions={allMetricOptions}
                />
            </div>

            {/* Chart Toggle */}
            <div className="mt-8 mb-4 flex justify-end gap-2">
                <Button
                    variant={activeChart === 'profit' ? 'default' : 'outline'}
                    onClick={() => setActiveChart('profit')}
                    className={activeChart === 'profit' ? 'bg-[#ea580c] hover:bg-[#c2410c] text-white' : ''}
                    disabled={!settings.costMetric}
                >
                    {isProfitStrategy ? 'Daily Profit' : 'Daily Net Revenue'}
                </Button>
                <Button
                    variant={activeChart === 'metrics' ? 'default' : 'outline'}
                    onClick={() => setActiveChart('metrics')}
                    className={activeChart === 'metrics' ? 'bg-[#ea580c] hover:bg-[#c2410c] text-white' : ''}
                >
                    Campaign Metrics
                </Button>
            </div>

            {/* Chart Container */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
                {activeChart === 'metrics' ? (
                    <>
                        <h2 className="text-xl font-semibold mb-4 text-gray-900">Campaign Metrics</h2>
                        <MetricsChart
                            data={dailyMetrics}
                            metric1={{
                                key: selectedMetrics[0],
                                label: metricOptions[selectedMetrics[0]].label,
                                color: '#1e40af',
                                format: (v: number) => metricOptions[selectedMetrics[0]].format(v)
                            }}
                            metric2={{
                                key: selectedMetrics[1],
                                label: metricOptions[selectedMetrics[1]].label,
                                color: '#ea580c',
                                format: (v: number) => metricOptions[selectedMetrics[1]].format(v)
                            }}
                            chartType={chartType}
                        />
                    </>
                ) : settings.costMetric > 0 ? (
                    <>
                        <h2 className="text-xl font-semibold mb-4 text-gray-900">
                            Daily {isProfitStrategy ? 'Profit' : 'Net Revenue'}
                        </h2>
                        <MetricsChart
                            data={dailyProfitData}
                            metric1={{
                                key: 'profit',
                                label: isProfitStrategy ? 'Profit' : 'Net Revenue',
                                color: '#1e40af',
                                format: (v: number) => formatCurrency(v, settings.currency)
                            }}
                            chartType="bar"
                            barColors={{
                                profit: (value: number) => value >= 0 ? 'rgb(229 231 235)' : 'rgb(252 165 165)'
                            }}
                        />
                    </>
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        Please set your {isProfitStrategy ? 'Cost of Goods Sold' : 'Breakeven CPA'} in settings
                        to view profit metrics
                    </div>
                )}
            </div>
        </div>
    )
} 