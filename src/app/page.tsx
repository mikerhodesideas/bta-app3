// src/app/page.tsx

'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSettings } from '@/lib/contexts/SettingsContext'
import type { AdMetric, DailyMetrics, TabData, Campaign } from '@/lib/types'
import { calculateDailyMetrics } from '@/lib/metrics'
import { MetricCard } from '@/components/MetricCard'
import { MetricsChart } from '@/components/MetricsChart'
import { CampaignSelect } from '@/components/CampaignSelect'
import { formatCurrency, formatPercent, formatConversions } from '@/lib/utils'
import { COLORS } from '@/lib/config'
import { useDataStore } from '@/store/dataStore'
import { getCampaigns } from '@/lib/sheetsData'

// Helper for basic deep comparison of Campaign arrays
function areCampaignArraysEqual(arr1?: Campaign[], arr2?: Campaign[]): boolean {
    if (arr1 === arr2) return true;
    if (!arr1 || !arr2 || arr1.length !== arr2.length) return false;

    // Create maps for quick lookup (handles different ordering)
    const map1 = new Map(arr1.map(c => [c.id, c.name]));
    for (const campaign of arr2) {
        if (!map1.has(campaign.id) || map1.get(campaign.id) !== campaign.name) {
            return false;
        }
    }
    return true;
}

type DisplayMetric = 'impr' | 'clicks' | 'CTR' | 'CPC' | 'cost' |
    'conv' | 'CvR' | 'CPA' | 'value' | 'ROAS'

const metricConfig = {
    impr: { label: 'Impressions', format: (v: number) => v.toLocaleString(), row: 1 },
    clicks: { label: 'Clicks', format: (v: number) => v.toLocaleString(), row: 1 },
    CTR: { label: 'CTR', format: formatPercent, row: 1 },
    CPC: { label: 'CPC', format: (v: number, currency: string) => formatCurrency(v, currency), row: 1 },
    cost: { label: 'Cost', format: (v: number, currency: string) => formatCurrency(v, currency), row: 1 },
    conv: { label: 'Conv', format: formatConversions, row: 2 },
    CvR: { label: 'Conv Rate', format: formatPercent, row: 2 },
    CPA: { label: 'CPA', format: (v: number, currency: string) => formatCurrency(v, currency), row: 2 },
    value: { label: 'Value', format: (v: number, currency: string) => formatCurrency(v, currency), row: 2 },
    ROAS: { label: 'ROAS', format: (v: number) => v.toFixed(2) + 'x', row: 2 }
} as const

export default function DashboardPage() {
    const { settings, setCampaigns } = useSettings()
    const isLoading = useDataStore((state) => state.loading)
    const error = useDataStore((state) => state.error)

    const [selectedMetrics, setSelectedMetrics] = useState<[DisplayMetric, DisplayMetric]>(['cost', 'value'])
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')

    const dailyData = useDataStore((state) => state.data.daily || []) as AdMetric[]

    const campaignsFromData = useMemo(() => {
        if (dailyData && dailyData.length > 0) {
            return getCampaigns(dailyData);
        }
        return [];
    }, [dailyData]);

    useEffect(() => {
        if (campaignsFromData.length > 0) {
            if (!areCampaignArraysEqual(settings.campaigns, campaignsFromData)) {
                setCampaigns(campaignsFromData);
            }
        }
    }, [campaignsFromData, setCampaigns, settings.campaigns]);

    const aggregateMetricsByDate = useCallback((dataToAggregate: AdMetric[]): AdMetric[] => {
        const metricsByDate = dataToAggregate.reduce((acc, metric) => {
            const date = metric.date
            if (!acc[date]) {
                acc[date] = {
                    campaign: 'All Campaigns',
                    campaignId: '',
                    date,
                    impr: 0,
                    clicks: 0,
                    cost: 0,
                    conv: 0,
                    value: 0,
                }
            }
            acc[date].impr += metric.impr
            acc[date].clicks += metric.clicks
            acc[date].cost += metric.cost
            acc[date].conv += metric.conv
            acc[date].value += metric.value
            return acc
        }, {} as Record<string, AdMetric>)

        return Object.values(metricsByDate).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )
    }, []);

    const dailyMetrics = useMemo(() => calculateDailyMetrics(
        selectedCampaignId
            ? dailyData.filter(d => d.campaignId === selectedCampaignId)
            : aggregateMetricsByDate(dailyData)
    ), [selectedCampaignId, dailyData, aggregateMetricsByDate])

    const calculateTotals = () => {
        if (dailyMetrics.length === 0) return null

        const sums = dailyMetrics.reduce((acc, d) => ({
            impr: acc.impr + d.impr,
            clicks: acc.clicks + d.clicks,
            cost: acc.cost + d.cost,
            conv: acc.conv + d.conv,
            value: acc.value + d.value,
        }), {
            impr: 0, clicks: 0, cost: 0, conv: 0, value: 0,
        })

        return {
            ...sums,
            CTR: (sums.impr ? (sums.clicks / sums.impr) * 100 : 0),
            CPC: (sums.clicks ? sums.cost / sums.clicks : 0),
            CvR: (sums.clicks ? (sums.conv / sums.clicks) * 100 : 0),
            CPA: (sums.conv ? sums.cost / sums.conv : 0),
            ROAS: (sums.cost ? sums.value / sums.cost : 0),
        }
    }

    const handleMetricClick = (metric: DisplayMetric) => {
        setSelectedMetrics(prev => [prev[1], metric])
    }

    if (isLoading && dailyData.length === 0) return <DashboardLayout>Loading data...</DashboardLayout>
    if (error) return <DashboardLayout error={error}>{null}</DashboardLayout>
    if (!settings.sheetUrl) return <DashboardLayout>Please configure your Google Sheet URL in settings</DashboardLayout>
    if (!isLoading && dailyData.length === 0 && settings.sheetUrl) return <DashboardLayout>No data found for the &apos;daily&apos; tab in your sheet.</DashboardLayout>

    const totals = calculateTotals()
    if (!totals) return null

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <CampaignSelect
                    campaigns={settings.campaigns || []}
                    selectedId={selectedCampaignId}
                    onSelect={setSelectedCampaignId}
                />

                {[1, 2].map(row => (
                    <div key={row} className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                        {Object.entries(metricConfig)
                            .filter(([_, config]) => config.row === row)
                            .map(([key, config]) => (
                                <MetricCard
                                    key={key}
                                    label={config.label}
                                    value={config.format(totals[key as DisplayMetric], settings.currency)}
                                    isSelected={selectedMetrics.includes(key as DisplayMetric)}
                                    onClick={() => handleMetricClick(key as DisplayMetric)}
                                />
                            ))}
                    </div>
                ))}

                <MetricsChart
                    data={dailyMetrics}
                    metric1={{
                        key: selectedMetrics[0],
                        label: metricConfig[selectedMetrics[0]].label,
                        color: COLORS.primary,
                        format: (v: number) => metricConfig[selectedMetrics[0]].format(v, settings.currency)
                    }}
                    metric2={{
                        key: selectedMetrics[1],
                        label: metricConfig[selectedMetrics[1]].label,
                        color: COLORS.secondary,
                        format: (v: number) => metricConfig[selectedMetrics[1]].format(v, settings.currency)
                    }}
                />
            </div>
        </DashboardLayout>
    )
}

function DashboardLayout({ children, error }: { children: React.ReactNode, error?: string }) {
    return (
        <div className="container mx-auto px-4 py-12 mt-16">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Build the Agent - Participant Starter Agent</h1>
            </div>
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {children}
        </div>
    )
}